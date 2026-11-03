// Tests de la logique des examens blancs (docs/examen.js) : tirage, minuteurs à l'heure réelle, notation, correction détaillée.
// Données FICTIVES uniquement. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const ex = require('../docs/examen.js');

function banque(nGav, nProc) {
  const qs = [];
  for (let i = 0; i < nGav; i++) qs.push({ id: 'g' + i, theme: 'gav', choices: [{ k: 'a' }, { k: 'b' }, { k: 'c' }], correct: ['a'] });
  for (let i = 0; i < nProc; i++) qs.push({ id: 'p' + i, theme: 'proc', choices: [{ k: 'a' }, { k: 'b' }, { k: 'c' }], correct: ['a', 'b'] });
  return qs;
}
const T0 = Date.UTC(2026, 10, 3, 9, 0, 0), MIN = 60000;

// ---------- tirage ----------
test('tirage 60 : 60 questions distinctes, proportion de la banque (40/74 → 21 + 39), sur 20 tirages', function () {
  const qs = banque(40, 74);
  for (let i = 0; i < 20; i++) {
    const ids = ex.tirerExamen(qs, 60, null);
    assert.equal(ids.length, 60);
    assert.equal(new Set(ids).size, 60);
    assert.equal(ids.filter(id => id[0] === 'g').length, 21);
    assert.equal(ids.filter(id => id[0] === 'p').length, 39);
  }
});

test('tirage 60 : thèmes entremêlés (pas tous les « garde à vue » d’un bloc) et ordre différent d’un tirage à l’autre', function () {
  const qs = banque(40, 74), a = ex.tirerExamen(qs, 60, null), b = ex.tirerExamen(qs, 60, null);
  const premiers = a.slice(0, 21).filter(id => id[0] === 'g').length;
  assert.ok(premiers < 21, 'les questions de garde à vue ne sont pas toutes au début');
  assert.notDeepEqual(a, b);
});

test('tirage 60 : la constante de part de garde à vue est respectée (0.5 → 30 + 30)', function () {
  const ids = ex.tirerExamen(banque(40, 74), 60, 0.5);
  assert.equal(ids.filter(id => id[0] === 'g').length, 30);
});

test('tirage 60 : moins de 60 questions différentes → aucun examen ; doublons d’identifiant ignorés', function () {
  assert.equal(ex.tirerExamen(banque(20, 39), 60, null), null);
  const avecDoublons = banque(30, 30).concat(banque(0, 5)); // p0..p4 en double
  assert.equal(ex.questionsUniques(avecDoublons).length, 60);
  const ids = ex.tirerExamen(avecDoublons, 60, null);
  assert.equal(new Set(ids).size, 60);
});

test('tirage : thème trop petit, le reste est complété par l’autre thème', function () {
  const ids = ex.tirerExamen(banque(2, 70), 60, 0.5);
  assert.equal(ids.length, 60);
  assert.equal(ids.filter(id => id[0] === 'g').length, 2);
});

// ---------- minuteurs à l'heure réelle ----------
function examen(n) { return ex.nouvelExamen(60, Array.from({ length: n || 60 }, (_, i) => 'q' + i), T0); }

test('minute : avant 60 s rien ne bouge ; à 60 s passage à la question suivante, minute relancée', function () {
  let e = examen();
  let r = ex.avancerExamen(e, T0 + 59999);
  assert.equal(r.change, false); assert.equal(r.ex.idx, 0);
  r = ex.avancerExamen(e, T0 + MIN);
  assert.equal(r.ex.idx, 1); assert.equal(r.ex.arrivee, T0 + MIN); assert.equal(r.fini, false);
});

test('réponse conservée lors du passage automatique', function () {
  let e = ex.basculerReponse(examen(), 'q0', 'b');
  const r = ex.avancerExamen(e, T0 + MIN);
  assert.deepEqual(r.ex.reponses.q0, ['b']);
});

