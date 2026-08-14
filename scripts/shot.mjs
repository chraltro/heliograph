// Visual iteration helper: boot the app in headless Chromium and save a PNG.
//
//   node scripts/shot.mjs out.png "?t=2026-06-21T12:00:00Z" [width] [height]
//
// Software rendering is forced so the picture matches what the visual tests see.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const [, , outArg = 'shots/frame.png', query = '', wArg = '1440', hArg = '900'] = process.argv
const out = resolve(outArg)
const width = Number(wArg)
const height = Number(hArg)
const base = process.env.HELIOGRAPH_URL ?? 'http://localhost:4173'

await mkdir(dirname(out), { recursive: true })

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

await page.goto(`${base}/${query}`, { waitUntil: 'load' })
await page
  .waitForFunction(() => window.__ready === true, null, { timeout: 30_000 })
  .catch(() => problems.push('the app never signalled ready'))
await page.waitForTimeout(500)
// A quiescent page produces no compositor frame, and the capture waits for one,
// so nudge the renderer immediately before asking for the picture.
await page.evaluate(() => {
  window.__heliograph?.redraw()
  document.body.style.opacity = '0.999'
})
await page.screenshot({ path: out, timeout: 20_000, animations: 'allow', caret: 'hide' })
await browser.close()

console.log(`wrote ${out}`)
if (problems.length) {
  console.log('console output:')
  for (const p of problems) console.log('  ' + p)
}
