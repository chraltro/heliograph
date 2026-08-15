import type { City, WorldData } from '../data/world.ts'
import { PlaceIndex, ZoneIndex } from '../data/lookup.ts'
import { DEFAULT_TUNING, MapRenderer, type Frame, type Layers, type Tuning } from '../render/map-renderer.ts'
import { MapOverlay, type OverlayLayers, type PlaceLabel, type ZoneLabel } from '../render/overlay.ts'
import { linearRgbToHex, sampleSurfaceRamp } from '../render/palette.ts'
import {
  clampView,
  fitWidth,
  panBy,
  project,
  unproject,
  worldHeight,
  worldWidth,
  wrapLongitude,
  zoomAt,
  type Size,
  type View,
} from '../render/view.ts'
import {
  analemma,
  dayEvents,
  elevationAt,
  HORIZON,
  localSolar,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  seasonInstant,
  solarState,
  type SolarState,
} from '../solar/solar.ts'
import { moonlight, moonPhase, moonState, type MoonPhase, type MoonState } from '../solar/moon.ts'
import { shadowUniforms } from '../solar/eclipse.ts'
import { isValidZone, listZones, localZone, wallClockToUtc, zoneOffsetMinutes } from '../time/timezone.ts'
import terrainUrl from '../assets/terrain.webp'
import terrainSeasonUrl from '../assets/terrain-season.webp'
import {
  formatAzimuth,
  formatClock,
  formatDate,
  formatDuration,
  formatElevation,
  formatEventTime,
  formatLatitude,
  formatLongitude,
  formatWeekday,
  prettyZone,
  readingIn,
  zoneSummary,
  type Reading,
} from './format.ts'
import { Scrubber } from './scrubber.ts'
import { Almanac } from './almanac.ts'
import { PlaceSearch, type SearchResult } from './search.ts'
import { loadPreferences, samePlace, savePreferences, type Preferences } from './prefs.ts'
import { composeImage, shareOrDownload } from './export.ts'

/** Wall clock milliseconds for one full sweep at rate 1. */
const DAY_SWEEP = 20_000
const YEAR_SWEEP = 60_000

type MotionMode = 'paused' | 'live' | 'day' | 'year'

interface Site {
  lon: number
  lat: number
  name: string
  country: string
}

const TEMPLATE = /* html */ `
<header class="rail">
  <div class="mark">
    <svg class="mark-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" class="mark-disc" />
      <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" class="mark-lit" />
      <circle cx="12" cy="12" r="10.5" class="mark-ring" />
    </svg>
    <span class="mark-name">Heliograph</span>
  </div>

  <div class="rail-readout">
    <span class="micro">Subsolar point</span>
    <span class="numeric" data-subsolar>—</span>
  </div>

  <div class="rail-readout rail-readout-wide">
    <span class="micro">People in daylight</span>
    <span class="numeric" data-daylit>—</span>
  </div>

  <div class="rail-readout rail-readout-wide">
    <span class="micro" data-season-label>Next solstice</span>
    <span class="numeric" data-season>—</span>
  </div>

  <div class="rail-controls">
    <button type="button" class="button button-icon" data-search-toggle aria-label="Find a place" title="Find a place (press /)">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M10.4 10.4 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
    <label class="micro" for="basis">Clock</label>
    <select id="basis" data-basis></select>
    <input class="field" type="date" data-date-field aria-label="Date" />
    <input class="field" type="time" data-time-field aria-label="Time of day" step="60" />
    <button type="button" class="button" data-now>Now</button>
    <button type="button" class="button" data-almanac-toggle aria-expanded="false" aria-controls="almanac" title="Almanac (press A)">Almanac</button>
    <button type="button" class="button" data-layers-toggle aria-expanded="false" aria-controls="layers">Layers</button>
  </div>
</header>

<main class="stage" data-stage>
  <canvas class="map" data-map></canvas>
  <canvas class="overlay" data-overlay></canvas>

  <button type="button" class="fab" data-recenter aria-label="Reset the view to your place">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="1.6"/>
      <path d="M10 1v3.2M10 15.8V19M1 10h3.2M15.8 10H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>

  <div class="search" data-search hidden>
    <input class="search-field" type="search" data-search-field placeholder="Find a place or a time zone" aria-label="Find a place or a time zone" autocomplete="off" spellcheck="false" />
    <ul class="search-results" data-search-results role="listbox"></ul>
  </div>

  <div class="panel layers" id="layers" data-layers hidden>
    <p class="micro panel-title">Layers</p>
    <div data-layer-list></div>
    <p class="micro panel-title panel-title-spaced">Twilight</p>
    <ul class="legend" data-legend></ul>
  </div>
</main>

<footer class="console" data-console>
  <button type="button" class="sheet-grip" data-sheet-toggle aria-expanded="false" aria-label="Show more detail">
    <span class="sheet-grip-bar" aria-hidden="true"></span>
  </button>

  <div class="console-grid">
    <section class="clock">
      <p class="clock-date numeric" data-date>—</p>
      <p class="clock-time numeric" data-time>—</p>
      <p class="clock-zone micro" data-zone>—</p>
    </section>

    <section class="transport">
      <div class="transport-row">
        <button type="button" class="button button-step" data-step="-1" aria-label="Step back one hour">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3v10L4 8z"/><rect x="2.5" y="3" width="1.4" height="10"/></svg>
        </button>
        <button type="button" class="button button-play" data-play aria-label="Play">
          <svg viewBox="0 0 16 16" aria-hidden="true" data-play-icon><path d="M4 2.5v11l9-5.5z"/></svg>
        </button>
        <button type="button" class="button button-step" data-step="1" aria-label="Step forward one hour">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3v10L12 8z"/><rect x="12.1" y="3" width="1.4" height="10"/></svg>
        </button>
      </div>
      <div class="segmented" role="group" aria-label="What to animate" data-modes></div>
      <div class="segmented segmented-quiet" role="group" aria-label="Speed" data-rates></div>
    </section>

    <section class="place" aria-live="polite">
      <p class="micro" data-place-label>Under the pointer</p>
      <p class="place-head">
        <span class="place-name" data-place-name>—</span>
        <button type="button" class="icon-button" data-star aria-pressed="false" aria-label="Save this place">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 9.9 5.7l4.5.5-3.3 3 .9 4.4L8 11.4l-4 2.2.9-4.4-3.3-3 4.5-.5z"/></svg>
        </button>
        <button type="button" class="icon-button" data-share aria-label="Save a picture of this view">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 11 5H9v5H7V5H5zM2.5 9.5h2v3h7v-3h2v5h-11z"/></svg>
        </button>
      </p>
      <p class="place-coords numeric" data-place-coords>—</p>
      <dl class="facts">
        <div><dt class="micro">Local</dt><dd class="numeric" data-place-clock>—</dd></div>
        <div><dt class="micro">Sun</dt><dd class="numeric" data-place-sun>—</dd></div>
        <div><dt class="micro">Rise</dt><dd class="numeric" data-place-rise>—</dd></div>
        <div><dt class="micro">Set</dt><dd class="numeric" data-place-set>—</dd></div>
        <div><dt class="micro">Daylight</dt><dd class="numeric" data-place-daylight>—</dd></div>
      </dl>
    </section>
  </div>

  <div class="scrubbers" data-scrubbers></div>
</footer>
`

/**
 * Where the shell switches from the desktop arrangement, three stacked bands,
 * to the phone one: a full screen map with the rail floating on top and the
 * console folded into a bottom sheet. Mirrored exactly in style.css.
 */
const SHEET_MEDIA = '(max-width: 720px), (pointer: coarse) and (max-height: 520px)'

const LAYER_FIELDS = [
  { key: 'cities', label: 'City lights', group: 'map' },
  { key: 'places', label: 'Place names', group: 'overlay' },
  { key: 'timezones', label: 'Time zones', group: 'overlay' },
  { key: 'matchClock', label: 'Same clock time', group: 'special' },
  { key: 'graticule', label: 'Graticule', group: 'overlay' },
  { key: 'boundaries', label: 'Twilight lines', group: 'overlay' },
  { key: 'analemma', label: 'Analemma', group: 'overlay' },
  { key: 'moon', label: 'Moonlight', group: 'map' },
  { key: 'localTime', label: 'Local time everywhere', group: 'special' },
  { key: 'borders', label: 'Borders', group: 'map' },
] as const

const LEGEND = [
  { label: 'Day', hint: 'Sun above the horizon', elevation: 20 },
  { label: 'Golden hour', hint: '+6° to 0°', elevation: 3 },
  { label: 'Civil twilight', hint: '0° to −6°', elevation: -3 },
  { label: 'Nautical twilight', hint: '−6° to −12°', elevation: -9 },
  { label: 'Astronomical twilight', hint: '−12° to −18°', elevation: -15 },
  { label: 'Night', hint: 'Below −18°', elevation: -22 },
]

export class Heliograph {
  private readonly root: HTMLElement
  private readonly world: WorldData
  private readonly zones: ZoneIndex
  private readonly places: PlaceIndex

  private mapCanvas!: HTMLCanvasElement
  private overlayCanvas!: HTMLCanvasElement
  private stage!: HTMLElement
  private renderer!: MapRenderer
  private overlay!: MapOverlay
  private dayScrubber!: Scrubber
  private yearScrubber!: Scrubber

