// Capture several states of the app from one warm page.
//
//   node scripts/sheet.mjs
//
// The first forced frame on a software renderer spends the better part of a
// minute compiling shaders, so the page is loaded once and then driven through
// each state with applyState rather than reloaded.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const base = process.env.HELIOGRAPH_URL ?? 'http://localhost:4173'
const width = Number(process.env.SHOT_WIDTH ?? 1440)
const height = Number(process.env.SHOT_HEIGHT ?? 900)

const STATES = process.env.SHOT_STATES
  ? JSON.parse(process.env.SHOT_STATES)
  : [
      ['a-august', '?t=2026-08-14T13:34:00Z&play=off&tz=Europe/Oslo'],
      ['b-december', '?t=2026-12-21T13:34:00Z&play=off&tz=Europe/Oslo'],
      ['c-june', '?t=2026-06-21T02:00:00Z&play=off&tz=Europe/Oslo'],
      ['d-timezones', '?t=2026-12-01T13:34:00Z&play=off&tz=Europe/Oslo&layers=cities,places,timezones,matchClock,graticule,boundaries'],
      ['e-zoom', '?t=2026-12-01T16:00:00Z&play=off&tz=Europe/Oslo&z=3.2&lon=12&lat=52'],
      ['f-analemma', '?t=2026-03-20T12:00:00Z&play=off&layers=cities,places,graticule,boundaries,analemma'],
    ]

await mkdir('shots', { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
const problems = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

await page.goto(`${base}/${STATES[0][1]}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 })
await page.waitForTimeout(400)

for (const [name, query] of STATES) {
  const started = Date.now()
  await page.evaluate((q) => window.__heliograph.applyState(q), query)
  await page.screenshot({ path: `shots/${name}.png`, timeout: 180_000 })
  console.log(`${name.padEnd(14)} ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

await browser.close()
if (problems.length) {
  console.log('\nconsole output:')
  for (const p of [...new Set(problems)]) console.log('  ' + p)
}
