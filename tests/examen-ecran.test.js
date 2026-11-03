// Écrans de l'examen blanc dans le faux navigateur, avec une horloge contrôlée (heure réelle simulée).
// Banque FICTIVE uniquement. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { demarrer, creerHorloge, texte, tous, clic, bouton } = require('./faux-navigateur.js');

const MIN = 60000;
function banque(nGav, nProc) {
  const qs = [];
  function q(id, theme) {
    return { id: id, num: 1, qcm: 'Fictif', theme: theme, type: 'single', text: 'Énoncé fictif ' + id,
      choices: [{ k: 'a', text: 'Choix un' }, { k: 'b', text: 'Choix deux' }, { k: 'c', text: 'Choix trois' }], correct: ['a'], explanation: 'Explication fictive ' + id + '.' };
  }
  for (let i = 0; i < nGav; i++) qs.push(q('g' + i, 'gav'));
  for (let i = 0; i < nProc; i++) qs.push(q('p' + i, 'proc'));
  return qs;
}
function etat(nGav, nProc) { return { v: 1, questions: banque(nGav, nProc), sessions: [], current: null, lastBackup: null }; }
function lancer(e, horloge, memoire) { return demarrer(e, {}, { horloge: horloge || creerHorloge(), memoire: memoire }); }
function versExamen(app) { clic(bouton(app.tabs, 'Examen')); }
function commencer(app) { versExamen(app); clic(bouton(app.view, 'Commencer l’examen')); }
function enCours(app) { return JSON.parse(app.mem['qcm-pj-v1']).examenEnCours; }
function donnees(app) { return JSON.parse(app.mem['qcm-pj-v1']); }
function choix(app) { return tous(app.view).filter(e => e.tagName === 'button' && e.className === 'choice'); }
function id(app, idt) { return tous(app.view).find(e => e.attrs.id === idt); }

test('4 onglets ; onglet Examen : règles, bouton, carte 30 min active (étape 3), aucun examen passé', function () {
  const app = lancer(etat(25, 45));
  assert.deepEqual(tous(app.tabs).filter(e => e.tagName === 'button').map(b => b.attrs['aria-label']), ['Accueil', 'Progression', 'Examen', 'Réglages']);
  versExamen(app);
  const t = texte(app.view);
  assert.match(t, /60 questions, garde à vue et procédure mélangées/);
  assert.match(t, /Aucune correction avant la fin/);
  assert.match(t, /Aucun examen passé/);
  assert.ok(bouton(app.view, 'Commencer l’examen') && !bouton(app.view, 'Commencer l’examen').attrs.disabled);
  const carte30 = tous(app.view).find(e => /carte-examen-30/.test(e.className));
  assert.ok(carte30 && bouton(carte30, 'Commencer l’examen 30 min')); assert.doesNotMatch(texte(carte30), /Bientôt/);
  assert.ok(tous(app.view).some(e => e.tagName === 'img' && /avatar-examen\.png/.test(e.attrs.src)), 'avatar examen présent');
});

test('moins de 60 questions différentes : message clair, pas d’examen', function () {
  const app = lancer(etat(20, 39));
  versExamen(app);
  assert.match(texte(app.view), /au moins 60 questions différentes dans la banque \(tu en as 59\)/);
  assert.equal(bouton(app.view, 'Commencer l’examen').attrs.disabled, '');
});

test('épreuve : n / 60, temps global, minute ; cases à cocher libres ; aucune indication, correction, tampon ni Pause', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  const t = texte(app.view);
  assert.match(t, /Question 1 \/ 60/);
  assert.equal(id(app, 'temps-global').textContent, '60:00');
  assert.equal(id(app, 'temps-minute').textContent, '1:00');
  assert.doesNotMatch(t, /réponses? possibles?|une seule réponse|au moins une|attendue|Correct|Incorrect|Explication|Pause/i);
  assert.ok(choix(app).every(b => b.attrs.role === 'checkbox'));
  clic(choix(app)[1]); clic(choix(app)[2]);
  assert.equal(choix(app).filter(b => b.attrs['aria-checked'] === 'true').length, 2);
  assert.deepEqual(enCours(app).reponses[enCours(app).ids[0]], ['b', 'c']);
  assert.equal(enCours(app).ids.length, 60);
  assert.equal(new Set(enCours(app).ids).size, 60);
});

