/**
 * Tests for src/solar/solar.ts against the verified vectors in
 * docs/research/solar-math.md (referred to as TV-xx below). Every expected
 * number comes from that document unless a comment says otherwise, and every
 * tolerance states its reason, usually the document's own tolerance rationale:
 * roughly three times the worst disagreement observed against USNO, VSOP87 or
 * the published Meeus worked examples.
 */
import { describe, expect, test } from 'vitest'
import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  analemma,
  dayEvents,
  elevationAt,
  fromJulianDay,
  julianDay,
  localSolar,
  refraction,
  seasonInstant,
  solarState,
  sunlitFraction,
  wrap360,
  wrapLon,
} from '../src/solar/solar.ts'

const utc = (iso: string) => Date.parse(iso)

const expectNear = (actual: number, expected: number, tol: number, label = '') => {
  const diff = actual - expected
  expect(Math.abs(diff), `${label} expected ${actual} within ${tol} of ${expected}, off by ${diff}`).toBeLessThanOrEqual(tol)
}

/** Assert an event time (epoch ms) lands within tolSeconds of an ISO instant. */
const expectTime = (actual: number | null, expectedIso: string, tolSeconds: number, label = '') => {
  expect(actual, `${label} expected an event near ${expectedIso}, got null`).not.toBeNull()
  const diff = ((actual as number) - utc(expectedIso)) / 1000
  expect(Math.abs(diff), `${label} off ${expectedIso} by ${diff.toFixed(1)} s`).toBeLessThanOrEqual(tolSeconds)
}

const OSLO = { lat: 59.9139, lon: 10.7522 }
const QUITO = { lat: -0.1807, lon: -78.4678 }
const SYDNEY = { lat: -33.8688, lon: 151.2093 }
const REYKJAVIK = { lat: 64.1466, lon: -21.9426 }
const USHUAIA = { lat: -54.8019, lon: -68.303 }
const LONDON = { lat: 51.5074, lon: -0.1278 }
const AUCKLAND = { lat: -36.8485, lon: 174.7633 }
const TROMSO = { lat: 69.6492, lon: 18.9553 }

describe('wrap360 and wrapLon', () => {
  // Pure integer arithmetic on exactly representable doubles, so exact matches.
  test('wrap360 maps into [0, 360)', () => {
    expect(wrap360(0)).toBe(0)
    expect(wrap360(359.5)).toBe(359.5)
    expect(wrap360(370)).toBe(10)
    expect(wrap360(725)).toBe(5)
    expect(wrap360(-1)).toBe(359)
    expect(wrap360(-190)).toBe(170)
  })

  test('wrapLon maps into (-180, 180]', () => {
    expect(wrapLon(0)).toBe(0)
    expect(wrapLon(180)).toBe(180)
    expect(wrapLon(-180)).toBe(180)
    expect(wrapLon(181)).toBe(-179)
    expect(wrapLon(-181)).toBe(179)
    expect(wrapLon(540)).toBe(180)
    expect(wrapLon(190)).toBe(-170)
  })
})

describe('julianDay', () => {
  // The Unix epoch is JD 2440587.5 and J2000.0 is JD 2451545.0 by definition
  // (solar-math.md section 2.2). All inputs are exactly representable and the
  // division is exact for these values, so assert exact equality.
  test('known epochs are exact', () => {
    expect(julianDay(0)).toBe(2440587.5)
    expect(julianDay(Date.UTC(2000, 0, 1, 12))).toBe(2451545.0)
    expect(julianDay(Date.UTC(2025, 5, 21, 12))).toBe(2460848)
  })

  test('fromJulianDay round trips', () => {
    // One float64 ULP at JD 2.46e6 is about 40 microseconds of time, and the
    // round trip crosses that representation twice, so anything below a few
    // ULPs is unreachable. 0.1 ms is two and a half ULPs and still far finer
    // than the second the interface ever displays.
    const ms = Date.UTC(2025, 5, 21, 7, 31, 12, 345)
    expectNear(fromJulianDay(julianDay(ms)), ms, 0.1, 'round trip')
  })
})

describe('solarState: Meeus example 25.a (TV-01)', () => {
  // Input is 1992-10-13T00:00 TD, JDE 2448908.5, fed in directly as a JD so
  // the TD versus UTC distinction does not enter. Tolerances are the ones
  // TV-01 states for each quantity, derived from the digits Meeus prints.
  const state = solarState(fromJulianDay(2448908.5))

  test('julian century', () => {
    expectNear(state.century, -0.072183436, 1e-9, 'T')
  })

  test('apparent longitude', () => {
    expectNear(state.apparentLongitude, 199.90895, 2e-5, 'lambda')
  })

  test('apparent right ascension and declination', () => {
    expectNear(state.rightAscension, 198.38083, 1e-4, 'alpha')
    expectNear(state.declination, -7.78507, 1e-4, 'delta')
  })

  test('radius vector', () => {
    expectNear(state.distanceAu, 0.99766, 1e-5, 'R')
  })
})

