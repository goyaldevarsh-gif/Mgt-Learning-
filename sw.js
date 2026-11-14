const CACHE = 'ortho-notes-54b5245c88';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './notes-data.js',
  './manifest.webmanifest', './fonts/fraunces-latin-wght-normal.woff2', './fonts/inter-latin-wght-normal.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ortho-notes-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so new topics show up on refresh), cache fallback (so it works offline).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(reject, 4000));
  e.respondWith(
    Promise.race([net, timeout]).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((r) => r || net.catch(() => caches.match('./index.html')))
    )
  );
});
