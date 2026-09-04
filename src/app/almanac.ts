/**
 * The almanac: everything the arithmetic already knows about one place on one
 * day, which the map itself has no room to say.
 *
 * The console answers "what is happening there now". This answers "what happens
 * there today, and how does today sit in the year": the whole twilight sequence
 * rather than just sunrise, the Moon as well as the Sun, and a chart of the
 * daylight across the year with today marked on it.
 */

import { INK, SUN } from '../render/palette.ts'
import { localMoon, moonEvents, moonPhase, moonState, type MoonPhase, type MoonState } from '../solar/moon.ts'
import {
  dayEvents,
  localSolar,
  MS_PER_DAY,
  MS_PER_MINUTE,
  seasonInstant,
  solarState,
  type DayEvents,
  type SolarState,
} from '../solar/solar.ts'
import {
  describeEclipse,
  localLunarCircumstances,
  localSolarCircumstances,
  nextEclipses,
  worthSeeing,
  type Eclipse,
} from '../solar/eclipse.ts'
import {
  formatAzimuth,
  formatDate,
  formatDuration,
  formatElevation,
  formatEventTime,
  formatLatitude,
  formatLongitude,
  MINUS,
  readingIn,
} from './format.ts'

export interface AlmanacSite {
  lon: number
  lat: number
  name: string
  country: string
  /** The zone the times are told in. */
  zone: string
}

/** What one place sees of one eclipse, ready to print. */
interface LocalView {
  visible: boolean
  /** Worth stepping outside for: more than half the Sun, or the Moon well up. */
  strong: boolean
  text: string
  /** Where the map should go when the row is picked, and optionally when. */
  jumpTo: { lon: number; lat: number; time?: number } | null
}

interface SkyPoint {
  time: number
  azimuth: number
  altitude: number
}

interface SkyCurve {
  name: 'today' | 'june' | 'december' | 'moon'
  points: SkyPoint[]
}

/** One row of the timetable. */
interface Row {
  label: string
  value: string
  /** Dim rows are context rather than the thing being looked up. */
  quiet?: boolean
}

/**
 * How far ahead to look for eclipses, and how many to print.
 *
 * The search is over the geometry, so a longer list costs real time: finding
 * forty of them is a third of a second of arithmetic, which is nothing in the
 * background and an unforgivable stall in the moment a panel is opening. So the
 * first handful go up immediately and the rest arrive a beat later, by which
 * time the reader is still looking at the top of the list.
 */
const ECLIPSE_HORIZON_YEARS = 100
const ECLIPSE_FIRST = 8
const ECLIPSE_COUNT = 40

const CHART_HEIGHT = 132
const SKY_HEIGHT = 128
/** The chart runs from a little below the horizon to the zenith. */
const SKY_FLOOR = -24
/** Days between samples on the year chart. Sunrise moves smoothly enough. */
const CHART_STEP_DAYS = 3

export class Almanac {
  readonly element: HTMLElement
  private readonly sunList: HTMLElement
  private readonly moonList: HTMLElement
  private readonly title: HTMLElement
  private readonly chart: HTMLCanvasElement
  private readonly sky: HTMLCanvasElement
  private skyCache: { key: string; curves: SkyCurve[] } | null = null
  private readonly chartCaption: HTMLElement
  private readonly eclipseList: HTMLElement
  private eclipses: Eclipse[] | null = null
  private eclipseSpan = { from: 0, count: 0, exhausted: false }
  private eclipseWanted = ECLIPSE_FIRST
  private growing = false
  /** Only list what the pinned place can actually see. */
  private onlyVisible = false
  /** What each eclipse looks like from the pinned place, keyed by eclipse and site. */
  private readonly circumstances = new Map<string, LocalView>()
  /** Asked to redraw, when something the panel wanted has finished arriving. */
  onRefresh: (() => void) | null = null
  /** Told the instant of an eclipse the viewer picked. */
  onJump: ((time: number, place: { lon: number; lat: number; time?: number } | null) => void) | null = null
  /**
   * Turns a point into somewhere a reader has heard of. Coordinates are exact
   * and useless: nobody knows where 19°S 132°W is, and "off Polynesia" is the
   * answer they were asking for. Supplied by the app, which holds the gazetteer.
   */
  describePoint: ((lon: number, lat: number) => string | null) | null = null
  private readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private lastKey = ''
  private chartCache: { key: string; days: Array<{ rise: number | null; set: number | null; polar: string | null }> } | null =
    null

