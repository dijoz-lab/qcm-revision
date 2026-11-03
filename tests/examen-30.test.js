// Examen blanc de 30 minutes (étape 6b) : tirage des questions difficiles ou souvent ratées, minuteur indicatif, fin à 30 min.
// Données FICTIVES uniquement. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const ex = require('../docs/examen.js');
const { demarrer, creerHorloge, texte, tous, clic, bouton } = require('./faux-navigateur.js');

const MIN = 60000;
function banque(nGav, nProc) {
  const qs = [];
  function q(id, theme) { return { id: id, num: 1, qcm: 'Fictif', theme: theme, type: 'single', text: 'Énoncé fictif ' + id, choices: [{ k: 'a', text: 'Un' }, { k: 'b', text: 'Deux' }], correct: ['a'], explanation: 'Explication fictive.' }; }
  for (let i = 0; i < nGav; i++) qs.push(q('g' + i, 'gav'));
  for (let i = 0; i < nProc; i++) qs.push(q('p' + i, 'proc'));
  return qs;
}
// Séance : liste de [qid, juste ?].
function seance(ts, reponses, partial) { return { id: ts, ts: ts, ids: reponses.map(r => r[0]), results: reponses.map(r => ({ qid: r[0], picked: ['a'], ok: r[1] })), partial: !!partial }; }
function ratees(ids, ts) { return seance(ts, ids.map(id => [id, false])); }

test('sans historique : 30 questions distinctes au hasard, proportion de la banque (30/60 → 10 + 20)', function () {
  const ids = ex.tirerExamenDifficile(banque(30, 60), [], [], 30, null);
  assert.equal(ids.length, 30); assert.equal(new Set(ids).size, 30);
  assert.equal(ids.filter(id => id[0] === 'g').length, 10);
  assert.equal(ex.tirerExamenDifficile(banque(10, 19), [], [], 30, null), null);
});

test('ratées au moins 2 fois : au plus les deux tiers (20 sur 30), les plus ratées d’abord', function () {
  const qs = banque(30, 60);
  // p0..p29 ratées 2 fois ; p0..p9 ratées une 3e fois (les plus ratées).
  const sessions = [ratees(qs.slice(30, 60).map(q => q.id), 1), ratees(qs.slice(30, 60).map(q => q.id), 2), ratees(qs.slice(30, 40).map(q => q.id), 3)];
  for (let essai = 0; essai < 10; essai++) {
    const ids = ex.tirerExamenDifficile(qs, sessions, [], 30, null);
    const souvent = ids.filter(id => /^p([0-9]|[12][0-9])$/.test(id));
    assert.equal(souvent.length, 20, 'plafond des deux tiers');
    for (let i = 0; i < 10; i++) assert.ok(ids.includes('p' + i), 'p' + i + ' (3 erreurs) est choisie');
    assert.equal(new Set(ids).size, 30);
  }
});

test('ensuite les ratées une fois, puis les jamais vues ou moins vues', function () {
  const qs = banque(30, 60);
  const sessions = [
    ratees(['p0', 'p1'], 1), ratees(['p0', 'p1'], 2),                 // 2 ratées 2 fois
    ratees(['p2', 'p3', 'p4', 'g0', 'g1'], 3),                        // 5 ratées 1 fois
    seance(4, qs.slice(10, 30).map(q => [q.id, true]).concat(qs.slice(40, 90).map(q => [q.id, true])))  // déjà vues, réussies
  ];
  const ids = ex.tirerExamenDifficile(qs, sessions, [], 30, null);
  ['p0', 'p1', 'p2', 'p3', 'p4', 'g0', 'g1'].forEach(id => assert.ok(ids.includes(id), id));
  // Les jamais vues (g2..g9, p5..p9) passent avant les déjà vues réussies.
  ['g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'p5', 'p6', 'p7', 'p8', 'p9'].forEach(id => assert.ok(ids.includes(id), id + ' jamais vue'));
});

test('séances interrompues exclues ; erreurs et questions sans réponse des examens comptées', function () {
  const qs = banque(30, 60);
  const sessions = [seance(1, [['p50', false]], true), seance(2, [['p50', false]], true), seance(3, [['p50', false]], true)];
  const examens = [{ id: 9, type: 60, debut: 4, fin: 5, motif: 'termine', results: [{ qid: 'p51', picked: [], ok: false }, { qid: 'p52', picked: ['b'], ok: false }] },
    { id: 10, type: 60, debut: 6, fin: 7, motif: 'termine', results: [{ qid: 'p51', picked: ['b'], ok: false }, { qid: 'p52', picked: [], ok: false }] }];
  const h = ex.historiqueReponses(sessions, examens);
  assert.equal(h.length, 2, 'les 3 séances interrompues ne comptent pas');
  const b = ex.bilanQuestions(h);
  assert.equal(b.p50, undefined);
  assert.equal(b.p51.erreurs, 2); assert.equal(b.p52.erreurs, 2);
  for (let essai = 0; essai < 10; essai++) {
    const ids = ex.tirerExamenDifficile(qs, sessions, examens, 30, null);
    assert.ok(ids.includes('p51') && ids.includes('p52'));
  }
});

// ---------- écran ----------
function etat() { return { v: 1, questions: banque(12, 24), sessions: [], current: null, lastBackup: null }; }
function commencer30(app) { clic(bouton(app.tabs, 'Examen')); clic(bouton(app.view, 'Commencer l’examen 30 min')); }
function id(app, i) { return tous(app.view).find(e => e.attrs.id === i); }

test('épreuve 30 min : n / 30, 30:00, repère d’1 minute indicatif (aucun passage automatique, « Minute dépassée »)', function () {
  const app = demarrer(etat(), {}, { horloge: creerHorloge() });
  commencer30(app);
  assert.match(texte(app.view), /Question 1 \/ 30/);
  assert.equal(id(app, 'temps-global').textContent, '30:00');
  assert.match(texte(app.view), /Repère : 1 minute par question/);
  app.horloge.avancer(70000);
  assert.match(texte(app.view), /Question 1 \/ 30/, 'pas de passage automatique');
  assert.equal(id(app, 'minute-depassee').textContent, 'Minute dépassée');
  clic(bouton(app.view, 'Suivante'));
  assert.match(texte(app.view), /Question 2 \/ 30/);
  assert.equal(id(app, 'temps-minute').textContent, '1:00');
  assert.equal(id(app, 'minute-depassee').textContent, '');
});

test('30 minutes globales : fin automatique, récapitulatif sur 30, ligne « Examen 30 min » dans la liste', function () {
  const app = demarrer(etat(), {}, { horloge: creerHorloge() });
  commencer30(app);
  clic(tous(app.view).filter(e => e.className === 'choice')[0]);
  app.horloge.avancer(30 * MIN);
  const t = texte(app.view);
  assert.match(t, /Temps écoulé/);
  assert.match(t, /Examen 30 min · note estimée/);
  assert.match(t, /÷ \(30 × 1\) × 20/);
  assert.equal(tous(app.view).filter(e => /ligne-recap/.test(e.className)).length, 30);
  const d = JSON.parse(app.mem['qcm-pj-v1']);
  assert.equal(d.examens[0].type, 30); assert.equal(d.examens[0].motif, 'temps');
  clic(bouton(app.view, 'Retour à l’onglet Examen'));
  assert.match(texte(app.view), /Examen 30 min.*1 juste · 0 fausse · 29 sans réponse · temps écoulé/);
});
