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
  // cache: 'reload' = si scaricano davvero i file nuovi, senza passare dalla cache HTTP del browser
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && OWN_PREFIXES.some((p) => k.startsWith(p))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Strategia: prima la rete (con revalidazione, così pagina e script sono sempre della stessa versione),
// e se manca la rete o è troppo lenta (4 s) si usa la copia salvata: l'app funziona offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // API e copertine: sempre dalla rete
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    if (!hit) {
      try { return await net; } catch { return req.mode === 'navigate' ? (await cache.match('index.html')) || Response.error() : Response.error(); }
    }
    e.waitUntil(net.catch(() => {}));
    const fresh = await Promise.race([net.catch(() => null), new Promise((r) => setTimeout(() => r(null), 4000))]);
    return fresh && fresh.ok ? fresh : hit;
  })());
});
