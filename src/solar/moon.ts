/**
 * Lunar geometry, following Meeus, Astronomical Algorithms, chapters 47 and 48.
 *
 * The Moon is the only other thing that lights the ground, and it is the reason
 * a clear night is not all one darkness. Its position is worth doing properly:
 * it moves thirteen degrees a day, thirty times faster than the Sun's apparent
 * motion along the ecliptic, so the sloppy series that would do for the Sun are
 * visibly wrong for the Moon within hours.
 *
 * The full ELP truncation Meeus prints is used here, all sixty terms of table
 * 47.A and all sixty of 47.B, which holds the longitude to about ten arcseconds
 * and the distance to a few kilometres. That is far tighter than a world map can
 * show, and it means the terminator of the Moon's own light, the phase, and the
 * rise and set times are all right for the same reason the solar ones are.
 *
 * Conventions match solar.ts: longitude east positive, latitude north positive,
 * degrees at the boundary, radians only inside a calculation, and every instant
 * an epoch millisecond count in UTC.
 */

import {
  clamp,
  DELTA_T_SECONDS,
  julianCentury,
  julianDay,
  MS_PER_DAY,
  MS_PER_MINUTE,
  wrap360,
  wrapLon,
  type SolarState,
} from './solar.ts'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

const sinD = (deg: number) => Math.sin(deg * DEG)
const cosD = (deg: number) => Math.cos(deg * DEG)
const asinD = (x: number) => Math.asin(clamp(x, -1, 1)) * RAD
const acosD = (x: number) => Math.acos(clamp(x, -1, 1)) * RAD

/**
 * Table 47.A. Each row is the multiple of D, M, M' and F, then the coefficient
 * of the sine term in longitude (units of 1e-6 degrees) and of the cosine term
 * in distance (units of 1e-3 km).
 */
const TERMS_LR = [
  0, 0, 1, 0, 6288774, -20905355,
  2, 0, -1, 0, 1274027, -3699111,
  2, 0, 0, 0, 658314, -2955968,
  0, 0, 2, 0, 213618, -569925,
  0, 1, 0, 0, -185116, 48888,
  0, 0, 0, 2, -114332, -3149,
  2, 0, -2, 0, 58793, 246158,
  2, -1, -1, 0, 57066, -152138,
  2, 0, 1, 0, 53322, -170733,
  2, -1, 0, 0, 45758, -204586,
  0, 1, -1, 0, -40923, -129620,
  1, 0, 0, 0, -34720, 108743,
  0, 1, 1, 0, -30383, 104755,
  2, 0, 0, -2, 15327, 10321,
  0, 0, 1, 2, -12528, 0,
  0, 0, 1, -2, 10980, 79661,
  4, 0, -1, 0, 10675, -34782,
  0, 0, 3, 0, 10034, -23210,
  4, 0, -2, 0, 8548, -21636,
  2, 1, -1, 0, -7888, 24208,
  2, 1, 0, 0, -6766, 30824,
  1, 0, -1, 0, -5163, -8379,
  1, 1, 0, 0, 4987, -16675,
  2, -1, 1, 0, 4036, -12831,
  2, 0, 2, 0, 3994, -10445,
  4, 0, 0, 0, 3861, -11650,
  2, 0, -3, 0, 3665, 14403,
  0, 1, -2, 0, -2689, -7003,
  2, 0, -1, 2, -2602, 0,
  2, -1, -2, 0, 2390, 10056,
  1, 0, 1, 0, -2348, 6322,
  2, -2, 0, 0, 2236, -9884,
  0, 1, 2, 0, -2120, 5751,
  0, 2, 0, 0, -2069, 0,
  2, -2, -1, 0, 2048, -4950,
  2, 0, 1, -2, -1773, 4130,
  2, 0, 0, 2, -1595, 0,
  4, -1, -1, 0, 1215, -3958,
  0, 0, 2, 2, -1110, 0,
  3, 0, -1, 0, -892, 3258,
  2, 1, 1, 0, -810, 2616,
  4, -1, -2, 0, 759, -1897,
  0, 2, -1, 0, -713, -2117,
  2, 2, -1, 0, -700, 2354,
  2, 1, -2, 0, 691, 0,
  2, -1, 0, -2, 596, 0,
  4, 0, 1, 0, 549, -1423,
  0, 0, 4, 0, 537, -1117,
  4, -1, 0, 0, 520, -1571,
  1, 0, -2, 0, -487, -1739,
  2, 1, 0, -2, -399, 0,
  0, 0, 2, -2, -381, -4421,
  1, 1, 1, 0, 351, 0,
  3, 0, -2, 0, -340, 0,
  4, 0, -3, 0, 330, 0,
  2, -1, 2, 0, 327, 0,
  0, 2, 1, 0, -323, 1165,
  1, 1, -1, 0, 299, 0,
  2, 0, 3, 0, 294, 0,
  2, 0, -1, -2, 0, 8752,
]

