const CACHE_NAME = "appointment-app-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./tailwind.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  if (self.registration && self.registration.navigationPreload) {
    self.registration.navigationPreload.enable().catch(() => {});
  }
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          const network = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, network.clone());
          return network;
        } catch (_) {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match("./index.html");
          return (
            cachedIndex || (await caches.match(req)) || new Response("Offline", { status: 503 })
          );
        }
      })()
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const fromNetwork = fetch(req)
        .then((res) => {
          try {
            if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
          } catch {}
          return res;
        })
        .catch(() => cached);
      return cached || fromNetwork;
    })
  );
});
