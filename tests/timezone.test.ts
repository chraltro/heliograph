import { describe, test, expect } from 'vitest'
import {
  zoneOffsetMinutes,
  wallClockToUtc,
  wallClockIn,
  isDaylightSaving,
  formatOffset,
  formatOffsetShort,
  isValidZone,
  localZone,
  listZones,
  type WallClock,
} from '../src/time/timezone.ts'

// Tolerance policy for the whole file: IANA offsets are exact integer minutes
// and every probe instant sits on a whole minute, so there is no floating
// point anywhere and exact equality (toBe / toEqual) is the correct tolerance.
// The one range assertion (the spring forward gap) states its own bound.

const utcMs = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s)

const wc = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): WallClock => ({
  year,
  month,
  day,
  hour,
  minute,
  second,
})

// Two reference instants far from any 2026 DST transition, one per season,
// matching the verified table in docs/research/timezone-data.md section 5.3.
const JAN = utcMs(2026, 1, 15, 12)
const AUG = utcMs(2026, 8, 14, 12)

describe('zoneOffsetMinutes', () => {
  // [zone, January offset, August offset], all exact minutes from tzdata 2026b.
  const table: Array<[string, number, number]> = [
    ['UTC', 0, 0],
    ['Europe/Oslo', 60, 120],
    ['America/New_York', -300, -240],
    ['Asia/Tokyo', 540, 540],
    ['Asia/Kolkata', 330, 330],
    ['Australia/Adelaide', 630, 570],
    ['Asia/Kathmandu', 345, 345],
    ['Pacific/Chatham', 825, 765],
    ['Pacific/Apia', 780, 780],
    ['Pacific/Kiritimati', 840, 840],
    ['America/St_Johns', -210, -150],
    ['Australia/Sydney', 660, 600],
  ]

  test.each(table)('%s offsets in January and August 2026', (zone, jan, aug) => {
    expect(zoneOffsetMinutes(zone, JAN)).toBe(jan)
    expect(zoneOffsetMinutes(zone, AUG)).toBe(aug)
  })

  test('sub second instants still yield a whole minute offset', () => {
    // The function truncates to whole seconds internally, so a stray 123 ms
    // must not turn +345 into a fractional value. Exact because the offset is
    // an integer by construction after that truncation.
    expect(zoneOffsetMinutes('Asia/Kathmandu', AUG + 123)).toBe(345)
    expect(zoneOffsetMinutes('America/New_York', JAN + 999)).toBe(-300)
  })
})

describe('daylight saving transitions in 2026', () => {
  // Real 2026 transition instants, verified against the runtime tzdata:
  // probing one minute either side pins the step to the documented minute.
  // Offsets are exact integers so equality needs no tolerance.
  const transitions: Array<[string, number, number, number]> = [
    // [zone, transition instant, offset before, offset after]
    ['Europe/Oslo', utcMs(2026, 3, 29, 1), 60, 120],
    ['Europe/Oslo', utcMs(2026, 10, 25, 1), 120, 60],
    ['America/New_York', utcMs(2026, 3, 8, 7), -300, -240],
    ['America/New_York', utcMs(2026, 11, 1, 6), -240, -300],
    ['Australia/Sydney', utcMs(2026, 4, 4, 16), 660, 600],
    ['Australia/Sydney', utcMs(2026, 10, 3, 16), 600, 660],
  ]

  test.each(transitions)('%s transition at %d', (zone, at, before, after) => {
    expect(zoneOffsetMinutes(zone, at - 60_000)).toBe(before)
    // The transition instant itself belongs to the new offset regime.
    expect(zoneOffsetMinutes(zone, at)).toBe(after)
    expect(zoneOffsetMinutes(zone, at + 60_000)).toBe(after)
  })
})

describe('isDaylightSaving', () => {
  test('northern hemisphere zones: true in August, false in January', () => {
    expect(isDaylightSaving('Europe/Oslo', AUG)).toBe(true)
    expect(isDaylightSaving('Europe/Oslo', JAN)).toBe(false)
    expect(isDaylightSaving('America/New_York', AUG)).toBe(true)
    expect(isDaylightSaving('America/New_York', JAN)).toBe(false)
  })

  test('southern hemisphere zones: true in January, false in August', () => {
    expect(isDaylightSaving('Australia/Sydney', JAN)).toBe(true)
    expect(isDaylightSaving('Australia/Sydney', AUG)).toBe(false)
    expect(isDaylightSaving('Pacific/Auckland', JAN)).toBe(true)
    expect(isDaylightSaving('Pacific/Auckland', AUG)).toBe(false)
  })

  test('zones without daylight saving are false in every month of 2026', () => {
    for (let month = 1; month <= 12; month++) {
      expect(isDaylightSaving('Asia/Tokyo', utcMs(2026, month, 15, 12))).toBe(false)
      expect(isDaylightSaving('UTC', utcMs(2026, month, 15, 12))).toBe(false)
    }
  })
})

