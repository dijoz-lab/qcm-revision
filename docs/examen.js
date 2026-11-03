/* ===== Examens blancs : logique pure (tirage, minuteurs, notation, correction détaillée) =====
   Script classique (sans import/export). Aucun accès à l'écran ni au stockage : testé avec Node (tests/examen.test.js).
   Tous les temps sont des horodatages (heure réelle, en millisecondes) : rien ne s'arrête si le téléphone se verrouille. */

// Part de garde à vue dans un examen : null = la proportion de la banque ; sinon un nombre entre 0 et 1 (ex. 0.4).
var EXAMEN_PART_GAV = null;
var TYPES_EXAMEN = {
  60: { type: 60, n: 60, dureeMs: 60 * 60000, minuteMs: 60000, minuteAuto: true, nom: 'Examen 60 min' },
  30: { type: 30, n: 30, dureeMs: 30 * 60000, minuteMs: 60000, minuteAuto: false, nom: 'Examen 30 min' }
};

// ---------- outils ----------
function memeEnsemble(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; }); }
function melanger(liste, alea) {
  var a = liste.slice(), r = alea || Math.random;
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// Une seule question par identifiant (la première rencontrée) : protège du défaut connu des doublons dans la banque.
function questionsUniques(questions) {
  var vu = {};
  return questions.filter(function (q) { if (!q || !q.id || vu[q.id]) return false; vu[q.id] = 1; return true; });
}
// Nombre de questions par thème pour un examen de n questions (méthode du plus grand reste).
// partGav : null = proportion de la banque ; sinon part de garde à vue imposée.
function quotasThemes(pool, n, partGav) {
  var compte = {}, themes = [];
  pool.forEach(function (q) { if (!(q.theme in compte)) { compte[q.theme] = 0; themes.push(q.theme); } compte[q.theme]++; });
  var cible = {};
  if (partGav != null && 'gav' in compte && themes.length > 1) {
    var autres = themes.filter(function (t) { return t !== 'gav'; }), totalAutres = pool.length - compte.gav;
    cible.gav = n * partGav;
    autres.forEach(function (t) { cible[t] = n * (1 - partGav) * compte[t] / totalAutres; });
  } else themes.forEach(function (t) { cible[t] = n * compte[t] / pool.length; });
  var quota = {}, somme = 0;
  themes.forEach(function (t) { quota[t] = Math.min(Math.floor(cible[t]), compte[t]); somme += quota[t]; });
  themes.slice().sort(function (a, b) { return (cible[b] - Math.floor(cible[b])) - (cible[a] - Math.floor(cible[a])); })
    .forEach(function (t) { if (somme < n && quota[t] < compte[t]) { quota[t]++; somme++; } });
  // S'il manque encore des questions (thème trop petit), on complète avec les thèmes qui en ont.
  themes.forEach(function (t) { while (somme < n && quota[t] < compte[t]) { quota[t]++; somme++; } });
  return quota;
}

// ---------- tirage de l'examen 60 min : modèle de l'épreuve réelle, au hasard ----------
// Renvoie la liste des identifiants, ou null si la banque a moins de n questions différentes.
function tirerExamen(questions, n, partGav, alea) {
  var pool = questionsUniques(questions);
  if (pool.length < n) return null;
  var quota = quotasThemes(pool, n, partGav), choisis = [];
  Object.keys(quota).forEach(function (t) {
    choisis = choisis.concat(melanger(pool.filter(function (q) { return q.theme === t; }), alea).slice(0, quota[t]));
  });
  return melanger(choisis, alea).map(function (q) { return q.id; });
}

// ---------- tirage de l'examen 30 min : questions difficiles ou souvent ratées (règle de CLAUDE.md) ----------
// Historique des réponses, classé par date : séances TERMINÉES (les interrompues sont exclues, décision de Diana)
// et examens terminés. Une question sans réponse dans un examen compte comme ratée.
function historiqueReponses(sessions, examens) {
  var h = [];
  (sessions || []).forEach(function (s) { if (s && !s.partial && s.results && s.results.length) h.push({ ts: s.ts || 0, results: s.results }); });
  (examens || []).forEach(function (e) { if (e && e.results && e.results.length) h.push({ ts: e.debut || 0, results: e.results }); });
  return h.sort(function (a, b) { return a.ts - b.ts; });
}
// Par question : nombre de fois vue, nombre d'erreurs, rang de la dernière erreur (plus grand = plus récente).
function bilanQuestions(historique) {
  var m = {};
  historique.forEach(function (x, rang) {
    x.results.forEach(function (r) {
      var b = m[r.qid] || (m[r.qid] = { vues: 0, erreurs: 0, derniereErreur: -1 });
      b.vues++; if (!r.ok) { b.erreurs++; b.derniereErreur = rang; }
    });
  });
  return m;
}
// Jusqu'aux deux tiers : questions ratées au moins 2 fois (erreurs décroissantes, puis erreur la plus récente) ;
// puis ratées une fois (la plus récente d'abord) ; puis jamais vues ou moins vues ; à égalité, au hasard.
// Garde à vue et procédure dans la proportion de la banque quand c'est possible ; jamais deux fois la même question.
// Sans historique, tout est au hasard. Renvoie null si la banque a moins de n questions différentes.
function tirerExamenDifficile(questions, sessions, examens, n, partGav, alea) {
  var pool = questionsUniques(questions);
  if (pool.length < n) return null;
  var r = alea || Math.random, bilan = bilanQuestions(historiqueReponses(sessions, examens));
  var items = pool.map(function (q) { var b = bilan[q.id] || { vues: 0, erreurs: 0, derniereErreur: -1 }; return { q: q, b: b, hasard: r() }; });
  var palier1 = items.filter(function (x) { return x.b.erreurs >= 2; }).sort(function (a, b) { return (b.b.erreurs - a.b.erreurs) || (b.b.derniereErreur - a.b.derniereErreur) || (a.hasard - b.hasard); });
  var palier2 = items.filter(function (x) { return x.b.erreurs === 1; }).sort(function (a, b) { return (b.b.derniereErreur - a.b.derniereErreur) || (a.hasard - b.hasard); });
  var palier3 = items.filter(function (x) { return x.b.erreurs === 0; }).sort(function (a, b) { return (a.b.vues - b.b.vues) || (a.hasard - b.hasard); });
  var quota = quotasThemes(pool, n, partGav), parTheme = {}, choisis = [], pris = {}, max1 = Math.floor(2 * n / 3), nb1 = 0;
  function prendre(x, respecterQuota) {
    if (choisis.length >= n || pris[x.q.id]) return;
    if (respecterQuota && (parTheme[x.q.theme] || 0) >= (quota[x.q.theme] || 0)) return;
    pris[x.q.id] = 1; choisis.push(x.q); parTheme[x.q.theme] = (parTheme[x.q.theme] || 0) + 1;
  }
  palier1.forEach(function (x) { if (nb1 < max1) { var avant = choisis.length; prendre(x, true); if (choisis.length > avant) nb1++; } });
  palier2.forEach(function (x) { prendre(x, true); });
  palier3.forEach(function (x) { prendre(x, true); });
  // Proportion impossible à tenir : on complète sans quota, dans le même ordre de priorité (les deux tiers restent un plafond).
  palier2.concat(palier3).forEach(function (x) { prendre(x, false); });
  palier1.forEach(function (x) { prendre(x, false); });
  return melanger(choisis, r).map(function (q) { return q.id; });
}

// ---------- examen en cours ----------
function nouvelExamen(type, ids, maintenant) {
  return { id: maintenant, type: type, debut: maintenant, ids: ids.slice(), reponses: {}, idx: 0, arrivee: maintenant, grille: false };
}
function copieExamen(ex) {
  var r = {};
  Object.keys(ex.reponses || {}).forEach(function (k) { r[k] = ex.reponses[k].slice(); });
  return { id: ex.id, type: ex.type, debut: ex.debut, ids: ex.ids.slice(), reponses: r, idx: ex.idx, arrivee: ex.arrivee, grille: !!ex.grille };
}
// Recalcule l'état à l'heure « maintenant ». Résultat : { ex, fini, change }.
// - fin de l'examen si la durée totale est atteinte ;
// - minute de la question écoulée (examen à minuteur automatique) : AU PLUS un passage (même après une longue absence),
//   la réponse est conservée ; sur la dernière question, la grille s'ouvre sans terminer ;
// - horloge du téléphone reculée : la minute repart de maintenant (jamais de temps négatif).
function avancerExamen(ex, maintenant) {
  var t = TYPES_EXAMEN[ex.type], e = copieExamen(ex);
  if (maintenant >= e.debut + t.dureeMs) return { ex: e, fini: true, change: true };
  if (e.grille || e.arrivee == null) return { ex: e, fini: false, change: false };
  if (maintenant < e.arrivee) { e.arrivee = maintenant; return { ex: e, fini: false, change: true }; }
  if (t.minuteAuto && maintenant - e.arrivee >= t.minuteMs) {
    if (e.idx < e.ids.length - 1) { e.idx++; e.arrivee = maintenant; } else { e.grille = true; e.arrivee = null; }
    return { ex: e, fini: false, change: true };
  }
  return { ex: e, fini: false, change: false };
}
// Temps restants en millisecondes (jamais négatifs, jamais au-delà du maximum). minute = null quand la grille est ouverte.
function tempsRestants(ex, maintenant) {
  var t = TYPES_EXAMEN[ex.type];
  var global = Math.max(0, Math.min(t.dureeMs, ex.debut + t.dureeMs - maintenant));
  var minute = ex.grille || ex.arrivee == null ? null : Math.max(0, Math.min(t.minuteMs, ex.arrivee + t.minuteMs - maintenant));
  return { global: global, minute: minute };
}
// Arrivée sur une question (Précédente, Suivante, choix dans la grille) : la minute est relancée.
// Rester sur la question affichée ne relance rien.
function allerA(ex, idx, maintenant) {
  var e = copieExamen(ex);
  if (idx < 0 || idx >= e.ids.length) return e;
  if (idx === e.idx && !e.grille) return e;
  e.idx = idx; e.grille = false; e.arrivee = maintenant;
  return e;
}
// Grille ouverte : pas de minute de question en cours.
function ouvrirGrille(ex) { var e = copieExamen(ex); e.grille = true; e.arrivee = null; return e; }
// Coche ou décoche la réponse k de la question qid (cases à cocher libres, aucune limite).
function basculerReponse(ex, qid, k) {
  var e = copieExamen(ex), r = e.reponses[qid] || [];
  e.reponses[qid] = r.indexOf(k) !== -1 ? r.filter(function (x) { return x !== k; }) : r.concat([k]);
  if (!e.reponses[qid].length) delete e.reponses[qid];
  return e;
}
function nbSansReponse(ex) { return ex.ids.filter(function (qid) { return !(ex.reponses[qid] && ex.reponses[qid].length); }).length; }

// Fin de l'examen : chaque question devient un résultat { qid, picked, ok } (même forme que les séances).
// ok = exactement l'ensemble des bonnes réponses. Les réponses cochées sont rangées dans l'ordre des choix.
function finaliserExamen(ex, questionsParId, maintenant, motif) {
  return { id: ex.id, type: ex.type, debut: ex.debut, fin: maintenant, motif: motif,
    results: ex.ids.map(function (qid) {
      var q = questionsParId[qid], coches = (ex.reponses && ex.reponses[qid]) || [];
      var picked = q ? q.choices.map(function (c) { return c.k; }).filter(function (k) { return coches.indexOf(k) !== -1; }) : coches.slice();
      return { qid: qid, picked: picked, ok: !!q && picked.length > 0 && memeEnsemble(picked, q.correct) };
    }) };
}

// ---------- notation ----------
function etatResultat(r) { return !r.picked || !r.picked.length ? 'vide' : r.ok ? 'juste' : 'fausse'; }
function comptesExamen(results) {
  var c = { justes: 0, fausses: 0, vides: 0 };
  results.forEach(function (r) { var e = etatResultat(r); if (e === 'juste') c.justes++; else if (e === 'fausse') c.fausses++; else c.vides++; });
  return c;
}
// Note estimée sur 20, sans écrêtage (elle peut être négative), arrondie à une décimale.
function noteSur20(c, n, bareme) {
  var x = (c.justes * bareme.bonne - c.fausses * bareme.fausse - c.vides * bareme.vide) / (n * bareme.bonne) * 20;
  var s = x < 0 ? -1 : 1;
  return s * Math.round(Math.abs(x) * 10 + 1e-9) / 10;
}
function nombreFr(x) { return (x < 0 ? '−' : '') + String(Math.abs(x)).replace('.', ','); }
function texteNote(note) { return nombreFr(note) + ' / 20'; }
function texteFormule(bareme, n) {
  return '(justes × ' + nombreFr(bareme.bonne) + ' − fausses × ' + nombreFr(bareme.fausse) + ' − sans réponse × ' + nombreFr(bareme.vide) +
    ') ÷ (' + n + ' × ' + nombreFr(bareme.bonne) + ') × 20';
}
function filtrerResultats(results, filtre) {
  return results.map(function (r, i) { return { r: r, i: i }; })
    .filter(function (x) { return filtre === 'toutes' || etatResultat(x.r) === { justes: 'juste', fausses: 'fausse', vides: 'vide' }[filtre]; });
}
function dureeTexte(ms) {
  var s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

// ---------- correction détaillée : 4 états, jamais la couleur seule ----------
// trouvee = bonne réponse cochée ; oubliee = bonne réponse non cochée ; atort = mauvaise réponse cochée ; neutre = mauvaise non cochée.
function etatsChoix(q, picked) {
  var p = picked || [];
  return q.choices.map(function (c) {
    var bonne = q.correct.indexOf(c.k) !== -1, cochee = p.indexOf(c.k) !== -1;
    return { k: c.k, text: c.text, etat: bonne ? (cochee ? 'trouvee' : 'oubliee') : (cochee ? 'atort' : 'neutre') };
  });
}
function resumeCorrection(q, picked) {
  var e = etatsChoix(q, picked), n = function (x) { return e.filter(function (c) { return c.etat === x; }).length; };
  var trouvees = n('trouvee'), oubliees = n('oubliee'), atort = n('atort'), parts = [];
  parts.push(trouvees + ' ' + (trouvees > 1 ? 'trouvées' : 'trouvée') + ' sur ' + q.correct.length);
  if (oubliees) parts.push(oubliees + ' ' + (oubliees > 1 ? 'oubliées' : 'oubliée'));
  if (atort) parts.push(atort + ' ' + (atort > 1 ? 'cochées' : 'cochée') + ' à tort');
  return parts.join(', ');
}

if (typeof module !== 'undefined') module.exports = {
  EXAMEN_PART_GAV: EXAMEN_PART_GAV, TYPES_EXAMEN: TYPES_EXAMEN, memeEnsemble: memeEnsemble, melanger: melanger, questionsUniques: questionsUniques,
  quotasThemes: quotasThemes, tirerExamen: tirerExamen, historiqueReponses: historiqueReponses, bilanQuestions: bilanQuestions, tirerExamenDifficile: tirerExamenDifficile, nouvelExamen: nouvelExamen, avancerExamen: avancerExamen, tempsRestants: tempsRestants,
  allerA: allerA, ouvrirGrille: ouvrirGrille, basculerReponse: basculerReponse, nbSansReponse: nbSansReponse, finaliserExamen: finaliserExamen,
  etatResultat: etatResultat, comptesExamen: comptesExamen, noteSur20: noteSur20, nombreFr: nombreFr, texteNote: texteNote, texteFormule: texteFormule,
  filtrerResultats: filtrerResultats, dureeTexte: dureeTexte, etatsChoix: etatsChoix, resumeCorrection: resumeCorrection
};