describe('solarState: subsolar point vectors (group B)', () => {
  // Tolerances from the group B rationale: worst measured disagreement with
  // USNO was 10.9 arcsec in latitude and 45.8 arcsec in longitude, so 0.005
  // deg for latitude and 0.02 deg for longitude, roughly three times that.
  const vectors: Array<[string, string, number, number]> = [
    ['TV-05 winter', '2025-01-01T00:00:00Z', -22.9982, -179.13938],
    ['TV-06 june solstice', '2025-06-21T02:42:00Z', 23.43834, 139.94329],
    ['TV-07 solstice noon', '2025-06-21T12:00:00Z', 23.43783, 0.46451],
    ['TV-08 march equinox', '2025-03-20T09:01:00Z', -0.00028, 46.59935],
    ['TV-09 september equinox', '2025-09-22T18:19:00Z', -0.0, -96.61371],
    ['TV-10 december solstice', '2025-12-21T15:03:00Z', -23.43824, -46.18804],
    ['TV-11 J2000.0', '2000-01-01T12:00:00Z', -23.03243, 0.82128],
    ['TV-12 year 2030', '2030-03-20T13:52:00Z', -0.00012, -26.14583],
  ]

  for (const [name, iso, lat, lon] of vectors) {
    test(name, () => {
      const s = solarState(utc(iso))
      expectNear(s.subsolarLat, lat, 0.005, `${name} lat`)
      expectNear(s.subsolarLon, lon, 0.02, `${name} lon`)
      // Declination and subsolar latitude are documented as the same quantity.
      expect(s.declination).toBe(s.subsolarLat)
    })
  }
})

describe('solarState: equation of time (group C)', () => {
  // Tolerance 0.15 min: the document's group C figure, chosen as roughly
  // three times the worst measured 3.45 s disagreement with USNO.
  const vectors: Array<[string, string, number]> = [
    ['TV-13 february minimum', '2025-02-11T02:49:41Z', -14.2284],
    ['TV-13 february minimum 2026', '2026-02-11T08:41:52Z', -14.2263],
    ['TV-14 may maximum', '2025-05-13T19:20:54Z', 3.643],
    ['TV-15 july minimum', '2025-07-25T22:32:50Z', -6.5614],
    ['TV-16 november maximum', '2025-11-03T02:20:07Z', 16.4919],
    ['TV-16 november maximum 2026', '2026-11-03T08:12:37Z', 16.4924],
    ['TV-17 april zero crossing', '2025-04-15T12:00:00Z', 0.0348],
    ['TV-17 september zero crossing', '2025-09-01T00:00:00Z', -0.1003],
    ['TV-17 december zero crossing', '2025-12-25T12:00:00Z', -0.1813],
  ]

  for (const [name, iso, minutes] of vectors) {
    test(name, () => {
      expectNear(solarState(utc(iso)).equationOfTime, minutes, 0.15, name)
    })
  }

  test('stays within -14.3 to +16.55 minutes across 2025, and reaches both extremes', () => {
    // Bounds from section 12.1: the annual range is -14.2284 to +16.4918 min.
    // The outer bounds allow the 0.15 min model tolerance; the inner bounds
    // (must dip below -14.1 and above +16.4) prove the extrema are real.
    let min = Infinity
    let max = -Infinity
    for (let d = 0; d < 365; d++) {
      const e = solarState(Date.UTC(2025, 0, 1, 12) + d * MS_PER_DAY).equationOfTime
      min = Math.min(min, e)
      max = Math.max(max, e)
    }
    expect(min).toBeGreaterThanOrEqual(-14.3)
    expect(min).toBeLessThanOrEqual(-14.1)
    expect(max).toBeLessThanOrEqual(16.55)
    expect(max).toBeGreaterThanOrEqual(16.4)
  })
})

describe('solarState: declination over a year', () => {
  test('never exceeds the obliquity, and reaches it at the solstices', () => {
    // The apparent obliquity in this era is about 23.436 deg plus a nutation
    // term of at most 0.0026 deg, so 23.45 is a hard ceiling with margin.
    // Daily sampling lands within half a day of each solstice where the
    // declination curve is flat, so it must also get within 0.02 deg of the
    // extreme (the curve moves under 0.001 deg per day at the solstice).
    let min = Infinity
    let max = -Infinity
    for (let d = 0; d < 365; d++) {
      const dec = solarState(Date.UTC(2025, 0, 1, 12) + d * MS_PER_DAY).declination
      expect(Math.abs(dec)).toBeLessThanOrEqual(23.45)
      min = Math.min(min, dec)
      max = Math.max(max, dec)
    }
    expect(max).toBeGreaterThanOrEqual(23.42)
    expect(min).toBeLessThanOrEqual(-23.42)
  })
})

describe('solarState: subsolar longitude behaviour', () => {
  test('at 12:00 UTC it equals minus a quarter of the equation of time', () => {
    // Algebraic identity of the implementation (utcMinutes is exactly 720 at
    // noon), so the only slack needed is one float rounding step in the wrap.
    for (const iso of ['2025-02-11T12:00:00Z', '2025-06-21T12:00:00Z', '2025-11-03T12:00:00Z', '2026-08-14T12:00:00Z']) {
      const s = solarState(utc(iso))
      expectNear(s.subsolarLon, -s.equationOfTime / 4, 1e-9, iso)
    }
  })

  test('sweeps westward at about 15 degrees per hour, 360 degrees per day', () => {
    const t0 = utc('2025-10-01T00:00:00Z')
    for (let h = 0; h < 24; h++) {
      const a = solarState(t0 + h * MS_PER_HOUR).subsolarLon
      const b = solarState(t0 + (h + 1) * MS_PER_HOUR).subsolarLon
      const step = wrapLon(b - a)
      // 15 deg per hour exactly for the mean sun; the equation of time drifts
      // by at most 0.5 min per day, 0.005 deg per hour, so 0.02 is 4x margin.
      expectNear(step, -15, 0.02, `hour ${h}`)
    }
    const day = wrapLon(solarState(t0 + MS_PER_DAY).subsolarLon - solarState(t0).subsolarLon)
    // After 24 h the mean sun is back; the residual is one day of equation of
    // time drift, at most 0.5 min = 0.125 deg, so 0.15 deg bounds it.
    expectNear(day, 0, 0.15, 'full day')
  })
})

