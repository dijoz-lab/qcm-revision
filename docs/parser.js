/* ===== Découpage (parser) : coupe le texte collé, ne réécrit jamais rien ===== */
function normText(s) {
  return String(s).replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
}

function hashStr(str) {
  var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function questionId(q) {
  return 'q' + hashStr(normText(q.text) + '|' + q.choices.map(function (c) { return normText(c.text); }).join('|'));
}

function decompose(answer, choices) {
  var sols = [];
  function go(rest, used, acc) {
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i];
      if (used.indexOf(c.k) !== -1) continue;
      if (rest === c.n) sols.push(acc.concat([c.k]));
      else if (rest.indexOf(c.n + ', ') === 0) go(rest.slice(c.n.length + 2), used.concat([c.k]), acc.concat([c.k]));
    }
  }
  go(answer, [], []);
  var seen = {}, out = [];
  sols.forEach(function (s) {
    var key = s.slice().sort().join(',');
    if (!seen[key]) { seen[key] = 1; out.push(s.slice().sort()); }
  });
  return out;
}

function parseBlock(b) {
  var warnings = [], errors = [];
  var L = b.lines;
  var raw = ('Question ' + b.num + '\n' + L.join('\n')).replace(/\s+$/, '');
  var q = { num: b.num, raw: raw, text: '', type: 'single', choices: [], correct: [], explanation: '', warnings: warnings, errors: errors };

  var iT = -1, iV = -1, iF = -1, iC = -1, i;
  for (i = 0; i < L.length; i++) if (L[i].trim() === 'Texte de la question') { iT = i; break; }
  if (iT < 0) { errors.push("Ligne « Texte de la question » introuvable."); return q; }
  for (i = iT + 1; i < L.length; i++) if (/Veuillez choisir\s+(au moins une réponse|une réponse)/i.test(L[i]) || /^\s*Question\s*\d+\s*Réponse\s*\.?\s*$/i.test(L[i])) { iV = i; break; }
  if (iV < 0) { errors.push("Ligne « Veuillez choisir … réponse » introuvable."); return q; }
  var typed = /Veuillez choisir/i.test(L[iV]);
  q.type = /au moins une/i.test(L[iV]) ? 'multi' : 'single';
  for (i = iV + 1; i < L.length; i++) if (L[i].trim() === 'Feedback') { iF = i; break; }
  if (iF < 0) { errors.push("Ligne « Feedback » introuvable (la correction n'a pas été copiée)."); return q; }
  for (i = L.length - 1; i > iF; i--) if (/^\s*(La réponse correcte est|Les réponses correctes sont)/.test(L[i])) { iC = i; break; }
  if (iC < 0) { errors.push("Ligne « La réponse correcte est … » introuvable."); return q; }

  q.text = L.slice(iT + 1, iV).join('\n').trim();
  if (!q.text) errors.push("Énoncé vide.");

  // Choix
  var cl = L.slice(iV + 1, iF);
  var hasLetters = cl.some(function (l) { return /^\s*[a-z]\.\s*$/.test(l); });
  if (hasLetters) {
    var cur = null;
    cl.forEach(function (l) {
      var m = l.match(/^\s*([a-z])\.\s*$/), t = l.trim();
      if (m) { cur = { k: m[1], parts: [] }; q.choices.push(cur); }
      else if (t) {
        if (cur) cur.parts.push(t);
        else warnings.push("Texte avant le premier choix : « " + t + " »");
      }
    });
    q.choices = q.choices.map(function (c) { return { k: c.k, text: c.parts.join(' ') }; });
    q.choices.forEach(function (c) { if (!c.text) errors.push("Le choix " + c.k + " est vide."); });
    q.choices.forEach(function (c, idx) {
      if (c.k.charCodeAt(0) !== 97 + idx) warnings.push("Les lettres des choix ne se suivent pas (a, b, c…).");
    });
  } else {
    var vals = cl.map(function (l) { return l.trim(); }).filter(Boolean);
    if (vals.length === 2 && /^vrai$/i.test(vals[0]) && /^faux$/i.test(vals[1])) {
      q.type = 'tf';
      q.choices = [{ k: 'V', text: 'Vrai' }, { k: 'F', text: 'Faux' }];
    } else if (vals.length === 2 && /^faux$/i.test(vals[0]) && /^vrai$/i.test(vals[1])) {
      q.type = 'tf';
      q.choices = [{ k: 'F', text: 'Faux' }, { k: 'V', text: 'Vrai' }];
    } else {
      errors.push("Choix non reconnus (ni lettres a., b.…, ni Vrai/Faux).");
    }
  }
  if (q.choices.length < 2) errors.push("Moins de 2 choix trouvés.");

  // Bonne(s) réponse(s)
  var ansRaw = L.slice(iC).join('\n');
  var am = ansRaw.match(/^\s*(?:La réponse correcte est|Les réponses correctes sont)\s*:?\s*([\s\S]*)$/);
  var ans = normText(am ? am[1] : '');
  if (!typed) {
    // variante de la plateforme : la ligne « Question N Réponse » ne dit pas si c'est unique ou multiple.
    // On suit alors le pluriel de la ligne de correction (« Les réponses correctes sont » = plusieurs).
    q.type = /^\s*Les réponses correctes sont/.test(L[iC]) ? 'multi' : 'single';
    warnings.push("Le texte ne précise pas « une réponse » ou « au moins une réponse ». Type déduit de la ligne de correction : " + (q.type === 'multi' ? 'plusieurs bonnes réponses' : 'une seule bonne réponse') + ".");
  }
  var cmp = function (t) { return t.replace(/\s+,/g, ','); }; // comparaison seulement : la plateforme met parfois un espace avant la virgule de séparation
  if (!ans) errors.push("Bonne réponse vide.");
  if (q.type === 'tf') {
    var a = ans.replace(/[«»"]/g, '').replace(/\.\s*$/, '').trim().toLowerCase();
    if (a === 'vrai') q.correct = ['V'];
    else if (a === 'faux') q.correct = ['F'];
    else errors.push("Bonne réponse Vrai/Faux non reconnue : « " + ans + " »");
  } else if (q.choices.length && ans) {
    var ch = q.choices.map(function (c) { return { k: c.k, n: normText(c.text) }; });
    var sols = decompose(cmp(ans), ch.map(function (c) { return { k: c.k, n: cmp(c.n) }; }));
    if (sols.length === 0) errors.push("Impossible de retrouver la ou les bonnes réponses parmi les choix : « " + ans + " »");
    else if (sols.length > 1) errors.push("Bonne réponse ambiguë : plusieurs lectures possibles. À vérifier à la main.");
    else q.correct = sols[0];
    if (q.type === 'single' && q.correct.length > 1) errors.push("Question à réponse unique, mais plusieurs bonnes réponses trouvées.");
  }

  // Explication : recopiée telle quelle, on retire seulement les formules d'état de la plateforme
  var expl = L.slice(iF + 1, iC).join('\n');
  var paras = expl.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  if (paras.length && /^Votre réponse est (correcte|incorrecte|partiellement correcte)\.?$/i.test(paras[0])) paras.shift();
  if (q.type === 'tf') {
    var good = null, bad = null, others = [];
    paras.forEach(function (p) {
      if (/^Bonne réponse\.?\s/.test(p)) good = p.replace(/^Bonne réponse\.?\s*/, '');
      else if (/^Mauvaise réponse\.?\s/.test(p)) bad = p.replace(/^Mauvaise réponse\.?\s*/, '');
      else others.push(p);
    });
    var tfp = [];
    if (good !== null && bad !== null) {
      if (normText(good) === normText(bad)) tfp.push(good);
      else { tfp.push(good); tfp.push(bad); warnings.push("Les deux messages « Bonne / Mauvaise réponse » diffèrent : les deux sont conservés."); }
    } else if (good !== null) tfp.push(good);
    else if (bad !== null) tfp.push(bad);
    paras = tfp.concat(others);
  }
  q.explanation = paras.join('\n\n');
  if (!q.explanation) warnings.push("Aucune explication trouvée.");
  return q;
}

function parseQcm(text) {
  var lines = String(text).replace(/\r/g, '').split('\n');
  var blocks = [], cur = null, orphan = [];
  lines.forEach(function (line) {
    var m = line.match(/^\s*Question\s+(\d+)\s*$/);
    if (m) { cur = { num: parseInt(m[1], 10), lines: [] }; blocks.push(cur); }
    else if (cur) cur.lines.push(line);
    else if (line.trim()) orphan.push(line);
  });
  var out = blocks.map(parseBlock);
  out.forEach(function (q) { q.id = questionId(q); });
  var seen = {};
  out.forEach(function (q) {
    if (seen[q.id]) q.warnings.push("Cette question apparaît deux fois dans le texte collé.");
    seen[q.id] = 1;
  });
  return { questions: out, orphan: orphan.join('\n') };
}

/* ===== Correction manuelle des bonnes réponses (écran de validation) ===== */
// Touche la réponse k : réponse unique ou Vrai/Faux = elle remplace l'ancienne ; réponses multiples = ajoutée ou retirée.
// Seules les bonnes réponses changent, jamais l'énoncé, les choix ni l'explication.
function choisirBonneReponse(q, k) {
  var set;
  if (q.type === 'multi') { set = q.correct.indexOf(k) !== -1 ? q.correct.filter(function (x) { return x !== k; }) : q.correct.concat([k]); }
  else set = [k];
  q.correct = q.choices.map(function (c) { return c.k; }).filter(function (x) { return set.indexOf(x) !== -1; });
  q.manual = true;
  q.errors = q.errors.filter(function (e) { return !/^(Impossible de retrouver|Bonne réponse ambiguë|Question à réponse unique|Bonne réponse Vrai\/Faux|Bonne réponse vide)/.test(e); });
  return q;
}

// q.dup (« déjà dans la banque ») est rempli par app.js, jamais par le parser.
function estValidable(q) {
  return !q.errors.length && !q.dup && q.correct.length > 0;
}
if (typeof module !== 'undefined') module.exports = { parseQcm: parseQcm, normText: normText, questionId: questionId, choisirBonneReponse: choisirBonneReponse, estValidable: estValidable };
