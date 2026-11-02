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
// Renvoie false (et n'écrit rien) si la valeur n'est pas un pourcentage entier entre 1 et 100.
function ecrireObjectif(n) {
  if (!objectifValide(n)) return false;
  try { localStorage.setItem(REGLAGES_KEY, JSON.stringify({ objectif: n })); return true; } catch (e) { return false; }
}

// Écart en points entre un pourcentage et l'objectif (0 si l'objectif est atteint).
function ecartObjectif(pct, objectif) { return Math.max(0, objectif - pct); }
function messageObjectif(pct, objectif) {
  var e = ecartObjectif(pct, objectif);
  if (!e) return 'Objectif atteint (' + objectif + ' %).';
  return 'Plus que ' + e + (e > 1 ? ' points' : ' point') + ' avant ton objectif (' + objectif + ' %).';
}
if (typeof module !== 'undefined') module.exports = { REGLAGES_KEY: REGLAGES_KEY, OBJECTIF_DEFAUT: OBJECTIF_DEFAUT, objectifValide: objectifValide, lireReglages: lireReglages, ecrireObjectif: ecrireObjectif, ecartObjectif: ecartObjectif, messageObjectif: messageObjectif };
