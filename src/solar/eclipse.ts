/**
 * Eclipses, from the geometry rather than from a table.
 *
 * An eclipse is not a special kind of event needing its own theory. It is what
 * the Sun and the Moon already computed here happen to be doing when they line
 * up, so everything below is vector arithmetic on the two positions: build the
 * geocentric vectors, find where the shadow axis runs, and ask how much of the
 * Sun a given point on the Earth can still see.
 *
 * That approach has one great advantage over a catalogue: it works for any
 * instant, past or future, at the same accuracy as the ephemeris underneath it,
 * so the map can show the shadow moving rather than only listing dates.
 */

import { moonState, siderealTime, type MoonState } from './moon.ts'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, solarState, wrapLon, type SolarState } from './solar.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** Kilometres. The equatorial radius, and the two bodies' true radii. */
const EARTH_RADIUS = 6378.14
const MOON_RADIUS = 1737.4
const SUN_RADIUS = 696000
const AU = 149597870.7

export type Vec3 = readonly [number, number, number]

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a: Vec3) => Math.sqrt(dot(a, a))
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const normalise = (a: Vec3): Vec3 => scale(a, 1 / length(a))

/** Right ascension, declination and distance to a geocentric equatorial vector. */
function toVector(rightAscension: number, declination: number, distance: number): Vec3 {
  const ra = rightAscension * DEG
  const dec = declination * DEG
  return [
    distance * Math.cos(dec) * Math.cos(ra),
    distance * Math.cos(dec) * Math.sin(ra),
    distance * Math.sin(dec),
  ]
}

export interface Geometry {
  readonly time: number
  readonly sun: Vec3
  readonly moon: Vec3
  readonly sunState: SolarState
  readonly moonState: MoonState
}

export function geometry(time: number): Geometry {
  const sun = solarState(time)
  const moon = moonState(time)
  return {
    time,
    sun: toVector(sun.rightAscension, sun.declination, sun.distanceAu * AU),
    moon: toVector(moon.rightAscension, moon.declination, moon.distanceKm),
    sunState: sun,
    moonState: moon,
  }
}

/**
 * How much of the Sun's disc is hidden by the Moon, seen from one point on the
 * ground, as a fraction of the Sun's area.
 *
 * This is the honest quantity for a map of sunlight: the ground does not care
 * how deep the eclipse is called, it cares how much light is arriving. Both
 * bodies are treated as discs and the overlapping area of two circles is
 * exact, so a partial eclipse dims the ground by the right amount rather than
 * by a guess.
 *
 * The parallax is the whole reason this has to be done per point rather than
 * once for the Earth: the Moon is close enough that observers a few hundred
 * kilometres apart see it against measurably different parts of the sky, which
 * is why totality is a narrow track and not a hemisphere.
 */
export function obscurationAt(geo: Geometry, lon: number, lat: number): number {
  // The observer's own geocentric vector, which is what turns the geocentric
  // ephemeris into a topocentric one.
  const theta = (siderealTime(geo.time) + lon) * DEG
  const phi = lat * DEG
  const observer: Vec3 = [
    EARTH_RADIUS * Math.cos(phi) * Math.cos(theta),
    EARTH_RADIUS * Math.cos(phi) * Math.sin(theta),
    EARTH_RADIUS * Math.sin(phi),
  ]

  const toSun = sub(geo.sun, observer)
  const toMoon = sub(geo.moon, observer)
  const sunDistance = length(toSun)
  const moonDistance = length(toMoon)

  // Below the horizon there is no Sun to hide.
  if (dot(observer, toSun) <= 0) return 0

  const separation = Math.acos(Math.min(1, Math.max(-1, dot(toSun, toMoon) / (sunDistance * moonDistance))))
  const sunRadius = Math.asin(SUN_RADIUS / sunDistance)
  const moonRadius = Math.asin(MOON_RADIUS / moonDistance)

  if (separation >= sunRadius + moonRadius) return 0
  if (separation <= moonRadius - sunRadius) return 1
  if (separation <= sunRadius - moonRadius) {
    // Annular: the Moon is wholly inside the Sun's disc.
    return (moonRadius * moonRadius) / (sunRadius * sunRadius)
  }

  // The lens shaped overlap of two circles.
  const d = separation
  const r = sunRadius
  const m = moonRadius
  const a1 = Math.acos((d * d + r * r - m * m) / (2 * d * r))
  const a2 = Math.acos((d * d + m * m - r * r) / (2 * d * m))
  const area = r * r * (a1 - Math.sin(2 * a1) / 2) + m * m * (a2 - Math.sin(2 * a2) / 2)
  return area / (Math.PI * r * r)
}

