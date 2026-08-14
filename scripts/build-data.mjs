// Turns Natural Earth vector data into one compact binary the app loads at startup.
//
//   node scripts/build-data.mjs
//
// Downloads are cached under scripts/.cache so repeat runs are offline and fast.
// The output lands in src/assets/world.bin and is imported through Vite's ?url,
// which means it becomes a data URI in the single file build.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'
import { cached, cachedJson, NE } from './lib/fetch-cache.mjs'
import { Packer, collectPolygons, collectLines, ringCentroid, quantLon, quantLat } from './lib/pack.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'src', 'assets')

const vertices = (p) => p.coords.length / 2

/** mapshaper emits a bare GeometryCollection when no properties survive. */
function asFeatureCollection(geojson) {
  if (geojson.type === 'FeatureCollection') return geojson
  if (geojson.type === 'GeometryCollection') {
    return { type: 'FeatureCollection', features: geojson.geometries.map((g) => ({ type: 'Feature', geometry: g, properties: {} })) }
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: geojson, properties: {} }] }
}

async function simplify(geojson, name, commands) {
  const input = { 'in.json': Buffer.from(JSON.stringify(geojson), 'utf8') }
  const out = await mapshaper.applyCommands(`-i in.json snap ${commands} -o out.json format=geojson`, input)
  const result = asFeatureCollection(JSON.parse(Buffer.from(out['out.json']).toString('utf8')))
  const before = countVertices(geojson)
  const after = countVertices(result)
  console.log(`  ${name}: ${before} -> ${after} vertices (${((after / before) * 100).toFixed(0)}%)`)
  return result
}

function countVertices(fc) {
  let n = 0
  const walk = (c) => {
    if (typeof c[0] === 'number') n++
    else for (const child of c) walk(child)
  }
  for (const f of fc.features) if (f.geometry) walk(f.geometry.coordinates)
  return n
}

/** A timezone id is usable if the runtime can actually format with it. */
function usableZone(id) {
  if (!id) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: id }).format(0)
    return id
  } catch {
    return null
  }
}

console.log('Heliograph data pipeline')

// ---------------------------------------------------------------- land + lakes
console.log('\nland')
const landRaw = await cachedJson(`${NE}/ne_50m_land.geojson`, 'ne_50m_land.geojson')
const land = collectPolygons(landRaw.features)
console.log(`  land: ${landRaw.features.length} features, ${vertices(land)} vertices`)

const lakesRaw = await cachedJson(`${NE}/ne_50m_lakes.geojson`, 'ne_50m_lakes.geojson')
// scalerank 0-2 is roughly "a lake you would name on a world map".
const bigLakes = { type: 'FeatureCollection', features: lakesRaw.features.filter((f) => (f.properties?.scalerank ?? 9) <= 2) }
const lakes = collectPolygons(bigLakes.features)
console.log(`  lakes: ${bigLakes.features.length} features, ${vertices(lakes)} vertices`)

// ---------------------------------------------------------------- borders
console.log('\nborders')
const bordersRaw = await cachedJson(
  `${NE}/ne_50m_admin_0_boundary_lines_land.geojson`,
  'ne_50m_borders.geojson',
)
const bordersSimple = await simplify(bordersRaw, 'borders', '-simplify 25% keep-shapes -filter-fields')
const borders = collectLines(bordersSimple.features)
console.log(`  borders: ${borders.stripStarts.length - 1} strips, ${borders.coords.length / 2} vertices`)

// ---------------------------------------------------------------- cities
console.log('\ncities')
const placesRaw = await cachedJson(`${NE}/ne_10m_populated_places_simple.geojson`, 'ne_10m_places.geojson')
const cities = placesRaw.features
  .map((f) => ({
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    pop: Math.max(f.properties.pop_max ?? 0, f.properties.pop_min ?? 0, 1000),
    name: f.properties.nameascii || f.properties.name || '',
    country: f.properties.adm0name || '',
    capital: f.properties.adm0cap === 1,
  }))
  .sort((a, b) => b.pop - a.pop)

