/**
 * Solar geometry, following the NOAA Solar Calculator (Earth System Research
 * Laboratory) which is itself a condensation of Meeus, Astronomical Algorithms.
 *
 * Accuracy: solar position to roughly 0.01 degrees and sunrise/sunset to about a
 * minute for years 1901 to 2099, which is far tighter than a world map can show.
 *
 * Conventions used throughout: longitude is east positive, latitude is north
 * positive, angles are degrees at the boundary and radians only inside a
 * calculation, and every instant is an epoch millisecond count in UTC.
 */

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

const sinD = (deg: number) => Math.sin(deg * DEG)
const cosD = (deg: number) => Math.cos(deg * DEG)
const tanD = (deg: number) => Math.tan(deg * DEG)
const asinD = (x: number) => Math.asin(clamp(x, -1, 1)) * RAD
const acosD = (x: number) => Math.acos(clamp(x, -1, 1)) * RAD

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Wrap to [0, 360). */
export function wrap360(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

/** Wrap to (-180, 180]. */
export function wrapLon(deg: number): number {
  const r = wrap360(deg)
  return r > 180 ? r - 360 : r
}

/** Julian Day, including the fractional day, from epoch milliseconds. */
export function julianDay(ms: number): number {
  return ms / MS_PER_DAY + 2440587.5
}

export function fromJulianDay(jd: number): number {
  return (jd - 2440587.5) * MS_PER_DAY
}

/** Julian centuries since J2000.0. */
export function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525
}

/**
 * Everything about the Sun that does not depend on where you are standing.
 * One of these covers the whole map for a single instant, which is why the
 * renderer only needs two uniforms to draw the terminator.
 */
export interface SolarState {
  /** Epoch milliseconds this state was computed for. */
  readonly time: number
  /** Julian centuries since J2000.0. */
  readonly century: number
  /** Declination of the Sun, degrees north. Equals the subsolar latitude. */
  readonly declination: number
  /** Equation of time, minutes. Apparent solar time minus mean solar time. */
  readonly equationOfTime: number
  /** Longitude where the Sun is directly overhead, degrees east, in (-180, 180]. */
  readonly subsolarLon: number
  /** Latitude where the Sun is directly overhead. Same value as declination. */
  readonly subsolarLat: number
  /** Apparent right ascension, degrees. */
  readonly rightAscension: number
  /** Apparent ecliptic longitude of the Sun, degrees. */
  readonly apparentLongitude: number
  /** Earth to Sun distance, astronomical units. */
  readonly distanceAu: number
  /** Apparent angular radius of the solar disc, degrees. */
  readonly angularRadius: number
}

/** Solar state for an instant. This is the hot path; keep it allocation light. */
export function solarState(time: number | Date): SolarState {
  const ms = typeof time === 'number' ? time : time.getTime()
  const jd = julianDay(ms)
  const t = julianCentury(jd)

  // Geometric mean longitude and mean anomaly of the Sun.
  const meanLongitude = wrap360(280.46646 + t * (36000.76983 + t * 0.0003032))
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t)

  // Orbital eccentricity and the equation of centre that turns the mean anomaly
  // into the true anomaly.
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const centre =
    sinD(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sinD(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sinD(3 * meanAnomaly) * 0.000289

  const trueLongitude = meanLongitude + centre
  const trueAnomaly = meanAnomaly + centre
  const distanceAu = (1.000001018 * (1 - eccentricity * eccentricity)) / (1 + eccentricity * cosD(trueAnomaly))

  // Aberration and the dominant nutation term give the apparent longitude.
  const omega = 125.04 - 1934.136 * t
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * sinD(omega)

  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + 0.00256 * cosD(omega)

  const declination = asinD(sinD(obliquity) * sinD(apparentLongitude))
  const rightAscension = wrap360(
    Math.atan2(cosD(obliquity) * sinD(apparentLongitude), cosD(apparentLongitude)) * RAD,
  )

  // Equation of time, in minutes, from the NOAA closed form.
  const y = tanD(obliquity / 2) ** 2
  const equationOfTime =
    4 *
    RAD *
    (y * sinD(2 * meanLongitude) -
      2 * eccentricity * sinD(meanAnomaly) +
      4 * eccentricity * y * sinD(meanAnomaly) * cosD(2 * meanLongitude) -
      0.5 * y * y * sinD(4 * meanLongitude) -
      1.25 * eccentricity * eccentricity * sinD(2 * meanAnomaly))

  // The subsolar meridian is where apparent solar time reads exactly noon.
  // One minute of the equation of time is a quarter degree of longitude.
  const utcMinutes = (((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) / MS_PER_MINUTE
  const subsolarLon = wrapLon(180 - utcMinutes / 4 - equationOfTime / 4)

  return {
    time: ms,
    century: t,
    declination,
    equationOfTime,
    subsolarLon,
    subsolarLat: declination,
    rightAscension,
    apparentLongitude: wrap360(apparentLongitude),
    distanceAu,
    // The Sun subtends 0.2666 degrees at 1 AU, so the radius scales inversely.
    angularRadius: 0.266563888 / distanceAu,
  }
}

/**
 * Geometric solar elevation, degrees above the horizon, ignoring refraction.
 * This is the quantity the twilight shader colours by, so it is also written out
 * in GLSL in the renderer; keep the two in step.
 */
export function elevationAt(lat: number, lon: number, state: SolarState): number {
  const hourAngle = wrapLon(lon - state.subsolarLon)
  const sinElevation =
    sinD(lat) * sinD(state.declination) + cosD(lat) * cosD(state.declination) * cosD(hourAngle)
  return asinD(sinElevation)
}

/**
 * How much the atmosphere lifts an object near the horizon, in degrees.
 * NOAA's piecewise fit, which behaves sensibly all the way down to -5 degrees.
 */
export function refraction(elevation: number): number {
  if (elevation > 85) return 0
  const te = tanD(elevation)
  let arcseconds: number
  if (elevation > 5) {
    arcseconds = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5
  } else if (elevation > -0.575) {
    arcseconds = 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)))
  } else {
    arcseconds = -20.772 / te
  }
  return arcseconds / 3600
}