  constructor() {
    this.element = document.createElement('div')
    this.element.className = 'panel almanac'
    this.element.innerHTML = /* html */ `
      <button type="button" class="panel-close" data-almanac-close aria-label="Close the almanac">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg>
      </button>
      <p class="micro panel-title">Almanac</p>
      <p class="almanac-place" data-almanac-title>—</p>
      <div class="almanac-columns">
        <div>
          <p class="micro almanac-heading">Sun</p>
          <dl class="almanac-rows" data-almanac-sun></dl>
        </div>
        <div>
          <p class="micro almanac-heading">Moon</p>
          <dl class="almanac-rows" data-almanac-moon></dl>
        </div>
      </div>
      <p class="micro almanac-heading almanac-heading-spaced">The sky today</p>
      <canvas class="almanac-chart almanac-sky" data-almanac-sky></canvas>
      <p class="almanac-caption micro">Where the Sun and Moon stand through the day, by compass bearing and height. Grey: the two solstices.</p>
      <p class="micro almanac-heading almanac-heading-spaced">Daylight through the year</p>
      <canvas class="almanac-chart" data-almanac-chart></canvas>
      <p class="almanac-caption micro" data-almanac-caption>—</p>
      <div class="almanac-heading-row">
        <p class="micro almanac-heading almanac-heading-spaced">Eclipses to come</p>
        <label class="almanac-filter">
          <input type="checkbox" data-almanac-visible />
          <span>Visible from here</span>
        </label>
      </div>
      <ul class="almanac-eclipses" data-almanac-eclipses></ul>
    `
    this.title = this.q('[data-almanac-title]')
    this.sunList = this.q('[data-almanac-sun]')
    this.moonList = this.q('[data-almanac-moon]')
    this.chart = this.q('[data-almanac-chart]')
    this.sky = this.q('[data-almanac-sky]')
    this.chartCaption = this.q('[data-almanac-caption]')
    this.eclipseList = this.q('[data-almanac-eclipses]')
    this.q<HTMLInputElement>('[data-almanac-visible]').addEventListener('change', (event) => {
      this.onlyVisible = (event.target as HTMLInputElement).checked
      this.lastKey = ''
      this.onRefresh?.()
    })
    const ctx = this.chart.getContext('2d')
    if (!ctx) throw new Error('could not get a 2D context for the almanac chart')
    this.ctx = ctx
  }

  private q<T extends HTMLElement>(selector: string): T {
    const element = this.element.querySelector<T>(selector)
    if (!element) throw new Error(`missing element ${selector}`)
    return element
  }

  get hidden(): boolean {
    return this.element.hasAttribute('hidden')
  }

  setHidden(hidden: boolean): void {
    this.element.toggleAttribute('hidden', hidden)
    // Opening again has to refill, even if no time has passed since it closed.
    if (!hidden) this.lastKey = ''
  }