describe('solarState: distance and angular radius', () => {
  test('angular radius is the documented constant over the distance', () => {
    // Exact restatement of the implementation contract, float noise only.
    const s = solarState(utc('2025-04-01T00:00:00Z'))
    expectNear(s.angularRadius, 0.266563888 / s.distanceAu, 1e-12)
  })

  test('perihelion in January, aphelion in July', () => {
    // Perihelion distance is 0.98329 AU and aphelion 1.01671 AU (section 3.1
    // step 7), so early January must be under 0.99 and early July over 1.01.
    const jan = solarState(Date.UTC(2026, 0, 3, 12))
    const jul = solarState(Date.UTC(2025, 6, 3, 12))
    expect(jan.distanceAu).toBeLessThan(0.99)
    expect(jul.distanceAu).toBeGreaterThan(1.01)
    expect(jan.angularRadius).toBeGreaterThan(jul.angularRadius)
  })
})

describe('golden fixture: subsolar point at 12:00 UTC through 2025 (section 12.4)', () => {
  // These rows come from the reference implementation of the same NOAA chain,
  // so agreement should be near float precision; the tolerance only allows for
  // the four decimals the document prints (0.5e-4 rounding, tripled).
  const rows: Array<[string, number, number, number]> = [
    ['2025-01-01', -3.6834, -22.9558, 0.92085],
    ['2025-02-15', -14.107, -12.49235, 3.52675],
    ['2025-05-15', 3.6295, 18.99503, -0.90737],
    ['2025-08-01', -6.3446, 17.87442, 1.58615],
    ['2025-11-01', 16.4743, -14.59822, -4.11858],
    ['2025-12-15', 4.7438, -23.29148, -1.18594],
  ]

  for (const [date, eot, dec, lon] of rows) {
    test(date, () => {
      const s = solarState(utc(`${date}T12:00:00Z`))
      expectNear(s.equationOfTime, eot, 2e-4, 'eot')
      expectNear(s.declination, dec, 2e-4, 'dec')
      expectNear(s.subsolarLon, lon, 2e-4, 'lon')
    })
  }
})

describe('elevationAt and localSolar: city vectors (group E)', () => {
  // Group E tolerances: 0.02 deg (72 arcsec) in elevation and 0.05 deg in
  // azimuth, relaxed to 0.1 deg when the sun is near the zenith where azimuth
  // is geometrically ill conditioned. Expected values are USNO geometric
  // altitude and north based azimuth.
  const vectors: Array<[string, { lat: number; lon: number }, string, number, number, number]> = [
    ['TV-19 Oslo summer morning', OSLO, '2025-06-21T10:00:00Z', 51.00185, 150.55033, 0.05],
    ['TV-20 Oslo winter transit', OSLO, '2025-12-21T11:00:00Z', 6.58999, 176.50113, 0.05],
    ['TV-21 Quito equinox near zenith', QUITO, '2025-03-20T17:00:00Z', 84.69836, 86.63127, 0.1],
    ['TV-22 Quito june afternoon', QUITO, '2025-06-21T17:00:00Z', 66.07338, 8.95104, 0.05],
    ['TV-23 Sydney december noon', SYDNEY, '2025-12-21T02:00:00Z', 79.46084, 351.36553, 0.1],
    ['TV-24 Sydney june morning', SYDNEY, '2025-06-21T01:00:00Z', 31.11522, 15.27395, 0.05],
    ['TV-25 Reykjavik september', REYKJAVIK, '2025-09-22T13:00:00Z', 25.82978, 174.33404, 0.05],
    ['TV-26 Reykjavik june', REYKJAVIK, '2025-06-21T13:00:00Z', 48.9985, 169.61035, 0.05],
  ]

  for (const [name, place, iso, alt, az, azTol] of vectors) {
    test(name, () => {
      const state = solarState(utc(iso))
      const local = localSolar(place.lat, place.lon, state)
      expectNear(local.elevation, alt, 0.02, `${name} elevation`)
      expectNear(local.azimuth, az, azTol, `${name} azimuth`)
      // elevationAt is documented as the same geometric elevation localSolar
      // reports, computed from the same formula, so exact agreement.
      expect(elevationAt(place.lat, place.lon, state)).toBe(local.elevation)
    })
  }

  test('TV-20 refracted elevation at Oslo in December', () => {
    // 6.71801 is NOAA calcRefraction applied to the geometric 6.58999; the
    // 0.02 deg tolerance is the group E elevation tolerance.
    const local = localSolar(OSLO.lat, OSLO.lon, solarState(utc('2025-12-21T11:00:00Z')))
    expectNear(local.apparentElevation, 6.71801, 0.02, 'refracted')
  })

  test('hour angle is negative before local noon and positive after', () => {
    // Sign checks, no tolerance needed. Oslo solar noon is 11:19 UTC (TV-27).
    expect(localSolar(OSLO.lat, OSLO.lon, solarState(utc('2025-06-21T08:00:00Z'))).hourAngle).toBeLessThan(0)
    expect(localSolar(OSLO.lat, OSLO.lon, solarState(utc('2025-06-21T14:00:00Z'))).hourAngle).toBeGreaterThan(0)
  })

  test('true solar time reads 12 at the computed solar noon', () => {
    const noon = dayEvents(OSLO.lat, OSLO.lon, utc('2025-06-21T11:00:00Z')).solarNoon
    const local = localSolar(OSLO.lat, OSLO.lon, solarState(noon))
    // The noon iteration converges to within seconds and 60 s is 1/60 hour,
    // so 0.02 hours comfortably covers the group F noon tolerance.
    expectNear(local.trueSolarTime, 12, 0.02, 'true solar time')
    expectNear(local.hourAngle, 0, 0.3, 'hour angle at noon')
  })

  test('azimuth stays finite and continuous through the poles', () => {
    // At a pole there is no north, so the bearing is formally undefined. What
    // matters is that the atan2 form never divides by zero and never jumps: the
    // value approached from just short of the pole is the value at it.
    const state = solarState(utc('2025-06-21T12:00:00Z'))
    for (const pole of [90, -90]) {
      const atPole = localSolar(pole, 0, state).azimuth
      const near = localSolar(pole - Math.sign(pole) * 0.0005, 0, state).azimuth
      expect(Number.isFinite(atPole)).toBe(true)
      expect(atPole).toBeGreaterThanOrEqual(0)
      expect(atPole).toBeLessThan(360)
      expectNear(atPole, near, 0.05, `azimuth continuity at latitude ${pole}`)
    }
  })
})

