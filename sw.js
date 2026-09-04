"use strict";
(() => {
  // <define:__PRECACHE__>
  var define_PRECACHE_default = ["./", "./index.html", "./assets/world-0LL8EloU.bin", "./assets/terrain-season-CDPpnhPg.webp", "./assets/terrain-C589T1J4.webp", "./assets/index-DVTAC0e-.js", "./manifest.webmanifest"];

  // src/sw.ts
  var CACHE = `heliograph-${"f74c45823017"}`;
  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(
          define_PRECACHE_default.map(async (url) => {
            try {
              await cache.add(new Request(url, { cache: "reload" }));
            } catch {
            }
          })
        );
        await self.skipWaiting();
      })()
    );
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        for (const key of await caches.keys()) {
          if (key.startsWith("heliograph-") && key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
      })()
    );
  });
  self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (request.mode === "navigate") {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE);
          const cached = await cache.match("./index.html");
          if (cached) {
            void fetch(request).then(async (response) => {
              if (response.ok) await cache.put("./index.html", response.clone());
            }).catch(() => void 0);
            return cached;
          }
          return fetch(request);
        })()
      );
      return;
    }
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && url.pathname.includes("/assets/")) await cache.put(request, response.clone());
        return response;
      })()
    );
  });
})();