test('retour après une longue absence (téléphone verrouillé 10 min) : au plus UN passage, minute neuve', function () {
  const r = ex.avancerExamen(examen(), T0 + 10 * MIN);
  assert.equal(r.ex.idx, 1);
  assert.equal(r.ex.arrivee, T0 + 10 * MIN);
  assert.equal(ex.tempsRestants(r.ex, T0 + 10 * MIN).minute, MIN);
});

test('dernière question à 0 : la grille s’ouvre sans terminer', function () {
  let e = ex.allerA(examen(), 59, T0);
  const r = ex.avancerExamen(e, T0 + MIN);
  assert.equal(r.fini, false); assert.equal(r.ex.grille, true); assert.equal(r.ex.arrivee, null);
  assert.equal(ex.tempsRestants(r.ex, T0 + MIN).minute, null);
});

test('60 minutes globales : fin automatique, même au retour d’arrière-plan', function () {
  assert.equal(ex.avancerExamen(examen(), T0 + 60 * MIN - 1).fini, false);
  assert.equal(ex.avancerExamen(examen(), T0 + 60 * MIN).fini, true);
  assert.equal(ex.avancerExamen(examen(), T0 + 3 * 60 * MIN).fini, true);
});

test('arrivée sur une question (précédente, suivante, grille) : minute relancée ; rester sur place : rien', function () {
  let e = examen();
  e = ex.allerA(e, 3, T0 + 20000);
  assert.equal(e.idx, 3); assert.equal(e.arrivee, T0 + 20000);
  const meme = ex.allerA(e, 3, T0 + 40000);
  assert.equal(meme.arrivee, T0 + 20000);
  const grille = ex.ouvrirGrille(e);
  assert.equal(grille.grille, true); assert.equal(grille.arrivee, null);
  assert.equal(ex.avancerExamen(grille, T0 + 5 * MIN).change, false, 'pas de minute pendant la grille');
  const retour = ex.allerA(grille, 3, T0 + 5 * MIN);
  assert.equal(retour.grille, false); assert.equal(retour.arrivee, T0 + 5 * MIN);
});

test('horloge du téléphone reculée : jamais de temps négatif ni au-delà du maximum', function () {
  const e = ex.allerA(examen(), 2, T0 + 30000);
  const r = ex.avancerExamen(e, T0 + 10000);
  assert.equal(r.ex.arrivee, T0 + 10000);
  const t = ex.tempsRestants(e, T0 - 5 * MIN);
  assert.equal(t.global, 60 * MIN); assert.equal(t.minute, MIN);
});

test('examen 30 min : minuteur indicatif (aucun passage automatique), fin à 30 minutes', function () {
  const e = ex.nouvelExamen(30, Array.from({ length: 30 }, (_, i) => 'q' + i), T0);
  const r = ex.avancerExamen(e, T0 + 5 * MIN);
  assert.equal(r.ex.idx, 0); assert.equal(r.change, false);
  assert.equal(ex.tempsRestants(e, T0 + 5 * MIN).minute, 0);
  assert.equal(ex.avancerExamen(e, T0 + 30 * MIN).fini, true);
});

test('cases à cocher libres : on coche et décoche n’importe quel nombre de réponses ; nombre de questions vides', function () {
  let e = examen(3);
  e = ex.basculerReponse(e, 'q0', 'a'); e = ex.basculerReponse(e, 'q0', 'b'); e = ex.basculerReponse(e, 'q0', 'c');
  assert.deepEqual(e.reponses.q0, ['a', 'b', 'c']);
  e = ex.basculerReponse(e, 'q1', 'a'); e = ex.basculerReponse(e, 'q1', 'a');
  assert.equal(e.reponses.q1, undefined);
  assert.equal(ex.nbSansReponse(e), 2);
});

