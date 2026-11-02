// Tests de la PWA : manifeste, icônes, liste des fichiers gardés en réserve par l'agent de service (sw.js).
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const SW = fs.readFileSync(path.join(DOCS, 'sw.js'), 'utf8');
const FICHIERS = JSON.parse(SW.match(/var FICHIERS = (\[[\s\S]*?\]);/)[1]);
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(DOCS, 'manifest.webmanifest'), 'utf8'));

function tousLesFichiers(dossier, rel) {
  let out = [];
  fs.readdirSync(dossier, { withFileTypes: true }).forEach(function (d) {
    if (d.name === '.DS_Store') return;
    const r = rel ? rel + '/' + d.name : d.name;
    out = d.isDirectory() ? out.concat(tousLesFichiers(path.join(dossier, d.name), r)) : out.concat([r]);
  });
  return out;
}
function taillePng(f) { const b = fs.readFileSync(path.join(DOCS, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

test('sw.js : un numéro de version du cache est présent', function () {
  assert.match(SW, /var VERSION = 'qcm-pj-cache-\d+';/);
});

test('sw.js : chaque fichier de docs/ est gardé en réserve, et rien d’inexistant n’est demandé', function () {
  const attendus = tousLesFichiers(DOCS, '').filter(function (f) { return f !== 'sw.js'; }).sort();
  assert.deepEqual(FICHIERS.filter(function (f) { return f !== './'; }).sort(), attendus);
  assert.ok(FICHIERS.includes('./'));
});

test('manifeste : nom, affichage plein écran, adresses relatives (GitHub Pages)', function () {
  assert.equal(MANIFESTE.name, 'QCM Police Judiciaire');
  assert.equal(MANIFESTE.display, 'standalone');
  assert.equal(MANIFESTE.start_url, './');
  assert.equal(MANIFESTE.scope, './');
  assert.ok(MANIFESTE.background_color && MANIFESTE.theme_color);
});

test('manifeste : icônes 192 et 512, dont une maskable, fichiers présents à la bonne taille', function () {
  const icones = MANIFESTE.icons;
  assert.ok(icones.some(function (i) { return i.sizes === '192x192'; }));
  assert.ok(icones.some(function (i) { return i.sizes === '512x512' && i.purpose === 'maskable'; }));
  icones.forEach(function (i) {
    const n = parseInt(i.sizes, 10);
    assert.deepEqual(taillePng(i.src), [n, n], i.src);
  });
});

test('index.html : manifeste lié et agent de service enregistré', function () {
  const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /navigator\.serviceWorker\.register\('sw\.js'\)/);
});
