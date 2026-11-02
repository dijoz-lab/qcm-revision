// Tests du tirage des séances (docs/seance.js) sur des banques fictives fabriquées par le test.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSION_SIZE, COOLDOWN, sameSet, statsMap, buildSession } = require('../docs/seance.js');

// Banque fictive : nGav questions « gav » (g0, g1…) puis nProc questions « proc » (p0, p1…).
function banque(nGav, nProc) {
  const qs = [];
  for (let i = 0; i < nGav; i++) qs.push({ id: 'g' + i, theme: 'gav' });
  for (let i = 0; i < nProc; i++) qs.push({ id: 'p' + i, theme: 'proc' });
  return qs;
}
// Séance terminée où toutes les questions ids ont reçu la même note (ok vrai ou faux).
function seance(ids, ok) { return { results: ids.map(function (id) { return { qid: id, picked: ['a'], ok: ok }; }) }; }
function ids(prefixe, de, a) { const out = []; for (let i = de; i < a; i++) out.push(prefixe + i); return out; }
function compte(liste, prefixe) { return liste.filter(function (id) { return id[0] === prefixe; }).length; }

test('réglages : 15 questions par séance, repos de 3 séances', function () {
  assert.equal(SESSION_SIZE, 15);
  assert.equal(COOLDOWN, 3);
});

test('sameSet : juste seulement si toutes les bonnes réponses sont cochées et aucune autre', function () {
  assert.equal(sameSet(['a', 'c'], ['c', 'a']), true);
  assert.equal(sameSet(['a'], ['a', 'c']), false);
  assert.equal(sameSet(['a', 'c', 'd'], ['a', 'c']), false);
  assert.equal(sameSet(['a', 'b'], ['a', 'c']), false);
});

test('statsMap : vues, dernière séance, dernière réponse, nombre d’erreurs, calculés depuis l’historique', function () {
  const m = statsMap([seance(['g0', 'g1'], true), { results: [{ qid: 'g0', ok: false }] }, { ts: 1 }]);
  assert.deepEqual(m.g0, { seen: 2, lastSeq: 1, lastOk: false, misses: 1 });
  assert.deepEqual(m.g1, { seen: 1, lastSeq: 0, lastOk: true, misses: 0 });
  assert.equal(m.g2, undefined);
});

test('banque vide → aucune séance', function () {
  assert.deepEqual(buildSession([], []), []);
});

test('banque de 114 : 15 questions distinctes, garde à vue et procédure dans la proportion de la banque (5 + 10)', function () {
  const qs = banque(40, 74), existe = new Set(qs.map(function (q) { return q.id; }));
  for (let essai = 0; essai < 20; essai++) {
    const s = buildSession(qs, []);
    assert.equal(s.length, 15);
    assert.equal(new Set(s).size, 15);
    assert.ok(s.every(function (id) { return existe.has(id); }));
    assert.equal(compte(s, 'g'), 5);
    assert.equal(compte(s, 'p'), 10);
  }
});

test('banque de moins de 15 questions → la séance les prend toutes', function () {
  const s = buildSession(banque(4, 6), []);
  assert.equal(s.length, 10);
  assert.equal(new Set(s).size, 10);
});

test('repos : une question ne revient pas avant 3 séances (banque de 60 : la 5e séance reprend exactement la 1re)', function () {
  const qs = banque(20, 40), hist = [], tirages = [];
  for (let i = 0; i < 5; i++) {
    const s = buildSession(qs, hist);
    tirages.push(s);
    hist.push(seance(s, true));
  }
  const vus = new Set();
  tirages.slice(0, 4).forEach(function (s) { s.forEach(function (id) { assert.ok(!vus.has(id), id + ' revient trop tôt'); vus.add(id); }); });
  assert.deepEqual(tirages[4].slice().sort(), tirages[0].slice().sort());
});

test('repos réduit pour une petite banque : les séances restent complètes (banque de 20)', function () {
  const qs = banque(8, 12), hist = [];
  for (let i = 0; i < 4; i++) {
    const s = buildSession(qs, hist);
    assert.equal(s.length, 15);
    assert.equal(new Set(s).size, 15);
    hist.push(seance(s, true));
  }
});

test('environ un tiers de questions à retravailler (dernière réponse fausse) : 2 sur 5 + 3 sur 10', function () {
  const qs = banque(40, 74);
  // Séance 0 : 10 gav et 20 proc ratées. Séances 1 à 3 : d'autres questions réussies (le repos des ratées est écoulé).
  const hist = [seance(ids('g', 0, 10).concat(ids('p', 0, 20)), false),
    seance(ids('p', 20, 35), true), seance(ids('p', 35, 50), true), seance(ids('p', 50, 65), true)];
  const ratees = new Set(ids('g', 0, 10).concat(ids('p', 0, 20)));
  for (let essai = 0; essai < 20; essai++) {
    const s = buildSession(qs, hist);
    assert.equal(s.length, 15);
    assert.equal(s.filter(function (id) { return ratees.has(id); }).length, 5);
    assert.equal(compte(s.filter(function (id) { return ratees.has(id); }), 'g'), 2);
  }
});

test('à retravailler : la question la plus souvent ratée passe en premier', function () {
  const qs = banque(40, 74);
  const hist = [seance(['g0'], false), seance(ids('g', 0, 10), false),
    seance(ids('p', 0, 15), true), seance(ids('p', 15, 30), true), seance(ids('p', 30, 45), true)];
  for (let essai = 0; essai < 20; essai++) assert.ok(buildSession(qs, hist).includes('g0'));
});

test('les questions jamais vues passent avant les questions déjà vues', function () {
  const qs = banque(40, 74);
  const dejaVues = ids('g', 0, 20).concat(ids('p', 0, 30));
  // Séances 1 à 3 sans résultat : elles ne font que laisser passer le repos des questions déjà vues.
  const hist = [seance(dejaVues, true), { results: [] }, { results: [] }, { results: [] }];
  for (let essai = 0; essai < 20; essai++) {
    const s = buildSession(qs, hist);
    assert.equal(s.length, 15);
    assert.ok(s.every(function (id) { return !dejaVues.includes(id); }));
  }
});