// Brightness follows log population, so a megacity is a few times brighter than a
// town rather than a thousand times. 1e3 people maps to 0, 4e7 maps to 255.
const LOG_MIN = Math.log10(1000)
const LOG_MAX = Math.log10(4e7)
const cityLon = new Uint16Array(cities.length)
const cityLat = new Uint16Array(cities.length)
const cityMag = new Uint8Array(cities.length)
const cityFlags = new Uint8Array(cities.length)
cities.forEach((c, i) => {
  cityLon[i] = quantLon(c.lon)
  cityLat[i] = quantLat(c.lat)
  const t = (Math.log10(c.pop) - LOG_MIN) / (LOG_MAX - LOG_MIN)
  cityMag[i] = Math.max(0, Math.min(255, Math.round(t * 255)))
  cityFlags[i] = c.capital ? 1 : 0
})
// Only the places worth naming get a label; the rest are pure light.
const NAMED_MIN_POP = 100_000
const named = cities.filter((c) => c.pop >= NAMED_MIN_POP)
console.log(`  cities: ${cities.length} points, ${named.length} named`)

// ---------------------------------------------------------------- timezones
console.log('\ntimezones')
const tzRaw = await cachedJson(`${NE}/ne_10m_time_zones.geojson`, 'ne_10m_time_zones.geojson')
const tzSimple = await simplify(
  tzRaw,
  'timezones',
  '-simplify 8% keep-shapes -filter-fields zone,tz_name1st,places,dst_places,utc_format',
)
// Simplification can null out a geometry entirely. Drop those first so the packed
// feature offsets stay index-aligned with the metadata array.
const tzFeatures = tzSimple.features.filter((f) => f.geometry)
const tz = collectPolygons(tzFeatures)

const tzMeta = tzFeatures.map((f) => {
  const p = f.properties ?? {}
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  let best = null
  for (const polygon of polygons) {
    const outer = polygon[0]
    if (!outer || outer.length < 3) continue
    const [cx, cy, area] = ringCentroid(outer)
    if (!best || area > best.area) {
      const lons = outer.map((v) => v[0])
      const lats = outer.map((v) => v[1])
      best = {
        area,
        anchor: [cx, cy],
        bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      }
    }
  }
  return {
    offset: Number(p.zone ?? 0),
    iana: usableZone(p.tz_name1st),
    places: p.places ?? '',
    dstPlaces: p.dst_places ?? '',
    anchor: best ? [round4(best.anchor[0]), round4(best.anchor[1])] : [0, 0],
    bbox: best ? best.bbox.map(round4) : [0, 0, 0, 0],
    area: round4(best?.area ?? 0),
  }
})
const resolved = tzMeta.filter((m) => m.iana).length
console.log(`  timezones: ${tzMeta.length} features, ${vertices(tz)} vertices, ${resolved} with an IANA id`)

// ---------------------------------------------------------------- pack
function round4(n) {
  return Math.round(n * 1e4) / 1e4
}

const packer = new Packer()
const manifest = {
  version: 1,
  quant: { lon: [-180, 180], lat: [-90, 90], scale: 65535 },
  land: {
    coords: packer.add(land.coords),
    ringStarts: packer.add(land.ringStarts),
    polyStarts: packer.add(land.polyStarts),
  },
  lakes: {
    coords: packer.add(lakes.coords),
    ringStarts: packer.add(lakes.ringStarts),
    polyStarts: packer.add(lakes.polyStarts),
  },
  borders: {
    coords: packer.add(borders.coords),
    stripStarts: packer.add(borders.stripStarts),
  },
  cities: {
    lon: packer.add(cityLon),
    lat: packer.add(cityLat),
    magnitude: packer.add(cityMag),
    flags: packer.add(cityFlags),
    names: named.map((c) => [c.name, c.country, c.pop]),
  },
  timezones: {
    coords: packer.add(tz.coords),
    ringStarts: packer.add(tz.ringStarts),
    polyStarts: packer.add(tz.polyStarts),
    featureStarts: packer.add(tz.featureStarts),
    meta: tzMeta,
  },
}

const bytes = packer.build(manifest)
await mkdir(OUT_DIR, { recursive: true })
await writeFile(join(OUT_DIR, 'world.bin'), bytes)

console.log(`\nwrote src/assets/world.bin  ${(bytes.length / 1024).toFixed(0)} KB`)
console.log(`  as a data URI that is about ${((bytes.length * 4) / 3 / 1024).toFixed(0)} KB`)