  private time = Date.now()
  private basis = 'UTC'
  private mode: MotionMode = 'live'
  private lastMotion: Exclude<MotionMode, 'paused'> = 'live'
  private rate = 1
  private view: View = { centerLon: 0, centerLat: 0, zoom: 1 }
  private size: Size = { width: 1, height: 1 }
  private dpr = 1

  private hover: { lon: number; lat: number } | null = null
  private focus: Site | null = null
  private reveal = 0
  private startedAt = 0
  private lastFrame = 0
  private dirty = true
  private tuning: Tuning = { ...DEFAULT_TUNING }
  private analemmaCache: { year: number; hour: number; points: Array<{ lon: number; lat: number }> } | null = null
  private moonCache: { time: number; state: MoonState; phase: MoonPhase; gain: number } | null = null
  private daylitCache: { minute: number; value: number } | null = null
  private zoneOffsetDay = Number.NaN
  private almanac!: Almanac
  private search!: PlaceSearch
  private closeSearch: (() => void) | null = null
  private readonly prefs: Preferences = loadPreferences()
  private zoneClockCache = new Map<string, { minute: number; text: string }>()

  private readonly layers: Record<string, boolean> = {
    cities: true,
    places: true,
    timezones: false,
    matchClock: false,
    graticule: true,
    boundaries: true,
    analemma: false,
    moon: true,
    localTime: false,
    borders: false,
    coast: true,
    lakes: true,
  }

  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(root: HTMLElement, world: WorldData) {
    this.root = root
    this.world = world
    this.zones = new ZoneIndex(world)
    this.places = new PlaceIndex(world.cities, world.namedCount)
  }

  // ------------------------------------------------------------------ startup

  async start(): Promise<void> {
    this.root.innerHTML = TEMPLATE
    this.mapCanvas = this.q('[data-map]')
    this.overlayCanvas = this.q('[data-overlay]')
    this.stage = this.q('[data-stage]')

    this.renderer = new MapRenderer(this.mapCanvas, this.world)
    this.overlay = new MapOverlay(this.overlayCanvas)
    this.loadTerrain()

    this.basis = localZone()
    this.focus = this.defaultSite()
    if (this.reducedMotion) this.mode = 'paused'

    // Stored preferences first, then the URL over the top of them: a link
    // describes a particular view and must always win over a habit.
    if (this.prefs.basis && isValidZone(this.prefs.basis)) this.basis = this.prefs.basis
    if (this.prefs.rate !== null && [0.5, 1, 2, 4].includes(this.prefs.rate)) this.rate = this.prefs.rate
    if (this.prefs.layers) {
      const wanted = new Set(this.prefs.layers)
      for (const field of LAYER_FIELDS) this.layers[field.key] = wanted.has(field.key)
    }
    this.readUrl(new URLSearchParams(location.search))

    this.buildBasisOptions()
    this.buildTimeFields()
    this.buildLayerControls()
    this.buildLegend()
    this.buildTransport()
    this.buildScrubbers()
    this.buildSearch()
    this.buildAlmanac()
    this.buildSavedPlaces()
    this.buildShare()
    this.buildSheet()
    this.bindPointer()
    this.bindKeyboard()
    this.lockPageGestures()

    const observer = new ResizeObserver(() => this.resize())
    observer.observe(this.stage)
    window.addEventListener('resize', () => this.resize())
    this.resize()

    // Wait for the embedded faces so the first painted frame has the right type.
    await document.fonts.ready.catch(() => undefined)
    this.dayScrubber.resize(this.dpr)
    this.yearScrubber.resize(this.dpr)
    this.syncSheet()

    this.startedAt = performance.now()
    this.lastFrame = this.startedAt
    if (this.mode === 'live') this.startLiveTimer()
    this.schedule()
  }

  /**
   * Read the whole view out of the query string, so a particular moment can be
   * linked to. This is also what makes a screenshot reproducible.
   *
   *   ?t=2026-12-01T13:34Z&tz=Europe/Oslo&z=2&lon=10.7&lat=59.9&play=off
   */
  private readUrl(params: URLSearchParams): void {
    const t = params.get('t')
    if (t) {
      const parsed = Date.parse(t)
      if (Number.isFinite(parsed)) this.time = parsed
    }
    const tz = params.get('tz')
    if (tz && isValidZone(tz)) this.basis = tz

    // An absent parameter means "leave this alone", not "reset it".
    this.urlSetTheView = params.has('z') || params.has('lon') || params.has('lat')
    if (this.urlSetTheView) {
      const zoom = Number(params.get('z'))
      const lon = Number(params.get('lon'))
      const lat = Number(params.get('lat'))
      this.view = {
        centerLon: Number.isFinite(lon) && params.has('lon') ? lon : this.view.centerLon,
        centerLat: Number.isFinite(lat) && params.has('lat') ? lat : this.view.centerLat,
        zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : this.view.zoom,
      }
    }

    const play = params.get('play')
    if (play === 'off') this.mode = 'paused'
    else if (play === 'live' || play === 'day' || play === 'year') {
      this.mode = play
      this.lastMotion = play
    }
    const rate = Number(params.get('rate'))
    if ([0.5, 1, 2, 4].includes(rate)) this.rate = rate

    const pin = params.get('pin')
    if (pin) {
      const [pinLat, pinLon] = pin.split(',').map(Number)
      if (Number.isFinite(pinLat) && Number.isFinite(pinLon)) this.pin(pinLon!, pinLat!)
    }

    const layers = params.get('layers')
    if (layers !== null) {
      const wanted = new Set(layers.split(',').filter(Boolean))
      for (const field of LAYER_FIELDS) this.layers[field.key] = wanted.has(field.key)
    }
  }

