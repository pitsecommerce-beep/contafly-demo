// Service worker mínimo: red primero y copia en caché para abrir la demo sin conexión.
const CACHE = 'contafly-demo-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(req, copia))
          .catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || Response.error())),
  );
});
