/* Zaunplaner SW — Auto-Update + Safe Cache (keine Kundendaten löschen) */
const CACHE_VERSION = "1.4.41";
const CACHE_NAME = `zaunplaner-${CACHE_VERSION}`;

const CORE = [
  "./",
  "./index.html?v=1.4.41",
  "./app.js?v=1.4.41",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("zaunplaner-") && k !== CACHE_NAME) ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const isCoreFile =
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/sw.js");

  // Always fetch fresh for HTML + core files (updates)
  if (isHTML || isCoreFile) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match("./index.html?v=1.4.41")) || (await cache.match("./"));
      }
    })());
    return;
  }

  // Cache-first for everything else
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});

self.addEventListener("message", (event) => {
  try{
    if(!event || !event.data) return;
    if(event.data.type==="FORCE_UPDATE"){
      event.waitUntil((async()=>{
        try{
          const keys = await caches.keys();
          await Promise.all(keys.map(k=>caches.delete(k)));
        }catch(e){}
        try{ self.skipWaiting(); }catch(e){}
      })());
    }
  }catch(e){}
});
