// FluencyAI Service Worker - Offline Caching & PWA Experience
const CACHE_NAME = 'fluencyai-cache-v3';

// Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[FluencyAI SW] Pre-caching offline app shell');
      const base = self.registration.scope;
      const assets = [
        base,
        new URL('index.html', base).href,
        new URL('manifest.webmanifest', base).href,
        new URL('icon.svg', base).href,
        new URL('icon-192.png', base).href,
        new URL('icon-512.png', base).href,
        new URL('icon-maskable-192.png', base).href,
        new URL('icon-maskable-512.png', base).href,
        new URL('apple-touch-icon.png', base).href,
        new URL('favicon-32.png', base).href,
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
      ];
      return cache.addAll(assets).catch((err) => {
        console.warn('[FluencyAI SW] Pre-cache item failed non-critically:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches & Claim Clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[FluencyAI SW] Purging outdated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale While Revalidate / Cache First with Offline Fallback
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Never intercept API routes, FreeLLMAPI gateway, or WebSocket traffic
  if (
    event.request.method !== 'GET' ||
    !url.startsWith('http') ||
    url.includes('/freellm-gateway') ||
    url.includes('31415') ||
    url.includes('/api/') ||
    url.includes('cosmowhisper.com')
  ) {
    return;
  }

  // Navigation requests: Network-first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(new URL('index.html', self.registration.scope).href) ||
                 caches.match(self.registration.scope) ||
                 caches.match('/index.html') ||
                 caches.match('/');
        })
    );
    return;
  }

  // Static assets & fonts: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

// Skip waiting listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
