// Tests des réglages personnels (docs/reglages.js) avec une fausse mémoire de navigateur.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');

function memoire() {
  const m = {};
  return { _m: m, getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
}
function memoirePleine() {
  return { getItem: function () { return null; }, setItem: function () { throw new Error('QuotaExceededError'); }, removeItem: function () {} };
}
function utiliser(mem) { Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true }); return mem; }

utiliser(memoire());
const rg = require('../docs/reglages.js');
const st = require('../docs/stockage.js');

test('clé séparée « qcm-pj-reglages », différente de la clé des données « qcm-pj-v1 »', function () {
  assert.equal(rg.REGLAGES_KEY, 'qcm-pj-reglages');
  assert.notEqual(rg.REGLAGES_KEY, st.KEY);
});

test('objectif par défaut : 80 % quand rien n’est enregistré', function () {
  utiliser(memoire());
  assert.deepEqual(rg.lireReglages(), { objectif: 80 });
});

test('ecrireObjectif puis lireReglages : la valeur revient', function () {
  const mem = utiliser(memoire());
  assert.equal(rg.ecrireObjectif(75), true);
  assert.equal(mem._m['qcm-pj-reglages'], JSON.stringify({ objectif: 75 }));
  assert.deepEqual(rg.lireReglages(), { objectif: 75 });
});

test('valeurs refusées (0, 101, 80.5, "80", null) : rien n’est écrit', function () {
  const mem = utiliser(memoire());
  [0, 101, 80.5, '80', null].forEach(function (v) { assert.equal(rg.ecrireObjectif(v), false, String(v)); });
  assert.deepEqual(Object.keys(mem._m), []);
});

test('contenu illisible ou invalide → objectif par défaut', function () {
  const mem = utiliser(memoire());
  mem._m['qcm-pj-reglages'] = '{pas du json';
  assert.deepEqual(rg.lireReglages(), { objectif: 80 });
  mem._m['qcm-pj-reglages'] = JSON.stringify({ objectif: 150 });
  assert.deepEqual(rg.lireReglages(), { objectif: 80 });
});

test('mémoire pleine : ecrireObjectif répond « non » sans planter', function () {
  utiliser(memoirePleine());
  assert.equal(rg.ecrireObjectif(70), false);
});

test('l’objectif ne touche jamais aux données qcm-pj-v1 et n’entre pas dans la sauvegarde', function () {
  const mem = utiliser(memoire()), S = st.fresh();
  st.saveState(S);
  const avant = mem._m['qcm-pj-v1'];
  rg.ecrireObjectif(65);
  assert.equal(mem._m['qcm-pj-v1'], avant);
  assert.ok(!st.backupText(st.loadState()).includes('objectif'));
});

test('écart à l’objectif et message, en points de pourcentage', function () {
  assert.equal(rg.ecartObjectif(73, 80), 7);
  assert.equal(rg.ecartObjectif(85, 80), 0);
  assert.equal(rg.messageObjectif(73, 80), 'Plus que 7 points avant ton objectif (80 %).');
  assert.equal(rg.messageObjectif(79, 80), 'Plus que 1 point avant ton objectif (80 %).');
  assert.equal(rg.messageObjectif(80, 80), 'Objectif atteint (80 %).');
});
