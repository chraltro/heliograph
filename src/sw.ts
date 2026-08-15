/// <reference lib="webworker" />

/**
 * The offline cache.
 *
 * Everything this app needs is compiled in already, so being usable without a
 * network is a matter of holding on to the build rather than of any runtime
 * fallback: precache the shell and the assets on install, serve them from the
 * cache first, and treat the network as the thing that refreshes them later.
 *
 * The cache name carries the build's own asset hashes, so a new deployment
 * lands in a new cache and the old one is deleted whole. That avoids the
 * failure mode where a stale index.html is served alongside fresh assets it
 * does not know the names of.
 */

// Making this a module scopes the redeclaration below, which is the standard
// way to tell TypeScript that `self` here is a service worker and not a window.
export {}

declare const self: ServiceWorkerGlobalScope

// Injected at build time: every file the build produced.
declare const __PRECACHE__: string[]
declare const __BUILD__: string

const CACHE = `heliograph-${__BUILD__}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // One failed asset must not fail the whole install, so they are added
      // individually and the shell is the only one that has to succeed.
      await Promise.all(
        __PRECACHE__.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }))
          } catch {
            // A missing optional asset is not worth refusing to install over.
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('heliograph-') && key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // A navigation is answered with the shell, whatever the query string was, so
  // that a shared link opens offline exactly as the bare address does.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        const cached = await cache.match('./index.html')
        if (cached) {
          // Refresh in the background so the next launch is current.
          void fetch(request)
            .then(async (response) => {
              if (response.ok) await cache.put('./index.html', response.clone())
            })
            .catch(() => undefined)
          return cached
        }
        return fetch(request)
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      // Hashed assets never change under their own name, so they are worth
      // keeping the moment they are first asked for.
      if (response.ok && url.pathname.includes('/assets/')) await cache.put(request, response.clone())
      return response
    })(),
  )
})
