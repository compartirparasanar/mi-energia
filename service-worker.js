// service-worker.js
// Cachea todos los activos estaticos del proyecto (todos locales, cero
// dominios externos) y sirve con estrategia cache-first: primero cache,
// y si no esta, va a la red y guarda la respuesta para la proxima vez.
//
// VERSIONADO DEL CACHE: para publicar una actualizacion (texto, estilos,
// o cualquier archivo cacheado), sube el numero de CACHE_VERSION. Eso basta:
// - El navegador detecta que este archivo cambio y descarga el nuevo
//   service worker en segundo plano la proxima vez que alguien abra la app.
// - "install" crea un cache con el nuevo nombre y guarda ahi los archivos
//   actuales; self.skipWaiting() hace que el nuevo SW no espere a que se
//   cierren las pestañas antiguas para activarse.
// - "activate" borra cualquier cache con un nombre distinto al actual
//   (las versiones viejas), y self.clients.claim() hace que las pestañas
//   que ya estaban abiertas pasen a usar el nuevo SW sin necesidad de
//   que la persona cierre y vuelva a abrir la app manualmente.
// Resultado: quien ya tiene la app instalada recibe la actualizacion la
// siguiente vez que la abre con conexion a internet (normalmente en la
// recarga siguiente, a veces una recarga mas tarde segun el navegador).
var CACHE_VERSION = 'v6';
var CACHE_NAME = 'mi-energia-' + CACHE_VERSION;

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/content.js',
  './js/storage.js',
  './js/chart.js',
  './js/views.js',
  './js/app.js',
  './fonts/PlayfairDisplay-Medium.woff2',
  './fonts/PlayfairDisplay-Bold.woff2',
  './fonts/TenorSans-Regular.woff2',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  './assets/icons/icon-maskable-192x192.png',
  './assets/icons/icon-maskable-512x512.png',
  './assets/icons/apple-touch-icon-180x180.png',
  './assets/icono_app.svg',
  './assets/logo_b-transparente.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then(function (response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
