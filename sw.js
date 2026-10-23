// Offline service worker for «چرخونه». Everything (≈200 KB + font) is precached; bump VERSION on every release.
const VERSION = 'charkhoone-v1.0.1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/rng.js', './js/wheel.js', './js/util.js', './js/themes.js', './js/templates.js',
  './js/challenges.js', './js/game.js', './js/renderer.js', './js/fx.js', './js/store.js',
  './fonts/Vazirmatn-Variable.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('charkhoone') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true }); if (hit) return hit;
    try { const res = await fetch(req); if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }
    catch { if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error(); return Response.error(); }
  })());
});
