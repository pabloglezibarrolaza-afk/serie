const VERSION = 'serie-v19';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icono.svg', './icono-192.png', './icono-512.png', './icono-180.png', './bicho.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Red primero (para que lleguen las actualizaciones), caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r.ok && new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(VERSION).then((k) => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
// tocar un aviso abre la app
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow('./index.html'))); });
