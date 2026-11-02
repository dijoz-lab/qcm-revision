(function () {
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
  var AVATAR_ENTRAINEMENT = 'avatars/avatar-entrainement.webp';
  function sv(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function pctSeance(s) { return Math.round(100 * s.results.filter(function (r) { return r.ok; }).length / s.results.length); }
  function seancesRecentes() { return S.sessions.filter(function (s) { return s.results && s.results.length; }).slice(-NB_SEANCES_RECENTES); }
  function moyenne(liste) { return liste.length ? Math.round(liste.reduce(function (a, s) { return a + pctSeance(s); }, 0) / liste.length) : null; }
  function joursDepuis(ts) { return Math.floor((Date.now() - ts) / 864e5); }
  // Avatar : invisible (hidden) tant que son fichier n'a pas pu être chargé ; retiré s'il n'existe pas.
  function avatar(src, alt) {
    return h('img', { class: 'medaillon', src: src, alt: alt, hidden: true, onload: function (e) { e.target.hidden = false; }, onerror: function (e) { e.target.remove(); } });
  }
  // Cadran : 60 graduations, arc proportionnel à pct (aucun arc si null ou 0), repère or à l'objectif, avatar au centre.
  function cadran(pct, objectif, classeArc, classeCadran) {
    var c = 150, r = 126, tour = 2 * Math.PI * r, i, a;
    var svg = sv('svg', { viewBox: '0 0 300 300', 'aria-hidden': 'true', focusable: 'false' });
    var grad = sv('linearGradient', { id: 'degrade-arc', x1: '0', y1: '0', x2: '1', y2: '1' });
    grad.append(sv('stop', { offset: '0', 'stop-color': '#8FB2FF' }), sv('stop', { offset: '1', 'stop-color': '#5E86F0' }));
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
    svg.append(sv('line', { class: 'repere-or', x1: c + 114 * Math.cos(a), y1: c + 114 * Math.sin(a), x2: c + 138 * Math.cos(a), y2: c + 138 * Math.sin(a) }));
    return h('div', { class: 'cadran' + (classeCadran ? ' ' + classeCadran : '') }, svg, avatar(AVATAR_ENTRAINEMENT, 'Avatar d’entraînement'));
  }
  function selectObjectif(objectif) {
    var vals = [], v;
    for (v = 50; v <= 100; v += 5) vals.push(v);
    if (vals.indexOf(objectif) === -1) { vals.push(objectif); vals.sort(function (x, y) { return x - y; }); }
    return h('select', { id: 'objectif', onchange: function (e) { ecrireObjectif(parseInt(e.target.value, 10)); render(); } },
      vals.map(function (x) { return h('option', { value: x, selected: x === objectif }, x + ' %'); }));
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
    out.push(cadran(moy, objectif));
    out.push(h('div', null, h('span', { class: 'label' }, 'Examen final OPJ · police judiciaire'), h('h1', { class: 'titre-pret' }, 'Prêt.')));
    out.push(h('div', { class: 'card' },
      h('div', { class: 'row sb' }, h('span', null, 'Moyenne récente ', h('b', null, moy === null ? '—' : moy + ' %')), h('span', { class: 'or' }, '→ objectif ' + objectif + ' %')),
      h('div', { class: 'objectif-barre', role: 'img', 'aria-label': moy === null ? 'Pas encore de séance terminée, objectif ' + objectif + ' %' : 'Moyenne récente ' + moy + ' %, objectif ' + objectif + ' %' },
        h('i', { style: 'width:' + (moy || 0) + '%' }), h('b', { style: 'left:' + objectif + '%' })),
      h('p', { class: 'muted', style: 'font-size:14px' }, moy === null ? 'Pas encore de séance terminée.' : 'Moyenne des ' + recentes.length + ' dernière(s) séance(s). ' + messageObjectif(moy, objectif)),
      h('label', { class: 'label', for: 'objectif' }, 'Mon objectif personnel (ce n’est pas un seuil officiel)'),
      selectObjectif(objectif)));
    if (S.current) {
      var cur = S.current;
      out.push(h('div', { class: 'card' }, h('h2', null, 'Séance en cours'),
        h('p', { class: 'muted' }, cur.results.length + ' question(s) répondue(s) sur ' + cur.ids.length + '.'),
        h('button', { class: 'btn primary big', type: 'button', onclick: function () { UI.mode = 'session'; UI.pick = []; render(); window.scrollTo(0, 0); } }, 'Reprendre'),
        h('div', { class: 'row' }, confirmBtn('Abandonner', 'Confirmer l’abandon', 'danger', function () { finishSession(true); }))));
    } else {
      var size = Math.min(SESSION_SIZE, total);
      out.push(h('div', { class: 'card' },
        total ? h('button', { class: 'btn primary big', type: 'button', onclick: startSession }, 'Commencer la séance')
              : h('button', { class: 'btn primary big', type: 'button', onclick: function () { setTab('import'); } }, 'Importer un QCM'),
        total ? h('p', { class: 'muted', style: 'font-size:14px' }, size + ' questions mélangées : garde à vue et procédure, tous les QCM ensemble. Environ un tiers de questions à retravailler, le reste jamais vues ou peu vues.')
              : h('p', null, "La banque est vide. Importe d'abord un QCM pour pouvoir t'entraîner.")));
    }
    if (recentes.length) {
      out.push(h('div', { class: 'card' }, h('h3', null, 'Dernières séances'),
        h('div', { class: 'mini-barres' }, recentes.slice().reverse().map(function (s) {
          var p = pctSeance(s);
          return h('div', { class: 'mini-barre' }, h('b', null, p + ' %'),
            h('div', { class: 'bar', role: 'img', 'aria-label': p + ' % de questions réussies' }, h('i', { style: 'width:' + p + '%' })),
            h('span', { class: 'label' }, new Date(s.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + (s.partial ? ' · interrompue' : '')));
        }))));
    }
    if (total) {
      var seen = S.questions.filter(function (q) { return st[q.id]; }).length;
      out.push(h('div', { class: 'card' }, h('h3', null, 'Banque de questions'),
        THEMES.map(function (t) { return h('div', { class: 'stat' }, h('span', null, t.name), h('b', null, S.questions.filter(function (q) { return q.theme === t.k; }).length)); }),
        h('div', { class: 'stat' }, h('span', null, 'Total'), h('b', null, total)),
        h('div', null, h('div', { class: 'bar', role: 'img', 'aria-label': seen + ' questions vues sur ' + total }, h('i', { style: 'width:' + Math.round(100 * seen / total) + '%' })),
          h('p', { class: 'muted', style: 'margin-top:6px;font-size:14px' }, seen + ' sur ' + total + ' questions vues au moins une fois'))));
    }
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
    var instr = q.type === 'multi' ? 'Plusieurs réponses possibles, au moins une' : q.type === 'tf' ? 'Vrai ou faux' : 'Une seule réponse';
    var qcard = h('div', { class: 'card carte-question' },
      h('span', { class: 'filigrane', 'aria-hidden': 'true' }, String(c.idx + 1)),
      h('p', { class: 'read', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, q.text),
      h('div', { class: 'label' }, instr));
    out.push(qcard);
    if (!locked) {
      out.push(h('ul', { class: 'choices' + (q.type === 'multi' ? ' multi' : ''), role: q.type === 'multi' ? 'group' : 'radiogroup', 'aria-label': 'Réponses' }, q.choices.map(function (ch) {
        var on = UI.pick.indexOf(ch.k) !== -1;
        return h('li', null, h('button', { class: 'choice', type: 'button', role: q.type === 'multi' ? 'checkbox' : 'radio', 'aria-checked': on ? 'true' : 'false',
          onclick: function () {
            if (q.type === 'multi') { UI.pick = on ? UI.pick.filter(function (x) { return x !== ch.k; }) : UI.pick.concat([ch.k]); }
            else UI.pick = [ch.k];
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
      h('div', { class: 'pourcentage' }, pct + ' %'),
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
      h('button', { class: 'btn' + (DL ? '' : ' primary'), type: 'button', onclick: copyBackup }, 'Copier la sauvegarde'),
      h('div', { id: 'copybox' })));
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
      S.lastBackup = Date.now(); save(); UI.backupMsg = { text: 'Sauvegarde copiée. Colle-la dans une note ou un message que tu gardes.' }; render();
    }).catch(showBox);
  }
  function restore(text) {
    try {
      var o = parseBackup(text);
      S = o; save(); UI.backupMsg = { text: 'Sauvegarde restaurée : ' + S.questions.length + ' questions, ' + S.sessions.length + ' séance(s).' };
    } catch (e) { UI.backupMsg = { bad: true, text: 'Ce texte n’est pas une sauvegarde valide. Rien n’a été modifié.' }; }
    render();
  }

  // ---------- rendu général ----------
  var TABS = [['home', 'Accueil'], ['import', 'Importer'], ['bank', 'Banque'], ['backup', 'Sauvegarde']];
  function render() {
    var view = document.getElementById('view'), tabs = document.getElementById('tabs');
    var inSession = UI.mode === 'session' && S.current;
    if (UI.mode === 'session' && !S.current) UI.mode = null;
    document.body.classList.toggle('in-session', !!inSession);
    tabs.replaceChildren.apply(tabs, TABS.map(function (t) {
      return h('button', { type: 'button', 'aria-current': UI.tab === t[0] && !UI.mode ? 'page' : null, onclick: function () { setTab(t[0]); } }, t[1]);
    }));
    var nodes;
    if (UI.mode === 'session' && S.current) nodes = viewSession();
    else if (UI.mode === 'summary' && UI.summary) nodes = viewSummary();
    else nodes = ({ home: viewHome, import: viewImport, bank: viewBank, backup: viewBackup })[UI.tab]();
    view.replaceChildren.apply(view, nodes);
    if (!UI.mode && UI.tab === 'import' && UI.imp.parsed) renderReview();
  }

  render();
  try {
    if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { DL = d; if (UI.tab === 'backup' && !UI.mode) render(); }).catch(function () {});
  } catch (e) {}
})();
