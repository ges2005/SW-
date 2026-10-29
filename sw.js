// Hizmet çalışanı: uygulama kabuğunu önbelleğe alır, internetsiz çalıştırır.
// Yayında VERSION, derleme sırasında commit kimliğiyle değiştirilir (eski önbellek temizlensin diye).
const VERSION = 'dev';
const CACHE = 'sw-strateji-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'src/main.js', 'src/config.js', 'src/sim.js', 'src/ai.js', 'src/iso.js', 'src/input.js', 'src/fx.js',
  'src/audio.js', 'src/vision.js', 'src/mapgen.js', 'src/levels.js', 'src/tutorial.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sw-strateji-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Önbellek öncelikli; arka planda güncelle (bir sonraki açılışta yeni sürüm gelir)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
