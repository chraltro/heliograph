import { describe, expect, test } from 'vitest'
import {
  linearRgbToOklab,
  oklabToLinearRgb,
  srgbToLinear,
  linearToSrgb,
  hexToLinearRgb,
  linearRgbToHex,
  sampleSurfaceRamp,
  buildSurfaceLut,
  RAMP_ELEVATIONS,
  RAMP_RANGE,
  SURFACE_RAMPS,
  type Rgb,
  type SurfaceName,
} from '../src/render/palette.ts'
import {
  project,
  unproject,
  wrapLongitude,
  clampView,
  zoomAt,
  panBy,
  wrapCopies,
  worldWidth,
  worldHeight,
  type Size,
  type View,
} from '../src/render/view.ts'
import { triangulate, ringSegments, stripSegments, featureRingRanges } from '../src/render/geometry.ts'
import type { Polygons, Lines } from '../src/data/world.ts'

const surfaces = Object.keys(SURFACE_RAMPS) as SurfaceName[]

const oklabOf = (rgb: Rgb): Rgb => linearRgbToOklab(rgb[0], rgb[1], rgb[2])

const oklabDistance = (a: Rgb, b: Rgb): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('palette colour space', () => {
  test('linearRgbToOklab and oklabToLinearRgb are inverses', () => {
    const samples: Rgb[] = [
      [0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1],
      [0.5, 0.5, 0.5], [0.02, 0.7, 0.3], [0.9, 0.05, 0.6], [0.25, 0.1, 0.8], [0.7, 0.6, 0.01],
    ]
    for (const [r, g, b] of samples) {
      const [l, a, bb] = linearRgbToOklab(r, g, b)
      const back = oklabToLinearRgb(l, a, bb)
      // 5e-7: the coefficients match Ottosson's reference exactly, and those
      // published ten digit matrices are mutual inverses only to about 2.7e-7
      // (measured maximum 2.61e-7, at white), so that is the floor any faithful
      // implementation can reach. A single wrong digit in a coefficient moves
      // the round trip by 1e-5 or more, so this still catches transcription errors.
      expect(Math.abs(back[0] - r)).toBeLessThanOrEqual(5e-7)
      expect(Math.abs(back[1] - g)).toBeLessThanOrEqual(5e-7)
      expect(Math.abs(back[2] - b)).toBeLessThanOrEqual(5e-7)
    }
  })

  test('srgbToLinear and linearToSrgb are inverses across 0 to 1', () => {
    for (let i = 0; i <= 1000; i++) {
      const v = i / 1000
      // 1e-12: a single pow round trip in doubles loses at most a few ulps,
      // and both branch points sit exactly on the piecewise seam.
      expect(Math.abs(linearToSrgb(srgbToLinear(v)) - v)).toBeLessThanOrEqual(1e-12)
      expect(Math.abs(srgbToLinear(linearToSrgb(v)) - v)).toBeLessThanOrEqual(1e-12)
    }
  })

  test('hexToLinearRgb and linearRgbToHex round trip every ramp hex', () => {
    for (const surface of surfaces) {
      for (const hex of SURFACE_RAMPS[surface]) {
        // Exact: decoding and re-encoding an 8 bit channel must land on the
        // same byte, since the transfer functions are inverses.
        expect(linearRgbToHex(hexToLinearRgb(hex))).toBe(hex)
      }
    }
  })
})

