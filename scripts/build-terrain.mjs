// Build the land albedo texture from Natural Earth's Cross-blended Hypsometric
// Tints with Shaded Relief and Water (public domain), mirrored in the same
// nvkelso GitHub account the vector pipeline already draws from.
//
//   npm run terrain
//
// The map only ever samples this texture inside the land polygons, but a
// bilinear tap near a coast would still average in the flat ocean fill, so the
// water is flooded with the colour of the nearest land before encoding. The
// result is committed as src/assets/terrain.webp and compiled into the app;
// nothing is fetched at runtime.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { cached } from './lib/fetch-cache.mjs'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-raster/master/50m_rasters/HYP_50M_SR_W/HYP_50M_SR_W.tif'

const WIDTH = 4096
const HEIGHT = 2048

const tif = await cached(SOURCE, 'HYP_50M_SR_W.tif')

process.stdout.write('  resampling ... ')
const { data } = await sharp(tif, { limitInputPixels: false })
  .resize(WIDTH, HEIGHT, { kernel: 'lanczos3' })
  .raw()
  .toBuffer({ resolveWithObject: true })
process.stdout.write('done\n')

// Water in this edition is the one place blue clearly dominates: the open
// ocean sits near rgb(118, 166, 204) and even the palest shallows keep blue
// well above red. No land colour in the raster does that, so blueness is the
// mask. Lakes match too, which is fine: the map draws its own lake polygons.
const isWater = (i) => data[i + 2] - data[i] > 40 && data[i + 2] - data[i + 1] > 18

// Multi-source BFS from every shoreline pixel, painting the sea with the
// colour of its nearest land. Longitude wraps; latitude clamps.
process.stdout.write('  flooding water with coastal colour ... ')
const owner = new Int32Array(WIDTH * HEIGHT).fill(-1)
let queue = []
for (let p = 0; p < WIDTH * HEIGHT; p++) {
  if (!isWater(p * 3)) {
    owner[p] = p
    const x = p % WIDTH
    const y = (p / WIDTH) | 0
    const west = y * WIDTH + ((x + WIDTH - 1) % WIDTH)
    const east = y * WIDTH + ((x + 1) % WIDTH)
    if (isWater(west * 3) || isWater(east * 3) ||
        (y > 0 && isWater((p - WIDTH) * 3)) ||
        (y < HEIGHT - 1 && isWater((p + WIDTH) * 3))) {
      queue.push(p)
    }
  }
}
while (queue.length > 0) {
  const next = []
  for (const p of queue) {
    const x = p % WIDTH
    const y = (p / WIDTH) | 0
    const src = owner[p]
    for (const n of [
      y * WIDTH + ((x + WIDTH - 1) % WIDTH),
      y * WIDTH + ((x + 1) % WIDTH),
      y > 0 ? p - WIDTH : -1,
      y < HEIGHT - 1 ? p + WIDTH : -1,
    ]) {
      if (n >= 0 && owner[n] === -1) {
        owner[n] = src
        next.push(n)
      }
    }
  }
  queue = next
}
for (let p = 0; p < WIDTH * HEIGHT; p++) {
  const src = owner[p]
  if (src !== p && src >= 0) {
    data[p * 3] = data[src * 3]
    data[p * 3 + 1] = data[src * 3 + 1]
    data[p * 3 + 2] = data[src * 3 + 2]
  }
}
process.stdout.write('done\n')

// The mean land colour, in linear light: the shader divides by this so the
// texture reads as a relative albedo over the spectral land ramp.
let sumR = 0
let sumG = 0
let sumB = 0
let landCount = 0
const linear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
for (let p = 0; p < WIDTH * HEIGHT; p++) {
  if (owner[p] === p) {
    sumR += linear(data[p * 3])
    sumG += linear(data[p * 3 + 1])
    sumB += linear(data[p * 3 + 2])
    landCount++
  }
}
const mean = [sumR / landCount, sumG / landCount, sumB / landCount]
const landFraction = landCount / (WIDTH * HEIGHT)
console.log(
  `  mean land albedo (linear): vec3(${mean.map((v) => v.toFixed(4)).join(', ')})  land fraction ${(landFraction * 100).toFixed(1)}%`,
)
// The planet is 29% land. Far off either way means the water match failed.
if (landFraction < 0.2 || landFraction > 0.45) {
  throw new Error('water detection failed: land fraction implausible')
}

const webp = await sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
  .webp({ quality: 76 })
  .toBuffer()
writeFileSync(new URL('../src/assets/terrain.webp', import.meta.url), webp)
console.log(`  src/assets/terrain.webp  ${(webp.length / 1e6).toFixed(2)} MB`)