describe('refraction', () => {
  test('zero above 85 degrees', () => {
    expect(refraction(86)).toBe(0)
    expect(refraction(90)).toBe(0)
  })

  test('polynomial value at the horizon', () => {
    // At elevation 0 the middle branch is the constant term 1735 arcseconds
    // = 0.48194 deg (section 7.1). Pure arithmetic, so 1e-9 covers float noise.
    expectNear(refraction(0), 1735 / 3600, 1e-9, 'horizon')
  })

  test('high branch value at 45 degrees', () => {
    // (58.1 - 0.07 + 0.000086) / 3600 with tan(45) = 1. Pure arithmetic; the
    // 1e-9 tolerance covers the float representation of tan(45 deg).
    expectNear(refraction(45), 58.030086 / 3600, 1e-9, '45 deg')
  })

  test('low branch below -0.575 degrees', () => {
    // NOAA main.js uses -20.774/tan(h) here while the NOAA spreadsheet
    // variant uses -20.772; the two differ by 0.1 arcsecond at -1 degree.
    // The tolerance accepts either published constant and nothing looser.
    const te = Math.tan(-1 * (Math.PI / 180))
    expectNear(refraction(-1), -20.774 / te / 3600, 5e-5, 'low branch')
  })

  test('refraction shrinks as the sun climbs', () => {
    // Monotonic on sample points spanning all three branches; exact ordering,
    // no tolerance involved.
    const samples = [-0.5, 0, 1, 3, 5.5, 10, 30, 60, 84]
    for (let i = 1; i < samples.length; i++) {
      expect(refraction(samples[i]!)).toBeLessThan(refraction(samples[i - 1]!))
    }
  })
})

describe('dayEvents: Oslo (TV-27, TV-28)', () => {
  // Group F tolerance: 60 seconds against USNO, which publishes whole minutes.
  test('midsummer 2025-06-21', () => {
    const ev = dayEvents(OSLO.lat, OSLO.lon, utc('2025-06-21T11:00:00Z'))
    expectTime(ev.sunrise, '2025-06-21T01:53:45.7Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-06-21T20:43:55.9Z', 60, 'sunset')
    expectTime(ev.solarNoon, '2025-06-21T11:18:51.6Z', 60, 'noon')
    expectTime(ev.civilDawn, '2025-06-21T00:09:31.0Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-06-21T22:28:06.7Z', 60, 'civil dusk')
    // The sun never reaches -12 at Oslo in June, so the deeper twilights are
    // absent (TV-27: nautical and astronomical both none).
    expect(ev.nauticalDawn).toBeNull()
    expect(ev.nauticalDusk).toBeNull()
    expect(ev.astronomicalDawn).toBeNull()
    expect(ev.astronomicalDusk).toBeNull()
    expect(ev.polar).toBeNull()
    // Day length 18h 50m 10.2s; 90 s tolerance because it is the difference
    // of two events that each carry the 60 s tolerance.
    expectNear(ev.dayLength, 18 * MS_PER_HOUR + 50 * MS_PER_MINUTE + 10_200, 90_000, 'day length')
    // Noon elevation 53.524 (TV-27, MET Norway 53.52). 0.05 deg: the group E
    // elevation tolerance plus the sub-minute noon offset, where the
    // elevation curve is flat.
    expectNear(ev.maxElevation, 53.524, 0.05, 'max elevation')
  })

  test('midwinter 2025-12-21 has all four twilight pairs', () => {
    const ev = dayEvents(OSLO.lat, OSLO.lon, utc('2025-12-21T11:00:00Z'))
    expectTime(ev.sunrise, '2025-12-21T08:18:14.4Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-12-21T14:12:06.4Z', 60, 'sunset')
    expectTime(ev.solarNoon, '2025-12-21T11:15:10.5Z', 60, 'noon')
    expectTime(ev.civilDawn, '2025-12-21T07:20:41.9Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-12-21T15:09:38.9Z', 60, 'civil dusk')
    expectTime(ev.nauticalDawn, '2025-12-21T06:24:00.2Z', 60, 'nautical dawn')
    expectTime(ev.nauticalDusk, '2025-12-21T16:06:20.6Z', 60, 'nautical dusk')
    expectTime(ev.astronomicalDawn, '2025-12-21T05:32:35.3Z', 60, 'astronomical dawn')
    expectTime(ev.astronomicalDusk, '2025-12-21T16:57:45.5Z', 60, 'astronomical dusk')
    expect(ev.polar).toBeNull()
  })
})

