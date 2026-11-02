// Tests du découpage (parser) sur un faux QCM inventé : aucun texte réel de la plateforme.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseQcm, choisirBonneReponse, estValidable } = require('../docs/parser.js');

const FAUX = fs.readFileSync(path.join(__dirname, 'faux-qcm.txt'), 'utf8');

// Analyse neuve à chaque appel : une correction manuelle dans un test ne déborde pas sur les autres.
function analyser() {
  const r = parseQcm(FAUX), parNum = {};
  r.questions.forEach(function (q) { parNum[q.num] = q; });
  return { r: r, Q: parNum };
}
const { r: RES, Q } = analyser();

function unBloc(lignes) { return parseQcm(lignes.join('\n')).questions[0]; }

// ---------- faux QCM : une question par piège ----------

test('texte avant « Question 1 » : ignoré et signalé', function () {
  assert.equal(RES.orphan, 'Médiathèque des Tilleuls (fictive) - QCM inventé pour les tests, aucun texte réel');
});

test('12 questions trouvées, Q7 absente reste absente (jamais inventée)', function () {
  assert.deepEqual(RES.questions.map(function (q) { return q.num; }), [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]);
});

test('Q1 : réponse unique normale, formule d’état retirée, explication recopiée telle quelle', function () {
  assert.equal(Q[1].type, 'single');
  assert.deepEqual(Q[1].correct, ['b']);
  assert.deepEqual(Q[1].errors, []);
  assert.equal(Q[1].text, 'Combien de documents un usager inscrit peut-il emprunter en même temps ?');
  assert.deepEqual(Q[1].choices, [{ k: 'a', text: 'Trois documents' }, { k: 'b', text: 'Cinq documents' }, { k: 'c', text: 'Dix documents' }]);
  assert.equal(Q[1].explanation, 'Le règlement fictif de la médiathèque fixe la limite à cinq documents par carte.\n\nCette limite vaut pour tous les supports.');
});

test('Q2 : choix avec virgule + ligne de bonnes réponses coupée sur deux lignes', function () {
  assert.equal(Q[2].type, 'multi');
  assert.equal(Q[2].choices[0].text, 'Les livres, revues et journaux');
  assert.deepEqual(Q[2].correct, ['a', 'c']);
  assert.deepEqual(Q[2].errors, []);
});

test('Q3 : Vrai/Faux, messages Bonne/Mauvaise réponse identiques → un seul gardé', function () {
  assert.equal(Q[3].type, 'tf');
  assert.deepEqual(Q[3].choices, [{ k: 'V', text: 'Vrai' }, { k: 'F', text: 'Faux' }]);
  assert.deepEqual(Q[3].correct, ['V']);
  assert.equal(Q[3].explanation, 'Une prolongation unique est possible par téléphone.');
  assert.deepEqual(Q[3].warnings, []);
});

test('Q4 : Vrai/Faux, messages différents → les deux gardés + alerte', function () {
  assert.deepEqual(Q[4].correct, ['F']);
  assert.equal(Q[4].explanation, 'Un retard entraîne une suspension d’une semaine.\n\nRelisez l’article 4 du règlement fictif.');
  assert.ok(Q[4].warnings.includes('Les deux messages « Bonne / Mauvaise réponse » diffèrent : les deux sont conservés.'));
});

test('Q5 : apostrophes typographiques reconnues, et gardées dans le texte enregistré', function () {
  assert.deepEqual(Q[5].correct, ['a']);
  assert.equal(Q[5].choices[0].text, 'Présenter sa carte d’usager');
  assert.equal(Q[5].text, 'Que doit faire l’usager à l’accueil ?');
});

test('Q6 : bonne réponse corrompue → erreur, jamais de devinette', function () {
  assert.equal(Q[6].errors.length, 1);
  assert.ok(Q[6].errors[0].startsWith('Impossible de retrouver'));
  assert.deepEqual(Q[6].correct, []);
  assert.equal(estValidable(Q[6]), false);
});

test('Q8 : ligne Feedback absente → erreur bloquante', function () {
  assert.deepEqual(Q[8].errors, ["Ligne « Feedback » introuvable (la correction n'a pas été copiée)."]);
  assert.equal(estValidable(Q[8]), false);
});

test('Q9 : espace avant la virgule des bonnes réponses, textes des choix inchangés', function () {
  assert.deepEqual(Q[9].correct, ['a', 'c']);
  assert.equal(Q[9].choices[0].text, 'Le bibliothécaire de garde');
  assert.equal(Q[9].choices[2].text, 'Le responsable de l’accueil');
  assert.deepEqual(Q[9].errors, []);
});

