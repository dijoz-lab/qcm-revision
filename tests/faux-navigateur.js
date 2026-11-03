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

// Horloge contrôlable : l'heure ne bouge que par avancer(ms) (les minuteurs tournent) ou sauter(ms)
// (le temps passe sans qu'aucun minuteur ne tourne, comme un téléphone verrouillé).
function creerHorloge(depart) {
  const hz = { maintenant: depart || Date.UTC(2026, 10, 3, 9, 0, 0), minuteurs: [], suivant: 1 };
  hz.setTimeout = function (f, ms) { const id = hz.suivant++; hz.minuteurs.push({ id: id, f: f, quand: hz.maintenant + (ms || 0), rep: 0 }); return id; };
  hz.setInterval = function (f, ms) { const id = hz.suivant++; hz.minuteurs.push({ id: id, f: f, quand: hz.maintenant + ms, rep: ms }); return id; };
  hz.clear = function (id) { hz.minuteurs = hz.minuteurs.filter(m => m.id !== id); };
  hz.avancer = function (ms) {
    const fin = hz.maintenant + ms;
    for (;;) {
      const dus = hz.minuteurs.filter(m => m.quand <= fin).sort((a, b) => a.quand - b.quand);
      if (!dus.length) break;
      const m = dus[0];
      hz.maintenant = m.quand;
      if (m.rep) m.quand += m.rep; else hz.clear(m.id);
      m.f();
    }
    hz.maintenant = fin;
  };
  hz.sauter = function (ms) { hz.maintenant += ms; };
  return hz;
}

// Scripts chargés dans l'ordre de docs/index.html (la liste suit donc index.html toute seule).
function scriptsDeIndex() {
  const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  return (html.match(/<script src="([^"]+)"><\/script>/g) || []).map(s => s.match(/src="([^"]+)"/)[1]);
}

// etat : contenu initial de qcm-pj-v1 ; navigateur : objet navigator du faux navigateur (partage, presse-papiers, stockage).
// options (facultatif) : { horloge: creerHorloge(), memoire: objet déjà rempli (réouverture de l'application),
//   mouvement: true (l'utilisateur N'A PAS demandé moins de mouvement ; par défaut, aucun mouvement) }.
// Sans options, comportement d'origine : setTimeout immédiat, heure réelle.
function demarrer(etat, navigateur, options) {
  options = options || {};
  const view = new El('div'), tabs = new El('nav'), mem = options.memoire || {};
  if (!options.memoire) mem['qcm-pj-v1'] = JSON.stringify(etat);
  const ecouteurs = {};
  function ecouter(t, f) { (ecouteurs[t] = ecouteurs[t] || []).push(f); }
  const hz = options.horloge;
  const FauxDate = hz ? class extends Date { constructor(...a) { if (a.length) super(...a); else super(hz.maintenant); } static now() { return hz.maintenant; } } : Date;
  const ctx = {
    console, Math, Date: FauxDate, JSON, String, Array, Object, Number, parseInt, parseFloat, isFinite, Promise, File,
    setTimeout: hz ? hz.setTimeout : f => f(), clearTimeout: hz ? hz.clear : function () {},
    setInterval: hz ? hz.setInterval : function () { return 0; }, clearInterval: hz ? hz.clear : function () {},
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    navigator: navigateur || {}, window: { scrollY: 0, scrollTo() {}, addEventListener: ecouter, matchMedia: options.mouvement ? function (q) { return { matches: /reduce/.test(q) ? false : true }; } : undefined },
    document: { body: { classList: { toggle() {} } }, visibilityState: 'visible', addEventListener: ecouter,
      createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: d => ({ nodeType: 3, data: d }),
      getElementById: id => (id === 'view' ? view : id === 'tabs' ? tabs : tous(view).find(e => e.attrs.id === id) || null) }
  };
  vm.createContext(ctx);
  scriptsDeIndex().forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(DOCS, f), 'utf8'), ctx, { filename: f }); });
  // Simule un événement de page (retour au premier plan : 'visibilitychange', 'pageshow').
  function declencher(t) { (ecouteurs[t] || []).forEach(f => f({ type: t })); }
  return { view, tabs, mem, horloge: hz, declencher, ctx };
}

module.exports = { demarrer, creerHorloge, texte, tous, clic, bouton, attendre };