/** Table 47.B: the same arguments, with the coefficient in latitude. */
const TERMS_B = [
  0, 0, 0, 1, 5128122,
  0, 0, 1, 1, 280602,
  0, 0, 1, -1, 277693,
  2, 0, 0, -1, 173237,
  2, 0, -1, 1, 55413,
  2, 0, -1, -1, 46271,
  2, 0, 0, 1, 32573,
  0, 0, 2, 1, 17198,
  2, 0, 1, -1, 9266,
  0, 0, 2, -1, 8822,
  2, -1, 0, -1, 8216,
  2, 0, -2, -1, 4324,
  2, 0, 1, 1, 4200,
  2, 1, 0, -1, -3359,
  2, -1, -1, 1, 2463,
  2, -1, 0, 1, 2211,
  2, -1, -1, -1, 2065,
  0, 1, -1, -1, -1870,
  4, 0, -1, -1, 1828,
  0, 1, 0, 1, -1794,
  0, 0, 0, 3, -1749,
  0, 1, -1, 1, -1565,
  1, 0, 0, 1, -1491,
  0, 1, 1, 1, -1475,
  0, 1, 1, -1, -1410,
  0, 1, 0, -1, -1344,
  1, 0, 0, -1, -1335,
  0, 0, 3, 1, 1107,
  4, 0, 0, -1, 1021,
  4, 0, -1, 1, 833,
  0, 0, 1, -3, 777,
  4, 0, -2, 1, 671,
  2, 0, 0, -3, 607,
  2, 0, 2, -1, 596,
  2, -1, 1, -1, 491,
  2, 0, -2, 1, -451,
  0, 0, 3, -1, 439,
  2, 0, 2, 1, 422,
  2, 0, -3, -1, 421,
  2, 1, -1, 1, -366,
  2, 1, 0, 1, -351,
  4, 0, 0, 1, 331,
  2, -1, 1, 1, 315,
  2, -2, 0, -1, 302,
  0, 0, 1, 3, -283,
  2, 1, 1, -1, -229,
  1, 1, 0, -1, 223,
  1, 1, 0, 1, 223,
  0, 1, -2, -1, -220,
  2, 1, -1, -1, -220,
  1, 0, 1, 1, -185,
  2, -1, -2, -1, 181,
  0, 1, 2, 1, -177,
  4, 0, -2, -1, 176,
  4, -1, -1, -1, 166,
  1, 0, 1, -1, -164,
  4, 0, 1, -1, 132,
  1, 0, -1, -1, -119,
  4, -1, 0, -1, 115,
  2, -2, 0, 1, 107,
]

/** Equatorial radius of the Earth, kilometres, for the horizontal parallax. */
const EARTH_RADIUS_KM = 6378.14

export interface MoonState {
  /** Epoch milliseconds this state was computed for. */
  readonly time: number
  /** Apparent geocentric ecliptic longitude, degrees. */
  readonly apparentLongitude: number
  /** Geocentric ecliptic latitude, degrees. */
  readonly eclipticLatitude: number
  /** Apparent right ascension, degrees. */
  readonly rightAscension: number
  /** Declination, degrees north. Equals the sublunar latitude. */
  readonly declination: number
  /** Earth to Moon distance, centre to centre, kilometres. */
  readonly distanceKm: number
  /** Equatorial horizontal parallax, degrees. */
  readonly parallax: number
  /** Apparent angular radius of the lunar disc, degrees. */
  readonly angularRadius: number
  /** Longitude where the Moon is overhead, degrees east, in (-180, 180]. */
  readonly sublunarLon: number
  /** Latitude where the Moon is overhead. Same value as the declination. */
  readonly sublunarLat: number
}

