// Conditions d'examen sur l'écran de question : aucune indication du nombre de bonnes réponses avant validation,
// cases à cocher libres pour toutes les questions, notation inchangée (juste seulement si toutes les bonnes et aucune autre).
// Les scripts de docs/ sont exécutés dans un faux navigateur minimal (tests/faux-navigateur.js), sans rien modifier.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { demarrer: demarrerNavigateur, texte, tous, clic } = require('./faux-navigateur.js');

const INTERDITS = /réponses? possibles?|une seule réponse|au moins une|vrai ou faux|bonnes? réponses? attendues?/i;

function demarrer(questions) { return demarrerNavigateur({ v: 1, questions: questions, sessions: [], current: null, lastBackup: null }); }
function q(id, type, correct, choices) { return { id: id, num: 1, qcm: 'Fictif', theme: 'gav', type: type, text: 'Énoncé fictif ' + id, choices: choices, correct: correct, explanation: 'Explication fictive.' }; }
const AB = [{ k: 'a', text: 'Choix un' }, { k: 'b', text: 'Choix deux' }, { k: 'c', text: 'Choix trois' }];
const VF = [{ k: 'V', text: 'Vrai' }, { k: 'F', text: 'Faux' }];

test('écran de question : aucune indication du nombre de bonnes réponses, cases à cocher libres, notation inchangée', function () {
  const QS = [q('unique', 'single', ['a'], AB), q('multiple', 'multi', ['a', 'b'], AB), q('vraifaux', 'tf', ['V'], VF)];
  const { view, mem } = demarrer(QS);
  clic(tous(view).find(e => e.tagName === 'button' && texte(e) === 'Commencer la séance'));
  const vus = [];
  for (let n = 0; n < QS.length; n++) {
    // Avant validation
    const avant = texte(view);
    assert.doesNotMatch(avant, INTERDITS, 'indication trouvée avant validation');
    const groupe = tous(view).find(e => e.tagName === 'ul' && e.attrs['aria-label'] === 'Réponses');
    assert.equal(groupe.attrs.role, 'group');
    const choix = tous(groupe).filter(e => e.tagName === 'button');
    assert.ok(choix.every(b => b.attrs.role === 'checkbox'), 'toutes les réponses sont des cases à cocher');
    assert.ok(!tous(view).some(e => e.attrs.role === 'radio' || e.attrs.role === 'radiogroup'));
    const id = QS.find(x => avant.includes(x.text)).id;
    vus.push(id);
    // On coche les deux premières réponses, quelle que soit la question : les deux restent cochées.
    clic(choix[0]);
    clic(tous(view).filter(e => e.tagName === 'button' && e.className === 'choice')[1]);
    const coches = tous(view).filter(e => e.className === 'choice' && e.attrs['aria-checked'] === 'true');
    assert.equal(coches.length, 2, id + ' : deux cases cochées');
    clic(tous(view).find(e => e.tagName === 'button' && texte(e) === 'Valider ma réponse'));
    // Après validation : la correction peut donner le nombre attendu ; la note suit la règle « toutes et aucune autre ».
    const apres = texte(view), bonne = QS.find(x => x.id === id).correct.length;
    assert.ok(apres.includes(bonne > 1 ? bonne + ' bonnes réponses attendues.' : '1 bonne réponse attendue.'), id + ' : nombre attendu affiché');
    const res = JSON.parse(mem['qcm-pj-v1']).current.results[n];
    assert.deepEqual(res.picked.slice().sort(), id === 'vraifaux' ? ['F', 'V'] : ['a', 'b']);
    assert.equal(res.ok, id === 'multiple', id + ' : notation');
    clic(tous(view).find(e => e.tagName === 'button' && /Question suivante|Voir le résultat/.test(texte(e))));
  }
  assert.deepEqual(vus.slice().sort(), ['multiple', 'unique', 'vraifaux']);
});
