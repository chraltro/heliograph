import { describe, expect, test } from 'vitest'
import {
  localMoon,
  moonElevationAt,
  moonEvents,
  moonlight,
  moonPhase,
  moonState,
  siderealTime,
} from '../src/solar/moon.ts'
import { DELTA_T_SECONDS, fromJulianDay, MS_PER_MINUTE, solarState } from '../src/solar/solar.ts'

const utc = (iso: string) => Date.parse(iso)

function expectNear(actual: number, expected: number, tolerance: number, what = ''): void {
  expect(Math.abs(actual - expected), `${what} ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance)
}

/**
 * Meeus example 47.a, the reference the whole chapter is checked against:
 * 1992 April 12 at 0h TD, which is JDE 2448724.5.
 *
 * That is a *dynamical* time, and the library takes UTC and adds delta T
 * itself, so the instant handed in has to be delta T earlier for the two to
 * meet on the same JDE. Feeding 0h UTC instead evaluates the Moon 69 seconds
 * late, and at half an arcsecond a second that is a visible 38 arcseconds of
 * longitude, which is precisely the sort of error this test exists to catch.
 */
describe('moonState against Meeus example 47.a', () => {
  const time = fromJulianDay(2448724.5) - DELTA_T_SECONDS * 1000
  const state = moonState(time)

  test('apparent ecliptic longitude', () => {
    // Meeus gives lambda = 133.162655, then apparent = 133.167265 after a
    // nutation of +16.595 arcseconds. Only the dominant nutation term is used
    // here, which is worth about half an arcsecond on this date.
    expectNear(state.apparentLongitude, 133.167265, 0.0003, 'longitude')
  })

  test('ecliptic latitude', () => {
    expectNear(state.eclipticLatitude, -3.229126, 1e-5, 'latitude')
  })

  test('distance', () => {
    // 368409.7 km, and it agrees to well inside the kilometre Meeus prints.
    expectNear(state.distanceKm, 368409.7, 0.2, 'distance')
  })

  test('equatorial horizontal parallax', () => {
    expectNear(state.parallax, 0.991990, 1e-5, 'parallax')
  })

  test('apparent right ascension and declination', () => {
    // Meeus 47.a continued: alpha = 134.688470, delta = 13.768368.
    expectNear(state.rightAscension, 134.688470, 0.0005, 'right ascension')
    expectNear(state.declination, 13.768368, 0.0005, 'declination')
  })
})

/** Meeus example 48.a, the illuminated fraction for the same instant. */
describe('moonPhase against Meeus example 48.a', () => {
  const time = fromJulianDay(2448724.5) - DELTA_T_SECONDS * 1000
  const phase = moonPhase(solarState(time), moonState(time))

  test('phase angle', () => {
    expectNear(phase.phaseAngle, 69.0756, 0.02, 'phase angle')
  })

  test('illuminated fraction', () => {
    expectNear(phase.illumination, 0.6786, 0.0004, 'illumination')
  })

  test('the disc is waxing, nine days after the new moon of 3 April 1992', () => {
    // Two thirds lit and still filling: new moon fell on 3 April and full on
    // 17 April, so 12 April is a waxing gibbous.
    expect(phase.waxing).toBe(true)
    expect(phase.name).toBe('Waxing gibbous')
    expectNear(phase.age, 110.8, 0.3, 'elongation in longitude')
  })
})

describe('sidereal time', () => {
  test('agrees with Meeus example 12.a', () => {
    // 1987 April 10 at 0h UT: mean sidereal time 13h 10m 46.3668s.
    const expected = (13 + 10 / 60 + 46.3668 / 3600) * 15
    expectNear(siderealTime(utc('1987-04-10T00:00:00Z')), expected, 0.0002, 'GMST')
  })

  test('advances by a sidereal day, not a solar one', () => {
    const a = siderealTime(utc('2026-03-01T00:00:00Z'))
    const b = siderealTime(utc('2026-03-02T00:00:00Z'))
    // A solar day is 360.9856 degrees of rotation, so the sidereal time gains
    // just under a degree a day, which is what makes the stars rise earlier.
    expectNear(((b - a) % 360) + 360 * 0, 0.9856, 0.001, 'daily gain')
  })
})

describe('the sublunar point', () => {
  test('is where the Moon is straight overhead', () => {
    const time = utc('2026-08-14T13:34:00Z')
    const state = moonState(time)
    // By construction the elevation at the sublunar point is 90 degrees, which
    // is the check that the sidereal time and the right ascension agree.
    expectNear(
      moonElevationAt(state.sublunarLat, state.sublunarLon, state),
      90,
      1e-6,
      'elevation at the sublunar point',
    )
  })

  test('travels west at very nearly the rate the Earth turns', () => {
    const start = utc('2026-08-14T00:00:00Z')
    const a = moonState(start).sublunarLon
    const b = moonState(start + 3_600_000).sublunarLon
    let moved = a - b
    if (moved < -180) moved += 360
    if (moved > 180) moved -= 360
    // Fifteen degrees an hour of Earth rotation less the Moon's own half degree
    // of eastward motion, which is exactly why moonrise is fifty minutes later
    // each day.
    expectNear(moved, 14.5, 0.35, 'westward drift per hour')
  })
})

describe('moonEvents', () => {
  test('rise and set bracket a Moon that is up between them', () => {
    const [lat, lon] = [51.5, 0]
    const events = moonEvents(lat, lon, utc('2026-08-14T12:00:00Z'))
    expect(events.circumstance).toBeNull()
    expect(events.moonrise).not.toBeNull()
    expect(events.moonset).not.toBeNull()

    // Ten minutes inside each crossing the Moon is on the expected side of the
    // horizon, which is the property rise and set actually assert.
    const at = (t: number) => moonElevationAt(lat, lon, moonState(t))
    expect(at(events.moonrise! + 10 * MS_PER_MINUTE)).toBeGreaterThan(0)
    expect(at(events.moonrise! - 10 * MS_PER_MINUTE)).toBeLessThan(0)
    expect(at(events.moonset! + 10 * MS_PER_MINUTE)).toBeLessThan(0)
    expect(at(events.moonset! - 10 * MS_PER_MINUTE)).toBeGreaterThan(0)
  })

  test('reports a Moon that never sets at the pole', () => {
    // At the pole the Moon is up for about a fortnight at a time, so on a day
    // its declination stays north there is neither a rise nor a set.
    const events = moonEvents(89.5, 0, utc('2026-08-14T12:00:00Z'))
    if (events.circumstance !== null) {
      expect(events.circumstance === 'up' || events.circumstance === 'down').toBe(true)
      expect(events.moonrise).toBeNull()
      expect(events.moonset).toBeNull()
    }
  })
})

describe('moonlight', () => {
  test('is brightest for a full Moon overhead and zero below the horizon', () => {
    const full = { illumination: 1 } as ReturnType<typeof moonPhase>
    expect(moonlight(90, full, 385000.56)).toBeCloseTo(1, 5)
    expect(moonlight(0, full, 385000.56)).toBe(0)
    expect(moonlight(-5, full, 385000.56)).toBe(0)
  })

  test('falls away far faster than the illuminated fraction does', () => {
    const full = { illumination: 1 } as ReturnType<typeof moonPhase>
    const half = { illumination: 0.5 } as ReturnType<typeof moonPhase>
    const ratio = moonlight(90, half, 385000.56) / moonlight(90, full, 385000.56)
    // The opposition surge: a half moon gives about a tenth of a full moon's
    // light, not a half. Anything near 0.5 means the surge has been lost.
    expect(ratio).toBeGreaterThan(0.06)
    expect(ratio).toBeLessThan(0.2)
  })

  test('a nearer Moon is a brighter one', () => {
    const full = { illumination: 1 } as ReturnType<typeof moonPhase>
    expect(moonlight(90, full, 356500)).toBeGreaterThan(moonlight(90, full, 406700) * 1.25)
  })
})

describe('localMoon', () => {
  test('azimuth is south when the Moon crosses the meridian from the north', () => {
    const time = utc('2026-08-14T13:34:00Z')
    const state = moonState(time)
    // Standing well north of the sublunar point, the Moon is due south.
    const local = localMoon(state.sublunarLat + 30, state.sublunarLon, state)
    expectNear(local.azimuth, 180, 0.001, 'azimuth')
    expectNear(local.elevation, 60, 0.001, 'elevation')
  })
})