/**
 * Greenwich mean sidereal time, degrees, from Meeus 12.4.
 *
 * This one takes universal time and not dynamical time, which is the whole
 * subtlety of the pair: where the Moon *is* depends on dynamical time, and which
 * face of the Earth is turned toward it depends on the Earth's rotation. Mixing
 * the two would smear the sublunar point east by a quarter of a kilometre for
 * every second of delta T.
 */
export function siderealTime(utcMs: number): number {
  const jd = julianDay(utcMs)
  const t = julianCentury(jd)
  return wrap360(
    280.46061837 + 360.98564736629 * (jd - 2451545) + t * t * (0.000387933 - t / 38710000),
  )
}

/**
 * Where the Moon is, for an instant.
 *
 * Delta T is applied here where it is not for the Sun, and for a reason: the
 * Moon covers half an arcsecond of sky per second of time, so the seventy odd
 * seconds between UTC and dynamical time move it by about forty arcseconds. On
 * the ground that is a kilometre of sublunar point, which no map will show, but
 * it costs one addition to be right about it.
 */
export function moonState(time: number | Date): MoonState {
  const utcMs = typeof time === 'number' ? time : time.getTime()
  const t = julianCentury(julianDay(utcMs + DELTA_T_SECONDS * 1000))

  // Mean elements, Meeus 47.1 to 47.6.
  const lPrime = wrap360(
    218.3164477 +
      t * (481267.88123421 - t * (0.0015786 - t * (1 / 538841 - t / 65194000))),
  )
  const d = wrap360(297.8501921 + t * (445267.1114034 - t * (0.0018819 - t * (1 / 545868 - t / 113065000))))
  const m = wrap360(357.5291092 + t * (35999.0502909 - t * (0.0001536 - t / 24490000)))
  const mPrime = wrap360(
    134.9633964 + t * (477198.8675055 + t * (0.0087414 + t * (1 / 69699 - t / 14712000))),
  )
  const f = wrap360(93.272095 + t * (483202.0175233 - t * (0.0036539 + t * (1 / 3526000 - t / 863310000))))

  const a1 = wrap360(119.75 + 131.849 * t)
  const a2 = wrap360(53.09 + 479264.29 * t)
  const a3 = wrap360(313.45 + 481266.484 * t)

  // The Sun's eccentricity correction, applied once per power of M, because the
  // terms that depend on the Sun's anomaly shrink as the Earth's orbit does.
  const e = 1 - t * (0.002516 + 0.0000074 * t)
  const eSquared = e * e

  let sumL = 0
  let sumR = 0
  for (let i = 0; i < TERMS_LR.length; i += 6) {
    const argument =
      TERMS_LR[i]! * d + TERMS_LR[i + 1]! * m + TERMS_LR[i + 2]! * mPrime + TERMS_LR[i + 3]! * f
    const damping = TERMS_LR[i + 1]! === 0 ? 1 : Math.abs(TERMS_LR[i + 1]!) === 1 ? e : eSquared
    sumL += TERMS_LR[i + 4]! * sinD(argument) * damping
    sumR += TERMS_LR[i + 5]! * cosD(argument) * damping
  }

  let sumB = 0
  for (let i = 0; i < TERMS_B.length; i += 5) {
    const argument =
      TERMS_B[i]! * d + TERMS_B[i + 1]! * m + TERMS_B[i + 2]! * mPrime + TERMS_B[i + 3]! * f
    const damping = TERMS_B[i + 1]! === 0 ? 1 : Math.abs(TERMS_B[i + 1]!) === 1 ? e : eSquared
    sumB += TERMS_B[i + 4]! * sinD(argument) * damping
  }

  // Additive terms for Venus, Jupiter and the flattening of the Earth.
  sumL += 3958 * sinD(a1) + 1962 * sinD(lPrime - f) + 318 * sinD(a2)
  sumB +=
    -2235 * sinD(lPrime) +
    382 * sinD(a3) +
    175 * sinD(a1 - f) +
    175 * sinD(a1 + f) +
    127 * sinD(lPrime - mPrime) -
    115 * sinD(lPrime + mPrime)

  const longitude = lPrime + sumL / 1e6
  const eclipticLatitude = sumB / 1e6
  const distanceKm = 385000.56 + sumR / 1000

  // The dominant nutation term, matching the treatment the Sun gets.
  const omega = 125.04452 - 1934.136261 * t
  const nutation = (-17.2 * sinD(omega)) / 3600
  const apparentLongitude = longitude + nutation

  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + (9.2 * cosD(omega)) / 3600

  const rightAscension = wrap360(
    Math.atan2(
      sinD(apparentLongitude) * cosD(obliquity) - Math.tan(eclipticLatitude * DEG) * sinD(obliquity),
      cosD(apparentLongitude),
    ) * RAD,
  )
  const declination = asinD(
    sinD(eclipticLatitude) * cosD(obliquity) +
      cosD(eclipticLatitude) * sinD(obliquity) * sinD(apparentLongitude),
  )

  const parallax = asinD(EARTH_RADIUS_KM / distanceKm)

  return {
    time: utcMs,
    apparentLongitude,
    eclipticLatitude,
    rightAscension,
    declination,
    distanceKm,
    parallax,
    // The Moon's radius is 0.2725 of the Earth's, which is where this ratio
    // comes from; it is the same relation the standard altitude below uses.
    angularRadius: asinD((0.2725 * EARTH_RADIUS_KM) / distanceKm),
    sublunarLon: wrapLon(rightAscension - siderealTime(utcMs)),
    sublunarLat: declination,
  }
}

