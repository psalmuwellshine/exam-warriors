(function () {
  'use strict';
  var COURSES = ['MLS206', 'MLS208', 'MBH222', 'PIO214', 'PIO216', 'ANA204', 'ANA206', 'GST212'];
  var SUBJ = { MLS: 'Medical Laboratory Science', MBH: 'Biochemistry', PIO: 'Physiology', ANA: 'Anatomy', GST: 'General Studies' };
  var KINDS = { notes: 'Notes', pq: 'Past questions', slides: 'Slides', other: 'Other' };
  var VIEWS = ['library', 'quizzes', 'leaderboard'];

  var S = { loaded: false, failed: false, materials: [], quizzes: [], board: [], total: 0, me: null, notice: '' };
  var fCourse = 'all', fKind = 'all', fQ = '', openNotes = {}, run = null;
  var deviceId = getDevice();

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(t) { try { return new Date(t).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function subj(c) { return SUBJ[(c || '').slice(0, 3)] || ''; }
  function rankTitle(p) { return p >= 250 ? 'Champion' : p >= 100 ? 'Captain' : p >= 40 ? 'Fighter' : 'Recruit'; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2400); }

  function getDevice() {
    try {
      var d = localStorage.getItem('ew-device');
      if (d && /^[a-z0-9]{16,40}$/.test(d)) return d;
      var a = new Uint8Array(12); crypto.getRandomValues(a);
      d = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('ew-device', d);
      return d;
    } catch (e) { return ''; }
  }

  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var err = new Error(j.error || 'Request failed'); err.status = r.status; throw err; }
        return j;
      });
    });
  }

  /* ---------- data ---------- */
  function refresh(quiet) {
    return api('GET', '/api/state' + (deviceId ? '?device=' + deviceId : '')).then(function (d) {
      S.loaded = true; S.failed = false;
      S.materials = d.materials || []; S.quizzes = d.quizzes || []; S.board = d.board || [];
      S.total = d.totalWarriors || 0; S.me = d.me; S.notice = d.notice || '';
      renderStatic(); renderLibrary(); renderBoard();
      if (!run) renderQuizzes();
    }).catch(function () {
      if (!S.loaded) { S.failed = true; renderLibrary(); renderQuizzes(); renderBoard(); }
      else if (!quiet) toast('Could not refresh. Check your connection.');
    });
  }

  /* ---------- static bits ---------- */
  function buildFilters() {
    var k = '<option value="all">All types</option>';
    Object.keys(KINDS).forEach(function (x) { k += '<option value="' + x + '">' + KINDS[x] + '</option>'; });
    $('#f-kind').innerHTML = k;
    renderChips();
  }
  function allCourses() {
    var list = COURSES.slice();
    S.materials.concat(S.quizzes).forEach(function (m) { if (m.course && list.indexOf(m.course) < 0) list.push(m.course); });
    return list;
  }
  function renderChips() {
    var c = '<button class="chip" data-c="all" aria-pressed="' + (fCourse === 'all') + '">All</button>';
    allCourses().forEach(function (x) { c += '<button class="chip" data-c="' + esc(x) + '" aria-pressed="' + (fCourse === x) + '">' + esc(x) + '</button>'; });
    $('#chips').innerHTML = c;
  }
  function renderStatic() {
    $('#stats').innerHTML = '<div><b>' + S.materials.length + '</b><span>Materials</span></div><div><b>' + S.quizzes.length + '</b><span>Quizzes</span></div><div><b>' + S.total + '</b><span>Warriors</span></div>';
    if (S.notice) { $('#notice-text').textContent = S.notice; $('#notice').hidden = false; } else { $('#notice').hidden = true; }
    renderChips();
  }
  function box(title, text) { return '<div class="empty"><b>' + esc(title) + '</b>' + esc(text) + '</div>'; }

  /* ---------- library ---------- */
  function renderLibrary() {
    var el = $('#lib-list');
    if (S.failed) { el.innerHTML = box('Could not load', 'Check your connection and refresh the page.'); return; }
    if (!S.loaded) { el.innerHTML = box('Loading the library', 'Notes, past questions and slides will appear here.'); return; }
    var list = S.materials.filter(function (m) {
      if (fCourse !== 'all' && m.course !== fCourse) return false;
      if (fKind !== 'all' && m.kind !== fKind) return false;
      if (fQ && (m.title || '').toLowerCase().indexOf(fQ) < 0) return false;
      return true;
    });
    if (!list.length) { el.innerHTML = S.materials.length ? box('No match', 'Try another course or clear the search.') : box('Nothing filed yet', 'Study materials will appear here soon.'); return; }
    el.innerHTML = list.map(function (m) {
      var acts = '';
      if (m.note) acts += '<button class="btn ghost" data-act="toggle" data-id="' + esc(m.id) + '">' + (openNotes[m.id] ? 'Hide note' : 'Read note') + '</button>';
      if (m.fileId) acts += '<a class="btn" href="/files/' + esc(m.fileId) + '" target="_blank" rel="noopener">Open file</a>';
      if (safeUrl(m.link)) acts += '<a class="btn" href="' + esc(m.link) + '" target="_blank" rel="noopener noreferrer">Open link</a>';
      return '<article class="item"><span class="code" title="' + esc(subj(m.course)) + '">' + esc(m.course) + '</span>' +
        '<div style="min-width:0"><h3>' + esc(m.title) + '</h3><p class="meta">' + esc(KINDS[m.kind] || 'Other') + ' &middot; ' + esc(fmtDate(m.addedAt)) + (m.fileName ? ' &middot; ' + esc(m.fileName) : '') + '</p></div>' +
        '<div class="acts">' + acts + '</div>' +
        (m.note && openNotes[m.id] ? '<div class="note">' + esc(m.note) + '</div>' : '') + '</article>';
    }).join('');
  }

  /* ---------- quizzes ---------- */
  function renderQuizzes() {
    var el = $('#quiz-zone');
    if (run) { el.innerHTML = runHtml(); return; }
    if (S.failed) { el.innerHTML = box('Could not load', 'Check your connection and refresh the page.'); return; }
    if (!S.loaded) { el.innerHTML = box('Loading quizzes', 'Practice quizzes will appear here.'); return; }
    if (!S.quizzes.length) { el.innerHTML = box('No quizzes yet', 'Practice quizzes will appear here soon.'); return; }
    var best = (S.me && S.me.best) || {};
    el.innerHTML = '<div class="list">' + S.quizzes.map(function (q) {
      var b = best[q.id], n = q.questions.length;
      return '<article class="item"><span class="code" title="' + esc(subj(q.course)) + '">' + esc(q.course) + '</span>' +
        '<div style="min-width:0"><h3>' + esc(q.title) + '</h3><p class="meta">' + n + ' question' + (n === 1 ? '' : 's') + (b ? ' &middot; your best ' + b.correct + '/' + b.total : '') + '</p></div>' +
        '<div class="acts"><button class="btn" data-act="start" data-id="' + esc(q.id) + '">' + (b ? 'Try again' : 'Start quiz') + '</button></div></article>';
    }).join('') + '</div>';
  }

  function runHtml() {
    var q = run.quiz, tot = q.questions.length;
    if (run.done) {
      var pct = Math.round(run.correct / tot * 100);
      var head = pct >= 80 ? 'Strong run.' : pct >= 50 ? 'Solid. Review the misses and go again.' : 'Keep going. Read the explanations and retry.';
      var msg = { saving: 'Saving your score...', saved: 'Score saved to the leaderboard.', failed: 'Your score could not be saved. Check your connection and try again.' }[run.save] || '';
      var wrong = run.log.filter(function (l) { return l.k !== q.questions[l.i].a; });
      var rev = wrong.length ? '<ul class="review">' + wrong.map(function (l) {
        var c = q.questions[l.i];
        return '<li><div>' + esc(c.q) + '</div><div class="ca">Answer: ' + 'ABCD'[c.a] + '. ' + esc(c.o[c.a]) + '</div>' + (c.e ? '<div class="meta">' + esc(c.e) + '</div>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="meta">No misses. Clean sweep.</p>';
      var nick = (run.save === 'saved' && !(S.me && S.me.nick)) ? '<form id="nick-run" class="nickform"><input type="text" maxlength="24" placeholder="Name for the leaderboard" aria-label="Leaderboard name"><button class="btn" type="submit">Save name</button></form>' : '';
      return '<div class="run"><div class="qn">' + esc(q.title) + '</div><div class="score">' + pct + '%<small>' + run.correct + '/' + tot + '</small></div>' +
        '<p style="margin:0;font-weight:600">' + head + '</p><p class="meta" style="margin-top:4px">' + msg + '</p>' + nick + rev +
        '<div class="runbar"><button class="btn ghost" data-act="quit">All quizzes</button><button class="btn" data-act="start" data-id="' + esc(q.id) + '">Try again</button></div></div>';
    }
    var cur = q.questions[run.i], picked = run.picked !== null;
    var opts = cur.o.map(function (t, k) {
      var cls = picked ? (k === cur.a ? 'ok' : (k === run.picked ? 'no' : '')) : '';
      return '<button class="opt ' + cls + '" data-act="pick" data-k="' + k + '"' + (picked ? ' disabled' : '') + '><span class="l">' + 'ABCD'[k] + '</span><span>' + esc(t) + '</span></button>';
    }).join('');
    var fb = picked ? '<div class="fb"><b>' + (run.picked === cur.a ? 'Correct.' : 'Not quite. The answer is ' + 'ABCD'[cur.a] + '.') + '</b>' + (cur.e ? '<p>' + esc(cur.e) + '</p>' : '') + '</div>' : '';
    var done = run.i + (picked ? 1 : 0);
    return '<div class="run"><div class="qn">' + esc(q.title) + ' &middot; Question ' + (run.i + 1) + ' of ' + tot + '</div>' +
      '<div class="prog"><i style="width:' + Math.round(done / tot * 100) + '%"></i></div><p class="q">' + esc(cur.q) + '</p><div class="opts">' + opts + '</div>' + fb +
      '<div class="runbar"><button class="btn ghost" data-act="quit">Quit quiz</button>' + (picked ? '<button class="btn" data-act="next">' + (run.i === tot - 1 ? 'Finish' : 'Next question') + '</button>' : '<span></span>') + '</div></div>';
  }

  function finish() {
    var r = run;
    r.done = true; r.save = 'saving';
    renderQuizzes();
    var answers = r.quiz.questions.map(function () { return -1; });
    r.log.forEach(function (l) { answers[l.i] = l.k; });
    api('POST', '/api/scores', { deviceId: deviceId, quizId: r.quiz.id, answers: answers }).then(function () {
      r.save = 'saved';
      return refresh(true);
    }).catch(function () { r.save = 'failed'; }).then(function () { if (run === r) renderQuizzes(); });
  }

  /* ---------- leaderboard ---------- */
  function renderBoard() {
    var el = $('#board-zone');
    if (S.failed) { el.innerHTML = box('Could not load', 'Check your connection and refresh the page.'); return; }
    if (!S.loaded) { el.innerHTML = box('Loading the leaderboard', 'Top scorers will appear here.'); return; }
    var typed = null, a = document.activeElement;
    if (a && a.id === 'nick-board') typed = a.value;
    var me = S.me, pts = me ? me.points : 0;
    var card = '<div class="grid3">' +
      '<div class="tile rank"><b>' + rankTitle(pts) + '</b><span>Your rank title</span></div>' +
      '<div class="tile"><b>' + pts + '</b><span>Your points</span></div>' +
      '<div class="tile"><b>' + (me && me.rank ? '#' + me.rank : '-') + '</b><span>Position</span></div></div>' +
      '<form id="nick-board-form" class="nickform" style="margin:-4px 0 22px"><input type="text" id="nick-board" maxlength="24" placeholder="Your name on the board" aria-label="Your name on the leaderboard" value="' + esc(me ? me.nick : '') + '"><button class="btn" type="submit">' + (me && me.nick ? 'Update name' : 'Save name') + '</button></form>';
    var rows = S.board.length ? '<ol class="board">' + S.board.map(function (e) {
      return '<li class="row' + (e.me ? ' me' : '') + (e.rank <= 3 ? ' top' : '') + '"><span class="pos">' + e.rank + '</span>' +
        '<div class="who"><b>' + esc(e.nick || 'Anonymous warrior') + (e.me ? ' (you)' : '') + '</b><span>' + rankTitle(e.points) + ' &middot; ' + e.done + (e.done === 1 ? ' quiz' : ' quizzes') + '</span></div>' +
        '<div class="pts">' + e.points + '<small>pts</small></div></li>';
    }).join('') + '</ol>' : box('No scores yet', 'Finish a quiz to put the first score on the board.');
    el.innerHTML = card + rows;
    if (typed !== null) { var nb = $('#nick-board'); if (nb) { nb.value = typed; nb.focus(); } }
  }

  function saveNick(nick) {
    nick = (nick || '').trim();
    if (!nick) { toast('Type a name first.'); return Promise.resolve(); }
    return api('POST', '/api/nick', { deviceId: deviceId, nick: nick }).then(function () { toast('Name saved'); return refresh(true); })
      .catch(function (e) { toast(e.message || 'Could not save the name.'); });
  }

  /* ---------- events ---------- */
  function setView(v) {
    if (VIEWS.indexOf(v) < 0) v = 'library';
    VIEWS.forEach(function (n) { $('#v-' + n).hidden = n !== v; $('#t-' + n).setAttribute('aria-selected', String(n === v)); });
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* ignore */ }
    if (v === 'leaderboard' && S.loaded) refresh(true);
  }
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('#chips .chip');
    if (chip) { fCourse = chip.dataset.c; renderChips(); renderLibrary(); return; }
    var tab = e.target.closest('.tab');
    if (tab) { setView(tab.dataset.v); return; }
    var t = e.target.closest('[data-act]'); if (!t) return;
    var a = t.dataset.act, id = t.dataset.id;
    if (a === 'toggle') { openNotes[id] = !openNotes[id]; renderLibrary(); return; }
    if (a === 'start') {
      var q = S.quizzes.filter(function (x) { return x.id === id; })[0]; if (!q) return;
      run = { quiz: q, i: 0, picked: null, correct: 0, log: [], done: false, save: '' };
      setView('quizzes'); renderQuizzes(); window.scrollTo(0, 0); return;
    }
    if (a === 'pick' && run && run.picked === null) {
      var k = +t.dataset.k; run.picked = k;
      if (k === run.quiz.questions[run.i].a) run.correct++;
      run.log.push({ i: run.i, k: k }); renderQuizzes(); return;
    }
    if (a === 'next' && run) {
      if (run.i === run.quiz.questions.length - 1) finish(); else { run.i++; run.picked = null; renderQuizzes(); }
      return;
    }
    if (a === 'quit') { run = null; renderQuizzes(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'nick-board-form' || f.id === 'nick-run') {
      e.preventDefault();
      saveNick(f.querySelector('input').value).then(function () { if (run) renderQuizzes(); });
    }
  });
  $('#f-kind').addEventListener('change', function (e) { fKind = e.target.value; renderLibrary(); });
  $('#f-q').addEventListener('input', function (e) { fQ = e.target.value.trim().toLowerCase(); renderLibrary(); });
  document.querySelectorAll('.share').forEach(function (b) { b.addEventListener('click', shareSite); });
  function shareSite() {
    var data = { title: 'Exam Warriors', text: 'Give The Best, Take The Best. Study notes and quizzes for NDU students.', url: location.href.split('#')[0] };
    if (navigator.share) navigator.share(data).catch(function () { /* cancelled */ });
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data.url).then(function () { toast('Link copied'); }, function () { toast(data.url); });
    else toast(data.url);
  }
  window.addEventListener('hashchange', function () { setView(location.hash.slice(1)); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !run) refresh(true); });
  setInterval(function () { if (!document.hidden && !run) refresh(true); }, 60000);

  buildFilters(); renderLibrary(); renderQuizzes(); renderBoard();
  setView(location.hash.slice(1));
  refresh();
})();
// Check if the user is logged in
const loggedInUser = localStorage.getItem('examWarriorUser');
const authBtn = document.getElementById('nav-auth-btn');
const logoutBtn = document.getElementById('nav-logout-btn');

if (loggedInUser) {
  const user = JSON.parse(loggedInUser);
  if (authBtn) {
    authBtn.textContent = 'Hi, ' + user.username;
    authBtn.href = '#'; 
    authBtn.style.color = '#fff';
  }
  if (logoutBtn) {
    logoutBtn.style.display = 'block';
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('examWarriorUser');
    window.location.reload(); 
  });
}
