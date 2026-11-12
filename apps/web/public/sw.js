// Fieldwise service worker. Goal: the app opens and the last-viewed advice reads offline.
//  - App shell and hashed assets: cache first (filenames change when content does).
//  - Page navigations: network first, falling back to the cached shell.
//  - Advice and reference API reads: network first, cached copy when offline.
// Never cached: sign-in, uploads, sockets, and anything that is not a GET.
const VERSION = 'fw-v1';
const SHELL = ['/', '/app', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png'];
const API_READS = /^\/api\/(reference|farms|alerts|notifications|tickets|weather|mandi|public)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
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

const networkFirst = async (request, fallbackUrl) => {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    // Cached reads are keyed by URL only, so they are found even when the auth header differs.
    const hit =
      (await cache.match(request, { ignoreVary: true })) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw new Error('offline');
  }
};

const cacheFirst = async (request) => {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/uploads')
  )
    return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
  } else if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/lite/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(request));
  } else if (API_READS.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});