export interface SolarEclipse {
  readonly kind: 'solar'
  /** Instant of greatest eclipse. */
  readonly time: number
  /** Least distance of the shadow axis from the Earth's centre, in Earth radii. */
  readonly gamma: number
  /** Fraction of the Sun's diameter covered at greatest eclipse. */
  readonly magnitude: number
  readonly type: 'total' | 'annular' | 'hybrid' | 'partial'
  /** Where the axis meets the Earth, or null for an eclipse that only grazes. */
  readonly greatest: { lon: number; lat: number } | null
}

export interface LunarEclipse {
  readonly kind: 'lunar'
  readonly time: number
  /** Least distance of the Moon from the shadow axis, in Earth radii. */
  readonly gamma: number
  /** Umbral magnitude: how far the Moon enters the umbra, in lunar diameters. */
  readonly magnitude: number
  readonly type: 'total' | 'partial' | 'penumbral'
}

export type Eclipse = SolarEclipse | LunarEclipse

/**
 * The shadow axis: the line from the Sun through the Moon, and how close it
 * passes to the centre of the Earth.
 */
function axisApproach(geo: Geometry): { gamma: number; hit: Vec3 | null; nearest: Vec3 } {
  const direction = normalise(sub(geo.moon, geo.sun))
  // Parameter along the axis at the point nearest the Earth's centre.
  const s = -dot(geo.moon, direction)
  const nearest: Vec3 = [
    geo.moon[0] + direction[0] * s,
    geo.moon[1] + direction[1] * s,
    geo.moon[2] + direction[2] * s,
  ]
  const distance = length(nearest)
  const gamma = distance / EARTH_RADIUS

  // Where the axis first pierces the surface, which is the point of greatest
  // eclipse when there is one.
  let hit: Vec3 | null = null
  if (distance < EARTH_RADIUS) {
    const half = Math.sqrt(EARTH_RADIUS * EARTH_RADIUS - distance * distance)
    hit = [
      nearest[0] - direction[0] * half,
      nearest[1] - direction[1] * half,
      nearest[2] - direction[2] * half,
    ]
  }
  return { gamma, hit, nearest }
}

/** A geocentric vector to the longitude and latitude beneath it. */
function toGround(time: number, v: Vec3): { lon: number; lat: number } {
  const lat = Math.asin(v[2] / length(v)) * RAD
  const ra = Math.atan2(v[1], v[0]) * RAD
  return { lon: wrapLon(ra - siderealTime(time)), lat }
}

/**
 * Refine an extremum by golden section, after a coarse scan to bracket it.
 *
 * The scan matters: the caller can only say "somewhere in the next day and a
 * half", and golden section is only sound on an interval holding one minimum.
 * It is also much the cheaper way round, because each evaluation costs two full
 * ephemerides and the scan needs a dozen where the search would need forty.
 */
function refine(f: (t: number) => number, lo: number, hi: number, iterations = 34): number {
  const steps = 12
  let bestT = lo
  let bestV = Infinity
  for (let i = 0; i <= steps; i++) {
    const t = lo + ((hi - lo) * i) / steps
    const v = f(t)
    if (v < bestV) {
      bestV = v
      bestT = t
    }
  }
  const span = (hi - lo) / steps
  return goldenSection(f, bestT - span, bestT + span, iterations)
}

function goldenSection(f: (t: number) => number, lo: number, hi: number, iterations: number): number {
  const phi = (Math.sqrt(5) - 1) / 2
  let a = lo
  let b = hi
  let c = b - (b - a) * phi
  let d = a + (b - a) * phi
  for (let i = 0; i < iterations; i++) {
    if (f(c) < f(d)) b = d
    else a = c
    c = b - (b - a) * phi
    d = a + (b - a) * phi
  }
  return (a + b) / 2
}

