const CACHE_NAME = 'super-comparador-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/logo.png',
  '/icon-maskable-512.png',
  '/icon-maskable-192.png',
  '/icon-512.png',
  '/icon-192.png',
  '/apple-touch-icon.png',
  '/logos/golopolis.svg',
  '/logos/actual.svg',
  '/logos/dia.svg',
  '/logos/mercadolibre.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Evicting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never cache live API calls
  if (url.includes('/api/')) {
    return;
  }

  // Network-First for HTML and JavaScript to guarantee instant updates
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'document' ||
    url.includes('/app.js') ||
    url.endsWith('.html') ||
    url.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for images and icons
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
