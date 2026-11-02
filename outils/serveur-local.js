// Petit serveur local pour tester la PWA (installation, usage sans internet) : node outils/serveur-local.js
// Puis ouvrir http://localhost:8080 dans Chrome. Arrêt : Ctrl+C.
// Il ne sert que le dossier docs/ et n'écoute que sur cet ordinateur (127.0.0.1), jamais sur le réseau.
const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const PORT = 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(DOCS, p));
  if (!f.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, function (err, data) {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', function () { console.log('Serveur local : http://localhost:' + PORT + '  (Ctrl+C pour arrêter)'); });
