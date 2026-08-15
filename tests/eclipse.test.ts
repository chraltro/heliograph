import { describe, expect, test } from 'vitest'
import {
  centralPath,
  findEclipses,
  obscurationAt,
  geometry,
  solarEclipseNear,
  lunarEclipseNear,
} from '../src/solar/eclipse.ts'
import { MS_PER_DAY, MS_PER_MINUTE } from '../src/solar/solar.ts'

const utc = (iso: string) => Date.parse(iso)

/**
 * Eclipses are the sharpest test an ephemeris can be given: they are the one
 * thing that fails visibly if the Sun and the Moon disagree by an arcminute.
 * Every expected value below is from NASA's Five Millennium Canon of Solar
 * Eclipses and its lunar companion, which are the standard references.
 */
describe('solar eclipses against the NASA canon', () => {
  const cases = [
    // date of greatest eclipse, UTC, and the type the canon assigns
    { iso: '2017-08-21T18:26:40Z', type: 'total', place: { lon: -87.6, lat: 37.0 } },
    { iso: '2024-04-08T18:17:16Z', type: 'total', place: { lon: -104.1, lat: 25.3 } },
    { iso: '2026-08-12T17:46:01Z', type: 'total', place: { lon: -25.2, lat: 65.2 } },
    { iso: '2027-08-02T10:07:50Z', type: 'total', place: { lon: 33.2, lat: 25.5 } },
    { iso: '2023-10-14T18:00:41Z', type: 'annular', place: { lon: -83.1, lat: 11.4 } },
  ] as const

  for (const item of cases) {
    test(`${item.iso} is a ${item.type} eclipse`, () => {
      const eclipse = solarEclipseNear(utc(item.iso))
      expect(eclipse.type).toBe(item.type)
      // Within a couple of minutes of the canon's instant of greatest eclipse.
      expect(Math.abs(eclipse.time - utc(item.iso)) / MS_PER_MINUTE).toBeLessThan(2)
      expect(eclipse.greatest).not.toBeNull()
      // And within a couple of degrees of where the canon puts it. The axis
      // here meets a sphere rather than the true ellipsoid, which is most of
      // the difference.
      expect(Math.abs(eclipse.greatest!.lat - item.place.lat)).toBeLessThan(2.5)
      const dLon = Math.abs(((eclipse.greatest!.lon - item.place.lon + 540) % 360) - 180)
      expect(dLon).toBeLessThan(2.5)
    })
  }

  test('the eclipse of 2017 was total in Wyoming and partial in New York', () => {
    // Mid totality at Casper, which ran from 17:42:39 to 17:45:04.
    const casper = geometry(utc('2017-08-21T17:43:50Z'))
    expect(obscurationAt(casper, -106.3, 42.85)).toBeGreaterThan(0.999)

    // New York reached its own maximum an hour later, and never saw totality:
    // about seventy per cent of the Sun's diameter, so rather less by area.
    const newYork = geometry(utc('2017-08-21T18:44:00Z'))
    const covered = obscurationAt(newYork, -74.0, 40.7)
    expect(covered).toBeGreaterThan(0.5)
    expect(covered).toBeLessThan(0.75)

    // Sydney, where the Sun was not even up, saw nothing at all.
    expect(obscurationAt(casper, 151.2, -33.9)).toBe(0)
  })
})

describe('lunar eclipses against the NASA canon', () => {
  const cases = [
    { iso: '2025-03-14T06:58:43Z', type: 'total' },
    { iso: '2025-09-07T18:11:47Z', type: 'total' },
    { iso: '2026-03-03T11:33:31Z', type: 'total' },
    { iso: '2026-08-28T04:12:53Z', type: 'partial' },
  ] as const

  for (const item of cases) {
    test(`${item.iso} is a ${item.type} lunar eclipse`, () => {
      const eclipse = lunarEclipseNear(utc(item.iso))
      expect(eclipse.type).toBe(item.type)
      expect(Math.abs(eclipse.time - utc(item.iso)) / MS_PER_MINUTE).toBeLessThan(5)
    })
  }
})

