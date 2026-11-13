// Little Steps service worker.
//
// The app is online-only by design: every entry lives on the server, and
// nothing a family writes is ever stored on the device. So this worker caches
// exactly one thing, the "you're offline" page, and shows it when a page load
// fails. It never caches API responses or pages, which could show one
// person's data to the next person using the phone.

const CACHE = 'little-steps-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