  update(site: AlmanacSite, time: number, dpr: number): void {
    if (this.hidden) return
    // Everything here is quoted to the minute, so recomputing it sixty times a
    // second, or four times a second as the live clock ticks, is that much work
    // thrown away: the Moon's rise and set alone is a hundred and forty five
    // lunar positions. Rebuild when the minute or the place changes, and not
    // otherwise.
    const key = `${Math.floor(time / MS_PER_MINUTE)}|${site.lat.toFixed(3)},${site.lon.toFixed(3)}|${site.zone}|${dpr}`
    if (key === this.lastKey) return
    this.lastKey = key
    this.dpr = dpr
    this.title.textContent = site.country ? `${site.name}, ${site.country}` : site.name || 'Open water'

    const events = dayEvents(site.lat, site.lon, time)
    const sun = solarState(time)
    const moon = moonState(time)
    const phase = moonPhase(sun, moon)

    this.fill(this.sunList, this.sunRows(site, time, events))
    this.fill(this.moonList, this.moonRows(site, time, moon, phase))
    this.drawSky(site, time, sun, moon)
    this.drawChart(site, time)
    this.fillEclipses(site, time)
  }

  private fill(list: HTMLElement, rows: Row[]): void {
    list.textContent = ''
    for (const row of rows) {
      const wrapper = document.createElement('div')
      if (row.quiet) wrapper.className = 'is-quiet'
      const dt = document.createElement('dt')
      dt.className = 'micro'
      dt.textContent = row.label
      const dd = document.createElement('dd')
      dd.className = 'numeric'
      dd.textContent = row.value
      wrapper.append(dt, dd)
      list.append(wrapper)
    }
  }

  private sunRows(site: AlmanacSite, time: number, events: DayEvents): Row[] {
    const at = (ms: number | null) => formatEventTime(site.zone, ms)
    const local = localSolar(site.lat, site.lon, solarState(time))

    // How much longer today is than yesterday, which is the number people
    // actually feel through the spring.
    const yesterday = dayEvents(site.lat, site.lon, time - MS_PER_DAY)
    const change = events.dayLength - yesterday.dayLength
    const changeMinutes = Math.abs(change) / MS_PER_MINUTE
    const changeText =
      events.polar || yesterday.polar
        ? '—'
        : `${change >= 0 ? '+' : MINUS}${Math.floor(changeMinutes)}m ${String(
            Math.round((changeMinutes % 1) * 60),
          ).padStart(2, '0')}s`

    const rows: Row[] = [
      { label: 'Now', value: `${formatElevation(local.elevation)} · ${formatAzimuth(local.azimuth)}` },
      { label: 'First light', value: at(events.astronomicalDawn), quiet: true },
      { label: 'Dawn', value: at(events.civilDawn), quiet: true },
      { label: 'Sunrise', value: events.polar === 'night' ? 'no sunrise' : at(events.sunrise) },
      { label: 'Golden hour', value: rangeOf(site.zone, events.sunrise, events.goldenMorning) },
      { label: 'Solar noon', value: at(events.solarNoon) },
      { label: 'Golden hour', value: rangeOf(site.zone, events.goldenEvening, events.sunset) },
      { label: 'Sunset', value: events.polar === 'day' ? 'no sunset' : at(events.sunset) },
      { label: 'Dusk', value: at(events.civilDusk), quiet: true },
      { label: 'Last light', value: at(events.astronomicalDusk), quiet: true },
      { label: 'Daylight', value: formatDuration(events.dayLength) },
      { label: 'Change', value: changeText },
      { label: 'Highest', value: formatElevation(events.maxElevation), quiet: true },
    ]
    return rows
  }

