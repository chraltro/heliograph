// Build the land albedo textures from NASA's Blue Marble Next Generation.
//
//   npm run terrain
//
// BMNG is a cloud free monthly composite of MODIS surface reflectance: what the
// land actually looked like from orbit, month by month, through 2004. It is in
// the public domain. Two months are used, the solstice months, because between
// them they carry the whole seasonal swing in both hemispheres at once: June
// has a green Siberia and a snowed-in Patagonia, December has the reverse.
//
// Two files come out:
//
//   terrain.webp         June, full resolution. All the fine detail lives here.
//   terrain-season.webp  December divided by June, small. A smooth ratio field.
//
// The renderer multiplies the base by that ratio, faded in by the season, so
// the sharp detail always comes from one full resolution image while the
// seasonal change rides on top as a low frequency gain. That costs a fifth of
// the memory of holding both months at full size, which matters on a phone,
// and it is why the snow can advance and retreat without the map going soft.
//
// The map only ever samples these inside the land polygons, but a bilinear tap
// near a coast would still average in the sea, so the water is flooded with the
// colour of the nearest land before encoding. Nothing is fetched at runtime.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { cached } from './lib/fetch-cache.mjs'

// NASA BMNG, 5400x2700, mirrored on GitHub because neo.gsfc.nasa.gov does not
// serve a stable direct link. Both are the standard published composites.
const MONTHS = {
  june: 'https://raw.githubusercontent.com/j1Lib/v8thread/master/data/world.topo.bathy.200406.3x5400x2700.png',
  december:
    'https://raw.githubusercontent.com/AlnisS/pasaules-skati/master/data/world.topo.bathy.200412.3x5400x2700.jpg',
}

// The source is 5400 across, so this is very close to native. It is also about
// one texel per device pixel on a phone at the zoom a phone opens at.
const WIDTH = 5120
const HEIGHT = 2560
// The seasonal ratio is a smooth field and rides on the base's detail.
const SEASON_WIDTH = 2560
const SEASON_HEIGHT = 1280
/** Ratios are stored divided by this, so a value above 1 survives 8 bits. */
const RATIO_SCALE = 4

