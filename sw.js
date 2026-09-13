// Release the app shell as a unit. Bump VERSION in both this file and pwa.js.
const VERSION = '20260913-2';
const PREFIX = 'wallstory-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + VERSION;
const SHELL = [
  './', './index.html', './app.js', './layout.js', './project-store.js', './studio.js', './studio-math.js', './studio.css', './hanging.js', './hanging-editor.js', './hanging-guide.js', './hanging.css', './style.css', './sample-wall.webp',
  './install.html', './install.css', './install.js', './pwa.js', './update.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Wait until all windows close, or the user chooses Save & update.
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Remove app-shell caches only. IndexedDB drafts are never touched by updates.
    await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const cleanURL = url.origin + url.pathname;
  if (!SHELL.includes(cleanURL)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(cleanURL);
    if (saved) return saved;
    try {
      // Recovery only if this cache was evicted. Ordinary loads use one complete release.
      const response = await fetch(event.request);
      if (response.ok) { try { await cache.put(cleanURL, response.clone()); } catch {} }
      return response;
    } catch {
      return new Response('Wallstory is not available offline yet. Connect to the internet and reopen it.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