test('Q10 : variante « Question 10Réponse » → type déduit du pluriel + alerte', function () {
  assert.equal(Q[10].type, 'multi');
  assert.deepEqual(Q[10].correct, ['a', 'c']);
  assert.deepEqual(Q[10].errors, []);
  assert.ok(Q[10].warnings.includes('Le texte ne précise pas « une réponse » ou « au moins une réponse ». Type déduit de la ligne de correction : plusieurs bonnes réponses.'));
});

test('Q11 : question répétée → même identifiant que Q1 + alerte sur la répétition seulement', function () {
  assert.equal(Q[11].id, Q[1].id);
  assert.ok(Q[11].warnings.includes('Cette question apparaît deux fois dans le texte collé.'));
  assert.ok(!Q[1].warnings.includes('Cette question apparaît deux fois dans le texte collé.'));
});

test('Q12 : réponse unique mais deux choix désignés → erreur', function () {
  assert.deepEqual(Q[12].errors, ['Question à réponse unique, mais plusieurs bonnes réponses trouvées.']);
  assert.equal(estValidable(Q[12]), false);
});

test('Q13 : Feedback présent mais explication vide → alerte, reste validable', function () {
  assert.equal(Q[13].explanation, '');
  assert.ok(Q[13].warnings.includes('Aucune explication trouvée.'));
  assert.deepEqual(Q[13].errors, []);
  assert.equal(estValidable(Q[13]), true);
});

test('Règle 1 : énoncés, choix et explications sont recopiés tels quels du texte collé', function () {
  const lignes = FAUX.split('\n');
  RES.questions.forEach(function (q) {
    assert.ok(FAUX.includes(q.text), 'énoncé Q' + q.num);
    q.choices.forEach(function (c) { assert.ok(lignes.includes(c.text), 'choix ' + c.k + ' Q' + q.num); });
    q.explanation.split('\n\n').forEach(function (p) { assert.ok(FAUX.includes(p), 'explication Q' + q.num); });
  });
});

// ---------- cas fabriqués dans le test ----------

test('fins de ligne Windows : même résultat exact', function () {
  const crlf = parseQcm(FAUX.replace(/\n/g, '\r\n'));
  assert.deepEqual(crlf, parseQcm(FAUX));
});

test('texte collé sans lignes « Question N » → 0 question (l’écran affiche « Aucune question trouvée »)', function () {
  const sansEntetes = FAUX.split('\n').filter(function (l) { return !/^Question \d+$/.test(l); }).join('\n');
  const r = parseQcm(sansEntetes);
  assert.equal(r.questions.length, 0);
  assert.ok(r.orphan.length > 0);
});

test('bloc sans « Texte de la question » → erreur claire', function () {
  const q = unBloc(['Question 1', 'Combien de documents ?', 'Veuillez choisir une réponse :', 'a.', 'Trois', 'b.', 'Cinq', 'Feedback', 'Explication.', 'La réponse correcte est : Cinq']);
  assert.deepEqual(q.errors, ['Ligne « Texte de la question » introuvable.']);
});

// ---------- correction manuelle des bonnes réponses ----------

test('correction manuelle, réponse unique : toujours une seule bonne réponse', function () {
  const q = analyser().Q[1];
  choisirBonneReponse(q, 'a'); assert.deepEqual(q.correct, ['a']);
  choisirBonneReponse(q, 'c'); assert.deepEqual(q.correct, ['c']);
  assert.equal(q.manual, true);
  assert.equal(estValidable(q), true);
});

test('correction manuelle, réponses multiples : ajout, retrait, aucune → non validable', function () {
  const q = analyser().Q[2];
  choisirBonneReponse(q, 'b'); assert.deepEqual(q.correct, ['a', 'b', 'c']);
  choisirBonneReponse(q, 'a'); choisirBonneReponse(q, 'b'); choisirBonneReponse(q, 'c');
  assert.deepEqual(q.correct, []);
  assert.equal(estValidable(q), false);
  choisirBonneReponse(q, 'd'); assert.deepEqual(q.correct, ['d']);
  assert.equal(estValidable(q), true);
});

test('correction manuelle, Vrai/Faux : une seule réponse', function () {
  const q = analyser().Q[3];
  choisirBonneReponse(q, 'F'); assert.deepEqual(q.correct, ['F']);
});

test('correction manuelle : énoncé, choix et explication jamais modifiés', function () {
  const q = analyser().Q[1], avant = JSON.stringify([q.text, q.choices, q.explanation]);
  choisirBonneReponse(q, 'a');
  assert.equal(JSON.stringify([q.text, q.choices, q.explanation]), avant);
});