describe('wallClockToUtc round trips', () => {
  const zones = [
    'UTC',
    'Europe/Oslo',
    'America/New_York',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Australia/Adelaide',
    'Pacific/Chatham',
    'Pacific/Kiritimati',
    'Asia/Tokyo',
    'America/St_Johns',
  ]
  // Ordinary wall clocks well clear of any transition, including a midnight,
  // a year end second, and times with nonzero seconds.
  const clocks: WallClock[] = [
    wc(2026, 1, 15, 9, 30, 0),
    wc(2026, 4, 20, 0, 0, 0),
    wc(2026, 8, 14, 23, 45, 30),
    wc(2025, 12, 31, 23, 59, 59),
    wc(2026, 6, 21, 12, 1, 1),
  ]

  test.each(zones)('%s: to UTC and back returns the same wall clock', (zone) => {
    for (const clock of clocks) {
      const ms = wallClockToUtc(zone, clock)
      // All six fields must survive exactly: the conversion is pure integer
      // minute arithmetic away from transitions, so any drift is a bug.
      expect(wallClockIn(zone, ms)).toEqual(clock)
    }
  })
})

describe('wallClockToUtc across the spring forward gap', () => {
  // [zone, named wall clock inside the gap, UTC instant the gap opens, gap minutes]
  const gaps: Array<[string, WallClock, number, number]> = [
    ['Europe/Oslo', wc(2026, 3, 29, 2, 30), utcMs(2026, 3, 29, 1), 60],
    ['America/New_York', wc(2026, 3, 8, 2, 30), utcMs(2026, 3, 8, 7), 60],
    ['Australia/Sydney', wc(2026, 10, 4, 2, 30), utcMs(2026, 10, 3, 16), 60],
  ]

  test.each(gaps)('%s: nonexistent time yields a real instant, never NaN', (zone, clock) => {
    const ms = wallClockToUtc(zone, clock)
    expect(Number.isFinite(ms)).toBe(true)
    expect(Number.isNaN(ms)).toBe(false)
    // The result must be a genuine instant the zone can render.
    const rendered = wallClockIn(zone, ms)
    expect(rendered.hour).toBeGreaterThanOrEqual(0)
    expect(rendered.hour).toBeLessThan(24)
  })

  test.each(gaps)('%s: result sits at or just after the gap', (zone, clock, gapStart, gapMinutes) => {
    // The function's contract (and the Temporal 'compatible' rule) is to skip
    // forward over the gap, so the instant must not precede the transition
    // and must land within one gap length after it: the bound is the gap
    // width itself, since any named time inside the gap maps at most that far.
    const ms = wallClockToUtc(zone, clock)
    expect(ms).toBeGreaterThanOrEqual(gapStart)
    expect(ms).toBeLessThanOrEqual(gapStart + gapMinutes * 60_000)
  })
})

describe('wallClockToUtc in the fall back ambiguous hour', () => {
  // Each named time below happens at two real instants. The implementation
  // follows the Temporal "compatible" policy and always returns the earlier of
  // the two, the one still on summer time, in every zone and in both
  // hemispheres. Assert membership in the two instant set, then pin the choice.
  test('Europe/Oslo 2026-10-25 02:30 picks the first occurrence (+02:00)', () => {
    const first = utcMs(2026, 10, 25, 0, 30)
    const second = utcMs(2026, 10, 25, 1, 30)
    const ms = wallClockToUtc('Europe/Oslo', wc(2026, 10, 25, 2, 30))
    expect([first, second]).toContain(ms)
    expect(ms).toBe(first)
    expect(zoneOffsetMinutes('Europe/Oslo', ms)).toBe(120)
  })

  test('America/New_York 2026-11-01 01:30 picks the first occurrence (EDT)', () => {
    const first = utcMs(2026, 11, 1, 5, 30)
    const second = utcMs(2026, 11, 1, 6, 30)
    const ms = wallClockToUtc('America/New_York', wc(2026, 11, 1, 1, 30))
    expect([first, second]).toContain(ms)
    expect(ms).toBe(first)
    expect(zoneOffsetMinutes('America/New_York', ms)).toBe(-240)
  })

  test('Australia/Sydney 2026-04-05 02:30 picks the first occurrence (AEDT)', () => {
    const first = utcMs(2026, 4, 4, 15, 30)
    const second = utcMs(2026, 4, 4, 16, 30)
    const ms = wallClockToUtc('Australia/Sydney', wc(2026, 4, 5, 2, 30))
    expect([first, second]).toContain(ms)
    expect(ms).toBe(first)
    expect(zoneOffsetMinutes('Australia/Sydney', ms)).toBe(660)
  })

  test('the ambiguous result renders back as the named wall clock', () => {
    // Whichever occurrence is chosen, it must actually read 02:30.
    const ms = wallClockToUtc('Europe/Oslo', wc(2026, 10, 25, 2, 30))
    expect(wallClockIn('Europe/Oslo', ms)).toEqual(wc(2026, 10, 25, 2, 30))
  })
})

