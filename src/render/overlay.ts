import type { Polygons, WorldData } from '../data/world.ts'
import type { EclipseTrack } from '../solar/eclipse.ts'
import type { SolarState } from '../solar/solar.ts'
import { INK, SUN, linearRgbToOklab, sampleSurfaceRamp } from './palette.ts'
import { plateRect, project, worldWidth, type Size, type View } from './view.ts'

/**
 * Everything vector on top of the shaded map: the graticule, the twilight
 * boundaries, the subsolar marker, timezone outlines, and all the type.
 *
 * This is a separate 2D canvas rather than more WebGL, because the work here is
 * hairlines and text, which Canvas2D does better than anything hand written, and
 * because keeping it out of the scene buffer keeps it out of the bloom. Only
 * light sources should bloom.
 */

/** Obliquity of the ecliptic, which is what puts the tropics where they are. */
export const OBLIQUITY = 23.4366
export const POLAR_CIRCLE = 90 - OBLIQUITY

/** Altitudes at which the twilight boundaries are drawn, in degrees. */
const BOUNDARIES = [
  { altitude: -0.833, label: 'SUNRISE / SUNSET', weight: 1.2, alpha: 0.7, warm: true },
  { altitude: -6, label: 'CIVIL', weight: 1.0, alpha: 0.46, warm: false },
  { altitude: -12, label: 'NAUTICAL', weight: 1.0, alpha: 0.38, warm: false },
  { altitude: -18, label: 'ASTRONOMICAL', weight: 1.0, alpha: 0.3, warm: false },
] as const

export interface ZoneLabel {
  lon: number
  lat: number
  /** The clock reading, for example 14:07. */
  text: string
  /** The offset, for example +02:00. */
  sub: string
  /** Area of the zone polygon in square degrees, used to rank labels. */
  area: number
  highlighted: boolean
}

export interface PlaceLabel {
  lon: number
  lat: number
  text: string
  /** Higher wins when labels collide. */
  rank: number
  capital: boolean
}

export interface OverlayLayers {
  graticule: boolean
  boundaries: boolean
  timezones: boolean
  places: boolean
  analemma: boolean
}

export interface OverlayFrame {
  view: View
  size: Size
  sun: SolarState
  world: WorldData
  layers: OverlayLayers
  zoneLabels: ZoneLabel[]
  placeLabels: PlaceLabel[]
  /** Indices into world.timezoneMeta whose polygons should be washed with light. */
  highlightZones: ReadonlySet<number>
  /** Subsolar track over the year, as lon and lat pairs. */
  analemma: Array<{ lon: number; lat: number }> | null
  /** Where the Moon stands overhead, how much of it is lit, and whether it is in the Earth's umbra. */
  moon: { lon: number; lat: number; illumination: number; waxing: boolean; eclipsed: boolean } | null
  /** The ground track of the Moon's shadow, when an eclipse is under way. */
  eclipsePath: EclipseTrack | null
  /** Where the Moon is overhead while it is inside the Earth's shadow. */
  lunarEclipse: { lon: number; lat: number; inUmbra: boolean } | null
  /**
   * True when every zone is drawn at its own clock rather than one instant.
   * The subsolar point and the twilight circles describe a single instant, so
   * they would be describing a map that is no longer on screen.
   */
  localTime: boolean
  hover: { lon: number; lat: number } | null
  pinned: { lon: number; lat: number; label: string } | null
  /** 0 to 1, fades the whole overlay in on load. */
  reveal: number
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const RAD = Math.PI / 180
const MS_PER_HOUR = 3600_000
/** A totally eclipsed Moon, as photographed: a dull red-brown, never black. */
const ECLIPSED_MOON = '#b4532c'

export class MapOverlay {
  private readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private occupied: Box[] = []

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('could not get a 2D context for the overlay')
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  }

  /** One device pixel, expressed in the CSS pixels the context is scaled to. */
  private get hairline(): number {
    return 1 / this.dpr
  }

