const CACHE_NAME = 'bia-moodle-cache-v2'; // Mudámos para v2 para ele forçar a atualização!

// Lista de todos os ficheiros que a app precisa para funcionar offline
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/audio.js',
  './js/auth.js',
  './js/utils.js',
  './image/logo.png',           
  './data/BIA_BIAT.json',
  './data/BIA_SP.json',
  './data/BIA_STP.json'
];

// 1. Instalação: Guarda os ficheiros no telemóvel/PC
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberta com sucesso!');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Interceção: Se estiver offline, vai buscar à cache. Se tiver net, atualiza se houver novidades.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se encontrou na cache (offline), devolve. Se não, vai à internet buscar.
        return response || fetch(event.request);
      })
  );
});

// 3. Limpeza: Apaga caches antigas quando atualizas o nome da CACHE_NAME (ex: para v2)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});