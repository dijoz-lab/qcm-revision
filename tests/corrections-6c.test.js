// Corrections de l'étape 6c : correction à 4 états dans les séances, séances interrompues hors moyenne, libellés.
// Données FICTIVES uniquement. Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const rg = require('../docs/reglages.js');
const { demarrer, creerHorloge, texte, tous, clic, bouton } = require('./faux-navigateur.js');

function q(id, theme, correct) {
  return { id: id, num: 1, qcm: 'Fictif', theme: theme, type: correct.length > 1 ? 'multi' : 'single', text: 'Énoncé fictif ' + id,
    choices: [{ k: 'a', text: 'Choix un' }, { k: 'b', text: 'Choix deux' }, { k: 'c', text: 'Choix trois' }], correct: correct, explanation: 'Explication fictive.' };
}
function seance(ts, oks, partial) { return { id: ts, ts: ts, ids: oks.map((_, i) => 'q' + i), results: oks.map((ok, i) => ({ qid: 'q' + i, picked: ['a'], ok: ok })), partial: !!partial }; }
function etat(sessions) {
  const qs = []; for (let i = 0; i < 20; i++) qs.push(q('q' + i, i < 8 ? 'gav' : 'proc', ['a']));
  return { v: 1, questions: qs, sessions: sessions || [], current: null, lastBackup: null };
}

test('messageManque : « il te manque X % pour atteindre ton objectif de Z % »', function () {
  assert.equal(rg.messageManque(73, 80), 'il te manque 7 % pour atteindre ton objectif de 80 %');
  assert.equal(rg.messageManque(85, 80), 'ton objectif de 80 % est atteint');
});

test('séances interrompues : hors de la moyenne et de « Dernières séances », visibles dans Progression avec « interrompue »', function () {
  const T = Date.UTC(2026, 10, 1);
  // 2 séances terminées (100 % et 50 %) et 1 interrompue (0 %), la plus récente.
  const app = demarrer(etat([seance(T, [true, true]), seance(T + 1000, [true, false]), seance(T + 2000, [false], true)]), {}, { horloge: creerHorloge() });
  const t = texte(app.view);
  assert.match(t, /Moyenne de tes 2 dernières séances · il te manque 5 % pour atteindre ton objectif de 80 %/);
  const carte = tous(app.view).find(e => /carte-lien/.test(e.className));
  assert.equal(carte.attrs['aria-label'], 'Dernières séances : 100 %, 50 %. Voir la progression');
  assert.doesNotMatch(texte(carte), /\*|interrompue/);
  clic(bouton(app.tabs, 'Progression'));
  assert.match(texte(app.view), /interrompue/);
  assert.match(texte(app.view), /3 séances, de la plus récente/);
});

test('une seule séance terminée : « Moyenne de ta dernière séance » ; « questions différentes déjà vues »', function () {
  const app = demarrer(etat([seance(Date.UTC(2026, 10, 1), [true, true, true, true, true])]), {}, { horloge: creerHorloge() });
  const t = texte(app.view);
  assert.match(t, /Moyenne de ta dernière séance · ton objectif de 80 % est atteint/);
  assert.match(t, /5 questions différentes déjà vues/);
  assert.doesNotMatch(t, /· \d+ vues/);
});

test('bouton « ? » près du cadran : 48 px, libellé accessible, ouvre et ferme 3 lignes d’explication', function () {
  const app = demarrer(etat([seance(1, [true, false]), seance(2, [true, true])]), {}, { horloge: creerHorloge() });
  const aide = bouton(app.view, 'Comment lire ce pourcentage ?');
  assert.equal(aide.attrs['aria-expanded'], 'false');
  clic(aide);
  const lignes = tous(app.view).find(e => /aide-texte/.test(e.className));
  assert.equal(lignes.children.length, 3);
  const t = texte(lignes);
  assert.match(t, /réussies à 100 %.*tout ou rien/);
  assert.match(t, /tes 2 dernières séances terminées/);
  assert.match(t, /pas un seuil officiel/);
  clic(bouton(app.view, 'Comment lire ce pourcentage ?'));
  assert.equal(tous(app.view).find(e => /aide-texte/.test(e.className)), undefined);
});

test('séance de 15 : correction à 4 états après validation, résultat « X questions réussies sur N (Y %) » en premier', function () {
  const qs = [q('m0', 'gav', ['a', 'b'])];
  const app = demarrer({ v: 1, questions: qs, sessions: [], current: null, lastBackup: null }, {}, { horloge: creerHorloge() });
  clic(bouton(app.view, 'Commencer la séance'));
  clic(tous(app.view).filter(e => e.className === 'choice')[0]);
  clic(tous(app.view).filter(e => e.className === 'choice')[2]);
  clic(bouton(app.view, 'Valider ma réponse'));
  const t = texte(app.view);
  assert.match(t, /1 trouvée sur 2, 1 oubliée, 1 cochée à tort/);
  assert.ok(tous(app.view).some(e => /choix-corrige trouvee/.test(e.className)));
  assert.ok(tous(app.view).some(e => /choix-corrige oubliee/.test(e.className)));
  assert.ok(tous(app.view).some(e => /choix-corrige atort/.test(e.className)));
  assert.doesNotMatch(t, /Bonne réponse, non cochée/);
  clic(bouton(app.view, 'Voir le résultat'));
  const premier = tous(app.view).find(e => /resultat-principal/.test(e.className));
  assert.equal(texte(premier), '0 question réussie sur 1 (0 %)');
  assert.match(texte(app.view), /Il te manque 80 % pour atteindre ton objectif de 80 %\./);
  assert.match(texte(app.view), /À retravailler \(1\)/);
  assert.match(texte(app.view), /1 trouvée sur 2, 1 oubliée, 1 cochée à tort/);
});
