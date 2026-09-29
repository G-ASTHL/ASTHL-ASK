// ASTHL service worker v1
// Pages (HTML) HAMESHA network se fresh aate hain — sirf offline hone par cache wale dikhte hain.
// Sirf images/icons cache hote hain. (Fresh-page fix kabhi break nahi hoga.)
var CACHE = 'asthl-pwa-v1';
var ASSETS = ['/icon-192.png', '/icon-512.png', '/icon-512-maskable.png',
              '/asthl-logo.jpg', '/logo.png', '/asthl-patient.png', '/asthl-doctor.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return; // POST (chat, orders) kabhi cache nahi
  // images: cache-first (fast)
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(function (m) {
        if (m) return m;
        return fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        });
      })
    );
    return;
  }
  // HTML/pages: network-first (fresh hamesha), offline par cache
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match('/'); });
    })
  );
});
