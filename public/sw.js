/* RepoPulse PWA shell cache. GitHub API responses are deliberately never cached. */
const CACHE_NAME = 'repopulse-shell-v1.3.0';
const APP_SHELL = [
  '/manifest.webmanifest',
  '/repopulse-mark.svg',
  '/icons/repopulse-icon.svg',
  '/icons/repopulse-icon-192.png',
  '/icons/repopulse-icon-512.png',
  '/icons/repopulse-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shellResponse = await fetch('/');
    if (!shellResponse.ok) throw new Error('Could not cache the RepoPulse app shell');
    const shellHtml = await shellResponse.clone().text();
    await cache.put('/', shellResponse.clone());
    await cache.put('/index.html', shellResponse.clone());

    // Vite hashes production bundles, so discover the exact JS/CSS URLs from index.html.
    const assetPaths = [...shellHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => {
        try { return new URL(match[1], self.location.origin); }
        catch { return null; }
      })
      .filter((url) => url && url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
      .map((url) => url.href);

    await cache.addAll([...APP_SHELL, ...new Set(assetPaths)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('repopulse-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  const isAppAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/repopulse-mark.svg';
  if (!isAppAsset) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
