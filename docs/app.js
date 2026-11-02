/* ===== Progression : séances terminées, de la plus récente à la plus ancienne (fonction pure, lecture seule) =====
   Calculée uniquement depuis l'historique qcm-pj-v1 ; testée dans tests/progression.test.js. */
function lignesProgression(sessions, questions, themes) {
  var theme = {};
  questions.forEach(function (q) { theme[q.id] = q.theme; });
  function bilan(rs) { var j = rs.filter(function (r) { return r.ok; }).length; return { total: rs.length, justes: j, pct: rs.length ? Math.round(100 * j / rs.length) : null }; }
  return sessions.map(function (s, i) { return { s: s, i: i }; })
    .filter(function (x) { return x.s.results && x.s.results.length; })
    .sort(function (a, b) { return (b.s.ts - a.s.ts) || (b.i - a.i); })
    .map(function (x) {
      var s = x.s, g = bilan(s.results);
      return { id: s.id, ts: s.ts, partial: !!s.partial, total: g.total, justes: g.justes, pct: g.pct,
        themes: themes.map(function (t) { var b = bilan(s.results.filter(function (r) { return theme[r.qid] === t.k; })); return { k: t.k, name: t.name, total: b.total, justes: b.justes, pct: b.pct }; }) };
    });
}
if (typeof module !== 'undefined') module.exports = { lignesProgression: lignesProgression };

