import { MS_PER_HOUR, MS_PER_MINUTE } from '../solar/solar.ts'
import { wallClockIn, zoneAbbreviation, zoneOffsetMinutes } from '../time/timezone.ts'

/** Every reading the interface shows, formatted in one place. */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const pad = (n: number, width = 2) => String(Math.floor(Math.abs(n))).padStart(width, '0')

/** Minus sign, not a hyphen. The hyphen is a word joiner and reads short. */
export const MINUS = '−'

export function signed(value: number, digits = 1): string {
  const rounded = value.toFixed(digits)
  return rounded.startsWith('-') ? MINUS + rounded.slice(1) : rounded
}

export interface Reading {
  hour: number
  minute: number
  second: number
  year: number
  month: number
  day: number
  weekday: number
}

export function readingIn(zone: string, ms: number): Reading {
  const w = wallClockIn(zone, ms)
  // Work out the weekday from the shifted instant rather than a second format
  // call, which keeps this cheap enough to run every frame.
  const shifted = ms + zoneOffsetMinutes(zone, ms) * MS_PER_MINUTE
  return { ...w, weekday: new Date(shifted).getUTCDay() }
}

export function formatClock(reading: Reading, withSeconds = true): string {
  const hm = `${pad(reading.hour)}:${pad(reading.minute)}`
  return withSeconds ? `${hm}:${pad(reading.second)}` : hm
}

export function formatDate(reading: Reading): string {
  return `${pad(reading.day)} ${MONTHS[reading.month - 1]} ${reading.year}`
}

export function formatWeekday(reading: Reading): string {
  return WEEKDAYS[reading.weekday] ?? ''
}

/** Decimal degrees with a hemisphere letter, which is what a chart margin uses. */
export function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
}

export function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
}

export function formatElevation(deg: number): string {
  return `${signed(deg, 1)}°`
}

/** Compass bearing to one decimal, with the nearest cardinal point. */
export function formatAzimuth(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(((deg % 360) / 360) * 16) % 16
  return `${deg.toFixed(1)}° ${points[index]}`
}

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / MS_PER_HOUR)
  const minutes = Math.round((ms - hours * MS_PER_HOUR) / MS_PER_MINUTE)
  if (minutes === 60) return `${hours + 1}h 00m`
  return `${hours}h ${pad(minutes)}m`
}

/** A clock time in a zone, for an event such as sunrise. Null becomes a dash. */
export function formatEventTime(zone: string, ms: number | null): string {
  if (ms === null) return '——:——'.slice(0, 5)
  const reading = readingIn(zone, ms)
  return formatClock(reading, false)
}

export function zoneSummary(zone: string, ms: number): { abbreviation: string; offset: string } {
  const minutes = zoneOffsetMinutes(zone, ms)
  const sign = minutes < 0 ? MINUS : '+'
  const abs = Math.abs(minutes)
  const offset = `UTC${sign}${pad(abs / 60)}:${pad(abs % 60)}`
  return { abbreviation: zoneAbbreviation(zone, ms), offset }
}

/** "Europe/Oslo" reads better in an interface as "Oslo, Europe". */
export function prettyZone(zone: string): string {
  if (zone === 'UTC') return 'Coordinated Universal Time'
  const parts = zone.split('/')
  const city = (parts[parts.length - 1] ?? zone).replace(/_/g, ' ')
  const region = parts.length > 1 ? (parts[0] ?? '').replace(/_/g, ' ') : ''
  return region ? `${city}, ${region}` : city
}
