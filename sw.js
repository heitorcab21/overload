// Service worker: deixa o Overload funcionando sem internet.
// Ao publicar uma versão nova, troque o número abaixo para atualizar o cache dos aparelhos.
const VERSION = 'overload-v37';

const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/logic.js', 'js/data.js', 'js/ui.js', 'js/router.js',
  'js/voice.js', 'js/ai.js', 'js/charts.js', 'js/export.js', 'js/config.js', 'js/drive.js', 'js/install.js', 'js/i18n.js', 'js/body.js', 'js/syncbadge.js', 'js/textimport.js', 'js/storycard.js', 'js/locales/en.js', 'js/locales/es.js',
  'js/views/home.js', 'js/views/workout.js', 'js/views/goals.js', 'js/views/progress.js',
  'js/views/library.js', 'js/views/settings.js', 'js/views/help.js', 'js/views/importtext.js',
  'sobre.html', 'privacidade.html',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do próprio app: responde do cache na hora e atualiza em segundo plano.
// Chamadas externas (IA) passam direto pela rede.
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    }),
  );
});