describe('the catalogue', () => {
  test('finds the right number of eclipses in a decade', () => {
    const found = findEclipses(utc('2020-01-01T00:00:00Z'), utc('2030-01-01T00:00:00Z'))
    const solar = found.filter((e) => e.kind === 'solar')
    const lunar = found.filter((e) => e.kind === 'lunar')
    // Between two and five solar eclipses happen a year, and a similar number
    // of lunar ones counting the penumbral, so a decade holds a few dozen of
    // each. Wildly outside this and the search is missing or inventing events.
    expect(solar.length).toBeGreaterThanOrEqual(20)
    expect(solar.length).toBeLessThanOrEqual(30)
    expect(lunar.length).toBeGreaterThanOrEqual(20)
    expect(lunar.length).toBeLessThanOrEqual(35)
  })

  test('includes the well known total eclipses of the 2020s', () => {
    const found = findEclipses(utc('2024-01-01T00:00:00Z'), utc('2028-01-01T00:00:00Z'))
    const totals = found
      .filter((e) => e.kind === 'solar' && e.type === 'total')
      .map((e) => new Date(e.time).toISOString().slice(0, 10))
    expect(totals).toContain('2024-04-08')
    expect(totals).toContain('2026-08-12')
    expect(totals).toContain('2027-08-02')
  })

  test('never places two eclipses closer together than a fortnight', () => {
    const found = findEclipses(utc('2026-01-01T00:00:00Z'), utc('2036-01-01T00:00:00Z'))
    const solar = found.filter((e) => e.kind === 'solar').map((e) => e.time)
    for (let i = 1; i < solar.length; i++) {
      // Consecutive solar eclipses are a synodic month apart, or occasionally a
      // month less; anything closer means the search double counted one.
      expect((solar[i]! - solar[i - 1]!) / MS_PER_DAY).toBeGreaterThan(20)
    }
  })

  /**
   * The track is checked against places whose totality times are common
   * knowledge, because a path is only useful if it passes through the towns the
   * newspapers named. The tolerances are the width of a real umbra, sixty odd
   * kilometres, and a few minutes of clock.
   */
  describe('the path of totality', () => {
    const nearest = (path: ReturnType<typeof centralPath>, lon: number, lat: number) => {
      let best = path.central[0]!
      let bestKm = Infinity
      for (const point of path.central) {
        const dx = (point.lon - lon) * Math.cos((lat * Math.PI) / 180)
        const km = Math.hypot(dx, point.lat - lat) * 111.32
        if (km < bestKm) {
          bestKm = km
          best = point
        }
      }
      return { km: bestKm, time: best.time }
    }

    test('crosses the United States on 21 August 2017 on schedule', () => {
      const path = centralPath(utc('2017-08-21T18:26:00Z'))
      expect(path.type).toBe('total')
      // Lincoln City, Oregon at 17:16 and Charleston, South Carolina at 18:47.
      const oregon = nearest(path, -124.0, 44.96)
      expect(oregon.km).toBeLessThan(80)
      expect(Math.abs(oregon.time - utc('2017-08-21T17:16:00Z')) / MS_PER_MINUTE).toBeLessThan(6)
      const carolina = nearest(path, -79.93, 32.78)
      expect(carolina.km).toBeLessThan(80)
      expect(Math.abs(carolina.time - utc('2017-08-21T18:47:00Z')) / MS_PER_MINUTE).toBeLessThan(6)
    })

    test('crosses Mexico, Texas and Ohio on 8 April 2024 on schedule', () => {
      const path = centralPath(utc('2024-04-08T18:18:00Z'))
      for (const [lon, lat, iso] of [
        [-106.42, 23.25, '2024-04-08T18:07:00Z'],
        [-96.8, 32.78, '2024-04-08T18:42:00Z'],
        [-81.69, 41.5, '2024-04-08T19:15:00Z'],
      ] as const) {
        const hit = nearest(path, lon, lat)
        expect(hit.km).toBeLessThan(80)
        expect(Math.abs(hit.time - utc(iso)) / MS_PER_MINUTE).toBeLessThan(6)
      }
    })

    test('runs west to east through the point of greatest eclipse', () => {
      const path = centralPath(utc('2027-08-02T10:07:00Z'))
      expect(path.central.length).toBeGreaterThan(40)
      const greatest = path.greatest!
      // Greatest eclipse lies on the track it is the middle of.
      const hit = nearest(path, greatest.lon, greatest.lat)
      expect(hit.km).toBeLessThan(40)
      expect(Math.abs(hit.time - path.time) / MS_PER_MINUTE).toBeLessThan(4)
      // The shadow always travels eastward relative to the ground.
      const first = path.central[0]!
      const last = path.central[path.central.length - 1]!
      const swept = ((last.lon - first.lon + 540) % 360) - 180
      expect(swept).toBeGreaterThan(60)
    })

    test('gives a partial eclipse no track at all', () => {
      // 2025-03-29 is partial everywhere: the axis passes north of the Earth.
      const path = centralPath(utc('2025-03-29T10:47:00Z'))
      expect(path.type).toBe('partial')
      expect(path.central.length).toBe(0)
    })
  })

  test('covers a century without going lame', () => {
    const start = performance.now()
    const found = findEclipses(utc('2000-01-01T00:00:00Z'), utc('2100-01-01T00:00:00Z'))
    const elapsed = performance.now() - start
    // Roughly 224 solar and a similar number of lunar eclipses per century.
    expect(found.filter((e) => e.kind === 'solar').length).toBeGreaterThan(200)
    expect(found.filter((e) => e.kind === 'solar').length).toBeLessThan(260)
    expect(elapsed).toBeLessThan(20_000)
  })
})
