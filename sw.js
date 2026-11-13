// Starport service worker: keeps the launcher itself available offline.
// Links to the apps and games are never intercepted.
// Bump VERSION whenever you change files, so phones pick up the new version.

const VERSION = 'starport-v8';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/main.js',
  './js/apps.js',
  './js/theme.js',
  './js/sky.js',
  './js/orbit.js',
  './js/flight.js',
  './js/search.js',
  './js/sound.js',
  './manifest.webmanifest',
  './assets/starport-mark.svg',
  './assets/starport-icon.svg',
  './assets/fonts/space-grotesk.woff2',
  './assets/fonts/inter.woff2',
  './assets/apps/scent.svg',
  './assets/apps/mixly.svg',
  './assets/apps/wenslijst.png',
  './assets/apps/creami.svg',
  './assets/games/wonderland.svg',
  './assets/games/boardgames.svg',
  './assets/icons/icon-192.png',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// stale-while-revalidate for our own files
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const key = request.mode === 'navigate' ? './index.html' : request;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
