// Tests de la liste des séances de l'écran Progression (fonction lignesProgression, en tête de docs/app.js).
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { lignesProgression } = require('../docs/app.js');

const THEMES = [{ k: 'gav', name: 'Garde à vue' }, { k: 'proc', name: 'Procédure' }];
const QS = [{ id: 'g1', theme: 'gav' }, { id: 'g2', theme: 'gav' }, { id: 'p1', theme: 'proc' }, { id: 'p2', theme: 'proc' }];
function r(qid, ok) { return { qid: qid, ok: ok }; }

test('sans séance terminée : liste vide', function () {
  assert.deepEqual(lignesProgression([], QS, THEMES), []);
  assert.deepEqual(lignesProgression([{ id: 1, ts: 1, results: [] }, { id: 2, ts: 2 }], QS, THEMES), []);
});

test('de la plus récente à la plus ancienne, avec pourcentage global et par thème', function () {
  const sessions = [
    { id: 1, ts: 1000, results: [r('g1', true), r('p1', false)] },
    { id: 2, ts: 3000, results: [r('g1', true), r('g2', true), r('p1', true), r('p2', false)], partial: false },
    { id: 3, ts: 2000, results: [r('p1', true)], partial: true }
  ];
  const l = lignesProgression(sessions, QS, THEMES);
  assert.deepEqual(l.map(function (x) { return x.id; }), [2, 3, 1]);
  assert.deepEqual(l[0], { id: 2, ts: 3000, partial: false, total: 4, justes: 3, pct: 75,
    themes: [{ k: 'gav', name: 'Garde à vue', total: 2, justes: 2, pct: 100 }, { k: 'proc', name: 'Procédure', total: 2, justes: 1, pct: 50 }] });
  assert.equal(l[1].partial, true);
  assert.deepEqual(l[1].themes[0], { k: 'gav', name: 'Garde à vue', total: 0, justes: 0, pct: null });
  assert.equal(l[2].pct, 50);
});

test('question supprimée de la banque : comptée dans le total, pas dans les thèmes', function () {
  const l = lignesProgression([{ id: 1, ts: 1, results: [r('g1', true), r('disparue', false)] }], QS, THEMES);
  assert.equal(l[0].total, 2);
  assert.equal(l[0].pct, 50);
  assert.equal(l[0].themes[0].total, 1);
  assert.equal(l[0].themes[1].total, 0);
});

test('même heure de début : la séance enregistrée en dernier passe en premier', function () {
  const l = lignesProgression([{ id: 'a', ts: 5, results: [r('g1', true)] }, { id: 'b', ts: 5, results: [r('g1', false)] }], QS, THEMES);
  assert.deepEqual(l.map(function (x) { return x.id; }), ['b', 'a']);
});

test('lecture seule : l’historique n’est pas modifié', function () {
  const sessions = [{ id: 1, ts: 2, results: [r('g1', true)] }, { id: 2, ts: 1, results: [r('p1', false)] }];
  const avant = JSON.stringify(sessions);
  lignesProgression(sessions, QS, THEMES);
  assert.equal(JSON.stringify(sessions), avant);
});
