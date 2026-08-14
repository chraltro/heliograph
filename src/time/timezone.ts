/**
 * Time zone arithmetic built entirely on Intl, so the rules come from the
 * runtime's own IANA database and daylight saving is always current. No zone
 * table ships with the app.
 */

const MS_PER_MINUTE = 60_000

/** Intl.DateTimeFormat is expensive to construct, so keep one per zone. */
const formatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(zone, f)
  }
  return f
}

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** True when the runtime recognises this zone identifier. */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Read the wall clock a zone shows at an instant. */
export function wallClockIn(zone: string, ms: number): WallClock {
  const parts = partsFormatter(zone).formatToParts(new Date(ms))
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    for (const p of parts) if (p.type === type) return Number(p.value)
    return 0
  }
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Some engines have historically reported hour 24 for midnight.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * Offset from UTC in minutes at an instant, positive east.
 * Derived by asking the zone what time it shows and differencing, which works
 * for every offset the database contains including the 45 minute ones.
 */
export function zoneOffsetMinutes(zone: string, ms: number): number {
  const w = wallClockIn(zone, ms)
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  // Drop sub-second detail on both sides so the difference lands on a whole minute.
  return Math.round((asIfUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE)
}

/**
 * Convert a wall clock reading in a zone to the UTC instant it names.
 *
 * Two passes handle the daylight saving discontinuities, following the same
 * policy the Temporal proposal calls "compatible", which is what every calendar
 * application does:
 *
 *   Spring forward. The named time does not exist, because the clocks jumped
 *   over it. Return the instant the same distance past the transition as the
 *   named time was past the start of the gap, which is what a person means when
 *   they set an alarm for a time that got skipped.
 *
 *   Autumn fall back. The named time happens twice. Return the earlier of the
 *   two, the one still on summer time.
 */
export function wallClockToUtc(zone: string, w: WallClock): number {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  const before = zoneOffsetMinutes(zone, naive - 12 * 60 * MS_PER_MINUTE)
  const after = zoneOffsetMinutes(zone, naive + 12 * 60 * MS_PER_MINUTE)

  const candidateA = naive - before * MS_PER_MINUTE
  const candidateB = naive - after * MS_PER_MINUTE

  // A candidate is real only if reading the clock back at that instant returns
  // the time we were asked for.
  const realA = zoneOffsetMinutes(zone, candidateA) === before
  const realB = zoneOffsetMinutes(zone, candidateB) === after

  if (realA && realB) return Math.min(candidateA, candidateB)
  if (realA) return candidateA
  if (realB) return candidateB
  // Neither reading exists, so the named time is inside a gap. Both candidates
  // land the same distance either side of it; the later one is the first real
  // instant at or after the skipped time.
  return Math.max(candidateA, candidateB)
}

/** Zone abbreviation as the runtime names it, for example CEST or GMT+5:45. */
export function zoneAbbreviation(zone: string, ms: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(
      new Date(ms),
    )
    for (const p of parts) if (p.type === 'timeZoneName') return p.value
  } catch {
    // fall through
  }
  return formatOffset(zoneOffsetMinutes(zone, ms))
}

/**
 * True when the zone is currently running ahead of its own winter offset.
 * Found by comparing against the smallest offset the zone uses across the year.
 */
export function isDaylightSaving(zone: string, ms: number): boolean {
  const now = zoneOffsetMinutes(zone, ms)
  const year = new Date(ms).getUTCFullYear()
  let standard = Infinity
  for (let month = 0; month < 12; month++) {
    standard = Math.min(standard, zoneOffsetMinutes(zone, Date.UTC(year, month, 15)))
  }
  return now > standard
}

/** Render an offset in minutes as +HH:MM. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Shorter form used on the map, where +05:45 matters but +02:00 can lose its zeros. */
export function formatOffsetShort(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `${sign}${h}` : `${sign}${h}:${String(m).padStart(2, '0')}`
}

let zoneCache: string[] | null = null

/** Every zone the runtime knows, sorted. Falls back to a small set if unsupported. */
export function listZones(): string[] {
  if (zoneCache) return zoneCache
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  let zones: string[]
  if (typeof supported === 'function') {
    try {
      zones = supported.call(Intl, 'timeZone')
    } catch {
      zones = FALLBACK_ZONES.slice()
    }
  } else {
    zones = FALLBACK_ZONES.slice()
  }
  if (!zones.includes('UTC')) zones = ['UTC', ...zones]
  zoneCache = zones.sort((a, b) => a.localeCompare(b))
  return zoneCache
}

/** The zone the browser is set to, or UTC if it cannot be read. */
export function localZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (resolved && isValidZone(resolved)) return resolved
  } catch {
    // fall through
  }
  return 'UTC'
}

const FALLBACK_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Oslo',
  'Europe/Moscow',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Honolulu',
]
