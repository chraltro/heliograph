import './style.css'
import { Heliograph } from './app/app.ts'
import { loadWorld } from './data/world.ts'

declare global {
  interface Window {
    __ready?: boolean
    __heliograph?: Heliograph
  }
}

const app = document.querySelector<HTMLDivElement>('#app')

function fail(message: string, detail: unknown): void {
  console.error(detail)
  if (!app) return
  app.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'fatal'
  const title = document.createElement('p')
  title.className = 'fatal-title'
  title.textContent = message
  const body = document.createElement('p')
  body.className = 'fatal-body'
  body.textContent = String(detail)
  box.append(title, body)
  app.append(box)
}

async function boot(): Promise<void> {
  if (!app) throw new Error('the page is missing its #app element')
  const world = await loadWorld()
  const heliograph = new Heliograph(app, world)
  await heliograph.start()
  window.__heliograph = heliograph
  window.__ready = true
}

/**
 * Register the offline cache, and only in a build: the dev server has no
 * worker to serve, and a stale one there would shadow every edit.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A cache-first worker answers a returning visitor with the build they already
  // have, and only the visit after that with the new one, so a fix could be live
  // for a whole day and invisible to everyone who had been here before. When a
  // new worker takes over, the page reloads once to meet it, but only if there
  // was an older worker to replace (the very first install also takes control,
  // and has nothing to update) and only if the visitor has not yet touched
  // anything, so it is never a reload in the middle of using the map. The state
  // that matters is in the address, so even then nothing is lost.
  const hadWorker = navigator.serviceWorker.controller !== null
  let touched = false
  let reloaded = false
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(type, () => (touched = true), { capture: true, once: true, passive: true })
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || touched || reloaded) return
    reloaded = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    // A plain path, relative to the page, and never `new URL('sw.js',
    // import.meta.url)`: the bundler takes that form for an asset, finds no
    // sw.js beside the source, and inlines src/sw.ts itself as a data: URL,
    // which a browser refuses as a worker script. The refusal was caught and
    // dropped a line below, so the offline cache was silently never installed.
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error: unknown) => {
      // No offline cache is a smaller loss than a failed start, but it should
      // not be a silent one.
      console.warn('Heliograph could not install its offline cache.', error)
    })
  })
}

boot().catch((error: unknown) => {
  const message =
    error instanceof Error && error.message.includes('WebGL2')
      ? 'Heliograph needs WebGL2, and this browser did not provide it.'
      : 'Heliograph could not start.'
  fail(message, error)
})
