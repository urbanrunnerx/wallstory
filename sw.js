const PREFIX = 'wallstory-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '20260911-1';
const SHELL = [
  './', './index.html', './app.js', './layout.js', './style.css', './sample-wall.webp',
  './install.html', './install.css', './install.js', './pwa.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const cleanURL = url.origin + url.pathname;
  if (!SHELL.includes(cleanURL)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (!response.ok) {
        const saved = await cache.match(cleanURL);
        return saved || response;
      }
      try { await cache.put(cleanURL, response.clone()); } catch { /* Online response still works if storage is full. */ }
      return response;
    } catch {
      const saved = await cache.match(cleanURL);
      if (saved) return saved;
      return new Response('Wallstory is not available offline yet. Connect to the internet and reopen it.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