describe('dayEvents: Quito at the equinox (TV-29)', () => {
  test('2025-03-20', () => {
    const ev = dayEvents(QUITO.lat, QUITO.lon, utc('2025-03-20T17:00:00Z'))
    expectTime(ev.sunrise, '2025-03-20T11:17:54.6Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-03-20T23:24:25.3Z', 60, 'sunset')
    expectTime(ev.solarNoon, '2025-03-20T17:21:10.0Z', 60, 'noon')
    expectTime(ev.civilDawn, '2025-03-20T10:57:14.8Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-03-20T23:45:05.1Z', 60, 'civil dusk')
    // The nautical and astronomical dusks fall on the next UTC date, which the
    // solar day anchoring must deliver without wrapping.
    expectTime(ev.nauticalDusk, '2025-03-21T00:09:22.9Z', 60, 'nautical dusk')
    expectTime(ev.astronomicalDusk, '2025-03-21T00:33:22.6Z', 60, 'astronomical dusk')
    // 12h 06m 30.7s, not 12h: refraction and the semi-diameter add about six
    // minutes (TV-29 note). 90 s: two events at 60 s tolerance each.
    expectNear(ev.dayLength, 12 * MS_PER_HOUR + 6 * MS_PER_MINUTE + 30_700, 90_000, 'day length')
  })
})

describe('dayEvents: Sydney and the UTC day boundary (TV-30, section 8.2)', () => {
  test('september equinox: sunset on 22nd, previous sunrise on the 21st', () => {
    const ev = dayEvents(SYDNEY.lat, SYDNEY.lon, utc('2025-09-22T02:00:00Z'))
    expectTime(ev.sunset, '2025-09-22T07:51:25.9Z', 60, 'sunset')
    // The matching sunrise belongs to the previous UTC date: the solar day is
    // anchored to Sydney's noon, not Greenwich midnight.
    expect(ev.sunrise).not.toBeNull()
    expect(ev.sunrise as number).toBeLessThan(Date.UTC(2025, 8, 22))
    expect(ev.sunrise as number).toBeLessThan(ev.solarNoon)
    expect(ev.sunset as number).toBeGreaterThan(ev.solarNoon)
  })

  test('september equinox: next solar day sunrise is TV-30s 19:43:37.9', () => {
    const ev = dayEvents(SYDNEY.lat, SYDNEY.lon, utc('2025-09-23T02:00:00Z'))
    expectTime(ev.sunrise, '2025-09-22T19:43:37.9Z', 60, 'sunrise')
  })

  test('december solstice sunset and following sunrise (section 8.2 table)', () => {
    const dec21 = dayEvents(SYDNEY.lat, SYDNEY.lon, utc('2025-12-21T02:00:00Z'))
    expectTime(dec21.sunset, '2025-12-21T09:05:33.2Z', 60, 'sunset')
    const dec22 = dayEvents(SYDNEY.lat, SYDNEY.lon, utc('2025-12-22T02:00:00Z'))
    expectTime(dec22.sunrise, '2025-12-21T18:41:14.9Z', 60, 'sunrise')
  })

  test('solar noon on the june solstice (section 8.3 table)', () => {
    const ev = dayEvents(SYDNEY.lat, SYDNEY.lon, utc('2025-06-21T02:00:00Z'))
    // Corrected two-pass value 01:56:56.8, USNO 01:56:56.3. 60 s group F
    // tolerance; this vector exists to catch NOAA's half-day noon bug.
    expectTime(ev.solarNoon, '2025-06-21T01:56:56.8Z', 60, 'noon')
  })
})

describe('dayEvents: Reykjavik midwinter (TV-31)', () => {
  test('2025-12-21', () => {
    const ev = dayEvents(REYKJAVIK.lat, REYKJAVIK.lon, utc('2025-12-21T13:00:00Z'))
    expectTime(ev.sunrise, '2025-12-21T11:22:28.7Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-12-21T15:29:31.1Z', 60, 'sunset')
    expectTime(ev.solarNoon, '2025-12-21T13:26:00.0Z', 60, 'noon')
    expectTime(ev.civilDawn, '2025-12-21T10:03:08.3Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-12-21T16:48:51.6Z', 60, 'civil dusk')
    // 4h 07m 02.4s; 90 s combines the two 60 s event tolerances.
    expectNear(ev.dayLength, 4 * MS_PER_HOUR + 7 * MS_PER_MINUTE + 2_400, 90_000, 'day length')
  })
})

describe('dayEvents: Ushuaia southern summer (TV-32)', () => {
  test('2025-12-21, sunset lands on the next UTC day', () => {
    const ev = dayEvents(USHUAIA.lat, USHUAIA.lon, utc('2025-12-21T16:30:00Z'))
    expectTime(ev.sunrise, '2025-12-21T07:51:32.0Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-12-22T01:10:58.4Z', 60, 'sunset')
    expectTime(ev.solarNoon, '2025-12-21T16:31:30.3Z', 60, 'noon')
    expectNear(ev.dayLength, 17 * MS_PER_HOUR + 19 * MS_PER_MINUTE + 26_400, 90_000, 'day length')
  })
})

describe('dayEvents: London midsummer (TV-33)', () => {
  test('2025-06-21, nautical twilight present, astronomical absent', () => {
    const ev = dayEvents(LONDON.lat, LONDON.lon, utc('2025-06-21T12:00:00Z'))
    expectTime(ev.sunrise, '2025-06-21T03:43:08.0Z', 60, 'sunrise')
    expectTime(ev.sunset, '2025-06-21T20:21:37.5Z', 60, 'sunset')
    expectTime(ev.civilDawn, '2025-06-21T02:55:21.3Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-06-21T21:09:23.9Z', 60, 'civil dusk')
    expectTime(ev.nauticalDawn, '2025-06-21T01:40:40.8Z', 60, 'nautical dawn')
    expectTime(ev.nauticalDusk, '2025-06-21T22:24:03.3Z', 60, 'nautical dusk')
    // Solar midnight elevation is -15.06, between -12 and -18, so nautical
    // twilight is reached but astronomical is not.
    expect(ev.astronomicalDawn).toBeNull()
    expect(ev.astronomicalDusk).toBeNull()
  })
})