test('Q6 corrigée à la main : erreur retirée, validable', function () {
  const q = analyser().Q[6];
  choisirBonneReponse(q, 'c');
  assert.deepEqual(q.errors, []);
  assert.deepEqual(q.correct, ['c']);
  assert.equal(q.manual, true);
  assert.equal(estValidable(q), true);
});

test('Q12 corrigée à la main : erreur retirée, validable', function () {
  const q = analyser().Q[12];
  choisirBonneReponse(q, 'a');
  assert.deepEqual(q.errors, []);
  assert.deepEqual(q.correct, ['a']);
  assert.equal(q.manual, true);
  assert.equal(estValidable(q), true);
});

test('Q8 « corrigée » à la main : reste non validable (Feedback absent, aucun choix lu)', function () {
  const q = analyser().Q[8];
  choisirBonneReponse(q, 'a');
  assert.deepEqual(q.correct, []);
  assert.deepEqual(q.errors, ["Ligne « Feedback » introuvable (la correction n'a pas été copiée)."]);
  assert.equal(estValidable(q), false);
});

test('déjà dans la banque (q.dup rempli par app.js) → non validable', function () {
  const q = analyser().Q[1];
  q.dup = true;
  assert.equal(estValidable(q), false);
});

// ---------- les 3 erreurs non déclenchées par le faux QCM ----------

test('bonne réponse ambiguë → erreur, puis corrigée à la main → validable', function () {
  const q = unBloc(['Question 1', 'Texte de la question', 'Quand la salle d’étude ouvre-t-elle ?', 'Veuillez choisir au moins une réponse :', 'a.', 'Le matin', 'b.', 'Le matin, tôt', 'c.', 'tôt', 'Feedback', 'Explication fictive.', 'Les réponses correctes sont : Le matin, tôt']);
  assert.deepEqual(q.errors, ['Bonne réponse ambiguë : plusieurs lectures possibles. À vérifier à la main.']);
  choisirBonneReponse(q, 'b');
  assert.deepEqual(q.errors, []);
  assert.equal(estValidable(q), true);
});

test('Vrai/Faux non reconnu → erreur, puis corrigé à la main → validable', function () {
  const q = unBloc(['Question 1', 'Texte de la question', 'La médiathèque fictive prête des parapluies.', 'Veuillez choisir une réponse :', 'Vrai', 'Faux', 'Feedback', 'Explication fictive.', 'La réponse correcte est « Peut-être ».']);
  assert.equal(q.errors.length, 1);
  assert.ok(q.errors[0].startsWith('Bonne réponse Vrai/Faux non reconnue'));
  choisirBonneReponse(q, 'V');
  assert.deepEqual(q.errors, []);
  assert.equal(estValidable(q), true);
});

test('bonne réponse vide → erreur, puis corrigée à la main → validable', function () {
  const q = unBloc(['Question 1', 'Texte de la question', 'Quelle est la couleur des cartes d’usager ?', 'Veuillez choisir une réponse :', 'a.', 'Bleue', 'b.', 'Verte', 'Feedback', 'Explication fictive.', 'La réponse correcte est :']);
  assert.deepEqual(q.errors, ['Bonne réponse vide.']);
  choisirBonneReponse(q, 'a');
  assert.deepEqual(q.errors, []);
  assert.equal(estValidable(q), true);
});

// ---------- garde-fous sur le code lui-même ----------

test('les 5 débuts de message reconnus par choisirBonneReponse existent dans docs/parser.js', function () {
  const src = fs.readFileSync(path.join(__dirname, '..', 'docs', 'parser.js'), 'utf8');
  ['Impossible de retrouver', 'Bonne réponse ambiguë', 'Question à réponse unique', 'Bonne réponse Vrai/Faux', 'Bonne réponse vide'].forEach(function (debut) {
    assert.ok(src.includes('errors.push("' + debut), 'message absent : ' + debut);
  });
});

test('docs/parser.js : les 161 premières lignes (découpage) sont identiques au parser.js de la racine', { skip: fs.existsSync(path.join(__dirname, '..', 'parser.js')) ? false : 'parser.js racine absent' }, function () {
  const docs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'parser.js'), 'utf8').split('\n').slice(0, 161);
  const racine = fs.readFileSync(path.join(__dirname, '..', 'parser.js'), 'utf8').split('\n').slice(0, 161);
  assert.deepEqual(docs, racine);
});
