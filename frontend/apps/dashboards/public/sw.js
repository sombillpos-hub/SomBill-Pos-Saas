/**
 * SomBill Lightweight PWA Service Worker.
 * - Caches static shell assets (JS, CSS, fonts, branding logo) for instant repeat loads & offline resilience.
 * - Uses Network-First for HTML navigation with cached shell fallback when offline.
 * - Never intercepts API mutations (/api/), Supabase realtime websockets, or Vite HMR sockets.
 */
const CACHE_NAME = 'sombill-shell-v1';
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/branding/sombill-logo.jpg']).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health') || url.pathname.includes('__hmr')) return;

  // Navigation requests: Network-first so fresh deploys load immediately, falling back to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Static assets (JS/CSS/fonts/images): Stale-while-revalidate for fast 2G/3G/4G performance.
  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});
