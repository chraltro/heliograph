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
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', import.meta.url), { scope: './' }).catch(() => {
      // No offline cache is a smaller loss than a failed start.
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
