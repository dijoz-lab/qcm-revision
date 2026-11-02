// Conditions d'examen sur l'écran de question : aucune indication du nombre de bonnes réponses avant validation,
// cases à cocher libres pour toutes les questions, notation inchangée (juste seulement si toutes les bonnes et aucune autre).
// Les scripts de docs/ sont exécutés dans un faux navigateur minimal (module vm de Node), sans rien modifier.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOCS = path.join(__dirname, '..', 'docs');
const INTERDITS = /réponses? possibles?|une seule réponse|au moins une|vrai ou faux|bonnes? réponses? attendues?/i;

// ---------- faux navigateur minimal ----------
function El(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.parentNode = null; this.className = ''; this.hidden = false; this.textContent = ''; }
El.prototype.nodeType = 1;
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === 'hidden') this.hidden = true; };
El.prototype.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
El.prototype.append = function () { for (const c of arguments) { c.parentNode = this; this.children.push(c); } };
El.prototype.replaceChildren = function () { this.children = []; this.append.apply(this, arguments); };
El.prototype.remove = function () { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); };
El.prototype.scrollIntoView = function () {};
Object.defineProperty(El.prototype, 'firstChild', { get() { return this.children[0]; } });
function texte(n) { return n.nodeType === 3 ? n.data : (n.textContent || '') + (n.children || []).map(texte).join(''); }
function tous(n, out) { out = out || []; if (n.nodeType === 1) { out.push(n); n.children.forEach(c => tous(c, out)); } return out; }
function clic(el) { (el.listeners.click || []).forEach(f => f({ preventDefault() {}, target: el })); }

function demarrer(questions) {
  const view = new El('div'), tabs = new El('nav'), mem = {};
  mem['qcm-pj-v1'] = JSON.stringify({ v: 1, questions: questions, sessions: [], current: null, lastBackup: null });
  const ctx = {
    console, Math, Date, JSON, String, Array, Object, Number, parseInt, Promise, setTimeout: f => f(), clearTimeout() {},
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    navigator: {}, window: { scrollY: 0, scrollTo() {} },
    document: { body: { classList: { toggle() {} } }, createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: d => ({ nodeType: 3, data: d }),
      getElementById: id => (id === 'view' ? view : id === 'tabs' ? tabs : null) }
  };
  vm.createContext(ctx);
  ['parser.js', 'seance.js', 'stockage.js', 'reglages.js', 'app.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(DOCS, f), 'utf8'), ctx, { filename: f }); });
  return { view, mem };
}
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
