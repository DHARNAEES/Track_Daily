/* Track Daily service worker: makes the app load offline. Bump CACHE when shipping changes. */
const CACHE = 'track-daily-v10';
const SHELL = ['./', 'index.html', 'core.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'vendor/chart.umd.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase API calls (cloud backup) must always hit the network.
  if (url.hostname.endsWith('.supabase.co')) return;

  if (url.origin === self.location.origin) {
    // App files: serve the cached copy instantly, refresh it in the background.
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        const network = fetch(req).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // CDN assets (Tailwind, Chart.js, fonts): cache on first use so the app works offline afterwards.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }))
  );
});