  /** Push the current view into the address bar without adding history entries. */
  private writeUrl(): void {
    const params = new URLSearchParams()
    params.set('t', new Date(Math.round(this.time / 1000) * 1000).toISOString().replace(/\.000Z$/, 'Z'))
    if (this.basis !== 'UTC') params.set('tz', this.basis)
    if (this.view.zoom !== 1) {
      params.set('z', this.view.zoom.toFixed(2))
      params.set('lon', this.view.centerLon.toFixed(2))
      params.set('lat', this.view.centerLat.toFixed(2))
    }
    params.set('play', this.mode === 'paused' ? 'off' : this.mode)
    if (this.rate !== 1) params.set('rate', String(this.rate))
    if (this.focus) params.set('pin', `${this.focus.lat.toFixed(3)},${this.focus.lon.toFixed(3)}`)
    const on = LAYER_FIELDS.filter((f) => this.layers[f.key]).map((f) => f.key)
    params.set('layers', on.join(','))
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`)
  }

  /**
   * Draw one frame right now.
   *
   * The renderer is deliberately idle when nothing has changed, and a headless
   * browser will not capture a page that has produced no compositor frame since
   * it went quiet, so the screenshot tooling calls this first.
   */
  redraw(): void {
    this.draw()
  }

  /**
   * Read one pixel back out of the map, in CSS pixels from the top left of the
   * stage. The end to end tests assert on the picture itself with this: that the
   * subsolar point really is the brightest thing, that the night side really is
   * dark, and that the terminator lands where the arithmetic says it should.
   */
  samplePixel(x: number, y: number): [number, number, number] {
    const gl = this.mapCanvas.getContext('webgl2')
    if (!gl) return [0, 0, 0]
    const out = new Uint8Array(4)
    gl.readPixels(
      Math.round(x * this.dpr),
      Math.round(gl.drawingBufferHeight - y * this.dpr),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      out,
    )
    return [out[0]!, out[1]!, out[2]!]
  }

  /** Where a place sits on screen right now, in CSS pixels. */
  locate(lon: number, lat: number): [number, number] {
    return project(this.size, this.view, lon, lat)
  }

  /**
   * Apply a query string worth of state without reloading, and redraw.
   * Reloading would throw away the compiled shaders, which on a software
   * renderer costs the better part of a minute.
   */
  applyState(query: string): void {
    this.readUrl(new URLSearchParams(query.replace(/^\?/, '')))
    this.view = clampView(this.size, this.view)
    this.q<HTMLSelectElement>('[data-basis]').value = this.basis
    for (const field of LAYER_FIELDS) {
      const input = this.root.querySelector<HTMLInputElement>(`#layer-${field.key}`)
      if (input) input.checked = this.layers[field.key] ?? false
    }
    this.syncTransport()
    this.repaintTracks()
    this.draw()
  }

  private q<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector)
    if (!element) throw new Error(`missing element ${selector}`)
    return element
  }

  /**
   * Open on the viewer's own city. The browser's time zone is a place name often
   * enough that matching it against the gazetteer usually lands within a few
   * kilometres, and it costs no permission prompt.
   */
  private defaultSite(): Site {
    const zone = localZone()
    const wanted = (zone.split('/').pop() ?? '').replace(/_/g, ' ').toLowerCase()
    if (wanted) {
      for (let i = 0; i < this.world.namedCount; i++) {
        const city = this.world.cities[i]!
        if (city.name.toLowerCase() === wanted) {
          return { lon: city.lon, lat: city.lat, name: city.name, country: city.country }
        }
      }
    }
    for (let i = 0; i < this.world.timezoneMeta.length; i++) {
      const meta = this.world.timezoneMeta[i]!
      if (meta.iana === zone) {
        return { lon: meta.anchor[0], lat: meta.anchor[1], name: prettyZone(zone), country: '' }
      }
    }
    return { lon: 0, lat: 51.5, name: 'Greenwich', country: 'United Kingdom' }
  }

  // ------------------------------------------------------------------ controls

  private buildBasisOptions(): void {
    const select = this.q<HTMLSelectElement>('[data-basis]')
    const zones = listZones()
    const utc = document.createElement('option')
    utc.value = 'UTC'
    utc.textContent = 'UTC'
    select.append(utc)
    const group = document.createElement('optgroup')
    group.label = 'Local time'
    for (const zone of zones) {
      if (zone === 'UTC') continue
      const option = document.createElement('option')
      option.value = zone
      option.textContent = zone.replace(/_/g, ' ')
      group.append(option)
    }
    select.append(group)
    select.value = isValidZone(this.basis) ? this.basis : 'UTC'
    select.addEventListener('change', () => {
      this.basis = select.value
      this.repaintTracks()
      this.markDirty()
    })
  }

  /** Typing an exact instant, which scrubbing cannot do. */
  private buildTimeFields(): void {
    const dateField = this.q<HTMLInputElement>('[data-date-field]')
    const timeField = this.q<HTMLInputElement>('[data-time-field]')
    const commit = () => {
      const [year, month, day] = dateField.value.split('-').map(Number)
      const [hour, minute] = timeField.value.split(':').map(Number)
      if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) return
      this.mode = 'paused'
      this.syncTransport()
      this.setTime(
        wallClockToUtc(this.basis, {
          year: year!,
          month: month!,
          day: day!,
          hour: hour!,
          minute: minute!,
          second: 0,
        }),
      )
    }
    dateField.addEventListener('change', commit)
    timeField.addEventListener('change', commit)
  }

  private syncTimeFields(reading: Reading): void {
    const dateField = this.q<HTMLInputElement>('[data-date-field]')
    const timeField = this.q<HTMLInputElement>('[data-time-field]')
    const pad = (n: number) => String(n).padStart(2, '0')
    // Never overwrite a field somebody is part way through typing into.
    if (document.activeElement !== dateField) {
      dateField.value = `${reading.year}-${pad(reading.month)}-${pad(reading.day)}`
    }
    if (document.activeElement !== timeField) {
      timeField.value = `${pad(reading.hour)}:${pad(reading.minute)}`
    }
  }

  private buildLayerControls(): void {
    const list = this.q('[data-layer-list]')
    for (const field of LAYER_FIELDS) {
      const id = `layer-${field.key}`
      const row = document.createElement('label')
      row.className = 'toggle'
      row.htmlFor = id
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = id
      input.checked = this.layers[field.key] ?? false
      input.addEventListener('change', () => {
        this.layers[field.key] = input.checked
        this.markDirty()
      })
      const text = document.createElement('span')
      text.textContent = field.label
      row.append(input, text)
      list.append(row)
    }

    const toggle = this.q<HTMLButtonElement>('[data-layers-toggle]')
    const panel = this.q('[data-layers]')
    toggle.addEventListener('click', () => {
      const open = panel.hasAttribute('hidden')
      panel.toggleAttribute('hidden', !open)
      toggle.setAttribute('aria-expanded', String(open))
    })
    document.addEventListener('pointerdown', (event) => {
      if (panel.hasAttribute('hidden')) return
      const target = event.target as Node
      if (panel.contains(target) || toggle.contains(target)) return
      panel.setAttribute('hidden', '')
      toggle.setAttribute('aria-expanded', 'false')
    })
  }

  private buildLegend(): void {
    const list = this.q('[data-legend]')
    for (const entry of LEGEND) {
      const item = document.createElement('li')
      const swatch = document.createElement('span')
      swatch.className = 'legend-swatch'
      swatch.style.background = linearRgbToHex(sampleSurfaceRamp('ocean', entry.elevation))
      const label = document.createElement('span')
      label.className = 'legend-label'
      label.textContent = entry.label
      const hint = document.createElement('span')
      hint.className = 'legend-hint numeric'
      hint.textContent = entry.hint
      item.append(swatch, label, hint)
      list.append(item)
    }
  }

  private buildTransport(): void {
    const play = this.q<HTMLButtonElement>('[data-play]')
    play.addEventListener('click', () => this.togglePlay())

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      const direction = Number(button.dataset.step)
      button.addEventListener('click', () => {
        this.mode = 'paused'
        this.setTime(this.time + direction * 3_600_000)
        this.syncTransport()
      })
    }

    const modes = this.q('[data-modes]')
    for (const [value, label, hint] of [
      ['live', 'Live', 'Follow the clock'],
      ['day', 'Day', 'Sweep 24 hours'],
      ['year', 'Year', 'Sweep 365 days'],
    ] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.mode = value
      button.textContent = label
      button.title = hint
      button.addEventListener('click', () => {
        this.mode = this.mode === value ? 'paused' : value
        // Remember what was chosen even across a pause, so play resumes it.
        this.lastMotion = value
        if (this.mode === 'live') this.setTime(Date.now())
        this.syncTransport()
        this.markDirty()
      })
      modes.append(button)
    }

    const rates = this.q('[data-rates]')
    for (const value of [0.5, 1, 2, 4]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.rate = String(value)
      button.textContent = `${value}×`
      button.addEventListener('click', () => {
        this.rate = value
        this.syncTransport()
      })
      rates.append(button)
    }

    this.q<HTMLButtonElement>('[data-now]').addEventListener('click', () => {
      this.mode = 'live'
      this.setTime(Date.now())
      this.syncTransport()
    })

    this.syncTransport()
  }

  private syncTransport(): void {
    const playing = this.mode !== 'paused'
    const play = this.q<HTMLButtonElement>('[data-play]')
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    play.classList.toggle('is-playing', playing)
    this.q('[data-play-icon]').innerHTML = playing
      ? '<rect x="3.5" y="2.5" width="3.2" height="11"/><rect x="9.3" y="2.5" width="3.2" height="11"/>'
      : '<path d="M4 2.5v11l9-5.5z"/>'
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === this.mode))
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-rate]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === this.rate))
    }
  }

  /**
   * Play resumes whatever was playing before the pause. Somebody who paused a
   * day sweep asked for the day sweep back, not for the live clock.
   */
  private togglePlay(): void {
    this.mode = this.mode === 'paused' ? this.lastMotion : 'paused'
    if (this.mode === 'live') this.setTime(Date.now())
    this.syncTransport()
    if (this.mode === 'live') this.startLiveTimer()
    this.markDirty()
  }

  // ------------------------------------------------------------------ scrubbers

  private buildScrubbers(): void {
    const host = this.q('[data-scrubbers]')

    this.dayScrubber = new Scrubber({
      label: 'Time of day',
      min: 0,
      max: 1440,
      step: 1,
      pageStep: 60,
      height: 26,
      describe: (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`,
      onChange: (minutes) => {
        this.mode = 'paused'
        this.syncTransport()
        const reading = readingIn(this.basis, this.time)
        this.setTime(
          wallClockToUtc(this.basis, {
            year: reading.year,
            month: reading.month,
            day: reading.day,
            hour: Math.floor(minutes / 60),
            minute: Math.floor(minutes % 60),
            second: 0,
          }),
        )
      },
      paint: (ctx, width, height) => this.paintDayTrack(ctx, width, height),
      ticks: () => this.dayTicks(),
    })

    this.yearScrubber = new Scrubber({
      label: 'Day of year',
      min: 0,
      max: 365,
      step: 1,
      pageStep: 30,
      height: 22,
      describe: (v) => formatDate(readingIn(this.basis, this.timeForDayOfYear(v))),
      onChange: (day) => {
        this.mode = 'paused'
        this.syncTransport()
        this.setTime(this.timeForDayOfYear(day))
      },
      paint: (ctx, width, height) => this.paintYearTrack(ctx, width, height),
      ticks: () => this.yearTicks(),
    })

    this.dayScrubber.element.classList.add('scrubber-day')
    this.yearScrubber.element.classList.add('scrubber-year')

    const months = document.createElement('div')
    months.className = 'month-scale'
    for (const name of ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']) {
      const span = document.createElement('span')
      span.textContent = name
      months.append(span)
    }

    host.append(this.dayScrubber.element, this.yearScrubber.element, months)
  }

  /** The instant at the same wall clock, on the given day of the current year. */
  private timeForDayOfYear(day: number): number {
    const reading = readingIn(this.basis, this.time)
    const start = Date.UTC(reading.year, 0, 1)
    const target = new Date(start + Math.round(day) * MS_PER_DAY)
    return wallClockToUtc(this.basis, {
      year: target.getUTCFullYear(),
      month: target.getUTCMonth() + 1,
      day: target.getUTCDate(),
      hour: reading.hour,
      minute: reading.minute,
      second: reading.second,
    })
  }

  private referenceSite(): Site {
    return this.focus ?? { lon: 0, lat: 0, name: 'Null Island', country: '' }
  }

  /**
   * Fill a track with the sky colour at the reference place, one column per
   * pixel. The land ramp is used because the reference is a place, and a place
   * is on land.
   */
  private paintStrip(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    instantAt: (t: number) => number,
  ): void {
    const site = this.referenceSite()
    for (let x = 0; x < width; x++) {
      const instant = instantAt((x + 0.5) / width)
      const state = solarState(instant)
      const elevation = localSolar(site.lat, site.lon, state).elevation
      ctx.fillStyle = linearRgbToHex(sampleSurfaceRamp('land', elevation))
      ctx.fillRect(x, 0, 1, height)
    }
  }

  private paintDayTrack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const reading = readingIn(this.basis, this.time)
    const midnight = wallClockToUtc(this.basis, { ...reading, hour: 0, minute: 0, second: 0 })
    this.paintStrip(ctx, width, height, (t) => midnight + t * MS_PER_DAY)
  }

  /**
   * The UTC offset of the basis zone on each day of the year, sampled at midday
   * so it never lands inside a transition. Precomputed because the year track is
   * a few hundred columns wide and Intl is far too slow to call per column.
   */
  private yearOffsets(year: number): Float64Array {
    const key = `${year}|${this.basis}`
    if (this.offsetCache?.key === key) return this.offsetCache.minutes
    const minutes = new Float64Array(366)
    const start = Date.UTC(year, 0, 1)
    for (let day = 0; day < 366; day++) {
      minutes[day] = zoneOffsetMinutes(this.basis, start + day * MS_PER_DAY + 12 * 3_600_000)
    }
    this.offsetCache = { key, minutes }
    return minutes
  }

  private paintYearTrack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const reading = readingIn(this.basis, this.time)
    const start = Date.UTC(reading.year, 0, 1)
    const offsets = this.yearOffsets(reading.year)
    const wallMinutes = reading.hour * 60 + reading.minute
    this.paintStrip(ctx, width, height, (t) => {
      const day = Math.min(365, Math.floor(t * 365))
      return start + day * MS_PER_DAY + (wallMinutes - (offsets[day] ?? 0)) * MS_PER_MINUTE
    })
  }

  private dayTicks() {
    const site = this.referenceSite()
    const events = dayEvents(site.lat, site.lon, this.time)
    const reading = readingIn(this.basis, this.time)
    const midnight = wallClockToUtc(this.basis, { ...reading, hour: 0, minute: 0, second: 0 })
    const ticks = []
    for (let hour = 0; hour <= 24; hour += 3) ticks.push({ at: hour * 60, weight: 0.3 })
    for (const instant of [events.sunrise, events.sunset]) {
      if (instant === null) continue
      ticks.push({ at: (instant - midnight) / MS_PER_MINUTE, weight: 1 })
    }
    return ticks
  }

  private yearTicks() {
    const reading = readingIn(this.basis, this.time)
    const start = Date.UTC(reading.year, 0, 1)
    const ticks = []
    for (let month = 1; month < 12; month++) {
      ticks.push({ at: (Date.UTC(reading.year, month, 1) - start) / MS_PER_DAY, weight: 0.3 })
    }
    // The solstices and equinoxes are the shape of the whole year track.
    for (const [month, day] of [[2, 20], [5, 21], [8, 22], [11, 21]] as const) {
      ticks.push({ at: (Date.UTC(reading.year, month, day) - start) / MS_PER_DAY, weight: 1 })
    }
    return ticks
  }

  private repaintTracks(): void {
    this.dayScrubber.repaint()
    this.yearScrubber.repaint()
  }

  // ------------------------------------------------------------------ sheet

  /**
   * On a phone the console is a bottom sheet over the map, the way every native
   * map application arranges itself. Collapsed it shows the clock, the play
   * control and the day scrubber; pulled up it reveals the rest. The sheet is
   * moved with a transform so the map behind it never has to relayout.
   */
  private buildSheet(): void {
    const sheet = this.q<HTMLElement>('[data-console]')
    this.sheetEl = sheet

    this.sheetMedia = window.matchMedia(SHEET_MEDIA)
    this.sheetMedia.addEventListener('change', () => this.syncSheet())
    new ResizeObserver(() => this.syncSheet()).observe(sheet)

    // The whole sheet is the handle: a drag starting anywhere that is not a
    // control follows the finger, the way a native sheet behaves. A short
    // movement on the grip or the clock counts as a tap and toggles.
    let startY = 0
    let startShift = 0
    let moved = 0
    let lastY = 0
    let lastAt = 0
    let velocity = 0
    let dragging = false
    // Pointer capture retargets every later event to the sheet itself, so the
    // element the finger actually landed on has to be remembered from the start.
    let downTarget: Element | null = null

    const isControl = (target: EventTarget | null) =>
      target instanceof Element &&
      target.closest('button:not([data-sheet-toggle]), select, input, a, .scrubber-surface') !== null

    sheet.addEventListener('pointerdown', (event) => {
      if (!this.sheetMedia.matches || isControl(event.target)) return
      // When the sheet's own content is scrolled, a downward swipe means
      // "scroll back up", not "close the sheet".
      if (sheet.scrollTop > 1) return
      dragging = true
      moved = 0
      startY = lastY = event.clientY
      lastAt = performance.now()
      velocity = 0
      startShift = this.sheetOpen ? 0 : this.sheetClosedShift
      downTarget = event.target instanceof Element ? event.target : null
      sheet.setPointerCapture(event.pointerId)
    })
    sheet.addEventListener('pointermove', (event) => {
      if (!dragging) return
      const now = performance.now()
      const dy = event.clientY - lastY
      if (now > lastAt) velocity = dy / (now - lastAt)
      lastY = event.clientY
      lastAt = now
      moved = Math.max(moved, Math.abs(event.clientY - startY))
      if (moved > 4) sheet.classList.add('is-dragging')
      const shift = Math.min(this.sheetClosedShift, Math.max(0, startShift + event.clientY - startY))
      sheet.style.setProperty('--sheet-shift', `${shift}px`)
    })
    const settle = (event: PointerEvent) => {
      if (!dragging) return
      dragging = false
      sheet.classList.remove('is-dragging')
      if (sheet.hasPointerCapture(event.pointerId)) sheet.releasePointerCapture(event.pointerId)
      if (moved < 6) {
        // A plain tap toggles only on the parts that read as a handle.
        const onHandle =
          downTarget !== null &&
          (downTarget.closest('[data-sheet-toggle]') !== null || downTarget.closest('.clock') !== null)
        if (onHandle) this.setSheet(!this.sheetOpen)
        else this.syncSheet()
        return
      }
      const shift = startShift + lastY - startY
      // A flick goes the way it was thrown; a slow drag settles to the nearer stop.
      const open = Math.abs(velocity) > 0.4 ? velocity < 0 : shift < this.sheetClosedShift / 2
      this.setSheet(open)
    }
    sheet.addEventListener('pointerup', settle)
    sheet.addEventListener('pointercancel', settle)

    // iOS will otherwise cancel the pointer stream the moment it decides the
    // finger is a scroll. While a drag is live, the touches belong to the sheet.
    sheet.addEventListener(
      'touchmove',
      (event) => {
        if (dragging) event.preventDefault()
      },
      { passive: false },
    )

    // Touching the map puts the map first: the sheet folds back down.
    this.overlayCanvas.addEventListener('pointerdown', () => {
      if (this.sheetOpen && this.sheetMedia.matches) this.setSheet(false)
    })

    this.q<HTMLButtonElement>('[data-recenter]').addEventListener('click', () => this.recenter())
  }

  private setSheet(open: boolean): void {
    this.sheetOpen = open
    this.q('[data-sheet-toggle]').setAttribute('aria-expanded', String(open))
    this.q('[data-sheet-toggle]').setAttribute('aria-label', open ? 'Show less detail' : 'Show more detail')
    document.body.classList.toggle('sheet-open', open)
    this.syncSheet()
  }

  /**
   * Measure how far down the sheet rests when closed: everything below the day
   * scrubber slides off the bottom of the screen. Distances inside the sheet do
   * not change under a translate, so measuring while shifted is safe.
   */
  private syncSheet(): void {
    const sheet = this.sheetEl
    if (!sheet) return
    if (!this.sheetMedia.matches) {
      sheet.style.removeProperty('--sheet-shift')
      document.documentElement.style.removeProperty('--sheet-peek')
      return
    }
    const top = sheet.getBoundingClientRect().top
    const dayBottom = this.dayScrubber.element.getBoundingClientRect().bottom
    const padBottom = Number.parseFloat(getComputedStyle(sheet).paddingBottom) || 0
    this.sheetClosedShift = Math.max(0, sheet.offsetHeight - (dayBottom - top) - padBottom)
    sheet.style.setProperty('--sheet-shift', `${this.sheetOpen ? 0 : this.sheetClosedShift}px`)
    const peek = sheet.offsetHeight - this.sheetClosedShift
    document.documentElement.style.setProperty('--sheet-peek', `${Math.round(peek)}px`)
    // The sheet arrives already folded; only movements after that first
    // placement are animated, so opening the page never plays a slide.
    if (!sheet.classList.contains('sheet-ready')) {
      requestAnimationFrame(() => sheet.classList.add('sheet-ready'))
    }
  }

  /** Back to the opening view: the pinned place, framed the way a phone opens. */
  private recenter(): void {
    const site = this.referenceSite()
    this.view = clampView(this.size, { centerLon: site.lon, centerLat: site.lat, zoom: this.fillZoom() })
    this.markDirty()
  }

  /**
   * The satellite imagery, decoded off the critical path. The first frame draws
   * from the spectral ramp alone; the land arrives the moment it is ready.
   */
  private loadTerrain(): void {
    const fetchImage = (url: string) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      return image.decode().then(() => image)
    }
    Promise.all([fetchImage(terrainUrl), fetchImage(terrainSeasonUrl)])
      .then(([albedo, season]) => {
        this.renderer.setTerrain(albedo, season)
        this.markDirty()
      })
      .catch(() => undefined)
  }

  /**
   * The page is an instrument, not a document: the browser's own pinch zoom and
   * double tap zoom would fight the map's. The viewport meta asks politely;
   * Safari on iOS ignores it and needs the gesture events cancelled too.
   */
  private lockPageGestures(): void {
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, (event) => event.preventDefault())
    }
  }

  // ------------------------------------------------------------------ input

  private bindPointer(): void {
    const target = this.overlayCanvas
    const active = new Map<number, { x: number; y: number }>()
    let travelled = 0
    let startPoint = { x: 0, y: 0 }
    let lastTapAt = 0

    const local = (event: { clientX: number; clientY: number }) => {
      const rect = target.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    /** Midpoint and separation of the two active pointers. */
    const pinch = () => {
      const [a, b] = [...active.values()]
      if (!a || !b) return null
      return {
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      }
    }
    let lastPinch: ReturnType<typeof pinch> = null

    target.addEventListener('pointerdown', (event) => {
      target.setPointerCapture(event.pointerId)
      const start = local(event)
      active.set(event.pointerId, start)
      startPoint = start
      travelled = 0
      lastPinch = active.size === 2 ? pinch() : null
      if (event.pointerType === 'touch') this.hover = null
    })

    target.addEventListener('pointermove', (event) => {
      const point = local(event)
      const previous = active.get(event.pointerId)

      if (previous && active.size === 2) {
        // Two fingers: scale about the midpoint and pan with it, both taken as
        // deltas so the gesture stays stable however the fingers move.
        active.set(event.pointerId, point)
        const next = pinch()
        if (lastPinch && next && lastPinch.distance > 8) {
          this.view = panBy(
            this.size,
            this.view,
            next.centre.x - lastPinch.centre.x,
            next.centre.y - lastPinch.centre.y,
          )
          this.view = zoomAt(
            this.size,
            this.view,
            next.centre.x,
            next.centre.y,
            next.distance / lastPinch.distance,
          )
          this.markDirty()
        }
        lastPinch = next
        return
      }

      if (previous) {
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        travelled += Math.abs(dx) + Math.abs(dy)
        active.set(event.pointerId, point)
        this.view = panBy(this.size, this.view, dx, dy)
        target.style.cursor = 'grabbing'
      }

      // A finger is a pointer, not a hover. Following it with a crosshair just
      // draws under the hand; on touch the readout follows the pin instead.
      if (event.pointerType !== 'touch') {
        const [lon, lat] = unproject(this.size, this.view, point.x, point.y)
        this.hover = Math.abs(lat) <= 90 ? { lon: wrapLongitude(lon), lat } : null
      }
      this.markDirty()
    })

    const release = (event: PointerEvent) => {
      const point = local(event)
      const wasDragging = active.has(event.pointerId)
      active.delete(event.pointerId)
      lastPinch = active.size === 2 ? pinch() : null
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
      target.style.cursor = ''
      if (!wasDragging || active.size > 0) return

      // A tap is judged by how far the finger ended from where it started, not
      // by how far it wandered getting there. Summing every small movement
      // along the way punishes a slow finger, and a finger always rolls a
      // little: the old accumulation crossed six pixels on contact alone, so
      // taps were being read as drags and the pin never moved.
      const displacement = Math.hypot(point.x - startPoint.x, point.y - startPoint.y)
      const slop = event.pointerType === 'touch' ? 12 : 4
      if (displacement <= slop && travelled < 90) {
        const [lon, lat] = unproject(this.size, this.view, point.x, point.y)
        if (Math.abs(lat) <= 90) {
          // A second tap in the same spot zooms, the way every map does.
          const now = performance.now()
          if (event.pointerType === 'touch' && now - lastTapAt < 320) {
            this.view = zoomAt(this.size, this.view, point.x, point.y, 1.8)
            lastTapAt = 0
          } else {
            lastTapAt = now
            this.pin(wrapLongitude(lon), lat)
          }
          this.markDirty()
        }
      }
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)
    target.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return
      this.hover = null
      this.markDirty()
    })

    target.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        const point = local(event)
        this.view = zoomAt(this.size, this.view, point.x, point.y, Math.exp(-event.deltaY * 0.0016))
        this.markDirty()
      },
      { passive: false },
    )

    target.addEventListener('dblclick', (event) => {
      const point = local(event)
      this.view = zoomAt(this.size, this.view, point.x, point.y, 1.8)
      this.markDirty()
    })
  }

  private pin(lon: number, lat: number): void {
    const city = this.places.nearest(lon, lat, 3)
    this.focus = city
      ? { lon: city.lon, lat: city.lat, name: city.name, country: city.country }
      : { lon, lat, name: '', country: '' }
    if (this.dayScrubber) this.repaintTracks()
    this.markDirty()
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      switch (event.key) {
        case ' ':
          event.preventDefault()
          this.togglePlay()
          break
        case 'ArrowLeft':
        case 'ArrowRight': {
          if ((event.target as HTMLElement | null)?.closest('.scrubber')) return
          event.preventDefault()
          const sign = event.key === 'ArrowRight' ? 1 : -1
          const span = event.shiftKey ? MS_PER_DAY : 3_600_000
          this.mode = 'paused'
          this.syncTransport()
          this.setTime(this.time + sign * span)
          break
        }
        case '+':
        case '=':
          this.view = zoomAt(this.size, this.view, this.size.width / 2, this.size.height / 2, 1.3)
          this.markDirty()
          break
        case '-':
        case '_':
          this.view = zoomAt(this.size, this.view, this.size.width / 2, this.size.height / 2, 1 / 1.3)
          this.markDirty()
          break
        case '0':
          this.view = clampView(this.size, { centerLon: 0, centerLat: 0, zoom: 1 })
          this.markDirty()
          break
        case 'l':
        case 'L':
          this.q<HTMLButtonElement>('[data-layers-toggle]').click()
          break
        case 'a':
        case 'A':
          this.q<HTMLButtonElement>('[data-almanac-toggle]').click()
          break
        case 'Escape':
          if (!this.almanac.hidden) this.setAlmanac(false)
          this.q('[data-layers]').setAttribute('hidden', '')
          this.q('[data-layers-toggle]').setAttribute('aria-expanded', 'false')
          break
        case '/':
          event.preventDefault()
          this.q<HTMLButtonElement>('[data-search-toggle]').click()
          break
        default:
          break
      }
    })
  }

  // ------------------------------------------------------------------ frame

  private markDirty(): void {
    this.dirty = true
    this.schedule()
    this.queueUrl()
  }

  /**
   * Keep the address bar in step, coalesced so a running animation writes a few
   * times a second rather than sixty. Deliberately not tied to the render loop:
   * a write skipped for being too soon after the last one would otherwise never
   * happen at all, because there may be no further frame to carry it.
   */
  private queueUrl(): void {
    if (this.urlTimer !== 0) return
    this.urlTimer = window.setTimeout(() => {
      this.urlTimer = 0
      this.writeUrl()
    }, 400)
  }

  private setTime(ms: number): void {
    this.time = ms
    this.markDirty()
  }

  private resize(): void {
    const rect = this.stage.getBoundingClientRect()
    this.size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
    this.dpr = this.pixelRatio()
    this.mapCanvas.style.width = `${this.size.width}px`
    this.mapCanvas.style.height = `${this.size.height}px`
    this.overlayCanvas.style.width = `${this.size.width}px`
    this.overlayCanvas.style.height = `${this.size.height}px`
    this.renderer.resize(this.size.width * this.dpr, this.size.height * this.dpr)
    this.overlay.resize(this.size.width, this.size.height, this.dpr)
    this.fitToShape()
    this.view = clampView(this.size, this.view)
    if (this.dayScrubber) {
      this.dayScrubber.resize(this.dpr)
      this.yearScrubber.resize(this.dpr)
    }
    this.syncSheet()
    this.markDirty()
  }

  /**
   * How many device pixels to draw per CSS pixel.
   *
   * A phone is a three times display, and drawing it at two and letting the
   * browser scale up is exactly what makes a hairline coastline read as a fuzzy
   * band and the terrain read as mush. So the ratio is honoured up to three,
   * bounded by a total pixel budget rather than a flat cap: a phone is a small
   * viewport and can afford every pixel it has, while a large retina desktop
   * would be asking for four times the fill for the same picture.
   */
  private pixelRatio(): number {
    const requested = window.devicePixelRatio || 1
    const area = Math.max(1, this.size.width * this.size.height)
    const BUDGET = 6_500_000
    return Math.max(1, Math.min(requested, 3, Math.sqrt(BUDGET / area)))
  }

  /**
   * On a tall, narrow screen the whole world at once is a thin strip with more
   * surround than map. Open zoomed in on the viewer's own place instead, unless
   * the link being opened already said where to look.
   */
  private fitToShape(): void {
    if (this.fittedToShape || this.urlSetTheView || this.size.width < 2) return
    this.fittedToShape = true
    const plateHeight = worldHeight(this.size, this.view)
    if (plateHeight >= this.size.height * 0.62) return
    const site = this.referenceSite()
    this.view = clampView(this.size, { centerLon: site.lon, centerLat: site.lat, zoom: this.fillZoom() })
  }

  /**
   * The zoom at which the plate covers the viewport top to bottom, so a tall
   * screen opens onto a full bleed map rather than a letterboxed strip.
   */
  private fillZoom(): number {
    return Math.max(1, Math.min(6, (this.size.height * 1.002) / (fitWidth(this.size) / 2)))
  }

  private sheetEl: HTMLElement | null = null
  private sheetMedia!: MediaQueryList
  private sheetOpen = false
  private sheetClosedShift = 0
  private yearAccumulator = 0
  private urlTimer = 0
  private urlSetTheView = false
  private fittedToShape = false
  private offsetCache: { key: string; minutes: Float64Array } | null = null
  private trackKeys = { day: '', year: '' }
  private lastYearRepaint = 0
  private frameHandle = 0
  private fallbackTimer = 0
  private liveTimer = 0

  private advance(deltaMs: number): void {
    switch (this.mode) {
      case 'day':
        this.setTime(this.time + deltaMs * (MS_PER_DAY / DAY_SWEEP) * this.rate)
        break
      case 'year': {
        this.yearAccumulator += deltaMs * (365 / YEAR_SWEEP) * this.rate
        const whole = Math.trunc(this.yearAccumulator)
        if (whole !== 0) {
          this.yearAccumulator -= whole
          const reading = readingIn(this.basis, this.time)
          const shifted = new Date(Date.UTC(reading.year, reading.month - 1, reading.day) + whole * MS_PER_DAY)
          this.setTime(
            wallClockToUtc(this.basis, {
              year: shifted.getUTCFullYear(),
              month: shifted.getUTCMonth() + 1,
              day: shifted.getUTCDate(),
              hour: reading.hour,
              minute: reading.minute,
              second: reading.second,
            }),
          )
        }
        break
      }
      case 'paused':
      default:
        break
    }
  }

  /**
   * Draw on demand rather than on a permanent animation frame loop. When the
   * clock is stopped and nothing has changed there is nothing to draw, so the
   * page uses no CPU at all, and no frame request is left pending.
   */
  private schedule(): void {
    if (this.frameHandle !== 0 || this.fallbackTimer !== 0) return
    this.frameHandle = requestAnimationFrame(this.tick)
    // A browser that decides the page has nothing new to show can stop issuing
    // animation frames altogether. Without a fallback the pending request would
    // never resolve, every later request would be suppressed as a duplicate,
    // and the instrument would quietly stop responding to input.
    this.fallbackTimer = window.setTimeout(() => this.tick(performance.now()), 250)
  }

  /** Live mode only needs a frame often enough for the seconds to look right. */
  private startLiveTimer(): void {
    if (this.liveTimer !== 0) return
    this.liveTimer = window.setInterval(() => {
      if (this.mode !== 'live') {
        window.clearInterval(this.liveTimer)
        this.liveTimer = 0
        return
      }
      this.setTime(Date.now())
    }, 250)
  }

  private readonly tick = (now: number) => {
    if (this.frameHandle !== 0) {
      cancelAnimationFrame(this.frameHandle)
      this.frameHandle = 0
    }
    if (this.fallbackTimer !== 0) {
      window.clearTimeout(this.fallbackTimer)
      this.fallbackTimer = 0
    }
    // Cap the step so returning from a background tab does not jump the map a
    // week forward, but leave enough room that a slow machine still animates.
    const delta = Math.min(250, now - this.lastFrame)
    this.lastFrame = now

    if (this.mode === 'day' || this.mode === 'year') this.advance(delta)
    if (this.mode === 'live') this.startLiveTimer()

    const target = this.reducedMotion ? 1 : Math.min(1, (now - this.startedAt) / 700)
    if (target !== this.reveal) {
      this.reveal = target
      this.dirty = true
    }

    if (this.dirty) {
      this.draw()
      this.dirty = false
    }

    if (this.reveal < 1 || this.mode === 'day' || this.mode === 'year') this.schedule()
  }

  private draw(): void {
    const sun = solarState(this.time)
    const mapLayers: Layers = {
      coast: this.layers.coast ?? true,
      borders: this.layers.borders ?? false,
      cities: this.layers.cities ?? true,
      lakes: this.layers.lakes ?? true,
    }
    const moon = this.moonNow()
    const frame: Frame = {
      view: this.view,
      size: this.size,
      sun,
      moon:
        this.layers.moon && moon.gain > 0
          ? { lon: moon.state.sublunarLon, lat: moon.state.sublunarLat, gain: moon.gain }
          : null,
      localTime: this.layers.localTime ? this.localTimeFrame() : null,
      eclipse: this.eclipseFrame(),
      layers: mapLayers,
      time: 0,
      tuning: this.tuning,
    }
    this.renderer.render(frame)

    const overlayLayers: OverlayLayers = {
      graticule: this.layers.graticule ?? true,
      boundaries: this.layers.boundaries ?? true,
      // Matching clocks are shown on the zones, so asking for the match is
      // asking for the zones: without this the toggle would do nothing alone.
      timezones: (this.layers.timezones || this.layers.matchClock) ?? false,
      places: this.layers.places ?? true,
      analemma: this.layers.analemma ?? false,
    }

    this.overlay.draw({
      view: this.view,
      size: this.size,
      sun,
      world: this.world,
      layers: overlayLayers,
      zoneLabels: overlayLayers.timezones ? this.buildZoneLabels() : [],
      placeLabels: overlayLayers.places ? this.buildPlaceLabels() : [],
      highlightZones: this.layers.matchClock ? this.matchingZones() : new Set<number>(),
      analemma: overlayLayers.analemma ? this.buildAnalemma() : null,
      moon: this.layers.moon
        ? {
            lon: moon.state.sublunarLon,
            lat: moon.state.sublunarLat,
            illumination: moon.phase.illumination,
            waxing: moon.phase.waxing,
          }
        : null,
      localTime: this.layers.localTime ?? false,
      hover: this.hover,
      pinned: this.focus ? { lon: this.focus.lon, lat: this.focus.lat, label: this.focus.name } : null,
      reveal: this.reveal,
    })

    this.updateReadouts(sun)
    this.syncScrubbers()
  }

  /**
   * Put the handles where the clock is, and redraw a track only when the data
   * behind it has actually moved.
   */
  private syncScrubbers(): void {
    const reading = readingIn(this.basis, this.time)
    this.dayScrubber.setValue(reading.hour * 60 + reading.minute + reading.second / 60)
    const start = Date.UTC(reading.year, 0, 1)
    const dayOfYear = (Date.UTC(reading.year, reading.month - 1, reading.day) - start) / MS_PER_DAY
    this.yearScrubber.setValue(dayOfYear)

    const site = this.referenceSite()
    const place = `${site.lat.toFixed(3)},${site.lon.toFixed(3)},${this.basis}`
    const dayKey = `${reading.year}-${reading.month}-${reading.day}|${place}`
    if (dayKey !== this.trackKeys.day) {
      this.trackKeys.day = dayKey
      this.dayScrubber.repaint()
    }
    const yearKey = `${reading.year}|${reading.hour}:${reading.minute}|${place}`
    const now = performance.now()
    if (yearKey !== this.trackKeys.year && now - this.lastYearRepaint > 200) {
      this.trackKeys.year = yearKey
      this.lastYearRepaint = now
      this.yearScrubber.repaint()
    }
  }

  // ------------------------------------------------------------------ readouts

  private updateReadouts(sun: SolarState): void {
    const reading = readingIn(this.basis, this.time)
    this.q('[data-date]').textContent = `${formatWeekday(reading)} ${formatDate(reading)}`
    this.q('[data-time]').textContent = formatClock(reading)
    this.syncTimeFields(reading)
    const summary = zoneSummary(this.basis, this.time)
    this.q('[data-zone]').textContent =
      this.basis === 'UTC'
        ? 'Coordinated Universal Time'
        : `${prettyZone(this.basis)} · ${summary.abbreviation} · ${summary.offset}`

    this.q('[data-subsolar]').textContent =
      `${formatLatitude(sun.subsolarLat)}  ${formatLongitude(sun.subsolarLon)}`

    this.q('[data-daylit]').textContent = `${(this.daylitFraction(sun) * 100).toFixed(1)}%`

    const season = this.nextSeason()
    this.q('[data-season-label]').textContent = season.label
    const away = season.instant - this.time
    const days = Math.floor(away / MS_PER_DAY)
    const hours = Math.floor((away - days * MS_PER_DAY) / MS_PER_HOUR)
    this.q('[data-season]').textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h`

    // The readout follows the pointer, and falls back to the pinned place when
    // the pointer is off the map.
    const pinned = this.hover === null ? this.focus : null
    const site = this.hover ?? this.focus
    if (!site) return
    const local = localSolar(site.lat, site.lon, sun)
    const events = dayEvents(site.lat, site.lon, this.time)
    const hit = this.zones.at(site.lon, site.lat)
    const zone = hit?.iana ?? 'UTC'
    const city = this.places.nearest(site.lon, site.lat, 3)

    const name = pinned?.name || city?.name || ''
    const country = pinned?.country || city?.country || ''
    this.q('[data-place-name]').textContent = name ? (country ? `${name}, ${country}` : name) : 'Open water'
    this.q('[data-place-coords]').textContent = `${formatLatitude(site.lat)}   ${formatLongitude(site.lon)}`
    this.q('[data-place-label]').textContent = this.hover ? 'Under the pointer' : 'Pinned'

    const zoneReading = readingIn(zone, this.time)
    const zoneInfo = zoneSummary(zone, this.time)
    this.q('[data-place-clock]').textContent = hit?.iana
      ? `${formatClock(zoneReading, false)} ${zoneInfo.abbreviation}`
      : `${formatClock(readingIn('UTC', this.time + (hit?.standardOffsetMinutes ?? 0) * MS_PER_MINUTE), false)} (nominal)`
    this.q('[data-place-sun]').textContent = `${formatElevation(local.elevation)} · ${formatAzimuth(local.azimuth)}`
    this.q('[data-place-rise]').textContent =
      events.polar === 'day' ? 'no sunset' : events.polar === 'night' ? 'no sunrise' : formatEventTime(zone, events.sunrise)
    this.q('[data-place-set]').textContent =
      events.polar ? '—' : formatEventTime(zone, events.sunset)
    this.q('[data-place-daylight]').textContent = formatDuration(events.dayLength)

    if (this.focus) {
      this.almanac.update(
        { ...this.focus, zone: this.zones.at(this.focus.lon, this.focus.lat)?.iana ?? 'UTC' },
        this.time,
        this.dpr,
      )
    }
    this.syncSavedPlaces()
  }

  private zoneClock(index: number): { text: string; sub: string } | null {
    const meta = this.world.timezoneMeta[index]
    if (!meta) return null
    const minute = Math.floor(this.time / MS_PER_MINUTE)
    const key = meta.iana ?? `offset:${meta.offset}`
    const cached = this.zoneClockCache.get(key)
    let text: string
    if (cached && cached.minute === minute) {
      text = cached.text
    } else {
      const reading = meta.iana
        ? readingIn(meta.iana, this.time)
        : readingIn('UTC', this.time + meta.offset * 3_600_000)
      text = formatClock(reading, false)
      this.zoneClockCache.set(key, { minute, text })
    }
    const hours = Math.trunc(meta.offset)
    const minutes = Math.abs(Math.round((meta.offset - hours) * 60))
    const sign = meta.offset < 0 ? '−' : '+'
    const sub = minutes === 0 ? `${sign}${Math.abs(hours)}` : `${sign}${Math.abs(hours)}:${String(minutes).padStart(2, '0')}`
    return { text, sub }
  }

  private buildZoneLabels(): ZoneLabel[] {
    const highlighted = this.layers.matchClock ? this.matchingZones() : new Set<number>()
    const pixelsPerDegree = worldWidth(this.size, this.view) / 360
    const labels: ZoneLabel[] = []
    for (let i = 0; i < this.world.timezoneMeta.length; i++) {
      const meta = this.world.timezoneMeta[i]!
      // A clock needs about fifty pixels of zone to sit in without lying about
      // which zone it belongs to.
      if ((meta.bbox[2] - meta.bbox[0]) * pixelsPerDegree < 52) continue
      if (meta.area < 4) continue
      const clock = this.zoneClock(i)
      if (!clock) continue
      labels.push({
        lon: meta.anchor[0],
        lat: meta.anchor[1],
        text: clock.text,
        sub: clock.sub,
        area: meta.area,
        highlighted: highlighted.has(i),
      })
    }
    return labels
  }

  /** Zones whose wall clock reads the same as the chosen basis right now. */
  private matchingZones(): Set<number> {
    const target = readingIn(this.basis, this.time)
    const matches = new Set<number>()
    for (let i = 0; i < this.world.timezoneMeta.length; i++) {
      const meta = this.world.timezoneMeta[i]!
      const reading = meta.iana
        ? readingIn(meta.iana, this.time)
        : readingIn('UTC', this.time + meta.offset * 3_600_000)
      if (reading.hour === target.hour && reading.minute === target.minute) matches.add(i)
    }
    return matches
  }

  /**
   * The biggest places that are actually on screen. Ranking globally and then
   * clipping would show only world capitals wherever you zoomed; ranking within
   * the view means zooming into a region surfaces that region's cities.
   */
  private buildPlaceLabels(): PlaceLabel[] {
    const [left, top] = unproject(this.size, this.view, 0, 0)
    const [, bottom] = unproject(this.size, this.view, 0, this.size.height)
    const span = (this.size.width / worldWidth(this.size, this.view)) * 360
    const wholeWorld = span >= 359
    const lonMin = wrapLongitude(left)
    const lonMax = wrapLongitude(left + span)
    const budget = Math.round(Math.min(64, 22 + this.size.width / 26))

    const visible = (lon: number, lat: number) => {
      if (lat > top || lat < bottom) return false
      if (wholeWorld) return true
      return lonMin <= lonMax ? lon >= lonMin && lon <= lonMax : lon >= lonMin || lon <= lonMax
    }

    const labels: PlaceLabel[] = []
    for (let i = 0; i < this.world.namedCount && labels.length < budget; i++) {
      const city = this.world.cities[i]!
      if (!visible(city.lon, city.lat)) continue
      labels.push({ lon: city.lon, lat: city.lat, text: city.name, rank: city.population, capital: city.capital })
    }
    return labels
  }

  /**
   * The analemma for the exact instant on screen, not for the top of the hour.
   *
   * The figure is where the Sun stands at the *same clock time* each day, so it
   * is anchored to a time of day and the subsolar point must sit on it. Taken
   * at a whole hour, it drifts a quarter of a degree for every minute past the
   * hour, which puts the marker up to seven and a half degrees off the curve it
   * is supposed to be riding. The hour is therefore fractional, quantised to a
   * second so that an animation does not rebuild the curve for changes far
   * below a pixel.
   */
  // ----------------------------------------------------------------- eclipse

  /**
   * The shadow, when there is one. Checked every frame because it costs two
   * positions the map has already computed, and skipped in the shader whenever
   * the Sun and Moon are more than a couple of degrees apart, which is all but
   * a few hours a year.
   */
  private eclipseFrame(): Frame['eclipse'] {
    const shadow = shadowUniforms(this.time)
    if (!shadow.possible) return null
    const thousand = (v: readonly [number, number, number]) =>
      [v[0] / 1000, v[1] / 1000, v[2] / 1000] as const
    return { sun: thousand(shadow.sun), moon: thousand(shadow.moon), gmst: shadow.siderealDegrees }
  }

  // --------------------------------------------------------------- local time

  /**
   * What the renderer needs to draw every zone at the same local reading.
   *
   * The offsets themselves are rasterised by the renderer and only need
   * rebuilding when they change, which is at a daylight saving transition; the
   * key below is deliberately coarse, one entry per day, because that is how
   * often the answer can differ.
   */
  private localTimeFrame(): { referenceOffsetHours: number; declinationRatePerHour: number } {
    const day = Math.floor(this.time / MS_PER_DAY)
    if (this.zoneOffsetDay !== day) {
      this.zoneOffsetDay = day
      const offsets = new Float64Array(this.world.timezoneMeta.length)
      for (let i = 0; i < offsets.length; i++) {
        const meta = this.world.timezoneMeta[i]!
        // A real zone knows its own daylight saving; the handful that Natural
        // Earth could not match to IANA fall back to their nominal offset.
        offsets[i] = meta.iana ? zoneOffsetMinutes(meta.iana, this.time) / 60 : meta.offset
      }
      this.renderer.setZoneOffsets(offsets)
    }

    // The declination drifts by up to a quarter of a degree across the fourteen
    // hours that separate the extreme zones, so it is measured rather than held.
    const rate = (solarState(this.time + MS_PER_HOUR).declination - solarState(this.time).declination) / 1
    return {
      referenceOffsetHours: zoneOffsetMinutes(this.basis, this.time) / 60,
      declinationRatePerHour: rate,
    }
  }

  // ------------------------------------------------------------------ search

  /**
   * Find a place without leaving the keyboard. The palette floats over the map
   * rather than displacing it, because the map is the answer: choosing a result
   * flies the view there and pins it, and the map behind is already showing the
   * change as the list narrows.
   */
  private buildSearch(): void {
    this.search = new PlaceSearch(this.world.cities, this.world.namedCount, this.world.timezoneMeta)
    const panel = this.q('[data-search]')
    const field = this.q<HTMLInputElement>('[data-search-field]')
    const list = this.q('[data-search-results]')
    let active = 0
    let results: SearchResult[] = []

    const render = () => {
      list.textContent = ''
      results.forEach((result, index) => {
        const item = document.createElement('li')
        item.className = 'search-result'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', String(index === active))
        if (index === active) item.classList.add('is-active')
        const label = document.createElement('span')
        label.className = 'search-label'
        label.textContent = result.label
        const detail = document.createElement('span')
        detail.className = 'search-detail micro'
        detail.textContent = result.detail
        item.append(label, detail)
        item.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          this.choose(result)
        })
        list.append(item)
      })
    }

    const close = () => {
      panel.setAttribute('hidden', '')
      this.q('[data-search-toggle]').setAttribute('aria-expanded', 'false')
      field.value = ''
      results = []
      render()
    }
    this.closeSearch = close

    field.addEventListener('input', () => {
      results = this.search.search(field.value)
      active = 0
      render()
    })

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (results.length === 0) return
        active = (active + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length
        render()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const chosen = results[active]
        if (chosen) this.choose(chosen)
      }
    })

    const toggle = this.q<HTMLButtonElement>('[data-search-toggle]')
    toggle.addEventListener('click', () => {
      const opening = panel.hasAttribute('hidden')
      panel.toggleAttribute('hidden', !opening)
      toggle.setAttribute('aria-expanded', String(opening))
      if (opening) field.focus()
    })

    document.addEventListener('pointerdown', (event) => {
      if (panel.hasAttribute('hidden')) return
      const target = event.target as Node
      if (panel.contains(target) || toggle.contains(target)) return
      close()
    })
  }

  /** Go to a result: pin it, frame it, and adopt its zone if it named one. */
  private choose(result: SearchResult): void {
    this.pin(result.lon, result.lat)
    if (result.zone && isValidZone(result.zone)) {
      this.basis = result.zone
      this.q<HTMLSelectElement>('[data-basis]').value = result.zone
      this.repaintTracks()
    }
    const zoom = Math.max(this.view.zoom, result.kind === 'zone' ? 2 : 4)
    this.view = clampView(this.size, { centerLon: result.lon, centerLat: result.lat, zoom })
    this.closeSearch?.()
    this.markDirty()
  }

  // ------------------------------------------------------------------ almanac

  private buildAlmanac(): void {
    this.almanac = new Almanac()
    this.almanac.element.id = 'almanac'
    // Always closed on arrival. Remembering that it was open meant a returning
    // visitor met a full panel over the map with no idea why, and on a phone
    // that is most of the screen.
    this.almanac.setHidden(true)
    this.stage.append(this.almanac.element)

    this.almanac.element
      .querySelector('[data-almanac-close]')
      ?.addEventListener('click', () => this.setAlmanac(false))

    // Picking an eclipse takes the map to it, and to where it is deepest.
    this.almanac.onJump = (time, place) => {
      this.mode = 'paused'
      this.syncTransport()
      if (place) {
        this.view = clampView(this.size, { centerLon: place.lon, centerLat: place.lat, zoom: Math.max(this.view.zoom, 2.5) })
      }
      this.setTime(time)
      this.draw()
    }

    const toggle = this.q<HTMLButtonElement>('[data-almanac-toggle]')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.addEventListener('click', () => this.setAlmanac(this.almanac.hidden))
  }

  private setAlmanac(open: boolean): void {
    this.almanac.setHidden(!open)
    this.q('[data-almanac-toggle]').setAttribute('aria-expanded', String(open))
    // Fill it now rather than on the next frame: a panel that opens empty and
    // populates a beat later reads as a stall.
    this.draw()
    this.markDirty()
  }

  // ------------------------------------------------------------------ places

  /**
   * Starring a place, and the strip of stars that comes back with it. This is
   * the one piece of state that is worth keeping across visits without being in
   * the address bar: a link describes a moment, a star describes a habit.
   */
  private buildSavedPlaces(): void {
    const star = this.q<HTMLButtonElement>('[data-star]')
    star.addEventListener('click', () => {
      const site = this.focus
      if (!site) return
      const existing = this.prefs.saved.findIndex((p) => samePlace(p, site))
      if (existing >= 0) this.prefs.saved.splice(existing, 1)
      else this.prefs.saved.unshift({ name: site.name, country: site.country, lon: site.lon, lat: site.lat })
      this.prefs.saved = this.prefs.saved.slice(0, 24)
      this.storePreferences()
      this.syncSavedPlaces()
      this.markDirty()
    })
    this.syncSavedPlaces()
  }

  private syncSavedPlaces(): void {
    const star = this.q<HTMLButtonElement>('[data-star]')
    const saved = this.focus !== null && this.prefs.saved.some((p) => samePlace(p, this.focus!))
    star.setAttribute('aria-pressed', String(saved))
    star.classList.toggle('is-on', saved)
    star.setAttribute('aria-label', saved ? 'Forget this place' : 'Save this place')
  }

  private storePreferences(): void {
    this.prefs.layers = LAYER_FIELDS.filter((f) => this.layers[f.key]).map((f) => f.key)
    this.prefs.basis = this.basis
    this.prefs.rate = this.rate
    savePreferences(this.prefs)
  }

  // ------------------------------------------------------------------ export

  private buildShare(): void {
    this.q<HTMLButtonElement>('[data-share]').addEventListener('click', async () => {
      // Draw first: the renderer is idle when nothing has changed, and a canvas
      // that has not been drawn into since the last composite reads back empty.
      this.draw()
      const reading = readingIn(this.basis, this.time)
      const site = this.focus
      const blob = await composeImage(this.mapCanvas, this.overlayCanvas, {
        date: `${formatWeekday(reading)} ${formatDate(reading)}`,
        time: formatClock(reading),
        zone: this.basis === 'UTC' ? 'UTC' : zoneSummary(this.basis, this.time).offset,
        place: site ? (site.country ? `${site.name}, ${site.country}` : site.name) : 'Heliograph',
      })
      const stamp = new Date(this.time).toISOString().slice(0, 16).replace(/[:T]/g, '-')
      await shareOrDownload(blob, `heliograph-${stamp}.png`)
    })
  }

  // ------------------------------------------------------------------ world stats

  /**
   * How much of humanity is standing in daylight.
   *
   * The gazetteer carries a population for every named place, so this is a real
   * measurement over 7,342 cities rather than a model: it is the share of that
   * catalogued population whose Sun is above the horizon. It swings from about
   * a third to about two thirds over a day, and the reason it never reaches
   * either extreme is that the land, and so the people, are not evenly spread.
   */
  private daylitFraction(sun: SolarState): number {
    const minute = Math.floor(this.time / MS_PER_MINUTE)
    if (this.daylitCache?.minute === minute) return this.daylitCache.value
    let lit = 0
    let total = 0
    for (let i = 0; i < this.world.namedCount; i++) {
      const city = this.world.cities[i]!
      const people = city.population
      if (people <= 0) continue
      total += people
      if (elevationAt(city.lat, city.lon, sun) > HORIZON.sunrise) lit += people
    }
    const value = total > 0 ? lit / total : 0
    this.daylitCache = { minute, value }
    return value
  }

  /** The next equinox or solstice after the instant on screen. */
  private nextSeason(): { label: string; instant: number } {
    const year = new Date(this.time).getUTCFullYear()
    const names: Array<[0 | 90 | 180 | 270, string]> = [
      [0, 'Next equinox'],
      [90, 'Next solstice'],
      [180, 'Next equinox'],
      [270, 'Next solstice'],
    ]
    for (const offset of [0, 1]) {
      for (const [quarter, label] of names) {
        const instant = seasonInstant(year + offset, quarter)
        if (instant > this.time) return { label, instant }
      }
    }
    return { label: 'Next solstice', instant: seasonInstant(year + 1, 90) }
  }

  /**
   * The Moon for the instant on screen, worked out once a frame and kept.
   *
   * The gain is the whole of the phase and distance physics, folded into one
   * number so the shader only has to do geometry: it is what a full moon at the
   * zenith would give, scaled down for tonight's phase and tonight's distance.
   */
  private moonNow(): { state: MoonState; phase: MoonPhase; gain: number } {
    if (this.moonCache && this.moonCache.time === this.time) return this.moonCache
    const state = moonState(this.time)
    const phase = moonPhase(solarState(this.time), state)
    // moonlight() takes the altitude of the Moon at the place being lit, and the
    // shader supplies that per pixel, so the gain is quoted at the zenith.
    const gain = moonlight(90, phase, state.distanceKm)
    this.moonCache = { time: this.time, state, phase, gain }
    return this.moonCache
  }

  private buildAnalemma(): Array<{ lon: number; lat: number }> {
    const year = new Date(this.time).getUTCFullYear()
    // UTC days start at the epoch, so the hour of day is plain arithmetic.
    const dayMs = ((this.time % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY
    const hour = Math.round((dayMs / MS_PER_HOUR) * 3600) / 3600
    if (this.analemmaCache && this.analemmaCache.year === year && this.analemmaCache.hour === hour) {
      return this.analemmaCache.points
    }
    const points = analemma(year, hour, 183).map((p) => ({ lon: p.lon, lat: p.lat }))
    this.analemmaCache = { year, hour, points }
    return points
  }
}

export type { City }