test('minute écoulée : passage automatique, réponse conservée ; Précédente relance la minute ; minuteurs à l’heure réelle', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  const q0 = enCours(app).ids[0];
  clic(choix(app)[0]);
  app.horloge.avancer(30000);
  assert.equal(id(app, 'temps-minute').textContent, '0:30');
  assert.equal(id(app, 'temps-global').textContent, '59:30');
  app.horloge.avancer(30000);
  assert.match(texte(app.view), /Question 2 \/ 60/);
  assert.deepEqual(enCours(app).reponses[q0], ['a']);
  app.horloge.avancer(20000);
  clic(bouton(app.view, 'Précédente'));
  assert.match(texte(app.view), /Question 1 \/ 60/);
  assert.equal(id(app, 'temps-minute').textContent, '1:00');
  assert.equal(choix(app)[0].attrs['aria-checked'], 'true');
});

test('grille : 60 cases (répondue, vide, dernière affichée), accès à n’importe quelle question', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  clic(choix(app)[0]);
  clic(bouton(app.view, 'Grille'));
  const cases = tous(app.view).filter(e => e.tagName === 'button' && /\bcase\b/.test(e.className));
  assert.equal(cases.length, 60);
  assert.equal(cases[0].attrs['aria-label'], 'Question 1, répondue, dernière affichée');
  assert.equal(cases[1].attrs['aria-label'], 'Question 2, sans réponse');
  assert.match(texte(app.view), /59 questions sans réponse/);
  assert.equal(id(app, 'temps-minute'), undefined, 'pas de minute pendant la grille');
  clic(cases[9]);
  assert.match(texte(app.view), /Question 10 \/ 60/);
  assert.equal(id(app, 'temps-minute').textContent, '1:00');
});

test('dernière question à 0 : la grille s’ouvre sans terminer', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  clic(bouton(app.view, 'Grille'));
  clic(tous(app.view).filter(e => /\bcase\b/.test(e.className))[59]);
  assert.match(texte(app.view), /Question 60 \/ 60/);
  app.horloge.avancer(MIN);
  assert.match(texte(app.view), /Grille des questions/);
  assert.ok(enCours(app), 'examen toujours en cours');
});

test('Terminer : confirmation avec le nombre de questions vides, puis récapitulatif complet', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  clic(choix(app)[0]);                                   // Q1 : « a » = juste
  clic(bouton(app.view, 'Suivante')); clic(choix(app)[1]); // Q2 : « b » = fausse
  const fin = bouton(app.view, 'Terminer l’examen');
  clic(fin);
  assert.equal(fin.textContent, 'Confirmer : 58 questions vides');
  clic(fin);
  const t = texte(app.view);
  assert.match(t, /Récapitulatif/);
  assert.match(t, /Estimation, barème supposé/);
  assert.match(t, /\(justes × 1 − fausses × 0,5 − sans réponse × 0\) ÷ \(60 × 1\) × 20/);
  assert.match(t, /0,2 \/ 20/);                         // (1 − 0,5) ÷ 60 × 20 = 0,17
  assert.equal(tous(app.view).filter(e => /ligne-recap/.test(e.className)).length, 60);
  assert.equal(donnees(app).examens.length, 1);
  assert.equal(donnees(app).examenEnCours, null);
  // Filtre « Fausses » puis détail au toucher : 4 états et résumé.
  const radio = tous(app.view).filter(e => e.tagName === 'input' && e.attrs.name === 'filtre-recap')[2];
  radio.listeners.change[0]({ target: radio });
  const lignes = tous(app.view).filter(e => /ligne-recap/.test(e.className));
  assert.equal(lignes.length, 1);
  clic(lignes[0]);
  const d = texte(app.view);
  assert.match(d, /0 trouvée sur 1, 1 oubliée, 1 cochée à tort/);
  assert.match(d, /Oubliée/); assert.match(d, /Cochée à tort/); assert.match(d, /Explication fictive/);
  assert.ok(tous(app.view).some(e => /choix-corrige oubliee/.test(e.className)));
});