export interface LocalSolar {
  /** Geometric elevation of the centre of the Sun, degrees. */
  readonly elevation: number
  /** Elevation once atmospheric refraction is added, degrees. */
  readonly apparentElevation: number
  /** Compass bearing of the Sun, degrees clockwise from true north. */
  readonly azimuth: number
  /** Hour angle, degrees. Negative before local apparent noon. */
  readonly hourAngle: number
  /** Apparent solar time, hours in [0, 24). Noon means the Sun is on the meridian. */
  readonly trueSolarTime: number
}

/** Where the Sun is in the sky, as seen from one point on the ground. */
export function localSolar(lat: number, lon: number, state: SolarState): LocalSolar {
  const hourAngle = wrapLon(lon - state.subsolarLon)
  const decl = state.declination
  const sinElevation = sinD(lat) * sinD(decl) + cosD(lat) * cosD(decl) * cosD(hourAngle)
  const elevation = asinD(sinElevation)

  // Azimuth from true north, clockwise. The atan2 form needs no quadrant branch
  // and no guard against dividing by zero near the zenith, and it agrees with
  // NOAA's arccosine version everywhere.
  const azimuth = wrap360(
    Math.atan2(sinD(hourAngle), cosD(hourAngle) * sinD(lat) - tanD(decl) * cosD(lat)) * RAD + 180,
  )

  return {
    elevation,
    apparentElevation: elevation + refraction(elevation),
    azimuth,
    hourAngle,
    trueSolarTime: wrap360(hourAngle + 180) / 15,
  }
}

/** Standard altitudes, in degrees, for the events the app draws and reports. */
export const HORIZON = {
  /** Upper limb of the Sun on the horizon, allowing for mean refraction. */
  sunrise: -0.833,
  civil: -6,
  nautical: -12,
  astronomical: -18,
} as const

export type HorizonName = keyof typeof HORIZON

/** How finely the solar day is sampled when hunting for rise and set, in minutes. */
const SCAN_STEP_MINUTES = 10

/** UTC minutes past midnight at which the Sun crosses the meridian. */
function solarNoonMinutes(lon: number, dayStartMs: number): number {
  // Two passes: guess noon, evaluate the equation of time there, correct.
  let minutes = 720 - 4 * lon
  for (let i = 0; i < 2; i++) {
    const eot = solarState(dayStartMs + minutes * MS_PER_MINUTE).equationOfTime
    minutes = 720 - 4 * lon - eot
  }
  return minutes
}

export interface DayEvents {
  /** Start of the UTC day the solar day was anchored to. */
  readonly dayStart: number
  readonly solarNoon: number
  readonly sunrise: number | null
  readonly sunset: number | null
  readonly civilDawn: number | null
  readonly civilDusk: number | null
  readonly nauticalDawn: number | null
  readonly nauticalDusk: number | null
  readonly astronomicalDawn: number | null
  readonly astronomicalDusk: number | null
  /** Milliseconds between sunrise and sunset. 0 in polar night, a full day in polar day. */
  readonly dayLength: number
  /** Set when the Sun does not rise or does not set on this day. */
  readonly polar: 'day' | 'night' | null
  /** Highest elevation the Sun reaches, degrees. */
  readonly maxElevation: number
  /** Lowest elevation the Sun reaches, degrees. */
  readonly minElevation: number
}

