// Contrastes de texte (règle WCAG : au moins 4,5:1), calculés à partir des couleurs écrites dans docs/style.css.
// Les fonds translucides sont mélangés au fond sur lequel ils sont posés, comme à l'écran.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'docs', 'style.css'), 'utf8');
const ROOT = CSS.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
function variable(nom) {
  const m = ROOT.match(new RegExp('--' + nom + ':\\s*(#[0-9A-Fa-f]{6})'));
  assert.ok(m, 'couleur --' + nom + ' introuvable dans :root');
  return hex(m[1]);
}
function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
function rgba(r, g, b, a, fond) { return [r, g, b].map(function (v, i) { return v * a + fond[i] * (1 - a); }); }
function melange(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }
function luminance(c) {
  const s = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}
function ratio(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

const INK = variable('ink'), MUTED = variable('muted'), ACCENT = variable('accent'), OR = variable('or');
const OK = variable('ok'), KO = variable('ko'), WARN = variable('warn'), ONACC = variable('on-accent');
const HAUT = variable('fond-haut'), FOND = variable('fond'), BORD = variable('fond-bord');

// Haut de l'écran : le centre du dégradé est décalé au-dessus de l'écran ; on lit ce décalage dans la règle du fond.
const g = CSS.match(/radial-gradient\((\d+)% (\d+)% at 50% (-?\d+)%, var\(--fond-haut\) 0%, var\(--fond\) (\d+)%/);
assert.ok(g, 'règle du fond introuvable');
const tHaut = Math.min(1, (-parseInt(g[3], 10) / parseInt(g[2], 10)) / (parseInt(g[4], 10) / 100));
const HAUT_ECRAN = melange(HAUT, FOND, tHaut);
// Cartes : haut du dégradé de carte (le plus clair) posé sur le haut de l'écran (cas le plus défavorable) et sur le fond.
const CARTE_HAUT_ECRAN = rgba(36, 52, 100, 0.75, HAUT_ECRAN), CARTE = rgba(36, 52, 100, 0.75, FOND);
const PASTILLE = rgba(232, 196, 104, 0.08, HAUT_ECRAN), ONGLETS = rgba(14, 22, 48, 0.88, FOND), ONGLET_ACTIF = rgba(143, 178, 255, 0.10, ONGLETS);

const PAIRES = [
  ['libellé de l’en-tête (#9FB0D6) sur le haut de l’écran', MUTED, HAUT_ECRAN],
  ['« PRÊT. » (#EAF0FF) sur le haut de l’écran', INK, HAUT_ECRAN],
  ['pastille « OBJECTIF » (#E8C468) sur son fond doré', OR, PASTILLE],
  ['texte (#EAF0FF) sur carte', INK, CARTE],
  ['texte secondaire (#9FB0D6) sur carte, haut de l’écran', MUTED, CARTE_HAUT_ECRAN],
  ['texte secondaire (#9FB0D6) sur le fond #0F1A3D', MUTED, FOND],
  ['texte secondaire (#9FB0D6) sur le bas du fond #070B18', MUTED, BORD],
  ['grand pourcentage, bas du dégradé (#A9C0FF) sur le fond', hex('#A9C0FF'), FOND],
  ['texte du bouton (#0B1226) sur #A9C0FF (haut)', ONACC, hex('#A9C0FF')],
  ['texte du bouton (#0B1226) sur #5E86F0 (bas)', ONACC, hex('#5E86F0')],
  ['onglet inactif (#9FB0D6) sur la barre d’onglets', MUTED, ONGLETS],
  ['onglet actif (#8FB2FF) sur son fond', ACCENT, ONGLET_ACTIF],
  ['juste (#7FD09A) sur carte', OK, CARTE],
  ['faux (#F08A7E) sur carte', KO, CARTE],
  ['alerte (#F2C26B) sur son fond', WARN, rgba(242, 194, 107, 0.12, FOND)],
  ['juste (#7FD09A) sur son fond vert', OK, rgba(127, 208, 154, 0.12, FOND)],
  ['faux (#F08A7E) sur son fond corail', KO, rgba(240, 138, 126, 0.12, FOND)],
  ['lien et accent (#8FB2FF) sur carte', ACCENT, CARTE],
  ['grand pourcentage, bas du dégradé (#A9C0FF) sur le centre de son halo', hex('#A9C0FF'), rgba(143, 178, 255, 0.28, FOND)],
  ['objectif en or (#E8C468) sur carte (Progression)', OR, CARTE],
  // Passe 6 : examens blancs.
  ['« Oubliée » orange (#FFB066) sur carte', variable('oublie'), CARTE],
  ['« Oubliée » orange (#FFB066) sur le détail du récapitulatif (#121C38)', variable('oublie'), hex('#121C38')],
  ['texte secondaire (#9FB0D6) sur le détail du récapitulatif (#121C38)', MUTED, hex('#121C38')],
  ['temps global en or (#E8C468) sur le fond', OR, FOND],
  ['« Trouvée » vert (#7FD09A) sur son fond vert', OK, rgba(127, 208, 154, 0.12, FOND)],
  ['« Cochée à tort » corail (#F08A7E) sur son fond corail', KO, rgba(240, 138, 126, 0.12, FOND)],
  ['« Minute dépassée » (#F2C26B) sur le fond', WARN, FOND]
];
// Le halo du grand pourcentage doit garder l'opacité utilisée ci-dessus.
test('le halo du grand pourcentage garde une opacité de .28 au plus', function () {
  const m = CSS.match(/\.chiffre-halo \{[^}]*rgba\(143, 178, 255, ([0-9.]+)\)/);
  assert.ok(m && parseFloat(m[1]) <= 0.28);
});
test('aucun filtre sur le grand pourcentage (rectangle clair sur Safari iOS)', function () {
  const regle = CSS.match(/\.chiffre-geant \{[^}]*\}/)[0];
  assert.doesNotMatch(regle, /filter/);
});

PAIRES.forEach(function (p) {
  test('contraste ≥ 4,5:1 : ' + p[0], function (t) {
    const r = ratio(p[1], p[2]);
    t.diagnostic(r.toFixed(2) + ':1');
    assert.ok(r >= 4.5, p[0] + ' : ' + r.toFixed(2) + ':1');
  });
});
