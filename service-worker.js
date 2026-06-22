const CACHE_NAME = 'biblioteca-ja-v1';

const ASSETS_TO_CACHE = [
  '/Fronted sistema/login/login.html',
  '/Fronted sistema/login/login.css',
  '/Fronted sistema/login/login.js',
  '/Fronted sistema/dashboard/dashboard.html',
  '/Fronted sistema/dashboard/dashboard.css',
  '/Fronted sistema/dashboard/dashboard.js',
  '/Fronted sistema/cadastro de livro/cadastro.html',
  '/Fronted sistema/cadastro de livro/cadastro.css',
  '/Fronted sistema/cadastro de livro/cadastro.js',
  '/Fronted sistema/cadastro de alunos/alunos.html',
  '/Fronted sistema/cadastro de alunos/alunos.css',
  '/Fronted sistema/cadastro de alunos/alunos.js',
  '/Fronted sistema/cadastro de doações/doações.html',
  '/Fronted sistema/cadastro de doações/doações.css',
  '/Fronted sistema/cadastro de doações/doações.js',
  '/Fronted sistema/Empréstimo/emprestimo.html',
  '/Fronted sistema/Empréstimo/emprestimo.css',
  '/Fronted sistema/Empréstimo/emprestimo.js',
  '/Fronted sistema/chatbot/chatbot.html',
  '/Fronted sistema/chatbot/chatbot.css',
  '/Fronted sistema/chatbot/chatbot.js',
  '/Fronted sistema/shared.css',
  '/Fronted sistema/logout-modal.css',
  '/Fronted sistema/tema.js',
  '/Fronted sistema/acessibilidade.js',
  '/Fronted sistema/custom-select.js',
  '/img/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/Fronted sistema/login/login.html');
        }
      }))
  );
});
