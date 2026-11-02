/* ===== Agent de service (service worker) : garde l'application en réserve pour l'usage sans internet =====
   RÈGLE : à chaque modification d'un fichier de docs/, augmenter VERSION, sinon le téléphone garde l'ancienne version.
   Les données (questions, séances) ne sont pas ici : elles restent dans la mémoire du navigateur (localStorage). */
var VERSION = 'qcm-pj-cache-3';
var FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "parser.js",
  "seance.js",
  "stockage.js",
  "reglages.js",
  "app.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icon-192.png",
  "icones/icon-512.png",
  "icones/icon-maskable-512.png",
  "polices/barlow-condensed-LICENSE.txt",
  "polices/barlow-condensed-latin-600-normal.woff2",
  "polices/barlow-condensed-latin-700-normal.woff2",
  "polices/ibm-plex-mono-LICENSE.txt",
  "polices/ibm-plex-mono-latin-400-normal.woff2",
  "polices/ibm-plex-mono-latin-500-normal.woff2",
  "polices/inter-LICENSE.txt",
  "polices/inter-latin-400-normal.woff2",
  "polices/inter-latin-600-normal.woff2",
  "polices/inter-latin-700-normal.woff2",
  "polices/source-serif-4-LICENSE.txt",
  "polices/source-serif-4-latin-400-normal.woff2",
  "polices/source-serif-4-latin-600-normal.woff2"
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
