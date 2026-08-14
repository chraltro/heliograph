// A tiny binary container so the whole map payload arrives as one file.
//
//   'HGD1' | uint32 headerBytes | JSON manifest | padding | typed array payloads
//
// Offsets in the manifest are relative to the start of the payload section, which
// the reader locates once and then treats as the origin for every typed array.

const KIND = new Map([
  [Int8Array, 'i8'],
  [Uint8Array, 'u8'],
  [Int16Array, 'i16'],
  [Uint16Array, 'u16'],
  [Int32Array, 'i32'],
  [Uint32Array, 'u32'],
  [Float32Array, 'f32'],
])

export class Packer {
  constructor() {
    this.chunks = []
    this.offset = 0
  }

  /** Append a typed array and return the manifest record describing it. */
  add(array) {
    const kind = KIND.get(array.constructor)
    if (!kind) throw new Error(`unsupported array type ${array.constructor.name}`)
    const align = array.BYTES_PER_ELEMENT
    const pad = (align - (this.offset % align)) % align
    if (pad > 0) {
      this.chunks.push(Buffer.alloc(pad))
      this.offset += pad
    }
    const record = { offset: this.offset, length: array.length, kind }
    this.chunks.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    this.offset += array.byteLength
    return record
  }

  build(manifest) {
    const header = Buffer.from(JSON.stringify(manifest), 'utf8')
    const pad = (8 - ((8 + header.length) % 8)) % 8
    const magic = Buffer.from('HGD1', 'ascii')
    const size = Buffer.alloc(4)
    size.writeUInt32LE(header.length + pad, 0)
    return Buffer.concat([magic, size, header, Buffer.alloc(pad), ...this.chunks])
  }
}

// Longitude and latitude are stored as unsigned 16 bit fractions of their full
// range: about 610 m of longitude at the equator, finer than the 1:50m source.
export const quantLon = (lon) => Math.max(0, Math.min(65535, Math.round(((lon + 180) / 360) * 65535)))
export const quantLat = (lat) => Math.max(0, Math.min(65535, Math.round(((lat + 90) / 180) * 65535)))

/**
 * Flatten GeoJSON polygon features into the flat ring arrays the renderer wants.
 * Closing duplicate vertices are dropped; earcut and the line renderer both
 * re-close rings themselves.
 */
export function collectPolygons(features) {
  const coords = []
  const ringStarts = []
  const polyStarts = []
  const featureStarts = []

  for (const feature of features) {
    const geometry = feature.geometry
    if (!geometry) continue
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    featureStarts.push(polyStarts.length)
    for (const polygon of polygons) {
      polyStarts.push(ringStarts.length)
      for (const ring of polygon) {
        let end = ring.length
        if (end > 1) {
          const first = ring[0]
          const last = ring[end - 1]
          if (first[0] === last[0] && first[1] === last[1]) end -= 1
        }
        if (end < 3) continue
        ringStarts.push(coords.length / 2)
        for (let i = 0; i < end; i++) {
          coords.push(quantLon(ring[i][0]), quantLat(ring[i][1]))
        }
      }
    }
  }
  featureStarts.push(polyStarts.length)
  polyStarts.push(ringStarts.length)
  ringStarts.push(coords.length / 2)

  return {
    coords: new Uint16Array(coords),
    ringStarts: new Uint32Array(ringStarts),
    polyStarts: new Uint32Array(polyStarts),
    featureStarts: new Uint32Array(featureStarts),
  }
}

/** Flatten GeoJSON line features into one coordinate array plus strip offsets. */
export function collectLines(features) {
  const coords = []
  const stripStarts = []
  for (const feature of features) {
    const geometry = feature.geometry
    if (!geometry) continue
    const strips = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
    for (const strip of strips) {
      if (strip.length < 2) continue
      stripStarts.push(coords.length / 2)
      for (const [lon, lat] of strip) coords.push(quantLon(lon), quantLat(lat))
    }
  }
  stripStarts.push(coords.length / 2)
  return { coords: new Uint16Array(coords), stripStarts: new Uint32Array(stripStarts) }
}

/** Signed area centroid of a ring, in degrees. Used to anchor timezone labels. */
export function ringCentroid(ring) {
  let twiceArea = 0
  let x = 0
  let y = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j]
    const [x1, y1] = ring[i]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    x += (x0 + x1) * cross
    y += (y0 + y1) * cross
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sum[0] / ring.length, sum[1] / ring.length, 0]
  }
  return [x / (3 * twiceArea), y / (3 * twiceArea), Math.abs(twiceArea) / 2]
}
