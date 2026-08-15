/**
 * Finding a place.
 *
 * The map already carries a gazetteer of 7,342 places and the runtime carries
 * every IANA zone, so searching needs no network and no index beyond what is
 * already in memory. Ranking is the whole of the work: a query is almost always
 * a prefix of what somebody means, and of the places that match a prefix they
 * almost always mean the biggest one, so population breaks the ties that the
 * text cannot.
 */

import type { City } from '../data/world.ts'
import { prettyZone } from './format.ts'

export interface SearchResult {
  /** What to show. */
  label: string
  detail: string
  lon: number
  lat: number
  /** Set when choosing this should also change the clock basis. */
  zone?: string
  kind: 'place' | 'zone'
}

interface Candidate extends SearchResult {
  score: number
}

const MAX_RESULTS = 8

/** Fold accents and case away, so "Malmo" finds "Malmö" and "SAO" finds "São". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * How well a folded query matches a folded name, or -1 for no match.
 *
 * Whole word beats prefix beats substring, because "york" should offer York
 * before New York and "new y" should offer New York before anything else.
 */
function scoreName(name: string, query: string): number {
  if (name === query) return 1000
  if (name.startsWith(query)) return 700 - (name.length - query.length)
  const wordStart = name.indexOf(` ${query}`)
  if (wordStart >= 0) return 500 - wordStart
  const anywhere = name.indexOf(query)
  if (anywhere >= 0) return 250 - anywhere
  return -1
}

export class PlaceSearch {
  private readonly places: Array<{ folded: string; country: string; city: City }>
  private readonly zones: Array<{ folded: string; zone: string; anchor: [number, number] }>

  constructor(
    cities: readonly City[],
    namedCount: number,
    zones: Array<{ iana: string | null; anchor: [number, number] }>,
  ) {
    this.places = []
    for (let i = 0; i < namedCount; i++) {
      const city = cities[i]!
      this.places.push({ folded: fold(city.name), country: fold(city.country), city })
    }
    this.zones = []
    for (const meta of zones) {
      if (!meta.iana) continue
      this.zones.push({ folded: fold(meta.iana.replace(/_/g, ' ')), zone: meta.iana, anchor: meta.anchor })
    }
  }

  search(query: string): SearchResult[] {
    const q = fold(query.trim())
    if (q.length < 2) return []

    const found: Candidate[] = []
    for (const entry of this.places) {
      let score = scoreName(entry.folded, q)
      // A country name should surface its cities, but never above a place whose
      // own name matches.
      if (score < 0 && entry.country.startsWith(q)) score = 120
      if (score < 0) continue
      // Population is the tie breaker, compressed hard: it should separate
      // London from Londonderry without letting Tokyo win every query.
      const weight = Math.log10(Math.max(10, entry.city.population)) * 12
      found.push({
        label: entry.city.name,
        detail: entry.city.country,
        lon: entry.city.lon,
        lat: entry.city.lat,
        kind: 'place',
        score: score + weight,
      })
    }

    for (const entry of this.zones) {
      const score = scoreName(entry.folded, q)
      if (score < 0) continue
      found.push({
        label: prettyZone(entry.zone),
        detail: 'Time zone',
        lon: entry.anchor[0],
        lat: entry.anchor[1],
        zone: entry.zone,
        kind: 'zone',
        // Zones sit below places of the same name: somebody typing "Oslo"
        // wants the city, and gets its zone with it either way.
        score: score - 60,
      })
    }

    found.sort((a, b) => b.score - a.score)
    return found.slice(0, MAX_RESULTS)
  }
}
