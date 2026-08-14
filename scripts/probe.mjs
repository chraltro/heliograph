// Read actual pixels out of the rendered canvas.
//
//   node scripts/probe.mjs "?t=..." "600,760" "300,400" ...
//
// Coordinates are CSS pixels from the top left of the viewport.
import { chromium } from '@playwright/test'

const [, , query = '', ...points] = process.argv
const base = process.env.HELIOGRAPH_URL ?? 'http://localhost:4173'

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto(`${base}/${query}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 })

const coords = points.map((p) => p.split(',').map(Number))
const results = await page.evaluate((list) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  return list.map(([x, y]) => ({ x, y, rgba: window.__pixel(x * dpr, y * dpr) }))
}, coords)

for (const r of results) {
  const [red, green, blue] = r.rgba
  const hex = '#' + [red, green, blue].map((v) => v.toString(16).padStart(2, '0')).join('')
  console.log(`(${r.x},${r.y}) rgb(${red},${green},${blue}) ${hex}`)
}
await browser.close()
