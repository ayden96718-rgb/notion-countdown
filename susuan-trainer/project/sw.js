const CACHE_PREFIX = `susuan-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const CACHE_NAME = CACHE_PREFIX + '__CACHE_VERSION__';
const ASSETS = [
  './', './index.html', './styles.css', './src/app.js', './src/modes.js',
  './src/engine.js', './src/session.js', './src/timing.js', './src/storage.js',
  './data/timing-reference.json', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  // Wait for the next launch to activate an update, so an ongoing exercise keeps its code version.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const relative = './' + url.pathname.slice(new URL(self.registration.scope).pathname.length);
  // Only application assets are cached, never documentation, exports or user data.
  if (!ASSETS.includes(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(event.request, { ignoreSearch: true }) || await fetch(event.request);
  })());
});
