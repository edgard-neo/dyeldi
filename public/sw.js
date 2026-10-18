const CACHE_NAME = 'dyeldi-pwa-v2';

// Recursos vitais pré-cacheados na instalação
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg',
  '/pwa-maskable-512x512.svg',
  '/og-image.svg'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Mensagem para atualizar Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estratégias de busca (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorar requisições não-GET ou extensões do navegador
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // NUNCA interceptar em desenvolvimento: Vite dev server, HMR, /src/, /node_modules/, @vite, @fs
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.search.includes('v=') ||
    url.search.includes('t=')
  ) {
    return;
  }

  // Requisições para API (/api/): Network-first com fallback Gracioso
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Modo offline. Conecte-se à internet para atualizar cotações.' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Navegação HTML (Navegador abrindo rotas): Network-first, fallback para cache /index.html
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', responseClone));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
          return new Response('<h1>Dyeldi — Offline</h1><p>Você está sem conexão com a internet.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Ativos estáticos (JS, CSS, Imagens, Fontes): Cache-first, fallback de rede
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidação em segundo plano para ativos estáticos
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      });
    })
  );
});