  /**
   * The eclipses to come.
   *
   * The search is over the geometry rather than a table, so the horizon is a
   * choice rather than a limit. It is not free, though — forty of them is a
   * third of a second of arithmetic — so the list is kept for as long as it is
   * still describing the future: a run built today is good for years of
   * scrubbing forward, and is only rebuilt when the clock walks back behind it
   * or eats through most of what it holds. Picking one takes the map to the
   * instant of greatest eclipse, where the shadow itself is drawn on the ground.
   */
  private fillEclipses(site: AlmanacSite, time: number): void {
    const ahead = this.eclipses?.filter((e) => e.time >= time) ?? []
    const usable =
      this.eclipses !== null &&
      time >= this.eclipseSpan.from &&
      this.eclipseSpan.count >= this.eclipseWanted &&
      // The run shortens as the clock eats into it, and is only rebuilt once
      // there is barely a panel's worth left — so scrubbing through years of
      // eclipses costs one search, not one per eclipse.
      (ahead.length >= ECLIPSE_FIRST || this.eclipseSpan.exhausted)
    if (!usable) {
      const found = nextEclipses(time, this.eclipseWanted, ECLIPSE_HORIZON_YEARS, worthSeeing)
      this.eclipses = found
      this.eclipseSpan = {
        from: time,
        count: this.eclipseWanted,
        // The horizon itself can run out before the count does, near the far
        // end of it; asking again would only find the same short list.
        exhausted: found.length < this.eclipseWanted,
      }
    }
    const upcoming = (this.eclipses ?? []).filter((e) => e.time >= time).slice(0, this.eclipseWanted)

    // The long list is fetched once the short one is on screen. A timeout
    // rather than an idle callback because Safari has never had one.
    if (this.eclipseWanted < ECLIPSE_COUNT && !this.growing) {
      this.growing = true
      setTimeout(() => {
        this.eclipseWanted = ECLIPSE_COUNT
        this.growing = false
        // The panel is memoised by the minute, so it must be told to look again.
        this.lastKey = ''
        this.onRefresh?.()
      }, 300)
    }

    this.eclipseList.textContent = ''
    let shown = 0
    for (const eclipse of upcoming) {
      const view = this.viewFrom(site, eclipse)
      if (this.onlyVisible && !view.visible) continue
      shown++
      const item = document.createElement('li')
      item.className = 'almanac-eclipse'
      if (!view.visible) item.classList.add('is-unseen')
      const button = document.createElement('button')
      button.type = 'button'
      // The date is the local one: an eclipse at 23:30 UTC is tomorrow's
      // eclipse in Tokyo, and the reader is going to write it on a calendar.
      const when = readingIn(site.zone, eclipse.time)
      const date = document.createElement('span')
      date.className = 'numeric'
      date.textContent = `${formatDate(when)}`
      const kind = document.createElement('span')
      kind.className = 'almanac-eclipse-kind'
      kind.textContent = describeEclipse(eclipse)
      const detail = document.createElement('span')
      detail.className = 'numeric almanac-eclipse-detail'
      const greatest = eclipse.kind === 'solar' ? eclipse.greatest : null
      const near = greatest ? this.describePoint?.(greatest.lon, greatest.lat) : null
      if (near) detail.classList.remove('numeric')
      detail.textContent = greatest
        ? (near ?? `${formatLatitude(greatest.lat)} ${formatLongitude(greatest.lon)}`)
        : `mag ${Math.max(0, eclipse.magnitude).toFixed(2)}`
      const local = document.createElement('span')
      local.className = 'almanac-eclipse-local'
      if (view.strong) local.classList.add('is-strong')
      local.textContent = view.text
      button.append(date, kind, detail, local)
      button.addEventListener('click', () => {
        this.onJump?.(eclipse.time, view.jumpTo)
      })
      item.append(button)
      this.eclipseList.append(item)
    }
    if (shown === 0) {
      const item = document.createElement('li')
      item.className = 'almanac-eclipse almanac-eclipse-empty'
      item.textContent = this.onlyVisible
        ? `None of the next ${upcoming.length} can be seen from ${site.name || 'here'}.`
        : 'Nothing within the horizon.'
      this.eclipseList.append(item)
    }
  }

