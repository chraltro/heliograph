import worldUrl from '../assets/world.bin?url'

/** A typed array stored inside world.bin. */
interface Slice {
  offset: number
  length: number
  kind: 'i8' | 'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32'
}

interface PolygonSet {
  coords: Slice
  ringStarts: Slice
  polyStarts: Slice
  featureStarts?: Slice
}

export interface TimezoneMeta {
  /** Nominal standard-time offset in hours from the Natural Earth attribute. */
  offset: number
  /** An IANA identifier when Natural Earth supplied a usable one. */
  iana: string | null
  places: string
  dstPlaces: string
  anchor: [number, number]
  bbox: [number, number, number, number]
  area: number
}

interface Manifest {
  version: number
  land: PolygonSet
  lakes: PolygonSet
  borders: { coords: Slice; stripStarts: Slice }
  cities: { lon: Slice; lat: Slice; magnitude: Slice; flags: Slice; names: Array<[string, string, number]> }
  timezones: PolygonSet & { featureStarts: Slice; meta: TimezoneMeta[] }
}

/** Flat rings in degrees, ready for triangulation or stroking. */
export interface Polygons {
  /** Interleaved lon, lat pairs in degrees. */
  coords: Float32Array
  /** Index of the first vertex of each ring, with a terminator. */
  ringStarts: Uint32Array
  /** Index into ringStarts where each polygon begins, with a terminator. */
  polyStarts: Uint32Array
  /** Index into polyStarts where each feature begins, with a terminator. */
  featureStarts: Uint32Array | null
}

export interface Lines {
  coords: Float32Array
  stripStarts: Uint32Array
}

export interface City {
  lon: number
  lat: number
  /** Relative brightness in 0..1, following log population. */
  magnitude: number
  capital: boolean
  name: string
  country: string
  population: number
}

export interface WorldData {
  land: Polygons
  lakes: Polygons
  borders: Lines
  /** All places, brightest first. Only the first `namedCount` carry a name. */
  cities: City[]
  namedCount: number
  timezones: Polygons
  timezoneMeta: TimezoneMeta[]
}

const CONSTRUCTORS = {
  i8: Int8Array,
  u8: Uint8Array,
  i16: Int16Array,
  u16: Uint16Array,
  i32: Int32Array,
  u32: Uint32Array,
  f32: Float32Array,
} as const

function read(buffer: ArrayBuffer, base: number, slice: Slice) {
  const Ctor = CONSTRUCTORS[slice.kind]
  return new Ctor(buffer, base + slice.offset, slice.length)
}

/** Undo the 16 bit quantisation applied by the data pipeline. */
function dequantise(packed: Uint16Array): Float32Array {
  const out = new Float32Array(packed.length)
  for (let i = 0; i < packed.length; i += 2) {
    out[i] = (packed[i]! / 65535) * 360 - 180
    out[i + 1] = (packed[i + 1]! / 65535) * 180 - 90
  }
  return out
}

function readPolygons(buffer: ArrayBuffer, base: number, set: PolygonSet): Polygons {
  return {
    coords: dequantise(read(buffer, base, set.coords) as Uint16Array),
    ringStarts: read(buffer, base, set.ringStarts) as Uint32Array,
    polyStarts: read(buffer, base, set.polyStarts) as Uint32Array,
    featureStarts: set.featureStarts ? (read(buffer, base, set.featureStarts) as Uint32Array) : null,
  }
}

/** Decode a base64 data URI without a network round trip. */
function decodeDataUri(url: string): ArrayBuffer {
  const comma = url.indexOf(',')
  const payload = url.slice(comma + 1)
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function parseWorld(buffer: ArrayBuffer): WorldData {
  const head = new DataView(buffer)
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))
  if (magic !== 'HGD1') throw new Error(`world.bin has magic ${magic}, expected HGD1`)
  const headerBytes = head.getUint32(4, true)
  const json = new TextDecoder().decode(new Uint8Array(buffer, 8, headerBytes))
  const manifest = JSON.parse(json.replace(/\0+$/, '')) as Manifest
  const base = 8 + headerBytes

  const cityLon = read(buffer, base, manifest.cities.lon) as Uint16Array
  const cityLat = read(buffer, base, manifest.cities.lat) as Uint16Array
  const cityMag = read(buffer, base, manifest.cities.magnitude) as Uint8Array
  const cityFlags = read(buffer, base, manifest.cities.flags) as Uint8Array
  const names = manifest.cities.names

  const cities: City[] = new Array(cityLon.length)
  for (let i = 0; i < cityLon.length; i++) {
    const named = names[i]
    cities[i] = {
      lon: (cityLon[i]! / 65535) * 360 - 180,
      lat: (cityLat[i]! / 65535) * 180 - 90,
      magnitude: cityMag[i]! / 255,
      capital: cityFlags[i] === 1,
      name: named ? named[0] : '',
      country: named ? named[1] : '',
      population: named ? named[2] : 0,
    }
  }

  return {
    land: readPolygons(buffer, base, manifest.land),
    lakes: readPolygons(buffer, base, manifest.lakes),
    borders: {
      coords: dequantise(read(buffer, base, manifest.borders.coords) as Uint16Array),
      stripStarts: read(buffer, base, manifest.borders.stripStarts) as Uint32Array,
    },
    cities,
    namedCount: names.length,
    timezones: readPolygons(buffer, base, manifest.timezones),
    timezoneMeta: manifest.timezones.meta,
  }
}

let pending: Promise<WorldData> | null = null

/** Load and decode the packed world data once per page. */
export function loadWorld(): Promise<WorldData> {
  if (!pending) {
    pending = (async () => {
      const buffer = worldUrl.startsWith('data:')
        ? decodeDataUri(worldUrl)
        : await (await fetch(worldUrl)).arrayBuffer()
      return parseWorld(buffer)
    })()
  }
  return pending
}