test('60 minutes globales : fin automatique (« Temps écoulé »)', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  app.horloge.avancer(60 * MIN);
  assert.match(texte(app.view), /Temps écoulé/);
  assert.equal(donnees(app).examens[0].motif, 'temps');
  assert.equal(donnees(app).examenEnCours, null);
});

test('téléphone verrouillé 3 min puis retour au premier plan : un seul passage, minute neuve', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  app.horloge.sauter(3 * MIN);
  app.declencher('visibilitychange');
  assert.match(texte(app.view), /Question 2 \/ 60/);
  assert.equal(id(app, 'temps-minute').textContent, '1:00');
  assert.equal(id(app, 'temps-global').textContent, '57:00');
});

test('application fermée puis rouverte : l’épreuve reprend avec les temps recalculés ; après 60 min, elle est terminée', function () {
  const hz = creerHorloge();
  const app = lancer(etat(25, 45), hz);
  commencer(app);
  clic(choix(app)[2]);
  const q0 = enCours(app).ids[0];
  hz.sauter(5 * MIN);
  const rouverte = lancer(null, hz, app.mem);
  assert.match(texte(rouverte.view), /Question 2 \/ 60/);
  assert.equal(id(rouverte, 'temps-global').textContent, '55:00');
  assert.deepEqual(enCours(rouverte).reponses[q0], ['c']);
  hz.sauter(2 * 60 * MIN);
  const tard = lancer(null, hz, app.mem);
  assert.match(texte(tard.view), /Temps écoulé/);
  assert.equal(donnees(tard).examens.length, 1);
});

test('séparation : un examen ne compte ni dans la moyenne de l’Accueil, ni dans Dernières séances, ni dans Progression', function () {
  const app = lancer(etat(25, 45));
  commencer(app);
  clic(choix(app)[0]);
  const fin = bouton(app.view, 'Terminer l’examen'); clic(fin); clic(fin);
  assert.deepEqual(donnees(app).sessions, []);
  clic(bouton(app.tabs, 'Accueil'));
  assert.match(texte(app.view), /Pas encore de séance terminée/);
  assert.doesNotMatch(texte(app.view), /Dernières séances/);
  clic(bouton(app.tabs, 'Progression'));
  assert.match(texte(app.view), /Pas encore de séance terminée/);
  versExamen(app);
  assert.match(texte(app.view), /Examen 60 min/);
  assert.match(texte(app.view), /1 juste · 0 fausse · 59 sans réponse/);
});

test('un examen ne démarre pas pendant une séance en cours', function () {
  const e = etat(25, 45);
  e.current = { id: 1, ts: 1, ids: ['g0'], idx: 0, results: [], phase: 'answer' };
  const app = lancer(e);
  commencer(app);
  assert.match(texte(app.view), /Termine ou abandonne ta séance en cours/);
  assert.equal(donnees(app).examenEnCours, undefined);
});

test('Réglages › Barème : valeurs enregistrées (l’objectif est conservé), valeurs refusées, note recalculée', function () {
  const app = lancer(etat(25, 45));
  app.mem['qcm-pj-reglages'] = JSON.stringify({ objectif: 70 });
  clic(bouton(app.tabs, 'Réglages'));
  clic(tous(app.view).find(e => /entree/.test(e.className) && texte(e).startsWith('Barème')));
  assert.match(texte(app.view), /Barème inconnu : à régler quand l’école le confirme/);
  id(app, 'bareme-bonne').value = '2'; id(app, 'bareme-fausse').value = '1'; id(app, 'bareme-vide').value = '0,5';
  clic(bouton(app.view, 'Enregistrer le barème'));
  assert.match(texte(app.view), /Barème enregistré/);
  assert.deepEqual(JSON.parse(app.mem['qcm-pj-reglages']), { objectif: 70, bareme: { bonne: 2, fausse: 1, vide: 0.5 } });
  id(app, 'bareme-bonne').value = '0';
  clic(bouton(app.view, 'Enregistrer le barème'));
  assert.match(texte(app.view), /Valeurs refusées/);
  assert.deepEqual(JSON.parse(app.mem['qcm-pj-reglages']).bareme, { bonne: 2, fausse: 1, vide: 0.5 });
  assert.ok(bouton(app.view, 'Retour aux Réglages'));
});