  /**
   * One eclipse as seen from one place. Cached, because the panel is rebuilt
   * every minute and forty of these is a few dozen milliseconds of geometry
   * that gives the same answer each time.
   */
  private viewFrom(site: AlmanacSite, eclipse: Eclipse): LocalView {
    const key = `${eclipse.kind}|${Math.round(eclipse.time / MS_PER_MINUTE)}|${site.lat.toFixed(2)},${site.lon.toFixed(2)}|${site.zone}`
    const cached = this.circumstances.get(key)
    if (cached) return cached
    const place = site.name || 'here'
    let view: LocalView
    if (eclipse.kind === 'solar') {
      const local = localSolarCircumstances(eclipse, site.lon, site.lat)
      const percent = Math.round(local.obscuration * 100)
      if (percent === 0) {
        view = { visible: false, strong: false, text: `Not visible from ${place}`, jumpTo: eclipse.greatest }
      } else {
        const depth = local.obscuration >= 0.999 ? 'total' : `${percent}% covered`
        view = {
          visible: true,
          strong: local.obscuration >= 0.5,
          text: `From ${place}: ${depth} at ${formatEventTime(site.zone, local.peak)}`,
          // Go to the place the reader is standing, at the moment that matters
          // there, rather than to a point of greatest eclipse an ocean away.
          jumpTo: { lon: site.lon, lat: site.lat, time: local.peak },
        }
      }
    } else {
      const local = localLunarCircumstances(eclipse, site.lon, site.lat)
      const sublunar = moonState(eclipse.time)
      const jumpTo = { lon: sublunar.sublunarLon, lat: sublunar.sublunarLat }
      if (local.visible) {
        view = {
          visible: true,
          strong: local.elevation > 10,
          text: `From ${place}: Moon ${formatElevation(local.elevation)} up at ${formatEventTime(site.zone, eclipse.time)}`,
          jumpTo,
        }
      } else if (local.partly) {
        view = { visible: true, strong: false, text: `From ${place}: Moon rising or setting mid-eclipse`, jumpTo }
      } else {
        view = { visible: false, strong: false, text: `Not visible from ${place}: Moon below the horizon`, jumpTo }
      }
    }
    // The cache is bounded by the list and the places a reader visits; a few
    // hundred entries at most, and cleared when it grows past that.
    if (this.circumstances.size > 600) this.circumstances.clear()
    this.circumstances.set(key, view)
    return view
  }

  private moonRows(site: AlmanacSite, time: number, moon: MoonState, phase: MoonPhase): Row[] {
    const events = moonEvents(site.lat, site.lon, time)
    const local = localMoon(site.lat, site.lon, moon)
    const at = (ms: number | null) => formatEventTime(site.zone, ms)
    return [
      { label: 'Phase', value: phase.name },
      { label: 'Lit', value: `${(phase.illumination * 100).toFixed(0)}%` },
      { label: 'Age', value: `${phase.ageDays.toFixed(1)} d` },
      {
        label: 'Now',
        value:
          local.elevation > 0
            ? `${formatElevation(local.elevation)} · ${formatAzimuth(local.azimuth)}`
            : `${formatElevation(local.elevation)} · below`,
      },
      {
        label: 'Moonrise',
        value: events.circumstance === 'up' ? 'up all day' : events.circumstance === 'down' ? 'never up' : at(events.moonrise),
      },
      { label: 'Moonset', value: events.circumstance ? '—' : at(events.moonset) },
      { label: 'Distance', value: `${Math.round(moon.distanceKm).toLocaleString('en-GB')} km`, quiet: true },
      // The apparent size swings by a seventh over a month, which is the whole
      // of the supermoon business.
      { label: 'Apparent size', value: `${(moon.angularRadius * 120).toFixed(2)}′`, quiet: true },
    ]
  }

