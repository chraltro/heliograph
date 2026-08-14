import type { City, TimezoneMeta, WorldData } from './world.ts'

/** Spatial lookups the interface needs while the pointer moves. */

interface FeatureBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
  firstPoly: number
  lastPoly: number
  area: number
}

export interface ZoneHit {
  index: number
  meta: TimezoneMeta
  /** An IANA identifier where Natural Earth gave one. */
  iana: string | null
  /** Standard time offset in minutes, used when there is no IANA id. */
  standardOffsetMinutes: number
}

/**
 * Which time zone polygon covers a point.
 *
 * Natural Earth's zone polygons carry a nominal standard offset and, for a bit
 * over half of them, a representative IANA identifier. Where there is one, the
 * runtime's own database supplies the real offset including daylight saving.
 * Where there is not (mostly the nautical zones out at sea) the nominal offset
 * is correct anyway, because nobody at sea observes summer time.
 */
export class ZoneIndex {
  private readonly boxes: FeatureBox[] = []

  constructor(private readonly world: WorldData) {
    const { timezones, timezoneMeta } = world
    const { coords, ringStarts, polyStarts, featureStarts } = timezones
    if (!featureStarts) return
    for (let f = 0; f + 1 < featureStarts.length; f++) {
      const firstPoly = featureStarts[f]!
      const lastPoly = featureStarts[f + 1]!
      let minLon = Infinity
      let minLat = Infinity
      let maxLon = -Infinity
      let maxLat = -Infinity
      for (let p = firstPoly; p < lastPoly; p++) {
        const firstRing = polyStarts[p]!
        const lastRing = polyStarts[p + 1]!
        for (let r = firstRing; r < lastRing; r++) {
          const start = ringStarts[r]!
          const end = ringStarts[r + 1]!
          for (let v = start; v < end; v++) {
            const lon = coords[v * 2]!
            const lat = coords[v * 2 + 1]!
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          }
        }
      }
      this.boxes.push({
        minLon,
        minLat,
        maxLon,
        maxLat,
        firstPoly,
        lastPoly,
        area: timezoneMeta[f]?.area ?? 0,
      })
    }
  }

  get count(): number {
    return this.boxes.length
  }

  at(lon: number, lat: number): ZoneHit | null {
    // Smallest first, so an enclave wins over the zone that surrounds it.
    const candidates: number[] = []
    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i]!
      if (lon < box.minLon || lon > box.maxLon || lat < box.minLat || lat > box.maxLat) continue
      candidates.push(i)
    }
    candidates.sort((a, b) => (this.boxes[a]!.area ?? 0) - (this.boxes[b]!.area ?? 0))
    for (const index of candidates) {
      if (this.contains(index, lon, lat)) return this.hit(index)
    }
    return null
  }

  private hit(index: number): ZoneHit | null {
    const meta = this.world.timezoneMeta[index]
    if (!meta) return null
    return {
      index,
      meta,
      iana: meta.iana,
      standardOffsetMinutes: Math.round(meta.offset * 60),
    }
  }

  private contains(index: number, lon: number, lat: number): boolean {
    const box = this.boxes[index]
    if (!box) return false
    const { coords, ringStarts, polyStarts } = this.world.timezones
    let inside = false
    for (let p = box.firstPoly; p < box.lastPoly; p++) {
      const firstRing = polyStarts[p]!
      const lastRing = polyStarts[p + 1]!
      for (let r = firstRing; r < lastRing; r++) {
        const start = ringStarts[r]!
        const end = ringStarts[r + 1]!
        // Even-odd crossing count. Holes flip the result, which is what we want.
        for (let i = start, j = end - 1; i < end; j = i++) {
          const yi = coords[i * 2 + 1]!
          const yj = coords[j * 2 + 1]!
          if (yi > lat !== yj > lat) {
            const xi = coords[i * 2]!
            const xj = coords[j * 2]!
            if (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
          }
        }
      }
    }
    return inside
  }
}

/** The nearest place worth naming, for the readout under the pointer. */
export class PlaceIndex {
  private readonly cells = new Map<number, City[]>()
  private readonly cellSize = 5

  constructor(cities: City[], namedCount: number) {
    for (let i = 0; i < namedCount && i < cities.length; i++) {
      const city = cities[i]!
      const key = this.key(city.lon, city.lat)
      const bucket = this.cells.get(key)
      if (bucket) bucket.push(city)
      else this.cells.set(key, [city])
    }
  }

  private key(lon: number, lat: number): number {
    const x = Math.floor((lon + 180) / this.cellSize)
    const y = Math.floor((lat + 90) / this.cellSize)
    return y * 1000 + x
  }

  /**
   * Nearest named place within a radius in degrees, weighted so a city ten times
   * larger wins from a little further away.
   */
  nearest(lon: number, lat: number, radiusDeg = 4): City | null {
    const cellsAcross = Math.ceil(radiusDeg / this.cellSize)
    let best: City | null = null
    let bestScore = Infinity
    for (let dy = -cellsAcross; dy <= cellsAcross; dy++) {
      for (let dx = -cellsAcross; dx <= cellsAcross; dx++) {
        const bucket = this.cells.get(this.key(lon + dx * this.cellSize, lat + dy * this.cellSize))
        if (!bucket) continue
        for (const city of bucket) {
          let dLon = city.lon - lon
          if (dLon > 180) dLon -= 360
          if (dLon < -180) dLon += 360
          // Longitude degrees shrink toward the poles.
          const scale = Math.cos((lat * Math.PI) / 180)
          const distance = Math.hypot(dLon * scale, city.lat - lat)
          if (distance > radiusDeg) continue
          const score = distance / (1 + Math.log10(Math.max(1, city.population)) / 4)
          if (score < bestScore) {
            bestScore = score
            best = city
          }
        }
      }
    }
    return best
  }
}