/**
 * Sunrise, sunset and the twilight boundaries for the solar day containing an
 * instant. The day is anchored to the meridian passage nearest that instant, so
 * asking about noon in Auckland gives Auckland's day, not Greenwich's.
 */
export function dayEvents(lat: number, lon: number, time: number | Date): DayEvents {
  const ms = typeof time === 'number' ? time : time.getTime()

  // Pick the UTC day whose solar noon is closest to the instant we were given,
  // so asking about noon in Auckland gives Auckland's day, not Greenwich's.
  let dayStart = Math.floor(ms / MS_PER_DAY) * MS_PER_DAY
  let noonMinutes = solarNoonMinutes(lon, dayStart)
  const offsetDays = Math.round((ms - (dayStart + noonMinutes * MS_PER_MINUTE)) / MS_PER_DAY)
  if (offsetDays !== 0) {
    dayStart += offsetDays * MS_PER_DAY
    noonMinutes = solarNoonMinutes(lon, dayStart)
  }
  const solarNoon = dayStart + noonMinutes * MS_PER_MINUTE

  // Sample the whole solar day, then find every crossing in those samples.
  //
  // The fixed point iteration that NOAA's own calculator uses is not a
  // contraction above about 63 degrees of latitude: at 70 north it can be out by
  // twelve minutes, and running it a third time makes it worse rather than
  // better. Scanning and bisecting has no such failure mode, costs one solar
  // position every ten minutes, and gives the polar cases (no events, or a
  // single event on the day the midnight sun begins) for free.
  const windowStart = solarNoon - MS_PER_DAY / 2
  const step = SCAN_STEP_MINUTES * MS_PER_MINUTE
  const count = Math.round(MS_PER_DAY / step) + 1
  const elevations = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    elevations[i] = elevationAt(lat, lon, solarState(windowStart + i * step))
  }

  const at = (t: number) => elevationAt(lat, lon, solarState(t))

  /** Refine a bracketed crossing to about a hundredth of a second. */
  const bisect = (lo: number, hi: number, altitude: number): number => {
    let below = at(lo) < altitude
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (at(mid) < altitude === below) lo = mid
      else hi = mid
    }
    return Math.round((lo + hi) / 2)
  }

  const find = (altitude: number, rising: boolean): number | null => {
    for (let i = 0; i + 1 < count; i++) {
      const a = elevations[i]! - altitude
      const b = elevations[i + 1]! - altitude
      if (a < 0 === b < 0) continue
      if (b > a !== rising) continue
      return bisect(windowStart + i * step, windowStart + (i + 1) * step, altitude)
    }
    return null
  }

  let maxElevation = -Infinity
  let minElevation = Infinity
  for (let i = 0; i < count; i++) {
    const e = elevations[i]!
    if (e > maxElevation) maxElevation = e
    if (e < minElevation) minElevation = e
  }
  maxElevation = Math.max(maxElevation, elevationAt(lat, lon, solarState(solarNoon)))

  const sunrise = find(HORIZON.sunrise, true)
  const sunset = find(HORIZON.sunrise, false)
  const polar: 'day' | 'night' | null =
    sunrise === null && sunset === null ? (maxElevation > HORIZON.sunrise ? 'day' : 'night') : null

  // Day length is the time the Sun actually spends up inside this solar day, so
  // it stays right on the one event days at the edge of the midnight sun.
  let dayLength: number
  if (sunrise !== null && sunset !== null) dayLength = sunset - sunrise
  else if (sunrise !== null) dayLength = windowStart + MS_PER_DAY - sunrise
  else if (sunset !== null) dayLength = sunset - windowStart
  else dayLength = polar === 'day' ? MS_PER_DAY : 0

  return {
    dayStart,
    solarNoon,
    sunrise,
    sunset,
    civilDawn: find(HORIZON.civil, true),
    civilDusk: find(HORIZON.civil, false),
    nauticalDawn: find(HORIZON.nautical, true),
    nauticalDusk: find(HORIZON.nautical, false),
    astronomicalDawn: find(HORIZON.astronomical, true),
    astronomicalDusk: find(HORIZON.astronomical, false),
    dayLength,
    polar,
    maxElevation,
    minElevation,
  }
}

/**
 * Fraction of the globe in daylight at an instant. Depends only on declination:
 * the terminator is a great circle tilted by the declination, so the lit
 * fraction is always one half. What varies is how that half is distributed, so
 * this reports the area lit above the horizon including refraction instead.
 */
