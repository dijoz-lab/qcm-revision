// Étape 6d : avatar d'examen à 80 % sur l'Accueil et le Résultat, coffres (un jeu, pas une prédiction).
// Données FICTIVES uniquement. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const cf = require('../docs/coffres.js');
const { demarrer, creerHorloge, texte, tous, clic, bouton } = require('./faux-navigateur.js');

// Séance de n questions dont j justes.
function seance(ts, j, n, partial) {
  const results = []; for (let i = 0; i < n; i++) results.push({ qid: 'q' + i, picked: ['a'], ok: i < j });
  return { id: ts, ts: ts, ids: results.map(r => r.qid), results: results, partial: !!partial };
}
function banque() {
  const qs = []; for (let i = 0; i < 20; i++) qs.push({ id: 'q' + i, num: 1, qcm: 'Fictif', theme: i < 8 ? 'gav' : 'proc', type: 'single', text: 'Énoncé fictif ' + i, choices: [{ k: 'a', text: 'Un' }, { k: 'b', text: 'Deux' }], correct: ['a'], explanation: 'Explication fictive.' });
  return qs;
}
function etat(sessions) { return { v: 1, questions: banque(), sessions: sessions, current: null, lastBackup: null }; }
function srcAvatarCadran(app) { const img = tous(app.view).find(e => e.tagName === 'img' && /medaillon/.test(e.className)); return img && img.attrs.src; }

// ---------- coffres : logique ----------
test('tranches : < 50 % → 1 ; 50–64 % → 2 ; 65–79 % → 3 ; ≥ 80 % → 4', function () {
  [[0, 1], [49, 1], [50, 2], [64, 2], [65, 3], [79, 3], [80, 4], [100, 4]].forEach(function (x) { assert.equal(cf.coffreDeSeance(x[0]), x[1], String(x[0])); });
});

test('une clé par séance terminée ; interrompues exclues ; pourcentage arrondi comme à l’affichage', function () {
  // 7 / 15 = 46,7 % → 47 → coffre 1 ; 12 / 15 = 80 % → coffre 4 ; 11 / 15 = 73,3 % → coffre 3 ; interrompue ignorée.
  const e = cf.etatCoffres([seance(1, 7, 15), seance(2, 12, 15), seance(3, 11, 15), seance(4, 15, 15, true)]);
  assert.deepEqual(e.map(c => c.cles), [1, 0, 1, 1]);
  assert.ok(e.every(c => !c.ouvert));
  // 2 / 3 = 66,7 % → 67 → coffre 3 (arrondi avant la tranche).
  assert.deepEqual(cf.etatCoffres([seance(1, 2, 3)]).map(c => c.cles), [0, 0, 1, 0]);
});

test('5 clés ouvrent un coffre ; le compteur affiché est plafonné à 5 / 5 ; contenus dans l’ordre', function () {
  const sept = []; for (let i = 0; i < 7; i++) sept.push(seance(i, 15, 15));
  const e = cf.etatCoffres(sept);
  assert.equal(e[3].cles, 7); assert.equal(e[3].affichees, 5); assert.equal(e[3].ouvert, true);
  assert.deepEqual(cf.COFFRES.map(c => c.contenu), ['Château-Thierry', 'Bordeaux', 'Lannion', 'Capitaine de bords de Loire']);
});

// ---------- coffres : écran ----------
test('Accueil : 4 coffres fermés, contenu caché, « n / 5 clés », « C’est un jeu, pas une prédiction »', function () {
  const app = demarrer(etat([seance(1, 15, 15), seance(2, 15, 15)]), {}, { horloge: creerHorloge() });
  const bloc = tous(app.view).find(e => /card coffres/.test(e.className));
  const t = texte(bloc);
  assert.equal(tous(bloc).filter(e => e.tagName === 'li').length, 4);
  assert.match(t, /Coffre 4.*Fermé.*2 \/ 5 clés/);
  cf.COFFRES.forEach(c => assert.ok(!t.includes(c.contenu), 'contenu caché : ' + c.contenu));
  assert.match(t, /C’est un jeu, pas une prédiction/);
});

test('coffre ouvert : ticket affiché ; animation une seule fois (mémorisée dans qcm-pj-reglages, objectif conservé)', function () {
  const cinq = []; for (let i = 0; i < 5; i++) cinq.push(seance(i + 1, 15, 15));
  const app = demarrer(etat(cinq), {}, { horloge: creerHorloge(), mouvement: true });
  const li = () => tous(app.view).filter(e => e.tagName === 'li' && /coffre /.test(e.className))[3];
  assert.match(texte(li()), /Capitaine de bords de Loire/);
  assert.match(li().className, /s-ouvre/);
  assert.deepEqual(JSON.parse(app.mem['qcm-pj-reglages']).coffresVus, [4]);
  // Changer l'objectif ne doit ni effacer coffresVus ni rejouer l'animation.
  const sel = tous(app.view).find(e => e.tagName === 'select');
  sel.listeners.change[0]({ target: { value: '70' } });
  assert.deepEqual(JSON.parse(app.mem['qcm-pj-reglages']), { coffresVus: [4], objectif: 70 });
  assert.doesNotMatch(li().className, /s-ouvre/);
  // Réouverture de l'application : déjà vue, pas d'animation.
  const rouverte = demarrer(null, {}, { horloge: creerHorloge(), mouvement: true, memoire: app.mem });
  const li2 = tous(rouverte.view).filter(e => e.tagName === 'li' && /coffre /.test(e.className))[3];
  assert.doesNotMatch(li2.className, /s-ouvre/);
});

