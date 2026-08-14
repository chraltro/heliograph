import earcut from 'earcut'
import type { Lines, Polygons } from '../data/world.ts'

export interface Mesh {
  /** Interleaved lon, lat pairs. */
  positions: Float32Array
  indices: Uint32Array
  /** Feature index per vertex, for layers that need to address features. */
  featureIds: Float32Array | null
}

/**
 * Triangulate polygon features with earcut, one call per polygon so holes work.
 * Natural Earth splits geometry at the antimeridian, so treating longitude and
 * latitude as plain cartesian coordinates is safe here.
 */
export function triangulate(polygons: Polygons, withFeatureIds = false): Mesh {
  const { coords, ringStarts, polyStarts, featureStarts } = polygons
  const positions = coords
  const indices: number[] = []
  const featureIds = withFeatureIds ? new Float32Array(coords.length / 2) : null

  // Which feature does each polygon belong to?
  const polyFeature = new Uint32Array(Math.max(0, polyStarts.length - 1))
  if (featureStarts && withFeatureIds) {
    for (let f = 0; f + 1 < featureStarts.length; f++) {
      for (let p = featureStarts[f]!; p < featureStarts[f + 1]!; p++) polyFeature[p] = f
    }
  }

  const polygonCount = polyStarts.length - 1
  for (let p = 0; p < polygonCount; p++) {
    const firstRing = polyStarts[p]!
    const lastRing = polyStarts[p + 1]!
    if (lastRing <= firstRing) continue
    const vertexStart = ringStarts[firstRing]!
    const vertexEnd = ringStarts[lastRing]!
    if (vertexEnd - vertexStart < 3) continue

    const flat = positions.subarray(vertexStart * 2, vertexEnd * 2)
    const holes: number[] = []
    for (let r = firstRing + 1; r < lastRing; r++) holes.push(ringStarts[r]! - vertexStart)

    const tri = earcut(flat, holes, 2)
    for (let i = 0; i < tri.length; i++) indices.push(tri[i]! + vertexStart)

    if (featureIds) {
      const id = polyFeature[p] ?? 0
      for (let v = vertexStart; v < vertexEnd; v++) featureIds[v] = id
    }
  }

  return { positions, indices: new Uint32Array(indices), featureIds }
}

/**
 * Turn closed rings into line segments for the instanced line renderer.
 * Each instance is four floats: the two endpoints in degrees.
 *
 * Segments that run along a pole are dropped. Antarctica's polygon is closed
 * across latitude -90, which is a boundary of the projection rather than a
 * shore, and stroking it draws a bright rule along the bottom of the map.
 */
export function ringSegments(polygons: Polygons): Float32Array {
  const { coords, ringStarts } = polygons
  const ringCount = ringStarts.length - 1
  const POLE = 89.5
  const segments: number[] = []
  for (let r = 0; r < ringCount; r++) {
    const start = ringStarts[r]!
    const n = ringStarts[r + 1]! - start
    if (n < 3) continue
    for (let i = 0; i < n; i++) {
      const a = (start + i) * 2
      const b = (start + ((i + 1) % n)) * 2
      const lat0 = coords[a + 1]!
      const lat1 = coords[b + 1]!
      if (Math.abs(lat0) >= POLE && Math.abs(lat1) >= POLE) continue
      segments.push(coords[a]!, lat0, coords[b]!, lat1)
    }
  }
  return new Float32Array(segments)
}

/** Same, for open line strips such as national borders. */
export function stripSegments(lines: Lines): Float32Array {
  const { coords, stripStarts } = lines
  const stripCount = stripStarts.length - 1
  let total = 0
  for (let s = 0; s < stripCount; s++) {
    const n = stripStarts[s + 1]! - stripStarts[s]!
    if (n >= 2) total += n - 1
  }
  const out = new Float32Array(total * 4)
  let w = 0
  for (let s = 0; s < stripCount; s++) {
    const start = stripStarts[s]!
    const n = stripStarts[s + 1]! - start
    if (n < 2) continue
    for (let i = 0; i + 1 < n; i++) {
      const a = (start + i) * 2
      const b = (start + i + 1) * 2
      out[w++] = coords[a]!
      out[w++] = coords[a + 1]!
      out[w++] = coords[b]!
      out[w++] = coords[b + 1]!
    }
  }
  return out
}

/** Unit quad used as the per-vertex geometry for every instanced line. */
export const LINE_QUAD = new Float32Array([0, -1, 1, -1, 0, 1, 1, 1])

/**
 * Which rings belong to which feature, so callers can address, say, one
 * timezone polygon out of the packed set.
 */
export function featureRingRanges(polygons: Polygons): Array<{ first: number; last: number }> {
  const { polyStarts, featureStarts } = polygons
  if (!featureStarts) return []
  const ranges: Array<{ first: number; last: number }> = []
  for (let f = 0; f + 1 < featureStarts.length; f++) {
    const firstPoly = featureStarts[f]!
    const lastPoly = featureStarts[f + 1]!
    ranges.push({ first: polyStarts[firstPoly] ?? 0, last: polyStarts[lastPoly] ?? 0 })
  }
  return ranges
}
