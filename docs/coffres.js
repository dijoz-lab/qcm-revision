/* ===== Coffres (un jeu, pas une prédiction) : logique pure =====
   Script classique (sans import/export). L'état des coffres se CALCULE depuis l'historique des séances :
   rien n'est enregistré, sauf « animation d'ouverture déjà vue » (dans qcm-pj-reglages, voir reglages.js).
   Contenus écrits dans le code (décision de Diana : le dépôt est public et elle le sait), du moins apprécié au plus apprécié. */
var COFFRES = [
  { n: 1, contenu: 'Château-Thierry' },
  { n: 2, contenu: 'Bordeaux' },
  { n: 3, contenu: 'Lannion' },
  { n: 4, contenu: 'Capitaine de bords de Loire' }
];
var CLES_PAR_COFFRE = 5;

// Coffre gagné par une séance selon son pourcentage (arrondi comme à l'affichage) :
// moins de 50 % → 1 ; 50 à 64 % → 2 ; 65 à 79 % → 3 ; 80 % et plus → 4.
function coffreDeSeance(pct) { return pct < 50 ? 1 : pct < 65 ? 2 : pct < 80 ? 3 : 4; }

// Une clé par séance TERMINÉE (les séances interrompues ne comptent pas ; les examens blancs sont à part et ne comptent pas).
function etatCoffres(sessions) {
  var cles = COFFRES.map(function () { return 0; });
  (sessions || []).forEach(function (s) {
    if (!s || s.partial || !s.results || !s.results.length) return;
    var pct = Math.round(100 * s.results.filter(function (r) { return r.ok; }).length / s.results.length);
    cles[coffreDeSeance(pct) - 1]++;
  });
  return COFFRES.map(function (c, i) {
    return { n: c.n, contenu: c.contenu, cles: cles[i], affichees: Math.min(cles[i], CLES_PAR_COFFRE), ouvert: cles[i] >= CLES_PAR_COFFRE };
  });
}

if (typeof module !== 'undefined') module.exports = { COFFRES: COFFRES, CLES_PAR_COFFRE: CLES_PAR_COFFRE, coffreDeSeance: coffreDeSeance, etatCoffres: etatCoffres };