test('moins de mouvement demandé : aucune animation d’ouverture', function () {
  const cinq = []; for (let i = 0; i < 5; i++) cinq.push(seance(i + 1, 15, 15));
  const app = demarrer(etat(cinq), {}, { horloge: creerHorloge() });
  const li = tous(app.view).filter(e => e.tagName === 'li' && /coffre /.test(e.className))[3];
  assert.match(texte(li), /Capitaine de bords de Loire/);
  assert.doesNotMatch(li.className, /s-ouvre/);
});

// ---------- avatar à 80 % ----------
test('avatar du cadran : examen si la moyenne récente ≥ 80 %, sinon entraînement ; sans séance : entraînement', function () {
  assert.match(srcAvatarCadran(demarrer(etat([]), {}, { horloge: creerHorloge() })), /avatar-entrainement/);
  assert.match(srcAvatarCadran(demarrer(etat([seance(1, 12, 15), seance(2, 12, 15), seance(3, 12, 15)]), {}, { horloge: creerHorloge() })), /avatar-examen/);
  assert.match(srcAvatarCadran(demarrer(etat([seance(1, 12, 15), seance(2, 12, 15), seance(3, 11, 15)]), {}, { horloge: creerHorloge() })), /avatar-entrainement/);
});

test('avatar : les séances interrompues ne comptent pas ; le Résultat montre le même avatar que l’Accueil', function () {
  // 3 séances terminées à 100 %, puis une interrompue à 0 % : moyenne = 100 % → avatar d'examen.
  const app = demarrer(etat([seance(1, 15, 15), seance(2, 15, 15), seance(3, 15, 15), seance(4, 0, 15, true)]), {}, { horloge: creerHorloge() });
  assert.match(srcAvatarCadran(app), /avatar-examen/);
  // Une séance d'une question réussie : la moyenne reste ≥ 80 % → même avatar sur le Résultat.
  clic(bouton(app.view, 'Commencer la séance'));
  const c = tous(app.view).filter(e => e.className === 'choice')[0];
  clic(c); clic(bouton(app.view, 'Valider ma réponse'));
  while (bouton(app.view, 'Question suivante')) {
    clic(bouton(app.view, 'Question suivante'));
    clic(tous(app.view).filter(e => e.className === 'choice')[0]); clic(bouton(app.view, 'Valider ma réponse'));
  }
  clic(bouton(app.view, 'Voir le résultat'));
  assert.match(texte(app.view), /Résultat/);
  assert.match(srcAvatarCadran(app), /avatar-examen/);
  clic(bouton(app.tabs, 'Accueil'));
  assert.match(srcAvatarCadran(app), /avatar-examen/);
});

test('mémoire des animations vues : valeurs abîmées ignorées, l’objectif et le barème ne sont jamais effacés', function () {
  const m = {};
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }, configurable: true, writable: true });
  const rg = require('../docs/reglages.js');
  m['qcm-pj-reglages'] = JSON.stringify({ objectif: 75, bareme: { bonne: 1, fausse: 0.25, vide: 0 }, coffresVus: [2, 'x', 9, 2, 1.5] });
  assert.deepEqual(rg.lireCoffresVus(), [2]);
  assert.equal(rg.ecrireCoffreVu(3), true);
  assert.equal(rg.ecrireCoffreVu(7), false);
  assert.deepEqual(JSON.parse(m['qcm-pj-reglages']), { objectif: 75, bareme: { bonne: 1, fausse: 0.25, vide: 0 }, coffresVus: [2, 3] });
});

test('contraste ≥ 4,5:1 : ticket doré (#E8C468) sur le fond d’un coffre ouvert, posé sur une carte', function () {
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (c, a, f) => c.map((v, i) => v * a + f[i] * (1 - a));
  const L = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const carte = mix([36, 52, 100], 0.75, hex('#0F1A3D'));
  const fond = mix([232, 196, 104], 0.08, carte);
  assert.ok(ratio(hex('#E8C468'), fond) >= 4.5, ratio(hex('#E8C468'), fond).toFixed(2));
  assert.ok(ratio(hex('#9FB0D6'), mix([21, 32, 64], 0.65, hex('#0F1A3D'))) >= 4.5);
});
