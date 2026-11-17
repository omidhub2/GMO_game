const CACHE = "gmo-static-v1";
const STATIC_EXT = /\.(?:css|js|mjs|svg|png|webp|jpg|jpeg|woff2?)$/i;

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("gmo-static-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache pages, RSC payloads, authentication, profile, wallet, or game APIs.
  if (url.pathname.startsWith("/api/") || url.pathname.endsWith(".rsc") || request.mode === "navigate") return;
  if (!STATIC_EXT.test(url.pathname) && !url.pathname.startsWith("/icons/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  })());
});
