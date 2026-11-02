// Tests du stockage (docs/stockage.js) avec une fausse mémoire de navigateur : aucune vraie donnée.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');

// Fausse mémoire de navigateur (localStorage) ; « pleine » = toute écriture échoue.
function memoire() {
  const m = {};
  return { _m: m, getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
}
function memoirePleine() {
  return { getItem: function () { return null; }, setItem: function () { throw new Error('QuotaExceededError'); }, removeItem: function () {} };
}
function utiliser(mem) { Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true }); return mem; }

utiliser(memoire());
const st = require('../docs/stockage.js');

// Une sauvegarde v1 comme celles déjà produites : résultats SANS le champ picked.
function ancienneSauvegarde() {
  return {
    v: 1,
    questions: [{ id: 'q1', num: 1, qcm: 'Médiathèque fictive', theme: 'gav', type: 'single', text: 'Question fictive ?', choices: [{ k: 'a', text: 'Oui' }, { k: 'b', text: 'Non' }], correct: ['a'], explanation: 'Explication fictive.', addedAt: 1 }],
    sessions: [{ id: 2, ts: 2, ids: ['q1'], results: [{ qid: 'q1', ok: true }], partial: false }],
    current: null,
    lastBackup: null
  };
}

test('la clé de stockage reste « qcm-pj-v1 » (sinon les données déjà enregistrées seraient perdues)', function () {
  assert.equal(st.KEY, 'qcm-pj-v1');
});

test('fresh : état vide au format v1', function () {
  assert.deepEqual(st.fresh(), { v: 1, questions: [], sessions: [], current: null, lastBackup: null });
});

test('validState : accepte un état v1, refuse le reste', function () {
  assert.equal(st.validState(st.fresh()), true);
  assert.equal(st.validState(null), false);
  assert.equal(st.validState({}), false);
  assert.equal(st.validState(Object.assign(st.fresh(), { v: 2 })), false);
  assert.equal(st.validState({ v: 1, questions: [] }), false);
  const sansBonnes = ancienneSauvegarde(); delete sansBonnes.questions[0].correct;
  assert.equal(st.validState(sansBonnes), false);
});

test('règle 6 : une ancienne sauvegarde v1 sans « picked » reste acceptée telle quelle', function () {
  const texte = JSON.stringify(ancienneSauvegarde());
  assert.deepEqual(st.parseBackup(texte), ancienneSauvegarde());
});

test('une sauvegarde avec « picked » est aussi acceptée', function () {
  const s = ancienneSauvegarde(); s.sessions[0].results[0].picked = ['a'];
  assert.deepEqual(st.parseBackup(JSON.stringify(s)), s);
});

test('parseBackup refuse un texte invalide (rien n’est remplacé)', function () {
  assert.throws(function () { st.parseBackup('pas une sauvegarde'); });
  assert.throws(function () { st.parseBackup('{}'); }, /format/);
  assert.throws(function () { st.parseBackup(JSON.stringify(Object.assign(st.fresh(), { v: 2 }))); }, /format/);
});

test('backupText puis parseBackup : la sauvegarde revient identique', function () {
  const s = ancienneSauvegarde();
  assert.deepEqual(st.parseBackup(st.backupText(s)), s);
});

test('loadState : mémoire vide → état vide', function () {
  utiliser(memoire());
  assert.deepEqual(st.loadState(), st.fresh());
});

test('saveState puis loadState : les données reviennent identiques, sous la clé qcm-pj-v1', function () {
  const mem = utiliser(memoire()), s = ancienneSauvegarde();
  assert.equal(st.saveState(s), true);
  assert.equal(mem._m['qcm-pj-v1'], JSON.stringify(s));
  assert.deepEqual(st.loadState(), s);
});

test('loadState : contenu illisible ou invalide → état vide, et le contenu stocké n’est pas effacé par la lecture', function () {
  const mem = utiliser(memoire());
  mem._m['qcm-pj-v1'] = '{pas du json';
  assert.deepEqual(st.loadState(), st.fresh());
  assert.equal(mem._m['qcm-pj-v1'], '{pas du json');
  mem._m['qcm-pj-v1'] = JSON.stringify({ v: 2 });
  assert.deepEqual(st.loadState(), st.fresh());
  assert.equal(mem._m['qcm-pj-v1'], JSON.stringify({ v: 2 }));
});

test('mémoire pleine ou interdite : saveState et storageWorks répondent « non » sans planter', function () {
  utiliser(memoirePleine());
  assert.equal(st.saveState(st.fresh()), false);
  assert.equal(st.storageWorks(), false);
});

test('storageWorks : « oui » quand la mémoire marche, sans laisser de clé de test', function () {
  const mem = utiliser(memoire());
  assert.equal(st.storageWorks(), true);
  assert.deepEqual(Object.keys(mem._m), []);
});