async function load(name, url) {
  const file = await cached(url, `bmng-${name}.${url.endsWith('.png') ? 'png' : 'jpg'}`)
  process.stdout.write(`  ${name}: resampling ... `)
  const { data } = await sharp(file, { limitInputPixels: false })
    .resize(WIDTH, HEIGHT, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  process.stdout.write('done\n')
  return data
}

const june = await load('june', MONTHS.june)
const december = await load('december', MONTHS.december)

/**
 * Blue Marble's ocean is dark and blue and its land never is, so blueness plus
 * darkness is the mask. Sea ice reads as land, which is harmless: it is only
 * ever used as the colour to bleed across a coastline, and no polygon covers it.
 */
const isWater = (data, i) => {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  return b > r + 12 && b > g + 6 && r < 110
}

/**
 * Multi-source BFS from every shoreline pixel, painting the sea with the colour
 * of its nearest land. Longitude wraps; latitude clamps. The mask is taken from
 * June alone so both months are flooded on identical geometry, which keeps the
 * ratio between them meaningful everywhere.
 */
function flood(layers) {
  process.stdout.write('  flooding water with coastal colour ... ')
  const owner = new Int32Array(WIDTH * HEIGHT).fill(-1)
  let queue = []
  for (let p = 0; p < WIDTH * HEIGHT; p++) {
    if (isWater(june, p * 3)) continue
    owner[p] = p
    const x = p % WIDTH
    const y = (p / WIDTH) | 0
    const neighbours = [
      y * WIDTH + ((x + WIDTH - 1) % WIDTH),
      y * WIDTH + ((x + 1) % WIDTH),
      y > 0 ? p - WIDTH : -1,
      y < HEIGHT - 1 ? p + WIDTH : -1,
    ]
    if (neighbours.some((n) => n >= 0 && isWater(june, n * 3))) queue.push(p)
  }
  const landPixels = owner.reduce((n, v) => (v >= 0 ? n + 1 : n), 0)

  while (queue.length > 0) {
    const next = []
    for (const p of queue) {
      const x = p % WIDTH
      const y = (p / WIDTH) | 0
      const source = owner[p]
      for (const n of [
        y * WIDTH + ((x + WIDTH - 1) % WIDTH),
        y * WIDTH + ((x + 1) % WIDTH),
        y > 0 ? p - WIDTH : -1,
        y < HEIGHT - 1 ? p + WIDTH : -1,
      ]) {
        if (n >= 0 && owner[n] === -1) {
          owner[n] = source
          next.push(n)
        }
      }
    }
    queue = next
  }

  for (const data of layers) {
    for (let p = 0; p < WIDTH * HEIGHT; p++) {
      const source = owner[p]
      if (source !== p && source >= 0) {
        data[p * 3] = data[source * 3]
        data[p * 3 + 1] = data[source * 3 + 1]
        data[p * 3 + 2] = data[source * 3 + 2]
      }
    }
  }
  process.stdout.write('done\n')
  return { owner, landPixels }
}

const { owner, landPixels } = flood([june, december])

const landFraction = landPixels / (WIDTH * HEIGHT)
console.log(`  land and permanent ice: ${(landFraction * 100).toFixed(1)}% of the sphere`)
// Land is 29% of the planet; sea ice and the ice shelves read as land here.
if (landFraction < 0.22 || landFraction > 0.5) {
  throw new Error(`water detection failed: land fraction ${(landFraction * 100).toFixed(1)}% is implausible`)
}

const linear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * The median land pixel in linear light, ice left out of the reckoning.
 *
 * The shader divides by this, which turns the imagery into a relative albedo
 * over the spectral ramp and leaves the ramp owning the illumination. It has to
 * be the median rather than the mean, and it has to exclude the ice: Antarctica,
 * Greenland and the sea ice are a large, blindingly bright minority of the
 * pixels, and averaging them in drags the reference so far up that ordinary
 * vegetated ground renders at half the brightness the ramp intends. The median
 * of everything else is the "typical land" the ramp was built to describe.
 */
const samples = [[], [], []]
for (let p = 0; p < WIDTH * HEIGHT; p++) {
  if (owner[p] !== p || p % 7 !== 0) continue
  const rgb = [linear(june[p * 3]), linear(june[p * 3 + 1]), linear(june[p * 3 + 2])]
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  const peak = Math.max(...rgb)
  const sat = (peak - Math.min(...rgb)) / Math.max(peak, 1e-4)
  if (lum > 0.34 && sat < 0.26) continue // ice, by the same test the shader uses
  for (let c = 0; c < 3; c++) samples[c].push(rgb[c])
}
const median = samples.map((channel) => {
  channel.sort((a, b) => a - b)
  return channel[Math.floor(channel.length / 2)]
})
console.log(
  `  median land albedo, ice excluded (linear): vec3(${median.map((v) => v.toFixed(4)).join(', ')})`,
)

// December over June, at the ratio field's own resolution. Both months are
// averaged down first so the ratio is taken between like and like.
process.stdout.write('  measuring the seasonal ratio ... ')
const shrink = async (data) =>
  (
    await sharp(Buffer.from(data), { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
      .resize(SEASON_WIDTH, SEASON_HEIGHT, { kernel: 'lanczos3' })
      .raw()
      .toBuffer({ resolveWithObject: true })
  ).data
const juneSmall = await shrink(june)
const decemberSmall = await shrink(december)
const ratio = Buffer.alloc(SEASON_WIDTH * SEASON_HEIGHT * 3)
for (let i = 0; i < ratio.length; i++) {
  // In linear light, and stored linearly: this is a gain, not a colour, so the
  // shader must read back exactly what is written here rather than putting it
  // through the sRGB transfer function. A floor under the denominator keeps
  // deep forest and deep shadow, near black in June, from turning into an
  // enormous winter multiplier.
  const summer = Math.max(linear(juneSmall[i]), 0.006)
  ratio[i] = Math.max(0, Math.min(255, Math.round((linear(decemberSmall[i]) / summer / RATIO_SCALE) * 255)))
}
process.stdout.write('done\n')

const base = await sharp(Buffer.from(june), { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
  .webp({ quality: 88, effort: 6 })
  .toBuffer()
writeFileSync(new URL('../src/assets/terrain.webp', import.meta.url), base)
console.log(`  src/assets/terrain.webp         ${(base.length / 1e6).toFixed(2)} MB  ${WIDTH}x${HEIGHT}`)

const season = await sharp(ratio, { raw: { width: SEASON_WIDTH, height: SEASON_HEIGHT, channels: 3 } })
  .webp({ quality: 90, effort: 6 })
  .toBuffer()
writeFileSync(new URL('../src/assets/terrain-season.webp', import.meta.url), season)
console.log(
  `  src/assets/terrain-season.webp  ${(season.length / 1e6).toFixed(2)} MB  ${SEASON_WIDTH}x${SEASON_HEIGHT}`,
)