describe('dayEvents: polar day and polar night at 70 N (TV-34, TV-35, TV-36)', () => {
  test('midnight sun on 2025-06-21', () => {
    const ev = dayEvents(70, 0, utc('2025-06-21T12:00:00Z'))
    expect(ev.polar).toBe('day')
    expect(ev.sunrise).toBeNull()
    expect(ev.sunset).toBeNull()
    // The sun never drops below -0.833, so it certainly never reaches any
    // twilight threshold either (TV-34).
    expect(ev.civilDawn).toBeNull()
    expect(ev.civilDusk).toBeNull()
    expect(ev.nauticalDawn).toBeNull()
    expect(ev.astronomicalDusk).toBeNull()
    expect(ev.dayLength).toBe(MS_PER_DAY)
    expectTime(ev.solarNoon, '2025-06-21T12:01:52.5Z', 60, 'noon')
    // Transit altitudes 90 - |70 - 23.438| = 43.44 and |70 + 23.438| - 90
    // = 3.44 (TV-34, MET Norway prints both to 0.01). 0.05 deg allows the
    // implementation evaluating the lower transit at noon plus 12 h, a few
    // minutes off the true transit where the curve is flat.
    expectNear(ev.maxElevation, 43.44, 0.05, 'max elevation')
    expectNear(ev.minElevation, 3.44, 0.05, 'min elevation')
  })

  test('polar night on 2025-12-21, with twilight still occurring', () => {
    const ev = dayEvents(70, 0, utc('2025-12-21T12:00:00Z'))
    expect(ev.polar).toBe('night')
    expect(ev.sunrise).toBeNull()
    expect(ev.sunset).toBeNull()
    expect(ev.dayLength).toBe(0)
    expectTime(ev.solarNoon, '2025-12-21T11:58:11.9Z', 60, 'noon')
    expectTime(ev.civilDawn, '2025-12-21T09:54:31.9Z', 60, 'civil dawn')
    expectTime(ev.civilDusk, '2025-12-21T14:01:51.7Z', 60, 'civil dusk')
    expectTime(ev.nauticalDawn, '2025-12-21T08:05:44.9Z', 60, 'nautical dawn')
    expectTime(ev.nauticalDusk, '2025-12-21T15:50:38.7Z', 60, 'nautical dusk')
    expectTime(ev.astronomicalDawn, '2025-12-21T06:45:43.4Z', 60, 'astronomical dawn')
    expectTime(ev.astronomicalDusk, '2025-12-21T17:10:40.1Z', 60, 'astronomical dusk')
    expectNear(ev.maxElevation, -3.44, 0.05, 'max elevation')
  })

  test('boundary dates around the polar night (TV-36)', () => {
    // Existence flags must match USNO exactly; times carry the 60 s group F
    // tolerance. The midnight sun onset day (2025-05-16, a rise with no set)
    // is exercised separately below.
    const nov24 = dayEvents(70, 0, utc('2025-11-24T12:00:00Z'))
    expectTime(nov24.sunrise, '2025-11-24T11:14:00Z', 60, 'nov 24 sunrise')
    expectTime(nov24.sunset, '2025-11-24T12:19:00Z', 60, 'nov 24 sunset')

    const nov25 = dayEvents(70, 0, utc('2025-11-25T12:00:00Z'))
    expect(nov25.polar).toBe('night')
    expect(nov25.sunrise).toBeNull()
    expect(nov25.sunset).toBeNull()

    const jan17 = dayEvents(70, 0, utc('2026-01-17T12:00:00Z'))
    expectTime(jan17.sunrise, '2026-01-17T11:41:00Z', 60, 'jan 17 sunrise')
    expectTime(jan17.sunset, '2026-01-17T12:40:00Z', 60, 'jan 17 sunset')
  })

  test('tromso reports polar day in june and polar night in december', () => {
    // At 69.65 N the transit altitudes clear the -0.833 threshold by over two
    // degrees in both seasons, so the flags are robust; flags only, no times.
    const june = dayEvents(TROMSO.lat, TROMSO.lon, utc('2025-06-21T12:00:00Z'))
    expect(june.polar).toBe('day')
    expect(june.sunrise).toBeNull()
    expect(june.sunset).toBeNull()
    const december = dayEvents(TROMSO.lat, TROMSO.lon, utc('2025-12-21T12:00:00Z'))
    expect(december.polar).toBe('night')
    expect(december.sunrise).toBeNull()
    expect(december.sunset).toBeNull()
  })
})

describe('dayEvents: solar day anchoring', () => {
  test('auckland local noon gets auckland day, whichever side of UTC midnight', () => {
    // Auckland solar noon falls near 00:22 UTC. Instants shortly before and
    // shortly after UTC midnight must resolve to the same solar day.
    const before = dayEvents(AUCKLAND.lat, AUCKLAND.lon, utc('2025-06-20T23:00:00Z'))
    const after = dayEvents(AUCKLAND.lat, AUCKLAND.lon, utc('2025-06-21T01:00:00Z'))
    expect(before.solarNoon).toBe(after.solarNoon)
    // The anchored noon sits within half a day of the queried instant.
    expect(Math.abs(after.solarNoon - utc('2025-06-21T01:00:00Z'))).toBeLessThanOrEqual(MS_PER_DAY / 2)
    // Midwinter day surrounds its own noon and runs roughly 9.5 hours;
    // 9 to 10 h brackets the timeanddate value of about 9 h 38 m with margin.
    expect(before.sunrise).not.toBeNull()
    expect(before.sunset).not.toBeNull()
    expect(before.sunrise as number).toBeLessThan(before.solarNoon)
    expect(before.sunset as number).toBeGreaterThan(before.solarNoon)
    expect(before.dayLength).toBeGreaterThan(9 * MS_PER_HOUR)
    expect(before.dayLength).toBeLessThan(10 * MS_PER_HOUR)
  })

  test('solar noon stays within half a day of the queried instant', () => {
    const places = [OSLO, SYDNEY, AUCKLAND, USHUAIA, QUITO]
    const instants = ['2025-01-05T00:30:00Z', '2025-06-21T23:30:00Z', '2025-10-02T12:00:00Z']
    for (const p of places) {
      for (const iso of instants) {
        const ev = dayEvents(p.lat, p.lon, utc(iso))
        // Half a day plus 10 minutes of slack for the equation of time moving
        // the noon after the anchor day is chosen.
        expect(Math.abs(ev.solarNoon - utc(iso))).toBeLessThanOrEqual(MS_PER_DAY / 2 + 10 * MS_PER_MINUTE)
      }
    }
  })
})

