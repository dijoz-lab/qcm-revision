/* ===== Agent de service (service worker) : garde l'application en réserve pour l'usage sans internet =====
   RÈGLE : à chaque modification d'un fichier de docs/, augmenter VERSION, sinon le téléphone garde l'ancienne version.
   Les données (questions, séances) ne sont pas ici : elles restent dans la mémoire du navigateur (localStorage). */
var VERSION = 'qcm-pj-cache-1';
var FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "parser.js",
  "seance.js",
  "stockage.js",
  "app.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icon-192.png",
  "icones/icon-512.png",
  "icones/icon-maskable-512.png"
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (noms) {
    return Promise.all(noms.filter(function (n) { return n !== VERSION; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Fichiers de l'application : d'abord la réserve, sinon le réseau. Les autres adresses ne sont pas touchées.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).catch(function () { return req.mode === 'navigate' ? caches.match('./') : Response.error(); });
  }));
});