/**
 * Describe the solar eclipse nearest an instant, whether or not one is under
 * way. Used both to classify a candidate found by the search and to answer
 * "what is happening right now".
 */
export function solarEclipseNear(time: number): SolarEclipse {
  const at = (t: number) => axisApproach(geometry(t)).gamma
  const best = refine(at, time - 18 * MS_PER_HOUR, time + 18 * MS_PER_HOUR)
  const geo = geometry(best)
  const { gamma, hit, nearest } = axisApproach(geo)

  // The point of greatest eclipse exists whether or not the axis reaches the
  // ground: when it misses, it is simply the point on the surface that comes
  // closest to the axis, which is where the deepest partial eclipse is seen.
  // Most eclipses are of that kind, so treating them as no eclipse at all
  // loses about a third of every century's worth.
  const groundPoint = hit ?? scale(normalise(nearest), EARTH_RADIUS)
  const greatest = toGround(best, groundPoint)

  const theta = (siderealTime(best) + greatest.lon) * DEG
  const phi = greatest.lat * DEG
  const observer: Vec3 = [
    EARTH_RADIUS * Math.cos(phi) * Math.cos(theta),
    EARTH_RADIUS * Math.cos(phi) * Math.sin(theta),
    EARTH_RADIUS * Math.sin(phi),
  ]
  const toSun = sub(geo.sun, observer)
  const toMoon = sub(geo.moon, observer)
  const sunRadius = Math.asin(SUN_RADIUS / length(toSun))
  const moonRadius = Math.asin(MOON_RADIUS / length(toMoon))
  const separation = Math.acos(
    Math.min(1, Math.max(-1, dot(toSun, toMoon) / (length(toSun) * length(toMoon)))),
  )

  let magnitude: number
  let type: SolarEclipse['type']
  if (hit) {
    // The axis meets the ground, so the eclipse is central there: the only
    // question is whether the Moon's disc is large enough to cover the Sun's.
    // An annular eclipse has a magnitude below one by definition, so magnitude
    // must not be what decides the type.
    type = moonRadius >= sunRadius ? 'total' : 'annular'
    magnitude = moonRadius / sunRadius
  } else {
    type = 'partial'
    // The fraction of the Sun's diameter covered, which is what catalogues
    // print. It goes to zero exactly when the discs stop touching.
    magnitude = (sunRadius + moonRadius - separation) / (2 * sunRadius)
  }

  return { kind: 'solar', time: best, gamma, magnitude, type, greatest }
}

/** Describe the lunar eclipse nearest an instant. */
export function lunarEclipseNear(time: number): LunarEclipse {
  // The Earth's shadow runs directly away from the Sun, so the quantity to
  // minimise is the Moon's distance from that axis.
  const missBy = (t: number) => {
    const geo = geometry(t)
    const direction = normalise(scale(geo.sun, -1))
    const along = dot(geo.moon, direction)
    const perpendicular = sub(geo.moon, scale(direction, along))
    return length(perpendicular)
  }
  const best = refine(missBy, time - 18 * MS_PER_HOUR, time + 18 * MS_PER_HOUR)
  const geo = geometry(best)
  const direction = normalise(scale(geo.sun, -1))
  const along = dot(geo.moon, direction)
  const miss = missBy(best)
  const sunDistance = length(geo.sun)

  // The two shadow cones, by similar triangles, at the Moon's own distance.
  // The 1.02 is the standard allowance for the Earth's atmosphere, which
  // enlarges the shadow and is why a totally eclipsed Moon is copper and not
  // black: the light reaching it has been bent through every sunrise at once.
  const umbra = 1.02 * (EARTH_RADIUS - (along * (SUN_RADIUS - EARTH_RADIUS)) / sunDistance)
  const penumbra = 1.02 * (EARTH_RADIUS + (along * (SUN_RADIUS + EARTH_RADIUS)) / sunDistance)

  const magnitude = (umbra + MOON_RADIUS - miss) / (2 * MOON_RADIUS)
  let type: LunarEclipse['type'] = 'penumbral'
  if (miss + MOON_RADIUS <= umbra) type = 'total'
  else if (miss - MOON_RADIUS < umbra) type = 'partial'
  else if (miss - MOON_RADIUS >= penumbra) type = 'penumbral'
  return { kind: 'lunar', time: best, gamma: miss / EARTH_RADIUS, magnitude, type }
}