// ---------- notation ----------
test('finalisation : juste = ensemble exact ; sans réponse = aucune case ; fausse = le reste', function () {
  const qs = { q0: { choices: [{ k: 'a' }, { k: 'b' }], correct: ['a'] }, q1: { choices: [{ k: 'a' }, { k: 'b' }], correct: ['a', 'b'] }, q2: { choices: [{ k: 'a' }, { k: 'b' }], correct: ['a'] }, q3: { choices: [{ k: 'a' }, { k: 'b' }], correct: ['b'] } };
  let e = ex.nouvelExamen(60, ['q0', 'q1', 'q2', 'q3'], T0);
  e = ex.basculerReponse(e, 'q0', 'a');
  e = ex.basculerReponse(e, 'q1', 'b'); e = ex.basculerReponse(e, 'q1', 'a');
  e = ex.basculerReponse(e, 'q3', 'a'); e = ex.basculerReponse(e, 'q3', 'b');
  const fin = ex.finaliserExamen(e, qs, T0 + MIN, 'termine');
  assert.deepEqual(fin.results.map(ex.etatResultat), ['juste', 'juste', 'vide', 'fausse']);
  assert.deepEqual(fin.results[1].picked, ['a', 'b'], 'réponses rangées dans l’ordre des choix');
  assert.deepEqual(ex.comptesExamen(fin.results), { justes: 2, fausses: 1, vides: 1 });
  assert.equal(fin.motif, 'termine'); assert.equal(fin.fin, T0 + MIN); assert.equal(fin.type, 60);
});

test('note estimée : formule, défauts 1 / 0,5 / 0, une décimale, négative possible', function () {
  const b = { bonne: 1, fausse: 0.5, vide: 0 };
  assert.equal(ex.noteSur20({ justes: 45, fausses: 10, vides: 5 }, 60, b), 13.3);
  assert.equal(ex.noteSur20({ justes: 60, fausses: 0, vides: 0 }, 60, b), 20);
  assert.equal(ex.noteSur20({ justes: 5, fausses: 50, vides: 5 }, 60, b), -6.7);
  assert.equal(ex.noteSur20({ justes: 10, fausses: 10, vides: 10 }, 30, { bonne: 2, fausse: 1, vide: 0.5 }), 1.7); // (20 − 10 − 5) ÷ 60 × 20 = 1,67
  assert.equal(ex.texteNote(-6.7), '−6,7 / 20');
  assert.equal(ex.texteFormule(b, 60), '(justes × 1 − fausses × 0,5 − sans réponse × 0) ÷ (60 × 1) × 20');
});

test('filtres du récapitulatif et temps affiché', function () {
  const rs = [{ picked: ['a'], ok: true }, { picked: [], ok: false }, { picked: ['b'], ok: false }];
  assert.deepEqual(ex.filtrerResultats(rs, 'toutes').map(x => x.i), [0, 1, 2]);
  assert.deepEqual(ex.filtrerResultats(rs, 'justes').map(x => x.i), [0]);
  assert.deepEqual(ex.filtrerResultats(rs, 'fausses').map(x => x.i), [2]);
  assert.deepEqual(ex.filtrerResultats(rs, 'vides').map(x => x.i), [1]);
  assert.equal(ex.dureeTexte(60 * MIN), '60:00'); assert.equal(ex.dureeTexte(61000), '1:01'); assert.equal(ex.dureeTexte(400), '0:01');
});

// ---------- correction détaillée ----------
test('correction : 4 états et résumé « 1 trouvée sur 2, 1 oubliée »', function () {
  const q = { choices: [{ k: 'a', text: 'A' }, { k: 'b', text: 'B' }, { k: 'c', text: 'C' }, { k: 'd', text: 'D' }], correct: ['a', 'b'] };
  assert.deepEqual(ex.etatsChoix(q, ['a', 'c']).map(c => c.etat), ['trouvee', 'oubliee', 'atort', 'neutre']);
  assert.equal(ex.resumeCorrection(q, ['a']), '1 trouvée sur 2, 1 oubliée');
  assert.equal(ex.resumeCorrection(q, ['a', 'b']), '2 trouvées sur 2');
  assert.equal(ex.resumeCorrection(q, ['c', 'd']), '0 trouvée sur 2, 2 oubliées, 2 cochées à tort');
  assert.equal(ex.resumeCorrection(q, []), '0 trouvée sur 2, 2 oubliées');
});
