// sw.js — keeps the app working offline.
// App files (and the shared theme and fonts) are cached on install.
// Bump VERSION whenever you change the app files.

const VERSION = 'v1';
const SHELL = `prompter-studio-shell-${VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './prompter.js',
  './store.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  '../theme.css',
  '../fonts/anton-400.woff2',
  '../fonts/spacegrotesk-var.woff2',
  '../fonts/plexmono-400.woff2',
  '../fonts/plexmono-500.woff2',
  '../fonts/plexmono-600.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('prompter-studio-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin === self.location.origin) event.respondWith(appFile(event));
});

// App files: answer from the cache, refresh it in the background when online.
async function appFile(event) {
  const req = event.request;
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
  return Response.error();
}