describe('internal consistency', () => {
  test('elevation at the computed sunrise instant is -0.833', () => {
    // The crossing solver converges to within a couple of seconds at these
    // latitudes (section 8.2 convergence table) and the sun climbs at most
    // 0.004 deg per second, so 0.02 deg is a comfortable bound.
    const cases: Array<[{ lat: number; lon: number }, string]> = [
      [OSLO, '2025-06-21T11:00:00Z'],
      [QUITO, '2025-03-20T17:00:00Z'],
      [SYDNEY, '2025-09-23T02:00:00Z'],
      [LONDON, '2025-06-21T12:00:00Z'],
    ]
    for (const [place, iso] of cases) {
      const ev = dayEvents(place.lat, place.lon, utc(iso))
      expect(ev.sunrise).not.toBeNull()
      const elev = elevationAt(place.lat, place.lon, solarState(ev.sunrise as number))
      expectNear(elev, -0.833, 0.02, `${iso} sunrise elevation`)
      expect(ev.sunset).not.toBeNull()
      const setElev = elevationAt(place.lat, place.lon, solarState(ev.sunset as number))
      expectNear(setElev, -0.833, 0.02, `${iso} sunset elevation`)
    }
  })

  test('day length is symmetric about the equinox across hemispheres', () => {
    // Mirrored latitude on the mirrored date sees the mirrored declination,
    // so the day lengths match. The mirror is imperfect only because orbital
    // eccentricity skews the declination curve by about 0.1 deg over ten
    // days, worth under a minute of day length at 45 degrees; 3 min is 3x.
    const equinox = utc('2025-03-20T09:01:00Z')
    const ten = 10 * MS_PER_DAY
    const north = dayEvents(45, 0, equinox + ten)
    const south = dayEvents(-45, 0, equinox - ten)
    expectNear(north.dayLength, south.dayLength, 3 * 60_000, 'mirrored day length')
  })

  test('the equator sits near 12 hours all year', () => {
    // With the -0.833 horizon the equatorial day runs 12h06m to 12h08m
    // (TV-29 and the H0 geometry); 12h05m to 12h09m brackets that band.
    for (let month = 0; month < 12; month++) {
      const ev = dayEvents(0, 0, Date.UTC(2025, month, 15, 12))
      expect(ev.dayLength, `month ${month + 1}`).toBeGreaterThan(12 * MS_PER_HOUR + 5 * MS_PER_MINUTE)
      expect(ev.dayLength, `month ${month + 1}`).toBeLessThan(12 * MS_PER_HOUR + 9 * MS_PER_MINUTE)
    }
  })
})

describe('sunlitFraction', () => {
  test('slightly over half the globe is lit, independent of season', () => {
    // The lit region is a spherical cap of angular radius 90.833 deg, whose
    // area fraction is (1 + sin 0.833) / 2 = 0.507269 regardless of the
    // declination. 1e-3 covers the 900 band midpoint integration.
    const expected = (1 + Math.sin(0.833 * (Math.PI / 180))) / 2
    for (const iso of ['2025-03-20T12:00:00Z', '2025-06-21T12:00:00Z', '2025-12-21T12:00:00Z']) {
      expectNear(sunlitFraction(solarState(utc(iso))), expected, 1e-3, iso)
    }
  })
})

describe('analemma', () => {
  test('figure spans the documented declination and longitude ranges', () => {
    const points = analemma(2025)
    expect(points.length).toBe(365)
    const lats = points.map((p) => p.lat)
    const lons = points.map((p) => p.lon)
    // Section 12.1: height reaches +/- 23.44 (daily sampling lands within
    // half a day of the solstice, where the curve moves under 0.001 deg per
    // day, so 23.42 to 23.45 brackets the sampled extreme).
    expect(Math.max(...lats)).toBeGreaterThanOrEqual(23.42)
    expect(Math.max(...lats)).toBeLessThanOrEqual(23.45)
    expect(Math.min(...lats)).toBeLessThanOrEqual(-23.42)
    expect(Math.min(...lats)).toBeGreaterThanOrEqual(-23.45)
    // Width: the equation of time runs -14.23 to +16.49 min, so at 12 UTC the
    // subsolar longitude runs +3.557 to -4.123 deg. The brackets allow the
    // 0.15 min equation of time tolerance plus daily sampling of a flat
    // extremum, about 0.05 deg combined.
    expect(Math.max(...lons)).toBeGreaterThanOrEqual(3.5)
    expect(Math.max(...lons)).toBeLessThanOrEqual(3.62)
    expect(Math.min(...lons)).toBeLessThanOrEqual(-4.06)
    expect(Math.min(...lons)).toBeGreaterThanOrEqual(-4.18)
  })

  test('samples sit at the requested UTC hour and agree with solarState', () => {
    const points = analemma(2025, 12, 24)
    expect(points.length).toBe(24)
    for (const p of points) {
      // Exact restatements of the implementation contract: each sample is at
      // 12:00 UTC and carries the subsolar point for its own instant.
      expect(p.time % MS_PER_DAY).toBe(12 * MS_PER_HOUR)
      const s = solarState(p.time)
      expect(p.lat).toBe(s.subsolarLat)
      expect(p.lon).toBe(s.subsolarLon)
    }
  })
})

