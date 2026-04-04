const CACHE_NAME = 'bia-moodle-cache-v6'; // Versão 4: Correção de paths e ficheiros

// Lista de todos os ficheiros que a app precisa para funcionar offline
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/audio.js',
  './js/firebase-config.js',
  './js/auth.js',
  './js/utils.js',
  './image/logo.png',    
  
  // Caminhos corrigidos para o plural (pdfs e videos)
  './pdfs/BIA_BIAT.pdf',
  './pdfs/BIA_SP.pdf',
  './pdfs/GM_MR.pdf',
  // './pdfs/BIA_STP.pdf',  <-- ATENÇÃO: Comentado porque não está na tua pasta! Descomenta quando adicionares.

  './videos/BIA_BIAT.mp4',
  './videos/BIA_SP.mp4',
  './videos/GM_MR.mp4',
  // './videos/BIA_STP.mp4', <-- ATENÇÃO: Comentado porque não está na tua pasta! Descomenta quando adicionares.

  './data/BIA_BIAT.json',
  './data/BIA_SP.json',
  './data/GM_MR.json',
  './data/BIA_STP.json'
];

// 1. Instalação: Guarda os ficheiros no telemóvel/PC
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache v4 aberta com sucesso!');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Erro fatal ao instalar a cache! Algum ficheiro da lista não existe:', error);
      })
  );
});

// 2. Interceção: Se estiver offline, vai buscar à cache. Se tiver net, atualiza se houver novidades.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// 3. Limpeza: Apaga caches antigas quando atualizas o nome da CACHE_NAME
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('A apagar cache antiga:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});