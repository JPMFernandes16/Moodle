// sw.js
// 🚨 REGRA DE OURO: SEMPRE QUE FIZERES ALTERAÇÕES NO PROJETO, MUDA ESTES NÚMEROS!
const STATIC_CACHE = 'moodle-bia-static-v9.8'; 
const DYNAMIC_CACHE = 'moodle-bia-dynamic-v9.8';

// Apenas ficheiros da "carcaça" da aplicação (App Shell)
// NOTA: Adicionei os novos ficheiros que criámos na refatoração!
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/utils.js',
  './js/audio.js',
  './js/auth.js',
  './js/firebase-config.js',
  './js/store.js',
  './js/firebaseManager.js',
  './js/quizLogic.js',
  './manifest.json',
  './image/logo.png'
];

// 1. INSTALAÇÃO: Guarda os ficheiros estáticos
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[Service Worker] A guardar cache estática inicial');
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. ATIVAÇÃO: Limpa qualquer cache antiga
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] A apagar cache antiga:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Stale-While-Revalidate com Cache Dinâmico
self.addEventListener('fetch', event => {
  const requestUrl = event.request.url;

  // EXCEÇÃO CRÍTICA: Ignorar pedidos ao Firebase/Firestore!
  // O Firebase já tem o próprio mecanismo offline interno. Se o SW se meter no meio, estraga os WebSockets e atualizações em tempo real.
  if (
    requestUrl.includes('firestore.googleapis.com') ||
    requestUrl.includes('firebaseio.com') ||
    requestUrl.includes('identitytoolkit.googleapis.com')
  ) {
    return; // Deixa o pedido seguir normalmente para a rede
  }

  // Apenas lidamos com pedidos GET (excluímos POSTs ou chamadas externas estranhas)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      
      // O pedido de rede (ocorre em background)
      const networkFetch = fetch(event.request).then(networkResponse => {
        // Se a resposta for válida, guardamos uma cópia na Cache Dinâmica
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.warn('[Service Worker] Modo Offline detetado. A usar recursos locais.', err);
        // Aqui podias adicionar uma página de "Fallback Offline" (ex: return caches.match('/offline.html');)
      });

      // DEVOLVE ISTO: Se tem cache devolve logo (super rápido), se não tem, espera pela rede
      // O "networkFetch" a acontecer em background vai atualizar a cache para a próxima visita!
      return cachedResponse || networkFetch;
    })
  );
});