describe('seasonInstant (TV-18)', () => {
  // The implementation root-finds on the Meeus chapter 25 low accuracy
  // apparent longitude (the NOAA series), whose roughly 0.01 degree error is
  // about 15 minutes of time at the sun's 0.0411 deg per hour rate, and it
  // feeds UTC where the series wants TT (another 69 s). So a 20 minute
  // tolerance against the USNO instants is the honest figure; do not expect
  // the 90 s a Meeus chapter 27 implementation would earn.
  const TOL_SECONDS = 20 * 60
  const vectors: Array<[number, 0 | 90 | 180 | 270, string]> = [
    [2025, 0, '2025-03-20T09:01:00Z'],
    [2025, 90, '2025-06-21T02:42:00Z'],
    [2025, 180, '2025-09-22T18:19:00Z'],
    [2025, 270, '2025-12-21T15:03:00Z'],
    [2026, 0, '2026-03-20T14:46:00Z'],
    [2026, 90, '2026-06-21T08:24:00Z'],
    [2026, 180, '2026-09-23T00:05:00Z'],
    [2026, 270, '2026-12-21T20:50:00Z'],
    [2027, 0, '2027-03-20T20:25:00Z'],
    [2027, 270, '2027-12-22T02:42:00Z'],
  ]

  for (const [year, target, iso] of vectors) {
    test(`${year} at ${target} degrees`, () => {
      expectTime(seasonInstant(year, target), iso, TOL_SECONDS, `${year}/${target}`)
    })
  }

  test('declination is extreme at the solstices and zero at the equinoxes', () => {
    // At a solstice the declination equals the obliquity to within the model
    // error (0.005 deg); at an equinox it crosses zero, and the up to 20
    // minute instant error moves it by at most 20 min * 0.0166 deg/min h
    // hmm 0.4 deg per day is 0.0003 deg per minute, so 0.006 deg.
    expectNear(solarState(seasonInstant(2025, 90)).declination, 23.438, 0.01, 'june solstice')
    expectNear(solarState(seasonInstant(2025, 270)).declination, -23.438, 0.01, 'december solstice')
    expectNear(solarState(seasonInstant(2025, 0)).declination, 0, 0.01, 'march equinox')
    expectNear(solarState(seasonInstant(2025, 180)).declination, 0, 0.01, 'september equinox')
  })
})

describe('sanity: no NaN at the poles, the date line, or distant years', () => {
  const lats = [90, -90, 0, 66.5]
  const lons = [180, -180, 0]
  const times = [Date.UTC(1900, 5, 21, 12), Date.UTC(2100, 0, 1, 0)]

  test('solarState, elevationAt, localSolar, dayEvents, sunlitFraction stay finite', () => {
    for (const t of times) {
      const s = solarState(t)
      for (const value of [s.century, s.declination, s.equationOfTime, s.subsolarLon, s.subsolarLat, s.rightAscension, s.apparentLongitude, s.distanceAu, s.angularRadius]) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(Number.isFinite(sunlitFraction(s))).toBe(true)
      for (const lat of lats) {
        for (const lon of lons) {
          expect(Number.isFinite(elevationAt(lat, lon, s)), `elevationAt ${lat},${lon}`).toBe(true)
          const local = localSolar(lat, lon, s)
          for (const value of [local.elevation, local.apparentElevation, local.azimuth, local.hourAngle, local.trueSolarTime]) {
            expect(Number.isFinite(value), `localSolar ${lat},${lon}`).toBe(true)
          }
          const ev = dayEvents(lat, lon, t)
          for (const value of [ev.solarNoon, ev.dayLength, ev.maxElevation, ev.minElevation]) {
            expect(Number.isFinite(value), `dayEvents ${lat},${lon}`).toBe(true)
          }
          for (const event of [ev.sunrise, ev.sunset, ev.civilDawn, ev.astronomicalDusk]) {
            expect(event === null || Number.isFinite(event), `dayEvents event ${lat},${lon}`).toBe(true)
          }
        }
      }
    }
  })

  test('refraction is finite across the whole elevation range', () => {
    for (let elevation = -90; elevation <= 90; elevation += 0.5) {
      expect(Number.isFinite(refraction(elevation)), `refraction(${elevation})`).toBe(true)
    }
  })

  test('the poles see polar day or night at the solstices', () => {
    const north = dayEvents(90, 0, utc('2025-06-21T12:00:00Z'))
    expect(north.polar).toBe('day')
    const south = dayEvents(-90, 0, utc('2025-06-21T12:00:00Z'))
    expect(south.polar).toBe('night')
  })

  test('seasonInstant works in 1900 and 2100', () => {
    // The series degrades slowly outside 1800 to 2200 (section 10.1), so the
    // instant must at least land inside the right few days of March.
    const y1900 = seasonInstant(1900, 0)
    expect(y1900).toBeGreaterThanOrEqual(Date.UTC(1900, 2, 18))
    expect(y1900).toBeLessThanOrEqual(Date.UTC(1900, 2, 23))
    const y2100 = seasonInstant(2100, 0)
    expect(y2100).toBeGreaterThanOrEqual(Date.UTC(2100, 2, 18))
    expect(y2100).toBeLessThanOrEqual(Date.UTC(2100, 2, 23))
  })
})
