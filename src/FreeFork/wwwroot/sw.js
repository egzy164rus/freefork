// FreeFork service worker: офлайн-режим и быстрый запуск.
// Стратегия: сначала сеть (чтобы после обновления сайта сразу видеть новую версию),
// но если сеть медленная или её нет — мгновенно отдаём копию из кэша.
const VERSION = 'v5';
const CACHE = 'freefork-' + VERSION;
const SHELL = ['./', 'index.html', 'css/app.css', 'css/design.css',
  'js/config.js', 'js/vendor/supabase.js', 'js/icons.js', 'js/i18n.js', 'js/engine.js', 'js/cloud.js', 'js/app.js',
  'data/foods.json', 'data/recipes.json', 'manifest.webmanifest', 'icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/inter-latin-wght-normal.woff2', 'fonts/inter-cyrillic-wght-normal.woff2'];
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener('install', e => {
  // Новая версия ждёт, пока пользователь нажмёт «Обновить» (сообщение SKIP_WAITING). Первая установка — сразу.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('freefork-') && k !== CACHE).map(k => caches.delete(k)))),
    self.registration.navigationPreload ? self.registration.navigationPreload.disable() : null,
  ]).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

async function fromCache(req) {
  return (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await caches.match('./') : null);
}
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(async () => finish(await fromCache(req)), NETWORK_TIMEOUT_MS);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      finish(res);
    }).catch(async () => {
      clearTimeout(timer);
      const c = await fromCache(req);
      if (c) finish(c); else if (!done) { done = true; resolve(Response.error()); }
    });
  });
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Только свои файлы. Облако (Supabase) и Open Food Facts идут напрямую в сеть.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(networkFirst(e.request));
});
