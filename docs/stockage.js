/* ===== Stockage : état gardé dans le navigateur, sauvegarde et restauration ===== */
var KEY = 'qcm-pj-v1';

function fresh() { return { v: 1, questions: [], sessions: [], current: null, lastBackup: null }; }
function validState(o) {
  return !!(o && o.v === 1 && Array.isArray(o.questions) && Array.isArray(o.sessions) &&
    o.questions.every(function (q) { return q && q.id && q.text && Array.isArray(q.choices) && Array.isArray(q.correct); }));
}
function loadState() {
  try { var t = localStorage.getItem(KEY); if (t) { var o = JSON.parse(t); if (validState(o)) return o; } } catch (e) {}
  return fresh();
}
function storageWorks() {
  try { localStorage.setItem('qcm-pj-test', '1'); localStorage.removeItem('qcm-pj-test'); } catch (e) { return false; }
  return true;
}
function saveState(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { return false; } return true; }
function backupText(S) { return JSON.stringify(S); }
// Lit le texte d'une sauvegarde ; lève une erreur s'il n'est pas valide (rien n'est alors modifié).
function parseBackup(text) {
  var o = JSON.parse(text);
  if (!validState(o)) throw new Error('format');
  return o;
}
if (typeof module !== 'undefined') module.exports = { KEY: KEY, fresh: fresh, validState: validState, loadState: loadState, storageWorks: storageWorks, saveState: saveState, backupText: backupText, parseBackup: parseBackup };
