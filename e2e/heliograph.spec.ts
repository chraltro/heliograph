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
  for (let i = 0; i < 22; i++) {
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
