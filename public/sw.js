const CACHE_NAME = 'clientific-v2';

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/login',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
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
  if (url.origin !== location.origin) return;

  // For API routes: network only (never serve stale API data)
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests: network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/dashboard') || caches.match('/login'))
    );
    return;
  }

  // For static assets: cache first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