// L'interface ne démarre que dans un navigateur (les tests Node ne chargent que la fonction ci-dessus).
if (typeof document !== 'undefined') (function () {
  var THEMES = [{ k: 'gav', name: 'Garde à vue' }, { k: 'proc', name: 'Procédure' }];
  var DL = null, storageOK = true;

  function themeName(k) { var t = THEMES.filter(function (x) { return x.k === k; })[0]; return t ? t.name : k; }
  var S = loadState();
  if (!storageWorks()) storageOK = false;
  function save() { if (!saveState(S)) storageOK = false; }

  // ---------- petits outils DOM ----------
  function h(tag, props) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in (props || {})) {
      var v = props[k];
      if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        e.append(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return e;
  }
  function confirmBtn(label, confirmLabel, cls, fn) {
    var b = h('button', { class: 'btn small ' + cls, type: 'button' }, label), armed = false, t;
    b.addEventListener('click', function () {
      if (!armed) { armed = true; b.textContent = confirmLabel; t = setTimeout(function () { armed = false; b.textContent = label; }, 4000); }
      else { clearTimeout(t); fn(); }
    });
    return b;
  }
  function byId() { var m = {}; S.questions.forEach(function (q) { m[q.id] = q; }); return m; }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

  // ---------- outils d'affichage du design A2 (pourcentages seulement) ----------
  var NB_SEANCES_RECENTES = 3;
  var AVATAR_ENTRAINEMENT = 'avatars/avatar-entrainement.png';
  function sv(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function pctSeance(s) { return Math.round(100 * s.results.filter(function (r) { return r.ok; }).length / s.results.length); }
  function seancesRecentes() { return S.sessions.filter(function (s) { return s.results && s.results.length; }).slice(-NB_SEANCES_RECENTES); }
  function moyenne(liste) { return liste.length ? Math.round(liste.reduce(function (a, s) { return a + pctSeance(s); }, 0) / liste.length) : null; }
  function joursDepuis(ts) { return Math.floor((Date.now() - ts) / 864e5); }
  function dateCourte(ts) { return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  // Mouvement : jamais si l'utilisateur a demandé moins de mouvement, et seulement à l'ouverture d'un écran (pas à chaque mise à jour).
  var MOINS_DE_MOUVEMENT = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dernierEcran = null, animerEcran = false;
  // Le nombre compte de 0 à sa valeur en 700 ms environ ; sans animation, il s'affiche directement.
  function compter(el, valeur) {
    if (!animerEcran || typeof requestAnimationFrame !== 'function') { el.textContent = valeur + ' %'; return; }
    var t0 = null;
    el.textContent = '0 %';
    requestAnimationFrame(function pas(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(valeur * (1 - Math.pow(1 - p, 3))) + ' %';
      if (p < 1) requestAnimationFrame(pas);
    });
  }
  // Grand pourcentage (décoratif : sa valeur est aussi écrite en texte à côté pour les lecteurs d'écran).
  // Sa lueur est un halo séparé posé derrière (pas de filtre sur le texte en dégradé : rectangle clair sur Safari iOS).
  // Sans valeur (aucune séance), rien n'est affiché : la phrase sous le cadran suffit.
  function chiffreGeant(valeur, classe) {
    if (valeur === null) return null;
    var el = h('div', { class: 'chiffre-geant' + (classe ? ' ' + classe : '') + (animerEcran ? ' anime' : ''), 'aria-hidden': 'true' });
    compter(el, valeur);
    return h('div', { class: 'chiffre-zone' }, h('span', { class: 'chiffre-halo', 'aria-hidden': 'true' }), el);
  }
  function pluriel(n, singulier, formePlurielle) { return n + ' ' + (n > 1 ? formePlurielle : singulier); }
  // Avatar : invisible (hidden) tant que son fichier n'a pas pu être chargé ; retiré s'il n'existe pas.
  function avatar(src, alt) {
    return h('img', { class: 'medaillon', src: src, alt: alt, hidden: true, onload: function (e) { e.target.hidden = false; }, onerror: function (e) { e.target.remove(); } });
  }
  // Cadran : 60 graduations, arc proportionnel à pct (aucun arc si null ou 0), repère or à l'objectif, avatar au centre.
  // Piste de rayon 128 et d'épaisseur 12 : son bord intérieur reste à 122, donc le disque de l'avatar ne change pas.
  function cadran(pct, objectif, classeArc, classeCadran) {
    var c = 150, r = 128, tour = 2 * Math.PI * r, i, a;
    var svg = sv('svg', { viewBox: '0 0 300 300', 'aria-hidden': 'true', focusable: 'false' });
    var grad = sv('linearGradient', { id: 'degrade-arc', x1: '0', y1: '0', x2: '1', y2: '1' });
    grad.append(sv('stop', { offset: '0', 'stop-color': '#B7CBFF' }), sv('stop', { offset: '1', 'stop-color': '#5E86F0' }));
    svg.append(sv('defs', {}));
    svg.firstChild.append(grad);
    for (i = 0; i < 60; i++) {
      a = (i * 6 - 90) * Math.PI / 180;
      var forte = i % 5 === 0, r2 = forte ? 148 : 144;
      svg.append(sv('line', { class: 'graduation' + (forte ? ' forte' : ''), x1: c + 138 * Math.cos(a), y1: c + 138 * Math.sin(a), x2: c + r2 * Math.cos(a), y2: c + r2 * Math.sin(a) }));
    }
    svg.append(sv('circle', { class: 'piste', cx: c, cy: c, r: r }));
    if (pct) svg.append(sv('circle', { class: 'arc' + (classeArc ? ' ' + classeArc : ''), stroke: classeArc ? null : 'url(#degrade-arc)', cx: c, cy: c, r: r,
      'stroke-dasharray': (tour * pct / 100) + ' ' + tour, transform: 'rotate(-90 ' + c + ' ' + c + ')' }));
    a = (objectif * 3.6 - 90) * Math.PI / 180;
    svg.append(sv('line', { class: 'repere-or', x1: c + 116 * Math.cos(a), y1: c + 116 * Math.sin(a), x2: c + 146 * Math.cos(a), y2: c + 146 * Math.sin(a) }));
    return h('div', { class: 'cadran' + (classeCadran ? ' ' + classeCadran : '') + (animerEcran ? ' anime' : '') }, svg, avatar(AVATAR_ENTRAINEMENT, 'Avatar d’entraînement'));
  }
  // Pastille dorée « Objectif 80 % » : un vrai menu natif (select), stylé en pastille.
  function selectObjectif(objectif) {
    var vals = [], v;
    for (v = 50; v <= 100; v += 5) vals.push(v);
    if (vals.indexOf(objectif) === -1) { vals.push(objectif); vals.sort(function (x, y) { return x - y; }); }
    return h('label', { class: 'pastille-objectif' }, h('span', null, 'Objectif'),
      h('select', { id: 'objectif', 'aria-label': 'Mon objectif personnel (ce n’est pas un seuil officiel)', onchange: function (e) { ecrireObjectif(parseInt(e.target.value, 10)); render(); } },
        vals.map(function (x) { return h('option', { value: x, selected: x === objectif }, x + ' %'); })));
  }

  // ---------- état de l'interface ----------
  var UI = { tab: 'home', mode: null, pick: [], imp: { theme: 'gav', label: '', text: '', parsed: null, ok: {} }, bankFilter: 'all', backupMsg: null, summary: null };

  function setTab(t) { UI.tab = t; UI.mode = null; render(); window.scrollTo(0, 0); }

  // ---------- rendu commun d'une question corrigée ----------
  function explBlock(q) {
    if (!q.explanation) return null;
    return h('div', { class: 'expl' }, h('span', { class: 'label' }, 'Explication de la plateforme'),
      q.explanation.split(/\n\n/).map(function (p) { return h('p', null, p); }));
  }
  function choiceList(q, picked, locked, onToggle) {
    return h('ul', { class: 'choices' + (q.type === 'multi' ? ' multi' : '') }, q.choices.map(function (c) {
      var isOk = q.correct.indexOf(c.k) !== -1, isPicked = picked && picked.indexOf(c.k) !== -1, cls = 'choice', tag = null;
      if (locked) {
        if (isOk && isPicked) { cls += ' ok'; tag = '✓ Bonne réponse, cochée'; }
        else if (isOk) { cls += ' ok'; tag = '✓ Bonne réponse, non cochée'; }
        else if (isPicked) { cls += ' ko'; tag = '✗ Cochée à tort'; }
      }
      return h('li', null, h('button', { class: cls, type: 'button', disabled: !onToggle, onclick: onToggle ? function () { onToggle(c.k); } : null },
        h('span', { class: 'k' }, q.type === 'tf' ? (c.k === 'V' ? 'V' : 'F') : c.k),
        h('span', { class: 't' }, c.text, tag ? h('span', { class: 'tag' }, tag) : null)));
    }));
  }
  function questionCard(q, picked, showHead) {
    return h('div', { class: 'card' },
      showHead ? h('div', { class: 'label' }, themeName(q.theme) + (q.qcm ? ' · ' + q.qcm : '') + ' · Q' + q.num) : null,
      h('p', { class: 'read', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, q.text),
      choiceList(q, picked, true), explBlock(q));
  }

  // ---------- Accueil ----------
  function viewHome() {
    var out = [], st = statsMap(S.sessions), total = S.questions.length;
    var objectif = lireReglages().objectif, recentes = seancesRecentes(), moy = moyenne(recentes);
    if (!storageOK) out.push(h('div', { class: 'notice bad' }, "Ce navigateur ne garde pas les données. Ta progression sera perdue à la fermeture. Ouvre la page dans Chrome, hors navigation privée."));
    out.push(h('div', { class: 'entete' },
      h('div', null, h('span', { class: 'label' }, 'Examen final OPJ · police judiciaire'), h('h1', { class: 'titre-pret' }, 'Prêt.')),
      selectObjectif(objectif)));
    var ecart = moy === null ? null : ecartObjectif(moy, objectif);
    out.push(h('div', { class: 'zone-cadran' },
      cadran(moy, objectif),
      chiffreGeant(moy),
      h('p', { class: 'phrase-moyenne' + (moy === null ? ' sans-chiffre' : '') }, moy === null ? 'Pas encore de séance terminée.' : [h('span', { class: 'sr-only' }, 'Moyenne récente : ' + moy + ' %. '),
        'Moyenne récente · ' + (ecart ? 'plus que ' + ecart + (ecart > 1 ? ' points' : ' point') + ' avant ton objectif' : 'objectif atteint')])));
    if (S.current) {
      var cur = S.current;
      out.push(h('div', { class: 'card' }, h('h2', null, 'Séance en cours'),
        h('p', { class: 'muted' }, cur.results.length + ' question(s) répondue(s) sur ' + cur.ids.length + '.'),
        h('button', { class: 'btn primary big', type: 'button', onclick: function () { UI.mode = 'session'; UI.pick = []; render(); window.scrollTo(0, 0); } }, 'Reprendre'),
        h('div', { class: 'row' }, confirmBtn('Abandonner', 'Confirmer l’abandon', 'danger', function () { finishSession(true); }))));
    } else {
      var size = Math.min(SESSION_SIZE, total);
      out.push(h('div', { class: 'bloc-depart' },
        total ? h('button', { class: 'btn primary big', type: 'button', onclick: startSession }, 'Commencer la séance')
              : h('button', { class: 'btn primary big', type: 'button', onclick: function () { setTab('import'); } }, 'Importer un QCM'),
        h('p', { class: 'sous-bouton' }, total ? size + ' questions · garde à vue et procédure' : "La banque est vide. Importe d'abord un QCM pour pouvoir t'entraîner.")));
    }
    var cartes = [];
    if (recentes.length) {
      // Toute la carte est un bouton qui mène à Progression (contenu en <span> : seul contenu autorisé dans un bouton).
      var interrompue = recentes.some(function (s) { return s.partial; });
      cartes.push(h('button', { class: 'card carte-lien', type: 'button', onclick: function () { setTab('prog'); },
        'aria-label': 'Dernières séances : ' + recentes.map(function (s) { return pctSeance(s) + ' %' + (s.partial ? ' (interrompue)' : ''); }).join(', ') + '. Voir la progression' },
        h('span', { class: 'label' }, 'Dernières séances'),
        h('span', { class: 'colonnes' }, recentes.map(function (s, i) {
          var p = pctSeance(s);
          return h('span', { class: 'colonne' + (i === recentes.length - 1 ? ' recente' : '') + (p < 50 ? ' faible' : '') },
            h('b', null, p + ' %'),
            h('span', { class: 'tube' }, h('i', { style: 'height:' + Math.max(p, 3) + '%' })),
            h('span', { class: 'label' }, dateCourte(s.ts) + (s.partial ? ' *' : '')));
        })),
        interrompue ? h('span', { class: 'petit muted' }, '* séance interrompue') : null,
        h('span', { class: 'voir-plus' }, 'Voir la progression ›')));
    }
    if (total) {
      var seen = S.questions.filter(function (q) { return st[q.id]; }).length;
      cartes.push(h('div', { class: 'card' }, h('span', { class: 'label' }, 'Banque'),
        h('div', { class: 'total-banque' }, total),
        h('p', { class: 'petit muted' }, 'questions · ' + seen + ' vues'),
        h('div', { class: 'bar fine', role: 'img', 'aria-label': seen + ' questions vues sur ' + total }, h('i', { style: 'width:' + Math.round(100 * seen / total) + '%' })),
        h('p', { class: 'petit muted' }, THEMES.map(function (t) { return t.name + ' ' + S.questions.filter(function (q) { return q.theme === t.k; }).length; }).join(' · '))));
    }
    if (cartes.length) out.push(h('div', { class: 'duo' }, cartes));
    var jours = S.lastBackup ? joursDepuis(S.lastBackup) : null;
    var txtSauv = jours === null ? 'Aucune sauvegarde faite pour l’instant. ' : jours < 1 ? 'Dernière sauvegarde aujourd’hui. ' : 'Dernière sauvegarde il y a ' + jours + (jours > 1 ? ' jours. ' : ' jour. ');
    var alerte = recentes.length && (jours === null || jours > 7);
    out.push(h('div', { class: alerte ? 'notice' : 'card' }, h('p', null, txtSauv + (alerte && jours !== null ? 'Plus de 7 jours : pense à sauvegarder. ' : ''),
      h('a', { href: '#', style: 'color:inherit;font-weight:600', onclick: function (e) { e.preventDefault(); setTab('backup'); } }, 'Sauvegarder maintenant'))));
    return out;
  }

  // ---------- Importer ----------
  function viewImport() {
    var imp = UI.imp, out = [];
    out.push(h('div', null, h('span', { class: 'label' }, 'Étape 1'), h('h1', null, 'Importer un QCM')));
    out.push(h('div', { class: 'card' },
      h('p', null, "Copie le QCM corrigé depuis la plateforme, colle-le ici, puis vérifie chaque question avant de la valider. Le texte est recopié tel quel, aucune IA ne le touche."),
      h('div', { class: 'label' }, 'Thème de ce QCM'),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Thème' }, THEMES.map(function (t) {
        return h('label', null, h('input', { type: 'radio', name: 'theme', value: t.k, checked: imp.theme === t.k, onchange: function () { imp.theme = t.k; } }), h('span', null, t.name));
      })),
      h('label', { class: 'label', for: 'qcmlabel' }, 'Nom du QCM (facultatif)'),
      h('input', { id: 'qcmlabel', type: 'text', placeholder: 'ex. Garde à vue N°1', value: imp.label, oninput: function (e) { imp.label = e.target.value; } }),
      h('label', { class: 'label', for: 'paste' }, 'Texte copié de la plateforme'),
      h('textarea', { id: 'paste', placeholder: 'Colle ici tout le QCM, de « Question 1 » jusqu’à la dernière correction.', oninput: function (e) { imp.text = e.target.value; } }, imp.text),
      h('button', { class: 'btn primary', type: 'button', onclick: analyse }, 'Analyser le texte')));
    out.push(h('div', { id: 'review' }));
    return out;
  }
  function analyse() {
    var imp = UI.imp;
    imp.text = document.getElementById('paste').value;
    var res = parseQcm(imp.text);
    var existing = {}; S.questions.forEach(function (q) { existing[q.id] = 1; });
    res.questions.forEach(function (q) { q.dup = !!existing[q.id]; });
    imp.parsed = res; imp.ok = {};
    renderReview();
    var r = document.getElementById('review'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function toggleCorrect(q, k) {
    choisirBonneReponse(q, k); UI.imp.ok[q.id] = false;
    var y = window.scrollY; renderReview(); window.scrollTo(0, y);
  }
  function renderReview() {
    var box = document.getElementById('review'); if (!box) return;
    box.replaceChildren();
    var imp = UI.imp, res = imp.parsed; if (!res) return;
    var qs = res.questions;
    if (!qs.length) { box.append(h('div', { class: 'notice bad' }, 'Aucune question trouvée. Chaque question doit commencer par une ligne « Question 1 », « Question 2 »… Vérifie que tu as copié la page entière.')); return; }
    var nErr = qs.filter(function (q) { return q.errors.length; }).length;
    var nDup = qs.filter(function (q) { return q.dup; }).length;
    var nWarn = qs.filter(function (q) { return !q.errors.length && q.warnings.length; }).length;
    var nValid = qs.filter(function (q) { return imp.ok[q.id] && estValidable(q); }).length;
    var canAll = qs.filter(function (q) { return estValidable(q); });
    box.append(h('div', { class: 'card' }, h('h2', null, qs.length + ' questions trouvées'),
      h('p', null, nErr + ' avec erreur · ' + nWarn + ' avec alerte · ' + nDup + ' déjà dans la banque'),
      res.orphan ? h('div', { class: 'notice' }, 'Du texte placé avant la première question a été ignoré.') : null,
      canAll.length ? confirmBtn('Tout marquer comme vérifié', 'Je confirme avoir relu les ' + canAll.length + ' questions', '', function () { canAll.forEach(function (q) { imp.ok[q.id] = true; }); renderReview(); }) : null));
    qs.forEach(function (q) {
      var okd = !!imp.ok[q.id], blocked = !estValidable(q);
      var typeLbl = q.type === 'multi' ? 'Réponses multiples' : q.type === 'tf' ? 'Vrai / Faux' : 'Réponse unique';
      var status = q.errors.length ? h('span', { class: 'chip ko' }, '✗ Erreur') : !q.correct.length && q.choices.length ? h('span', { class: 'chip ko' }, '✗ Bonne réponse à choisir') : q.dup ? h('span', { class: 'chip warn' }, 'Déjà dans la banque') : okd ? h('span', { class: 'chip ok' }, '✓ Validée') : q.warnings.length ? h('span', { class: 'chip warn' }, '! Alerte') : h('span', { class: 'chip' }, 'À vérifier');
      var parsed = h('div', { class: 'card' },
        h('div', { class: 'label' }, 'Compris par l’application'),
        q.text ? h('p', { class: 'read', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, q.text) : null,
        q.choices.length && !q.dup ? h('p', { class: 'muted' }, 'Une erreur ? Touche une réponse pour la marquer (ou non) comme bonne. Compare avec la ligne « La réponse correcte est… » du texte collé.') : null,
        q.choices.length ? choiceList(q, null, true, q.dup ? null : function (k) { toggleCorrect(q, k); }) : null,
        q.manual ? h('div', { class: 'notice' }, 'Bonnes réponses choisies par toi, pas par l’analyse. Vérifie-les une dernière fois avant de valider.') : null,
        q.explanation ? explBlock(q) : null);
      var rawEl = h('div', { class: 'card' }, h('div', { class: 'label' }, 'Texte collé, tel quel'), h('div', { class: 'raw' }, q.raw));
      var cmp = h('div', { class: 'cmp' }, parsed, rawEl);
      var card = h('div', { class: 'card' },
        h('div', { class: 'hdr' }, h('h3', null, 'Question ' + q.num + ' · ' + typeLbl), status),
        q.errors.map(function (e) { return h('div', { class: 'notice bad' }, e); }),
        q.warnings.map(function (w) { return h('div', { class: 'notice' }, w); }),
        cmp,
        h('button', { class: 'btn' + (okd ? '' : ' primary'), type: 'button', disabled: blocked,
          onclick: function () { imp.ok[q.id] = !imp.ok[q.id]; var y = window.scrollY; renderReview(); window.scrollTo(0, y); } },
          blocked ? (q.dup ? 'Déjà enregistrée' : q.errors.length ? 'Non validable : corriger le texte collé' : 'Choisis au moins une bonne réponse') : okd ? 'Retirer la validation' : 'J’ai vérifié : valider cette question'));
      box.append(card);
    });
    box.append(h('div', { class: 'savebar' }, h('b', null, nValid + ' validée(s)'),
      h('button', { class: 'btn primary', type: 'button', disabled: !nValid, onclick: saveImported }, 'Enregistrer dans la banque')));
  }
  function saveImported() {
    var imp = UI.imp, res = imp.parsed, n = 0;
    res.questions.forEach(function (q) {
      if (!imp.ok[q.id] || !estValidable(q)) return;
      S.questions.push({ id: q.id, num: q.num, qcm: imp.label.trim(), theme: imp.theme, type: q.type, text: q.text, choices: q.choices, correct: q.correct, explanation: q.explanation, addedAt: Date.now() });
      n++;
    });
    save();
    imp.parsed = null; imp.ok = {}; imp.text = '';
    var box = document.getElementById('review');
    render();
    var b = document.getElementById('review');
    if (b) b.append(h('div', { class: 'notice good' }, n + ' question(s) enregistrée(s). La banque en contient maintenant ' + S.questions.length + '.'));
    window.scrollTo(0, 0);
  }

  // ---------- Banque ----------
  function viewBank() {
    var out = [];
    out.push(h('div', null, h('span', { class: 'label' }, 'Questions enregistrées'), h('h1', null, 'Banque')));
    var f = UI.bankFilter;
    out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Filtre' }, [{ k: 'all', name: 'Tous' }].concat(THEMES).map(function (t) {
      return h('label', null, h('input', { type: 'radio', name: 'bf', checked: f === t.k, onchange: function () { UI.bankFilter = t.k; render(); } }), h('span', null, t.name));
    })));
    var list = S.questions.filter(function (q) { return f === 'all' || q.theme === f; });
    if (!list.length) out.push(h('div', { class: 'card' }, h('p', null, 'Aucune question ici pour l’instant.')));
    list.forEach(function (q) {
      out.push(h('details', { class: 'card' },
        h('summary', null, h('span', { style: 'display:block;min-width:0' },
          h('span', { class: 'label', style: 'display:block' }, themeName(q.theme) + (q.qcm ? ' · ' + q.qcm : '') + ' · Q' + q.num),
          h('span', { style: 'display:block;font-weight:400;color:var(--ink);overflow-wrap:anywhere' }, q.text.length > 110 ? q.text.slice(0, 110) + '…' : q.text))),
        h('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:8px' },
          h('p', { class: 'read', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, q.text), choiceList(q, null, true), explBlock(q),
          confirmBtn('Supprimer cette question', 'Confirmer la suppression', 'danger', function () {
            S.questions = S.questions.filter(function (x) { return x.id !== q.id; }); save(); render();
          }))));
    });
    return out;
  }

  // ---------- Séance ----------
  function startSession() {
    var ids = buildSession(S.questions, S.sessions); if (!ids.length) return;
    S.current = { id: Date.now(), ts: Date.now(), ids: ids, idx: 0, results: [], phase: 'answer' };
    UI.pick = []; UI.mode = 'session'; save(); render(); window.scrollTo(0, 0);
  }
  function finishSession(partial) {
    var c = S.current; if (!c) return;
    var s = { id: c.id, ts: c.ts, ids: c.ids, results: c.results, partial: !!partial && c.results.length < c.ids.length };
    if (c.results.length) S.sessions.push(s);
    S.current = null; save();
    UI.mode = c.results.length ? 'summary' : null; UI.summary = c.results.length ? s : null; render(); window.scrollTo(0, 0);
  }
  function viewSession() {
    var c = S.current, m = byId();
    c.ids = c.ids.filter(function (id) { return m[id] || c.results.some(function (r) { return r.qid === id; }); });
    var q = m[c.ids[c.idx]];
    while (!q && c.idx < c.ids.length) { c.idx++; c.phase = 'answer'; q = m[c.ids[c.idx]]; }
    if (!q) { setTimeout(function () { finishSession(false); }, 0); return [h('p', null, 'Fin de la séance…')]; }
    var locked = c.phase === 'review', res = c.results[c.idx], picked = locked && res ? res.picked : UI.pick;
    var out = [];
    out.push(h('div', { class: 'row sb' }, h('span', { class: 'label' }, 'Question ' + (c.idx + 1) + ' / ' + c.ids.length + ' · ' + themeName(q.theme)),
      h('button', { class: 'btn small', type: 'button', onclick: function () { UI.mode = null; render(); window.scrollTo(0, 0); } }, 'Pause')));
    out.push(h('div', { class: 'ticks lumineuse', role: 'img', 'aria-label': 'Progression' }, c.ids.map(function (id, i) {
      var r = c.results[i]; return h('i', { class: r ? (r.ok ? 'ok' : 'ko') : (i === c.idx ? 'now' : '') });
    })));
    // Conditions d'examen : avant validation, aucune indication du nombre de bonnes réponses ;
    // toutes les questions ont des cases à cocher libres (la notation, elle, ne change pas : sameSet).
    var qcard = h('div', { class: 'card carte-question' },
      h('span', { class: 'filigrane', 'aria-hidden': 'true' }, String(c.idx + 1)),
      h('p', { class: 'read', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, q.text));
    out.push(qcard);
    if (!locked) {
      out.push(h('ul', { class: 'choices', role: 'group', 'aria-label': 'Réponses' }, q.choices.map(function (ch) {
        var on = UI.pick.indexOf(ch.k) !== -1;
        return h('li', null, h('button', { class: 'choice', type: 'button', role: 'checkbox', 'aria-checked': on ? 'true' : 'false',
          onclick: function () {
            UI.pick = on ? UI.pick.filter(function (x) { return x !== ch.k; }) : UI.pick.concat([ch.k]);
            var y = window.scrollY; render(); window.scrollTo(0, y);
          } }, h('span', { class: 'k' }, q.type === 'tf' ? ch.k : ch.k), h('span', { class: 't' }, ch.text)));
      })));
      out.push(h('div', { class: 'actionbar' }, h('div', { class: 'inner' },
        h('button', { class: 'btn primary', type: 'button', disabled: !UI.pick.length, onclick: function () {
          var ok = sameSet(UI.pick, q.correct);
          c.results[c.idx] = { qid: q.id, picked: UI.pick.slice(), ok: ok }; c.phase = 'review'; save(); render(); window.scrollTo(0, 0);
        } }, 'Valider ma réponse'))));
    } else {
      out.push(h('div', { class: 'stamp ' + (res.ok ? 'ok' : 'ko'), role: 'status' }, res.ok ? '✓ Correct' : '✗ Incorrect'));
      out.push(h('p', { class: 'attendu' }, q.correct.length > 1 ? q.correct.length + ' bonnes réponses attendues.' : '1 bonne réponse attendue.'));
      out.push(choiceList(q, picked, true));
      out.push(h('div', { class: 'card' }, explBlock(q) || h('p', { class: 'muted' }, 'Pas d’explication enregistrée pour cette question.')));
      var last = c.idx >= c.ids.length - 1;
      out.push(h('div', { class: 'actionbar' }, h('div', { class: 'inner' },
        h('button', { class: 'btn primary', type: 'button', onclick: function () {
          if (last) finishSession(false); else { c.idx++; c.phase = 'answer'; UI.pick = []; save(); render(); window.scrollTo(0, 0); }
        } }, last ? 'Voir le résultat' : 'Question suivante'))));
    }
    return out;
  }
  function viewSummary() {
    var s = UI.summary, m = byId(), out = [];
    var ok = s.results.filter(function (r) { return r.ok; }).length, n = s.results.length;
    var pct = Math.round(100 * ok / n), objectif = lireReglages().objectif, ecart = ecartObjectif(pct, objectif);
    var etat = !ecart ? 'atteint' : ecart <= 10 ? 'proche' : 'loin';
    out.push(h('div', null, h('span', { class: 'label' }, s.partial ? 'Séance interrompue' : 'Séance terminée'), h('h1', null, 'Résultat')));
    out.push(h('div', { class: 'card' },
      cadran(pct, objectif, etat, 'halo'),
      chiffreGeant(pct, 'rebond'),
      h('p', { role: 'status', style: 'text-align:center;font-weight:600' }, pct + ' % de questions réussies. ' + messageObjectif(pct, objectif)),
      h('p', { class: 'muted', style: 'text-align:center;font-size:14px' }, 'Objectif personnel, réglable sur l’accueil. Ce n’est pas un seuil officiel de l’examen.'),
      h('div', { class: 'compteurs' },
        h('div', null, h('b', { class: 'ok' }, ok), h('span', { class: 'label' }, 'Correctes')),
        h('div', null, h('b', { class: 'ko' }, n - ok), h('span', { class: 'label' }, 'Incorrectes')),
        h('div', null, h('b', null, n), h('span', { class: 'label' }, 'Total'))),
      THEMES.map(function (t) {
        var rs = s.results.filter(function (r) { return m[r.qid] && m[r.qid].theme === t.k; });
        var okT = rs.filter(function (r) { return r.ok; }).length;
        return rs.length ? h('div', { class: 'stat' }, h('span', null, t.name), h('b', null, Math.round(100 * okT / rs.length) + ' % (' + okT + ' sur ' + rs.length + ')')) : null;
      }),
      h('p', { class: 'muted', style: 'font-size:14px' }, 'Une question à réponses multiples compte juste seulement si toutes les bonnes réponses sont cochées et aucune autre.')));
    var missed = s.results.filter(function (r) { return !r.ok && m[r.qid]; });
    if (missed.length) {
      out.push(h('div', { class: 'card a-retravailler' }, h('h2', null, 'À retravailler (' + missed.length + ')'),
        missed.map(function (r) { return questionCard(m[r.qid], r.picked, true); })));
    } else out.push(h('div', { class: 'notice good' }, 'Aucune erreur sur cette séance.'));
    out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: startSession }, 'Nouvelle séance'), h('button', { class: 'btn', type: 'button', onclick: function () { setTab('home'); } }, 'Accueil')));
    return out;
  }

  // ---------- Sauvegarde ----------
  function viewBackup() {
    var out = [];
    out.push(h('div', null, h('span', { class: 'label' }, 'Protéger ta progression'), h('h1', null, 'Sauvegarde')));
    out.push(h('div', { class: 'card' },
      h('p', null, 'Tes questions et tes résultats sont gardés dans ce navigateur, sur ce téléphone. Ils restent privés mais peuvent disparaître si les données du navigateur sont effacées. Une sauvegarde est un petit fichier que tu gardes à part.'),
      h('p', { class: 'muted' }, S.lastBackup ? 'Dernière sauvegarde : ' + fmtDate(S.lastBackup) + '.' : 'Aucune sauvegarde faite pour l’instant.'),
      UI.backupMsg ? h('div', { class: 'notice ' + (UI.backupMsg.bad ? 'bad' : 'good') }, UI.backupMsg.text) : null,
      DL ? h('button', { class: 'btn primary', type: 'button', onclick: function () {
        DL.save({ filename: 'sauvegarde-qcm-pj-' + new Date().toISOString().slice(0, 10) + '.json', data: backupText(S) }).then(function () {
          S.lastBackup = Date.now(); save(); UI.backupMsg = { text: 'Sauvegarde enregistrée.' }; render();
        }).catch(function (e) { UI.backupMsg = { bad: true, text: e && e.code === 'declined' ? 'Enregistrement annulé.' : 'Impossible d’enregistrer un fichier ici. Utilise « Copier la sauvegarde ».' }; render(); });
      } }, 'Enregistrer un fichier de sauvegarde') : null,
      partageDisponible() ? h('button', { class: 'btn' + (DL ? '' : ' primary'), type: 'button', onclick: partagerSauvegarde }, 'Partager la sauvegarde') : null,
      h('button', { class: 'btn' + (DL || partageDisponible() ? '' : ' primary'), type: 'button', onclick: copyBackup }, 'Copier la sauvegarde'),
      h('div', { id: 'copybox' }),
      h('p', { class: 'petit muted' }, 'Stockage protégé : ' + (protection === true ? 'oui' : protection === false ? 'non' : protection === null ? 'vérification…' : 'non disponible'))));
    out.push(h('div', { class: 'card' }, h('h3', null, 'Restaurer'),
      h('p', null, 'Remplace tout le contenu actuel par celui d’une sauvegarde.'),
      h('label', { class: 'label', for: 'restorefile' }, 'Depuis un fichier'),
      h('input', { id: 'restorefile', type: 'file', accept: '.json,application/json,text/plain', onchange: function (e) {
        var f = e.target.files[0]; if (!f) return; var fr = new FileReader();
        fr.onload = function () { restore(String(fr.result)); }; fr.readAsText(f);
      } }),
      h('label', { class: 'label', for: 'restoretext' }, 'Ou depuis le texte copié'),
      h('textarea', { id: 'restoretext', style: 'min-height:90px', placeholder: 'Colle ici le texte de la sauvegarde.' }),
      confirmBtn('Restaurer ce texte', 'Confirmer : remplacer mes données', 'danger', function () { restore(document.getElementById('restoretext').value); })));
    out.push(h('div', { class: 'card' }, h('h3', null, 'Tout effacer'),
      h('p', { class: 'muted' }, 'Supprime les questions et l’historique de ce navigateur. À éviter sans sauvegarde.'),
      confirmBtn('Tout effacer', 'Confirmer : tout effacer', 'danger', function () { S = fresh(); save(); UI.backupMsg = { text: 'Données effacées.' }; render(); })));
    return out;
  }
  function copyBackup() {
    var txt = backupText(S);
    function showBox() {
      var box = document.getElementById('copybox'); if (!box) return;
      var ta = h('textarea', { readonly: true, style: 'min-height:120px' }, txt); box.replaceChildren(h('p', { class: 'muted' }, 'Copie automatique impossible. Sélectionne ce texte et copie-le à la main.'), ta);
      ta.focus(); ta.select();
    }
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
      noterSauvegarde('Sauvegarde copiée. Colle-la dans une note ou un message que tu gardes.');
    }).catch(showBox);
  }
  // Même mise à jour de la date de sauvegarde pour « Copier » et « Partager ».
  function noterSauvegarde(message) { S.lastBackup = Date.now(); save(); UI.backupMsg = { text: message }; render(); }

  // ---------- Partager la sauvegarde (menu de partage du téléphone) ----------
  // Fichier .txt si le navigateur accepte les fichiers, sinon le texte seul ; bouton masqué si le partage n'existe pas.
  function partageDisponible() { return typeof navigator !== 'undefined' && typeof navigator.share === 'function'; }
  function dateDuJour() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function partagerSauvegarde() {
    var txt = backupText(S), donnees = { title: 'Sauvegarde QCM', text: txt }, envoi;
    try {
      if (typeof File === 'function' && typeof navigator.canShare === 'function') {
        var fichier = new File([txt], 'sauvegarde-qcm-' + dateDuJour() + '.txt', { type: 'text/plain' });
        if (navigator.canShare({ files: [fichier] })) donnees = { title: 'Sauvegarde QCM', files: [fichier] };
      }
    } catch (e) {}
    // Appel direct dans le geste de l'utilisateur (aucune attente avant navigator.share).
    try { envoi = navigator.share(donnees); } catch (e) { envoi = Promise.reject(e); }
    Promise.resolve(envoi).then(function () {
      noterSauvegarde('Sauvegarde partagée. Garde-la dans un endroit sûr.');
    }, function (e) {
      if (e && e.name === 'AbortError') return; // annulé par l'utilisateur : ni message, ni date
      UI.backupMsg = { bad: true, text: 'Le partage n’a pas fonctionné. Utilise « Copier la sauvegarde ».' }; render();
    });
  }

  // ---------- Stockage protégé (navigator.storage.persist) ----------
  // null = vérification en cours ; true / false = réponse du navigateur ; 'indisponible' = API absente ou en échec.
  var protection = null;
  function verifierProtection() {
    try {
      if (!navigator.storage || typeof navigator.storage.persisted !== 'function') { protection = 'indisponible'; return; }
      navigator.storage.persisted().then(function (p) { protection = !!p; if (UI.tab === 'backup' && !UI.mode) render(); }, function () { protection = 'indisponible'; });
    } catch (e) { protection = 'indisponible'; }
  }
  function restore(text) {
    try {
      var o = parseBackup(text);
      S = o; save(); UI.backupMsg = { text: 'Sauvegarde restaurée : ' + S.questions.length + ' questions, ' + S.sessions.length + ' séance(s).' };
    } catch (e) { UI.backupMsg = { bad: true, text: 'Ce texte n’est pas une sauvegarde valide. Rien n’a été modifié.' }; }
    render();
  }

  // ---------- Progression (lecture seule, données de qcm-pj-v1 uniquement) ----------
  var NB_BATONS = 20;
  function viewProgression() {
    var out = [], objectif = lireReglages().objectif, lignes = lignesProgression(S.sessions, S.questions, THEMES);
    out.push(h('div', null, h('span', { class: 'label' }, 'Tes séances terminées'), h('h1', null, 'Progression')));
    out.push(h('div', { class: 'card' },
      h('p', null, 'Ton objectif : ', h('b', { class: 'or' }, objectif + ' %'), ' de questions réussies par séance.'),
      h('p', { class: 'petit muted' }, 'Objectif personnel, réglable sur l’accueil. Ce n’est pas un seuil officiel de l’examen.')));
    if (!lignes.length) {
      out.push(h('div', { class: 'card' }, h('p', null, 'Pas encore de séance terminée. Ta progression s’affichera ici après ta première séance.')));
      return out;
    }
    var chrono = lignes.slice(0, NB_BATONS).reverse();
    out.push(h('div', { class: 'card' },
      h('span', { class: 'label' }, chrono.length > 1 ? 'Évolution des ' + chrono.length + ' dernières séances' : 'Évolution (1 séance)'),
      h('div', { class: 'evolution', role: 'img', 'aria-label': 'Évolution, de la plus ancienne à la plus récente : ' + chrono.map(function (l) { return l.pct + ' %'; }).join(', ') + '. Objectif ' + objectif + ' %.' },
        h('span', { class: 'ligne-objectif', style: 'bottom:' + objectif + '%' }),
        chrono.map(function (l, i) { return h('span', { class: 'baton' + (i === chrono.length - 1 ? ' recente' : ''), style: 'height:' + Math.max(l.pct, 2) + '%' }); })),
      h('p', { class: 'petit muted' }, 'De la plus ancienne (à gauche) à la plus récente (à droite). Ligne dorée : ton objectif (' + objectif + ' %).')));
    out.push(h('div', { class: 'card' },
      h('span', { class: 'label' }, pluriel(lignes.length, 'séance', 'séances') + ', de la plus récente à la plus ancienne'),
      h('ul', { class: 'liste-seances' }, lignes.map(function (l) {
        return h('li', null,
          h('div', { class: 'ligne-tete' }, h('span', null, fmtDate(l.ts) + (l.partial ? ' · interrompue' : '')), h('b', { class: 'ligne-pct' }, l.pct + ' %')),
          h('p', { class: 'petit muted' }, l.themes.map(function (t) { return t.name + ' ' + (t.total ? t.pct + ' % (' + t.justes + ' sur ' + t.total + ')' : ': aucune question'); }).join(' · ')));
      }))));
    return out;
  }

  // ---------- Réglages : entrées vers les écrans existants (Banque, Importer, Sauvegarde), sans changer leur contenu ----------
  var SOUS_REGLAGES = ['bank', 'import', 'backup'];
  var ENTREES_REGLAGES = [['bank', 'Banque', 'Questions enregistrées'], ['import', 'Importer', 'Ajouter un QCM à la banque'], ['backup', 'Sauvegarde', 'Protéger ta progression']];
  function viewReglages() {
    return [h('div', null, h('span', { class: 'label' }, 'Banque, import et sauvegarde'), h('h1', null, 'Réglages')),
      h('div', { class: 'entrees' }, ENTREES_REGLAGES.map(function (e) {
        return h('button', { class: 'card entree', type: 'button', onclick: function () { setTab(e[0]); } },
          icone(e[0]),
          h('span', { class: 'entree-texte' }, h('span', { class: 'entree-titre' }, e[1]), h('span', { class: 'entree-sous' }, e[2])),
          h('span', { class: 'entree-fleche', 'aria-hidden': 'true' }, '›'));
      }))];
  }
  function boutonRetour() {
    return h('button', { class: 'btn retour', type: 'button', 'aria-label': 'Retour aux Réglages', onclick: function () { setTab('reglages'); } }, '‹ Réglages');
  }

  // ---------- rendu général ----------
  var TABS = [['home', 'Accueil'], ['prog', 'Progression'], ['reglages', 'Réglages']];
  // Icônes (onglets et entrées des Réglages) : contours simples dessinés ici (24 x 24).
  var ICONES = {
    home: ['M3.5 11 12 4l8.5 7', 'M5.5 9.5v10h13v-10', 'M10 19.5v-5.5h4v5.5'],
    prog: ['M4 19.5h16', 'M4.5 16l4.5-5 3.5 3 6.5-7.5', 'M15 6.5h4v4'],
    reglages: ['M4 7h16', 'M15 4.5v5', 'M4 12h16', 'M8 9.5v5', 'M4 17h16', 'M13 14.5v5'],
    import: ['M12 4v10.5', 'M7.5 10 12 14.5 16.5 10', 'M4.5 15.5v4h15v-4'],
    bank: ['M5 5h4v14.5H5z', 'M10.5 5h4v14.5h-4z', 'M16 6.2l3.4-.9 3 13.6-3.4.9z'],
    backup: ['M12 3.5 5 6.3v5.2c0 4.3 2.9 7.8 7 9 4.1-1.2 7-4.7 7-9V6.3z', 'M9 12.2l2.1 2.1L15.2 10']
  };
  function icone(cle) {
    var s = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    ICONES[cle].forEach(function (d) { s.append(sv('path', { d: d })); });
    return s;
  }
  function render() {
    var view = document.getElementById('view'), tabs = document.getElementById('tabs');
    var inSession = UI.mode === 'session' && S.current;
    if (UI.mode === 'session' && !S.current) UI.mode = null;
    var ecran = UI.mode || UI.tab;
    animerEcran = !MOINS_DE_MOUVEMENT && ecran !== dernierEcran;
    dernierEcran = ecran;
    document.body.classList.toggle('in-session', !!inSession);
    var sousReglages = SOUS_REGLAGES.indexOf(UI.tab) !== -1;
    tabs.replaceChildren.apply(tabs, TABS.map(function (t) {
      var actif = !UI.mode && (UI.tab === t[0] || (t[0] === 'reglages' && sousReglages));
      return h('button', { type: 'button', 'aria-label': t[1], 'aria-current': actif ? 'page' : null, onclick: function () { setTab(t[0]); } },
        icone(t[0]), h('span', null, t[1]));
    }));
    var nodes;
    if (UI.mode === 'session' && S.current) nodes = viewSession();
    else if (UI.mode === 'summary' && UI.summary) nodes = viewSummary();
    else nodes = ({ home: viewHome, prog: viewProgression, reglages: viewReglages, import: viewImport, bank: viewBank, backup: viewBackup })[UI.tab]();
    if (!UI.mode && sousReglages) nodes = [boutonRetour()].concat(nodes);
    view.replaceChildren.apply(view, nodes);
    if (!UI.mode && UI.tab === 'import' && UI.imp.parsed) renderReview();
  }

  render();
  // Demande discrète de stockage protégé : aucune fenêtre, aucun message, ne bloque jamais le démarrage.
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') navigator.storage.persist().then(verifierProtection, verifierProtection);
    else verifierProtection();
  } catch (e) { verifierProtection(); }
  try {
    if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { DL = d; if (UI.tab === 'backup' && !UI.mode) render(); }).catch(function () {});
  } catch (e) {}
})();
