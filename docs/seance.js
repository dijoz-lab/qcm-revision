/* ===== Séances : tirage des questions et correction d'une réponse ===== */
var SESSION_SIZE = 15, COOLDOWN = 3, REWORK_SHARE = 1 / 3;

function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; }); }

// ---------- statistiques par question (calculées depuis l'historique) ----------
function statsMap(sessions) {
  var m = {};
  sessions.forEach(function (s, idx) {
    (s.results || []).forEach(function (r) {
      var x = m[r.qid] || (m[r.qid] = { seen: 0, lastSeq: -1, lastOk: true, misses: 0 });
      x.seen++; x.lastSeq = idx; x.lastOk = r.ok; if (!r.ok) x.misses++;
    });
  });
  return m;
}

// ---------- tirage d'une séance ----------
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function buildSession(questions, sessions) {
  var pool = questions, size = Math.min(SESSION_SIZE, pool.length);
  if (!size) return [];
  var st = statsMap(sessions), nS = sessions.length;
  var items = pool.map(function (q) {
    var s = st[q.id] || { seen: 0, lastSeq: -1, lastOk: true, misses: 0 };
    return { q: q, seen: s.seen, lastSeq: s.lastSeq, lastOk: s.lastOk, misses: s.misses, rnd: Math.random() };
  });
  // Le délai de repos s'adapte à la taille de la banque : avec peu de questions, un long repos rendrait les séances impossibles.
  var cool = Math.max(0, Math.min(COOLDOWN, Math.floor((pool.length - size) / size)));
  var eligible = items.filter(function (i) { return i.seen === 0 || (nS - i.lastSeq) > cool; });
  if (eligible.length < size) {
    var rest = items.filter(function (i) { return eligible.indexOf(i) === -1; }).sort(function (a, b) { return a.lastSeq - b.lastSeq || a.rnd - b.rnd; });
    eligible = eligible.concat(rest.slice(0, size - eligible.length));
  }
  var themes = [], count = {};
  pool.forEach(function (q) { if (!count[q.theme]) { count[q.theme] = 0; themes.push(q.theme); } count[q.theme]++; });
  var quota = {}, sum = 0, raw = themes.map(function (t) { var x = size * count[t] / pool.length; quota[t] = Math.floor(x); sum += quota[t]; return { t: t, f: x - Math.floor(x) }; });
  raw.sort(function (a, b) { return b.f - a.f; }).forEach(function (r) { if (sum < size) { quota[r.t]++; sum++; } });
  function avail(t) { return eligible.filter(function (i) { return i.q.theme === t; }).length; }
  var extra = 0;
  themes.forEach(function (t) { var av = avail(t); if (quota[t] > av) { extra += quota[t] - av; quota[t] = av; } });
  themes.slice().sort(function (a, b) { return count[b] - count[a]; }).forEach(function (t) {
    var room = avail(t) - quota[t], add = Math.min(room, extra); quota[t] += add; extra -= add;
  });
  var picked = [];
  themes.forEach(function (t) {
    var mine = eligible.filter(function (i) { return i.q.theme === t; });
    var wanted = Math.round(quota[t] * REWORK_SHARE);
    var rework = mine.filter(function (i) { return !i.lastOk; }).sort(function (a, b) { return b.misses - a.misses || a.lastSeq - b.lastSeq || a.rnd - b.rnd; }).slice(0, wanted);
    var others = mine.filter(function (i) { return rework.indexOf(i) === -1; }).sort(function (a, b) { return a.seen - b.seen || a.lastSeq - b.lastSeq || a.rnd - b.rnd; });
    picked = picked.concat(rework, others.slice(0, quota[t] - rework.length));
  });
  return shuffle(picked).map(function (i) { return i.q.id; });
}
if (typeof module !== 'undefined') module.exports = { SESSION_SIZE: SESSION_SIZE, COOLDOWN: COOLDOWN, REWORK_SHARE: REWORK_SHARE, sameSet: sameSet, statsMap: statsMap, shuffle: shuffle, buildSession: buildSession };
