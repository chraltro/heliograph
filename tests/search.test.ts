import { describe, expect, test } from 'vitest'
import type { City } from '../src/data/world.ts'
import { PlaceSearch } from '../src/app/search.ts'

const city = (name: string, country: string, population: number, lon = 0, lat = 0): City => ({
  name,
  country,
  population,
  lon,
  lat,
  magnitude: 0.5,
  capital: false,
})

/**
 * The gazetteer's names are plain ASCII, so what a reader types has to be folded
 * down to that: an accent is easy, a letter that is not an accented letter is
 * not, and the second kind is exactly what the Nordic and Polish names use.
 */
const cities = [
  city('Malmo', 'Sweden', 300_000),
  city('Bodo', 'Norway', 50_000),
  city('Lodz', 'Poland', 700_000),
  city('Sao Paulo', 'Brazil', 12_000_000),
  city('Sao Luis', 'Brazil', 1_000_000),
  city('Reykjavik', 'Iceland', 130_000),
  city('London', 'United Kingdom', 9_000_000),
  city('Londonderry', 'United Kingdom', 85_000),
  city('New York', 'United States of America', 8_500_000),
  city('York', 'United Kingdom', 150_000),
]
const search = new PlaceSearch(cities, cities.length, [])
const labels = (query: string) => search.search(query).map((r) => r.label)

describe('finding a place', () => {
  test('folds accents away', () => {
    expect(labels('Malmö')[0]).toBe('Malmo')
    expect(labels('SÃO')[0]).toBe('Sao Paulo')
    expect(labels('Reykjavík')[0]).toBe('Reykjavik')
  })

  test('folds the letters that are not accented letters', () => {
    // None of these decompose, so a plain NFD pass leaves them in the query.
    expect(labels('Bodø')[0]).toBe('Bodo')
    expect(labels('Łódź')[0]).toBe('Lodz')
    expect(labels('Bodø')).toContain('Bodo')
  })

  test('prefers the bigger place among prefixes', () => {
    expect(labels('sao')).toEqual(['Sao Paulo', 'Sao Luis'])
    expect(labels('lond')[0]).toBe('London')
  })

  test('a whole word beats a prefix beats a substring', () => {
    // "york" is York before it is New York, and "new y" is New York.
    expect(labels('york')[0]).toBe('York')
    expect(labels('new y')[0]).toBe('New York')
  })

  test('says nothing for a query too short to mean anything', () => {
    expect(labels('a')).toEqual([])
    expect(labels('')).toEqual([])
  })
})