/** Geometric elevation of the Moon's centre, degrees, ignoring refraction. */
export function moonElevationAt(lat: number, lon: number, state: MoonState): number {
  const hourAngle = wrapLon(lon - state.sublunarLon)
  return asinD(
    sinD(lat) * sinD(state.declination) + cosD(lat) * cosD(state.declination) * cosD(hourAngle),
  )
}

export interface LocalMoon {
  readonly elevation: number
  readonly azimuth: number
}

/** Where the Moon is in the sky, as seen from one point on the ground. */
export function localMoon(lat: number, lon: number, state: MoonState): LocalMoon {
  const hourAngle = wrapLon(lon - state.sublunarLon)
  const decl = state.declination
  return {
    elevation: moonElevationAt(lat, lon, state),
    azimuth: wrap360(
      Math.atan2(
        sinD(hourAngle),
        cosD(hourAngle) * sinD(lat) - Math.tan(decl * DEG) * cosD(lat),
      ) * RAD + 180,
    ),
  }
}

export interface MoonPhase {
  /** Elongation from the Sun along the ecliptic, degrees: 0 new, 180 full. */
  readonly age: number
  /** Fraction of the disc that is lit, 0 to 1. */
  readonly illumination: number
  /** Phase angle Sun-Moon-Earth, degrees. */
  readonly phaseAngle: number
  /** True between new and full, when the lit limb grows. */
  readonly waxing: boolean
  readonly name: string
  /** Days since the last new moon, on the mean synodic month. */
  readonly ageDays: number
}

const SYNODIC_MONTH_DAYS = 29.530588853

/**
 * The phase, from the geometry rather than from a calendar.
 *
 * The illuminated fraction is Meeus 48.1, which needs the true elongation
 * between the two bodies and both distances; the name is read off the elongation
 * in longitude, which is what decides whether the lit limb is growing.
 */
export function moonPhase(sun: SolarState, moon: MoonState): MoonPhase {
  // Elongation of the Moon from the Sun as seen from the Earth.
  const elongation = acosD(
    sinD(sun.declination) * sinD(moon.declination) +
      cosD(sun.declination) * cosD(moon.declination) * cosD(sun.rightAscension - moon.rightAscension),
  )
  const sunDistanceKm = sun.distanceAu * 149597870.7
  const phaseAngle = wrap360(
    Math.atan2(
      sunDistanceKm * sinD(elongation),
      moon.distanceKm - sunDistanceKm * cosD(elongation),
    ) * RAD,
  )
  const illumination = (1 + cosD(phaseAngle)) / 2

  // Difference in apparent ecliptic longitude: 0 at new, 180 at full, and it
  // runs forward through the month, so it also gives the waxing side.
  const age = wrap360(moon.apparentLongitude - sun.apparentLongitude)
  const waxing = age < 180

  let name = 'New moon'
  if (age >= 348.75 || age < 11.25) name = 'New moon'
  else if (age < 78.75) name = 'Waxing crescent'
  else if (age < 101.25) name = 'First quarter'
  else if (age < 168.75) name = 'Waxing gibbous'
  else if (age < 191.25) name = 'Full moon'
  else if (age < 258.75) name = 'Waning gibbous'
  else if (age < 281.25) name = 'Last quarter'
  else name = 'Waning crescent'

  return { age, illumination, phaseAngle, waxing, name, ageDays: (age / 360) * SYNODIC_MONTH_DAYS }
}

