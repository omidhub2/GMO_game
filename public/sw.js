const CACHE = "gmo-static-v2";
const PRECACHE = [
  "/icons/gmo-arena-192.svg",
  "/icons/gmo-arena-512.svg",
  "/avatars/gmo-avatar-1.webp",
  "/avatars/gmo-avatar-2.webp",
  "/avatars/gmo-avatar-3.webp",
];
const STATIC_EXT = /\\.(?:css|js|mjs|svg|png|webp|jpg|jpeg|avif|gif|woff2?|ttf|otf)$/i;
const MAX_RUNTIME_ENTRIES = 140;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Keep installation resilient if one optional asset is temporarily offline.
    await Promise.allSettled(PRECACHE.map(async path => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("gmo-static-") && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_RUNTIME_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map(key => cache.delete(key)));
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache navigation documents, RSC payloads, auth, profiles, wallet,
  // matchmaking, or any other API response: these must always stay fresh.
  if (
    request.mode === "navigate" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".rsc") ||
    url.pathname.startsWith("/_next/data/")
  ) return;

  const nextStatic = url.pathname.startsWith("/_next/static/");
  const nextImage = url.pathname === "/_next/image";
  const publicStatic = STATIC_EXT.test(url.pathname);
  if (!nextStatic && !nextImage && !publicStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);

    // Next build assets are content-hashed and immutable: cache-first avoids
    // repeat downloads and keeps game JS/CSS available after the first visit.
    if (nextStatic && cached) return cached;

    // Public images/fonts and optimized images use stale-while-revalidate so
    // the game renders immediately from disk while updates are fetched quietly.
    const network = fetch(request).then(async response => {
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
        await trimCache(cache);
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const response = await network;
    return response || Response.error();
  })());
});