  draw(frame: OverlayFrame): void {
    const { ctx } = this
    const { size } = frame
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    this.occupied = []

    ctx.save()
    ctx.globalAlpha = frame.reveal

    // Everything geographic is confined to the plate. The wrapped copies of the
    // world are drawn unconditionally, so without this the twilight arcs and the
    // timezone outlines spill out into the surround.
    ctx.save()
    this.clipToPlate(frame)
    if (frame.layers.timezones) {
      this.drawZoneFills(frame)
      this.drawZoneOutlines(frame)
    }
    if (frame.layers.graticule) this.drawGraticule(frame)
    if (frame.layers.analemma && frame.analemma) this.drawAnalemma(frame)
    if (frame.layers.boundaries && !frame.localTime) this.drawTwilightBoundaries(frame)
    if (frame.eclipsePath && !frame.localTime) this.drawEclipsePath(frame, frame.eclipsePath)
    if (frame.lunarEclipse && !frame.localTime) this.drawLunarVisibility(frame, frame.lunarEclipse)
    if (!frame.localTime) this.drawSubsolar(frame)
    if (frame.moon) this.drawSublunar(frame, frame.moon)
    if (frame.layers.timezones) this.drawZoneLabels(frame)
    if (frame.layers.places) this.drawPlaceLabels(frame)
    if (frame.pinned) this.drawPin(frame, frame.pinned)
    if (frame.hover) this.drawHover(frame, frame.hover)
    ctx.restore()

    this.drawPlateFrame(frame)
    ctx.restore()
  }

  // -------------------------------------------------------------- primitives

  /**
   * Draw a geographic path once per visible copy of the world, breaking the line
   * wherever it jumps the antimeridian so no stray segment crosses the map.
   */
  private strokeGeoPath(frame: OverlayFrame, points: Array<[number, number]>, close: boolean): void {
    const { ctx } = this
    const w = worldWidth(frame.size, frame.view)
    const projected = points.map(([lon, lat]) => project(frame.size, frame.view, lon, lat))
    for (const offset of [-w, 0, w]) {
      if (offset !== 0 && w >= frame.size.width * 3) continue
      ctx.beginPath()
      let drawing = false
      for (let i = 0; i < projected.length; i++) {
        const current = projected[i]!
        const previous = projected[i - 1]
        if (previous && Math.abs(current[0] - previous[0]) > w / 2) drawing = false
        if (!drawing) {
          ctx.moveTo(current[0] + offset, current[1])
          drawing = true
        } else {
          ctx.lineTo(current[0] + offset, current[1])
        }
      }
      if (close && drawing) ctx.closePath()
      ctx.stroke()
    }
  }

