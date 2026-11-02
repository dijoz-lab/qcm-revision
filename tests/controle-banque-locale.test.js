// Contrôle LOCAL de la vraie banque (banque-privee/*.txt) : lecture seule, n'affiche que des nombres.
// Ne tourne que si le dossier existe (il n'est jamais publié). Aucun texte réel n'est affiché ni copié.
// Lancement depuis le dossier du projet : node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseQcm } = require('../docs/parser.js');

const DOSSIER = path.join(__dirname, '..', 'banque-privee');
const TOTAL_ATTENDU = 114;
const present = fs.existsSync(DOSSIER);

test('banque privée : chaque fichier commence par « Question 1 », total de ' + TOTAL_ATTENDU + ' questions', { skip: present ? false : 'banque-privee/ absent' }, function (t) {
  const fichiers = fs.readdirSync(DOSSIER).filter(function (f) { return /\.txt$/.test(f); }).sort();
  let total = 0, erreurs = 0, alertes = 0;
  fichiers.forEach(function (f) {
    const texte = fs.readFileSync(path.join(DOSSIER, f), 'utf8');
    const debutOk = texte.replace(/^﻿/, '').split(/\r?\n/).find(function (l) { return l.trim(); }).trim() === 'Question 1';
    const qs = parseQcm(texte).questions;
    const nErr = qs.filter(function (q) { return q.errors.length; }).length;
    const nAlerte = qs.filter(function (q) { return !q.errors.length && q.warnings.length; }).length;
    t.diagnostic(f + ' : ' + qs.length + ' questions, ' + nErr + ' avec erreur, ' + nAlerte + ' avec alerte, commence par « Question 1 » : ' + (debutOk ? 'oui' : 'NON'));
    assert.equal(debutOk, true, f + ' ne commence pas par « Question 1 »');
    total += qs.length; erreurs += nErr; alertes += nAlerte;
  });
  t.diagnostic('TOTAL : ' + fichiers.length + ' fichiers, ' + total + ' questions, ' + erreurs + ' avec erreur, ' + alertes + ' avec alerte');
  assert.equal(total, TOTAL_ATTENDU, 'total trouvé : ' + total + ' (attendu ' + TOTAL_ATTENDU + ')');
});