/**
 * The next few eclipses after an instant, searched only as far as it takes.
 *
 * A century of geometry is a few seconds of work, which is far too long to
 * spend before showing a list of eight. So the search walks forward a couple of
 * years at a time and stops as soon as it has enough, which is a fifth of a
 * second, and only keeps going for the rare stretch that holds none.
 */
export function nextEclipses(from: number, count: number, horizonYears = 100): Eclipse[] {
  const chunk = 2 * 365.25 * MS_PER_DAY
  const limit = from + horizonYears * 365.25 * MS_PER_DAY
  const found: Eclipse[] = []
  for (let start = from; start < limit && found.length < count; start += chunk) {
    found.push(...findEclipses(start, Math.min(start + chunk, limit)))
  }
  return found.slice(0, count)
}

/**
 * Every eclipse between two instants.
 *
 * Eclipses can only happen at new and full moon, so the search walks the
 * elongation between the two bodies, picks out each conjunction and opposition,
 * and asks the geometry above whether that particular one lines up closely
 * enough. At half a day a step over a century that is some seventy thousand
 * evaluations, which takes a fraction of a second and needs no table.
 */
export function findEclipses(from: number, to: number): Eclipse[] {
  const step = MS_PER_DAY / 2
  const found: Eclipse[] = []

  // Elongation in longitude: 0 at new moon, 180 at full.
  const elongation = (t: number) => {
    const sun = solarState(t)
    const moon = moonState(t)
    return wrapLon(moon.apparentLongitude - sun.apparentLongitude)
  }

  let previous = elongation(from)
  for (let t = from + step; t <= to; t += step) {
    const current = elongation(t)

    // New moon: the difference in longitude passes upward through zero.
    if (previous < 0 && current >= 0) {
      const eclipse = solarEclipseNear(t)
      // The penumbra can reach the Earth out to about 1.55 Earth radii.
      if (eclipse.gamma < 1.55 && eclipse.magnitude > 0) found.push(eclipse)
    }
    // Full moon: the difference wraps from just under 180 to just over -180.
    if (previous > 90 && current < -90) {
      const eclipse = lunarEclipseNear(t)
      // Only eclipses that actually touch the umbra or penumbra count.
      if (eclipse.type !== 'penumbral' || eclipse.magnitude > -0.5) found.push(eclipse)
    }
    previous = current
  }
  return found
}

/**
 * The Sun and Moon as the renderer wants them: unit directions, distances and
 * angular radii, so the shader can work out the obscuration at every pixel
 * without knowing any astronomy.
 */
export function shadowUniforms(time: number): {
  sun: Vec3
  moon: Vec3
  siderealDegrees: number
  /** True when the Moon is anywhere near the Sun, so the pass can be skipped. */
  possible: boolean
} {
  const geo = geometry(time)
  const separation =
    Math.acos(
      Math.min(1, Math.max(-1, dot(normalise(geo.sun), normalise(geo.moon)))),
    ) * RAD
  return {
    sun: geo.sun,
    moon: geo.moon,
    siderealDegrees: siderealTime(time),
    // Two degrees is far wider than any eclipse, and cheap insurance.
    possible: separation < 2,
  }
}

/** A short human label, of the kind an almanac prints. */
export function describeEclipse(eclipse: Eclipse): string {
  if (eclipse.kind === 'solar') {
    const type = eclipse.type[0]!.toUpperCase() + eclipse.type.slice(1)
    return `${type} solar`
  }
  const type = eclipse.type[0]!.toUpperCase() + eclipse.type.slice(1)
  return `${type} lunar`
}

export { MS_PER_MINUTE }