  /**
   * The locus of points where the Sun sits at a given altitude: a small circle
   * centred on the subsolar point with angular radius 90 minus that altitude.
   */
  private static smallCircle(centreLat: number, centreLon: number, radiusDeg: number, samples = 512) {
    const lat1 = centreLat * RAD
    const lon1 = centreLon * RAD
    const d = radiusDeg * RAD
    const sinLat1 = Math.sin(lat1)
    const cosLat1 = Math.cos(lat1)
    const sinD = Math.sin(d)
    const cosD = Math.cos(d)
    const points: Array<[number, number]> = []
    for (let i = 0; i <= samples; i++) {
      const bearing = (i / samples) * 2 * Math.PI
      const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(bearing))
      const lon2 =
        lon1 + Math.atan2(Math.sin(bearing) * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2))
      points.push([(((lon2 / RAD + 540) % 360) - 180), lat2 / RAD])
    }
    return points
  }

  /** Confine drawing to the map plate, so nothing spills into the surround. */
  private clipToPlate(frame: OverlayFrame): void {
    const rect = plateRect(frame.size, frame.view)
    this.ctx.beginPath()
    this.ctx.rect(Math.max(0, rect.x), rect.y, Math.min(frame.size.width, rect.width), rect.height)
    this.ctx.clip()
  }

  // -------------------------------------------------------------- layers

  private drawGraticule(frame: OverlayFrame): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    const step = frame.view.zoom >= 4 ? 10 : 30
    const hairline = this.hairline

    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x - rect.width, rect.y, rect.width * 3, rect.height)
    ctx.clip()

    // Ordinary meridians and parallels.
    ctx.lineWidth = hairline
    ctx.strokeStyle = INK[100]
    ctx.globalAlpha *= 1
    for (let lon = -180 + step; lon < 180; lon += step) {
      if (lon === 0) continue
      this.line(frame, [[lon, -90], [lon, 90]], INK[100], hairline, 0.5)
    }
    for (let lat = -90 + step; lat < 90; lat += step) {
      if (lat === 0) continue
      this.line(frame, [[-180, lat], [180, lat]], INK[100], hairline, 0.5)
    }

    // The prime meridian sits between the ordinary lines and the emphasised ones.
    this.line(frame, [[0, -90], [0, 90]], INK[200], hairline, 0.75)

    // The equator, the tropics and the polar circles are not decoration here.
    // They are the geometry of the whole subject: the subsolar point runs
    // between the tropics, and the polar circles are exactly where the Sun
    // stops rising and setting.
    this.line(frame, [[-180, 0], [180, 0]], INK[300], hairline * 1.5, 0.85)
    for (const lat of [OBLIQUITY, -OBLIQUITY]) {
      this.line(frame, [[-180, lat], [180, lat]], INK[200], hairline * 1.5, 0.7)
    }
    for (const lat of [POLAR_CIRCLE, -POLAR_CIRCLE]) {
      this.line(frame, [[-180, lat], [180, lat]], INK[200], hairline * 1.5, 0.55)
    }
    ctx.restore()

    this.drawGraticuleLabels(frame, step)
  }

  private line(
    frame: OverlayFrame,
    points: Array<[number, number]>,
    colour: string,
    width: number,
    alpha: number,
  ): void {
    const { ctx } = this
    ctx.save()
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.globalAlpha *= alpha
    this.strokeGeoPath(frame, points, false)
    ctx.restore()
  }

  private drawGraticuleLabels(frame: OverlayFrame, step: number): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    ctx.save()
    ctx.font = `500 9px ${FONT_STACK}`
    ctx.fillStyle = INK[300]
    ctx.globalAlpha *= 0.85
    ctx.textBaseline = 'middle'

    const named: Array<[number, string]> = [
      [OBLIQUITY, 'TROPIC OF CANCER'],
      [0, 'EQUATOR'],
      [-OBLIQUITY, 'TROPIC OF CAPRICORN'],
      [POLAR_CIRCLE, 'ARCTIC CIRCLE'],
      [-POLAR_CIRCLE, 'ANTARCTIC CIRCLE'],
    ]
    ctx.textAlign = 'left'
    for (const [lat, name] of named) {
      const [, y] = project(frame.size, frame.view, 0, lat)
      if (y < rect.y + 6 || y > rect.y + rect.height - 6) continue
      ctx.save()
      ctx.globalAlpha *= lat === 0 ? 0.8 : 0.5
      this.tracked(name, Math.max(rect.x, 0) + 12, y - 7, 0.14, 9)
      ctx.restore()
    }

    // Latitude and longitude ticks along the plate edge.
    ctx.fillStyle = INK[400]
    ctx.globalAlpha *= 0.75
    ctx.textAlign = 'right'
    for (let lat = -90 + step; lat < 90; lat += step) {
      const [, y] = project(frame.size, frame.view, 0, lat)
      if (y < rect.y + 8 || y > rect.y + rect.height - 8) continue
      const text = `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`
      ctx.fillText(text, Math.min(frame.size.width - 8, rect.x + rect.width - 8), y)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let lon = -180 + step; lon < 180; lon += step) {
      const [x] = project(frame.size, frame.view, lon, 0)
      if (x < 24 || x > frame.size.width - 24) continue
      const text = lon === 0 ? '0°' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`
      ctx.fillText(text, x, rect.y + 7)
    }
    ctx.restore()
  }

  /**
   * The four twilight boundaries, drawn as hairlines over the continuous
   * gradient. Every other map of this kind picks one or the other: discrete
   * bands, which are legible and look like a diagram, or a smooth gradient,
   * which looks like a photograph and cannot be read. Drawing both means the
   * hairline at -6 lands exactly where the colour changes character, which is
   * what proves the gradient is real.
   */
  private drawTwilightBoundaries(frame: OverlayFrame): void {
    const { declination, subsolarLon } = frame.sun
    for (const boundary of BOUNDARIES) {
      const points = MapOverlay.smallCircle(declination, subsolarLon, 90 - boundary.altitude)
      this.line(
        frame,
        points,
        boundary.warm ? SUN[300] : INK[500],
        this.hairline * boundary.weight * this.dpr,
        boundary.alpha,
      )
    }
  }

  private drawAnalemma(frame: OverlayFrame): void {
    if (!frame.analemma) return
    const points = frame.analemma.map((p) => [p.lon, p.lat] as [number, number])
    this.line(frame, points, SUN[300], this.hairline * 1.2 * this.dpr, 0.35)
  }

  private drawZoneFills(frame: OverlayFrame): void {
    if (frame.highlightZones.size === 0) return
    const { ctx } = this
    const tz = frame.world.timezones
    if (!tz.featureStarts) return
    ctx.save()
    this.clipToPlate(frame)
    ctx.fillStyle = SUN[400]
    ctx.globalAlpha *= 0.1
    const w = worldWidth(frame.size, frame.view)
    for (const index of frame.highlightZones) {
      const firstPoly = tz.featureStarts[index]
      const lastPoly = tz.featureStarts[index + 1]
      if (firstPoly === undefined || lastPoly === undefined) continue
      for (const offset of [-w, 0, w]) {
        ctx.beginPath()
        this.tracePolygons(frame, tz, firstPoly, lastPoly, offset)
        ctx.fill('evenodd')
      }
    }
    ctx.restore()
  }

  private drawZoneOutlines(frame: OverlayFrame): void {
    const { ctx } = this
    const tz = frame.world.timezones
    ctx.save()
    this.clipToPlate(frame)
    ctx.strokeStyle = INK[300]
    ctx.lineWidth = this.hairline
    ctx.globalAlpha *= 0.55
    const w = worldWidth(frame.size, frame.view)
    for (const offset of [-w, 0, w]) {
      ctx.beginPath()
      this.tracePolygons(frame, tz, 0, tz.polyStarts.length - 1, offset)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Add a run of polygons to the current path, in screen space. */
  private tracePolygons(
    frame: OverlayFrame,
    polygons: Polygons,
    firstPoly: number,
    lastPoly: number,
    offset: number,
  ): void {
    const { ctx } = this
    const { coords, ringStarts, polyStarts } = polygons
    const w = worldWidth(frame.size, frame.view)
    for (let p = firstPoly; p < lastPoly; p++) {
      const firstRing = polyStarts[p]
      const lastRing = polyStarts[p + 1]
      if (firstRing === undefined || lastRing === undefined) continue
      for (let r = firstRing; r < lastRing; r++) {
        const start = ringStarts[r]
        const end = ringStarts[r + 1]
        if (start === undefined || end === undefined || end - start < 3) continue
        let previousX = 0
        for (let v = start; v < end; v++) {
          const [x, y] = project(frame.size, frame.view, coords[v * 2]!, coords[v * 2 + 1]!)
          if (v === start) ctx.moveTo(x + offset, y)
          else if (Math.abs(x - previousX) > w / 2) ctx.moveTo(x + offset, y)
          else ctx.lineTo(x + offset, y)
          previousX = x
        }
        ctx.closePath()
      }
    }
  }

  private drawPlateFrame(frame: OverlayFrame): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    ctx.save()
    ctx.strokeStyle = INK[200]
    ctx.globalAlpha *= 0.9
    ctx.lineWidth = this.hairline
    ctx.beginPath()
    ctx.moveTo(0, Math.round(rect.y) + 0.5 / this.dpr)
    ctx.lineTo(frame.size.width, Math.round(rect.y) + 0.5 / this.dpr)
    ctx.moveTo(0, Math.round(rect.y + rect.height) - 0.5 / this.dpr)
    ctx.lineTo(frame.size.width, Math.round(rect.y + rect.height) - 0.5 / this.dpr)
    ctx.stroke()
    ctx.restore()
  }

  private drawSubsolar(frame: OverlayFrame): void {
    const { ctx } = this
    const { subsolarLon, subsolarLat } = frame.sun
    const w = worldWidth(frame.size, frame.view)
    const [x, y] = project(frame.size, frame.view, subsolarLon, subsolarLat)

    for (const offset of [-w, 0, w]) {
      const cx = x + offset
      if (cx < -40 || cx > frame.size.width + 40) continue
      ctx.save()
      ctx.translate(cx, y)
      ctx.strokeStyle = SUN[500]
      ctx.lineWidth = this.hairline * 1.4 * this.dpr
      ctx.globalAlpha *= 0.9
      ctx.beginPath()
      ctx.arc(0, 0, 9, 0, Math.PI * 2)
      ctx.stroke()
      // A gapped crosshair: the reading is the centre, so leave it uncovered.
      ctx.globalAlpha *= 0.75
      ctx.beginPath()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        ctx.moveTo(dx * 13, dy * 13)
        ctx.lineTo(dx * 20, dy * 20)
      }
      ctx.stroke()
      ctx.restore()
    }

    // The antisolar point: local midnight, and the centre of the night side.
    const [ax, ay] = project(frame.size, frame.view, subsolarLon + 180, -subsolarLat)
    for (const offset of [-w, 0, w]) {
      const cx = ax + offset
      if (cx < -20 || cx > frame.size.width + 20) continue
      ctx.save()
      ctx.strokeStyle = INK[400]
      ctx.globalAlpha *= 0.55
      ctx.lineWidth = this.hairline * this.dpr
      ctx.beginPath()
      ctx.arc(cx, ay, 4.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  /**
   * The path of totality, which is the honest answer to "where".
   *
   * A central eclipse is not a place, it is a place moving: the shadow axis
   * lands somewhere near sunrise, races east at better than a thousand miles an
   * hour, and lifts off near sunset, and totality is only ever seen from the
   * narrow band it sweeps. Marking the point of greatest eclipse alone names one
   * frame of that and gets everybody else's answer wrong, so the whole track is
   * drawn, with the hours marked along it to show how fast the shadow moves and
   * roughly when it passes.
   *
   * The line is cased in dark before it is drawn in light, because it has to
   * stay legible over both the day side and the night side of the same map.
   */
  private drawEclipsePath(frame: OverlayFrame, track: EclipseTrack): void {
    const { ctx } = this
    const w = worldWidth(frame.size, frame.view)
    // Annular shadows never reach the ground, so they get the cooler ink; a
    // total path is the one worth walking to, and reads brightest.
    const colour = track.type === 'annular' ? SUN[600] : SUN[500]

    ctx.save()

    if (track.central.length > 1) {
      const points = track.central.map(({ lon, lat }) => [lon, lat] as [number, number])
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // The band first: the umbra at its true width, so that zooming in shows
      // the hundred-odd kilometres that actually go dark, and a town on the
      // edge of it can see which side it is on.
      this.fillUmbraBand(frame, track, colour)

      ctx.globalAlpha *= 0.85
      ctx.strokeStyle = INK[0]
      ctx.lineWidth = 4
      this.strokeGeoPath(frame, points, false)

      ctx.strokeStyle = colour
      ctx.lineWidth = 1.5
      this.strokeGeoPath(frame, points, false)

      // One mark per whole hour of Universal Time, found by watching the hour
      // number change between samples rather than by hoping one lands on it.
      ctx.lineWidth = this.hairline * this.dpr
      for (let i = 1; i < track.central.length; i++) {
        const previous = track.central[i - 1]!
        const current = track.central[i]!
        if (Math.floor(previous.time / MS_PER_HOUR) === Math.floor(current.time / MS_PER_HOUR)) continue
        const [x, y] = project(frame.size, frame.view, current.lon, current.lat)
        for (const offset of [-w, 0, w]) {
          const cx = x + offset
          if (cx < -20 || cx > frame.size.width + 20) continue
          ctx.beginPath()
          ctx.arc(cx, y, 2.6, 0, Math.PI * 2)
          ctx.fillStyle = INK[0]
          ctx.fill()
          ctx.strokeStyle = colour
          ctx.stroke()
        }
      }
    }

    // Greatest eclipse: the middle of the track, and the only marker a partial
    // eclipse has, since its axis passes the Earth by without ever landing.
    if (track.greatest) {
      const [x, y] = project(frame.size, frame.view, track.greatest.lon, track.greatest.lat)
      for (const offset of [-w, 0, w]) {
        const cx = x + offset
        if (cx < -30 || cx > frame.size.width + 30) continue
        ctx.beginPath()
        ctx.arc(cx, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = colour
        ctx.fill()
        ctx.globalAlpha *= 0.8
        ctx.lineWidth = this.hairline * 1.4 * this.dpr
        ctx.strokeStyle = colour
        ctx.beginPath()
        ctx.arc(cx, y, 9.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  /**
   * The umbra as a band of its real width.
   *
   * The shadow on the ground is the cone's circle stretched along the Sun's
   * bearing by the slant of the light, so near sunrise and sunset it is a long
   * ellipse and at noon nearly round. What the band needs is the extent of
   * that ellipse across the direction of travel, which is the support function
   * of the ellipse in the track's normal, and a couple of lines of algebra.
   * Each sample gets two edge points a little way either side of the axis,
   * and consecutive pairs make quads, each one small enough that the
   * antimeridian can simply skip it.
   */
  private fillUmbraBand(frame: OverlayFrame, track: EclipseTrack, colour: string): void {
    const { ctx } = this
    const w = worldWidth(frame.size, frame.view)
    const KM_PER_DEGREE = 111.32
    const edges: Array<[[number, number], [number, number]] | null> = []

    for (let i = 0; i < track.central.length; i++) {
      const point = track.central[i]!
      const ahead = track.central[Math.min(i + 1, track.central.length - 1)]!
      const behind = track.central[Math.max(i - 1, 0)]!
      // Direction of travel in kilometres, east and north.
      const cosLat = Math.cos(point.lat * RAD)
      let de = (((ahead.lon - behind.lon + 540) % 360) - 180) * KM_PER_DEGREE * cosLat
      let dn = (ahead.lat - behind.lat) * KM_PER_DEGREE
      const along = Math.hypot(de, dn)
      if (along === 0 || point.elevation <= 0.5) {
        edges.push(null)
        continue
      }
      de /= along
      dn /= along
      // The normal to the track, and the ellipse's own axes: its long axis
      // lies along the Sun's bearing, stretched by one over the sine of the
      // Sun's altitude.
      const ne = -dn
      const nn = de
      const ue = Math.sin(point.azimuth * RAD)
      const un = Math.cos(point.azimuth * RAD)
      const a = point.radiusKm / Math.max(0.12, Math.sin(point.elevation * RAD))
      const b = point.radiusKm
      const dotU = ne * ue + nn * un
      const dotV = ne * -un + nn * ue
      const half = Math.sqrt(a * a * dotU * dotU + b * b * dotV * dotV)
      const dLon = (half * ne) / (KM_PER_DEGREE * cosLat)
      const dLat = (half * nn) / KM_PER_DEGREE
      edges.push([
        project(frame.size, frame.view, point.lon + dLon, point.lat + dLat),
        project(frame.size, frame.view, point.lon - dLon, point.lat - dLat),
      ])
    }

    ctx.save()
    ctx.fillStyle = colour
    ctx.globalAlpha *= 0.28
    for (const offset of [-w, 0, w]) {
      if (offset !== 0 && w >= frame.size.width * 3) continue
      ctx.beginPath()
      for (let i = 1; i < edges.length; i++) {
        const from = edges[i - 1]
        const to = edges[i]
        if (!from || !to) continue
        // A pair that straddles the antimeridian projects to opposite ends of
        // the plate; the segment between them is not worth drawing.
        if (Math.abs(to[0][0] - from[0][0]) > w / 2) continue
        ctx.moveTo(from[0][0] + offset, from[0][1])
        ctx.lineTo(to[0][0] + offset, to[0][1])
        ctx.lineTo(to[1][0] + offset, to[1][1])
        ctx.lineTo(from[1][0] + offset, from[1][1])
        ctx.closePath()
      }
      ctx.fill()
    }
    ctx.restore()
  }

  /**
   * The half of the world that can see a lunar eclipse.
   *
   * A lunar eclipse has no track: the Moon is in the shadow for everybody at
   * once, and the only question is who has it above the horizon. That is a
   * hemisphere centred on the sublunar point, drawn as its rim so the map
   * underneath stays legible, and dashed so it cannot be mistaken for the
   * terminator it runs close to.
   */
  private drawLunarVisibility(frame: OverlayFrame, moon: { lon: number; lat: number; inUmbra: boolean }): void {
    const { ctx } = this
    ctx.save()
    ctx.strokeStyle = moon.inUmbra ? INK[700] : INK[500]
    ctx.lineWidth = this.hairline * 1.4 * this.dpr
    ctx.globalAlpha *= moon.inUmbra ? 0.75 : 0.45
    ctx.setLineDash([6, 5])
    this.strokeGeoPath(frame, MapOverlay.smallCircle(moon.lat, moon.lon, 90), true)
    ctx.restore()
  }

  /**
   * The sublunar point, drawn as the Moon actually looks tonight.
   *
   * The terminator on a real lunar disc is a half ellipse, not an offset
   * circle: the boundary between lit and unlit is a great circle on a sphere
   * seen at an angle, so it projects to an ellipse whose width is the cosine
   * of the phase angle. Drawing it that way costs one extra arc and is the
   * difference between a Moon and a cookie with a bite out of it.
   */
  private drawSublunar(
    frame: OverlayFrame,
    moon: { lon: number; lat: number; illumination: number; waxing: boolean; eclipsed: boolean },
  ): void {
    const { ctx } = this
    const w = worldWidth(frame.size, frame.view)
    const [x, y] = project(frame.size, frame.view, moon.lon, moon.lat)
    const radius = 6.5

    for (const offset of [-w, 0, w]) {
      const cx = x + offset
      if (cx < -30 || cx > frame.size.width + 30) continue
      ctx.save()
      ctx.translate(cx, y)

      // The unlit disc first, so the lit part is drawn over it.
      ctx.fillStyle = INK[200]
      ctx.globalAlpha *= 0.85
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()

      // The lit fraction runs 0 to 1 across the disc, so the terminator's
      // semi-minor axis is how far that boundary sits from the centre.
      const k = Math.min(1, Math.max(0, moon.illumination))
      const waxing = moon.waxing
      // Inside the umbra the Moon is lit only by the light the atmosphere bends
      // round the Earth, which is every sunset at once, and it goes copper.
      ctx.fillStyle = moon.eclipsed ? ECLIPSED_MOON : INK[800]
      ctx.beginPath()
      // The limb: the half of the circle on the lit side.
      const from = waxing ? -Math.PI / 2 : Math.PI / 2
      ctx.arc(0, 0, radius, from, from + Math.PI, false)
      // The terminator: an ellipse of the same height. Gibbous, the path
      // carries on round the far side of the disc and the ellipse bulges away
      // from the limb; crescent, it turns back through the same half and
      // encloses only the sliver between the limb and the ellipse. Getting
      // that flag the wrong way round draws a full Moon as nothing at all.
      ctx.ellipse(0, 0, radius * Math.abs(2 * k - 1), radius, 0, from + Math.PI, from, k < 0.5)
      ctx.fill()

      ctx.strokeStyle = INK[400]
      ctx.globalAlpha *= 0.7
      ctx.lineWidth = this.hairline * this.dpr
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // -------------------------------------------------------------- type

  /** Letterspaced text, which Canvas2D only gained recently and not everywhere. */
  private tracked(text: string, x: number, y: number, em: number, size: number): void {
    const { ctx } = this
    const spacing = size * em
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
    if (typeof spaced.letterSpacing === 'string') {
      const previous = spaced.letterSpacing
      spaced.letterSpacing = `${spacing}px`
      ctx.fillText(text, x, y)
      spaced.letterSpacing = previous
      return
    }
    let cursor = x
    for (const character of text) {
      ctx.fillText(character, cursor, y)
      cursor += ctx.measureText(character).width + spacing
    }
  }

  /**
   * How bright the map is under a label, so the halo can appear only where it is
   * needed and withdraw as the ground lightens. The elevation is the same number
   * the shader uses, so this tracks the picture exactly without reading pixels.
   */
  private groundLightness(frame: OverlayFrame, lon: number, lat: number, onLand: boolean): number {
    const dec = frame.sun.declination * RAD
    const ha = (lon - frame.sun.subsolarLon) * RAD
    const l = lat * RAD
    const sinE = Math.sin(l) * Math.sin(dec) + Math.cos(l) * Math.cos(dec) * Math.cos(ha)
    const elevation = Math.asin(Math.max(-1, Math.min(1, sinE))) / RAD
    const rgb = sampleSurfaceRamp(onLand ? 'land' : 'ocean', elevation)
    return linearRgbToOklab(rgb[0], rgb[1], rgb[2])[0]
  }

  private reserve(box: Box): boolean {
    for (const other of this.occupied) {
      if (box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y) {
        return false
      }
    }
    this.occupied.push(box)
    return true
  }

  private haloedText(
    text: string,
    x: number,
    y: number,
    colour: string,
    lightness: number,
    align: CanvasTextAlign = 'left',
  ): void {
    const { ctx } = this
    ctx.textAlign = align
    const halo = Math.max(0, Math.min(1, (0.5 - lightness) / 0.38)) * 0.62
    if (halo > 0.02) {
      ctx.save()
      ctx.globalAlpha *= halo
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      // One step above the ground, never pure black, so the halo disappears into
      // the dark instead of ringing it.
      ctx.strokeStyle = INK[50]
      ctx.strokeText(text, x, y)
      ctx.restore()
    }
    ctx.fillStyle = colour
    ctx.fillText(text, x, y)
  }

  private drawZoneLabels(frame: OverlayFrame): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    const w = worldWidth(frame.size, frame.view)
    const ordered = [...frame.zoneLabels].sort((a, b) => b.area - a.area)
    ctx.save()
    ctx.textBaseline = 'middle'
    for (const label of ordered) {
      const [px, py] = project(frame.size, frame.view, label.lon, label.lat)
      for (const offset of [-w, 0, w]) {
        const x = px + offset
        if (x < Math.max(30, rect.x + 26) || x > Math.min(frame.size.width - 30, rect.x + rect.width - 26)) continue
        if (py < rect.y + 14 || py > rect.y + rect.height - 14) continue
        const box = { x: x - 26, y: py - 13, w: 52, h: 26 }
        if (!this.reserve(box)) continue
        const lightness = this.groundLightness(frame, label.lon, label.lat, true)
        ctx.font = `500 12px ${FONT_MONO}`
        this.haloedText(
          label.text,
          x,
          py - 4,
          label.highlighted ? SUN[400] : INK[600],
          lightness,
          'center',
        )
        ctx.font = `500 8px ${FONT_STACK}`
        ctx.globalAlpha *= 0.8
        this.haloedText(label.sub, x, py + 7, INK[400], lightness, 'center')
        ctx.globalAlpha /= 0.8
      }
    }
    ctx.restore()
  }

  private drawPlaceLabels(frame: OverlayFrame): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    const w = worldWidth(frame.size, frame.view)
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.font = `400 11px ${FONT_STACK}`
    for (const place of frame.placeLabels) {
      const [px, py] = project(frame.size, frame.view, place.lon, place.lat)
      for (const offset of [-w, 0, w]) {
        const x = px + offset
        if (x < Math.max(4, rect.x) || x > Math.min(frame.size.width - 4, rect.x + rect.width)) continue
        if (py < rect.y + 8 || py > rect.y + rect.height - 8) continue
        const width = ctx.measureText(place.text).width
        if (!this.reserve({ x: x + 4, y: py - 8, w: width + 10, h: 16 })) continue
        const lightness = this.groundLightness(frame, place.lon, place.lat, true)
        ctx.save()
        ctx.globalAlpha *= 0.9
        ctx.fillStyle = INK[600]
        ctx.beginPath()
        ctx.arc(x, py, place.capital ? 1.9 : 1.4, 0, Math.PI * 2)
        ctx.fill()
        this.haloedText(place.text, x + 6, py, place.capital ? INK[700] : INK[500], lightness)
        ctx.restore()
      }
    }
    ctx.restore()
  }

  private drawPin(frame: OverlayFrame, pin: { lon: number; lat: number; label: string }): void {
    const { ctx } = this
    const w = worldWidth(frame.size, frame.view)
    const [px, py] = project(frame.size, frame.view, pin.lon, pin.lat)
    for (const offset of [-w, 0, w]) {
      const x = px + offset
      if (x < -20 || x > frame.size.width + 20) continue
      ctx.save()
      ctx.strokeStyle = SUN[400]
      ctx.lineWidth = this.hairline * 1.4 * this.dpr
      ctx.beginPath()
      ctx.arc(x, py, 5.5, 0, Math.PI * 2)
      ctx.moveTo(x - 11, py)
      ctx.lineTo(x - 7, py)
      ctx.moveTo(x + 7, py)
      ctx.lineTo(x + 11, py)
      ctx.moveTo(x, py - 11)
      ctx.lineTo(x, py - 7)
      ctx.moveTo(x, py + 7)
      ctx.lineTo(x, py + 11)
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawHover(frame: OverlayFrame, hover: { lon: number; lat: number }): void {
    const { ctx } = this
    const rect = plateRect(frame.size, frame.view)
    const [x, y] = project(frame.size, frame.view, hover.lon, hover.lat)
    ctx.save()
    ctx.strokeStyle = INK[500]
    ctx.globalAlpha *= 0.45
    ctx.lineWidth = this.hairline
    ctx.setLineDash([2 / this.dpr, 3 / this.dpr])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(frame.size.width, y)
    ctx.moveTo(x, rect.y)
    ctx.lineTo(x, rect.y + rect.height)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.strokeStyle = INK[700]
    ctx.lineWidth = this.hairline * 1.5 * this.dpr
    ctx.beginPath()
    ctx.arc(x, y, 3.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// Canvas2D resolves no custom properties, so the stacks are spelled out here and
// must stay in step with the ones in style.css.
const FONT_STACK = '"Archivo", system-ui, sans-serif'
const FONT_MONO = '"Martian Mono", ui-monospace, monospace'