describe('surface ramps', () => {
  test('sampleSurfaceRamp reproduces every published stop exactly', () => {
    for (const surface of surfaces) {
      for (let i = 0; i < RAMP_ELEVATIONS.length; i++) {
        const rgb = sampleSurfaceRamp(surface, RAMP_ELEVATIONS[i]!)
        // Exact hex equality: at a stop the interpolation weight is 0 or 1, so
        // only the OKLab round trip (error near 1e-8 in linear light) sits
        // between the stored hex and the sample, and 8 bit quantisation
        // absorbs that entirely.
        expect(linearRgbToHex(rgb)).toBe(SURFACE_RAMPS[surface][i])
      }
    }
  })

  test('sampleSurfaceRamp clamps beyond the ramp and never returns NaN', () => {
    for (const surface of surfaces) {
      const top = hexToLinearRgb(SURFACE_RAMPS[surface][0]!)
      const bottom = hexToLinearRgb(SURFACE_RAMPS[surface][RAMP_ELEVATIONS.length - 1]!)
      for (const e of [90.0001, 91, 120, 100000]) {
        // Exact: above the first stop the function returns the decoded hex directly.
        expect(sampleSurfaceRamp(surface, e)).toEqual(top)
      }
      for (const e of [-25.0001, -26, -60, -100000]) {
        expect(sampleSurfaceRamp(surface, e)).toEqual(bottom)
      }
      for (let e = 130; e >= -65; e -= 0.25) {
        const rgb = sampleSurfaceRamp(surface, e)
        expect(Number.isNaN(rgb[0]) || Number.isNaN(rgb[1]) || Number.isNaN(rgb[2])).toBe(false)
      }
    }
  })

  test('OKLab lightness is non increasing as the sun sets', () => {
    // A lightness inversion anywhere in the ramp would render as a bright ring
    // around the terminator, so L must fall monotonically with elevation.
    for (const surface of surfaces) {
      let previous = Infinity
      for (let e = 90; e >= -25; e -= 0.5) {
        const lightness = oklabOf(sampleSurfaceRamp(surface, e))[0]
        // 1e-6: within a segment L is a monotone smoothstep blend of the stop
        // values, so only the hex decode and OKLab round trip noise remains,
        // which sits near 1e-8.
        expect(lightness).toBeLessThanOrEqual(previous + 1e-6)
        previous = lightness
      }
    }
  })

  test('buildSurfaceLut entries survive the tone map back to the stop hexes', () => {
    // 1.55 is DEFAULT_TUNING.exposure in src/render/map-renderer.ts, which is
    // not imported here because it pulls in WebGL.
    const exposure = 1.55
    const size = 2048
    const { min, max } = RAMP_RANGE
    for (const surface of surfaces) {
      const lut = buildSurfaceLut(surface, size, exposure)
      for (let s = 0; s < RAMP_ELEVATIONS.length; s++) {
        const e = RAMP_ELEVATIONS[s]!
        const bin = Math.min(size - 1, Math.max(0, Math.round(((e - min) / (max - min)) * size - 0.5)))
        const hex = SURFACE_RAMPS[surface][s]!
        const wanted = [
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
        ]
        for (let c = 0; c < 3; c++) {
          const scene = lut[bin * 4 + c]!
          const toned = 1 - Math.exp(-scene * exposure)
          const byte = linearToSrgb(toned) * 255
          // Within 2 of 255: the nearest bin centre sits at most half a bin
          // (about 0.028 degrees) from the stop, and the smoothstep is flat at
          // each stop, so quantisation of the table is the only error left.
          expect(Math.abs(byte - wanted[c]!)).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  test('ocean and land converge in deep twilight', () => {
    // Below about -6 degrees the atmosphere is most of what reaches the eye
    // from any surface, so the ramps must sit far closer together there than
    // under the noon sun.
    const dayDistance = oklabDistance(
      oklabOf(sampleSurfaceRamp('ocean', 90)),
      oklabOf(sampleSurfaceRamp('land', 90)),
    )
    for (let e = -6; e >= -25; e -= 1) {
      const twilightDistance = oklabDistance(
        oklabOf(sampleSurfaceRamp('ocean', e)),
        oklabOf(sampleSurfaceRamp('land', e)),
      )
      expect(twilightDistance).toBeLessThan(dayDistance)
    }
  })
})

describe('view', () => {
  const sizes: Size[] = [
    { width: 800, height: 600 },
    { width: 1200, height: 500 },
    { width: 500, height: 900 },
  ]

  test('project and unproject round trip', () => {
    const lons = [-180, -120, -60, 0, 60, 120, 179.5]
    const lats = [-85, -45, 0, 30, 60, 85]
    const centers = [
      { centerLon: 0, centerLat: 0 },
      { centerLon: 100, centerLat: 20 },
      { centerLon: -140, centerLat: -40 },
    ]
    for (const size of sizes) {
      for (const zoom of [1, 2.5, 6, 12]) {
        for (const center of centers) {
          const view: View = { ...center, zoom }
          for (const lon of lons) {
            for (const lat of lats) {
              const [x, y] = project(size, view, lon, lat)
              const [lon2, lat2] = unproject(size, view, x, y)
              // 1e-6 degrees (a decimetre of longitude): the conversions are a
              // handful of double multiplies, so the true error is near 1e-12,
              // and the wrap keeps the comparison seam safe.
              expect(Math.abs(wrapLongitude(lon2 - lon))).toBeLessThanOrEqual(1e-6)
              expect(Math.abs(lat2 - lat)).toBeLessThanOrEqual(1e-6)
            }
          }
        }
      }
    }
  })

  test('wrapLongitude fixed points', () => {
    expect(wrapLongitude(-180)).toBe(180)
    expect(wrapLongitude(180)).toBe(180)
    expect(wrapLongitude(540)).toBe(180)
    expect(wrapLongitude(-190)).toBe(170)
    expect(wrapLongitude(0)).toBe(0)
  })

  test('clampView centres a short plate and never scrolls past a pole', () => {
    // Zoom 1 on an 800x600 viewport: the plate is 400px tall, shorter than the
    // viewport, so the latitude snaps to 0 whatever was asked for.
    const short = clampView({ width: 800, height: 600 }, { centerLon: 10, centerLat: 40, zoom: 1 })
    expect(short.centerLat).toBe(0)

    // Zoom 4: the plate is 1600px tall. The visible half span is 33.75 degrees
    // so the centre must stay within 90 - 33.75 of either pole.
    const size: Size = { width: 800, height: 600 }
    for (const asked of [89, 90, 300, -89, -300]) {
      const tall = clampView(size, { centerLon: 0, centerLat: asked, zoom: 4 })
      const halfSpan = (size.height / 2 / worldHeight(size, tall)) * 180
      // 1e-9: the clamp is a min and a max over exact double arithmetic.
      expect(tall.centerLat + halfSpan).toBeLessThanOrEqual(90 + 1e-9)
      expect(tall.centerLat - halfSpan).toBeGreaterThanOrEqual(-90 - 1e-9)
    }
    expect(clampView(size, { centerLon: 0, centerLat: 89, zoom: 4 }).centerLat).toBeCloseTo(56.25, 9)
    expect(clampView(size, { centerLon: 0, centerLat: -89, zoom: 4 }).centerLat).toBeCloseTo(-56.25, 9)
  })

  test('zoomAt keeps the point under the anchor fixed', () => {
    const cases: Array<{ size: Size; view: View; anchor: [number, number]; factor: number }> = [
      { size: { width: 800, height: 600 }, view: { centerLon: 10, centerLat: 5, zoom: 3 }, anchor: [100, 100], factor: 1.5 },
      { size: { width: 800, height: 600 }, view: { centerLon: 10, centerLat: 5, zoom: 3 }, anchor: [100, 100], factor: 0.75 },
      { size: { width: 800, height: 600 }, view: { centerLon: 10, centerLat: 5, zoom: 3 }, anchor: [700, 500], factor: 1.5 },
      { size: { width: 800, height: 600 }, view: { centerLon: 10, centerLat: 5, zoom: 3 }, anchor: [400, 300], factor: 2 },
      { size: { width: 1000, height: 800 }, view: { centerLon: -60, centerLat: 0, zoom: 2 }, anchor: [300, 350], factor: 2 },
      { size: { width: 1000, height: 800 }, view: { centerLon: -60, centerLat: 0, zoom: 2 }, anchor: [300, 350], factor: 1.25 },
    ]
    for (const { size, view, anchor, factor } of cases) {
      const [lon, lat] = unproject(size, view, anchor[0], anchor[1])
      const zoomed = zoomAt(size, view, anchor[0], anchor[1], factor)
      const [x, y] = project(size, zoomed, lon, lat)
      // 1e-6 px: the recentring solves for the anchor exactly, so with the
      // clamp not engaged (each case keeps the centre inside its legal band)
      // only double rounding remains, far below the one pixel the gesture needs.
      expect(Math.abs(x - anchor[0])).toBeLessThanOrEqual(1e-6)
      expect(Math.abs(y - anchor[1])).toBeLessThanOrEqual(1e-6)
    }
  })

  test('panBy a whole world width returns to the same longitude', () => {
    const size: Size = { width: 800, height: 600 }
    const view: View = { centerLon: 30, centerLat: 10, zoom: 3 }
    const w = worldWidth(size, view)
    for (const dx of [w, -w]) {
      const panned = panBy(size, view, dx, 0)
      // 1e-9 degrees: one multiply, one divide and a wrap in doubles.
      expect(Math.abs(wrapLongitude(panned.centerLon - view.centerLon))).toBeLessThanOrEqual(1e-9)
      expect(panned.centerLat).toBeCloseTo(view.centerLat, 9)
    }
  })

  test('wrapCopies gives three copies only when the world spans the viewport', () => {
    // 800x600: fitWidth is 800, so at zoom 1 the world exactly spans the viewport.
    expect(wrapCopies({ width: 800, height: 600 }, { centerLon: 0, centerLat: 0, zoom: 1 })).toHaveLength(3)
    // 800x300: fitWidth is 600, narrower than the 800px viewport at zoom 1.
    expect(wrapCopies({ width: 800, height: 300 }, { centerLon: 0, centerLat: 0, zoom: 1 })).toHaveLength(1)
    // Same viewport zoomed in: 1200px of world spans the 800px viewport again.
    expect(wrapCopies({ width: 800, height: 300 }, { centerLon: 0, centerLat: 0, zoom: 2 })).toHaveLength(3)
  })
})

describe('geometry', () => {
  // A 10x10 square with a 4x4 hole, as one polygon of one feature.
  const squareWithHole: Polygons = {
    coords: new Float32Array([
      0, 0, 10, 0, 10, 10, 0, 10,
      2, 2, 2, 6, 6, 6, 6, 2,
    ]),
    ringStarts: new Uint32Array([0, 4, 8]),
    polyStarts: new Uint32Array([0, 2]),
    featureStarts: new Uint32Array([0, 1]),
  }

  const signedArea = (mesh: { positions: Float32Array; indices: Uint32Array }): number => {
    let total = 0
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i]! * 2
      const b = mesh.indices[i + 1]! * 2
      const c = mesh.indices[i + 2]! * 2
      const ax = mesh.positions[a]!
      const ay = mesh.positions[a + 1]!
      total += ((mesh.positions[b]! - ax) * (mesh.positions[c + 1]! - ay)
        - (mesh.positions[c]! - ax) * (mesh.positions[b + 1]! - ay)) / 2
    }
    return total
  }

  test('triangulate preserves the area of a square with a hole', () => {
    const mesh = triangulate(squareWithHole)
    // 1e-6: the fixture coordinates are small integers, exact in float32, so
    // only double accumulation noise separates the sum from 100 - 16.
    expect(Math.abs(Math.abs(signedArea(mesh)) - 84)).toBeLessThanOrEqual(1e-6)
  })

  test('triangulate emits whole triangles with in range indices', () => {
    const mesh = triangulate(squareWithHole)
    expect(mesh.indices.length % 3).toBe(0)
    expect(mesh.indices.length).toBeGreaterThan(0)
    const vertexCount = mesh.positions.length / 2
    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })

  test('ringSegments drops runs along a pole', () => {
    // A ring closed across latitude -90, the way Antarctica is stored.
    const polar: Polygons = {
      coords: new Float32Array([0, -90, 90, -90, 90, -60, 0, -60]),
      ringStarts: new Uint32Array([0, 4]),
      polyStarts: new Uint32Array([0, 1]),
      featureStarts: null,
    }
    const segments = ringSegments(polar)
    // Four edges, one of which runs pole to pole and must be dropped.
    expect(segments.length).toBe(3 * 4)
    for (let i = 0; i < segments.length; i += 4) {
      const bothAtPole = Math.abs(segments[i + 1]!) >= 89.5 && Math.abs(segments[i + 3]!) >= 89.5
      expect(bothAtPole).toBe(false)
    }
  })

  test('stripSegments emits n minus 1 segments and skips short strips', () => {
    const lines: Lines = {
      coords: new Float32Array([
        0, 0, 1, 0, 2, 0, 3, 1,
        5, 5,
        7, 7, 8, 8, 9, 9,
      ]),
      stripStarts: new Uint32Array([0, 4, 5, 8]),
    }
    const segments = stripSegments(lines)
    // Strips of 4, 1 and 3 points give 3 + 0 + 2 segments of four floats each.
    expect(segments.length).toBe(5 * 4)
    expect(Array.from(segments.subarray(0, 4))).toEqual([0, 0, 1, 0])
    // The single point strip contributes nothing.
    for (let i = 0; i < segments.length; i += 2) {
      expect(segments[i] === 5 && segments[i + 1] === 5).toBe(false)
    }
    // The last segment is the final edge of the third strip.
    expect(Array.from(segments.subarray(16, 20))).toEqual([8, 8, 9, 9])
  })

  test('featureRingRanges tiles the ring array', () => {
    // Two features: the first has two polygons (two rings then one ring), the
    // second one polygon of one ring. Four rings of four vertices each.
    const polygons: Polygons = {
      coords: new Float32Array(4 * 4 * 2),
      ringStarts: new Uint32Array([0, 4, 8, 12, 16]),
      polyStarts: new Uint32Array([0, 2, 3, 4]),
      featureStarts: new Uint32Array([0, 2, 3]),
    }
    const ranges = featureRingRanges(polygons)
    expect(ranges).toHaveLength(2)
    expect(ranges[0]!.first).toBe(0)
    for (let f = 0; f + 1 < ranges.length; f++) {
      expect(ranges[f]!.last).toBe(ranges[f + 1]!.first)
    }
    const ringCount = polygons.ringStarts.length - 1
    expect(ranges[ranges.length - 1]!.last).toBe(ringCount)
  })
})
