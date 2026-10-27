// Service worker: l'app funziona offline dopo la prima apertura.
// La versione arriva da version.js: cambiandola l'app si aggiorna.
try { importScripts('version.js'); } catch { self.APP_VERSION = 'dev'; }
const VERSION = 'libreriamusicalepl-' + self.APP_VERSION;
// Si toccano solo le cache di questa app (altre app sullo stesso dominio restano intatte).
const OWN_PREFIXES = ['libreriamusicalepl-', 'vinili-'];
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'db.js', 'util.js', 'io.js', 'scanner.js', 'mb.js', 'version.js',
  'manifest.webmanifest', 'vendor/xlsx.full.min.js', 'vendor/zxing.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && OWN_PREFIXES.some((p) => k.startsWith(p))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // API e copertine: sempre dalla rete
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) {
        e.waitUntil(net);
        return hit;
      }
      return (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }),
  );
});
