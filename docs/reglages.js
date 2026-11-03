/* ===== Réglages personnels : clé séparée « qcm-pj-reglages », HORS sauvegarde =====
   Le format v1 (clé qcm-pj-v1) n'est pas touché : après une restauration, l'objectif revient à sa valeur par défaut. */
var REGLAGES_KEY = 'qcm-pj-reglages';
var OBJECTIF_DEFAUT = 80;

function objectifValide(n) { return typeof n === 'number' && Math.floor(n) === n && n >= 1 && n <= 100; }
function lireReglages() {
  try {
    var t = localStorage.getItem(REGLAGES_KEY);
    if (t) { var o = JSON.parse(t); if (o && objectifValide(o.objectif)) return { objectif: o.objectif }; }
  } catch (e) {}
  return { objectif: OBJECTIF_DEFAUT };
}
// Tous les réglages enregistrés (objet vide si rien ou illisible). Chaque écriture FUSIONNE :
// régler l'objectif ne peut jamais effacer le barème, et inversement.
function lireToutReglages() {
  try {
    var t = localStorage.getItem(REGLAGES_KEY);
    if (t) { var o = JSON.parse(t); if (o && typeof o === 'object' && !Array.isArray(o)) return o; }
  } catch (e) {}
  return {};
}
function ecrireToutReglages(o) { try { localStorage.setItem(REGLAGES_KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
// Renvoie false (et n'écrit rien) si la valeur n'est pas un pourcentage entier entre 1 et 100.
function ecrireObjectif(n) {
  if (!objectifValide(n)) return false;
  var o = lireToutReglages(); o.objectif = n;
  return ecrireToutReglages(o);
}

// Écart à l'objectif en pourcentage (passe 6) : « il te manque 7 % pour atteindre ton objectif de 80 % ».
function messageManque(pct, objectif) {
  var e = ecartObjectif(pct, objectif);
  return e ? 'il te manque ' + e + ' % pour atteindre ton objectif de ' + objectif + ' %' : 'ton objectif de ' + objectif + ' % est atteint';
}

// ---------- Barème de l'examen blanc (estimation : le vrai barème est inconnu) ----------
var BAREME_DEFAUT = { bonne: 1, fausse: 0.5, vide: 0 };
function nombreValide(x) { return typeof x === 'number' && isFinite(x) && x >= 0 && x <= 100; }
function baremeValide(b) { return !!b && nombreValide(b.bonne) && b.bonne > 0 && nombreValide(b.fausse) && nombreValide(b.vide); }
function lireBareme() {
  var b = lireToutReglages().bareme;
  return baremeValide(b) ? { bonne: b.bonne, fausse: b.fausse, vide: b.vide } : { bonne: BAREME_DEFAUT.bonne, fausse: BAREME_DEFAUT.fausse, vide: BAREME_DEFAUT.vide };
}
// Renvoie false (et n'écrit rien) si une valeur est invalide (points d'une bonne réponse > 0 ; autres ≥ 0 ; tous ≤ 100).
function ecrireBareme(b) {
  if (!baremeValide(b)) return false;
  var o = lireToutReglages(); o.bareme = { bonne: b.bonne, fausse: b.fausse, vide: b.vide };
  return ecrireToutReglages(o);
}

// Écart en points entre un pourcentage et l'objectif (0 si l'objectif est atteint).
function ecartObjectif(pct, objectif) { return Math.max(0, objectif - pct); }
function messageObjectif(pct, objectif) {
  var e = ecartObjectif(pct, objectif);
  if (!e) return 'Objectif atteint (' + objectif + ' %).';
  return 'Plus que ' + e + (e > 1 ? ' points' : ' point') + ' avant ton objectif (' + objectif + ' %).';
}
// ---------- Coffres : seule l'animation d'ouverture déjà vue est mémorisée (l'état se calcule depuis l'historique) ----------
function lireCoffresVus() {
  var v = lireToutReglages().coffresVus;
  return Array.isArray(v) ? v.filter(function (n, i) { return typeof n === 'number' && n >= 1 && n <= 4 && Math.floor(n) === n && v.indexOf(n) === i; }) : [];
}
function ecrireCoffreVu(n) {
  if (typeof n !== 'number' || n < 1 || n > 4 || Math.floor(n) !== n) return false;
  var o = lireToutReglages(), vus = lireCoffresVus();
  if (vus.indexOf(n) === -1) vus.push(n);
  o.coffresVus = vus.sort();
  return ecrireToutReglages(o);
}

if (typeof module !== 'undefined') module.exports = { lireCoffresVus: lireCoffresVus, ecrireCoffreVu: ecrireCoffreVu, REGLAGES_KEY: REGLAGES_KEY, OBJECTIF_DEFAUT: OBJECTIF_DEFAUT, objectifValide: objectifValide, lireReglages: lireReglages, ecrireObjectif: ecrireObjectif, ecartObjectif: ecartObjectif, messageObjectif: messageObjectif,
  lireToutReglages: lireToutReglages, messageManque: messageManque, BAREME_DEFAUT: BAREME_DEFAUT, baremeValide: baremeValide, lireBareme: lireBareme, ecrireBareme: ecrireBareme };
