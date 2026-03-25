const CACHE_NAME = 'clientific-v6';
const OFFLINE_FALLBACK_URL = '/offline.html';

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
  OFFLINE_FALLBACK_URL,
  '/logo_black_transparent.png',
  '/logo_white_transparent.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // For API routes: network only (never serve stale API data)
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests, only return a static offline document on failure.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const offlineResponse = await caches.match(OFFLINE_FALLBACK_URL);
          if (offlineResponse) {
            return offlineResponse;
          }

          return new Response('Offline', {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          });
        }
      })()
    );
    return;
  }

  // For static assets: cache first, fall back to network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }

      try {
        return await fetch(request);
      } catch {
        return new Response('Offline', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    })()
  );
});