  /**
   * The sky as a chart: the Sun's bearing along the bottom, its height up the
   * side, and today's path drawn across it with the hours marked.
   *
   * This is the oldest diagram in the subject, the one on the back of every
   * sundial, and it answers questions the map cannot: which window the sun
   * comes in at breakfast, how low it stays at noon in December, whether the
   * Moon will be up over the sea tonight. The solstice curves are the envelope
   * the Sun never leaves, so today's arc is read against the year's extremes,
   * and the Moon's path is dashed because it is a different body on a
   * different schedule and must not be mistaken for a second Sun.
   */
  private drawSky(site: AlmanacSite, time: number, sun: SolarState, moon: MoonState): void {
    const width = Math.max(1, this.sky.clientWidth)
    const height = SKY_HEIGHT
    this.sky.width = Math.round(width * this.dpr)
    this.sky.height = Math.round(height * this.dpr)
    const ctx = this.sky.getContext('2d')
    if (!ctx) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const x = (azimuth: number) => (azimuth / 360) * width
    const y = (altitude: number) => height - ((altitude - SKY_FLOOR) / (90 - SKY_FLOOR)) * height

    // Cached per day and place: three hundred solar positions and as many
    // lunar ones is a few milliseconds, not worth repeating every minute.
    const reading = readingIn(site.zone, time)
    const key = `${reading.year}-${reading.month}-${reading.day}|${site.lat.toFixed(3)},${site.lon.toFixed(3)}|${site.zone}`
    if (this.skyCache?.key !== key) {
      const noon = dayEvents(site.lat, site.lon, time).solarNoon ?? time
      const curves: SkyCurve[] = []
      const trace = (anchor: number, body: 'sun' | 'moon') => {
        const points: SkyPoint[] = []
        for (let m = -12 * 60; m <= 12 * 60; m += 5) {
          const t = anchor + m * MS_PER_MINUTE
          const local =
            body === 'sun'
              ? localSolar(site.lat, site.lon, solarState(t))
              : localMoon(site.lat, site.lon, moonState(t))
          points.push({ time: t, azimuth: local.azimuth, altitude: local.elevation })
        }
        return points
      }
      curves.push({ name: 'june', points: trace(seasonInstant(reading.year, 90) + (noon - Date.UTC(reading.year, reading.month - 1, reading.day, 12)), 'sun') })
      curves.push({ name: 'december', points: trace(seasonInstant(reading.year, 270) + (noon - Date.UTC(reading.year, reading.month - 1, reading.day, 12)), 'sun') })
      curves.push({ name: 'moon', points: trace(noon, 'moon') })
      curves.push({ name: 'today', points: trace(noon, 'sun') })
      this.skyCache = { key, curves }
    }

    // Ground and sky. The twilight depths are bands, so the chart carries the
    // same vocabulary as the map's legend.
    ctx.fillStyle = INK[50]
    ctx.fillRect(0, 0, width, height)
    const bands: Array<[number, number, string]> = [
      [0, -6, 'rgba(247, 173, 48, 0.10)'],
      [-6, -12, 'rgba(120, 140, 190, 0.10)'],
      [-12, -18, 'rgba(90, 100, 150, 0.08)'],
    ]
    for (const [top, bottom, colour] of bands) {
      ctx.fillStyle = colour
      ctx.fillRect(0, y(top), width, y(bottom) - y(top))
    }

    // Compass and height rules.
    ctx.strokeStyle = INK[200]
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const azimuth of [90, 180, 270]) {
      ctx.moveTo(x(azimuth), 0)
      ctx.lineTo(x(azimuth), height)
    }
    for (const altitude of [30, 60]) {
      ctx.moveTo(0, y(altitude))
      ctx.lineTo(width, y(altitude))
    }
    ctx.stroke()
    // The horizon is the line that matters.
    ctx.strokeStyle = INK[400]
    ctx.beginPath()
    ctx.moveTo(0, y(0))
    ctx.lineTo(width, y(0))
    ctx.stroke()

    ctx.font = '500 8.5px "Inter", system-ui, sans-serif'
    ctx.fillStyle = INK[400]
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    for (const [azimuth, label] of [[90, 'E'], [180, 'S'], [270, 'W']] as const) {
      ctx.fillText(label, x(azimuth), 3)
    }
    ctx.textAlign = 'left'
    ctx.fillText('N', 3, 3)
    ctx.textAlign = 'right'
    ctx.fillText('N', width - 3, 3)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText('60°', 3, y(60) - 1)
    ctx.fillText('30°', 3, y(30) - 1)

