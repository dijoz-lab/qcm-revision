// Faux navigateur minimal pour les tests d'écran : exécute les scripts de docs/ (module vm de Node) sans rien modifier.
// Utilisé par tests/ecran-question.test.js et tests/sauvegarde.test.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOCS = path.join(__dirname, '..', 'docs');

function El(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.parentNode = null; this.className = ''; this.hidden = false; this.textContent = ''; }
El.prototype.nodeType = 1;
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === 'hidden') this.hidden = true; };
El.prototype.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
El.prototype.append = function () { for (const c of arguments) { c.parentNode = this; this.children.push(c); } };
El.prototype.replaceChildren = function () { this.children = []; this.append.apply(this, arguments); };
El.prototype.remove = function () { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); };
El.prototype.scrollIntoView = function () {};
El.prototype.focus = function () {};
El.prototype.select = function () {};
Object.defineProperty(El.prototype, 'firstChild', { get() { return this.children[0]; } });

function texte(n) { return n.nodeType === 3 ? n.data : (n.textContent || '') + (n.children || []).map(texte).join(''); }
function tous(n, out) { out = out || []; if (n.nodeType === 1) { out.push(n); n.children.forEach(c => tous(c, out)); } return out; }
function clic(el) { (el.listeners.click || []).forEach(f => f({ preventDefault() {}, target: el })); }
function bouton(racine, libelle) { return tous(racine).find(e => e.tagName === 'button' && (texte(e).trim() === libelle || e.attrs['aria-label'] === libelle)); }
// Laisse s'exécuter les promesses en attente (partage, presse-papiers, stockage protégé).
function attendre() { return new Promise(r => setImmediate(r)); }

// etat : contenu initial de qcm-pj-v1 ; navigateur : objet navigator du faux navigateur (partage, presse-papiers, stockage).
function demarrer(etat, navigateur) {
  const view = new El('div'), tabs = new El('nav'), mem = {};
  mem['qcm-pj-v1'] = JSON.stringify(etat);
  const ctx = {
    console, Math, Date, JSON, String, Array, Object, Number, parseInt, Promise, File, setTimeout: f => f(), clearTimeout() {},
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    navigator: navigateur || {}, window: { scrollY: 0, scrollTo() {} },
    document: { body: { classList: { toggle() {} } }, createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: d => ({ nodeType: 3, data: d }),
      getElementById: id => (id === 'view' ? view : id === 'tabs' ? tabs : tous(view).find(e => e.attrs.id === id) || null) }
  };
  vm.createContext(ctx);
  ['parser.js', 'seance.js', 'stockage.js', 'reglages.js', 'app.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(DOCS, f), 'utf8'), ctx, { filename: f }); });
  return { view, tabs, mem };
}

module.exports = { demarrer, texte, tous, clic, bouton, attendre };
