// Écran Sauvegarde : bouton « Partager la sauvegarde » et stockage protégé, dans le faux navigateur (tests/faux-navigateur.js).
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { demarrer, texte, tous, clic, bouton, attendre } = require('./faux-navigateur.js');

// Banque fictive d'une question, jamais sauvegardée.
function etat() {
  return { v: 1, questions: [{ id: 'q1', num: 1, qcm: 'Fictif', theme: 'gav', type: 'single', text: 'Énoncé fictif', choices: [{ k: 'a', text: 'Oui' }, { k: 'b', text: 'Non' }], correct: ['a'], explanation: 'Explication fictive.' }],
    sessions: [], current: null, lastBackup: null };
}
function allerSauvegarde(app) {
  clic(bouton(app.tabs, 'Réglages'));
  clic(tous(app.view).find(e => e.tagName === 'button' && /entree/.test(e.className) && texte(e).startsWith('Sauvegarde')));
}
function derniereSauvegarde(app) { return JSON.parse(app.mem['qcm-pj-v1']).lastBackup; }
// Presse-papiers qui garde le texte copié.
function pressePapiers(trace) { return { writeText: function (t) { trace.copie = t; return Promise.resolve(); } }; }

test('« Partager la sauvegarde » apparaît si navigator.share existe, disparaît sinon ; « Copier » reste toujours', function () {
  const avec = demarrer(etat(), { share: function () { return Promise.resolve(); } });
  allerSauvegarde(avec);
  assert.ok(bouton(avec.view, 'Partager la sauvegarde'));
  assert.ok(bouton(avec.view, 'Copier la sauvegarde'));
  const sans = demarrer(etat(), {});
  allerSauvegarde(sans);
  assert.equal(bouton(sans.view, 'Partager la sauvegarde'), undefined);
  assert.ok(bouton(sans.view, 'Copier la sauvegarde'));
});

test('partage réussi : date de sauvegarde mise à jour ; annulation (AbortError) : rien ne change, aucun message', async function () {
  const ok = demarrer(etat(), { share: function () { return Promise.resolve(); } });
  allerSauvegarde(ok);
  clic(bouton(ok.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(typeof derniereSauvegarde(ok), 'number');
  assert.match(texte(ok.view), /Sauvegarde partagée/);

  const annule = demarrer(etat(), { share: function () { const e = new Error('annulé'); e.name = 'AbortError'; return Promise.reject(e); } });
  allerSauvegarde(annule);
  const avant = texte(annule.view);
  clic(bouton(annule.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(derniereSauvegarde(annule), null);
  assert.equal(texte(annule.view), avant);
});

test('autre erreur de partage : message court qui propose « Copier », date inchangée', async function () {
  const app = demarrer(etat(), { share: function () { return Promise.reject(new Error('NotAllowedError')); } });
  allerSauvegarde(app);
  clic(bouton(app.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(derniereSauvegarde(app), null);
  assert.match(texte(app.view), /Le partage n’a pas fonctionné\. Utilise « Copier la sauvegarde »\./);
});

test('le texte partagé (fichier .txt ou texte seul) est identique à celui de « Copier la sauvegarde »', async function () {
  const t = {};
  const copie = demarrer(etat(), { clipboard: pressePapiers(t) });
  allerSauvegarde(copie);
  clic(bouton(copie.view, 'Copier la sauvegarde'));
  await attendre();
  assert.ok(t.copie && t.copie.length > 0);
  assert.equal(typeof derniereSauvegarde(copie), 'number');

  // Fichier accepté : un fichier texte sauvegarde-qcm-AAAA-MM-JJ.txt.
  let partage = null;
  const fichier = demarrer(etat(), { canShare: function (d) { return !!(d && d.files); }, share: function (d) { partage = d; return Promise.resolve(); } });
  allerSauvegarde(fichier);
  clic(bouton(fichier.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(partage.files.length, 1);
  assert.match(partage.files[0].name, /^sauvegarde-qcm-\d{4}-\d{2}-\d{2}\.txt$/);
  assert.equal(await partage.files[0].text(), t.copie);

  // Fichiers refusés : le même texte, sans fichier.
  partage = null;
  const seul = demarrer(etat(), { canShare: function () { return false; }, share: function (d) { partage = d; return Promise.resolve(); } });
  allerSauvegarde(seul);
  clic(bouton(seul.view, 'Partager la sauvegarde'));
  await attendre();
  assert.equal(partage.files, undefined);
  assert.equal(partage.text, t.copie);
});

test('stockage protégé : persist() est appelé au démarrage, puis l’écran Sauvegarde affiche « oui »', async function () {
  let appels = 0;
  const app = demarrer(etat(), { storage: { persist: function () { appels++; return Promise.resolve(true); }, persisted: function () { return Promise.resolve(true); } } });
  assert.equal(appels, 1);
  await attendre();
  allerSauvegarde(app);
  assert.match(texte(app.view), /Stockage protégé : oui/);
});

test('l’application démarre quand l’API de stockage est absente, échoue ou plante', async function () {
  const cas = {
    absente: {},
    refus: { storage: { persist: function () { return Promise.reject(new Error('refus')); }, persisted: function () { return Promise.resolve(false); } } },
    plante: { storage: { persist: function () { throw new Error('plantage'); } } }
  };
  const attendu = { absente: 'non disponible', refus: 'non', plante: 'non disponible' };
  for (const nom of Object.keys(cas)) {
    const app = demarrer(etat(), cas[nom]);
    assert.match(texte(app.view), /Prêt\./, nom + ' : l’accueil s’affiche');
    await attendre();
    allerSauvegarde(app);
    assert.match(texte(app.view), new RegExp('Stockage protégé : ' + attendu[nom]), nom);
  }
});