export interface MoonEvents {
  readonly moonrise: number | null
  readonly moonset: number | null
  /** Set when the Moon does not rise or does not set within the day. */
  readonly circumstance: 'up' | 'down' | null
}

/** How finely the day is sampled when hunting for rise and set, in minutes. */
const SCAN_STEP_MINUTES = 10

/**
 * Moonrise and moonset for the UTC day containing an instant.
 *
 * Scanned and bisected exactly as the solar events are, for the same reason:
 * iteration on a closed form fails at high latitude, and the Moon makes that
 * worse rather than better because its declination can move a degree in a day.
 * The standard altitude is Meeus's: the Moon's centre sits below the horizon at
 * the moment its upper limb appears, by its own semidiameter less the parallax
 * that lifts it and plus the refraction that lifts it further.
 */
export function moonEvents(lat: number, lon: number, time: number | Date): MoonEvents {
  const ms = typeof time === 'number' ? time : time.getTime()
  const dayStart = Math.floor(ms / MS_PER_DAY) * MS_PER_DAY
  const step = SCAN_STEP_MINUTES * MS_PER_MINUTE
  const count = Math.round(MS_PER_DAY / step) + 1

  const standardAltitude = (state: MoonState) => 0.7275 * state.parallax - 0.5667
  const height = (t: number) => {
    const state = moonState(t)
    return moonElevationAt(lat, lon, state) - standardAltitude(state)
  }

  const samples = new Float64Array(count)
  for (let i = 0; i < count; i++) samples[i] = height(dayStart + i * step)

  const bisect = (lo: number, hi: number): number => {
    let a = lo
    let b = hi
    for (let i = 0; i < 40; i++) {
      const mid = (a + b) / 2
      if (height(a) * height(mid) <= 0) b = mid
      else a = mid
    }
    return (a + b) / 2
  }

  let moonrise: number | null = null
  let moonset: number | null = null
  for (let i = 0; i + 1 < count; i++) {
    const before = samples[i]!
    const after = samples[i + 1]!
    if (before === 0 || before * after > 0) continue
    const crossing = bisect(dayStart + i * step, dayStart + (i + 1) * step)
    if (before < 0 && moonrise === null) moonrise = crossing
    if (before > 0 && moonset === null) moonset = crossing
  }

  const circumstance =
    moonrise === null && moonset === null ? (samples[0]! > 0 ? 'up' : 'down') : null
  return { moonrise, moonset, circumstance }
}

/**
 * How much light the Moon actually puts on the ground, relative to a full moon
 * at the zenith at mean distance.
 *
 * Three effects, all of them real and all of them large. The illuminated
 * fraction is not the brightness: the Moon opposition surge means a full moon is
 * some ten times a half moon rather than twice it, which is the exponential
 * here, fitted to the standard visual magnitude curve. Brightness then falls
 * with the sine of the altitude, as any light on a surface does. And the
 * distance varies enough over a month to change the illumination by a third.
 *
 * The result is a number near 1 for a full moon overhead and near 0 for anything
 * else, which is what the renderer wants: full moonlight is about a quarter of a
 * lux, some four hundred thousand times weaker than daylight, so it only ever
 * shows on ground the Sun has already left.
 */
export function moonlight(elevationDeg: number, phase: MoonPhase, distanceKm: number): number {
  if (elevationDeg <= 0) return 0
  const surge = Math.exp(-3.05 * (1 - phase.illumination) ** 0.9)
  const height = Math.sin(elevationDeg * DEG)
  const distance = (385000.56 / distanceKm) ** 2
  return surge * height * distance
}
