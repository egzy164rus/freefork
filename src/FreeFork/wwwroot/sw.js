// Service worker: приложение ставится на телефон, открывается и работает без сети
// (встроенная база продуктов и рецепты лежат в data/*.json и кэшируются).
const CACHE = 'freefork-v4';
const SHELL = ['./', 'css/app.css', 'css/design.css', 'js/config.js', 'js/vendor/supabase.js', 'js/icons.js', 'js/i18n.js', 'js/engine.js', 'js/cloud.js', 'js/app.js',
  'data/foods.json', 'data/recipes.json', 'manifest.webmanifest', 'icon.svg', 'fonts/inter-latin-wght-normal.woff2', 'fonts/inter-cyrillic-wght-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Только свои файлы. Облако (Supabase) и Open Food Facts идут напрямую в сеть.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});
