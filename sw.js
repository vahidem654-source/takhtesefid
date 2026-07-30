const CACHE_NAME = 'takhte-kelas-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // برای فایل‌های اصلی برنامه: اول کش، بعد شبکه (کار آفلاین)
  // برای CDNها (pdf.js / peerjs): تلاش از شبکه، در صورت قطعی از کش
  const url = event.request.url;
  const isCore = CORE_ASSETS.some(a => url.endsWith(a.replace('./','')));
  if (isCore) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