export function sunlitFraction(state: SolarState): number {
  // Integrate cos(lat) over the lit longitudes at each latitude band.
  const decl = state.declination
  const alt = HORIZON.sunrise
  let lit = 0
  let total = 0
  const bands = 900
  for (let i = 0; i < bands; i++) {
    const lat = -90 + ((i + 0.5) / bands) * 180
    const weight = cosD(lat)
    total += weight
    const cosH = (sinD(alt) - sinD(lat) * sinD(decl)) / (cosD(lat) * cosD(decl))
    if (cosH <= -1) lit += weight
    else if (cosH < 1) lit += weight * (acosD(cosH) / 180)
  }
  return lit / total
}

/**
 * The analemma: where the Sun stands overhead at the same clock time each day
 * across a year. Returns one point per sample in the order the year runs.
 */
export function analemma(year: number, utcHour = 12, samples = 365): Array<{ lon: number; lat: number; time: number }> {
  const start = Date.UTC(year, 0, 1, 0, 0, 0)
  const end = Date.UTC(year + 1, 0, 1, 0, 0, 0)
  const span = end - start
  const points: Array<{ lon: number; lat: number; time: number }> = []
  for (let i = 0; i < samples; i++) {
    const dayStart = start + Math.round((i / samples) * (span / MS_PER_DAY)) * MS_PER_DAY
    const t = dayStart + utcHour * MS_PER_HOUR
    const state = solarState(t)
    points.push({ lon: state.subsolarLon, lat: state.subsolarLat, time: t })
  }
  return points
}

/**
 * Difference between Terrestrial Time and UT, in seconds.
 *
 * Measured at 69.1 s across 2025 and 2026 in the USNO's own series
 * (https://maia.usno.navy.mil/ser7/deltat.data). It drifts by roughly a second
 * per decade at the moment, which is far below the resolution of anything this
 * value is used for here. It matters only for the season instants; the
 * terminator itself is unaffected, because feeding UTC straight into the solar
 * position moves the subsolar point by about one arcsecond.
 */
const DELTA_T_SECONDS = 69.1

/** Table 27.B of Meeus: a first approximation to each event, in Julian Ephemeris Days. */
const SEASON_MEAN: Record<0 | 90 | 180 | 270, readonly number[]> = {
  0: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  90: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  180: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  270: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
}

/** Table 27.C of Meeus: the periodic correction, as triples of A, B and C. */
const SEASON_PERIODIC: readonly number[] = [
  485, 324.96, 1934.136, 203, 337.23, 32964.467, 199, 342.08, 20.186,
  182, 27.85, 445267.112, 156, 73.14, 45036.886, 136, 171.52, 22518.443,
  77, 222.54, 65928.934, 74, 296.72, 3034.906, 70, 243.58, 9037.513,
  58, 119.81, 33718.147, 52, 297.17, 150.678, 50, 21.02, 2281.226,
  45, 247.54, 29929.562, 44, 325.15, 31555.956, 29, 60.93, 4443.417,
  18, 155.12, 67555.328, 17, 288.79, 4562.452, 16, 198.04, 62894.029,
  14, 199.76, 31436.921, 12, 95.39, 14577.848, 12, 287.11, 31931.756,
  12, 320.81, 34777.259, 9, 227.73, 1222.114, 8, 15.45, 16859.074,
]

/**
 * Instant of an equinox or a solstice, given as the apparent solar longitude it
 * corresponds to: 0 for the March equinox, 90 for the June solstice, 180 for
 * September, 270 for December.
 *
 * This uses Meeus chapter 27 rather than root finding on the solar position
 * above. The low accuracy series is good to about 0.01 degrees of longitude,
 * which is fine for a map but is a quarter of an hour of time near an equinox,
 * so searching it for the crossing gives an answer that is visibly wrong. Meeus
 * 27 reproduces the US Naval Observatory's published instants to within 40
 * seconds for the current era.
 */
export function seasonInstant(year: number, target: 0 | 90 | 180 | 270): number {
  const y = (year - 2000) / 1000
  const mean = SEASON_MEAN[target]
  let jde0 = 0
  for (let power = 0; power < mean.length; power++) jde0 += mean[power]! * Math.pow(y, power)

  const t = (jde0 - 2451545.0) / 36525
  const w = 35999.373 * t - 2.47
  const lambda = 1 + 0.0334 * cosD(w) + 0.0007 * cosD(2 * w)

  let s = 0
  for (let i = 0; i < SEASON_PERIODIC.length; i += 3) {
    s += SEASON_PERIODIC[i]! * cosD(SEASON_PERIODIC[i + 1]! + SEASON_PERIODIC[i + 2]! * t)
  }

  const jde = jde0 + (0.00001 * s) / lambda
  return Math.round(fromJulianDay(jde) - DELTA_T_SECONDS * 1000)
}
