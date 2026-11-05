// sw.js — keeps the app working offline.
// App files (and the shared theme and fonts) are cached on install. The face
// tracker (MediaPipe script, WASM and model, about 17 MB) is downloaded from the
// web the first time and kept here, so later visits work offline.
// Bump VERSION whenever you change the app files.

const VERSION = 'v4';
const SHELL = `avatar-studio-shell-${VERSION}`;
const RUNTIME = 'avatar-studio-runtime-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './avatar.js',
  './tracker.js',
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

// Tracker files are pinned to one version on these hosts, so the cached copy is always right.
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL && key !== RUNTIME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(appFile(event));
  else if (RUNTIME_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req));
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

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}
