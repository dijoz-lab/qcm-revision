// Compatibilité des sauvegardes (règle 6) : sauvegardes FICTIVES uniquement, jamais de texte de banque-privee/.
// 1. Une ancienne sauvegarde (sans champ d'examen) fait l'aller-retour à l'identique.
// 2. Une sauvegarde avec examens et un champ inconnu fait l'aller-retour sans perte.
// 3. La restauration par l'écran Sauvegarde ne supprime aucun champ.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const st = require('../docs/stockage.js');
const { demarrer, creerHorloge, texte, tous, clic, bouton } = require('./faux-navigateur.js');

function questionFictive(id, theme) {
  return { id: id, num: 1, qcm: 'Médiathèque fictive', theme: theme, type: 'single', text: 'Question fictive ' + id + ' ?',
    choices: [{ k: 'a', text: 'Oui' }, { k: 'b', text: 'Non' }], correct: ['a'], explanation: 'Explication fictive.', addedAt: 1 };
}
// Ancienne sauvegarde : format v1 d'origine, résultats sans « picked ».
function ancienne() {
  return { v: 1, questions: [questionFictive('q1', 'gav'), questionFictive('q2', 'proc')],
    sessions: [{ id: 10, ts: 10, ids: ['q1', 'q2'], results: [{ qid: 'q1', ok: true }, { qid: 'q2', ok: false }], partial: false }],
    current: null, lastBackup: 1700000000000 };
}
// Sauvegarde récente : examens terminés, examen en cours et un champ inconnu d'une version future.
function avecExamens() {
  const s = ancienne();
  s.sessions[0].results[0].picked = ['a'];
  s.examens = [{ id: 20, type: 60, debut: 20, fin: 30, motif: 'termine', results: [{ qid: 'q1', picked: ['a'], ok: true }, { qid: 'q2', picked: [], ok: false }] }];
  s.examenEnCours = { id: 40, type: 30, debut: 40, ids: ['q1', 'q2'], reponses: { q1: ['b'] }, idx: 1, arrivee: 45, grille: false };
  s.champFutur = { inconnu: [1, 2, 3] };
  return s;
}

test('ancienne sauvegarde (sans examen) : aller-retour texte → données → texte identique', function () {
  const txt = JSON.stringify(ancienne());
  assert.equal(st.backupText(st.parseBackup(txt)), txt);
});

test('sauvegarde avec examens et champ inconnu : aller-retour sans aucune perte', function () {
  const txt = JSON.stringify(avecExamens());
  const lu = st.parseBackup(txt);
  assert.deepEqual(lu, avecExamens());
  assert.equal(st.backupText(lu), txt);
});

test('mémoire du navigateur : un champ inconnu est conservé à la lecture et à l’écriture', function () {
  const m = {};
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }, configurable: true, writable: true });
  m['qcm-pj-v1'] = JSON.stringify(avecExamens());
  const S = st.loadState();
  assert.equal(st.saveState(S), true);
  assert.equal(m['qcm-pj-v1'], JSON.stringify(avecExamens()));
});

function restaurerParEcran(txt) {
  const app = demarrer({ v: 1, questions: [], sessions: [], current: null, lastBackup: null }, {}, { horloge: creerHorloge() });
  clic(bouton(app.tabs, 'Réglages'));
  clic(tous(app.view).find(e => e.tagName === 'button' && /entree/.test(e.className) && texte(e).startsWith('Sauvegarde')));
  tous(app.view).find(e => e.attrs.id === 'restoretext').value = txt;
  const b = bouton(app.view, 'Restaurer ce texte');
  clic(b); clic(b); // confirmation en deux touchers
  return app;
}

test('restauration par l’écran : ancienne sauvegarde restaurée à l’identique (date de sauvegarde comprise)', function () {
  const txt = JSON.stringify(ancienne());
  const app = restaurerParEcran(txt);
  assert.match(texte(app.view), /Sauvegarde restaurée/);
  assert.equal(app.mem['qcm-pj-v1'], txt);
});

test('restauration par l’écran : examens, examen en cours et champ inconnu conservés', function () {
  const txt = JSON.stringify(avecExamens());
  const app = restaurerParEcran(txt);
  assert.match(texte(app.view), /Sauvegarde restaurée/);
  const lu = JSON.parse(app.mem['qcm-pj-v1']);
  assert.deepEqual(lu.examens, avecExamens().examens);
  assert.deepEqual(lu.champFutur, avecExamens().champFutur);
  assert.ok(lu.examenEnCours, 'examen en cours conservé');
});
