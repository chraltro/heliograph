import { expect, test, type Page } from '@playwright/test'

/**
 * End to end coverage.
 *
 * These run against software rendering, where the first frame spends the better
 * part of a minute compiling shaders, so everything shares one page and the
 * timeouts are generous. Rather than pixel snapshots, which break on every
 * driver, the visual assertions check that the picture agrees with the
 * astronomy: the subsolar point is the brightest thing on the map, the antisolar
 * point is nearly black, and the terminator falls where it should.
 */

declare global {
  interface Window {
    __ready?: boolean
    __heliograph?: {
      redraw(): void
      applyState(query: string): void
      samplePixel(x: number, y: number): [number, number, number]
      locate(lon: number, lat: number): [number, number]
      sublunar(): { lon: number; lat: number }
    }
  }
}

// Every state is spelled out in full, layers included, so no test inherits
// whatever the one before it left switched on.
const NOON = '?t=2026-06-21T12:00:00Z&play=off&tz=UTC&layers=cities,places,graticule,boundaries'

let page: Page
const consoleProblems: string[] = []

/**
 * Warnings the tests provoke rather than the app. Both readback paths exist only
 * so the assertions can look at the actual pixels; the app itself never reads
 * either canvas back.
 */
const HARNESS_NOISE = [/GPU stall due to ReadPixels/, /willReadFrequently/]

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`))
  await page.goto(`/${NOON}`)
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 })
})

test.afterAll(async () => {
  await page.close()
})

async function apply(query: string): Promise<void> {
  await page.evaluate((q) => window.__heliograph!.applyState(q), query)
}

const luma = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** The overlay canvas, which carries the vector work, at a place. */
async function sampleOverlayAt(lon: number, lat: number): Promise<[number, number, number, number]> {
  return page.evaluate(([a, b]) => {
    const [x, y] = window.__heliograph!.locate(a!, b!)
    const canvas = document.querySelector('.overlay') as HTMLCanvasElement
    const d = canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data
    return [d[0]!, d[1]!, d[2]!, d[3]!]
  }, [lon, lat])
}

async function sampleAt(lon: number, lat: number): Promise<[number, number, number]> {
  return page.evaluate(([a, b]) => {
    const h = window.__heliograph!
    const [x, y] = h.locate(a!, b!)
    return h.samplePixel(x, y)
  }, [lon, lat])
}

test('the instrument boots and reports the instant it was asked for', async () => {
  await apply(NOON)
  await expect(page.locator('[data-date]')).toHaveText('SUN 21 JUN 2026')
  await expect(page.locator('[data-time]')).toHaveText('12:00:00')
  await expect(page.locator('[data-zone]')).toHaveText('Coordinated Universal Time')
})

test('the subsolar point is reported at the June solstice declination', async () => {
  await apply(NOON)
  const text = await page.locator('[data-subsolar]').textContent()
  // The Sun stands over the Tropic of Cancer at the solstice, so the latitude
  // must be the obliquity to within the day's own motion.
  expect(text).toMatch(/^23\.4\d° N/)
})

test('the picture agrees with the astronomy', async () => {
  test.setTimeout(180_000)
  await apply(NOON)
  // Force the first raster, which is where the shader compile is paid.
  await page.evaluate(() => window.__heliograph!.redraw())
  await sampleAt(0, 0)

  const subsolar = await sampleAt(0.5, 23.4)
  const antisolar = await sampleAt(-179.5, -23.4)
  const dayOcean = await sampleAt(-30, 20)
  const nightOcean = await sampleAt(150, -20)

  expect(luma(subsolar)).toBeGreaterThan(200)
  expect(luma(antisolar)).toBeLessThan(30)
  expect(luma(dayOcean)).toBeGreaterThan(luma(nightOcean) + 40)
})

/** Pull the signed longitude out of a readout like "0.14° S  91.88° E". */
async function subsolarLongitude(): Promise<number> {
  const text = (await page.locator('[data-subsolar]').textContent()) ?? ''
  const match = /([\d.]+)°\s*([EW])\s*$/.exec(text.trim())
  if (!match) throw new Error(`could not read a longitude from ${JSON.stringify(text)}`)
  return Number(match[1]) * (match[2] === 'W' ? -1 : 1)
}

test('the subsolar meridian sweeps west at fifteen degrees an hour', async () => {
  await apply('?t=2026-03-20T00:00:00Z&play=off&tz=UTC')
  const midnight = await subsolarLongitude()
  await apply('?t=2026-03-20T06:00:00Z&play=off&tz=UTC')
  const morning = await subsolarLongitude()

  // At midnight UTC the Sun stands over the antimeridian, and six hours later it
  // has moved a quarter of the way round, to about 90 east. The couple of
  // degrees of slack is the equation of time, which is about -7.4 minutes on
  // this date and so shifts the meridian by nearly two degrees.
  expect(Math.abs(midnight)).toBeGreaterThan(178)
  expect(morning).toBeGreaterThan(88)
  expect(morning).toBeLessThan(94)
})

test('a place readout answers sunrise, sunset and day length', async () => {
  await apply('?t=2026-08-14T13:34:00Z&play=off&tz=Europe/Oslo&pin=59.92,10.75')
  await expect(page.locator('[data-place-name]')).toHaveText('Oslo, Norway')
  await expect(page.locator('[data-place-rise]')).toHaveText('05:29')
  await expect(page.locator('[data-place-set]')).toHaveText('21:12')
  await expect(page.locator('[data-place-daylight]')).toHaveText('15h 44m')
})

test('polar night is reported rather than a bogus sunrise', async () => {
  await apply('?t=2026-12-21T12:00:00Z&play=off&tz=UTC&pin=78.22,15.65')
  await expect(page.locator('[data-place-rise]')).toHaveText('no sunrise')
  await expect(page.locator('[data-place-daylight]')).toHaveText('0h 00m')
})

test('the clock basis changes what the readout says without moving the Sun', async () => {
  await apply('?t=2026-08-14T13:34:00Z&play=off&tz=UTC')
  const subsolarUtc = await page.locator('[data-subsolar]').textContent()
  await expect(page.locator('[data-time]')).toHaveText('13:34:00')

  await page.selectOption('[data-basis]', 'Asia/Tokyo')
  await expect(page.locator('[data-time]')).toHaveText('22:34:00')
  // Changing which clock you read does not change where the Sun is.
  await expect(page.locator('[data-subsolar]')).toHaveText(subsolarUtc!)
})

test('typing a date and a time moves the map', async () => {
  await apply('?t=2026-08-14T13:34:00Z&play=off&tz=UTC')
  await page.fill('[data-date-field]', '2026-12-01')
  await page.fill('[data-time-field]', '13:34')
  await page.locator('[data-time-field]').blur()
  await expect(page.locator('[data-date]')).toHaveText('TUE 01 DEC 2026')
  await expect(page.locator('[data-subsolar]')).toContainText('S')
})

test('play and pause respond to the transport and to the space bar', async () => {
  test.setTimeout(120_000)
  await apply('?t=2026-08-14T13:34:00Z&play=off&tz=UTC')
  await expect(page.locator('[data-play]')).toHaveAttribute('aria-label', 'Play')

  await page.locator('[data-mode="day"]').click()
  await expect(page.locator('[data-mode="day"]')).toHaveAttribute('aria-pressed', 'true')
  const before = await page.locator('[data-time]').textContent()
  // Software rendering manages only a frame or two a second, so wait for the
  // clock to move rather than assuming it has by some fixed deadline.
  await expect(page.locator('[data-time]')).not.toHaveText(before!, { timeout: 30_000 })

  await page.locator('.stage').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Space')
  await expect(page.locator('[data-play]')).toHaveAttribute('aria-label', 'Play')
  const paused = await page.locator('[data-time]').textContent()
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-time]')).toHaveText(paused!)
})

test('the year sweep advances the date but holds the clock', async () => {
  test.setTimeout(120_000)
  await apply('?t=2026-03-01T12:00:00Z&play=off&tz=UTC')
  const start = await page.locator('[data-date]').textContent()
  await page.locator('[data-mode="year"]').click()
  // Software rendering manages only a frame or two a second here, so give the
  // sweep long enough to move several days.
  await expect(page.locator('[data-date]')).not.toHaveText(start!, { timeout: 30_000 })
  await page.keyboard.press('Space')
  // The wall clock is held while the date runs, which is the point of the mode.
  await expect(page.locator('[data-time]')).toHaveText('12:00:00')
})

test('the timezone layer labels zones and highlights matching clocks', async () => {
  await apply('?t=2026-12-01T13:34:00Z&play=off&tz=UTC&layers=timezones,matchClock,graticule')
  await expect(page.locator('#layer-timezones')).toBeChecked()
  // The overlay is a canvas, so the assertion is that turning the layer on
  // changes the picture in the ocean where a zone boundary runs.
  const withLayer = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.overlay') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) ink++
    return ink
  })
  await apply('?t=2026-12-01T13:34:00Z&play=off&tz=UTC&layers=graticule')
  const withoutLayer = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.overlay') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) ink++
    return ink
  })
  expect(withLayer).toBeGreaterThan(withoutLayer * 1.2)
})

test('the layers panel opens and toggles a layer', async () => {
  await apply(NOON)
  await page.locator('[data-layers-toggle]').click()
  await expect(page.locator('[data-layers]')).toBeVisible()
  const cities = page.locator('#layer-cities')
  await expect(cities).toBeChecked()
  await cities.uncheck()
  await expect(cities).not.toBeChecked()
  await cities.check()
  await page.locator('[data-layers-toggle]').click()
  await expect(page.locator('[data-layers]')).toBeHidden()
})

test('zooming with the keyboard changes the view and the address bar', async () => {
  test.setTimeout(120_000)
  await apply(NOON)
  await page.locator('.stage').click({ position: { x: 700, y: 300 } })
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await expect.poll(() => page.url(), { timeout: 30_000 }).toContain('z=')
  await page.keyboard.press('0')
  await expect.poll(() => page.url(), { timeout: 30_000 }).not.toContain('z=')
})

test('the scrubbers expose themselves to assistive technology', async () => {
  await apply('?t=2026-08-14T13:34:00Z&play=off&tz=UTC')
  const day = page.locator('[role="slider"][aria-label="Time of day"]')
  await expect(day).toHaveAttribute('aria-valuemin', '0')
  await expect(day).toHaveAttribute('aria-valuemax', '1440')
  await expect(day).toHaveAttribute('aria-valuetext', '13:34')

  await day.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-time]')).toHaveText('13:35:00')
  await page.keyboard.press('Home')
  await expect(page.locator('[data-time]')).toHaveText('00:00:00')
})

test('every control can be reached with the keyboard', async () => {
  await apply(NOON)
  await page.locator('[data-basis]').focus()
  const reachable: string[] = []
  // Generous, because a native date input is several tab stops on its own and
  // the rail has grown a search button and an almanac button since.
  for (let i = 0; i < 36; i++) {
    await page.keyboard.press('Tab')
    reachable.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return 'none'
        return el.getAttribute('aria-label') ?? el.dataset.mode ?? el.dataset.rate ?? el.tagName.toLowerCase()
      }),
    )
  }
  expect(reachable).toContain('Play')
  expect(reachable).toContain('Time of day')
  expect(reachable).toContain('Day of year')
})

test('the layout survives a phone', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await apply(NOON)
  await expect.poll(() => page.evaluate(() => document.querySelector('.map')!.clientWidth), { timeout: 30_000 }).toBe(390)
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    consoleTop: document.querySelector('.console')!.getBoundingClientRect().top,
  }))
  expect(overflow.horizontal).toBeLessThanOrEqual(0)
  expect(overflow.vertical).toBeLessThanOrEqual(0)
  expect(overflow.consoleTop).toBeGreaterThan(200)
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('search finds a place, pins it and flies to it', async () => {
  await apply(NOON)
  await page.locator('[data-search-toggle]').click()
  await page.locator('[data-search-field]').fill('reykjav')
  // Natural Earth's gazetteer spells its names without diacritics, which is
  // exactly why the search folds accents before matching.
  await expect(page.locator('.search-result').first()).toContainText('Reykjavik')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-place-name]')).toHaveText('Reykjavik, Iceland')
  const view = await page.evaluate(
    () => (window.__heliograph as unknown as { view: { centerLat: number; zoom: number } }).view,
  )
  expect(view.centerLat).toBeGreaterThan(60)
  expect(view.zoom).toBeGreaterThanOrEqual(4)
})

test('search ranks the larger place first and offers zones too', async () => {
  await page.locator('[data-search-toggle]').click()
  await page.locator('[data-search-field]').fill('london')
  const labels = await page.locator('.search-result .search-label').allTextContents()
  // London before Londonderry, and the zone offered alongside the city.
  expect(labels[0]).toBe('London')
  expect(labels.join(' ')).toContain('London, Europe')
  await page.keyboard.press('Escape')
})

test('the almanac reports the whole twilight sequence and the Moon', async () => {
  await apply('?t=2026-08-14T12:00:00Z&play=off&tz=UTC&pin=59.92,10.75&layers=places')
  await page.locator('[data-almanac-toggle]').click()
  await expect(page.locator('.almanac')).toBeVisible()
  await expect(page.locator('[data-almanac-sun] div').first()).toBeVisible()

  const rows = async (selector: string) =>
    Object.fromEntries(
      await page.locator(selector).locator('div').evaluateAll((els) =>
        els.map((el) => [el.querySelector('dt')!.textContent!, el.querySelector('dd')!.textContent!]),
      ),
    )

  const sun = await rows('[data-almanac-sun]')
  // Oslo on 14 August 2026. The clock basis above is UTC, and the almanac
  // still answers in Oslo's own zone, because an almanac for a place is about
  // that place: these are the same times the console gives with tz=Europe/Oslo.
  expect(sun['Sunrise']).toBe('05:29')
  expect(sun['Sunset']).toBe('21:12')
  expect(sun['Daylight']).toBe('15h 44m')
  // Oslo has no astronomical night in August: the Sun bottoms out at 16 degrees
  // below the horizon, so first and last light simply do not happen and are
  // reported as absent rather than invented.
  expect(sun['First light']).toContain('—')
  expect(sun['Dawn'] < sun['Sunrise']).toBe(true)
  // Days are shortening in August, so the change is negative.
  expect(sun['Change']).toMatch(/^−/)

  const moon = await rows('[data-almanac-moon]')
  expect(moon['Phase']).toBe('Waxing crescent')
  expect(moon['Lit']).toMatch(/^\d+%$/)
  expect(moon['Distance']).toMatch(/^3\d\d,\d\d\d km$/)

  // In December the whole sequence exists, and it runs in order.
  await apply('?t=2026-12-14T12:00:00Z&play=off&tz=UTC&pin=59.92,10.75&layers=places')
  const winter = await rows('[data-almanac-sun]')
  expect(winter['First light'] < winter['Dawn']).toBe(true)
  expect(winter['Dawn'] < winter['Sunrise']).toBe(true)
  expect(winter['Sunrise'] < winter['Solar noon']).toBe(true)
  expect(winter['Solar noon'] < winter['Sunset']).toBe(true)
  expect(winter['Sunset'] < winter['Dusk']).toBe(true)
  expect(winter['Dusk'] < winter['Last light']).toBe(true)
  // And in December the days are still shortening, but only just.
  expect(winter['Change']).toMatch(/^−/)

  await page.locator('[data-almanac-toggle]').click()
})

test('the world readouts count people in daylight and the next season', async () => {
  await apply('?t=2026-06-21T12:00:00Z&play=off&tz=UTC')
  const daylit = await page.locator('[data-daylit]').textContent()
  expect(daylit).toMatch(/^\d+\.\d%$/)
  const fraction = Number.parseFloat(daylit!)
  // Never all and never none: the catalogued population is spread over every
  // longitude, so the share in daylight stays well inside the extremes.
  expect(fraction).toBeGreaterThan(15)
  expect(fraction).toBeLessThan(85)

  // Three weeks before the June solstice, so that is what is next. At noon on
  // the solstice itself it has already passed and the equinox is next, which is
  // right but makes for a confusing assertion.
  await apply('?t=2026-06-01T12:00:00Z&play=off&tz=UTC')
  await expect(page.locator('[data-season-label]')).toHaveText('Next solstice')
  expect(await page.locator('[data-season]').textContent()).toMatch(/^\d+[dh]/)
})

test('starring a place survives a reload', async () => {
  await apply('?t=2026-08-14T12:00:00Z&play=off&tz=UTC&pin=59.92,10.75')
  await page.locator('[data-star]').click()
  await expect(page.locator('[data-star]')).toHaveAttribute('aria-pressed', 'true')
  const stored = await page.evaluate(() => window.localStorage.getItem('heliograph.v1'))
  expect(stored).toContain('Oslo')
})

test('the moonlight layer changes the night side and nothing else', async () => {
  // A night pixel far from any city, with the Moon well up over it.
  const query = (moon: boolean) =>
    `?t=2026-08-28T00:00:00Z&play=off&tz=UTC&z=1&lon=0&lat=0&layers=${moon ? 'moon' : ''}`
  // A full Moon sits at the antisolar point by definition, so sampling there
  // guarantees both a dark sky and the Moon directly overhead.
  await apply(query(false))
  const dark = await sampleAt(0, -10)
  await apply(query(true))
  const lit = await sampleAt(0, -10)
  expect(luma(lit)).toBeGreaterThan(luma(dark))
})

test('local time everywhere puts the whole world on one clock', async () => {
  // Open ocean at the same latitude, in four different parts of the world.
  const points: Array<[number, number]> = [
    [-150, 45],
    [-40, 45],
    [-25, 45],
    [-170, 45],
  ]
  const read = async (query: string) => {
    await apply(query)
    const out: number[] = []
    for (const [lon, lat] of points) out.push(luma(await sampleAt(lon, lat)))
    return out
  }
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values)

  const view = 'z=1&lon=0&lat=0'
  const instant = await read(`?t=2026-06-21T05:00:00Z&play=off&tz=UTC&${view}&layers=`)
  const local = await read(`?t=2026-06-21T05:00:00Z&play=off&tz=UTC&${view}&layers=localTime`)

  // Normally those four points are spread from the middle of the night to the
  // middle of the morning. On one local clock they are all at the same hour of
  // their own day, so they look alike.
  expect(spread(instant)).toBeGreaterThan(25)
  expect(spread(local)).toBeLessThan(spread(instant) / 2)

  // And at five in the morning in June the northern hemisphere is up and the
  // southern is not, which is the fact the mode exists to show.
  await apply(`?t=2026-06-21T05:00:00Z&play=off&tz=UTC&${view}&layers=localTime`)
  expect(luma(await sampleAt(-40, 45))).toBeGreaterThan(luma(await sampleAt(-40, -45)) + 15)
})

test('an eclipse puts the Moon shadow on the ground', async () => {
  // Totality over Wyoming during the eclipse of 21 August 2017.
  await apply('?t=2017-08-21T17:43:50Z&play=off&tz=UTC&z=1&lon=0&lat=0&layers=')
  const shadowed = luma(await sampleAt(-106.3, 42.85))
  // The same place two hours earlier, in ordinary sunshine.
  await apply('?t=2017-08-21T15:43:50Z&play=off&tz=UTC&z=1&lon=0&lat=0&layers=')
  const sunlit = luma(await sampleAt(-106.3, 42.85))
  expect(sunlit).toBeGreaterThan(shadowed * 3)

  // New York, outside the umbra at that moment, keeps its light.
  await apply('?t=2017-08-21T17:43:50Z&play=off&tz=UTC&z=1&lon=0&lat=0&layers=')
  expect(luma(await sampleAt(-74, 40.7))).toBeGreaterThan(shadowed * 3)
})

test('an eclipse is drawn as the line it is, not as a spot', async () => {
  await apply('?t=2017-08-21T18:26:00Z&play=off&tz=UTC&z=1&lon=-60&lat=25&layers=')

  /** Whether the overlay has anything sun coloured within a few pixels. */
  const warmNear = async (lon: number, lat: number, radius = 6) =>
    page.evaluate(
      ([a, b, r]) => {
        const [x, y] = window.__heliograph!.locate(a!, b!)
        const canvas = document.querySelector('.overlay') as HTMLCanvasElement
        const context = canvas.getContext('2d')!
        const size = r! * 2 + 1
        const data = context.getImageData(Math.round(x) - r!, Math.round(y) - r!, size, size).data
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3]! > 120 && data[i]! > 210 && data[i + 1]! > 150 && data[i + 2]! < 130) return true
        }
        return false
      },
      [lon, lat, radius] as const,
    )

  // Three places on the 2017 track, an hour apart, all of them a long way from
  // the point of greatest eclipse in Kentucky.
  expect(await warmNear(-124.0, 44.96)).toBe(true)
  expect(await warmNear(-86.78, 36.17)).toBe(true)
  expect(await warmNear(-79.93, 32.78)).toBe(true)
  // And nowhere near it, so this is a path rather than a wash of colour.
  expect(await warmNear(-47.9, -15.8)).toBe(false)

  // A day later there is no eclipse and therefore no line.
  await apply('?t=2017-08-22T18:26:00Z&play=off&tz=UTC&z=1&lon=-60&lat=25&layers=')
  expect(await warmNear(-86.78, 36.17)).toBe(false)
})

test('the umbra is drawn as a band of its real width, not a hairline', async () => {
  // Dallas sat inside the 2024 umbra, which was about 190 km across there. At
  // zoom 4 on this viewport a degree is sixteen pixels, so the band is a good
  // twenty pixels tall and a sample across it must find the fill on both
  // sides of the axis and nothing a hundred kilometres beyond it.
  await apply('?t=2024-04-08T18:42:00Z&play=off&tz=UTC&z=4&lon=-97&lat=33&layers=')
  const column = await page.evaluate(() => {
    const [x, y] = window.__heliograph!.locate(-96.8, 32.78)
    const canvas = document.querySelector('.overlay') as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y) - 60, 1, 121).data
    const warm: number[] = []
    for (let i = 0; i < 121; i++) {
      const o = i * 4
      if (data[o + 3]! > 40 && data[o]! > 150 && data[o + 2]! < 140) warm.push(i - 60)
    }
    return warm
  })
  const above = column.filter((d) => d < -3).length
  const below = column.filter((d) => d > 3).length
  expect(above).toBeGreaterThan(3)
  expect(below).toBeGreaterThan(3)
  // And it stops: nothing fifty pixels out, which is three hundred kilometres.
  expect(column.some((d) => Math.abs(d) > 50)).toBe(false)
})

test('a lunar eclipse draws the half of the world that can see it', async () => {
  // Mid totality on 7 September 2025. The Moon was overhead in the Indian
  // Ocean, so the rim of the visible hemisphere runs through the Pacific and
  // the Atlantic and nowhere near the sublunar point itself.
  await apply('?t=2025-09-07T18:11:00Z&play=off&tz=UTC&z=1&lon=80&lat=0&layers=moon')
  const count = await page.evaluate(() => {
    const canvas = document.querySelector('.overlay') as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let pale = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 120 && data[i]! > 150 && Math.abs(data[i]! - data[i + 2]!) < 30) pale++
    }
    return pale
  })
  expect(count).toBeGreaterThan(300)
  // The Moon itself is drawn copper, not white, while it is in the umbra.
  const glyph = await sampleOverlayAt(86.73, -6.0)
  expect(glyph[0]).toBeGreaterThan(glyph[2] + 60)
  // A day later, no rim and an ordinary Moon.
  await apply('?t=2025-09-08T18:11:00Z&play=off&tz=UTC&z=1&lon=80&lat=0&layers=moon')
  const after = await page.evaluate(() => {
    const canvas = document.querySelector('.overlay') as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let pale = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 120 && data[i]! > 150 && Math.abs(data[i]! - data[i + 2]!) < 30) pale++
    }
    return pale
  })
  expect(after).toBeLessThan(count / 4)
})

test('the Moon glyph shows the right phase', async () => {
  // A waxing gibbous Moon, 85 percent lit: most of the disc should be bright.
  // The terminator used to be traced the wrong way round, which drew this as
  // a thin crescent and a full Moon as nothing.
  await apply('?t=2026-08-26T12:00:00Z&play=off&tz=UTC&z=1&lon=0&lat=0&layers=moon')
  const lit = await page.evaluate(() => {
    const h = window.__heliograph!
    const canvas = document.querySelector('.overlay') as HTMLCanvasElement
    const context = canvas.getContext('2d')!
    const moon = h.sublunar()
    const [x, y] = h.locate(moon.lon, moon.lat)
    const data = context.getImageData(Math.round(x) - 7, Math.round(y) - 7, 15, 15).data
    let bright = 0
    let dark = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 100) continue
      if (data[i]! > 180) bright++
      else dark++
    }
    return { bright, dark }
  })
  expect(lit.bright).toBeGreaterThan(lit.dark)
})

test('the almanac opens closed, and can always be closed again', async () => {
  // A panel that covers the map must not restore itself, and must be closable
  // from inside itself: remembering it was open left a returning visitor on a
  // phone staring at a full screen panel with no idea what had happened.
  await page.reload()
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 })
  await expect(page.locator('.almanac')).toBeHidden()

  await page.locator('[data-almanac-toggle]').click()
  await expect(page.locator('.almanac')).toBeVisible()
  await page.locator('[data-almanac-close]').click()
  await expect(page.locator('.almanac')).toBeHidden()

  await page.locator('[data-almanac-toggle]').click()
  await expect(page.locator('.almanac')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.almanac')).toBeHidden()
})

test('the almanac lists eclipses and jumps to one', async () => {
  await apply('?t=2026-08-14T12:00:00Z&play=off&tz=UTC&pin=59.92,10.75&layers=places')
  await page.locator('[data-almanac-toggle]').click()
  await expect(page.locator('.almanac-eclipse').first()).toBeVisible()
  const listed = await page.locator('.almanac-eclipse button').allTextContents()
  // Only the ones worth looking up for. A penumbral lunar eclipse at magnitude
  // zero is invisible to the naked eye, and a shallow partial is barely better;
  // listing them buries the total eclipses that are the reason to look at all.
  expect(listed.join(' ')).not.toContain('Penumbral')
  expect(listed.join(' ')).not.toContain('Partial')
  expect(listed.join(' ')).toContain('Total solar')

  // The first after 14 August 2026 is the annular of 6 February 2027.
  expect(listed[0]).toContain('06 FEB 2027')
  expect(listed[0]).toContain('Annular solar')

  // A solar eclipse is placed somewhere a reader has heard of. The total of
  // August 2027 is greatest over Upper Egypt, a few miles from Luxor.
  const egypt = listed.find((row) => row.includes('02 AUG 2027'))
  expect(egypt).toContain('Egypt')

  // The short list goes up at once and the long one fills in behind it, so
  // there is a run of them to scroll rather than a handful.
  await expect.poll(() => page.locator('.almanac-eclipse').count(), { timeout: 15_000 }).toBeGreaterThan(24)

  // Every solar row says what the pinned place will see of it, and which of
  // the lunar outcomes applies: the August 2027 eclipse over Egypt takes a
  // fifth of the Sun as seen from Oslo, in the morning there.
  const egyptRow = listed.find((row) => row.includes('02 AUG 2027'))
  expect(egyptRow).toMatch(/From Oslo: \d+% covered at (09|10|11):\d\d/)
  const lunarRow = listed.find((row) => row.includes('Total lunar'))
  expect(lunarRow).toMatch(/Moon (\d+\.\d° up|below the horizon|rising or setting)/)

  // The filter keeps only what can be seen from here.
  await page.locator('[data-almanac-visible]').check()
  await expect.poll(() => page.locator('.almanac-eclipse').allTextContents()).not.toContain(expect.stringContaining('Not visible'))
  const visibleOnly = await page.locator('.almanac-eclipse button').allTextContents()
  expect(visibleOnly.length).toBeGreaterThan(3)
  expect(visibleOnly.every((row) => !row.includes('Not visible'))).toBe(true)
  await page.locator('[data-almanac-visible]').uncheck()
  await expect.poll(() => page.locator('.almanac-eclipse').count()).toBeGreaterThan(visibleOnly.length)

  await page.locator('.almanac-eclipse button').first().click()
  await expect(page.locator('[data-date]')).toHaveText('SAT 06 FEB 2027')
  await page.locator('[data-almanac-toggle]').click()
})

test('nothing was logged to the console along the way', async () => {
  const unique = [...new Set(consoleProblems)].filter(
    (message) => !HARNESS_NOISE.some((pattern) => pattern.test(message)),
  )
  expect(unique, unique.join('\n')).toHaveLength(0)
})

/**
 * Touch. A phone gets a different default view, because the whole world at once
 * on a tall narrow screen is a thin strip, and it gets gestures rather than a
 * hover, because a finger is a pointer and not a cursor.
 */
test.describe('on a phone', () => {
  let phone: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    })
    phone = await context.newPage()
    await phone.goto('/?t=2026-08-14T13:34:00Z&play=off&tz=Europe/Oslo&pin=59.92,10.75')
    await phone.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 })
  })

  test.afterAll(async () => {
    await phone.close()
  })

  test('nothing overflows and the map fills the space it is given', async () => {
    const shape = await phone.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect()
      const app = document.documentElement
      return {
        overflowX: app.scrollWidth - app.clientWidth,
        overflowY: app.scrollHeight - app.clientHeight,
        mapWidth: document.querySelector('.map')!.clientWidth,
        stageHeight: stage.height,
        // The plate is half as tall as the world is wide.
        plateHeight: (window.__heliograph as unknown as { view: { zoom: number } }).view.zoom * 390 * 0.5,
      }
    })
    expect(shape.overflowX).toBeLessThanOrEqual(0)
    expect(shape.overflowY).toBeLessThanOrEqual(0)
    expect(shape.mapWidth).toBe(390)
    // It opens zoomed rather than showing a thin strip in a sea of surround.
    expect(shape.plateHeight).toBeGreaterThan(shape.stageHeight * 0.6)
  })

  test('a tap pins a place and a pinch zooms', async () => {
    const before = await phone.evaluate(() => (window.__heliograph as unknown as { view: { zoom: number } }).view.zoom)

    await phone.touchscreen.tap(195, 260)
    await expect(phone.locator('[data-place-name]')).not.toHaveText('—')

    const session = await phone.context().newCDPSession(phone)
    const spread = async (gap: number) => {
      await session.send('Input.dispatchTouchEvent', {
        type: gap === 0 ? 'touchEnd' : 'touchMove',
        touchPoints:
          gap === 0
            ? []
            : [
                { x: 195 - gap, y: 260, id: 1 },
                { x: 195 + gap, y: 260, id: 2 },
              ],
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 155, y: 260, id: 1 },
        { x: 235, y: 260, id: 2 },
      ],
    })
    for (const gap of [55, 70, 90, 110]) await spread(gap)
    await spread(0)

    await expect
      .poll(() => phone.evaluate(() => (window.__heliograph as unknown as { view: { zoom: number } }).view.zoom), {
        timeout: 10_000,
      })
      .toBeGreaterThan(before * 1.15)
  })

  /**
   * iOS inflates the type inside wide blocks on its own initiative unless it is
   * told not to, which burst the console sideways off the screen. The stylesheet
   * now refuses the inflation and the sheet clips rather than scrolls, so this
   * asserts the sheet holds even when every size in it is inflated anyway.
   */
  test('the console stays inside the screen, even with the type inflated', async () => {
    const measure = () =>
      phone.evaluate(() => {
        const sheet = document.querySelector('.console')!
        const escaped = ['[data-date]', '[data-time]', '[data-zone]', '[data-play]', '[data-modes]']
          .map((selector) => document.querySelector(selector)!.getBoundingClientRect())
          .filter((box) => box.left < -0.5 || box.right > window.innerWidth + 0.5).length
        return { overflow: sheet.scrollWidth - sheet.clientWidth, escaped }
      })

    expect(await measure()).toEqual({ overflow: 0, escaped: 0 })

    // Sizes are read first and applied second, the way the platform does it, so
    // that nesting does not multiply the inflation out of all recognition.
    await phone.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>('.console, .console *')]
      const sizes = els.map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      els.forEach((el, i) => {
        el.dataset.inflated = '1'
        el.style.fontSize = `${sizes[i]! * 1.75}px`
      })
    })
    const inflated = await measure()
    await phone.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-inflated]')) {
        el.style.fontSize = ''
        delete el.dataset.inflated
      }
    })
    expect(inflated.overflow).toBeLessThanOrEqual(1)
    expect(inflated.escaped).toBe(0)
  })

  /** A three times display gets three times the pixels, or it looks like mush. */
  test('the map is drawn at the density of the screen', async () => {
    const density = await phone.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map')!
      return canvas.width / canvas.clientWidth
    })
    expect(density).toBeCloseTo(3, 1)
  })

  /** On a phone the almanac must leave the map and the sheet reachable. */
  test('the almanac fits the phone rather than covering it', async () => {
    await phone.locator('[data-almanac-toggle]').click()
    await expect(phone.locator('.almanac')).toBeVisible()
    const fits = await phone.evaluate(() => {
      const panel = document.querySelector('.almanac')!.getBoundingClientRect()
      const sheet = document.querySelector('.console')!.getBoundingClientRect()
      return {
        withinWidth: panel.left >= 0 && panel.right <= window.innerWidth,
        clearOfSheet: panel.bottom <= sheet.top,
        belowRail: panel.top > 40,
      }
    })
    expect(fits).toEqual({ withinWidth: true, clearOfSheet: true, belowRail: true })

    // And it must scroll under a finger. The stage used to refuse the browser's
    // own panning on behalf of everything inside it, canvases and panels alike,
    // which left a panel taller than the screen with no way to reach its foot.
    await expect
      .poll(() => phone.locator('.almanac-eclipse').count(), { timeout: 15_000 })
      .toBeGreaterThan(24)
    const scroll = await phone.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.almanac')!
      const chain: string[] = []
      for (let node: HTMLElement | null = panel; node; node = node.parentElement) {
        chain.push(getComputedStyle(node).touchAction)
      }
      panel.scrollTop = 10_000
      return {
        overflows: panel.scrollHeight > panel.clientHeight + 8,
        reached: panel.scrollTop > 0,
        // "none" anywhere up the chain and a touch drag never becomes a scroll.
        blocked: chain.some((value) => value === 'none'),
      }
    })
    expect(scroll).toEqual({ overflows: true, reached: true, blocked: false })

    await phone.locator('[data-almanac-close]').click()
    await expect(phone.locator('.almanac')).toBeHidden()
  })

  test('the touch targets are big enough to hit', async () => {
    const sizes = await phone.evaluate(() =>
      ['[data-play]', '[data-step="1"]', '[data-mode="day"]'].map((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect()
        return Math.min(box.width, box.height)
      }),
    )
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(32)
  })
})
