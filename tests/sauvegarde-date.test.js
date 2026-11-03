// Date de sauvegarde (étape 6c, point 4) : chaque texte de sauvegarde porte la date de CETTE sauvegarde.
// Données FICTIVES uniquement, horloge contrôlée. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { demarrer, creerHorloge, texte, tous, clic, bouton, attendre } = require('./faux-navigateur.js');

const JOUR = 864e5;
function etat(lastBackup) {
  return { v: 1, questions: [{ id: 'q1', num: 1, qcm: 'Fictif', theme: 'gav', type: 'single', text: 'Énoncé fictif', choices: [{ k: 'a', text: 'Oui' }, { k: 'b', text: 'Non' }], correct: ['a'], explanation: 'Explication fictive.' }],
    sessions: [{ id: 5, ts: 5, ids: ['q1'], results: [{ qid: 'q1', picked: ['a'], ok: true }], partial: false }], current: null, lastBackup: lastBackup === undefined ? null : lastBackup };
}
function allerSauvegarde(app) {
  clic(bouton(app.tabs, 'Réglages'));
  clic(tous(app.view).find(e => e.tagName === 'button' && /entree/.test(e.className) && texte(e).startsWith('Sauvegarde')));
}
function derniere(app) { return JSON.parse(app.mem['qcm-pj-v1']).lastBackup; }
function sansDate(txt) { const o = JSON.parse(txt); delete o.lastBackup; return JSON.stringify(o); }

test('(1) le texte généré contient la date de CETTE sauvegarde, enregistrée aussi après réussite', async function () {
  const hz = creerHorloge(), t = {};
  const app = demarrer(etat(), { clipboard: { writeText: x => { t.texte = x; return Promise.resolve(); } } }, { horloge: hz });
  allerSauvegarde(app);
  clic(bouton(app.view, 'Copier la sauvegarde'));
  await attendre();
  assert.equal(JSON.parse(t.texte).lastBackup, hz.maintenant);
  assert.equal(derniere(app), hz.maintenant);
  // Partage : même règle.
  let partage = null;
  const app2 = demarrer(etat(), { share: d => { partage = d; return Promise.resolve(); } }, { horloge: hz });
  allerSauvegarde(app2);
  clic(bouton(app2.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(JSON.parse(partage.text).lastBackup, hz.maintenant);
  assert.equal(derniere(app2), hz.maintenant);
});

test('(2) deux sauvegardes faites à deux heures différentes ne diffèrent que par cette date', async function () {
  const hz = creerHorloge(), textes = [];
  const app = demarrer(etat(), { clipboard: { writeText: x => { textes.push(x); return Promise.resolve(); } } }, { horloge: hz });
  allerSauvegarde(app);
  clic(bouton(app.view, 'Copier la sauvegarde')); await attendre();
  const premiere = hz.maintenant;
  hz.sauter(3 * 3600000);
  clic(bouton(app.view, 'Copier la sauvegarde')); await attendre();
  assert.equal(JSON.parse(textes[0]).lastBackup, premiere);
  assert.equal(JSON.parse(textes[1]).lastBackup, premiere + 3 * 3600000);
  assert.notEqual(textes[0], textes[1]);
  assert.equal(sansDate(textes[0]), sansDate(textes[1]));
  // La clé lastBackup garde sa place : le texte reste dans l'ordre du format v1.
  assert.deepEqual(Object.keys(JSON.parse(textes[1])), ['v', 'questions', 'sessions', 'current', 'lastBackup']);
});

test('(3) après restauration, la date de dernière sauvegarde restaurée est conservée', function () {
  const hz = creerHorloge();
  const restauree = etat(hz.maintenant - 3 * JOUR);
  const app = demarrer({ v: 1, questions: [], sessions: [], current: null, lastBackup: null }, {}, { horloge: hz });
  allerSauvegarde(app);
  tous(app.view).find(e => e.attrs.id === 'restoretext').value = JSON.stringify(restauree);
  const b = bouton(app.view, 'Restaurer ce texte');
  clic(b); clic(b);
  assert.match(texte(app.view), /Sauvegarde restaurée/);
  assert.equal(derniere(app), hz.maintenant - 3 * JOUR);
  clic(bouton(app.tabs, 'Accueil'));
  assert.match(texte(app.view), /Dernière sauvegarde il y a 3 jours/);
});

test('(4) copie ou partage en échec (et partage annulé) : la date n’est pas enregistrée', async function () {
  const hz = creerHorloge();
  const avant = hz.maintenant - 2 * JOUR;
  // Copie impossible : le texte s'affiche pour une copie à la main, la date ne change pas.
  const copie = demarrer(etat(avant), { clipboard: { writeText: () => Promise.reject(new Error('refus')) } }, { horloge: hz });
  allerSauvegarde(copie);
  clic(bouton(copie.view, 'Copier la sauvegarde')); await attendre();
  assert.equal(derniere(copie), avant);
  assert.match(texte(copie.view), /Copie automatique impossible/);
  // Partage en échec, puis partage annulé.
  const echec = demarrer(etat(avant), { share: () => Promise.reject(new Error('NotAllowedError')) }, { horloge: hz });
  allerSauvegarde(echec);
  clic(bouton(echec.view, 'Partager la sauvegarde')); await attendre();
  assert.equal(derniere(echec), avant);
  const annule = demarrer(etat(avant), { share: () => { const e = new Error('annulé'); e.name = 'AbortError'; return Promise.reject(e); } }, { horloge: hz });
  allerSauvegarde(annule);
  clic(bouton(annule.view, 'Partager la sauvegarde')); await attendre();
  assert.equal(derniere(annule), avant);
});