describe('formatOffset', () => {
  test('always two digit hours and minutes with an ASCII sign', () => {
    // String forms are deterministic, so exact comparison.
    expect(formatOffset(0)).toBe('+00:00')
    expect(formatOffset(60)).toBe('+01:00')
    expect(formatOffset(345)).toBe('+05:45')
    expect(formatOffset(765)).toBe('+12:45')
    expect(formatOffset(840)).toBe('+14:00')
    expect(formatOffset(-300)).toBe('-05:00')
    expect(formatOffset(-150)).toBe('-02:30')
    expect(formatOffset(-720)).toBe('-12:00')
  })
})

describe('formatOffsetShort', () => {
  test('drops the minutes when they are zero', () => {
    expect(formatOffsetShort(0)).toBe('+0')
    expect(formatOffsetShort(120)).toBe('+2')
    expect(formatOffsetShort(840)).toBe('+14')
  })

  test('keeps fractional offsets', () => {
    expect(formatOffsetShort(345)).toBe('+5:45')
    expect(formatOffsetShort(630)).toBe('+10:30')
    expect(formatOffsetShort(-150)).toBe('−2:30')
  })

  test('negative offsets use the Unicode minus sign, not a hyphen', () => {
    expect(formatOffsetShort(-300)).toBe('−5')
    expect(formatOffsetShort(-300).charAt(0)).toBe('−')
    expect(formatOffsetShort(-300)).not.toContain('-')
  })
})

describe('isValidZone', () => {
  test('accepts real zones including aliases and Etc ids', () => {
    // Both alias spellings must be usable: engines differ on which they list
    // but every engine formats both, so validity is asserted, not membership.
    for (const zone of [
      'UTC',
      'Europe/Oslo',
      'America/New_York',
      'Asia/Tokyo',
      'Asia/Kolkata',
      'Asia/Calcutta',
      'Asia/Kathmandu',
      'Asia/Katmandu',
      'Etc/GMT+12',
      'Etc/GMT-14',
    ]) {
      expect(isValidZone(zone)).toBe(true)
    }
  })

  test('rejects nonsense without throwing', () => {
    for (const zone of ['Not/AZone', 'Mars/Olympus_Mons', 'Europe/Atlantis', '', '  ', 'GMT+25:99', '!!!']) {
      expect(() => isValidZone(zone)).not.toThrow()
      expect(isValidZone(zone)).toBe(false)
    }
  })
})

describe('localZone', () => {
  test('returns a zone the validator accepts', () => {
    const zone = localZone()
    expect(typeof zone).toBe('string')
    expect(zone.length).toBeGreaterThan(0)
    expect(isValidZone(zone)).toBe(true)
  })
})

describe('listZones', () => {
  test('returns a non empty sorted list containing UTC', () => {
    expect(() => listZones()).not.toThrow()
    const zones = listZones()
    expect(zones.length).toBeGreaterThan(0)
    expect(zones).toContain('UTC')
    // Sorted under the same comparator the implementation uses.
    const sorted = [...zones].sort((a, b) => a.localeCompare(b))
    expect(zones).toEqual(sorted)
  })
})

describe('wallClockIn', () => {
  test('local midnight reads hour 0, never 24', () => {
    // Instants computed by hand from each zone's fixed August 2026 offset, so
    // every one is exactly 2026-08-15 00:00:00 on that zone's wall clock.
    const midnights: Array<[string, number]> = [
      ['UTC', utcMs(2026, 8, 15, 0)],
      ['Europe/Oslo', utcMs(2026, 8, 14, 22)],
      ['Asia/Kathmandu', utcMs(2026, 8, 14, 18, 15)],
      ['Pacific/Kiritimati', utcMs(2026, 8, 14, 10)],
      ['America/New_York', utcMs(2026, 8, 15, 4)],
    ]
    for (const [zone, ms] of midnights) {
      expect(wallClockIn(zone, ms)).toEqual(wc(2026, 8, 15, 0, 0, 0))
    }
  })

  test('hour stays in 0..23 across two full days in a spread of zones', () => {
    const zones = ['UTC', 'Europe/Oslo', 'America/New_York', 'Asia/Kathmandu', 'Pacific/Kiritimati', 'Pacific/Chatham']
    const start = utcMs(2026, 8, 14, 0)
    for (const zone of zones) {
      for (let h = 0; h < 48; h++) {
        const clock = wallClockIn(zone, start + h * 3_600_000)
        // Hour is an integer by construction, so strict bounds are exact.
        expect(clock.hour).toBeGreaterThanOrEqual(0)
        expect(clock.hour).toBeLessThan(24)
      }
    }
  })
})
