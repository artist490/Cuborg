const CACHE_NAME = "personal-secure-vault-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/vault-icon.svg"];

function shouldCache(request) {
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.endsWith(".db")) {
    return false;
  }

  return (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".wasm") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".svg")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (!shouldCache(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }

        return caches.match(event.request);
      }),
  );
});
