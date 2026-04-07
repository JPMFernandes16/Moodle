// 🚨 REGRA DE OURO: SEMPRE QUE FIZERES ALTERAÇÕES NO PROJETO, MUDA ESTE NÚMERO! (ex: v2, v3, v4...)
const CACHE_NAME = 'moodle-bia-v1.1'; 

const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/utils.js',
  './js/audio.js',
  './js/auth.js',
  './js/firebase-config.js',
  './manifest.json'
];

// 1. INSTALAÇÃO: Guarda os ficheiros e FORÇA a ativação imediata
self.addEventListener('install', event => {
  self.skipWaiting(); // A MAGIA ESTÁ AQUI: Obriga o novo service worker a assumir o controlo logo, sem esperar que fechem a App.
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. ATIVAÇÃO: Apaga as versões antigas da cache do telemóvel da tua namorada
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('A apagar cache antiga:', cacheName);
            return caches.delete(cacheName); // Destrói os ficheiros velhos
          }
        })
      );
    }).then(() => self.clients.claim()) // Aplica a nova cache às páginas já abertas
  );
});

// 3. FETCH: Estratégia "Network First, fallback to Cache"
// Tenta sempre ir buscar a versão mais recente à net. Se falhar (offline), usa a cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});