    const stroke = (points: SkyPoint[]) => {
      ctx.beginPath()
      let drawing = false
      for (let i = 0; i < points.length; i++) {
        const point = points[i]!
        const previous = points[i - 1]
        // The bearing wraps at north; break the line rather than draw across.
        if (previous && Math.abs(point.azimuth - previous.azimuth) > 180) drawing = false
        if (drawing) ctx.lineTo(x(point.azimuth), y(point.altitude))
        else ctx.moveTo(x(point.azimuth), y(point.altitude))
        drawing = true
      }
      ctx.stroke()
    }

    for (const curve of this.skyCache.curves) {
      ctx.save()
      if (curve.name === 'today') {
        ctx.strokeStyle = SUN[400]
        ctx.lineWidth = 1.6
      } else if (curve.name === 'moon') {
        ctx.strokeStyle = INK[500]
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
      } else {
        ctx.strokeStyle = INK[300]
        ctx.lineWidth = 1
      }
      stroke(curve.points)
      ctx.restore()
    }

    // Hour marks on today's path, labelled every third hour while the Sun is
    // anywhere near the sky.
    const today = this.skyCache.curves.find((c) => c.name === 'today')!
    ctx.fillStyle = SUN[500]
    ctx.font = '500 8px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (const point of today.points) {
      const local = readingIn(site.zone, point.time)
      if (local.minute >= 5) continue
      if (point.altitude < SKY_FLOOR) continue
      const px = x(point.azimuth)
      const py = y(point.altitude)
      ctx.beginPath()
      ctx.arc(px, py, local.hour % 3 === 0 ? 2 : 1.2, 0, Math.PI * 2)
      ctx.fill()
      if (local.hour % 3 === 0 && point.altitude > -12) {
        ctx.fillStyle = INK[600]
        ctx.fillText(String(local.hour), px, py - 4)
        ctx.fillStyle = SUN[500]
      }
    }

    // Where they are now.
    const sunNow = localSolar(site.lat, site.lon, sun)
    const moonNow = localMoon(site.lat, site.lon, moon)
    if (moonNow.elevation > SKY_FLOOR) {
      ctx.strokeStyle = INK[700]
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x(moonNow.azimuth), y(moonNow.elevation), 3.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (sunNow.elevation > SKY_FLOOR) {
      ctx.fillStyle = SUN[600]
      ctx.beginPath()
      ctx.arc(x(sunNow.azimuth), y(sunNow.elevation), 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = INK[0]
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  /**
   * Daylight through the year: the band between sunrise and sunset for every
   * day, in the chosen zone's own wall clock.
   *
   * Drawing it in wall clock rather than solar time is the point. It is why the
   * band has a step in it where daylight saving starts, why the middle of the
   * day is not at the middle of the chart for a place on the wrong edge of its
   * zone, and why the polar day and night appear as the band swallowing the
   * chart whole rather than as a gap in a line.
   */
  private drawChart(site: AlmanacSite, time: number): void {
    const width = Math.max(1, this.chart.clientWidth)
    const height = CHART_HEIGHT
    this.chart.width = Math.round(width * this.dpr)
    this.chart.height = Math.round(height * this.dpr)
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const reading = readingIn(site.zone, time)
    const year = reading.year
    const key = `${year}|${site.lat.toFixed(3)},${site.lon.toFixed(3)}|${site.zone}`
    if (this.chartCache?.key !== key) {
      const days: Array<{ rise: number | null; set: number | null; polar: string | null }> = []
      const start = Date.UTC(year, 0, 1, 12)
      for (let day = 0; day < 366; day += CHART_STEP_DAYS) {
        const events = dayEvents(site.lat, site.lon, start + day * MS_PER_DAY)
        days.push({
          rise: events.sunrise === null ? null : hourOfDay(site.zone, events.sunrise),
          set: events.sunset === null ? null : hourOfDay(site.zone, events.sunset),
          polar: events.polar,
        })
      }
      this.chartCache = { key, days }
    }
    const days = this.chartCache.days
    const x = (index: number) => (index / (days.length - 1)) * width
    const y = (hour: number) => height - (hour / 24) * height
    // Columns have to tile without a seam, so each one is a whole sample step
    // wide and is centred on its own sample.
    const column = width / (days.length - 1)

    // Night behind, daylight over it, so the band is the subject.
    ctx.fillStyle = INK[50]
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = 'rgba(247, 173, 48, 0.22)'
    ctx.strokeStyle = SUN[400]
    ctx.lineWidth = 1

    // The band is drawn as a run of vertical strokes rather than a filled path,
    // because a place inside the polar circles has days with no crossings at
    // all, and a path would have to guess how to close across them.
    for (let i = 0; i < days.length; i++) {
      const day = days[i]!
      const left = x(i) - column / 2
      const w = column + 0.6
      if (day.polar === 'day') {
        ctx.fillRect(left, 0, w, height)
        continue
      }
      if (day.polar === 'night' || day.rise === null || day.set === null) continue
      if (day.rise <= day.set) {
        ctx.fillRect(left, y(day.set), w, y(day.rise) - y(day.set))
      } else {
        // The day is cut by local midnight: light at both ends of the column.
        ctx.fillRect(left, y(24), w, y(day.rise) - y(24))
        ctx.fillRect(left, y(day.set), w, y(0) - y(day.set))
      }
    }

    // Sunrise and sunset as lines on top of their own band.
    for (const which of ['rise', 'set'] as const) {
      ctx.beginPath()
      let drawing = false
      for (let i = 0; i < days.length; i++) {
        const value = days[i]![which]
        if (value === null) {
          drawing = false
          continue
        }
        if (drawing) ctx.lineTo(x(i), y(value))
        else ctx.moveTo(x(i), y(value))
        drawing = true
      }
      ctx.stroke()
    }

    // Hour gridlines every six hours, and the solstices and equinoxes.
    ctx.strokeStyle = INK[300]
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    for (const hour of [6, 12, 18]) {
      ctx.moveTo(0, y(hour))
      ctx.lineTo(width, y(hour))
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.strokeStyle = INK[500]
    ctx.globalAlpha = 0.65
    ctx.beginPath()
    for (const quarter of [0, 90, 180, 270] as const) {
      const instant = seasonInstant(year, quarter)
      const index = (instant - Date.UTC(year, 0, 1)) / MS_PER_DAY / CHART_STEP_DAYS
      ctx.moveTo(x(index), 0)
      ctx.lineTo(x(index), height)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // Today.
    const dayOfYear = (Date.UTC(reading.year, reading.month - 1, reading.day) - Date.UTC(year, 0, 1)) / MS_PER_DAY
    const todayX = x(dayOfYear / CHART_STEP_DAYS)
    ctx.strokeStyle = INK[800]
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(todayX, 0)
    ctx.lineTo(todayX, height)
    ctx.stroke()

    const today = days[Math.round(dayOfYear / CHART_STEP_DAYS)]
    const solstice = dayEvents(site.lat, site.lon, time)
    this.chartCaption.textContent =
      today && solstice
        ? `${formatDuration(solstice.dayLength)} of daylight today · the vertical rules are the solstices and equinoxes`
        : ''
  }
}

/** Hour of day, fractional, that an instant falls on in a zone. */
function hourOfDay(zone: string, ms: number): number {
  const reading = readingIn(zone, ms)
  return reading.hour + reading.minute / 60 + reading.second / 3600
}

/** "05:29 to 06:12", or a dash when either end does not happen today. */
function rangeOf(zone: string, from: number | null, to: number | null): string {
  if (from === null || to === null) return '—'
  return `${formatEventTime(zone, from)}–${formatEventTime(zone, to)}`
}
