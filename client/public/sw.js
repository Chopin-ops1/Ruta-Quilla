const SHELL_CACHE = 'rutaquilla-shell-v4';
const API_CACHE = 'rutaquilla-api-v4';
const SHELL_ASSETS = ['/', '/logo.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests; pass through external tile/routing/geocoding hosts
  if (url.origin !== self.location.origin) return;

  // Network-first with cache fallback ONLY for public GET /api/routes and /api/maps/transmetro-stops
  if (url.pathname === '/api/routes' || url.pathname === '/api/maps/transmetro-stops') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Pass through all other /api/* requests and APK downloads directly
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/downloads/')) return;

  // Shell/navigation fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
  }
});
