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
} from '../solar/solar.ts'
import { describeEclipse, nextEclipses, type Eclipse } from '../solar/eclipse.ts'
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

/** One row of the timetable. */
interface Row {
  label: string
  value: string
  /** Dim rows are context rather than the thing being looked up. */
  quiet?: boolean
}

/** How far ahead to look for eclipses, and how many to print. */
const ECLIPSE_HORIZON_YEARS = 100
const ECLIPSE_COUNT = 8

const CHART_HEIGHT = 132
/** Days between samples on the year chart. Sunrise moves smoothly enough. */
const CHART_STEP_DAYS = 3

export class Almanac {
  readonly element: HTMLElement
  private readonly sunList: HTMLElement
  private readonly moonList: HTMLElement
  private readonly title: HTMLElement
  private readonly chart: HTMLCanvasElement
  private readonly chartCaption: HTMLElement
  private readonly eclipseList: HTMLElement
  private eclipses: Eclipse[] | null = null
  private eclipseSpan = { from: 0, to: 0 }
  /** Told the instant of an eclipse the viewer picked. */
  onJump: ((time: number, place: { lon: number; lat: number } | null) => void) | null = null
  private readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private chartCache: { key: string; days: Array<{ rise: number | null; set: number | null; polar: string | null }> } | null =
    null

  constructor() {
    this.element = document.createElement('div')
    this.element.className = 'panel almanac'
    this.element.innerHTML = /* html */ `
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
      <p class="micro almanac-heading almanac-heading-spaced">Daylight through the year</p>
      <canvas class="almanac-chart" data-almanac-chart></canvas>
      <p class="almanac-caption micro" data-almanac-caption>—</p>
      <p class="micro almanac-heading almanac-heading-spaced">Eclipses to come</p>
      <ul class="almanac-eclipses" data-almanac-eclipses></ul>
    `
    this.title = this.q('[data-almanac-title]')
    this.sunList = this.q('[data-almanac-sun]')
    this.moonList = this.q('[data-almanac-moon]')
    this.chart = this.q('[data-almanac-chart]')
    this.chartCaption = this.q('[data-almanac-caption]')
    this.eclipseList = this.q('[data-almanac-eclipses]')
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
  }

  update(site: AlmanacSite, time: number, dpr: number): void {
    if (this.hidden) return
    this.dpr = dpr
    this.title.textContent = site.country ? `${site.name}, ${site.country}` : site.name || 'Open water'

    const events = dayEvents(site.lat, site.lon, time)
    const sun = solarState(time)
    const moon = moonState(time)
    const phase = moonPhase(sun, moon)

    this.fill(this.sunList, this.sunRows(site, time, events))
    this.fill(this.moonList, this.moonRows(site, time, moon, phase))
    this.drawChart(site, time)
    this.fillEclipses(time)
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
   * choice rather than a limit: a century is a second of work, and the list is
   * built once and kept until the clock leaves the span it covers. Picking one
   * takes the map to the instant of greatest eclipse, where the shadow itself
   * is drawn on the ground.
   */
  private fillEclipses(time: number): void {
    const from = time
    const to = time + ECLIPSE_HORIZON_YEARS * 365.25 * MS_PER_DAY
    if (!this.eclipses || time < this.eclipseSpan.from || time > this.eclipseSpan.to) {
      this.eclipses = nextEclipses(from, ECLIPSE_COUNT, ECLIPSE_HORIZON_YEARS)
      // Good until the clock passes the second of them, at which point the list
      // is stale by one and worth rebuilding.
      this.eclipseSpan = { from, to: this.eclipses[1]?.time ?? to }
    }
    const upcoming = this.eclipses.filter((e) => e.time >= time).slice(0, ECLIPSE_COUNT)

    this.eclipseList.textContent = ''
    for (const eclipse of upcoming) {
      const item = document.createElement('li')
      item.className = 'almanac-eclipse'
      const button = document.createElement('button')
      button.type = 'button'
      const when = readingIn('UTC', eclipse.time)
      const date = document.createElement('span')
      date.className = 'numeric'
      date.textContent = `${formatDate(when)}`
      const kind = document.createElement('span')
      kind.className = 'almanac-eclipse-kind'
      kind.textContent = describeEclipse(eclipse)
      const detail = document.createElement('span')
      detail.className = 'numeric almanac-eclipse-detail'
      detail.textContent =
        eclipse.kind === 'solar' && eclipse.greatest
          ? `${formatLatitude(eclipse.greatest.lat)} ${formatLongitude(eclipse.greatest.lon)}`
          : `mag ${Math.max(0, eclipse.magnitude).toFixed(2)}`
      button.append(date, kind, detail)
      button.addEventListener('click', () => {
        this.onJump?.(eclipse.time, eclipse.kind === 'solar' ? eclipse.greatest : null)
      })
      item.append(button)
      this.eclipseList.append(item)
    }
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
