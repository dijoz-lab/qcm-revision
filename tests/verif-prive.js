// Vérification de confidentialité à lancer AVANT chaque commit et chaque envoi sur GitHub :
//   node tests/verif-prive.js
// 1. Git : aucun fichier privé n'est suivi ni prêt à l'être, et les règles du .gitignore s'appliquent.
// 2. Contenu : aucun fichier publiable ne contient une ligne longue des vrais textes de banque-privee/.
// N'affiche jamais de texte réel : seulement des noms de fichiers, des numéros et des nombres.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const BANQUE = path.join(RACINE, 'banque-privee');
const PRIVES = [/^banque-privee\//, /^exemple-qcm\.txt$/, /^sauvegarde-qcm-.*\.json$/, /^sauvegarde-qcm-.*\.txt$/, /^memoire\//, /^\.env(\..*)?$/, /^\.claude\/settings\.local\.json$/];
const A_IGNORER = ['banque-privee/gav-1.txt', 'exemple-qcm.txt', 'memoire/journal.md', '.env', 'sauvegarde-qcm-2026-01-01.json', 'sauvegarde-qcm-2026-01-01.txt'];
// Dossiers jamais publiés, sautés quand Git n'est pas disponible.
const DOSSIERS_EXCLUS = ['.git', 'banque-privee', 'memoire', '.tmp', 'node_modules', '.venv'];

const problemes = [];
let gitOk = true;

function git(args) { return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }

// ---------- 1. Git ----------
let publiables = null;
try {
  publiables = git(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  publiables.forEach(function (f) {
    if (PRIVES.some(function (re) { return re.test(f); })) problemes.push('Git : fichier privé suivi ou prêt à être ajouté : ' + f);
  });
  A_IGNORER.forEach(function (f) {
    try { git(['check-ignore', '-q', f]); } catch (e) { problemes.push('Git : ' + f + ' ne serait PAS ignoré par .gitignore'); }
  });
} catch (e) {
  gitOk = false;
}

// Sans Git : on parcourt le dossier en sautant les dossiers jamais publiés.
function parcourir(dossier, rel) {
  let out = [];
  fs.readdirSync(dossier, { withFileTypes: true }).forEach(function (d) {
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) { if (DOSSIERS_EXCLUS.indexOf(d.name) === -1) out = out.concat(parcourir(path.join(dossier, d.name), r)); }
    else out.push(r);
  });
  return out;
}
if (!publiables) publiables = parcourir(RACINE, '');

// ---------- 2. Contenu ----------
let nLignes = 0;
if (fs.existsSync(BANQUE)) {
  const reelles = new Set();
  fs.readdirSync(BANQUE).filter(function (f) { return /\.txt$/.test(f); }).forEach(function (f) {
    fs.readFileSync(path.join(BANQUE, f), 'utf8').split(/\r?\n/).forEach(function (l) {
      const t = l.trim();
      if (t.length >= 40 && !/^(Veuillez choisir|Votre réponse est)/.test(t)) reelles.add(t);
    });
  });
  nLignes = reelles.size;
  const lignes = Array.from(reelles);
  publiables.forEach(function (f) {
    const plein = path.join(RACINE, f);
    if (!fs.existsSync(plein) || fs.statSync(plein).size > 5 * 1024 * 1024) return;
    const contenu = fs.readFileSync(plein, 'utf8');
    const n = lignes.filter(function (l) { return contenu.includes(l); }).length;
    if (n) problemes.push('Contenu : ' + f + ' contient ' + n + ' ligne(s) des vrais textes de banque-privee/');
  });
}

// ---------- Bilan ----------
console.log('Fichiers publiables examinés : ' + publiables.length + (gitOk ? ' (liste donnée par Git)' : ' (parcours du dossier, Git indisponible)'));
console.log('Lignes réelles de référence : ' + nLignes + (nLignes ? '' : ' (banque-privee/ absent : contrôle du contenu impossible)'));
problemes.forEach(function (p) { console.log('PROBLÈME  ' + p); });
if (problemes.length) { console.log('\nRÉSULTAT : ' + problemes.length + ' problème(s). NE PAS faire de commit.'); process.exit(1); }
if (!gitOk) { console.log('\nRÉSULTAT : PARTIEL. Contenu OK, mais la partie Git n’a pas pu tourner ici. Lance ce script dans ton terminal.'); process.exit(2); }
console.log('\nRÉSULTAT : OK. Aucun fichier privé suivi par Git, aucun texte réel dans les fichiers publiables.');
