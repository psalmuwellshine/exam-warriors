(function () {
  'use strict';
  var COURSES = ['MLS206', 'MLS208', 'MBH222', 'PIO214', 'PIO216', 'ANA204', 'ANA206', 'GST212'];
  var KINDS = { notes: 'Notes', pq: 'Past questions', slides: 'Slides', other: 'Other' };
  var MAX_MB = 12;
  var EXT_TYPES = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    txt: 'text/plain', csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  var app = document.getElementById('app');
  var state = { materials: [], quizzes: [], scores: [], notice: '' };
  var confirmId = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s) { return document.querySelector(s); }
  function status(id, msg, ok) { var s = $(id); if (!s) return; s.textContent = msg || ''; s.className = 'status' + (msg ? (ok ? ' ok' : ' err') : ''); }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
          return j;
        });
      });
  }

  /* ---------- login ---------- */
  function showLogin(configured) {
    if (!configured) {
      app.innerHTML = '<div class="panel login"><h3>Admin is not set up</h3><p class="hint">The server has no admin password yet. Set the <code>ADMIN_PASSWORD</code> variable where the app is hosted, restart it, and reload this page.</p></div>';
      return;
    }
    app.innerHTML = '<form class="panel login" id="login"><h3>Admin login</h3>' +
      '<label for="pw">Password<input type="password" id="pw" autocomplete="current-password" required></label>' +
      '<div class="formfoot"><button class="btn" type="submit">Log in</button><span class="status" id="l-status" role="status"></span></div></form>';
    $('#login').addEventListener('submit', function (e) {
      e.preventDefault();
      status('#l-status', 'Checking...', true);
      api('POST', '/api/admin/login', { password: $('#pw').value }).then(function () { start(); })
        .catch(function (err) { status('#l-status', err.message, false); });
    });
  }

  /* ---------- dashboard ---------- */
  function courseOpts(extra) {
    return COURSES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + (extra ? '<option value="__other">Other course code</option>' : '');
  }
  function build() {
    var kinds = Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + KINDS[k] + '</option>'; }).join('');
    app.innerHTML =
      '<div class="topbar"><div class="sec-head" style="margin:0"><h2>Manage the site</h2></div><button class="btn ghost small" id="logout" type="button">Log out</button></div>' +

      '<form class="panel" id="f-notice"><h3>Notice banner</h3>' +
        '<label for="n-text">Shown to every student at the top of the site. Leave empty and post to clear it.<input type="text" id="n-text" maxlength="200" placeholder="MLS206 test holds Thursday, 8am"></label>' +
        '<div class="formfoot"><button class="btn" type="submit">Post notice</button><span class="status" id="n-status" role="status"></span></div></form>' +

      '<form class="panel" id="f-material"><h3>Add study material</h3>' +
        '<label for="m-title">Title<input type="text" id="m-title" maxlength="120" placeholder="MBH222 Lipid Metabolism Notes"></label>' +
        '<div class="row2"><label for="m-course">Course<select id="m-course">' + courseOpts(true) + '</select></label>' +
        '<label for="m-kind">Type<select id="m-kind">' + kinds + '</select></label></div>' +
        '<label for="m-code" id="m-code-wrap" hidden>Course code<input type="text" id="m-code" maxlength="10" placeholder="e.g. CHM101"></label>' +
        '<label for="m-note">Note text (optional)<textarea id="m-note" rows="5" placeholder="Type or paste the note here"></textarea></label>' +
        '<label for="m-file">File (optional)<input type="file" id="m-file" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"></label>' +
        '<p class="hint">PDF, Word, PowerPoint, Excel, images, CSV or text. Up to ' + MAX_MB + ' MB.</p>' +
        '<label for="m-link">Link (optional)<input type="url" id="m-link" placeholder="https://"></label>' +
        '<div class="formfoot"><button class="btn" type="submit" id="m-btn">Publish material</button><span class="status" id="m-status" role="status"></span></div></form>' +

      '<form class="panel" id="f-quiz"><h3>Create a quiz</h3>' +
        '<label for="q-title">Quiz title<input type="text" id="q-title" maxlength="120" placeholder="MBH222 Carbohydrate Metabolism"></label>' +
        '<div class="row2"><label for="q-course">Course<select id="q-course">' + courseOpts(true) + '</select></label>' +
        '<label for="q-code" id="q-code-wrap" hidden>Course code<input type="text" id="q-code" maxlength="10" placeholder="e.g. CHM101"></label></div>' +
        '<label for="q-text">Questions, one per line<textarea id="q-text" rows="9" placeholder="Which enzyme joins Okazaki fragments? | DNA polymerase I | DNA ligase | Helicase | Primase | B | Ligase seals the nicks in the sugar-phosphate backbone."></textarea></label>' +
        '<p class="hint">Format for each line: <code>Question | Option A | Option B | Option C | Option D | Answer letter | Explanation (optional)</code></p>' +
        '<div class="formfoot"><button class="btn" type="submit">Publish quiz</button><span class="status" id="q-status" role="status"></span></div></form>' +

      '<div class="panel"><h3>Published materials</h3><div class="mini" id="l-materials"></div></div>' +
      '<div class="panel"><h3>Published quizzes</h3><div class="mini" id="l-quizzes"></div></div>' +
      '<div class="panel"><h3>Leaderboard entries</h3><p class="hint">Remove a name that should not be on the board.</p><div class="mini" id="l-scores"></div></div>';

    $('#logout').addEventListener('click', function () { api('POST', '/api/admin/logout').then(function () { location.reload(); }); });
    $('#f-notice').addEventListener('submit', function (e) { e.preventDefault(); postNotice(); });
    $('#f-material').addEventListener('submit', function (e) { e.preventDefault(); postMaterial(); });
    $('#f-quiz').addEventListener('submit', function (e) { e.preventDefault(); postQuiz(); });
    $('#m-course').addEventListener('change', function () { $('#m-code-wrap').hidden = this.value !== '__other'; });
    $('#q-course').addEventListener('change', function () { $('#q-code-wrap').hidden = this.value !== '__other'; });
    $('#n-text').value = state.notice;
    renderLists();
  }

  function renderLists() {
    var m = $('#l-materials'), q = $('#l-quizzes'), s = $('#l-scores');
    if (!m) return;
    function delBtn(kind, id) {
      return confirmId === kind + id
        ? '<button class="btn danger small" data-del="' + kind + '" data-id="' + esc(id) + '">Confirm remove</button>'
        : '<button class="btn ghost small" data-ask="' + kind + id + '">Remove</button>';
    }
    m.innerHTML = state.materials.length ? state.materials.map(function (x) {
      return '<div class="item"><span class="code">' + esc(x.course) + '</span><div style="min-width:0"><h3 style="font-size:17px">' + esc(x.title) + '</h3><p class="meta">' + esc(KINDS[x.kind] || 'Other') + (x.fileName ? ' &middot; ' + esc(x.fileName) : '') + '</p></div><div class="acts">' + delBtn('materials', x.id) + '</div></div>';
    }).join('') : '<p class="hint">Nothing published yet.</p>';
    q.innerHTML = state.quizzes.length ? state.quizzes.map(function (x) {
      return '<div class="item"><span class="code">' + esc(x.course) + '</span><div style="min-width:0"><h3 style="font-size:17px">' + esc(x.title) + '</h3><p class="meta">' + x.questions.length + ' questions</p></div><div class="acts">' + delBtn('quizzes', x.id) + '</div></div>';
    }).join('') : '<p class="hint">No quizzes yet.</p>';
    s.innerHTML = state.scores.length ? state.scores.map(function (x) {
      return '<div class="item"><span class="code">' + x.points + ' pts</span><div style="min-width:0"><h3 style="font-size:17px">' + esc(x.nick || 'Anonymous warrior') + '</h3><p class="meta">' + x.done + ' quiz' + (x.done === 1 ? '' : 'zes') + '</p></div><div class="acts">' + delBtn('scores', x.id) + '</div></div>';
    }).join('') : '<p class="hint">No scores yet.</p>';
  }

  function load() {
    return Promise.all([api('GET', '/api/state'), api('GET', '/api/admin/scores')]).then(function (r) {
      state.materials = r[0].materials; state.quizzes = r[0].quizzes; state.notice = r[0].notice || ''; state.scores = r[1];
      renderLists();
    });
  }

  document.addEventListener('click', function (e) {
    var ask = e.target.closest('[data-ask]');
    if (ask) { confirmId = ask.dataset.ask; renderLists(); return; }
    var del = e.target.closest('[data-del]');
    if (del) {
      var kind = del.dataset.del, id = del.dataset.id; confirmId = null;
      api('DELETE', '/api/admin/' + kind + '/' + encodeURIComponent(id)).then(load).catch(function () { load(); });
    }
  });

  function chosenCourse(sel, code) {
    var v = $(sel).value;
    return v === '__other' ? $(code).value.trim().toUpperCase() : v;
  }
  function postNotice() {
    api('PUT', '/api/admin/notice', { text: $('#n-text').value })
      .then(function (r) { state.notice = r.text; status('#n-status', r.text ? 'Notice posted.' : 'Notice cleared.', true); })
      .catch(function (e) { status('#n-status', e.message, false); });
  }
  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { reject(new Error('Could not read the file.')); };
      fr.readAsDataURL(file);
    });
  }
  function postMaterial() {
    var file = $('#m-file').files[0];
    var body = { title: $('#m-title').value, course: chosenCourse('#m-course', '#m-code'), kind: $('#m-kind').value, note: $('#m-note').value, link: $('#m-link').value };
    if (!body.title.trim()) return status('#m-status', 'Add a title.', false);
    if (!file && !body.note.trim() && !body.link.trim()) return status('#m-status', 'Add a note, a file or a link.', false);
    var btn = $('#m-btn'); btn.disabled = true; status('#m-status', 'Publishing...', true);
    var prep = Promise.resolve();
    if (file) {
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      var type = EXT_TYPES[ext];
      if (!type) { btn.disabled = false; return status('#m-status', 'That file type is not supported.', false); }
      if (file.size > MAX_MB * 1024 * 1024) { btn.disabled = false; return status('#m-status', 'That file is over ' + MAX_MB + ' MB.', false); }
      prep = toBase64(file).then(function (b64) { body.file = { name: file.name, type: type, data: b64 }; });
    }
    prep.then(function () { return api('POST', '/api/admin/materials', body); }).then(function () {
      $('#m-title').value = ''; $('#m-note').value = ''; $('#m-link').value = ''; $('#m-file').value = '';
      status('#m-status', 'Published. It is live for students now.', true);
      return load();
    }).catch(function (e) {
      if (e.status === 401) return location.reload();
      status('#m-status', e.message, false);
    }).then(function () { btn.disabled = false; });
  }

  function parseQuiz(text) {
    var out = [], errs = [];
    text.split(/\r?\n/).forEach(function (line, n) {
      line = line.trim(); if (!line) return;
      var p = line.split('|').map(function (s) { return s.trim(); });
      if (p.length < 6) { errs.push('Line ' + (n + 1) + ': needs a question, four options and an answer letter.'); return; }
      var a = 'ABCD'.indexOf((p[5] || '').toUpperCase());
      if (p[5].length !== 1 || a < 0) { errs.push('Line ' + (n + 1) + ': the answer must be A, B, C or D.'); return; }
      if (!p[0] || p.slice(1, 5).some(function (o) { return !o; })) { errs.push('Line ' + (n + 1) + ': the question and all four options need text.'); return; }
      var item = { q: p[0], o: p.slice(1, 5), a: a };
      var ex = p.slice(6).join(' | ').trim(); if (ex) item.e = ex;
      out.push(item);
    });
    return { qs: out, errs: errs };
  }
  function postQuiz() {
    var title = $('#q-title').value.trim();
    if (!title) return status('#q-status', 'Add a quiz title.', false);
    var r = parseQuiz($('#q-text').value);
    if (r.errs.length) return status('#q-status', r.errs[0] + (r.errs.length > 1 ? ' (+' + (r.errs.length - 1) + ' more)' : ''), false);
    if (!r.qs.length) return status('#q-status', 'Add at least one question.', false);
    status('#q-status', 'Publishing...', true);
    api('POST', '/api/admin/quizzes', { title: title, course: chosenCourse('#q-course', '#q-code'), questions: r.qs }).then(function (res) {
      $('#q-title').value = ''; $('#q-text').value = '';
      status('#q-status', 'Published with ' + res.count + ' question' + (res.count === 1 ? '' : 's') + '.', true);
      return load();
    }).catch(function (e) {
      if (e.status === 401) return location.reload();
      status('#q-status', e.message, false);
    });
  }

  function start() { load().then(build).then(load).catch(function () { showLogin(true); }); }
  api('GET', '/api/admin/me').then(function (r) {
    if (!r.configured) return showLogin(false);
    if (!r.admin) return showLogin(true);
    start();
  }).catch(function () { app.innerHTML = '<div class="empty"><b>Could not reach the server</b>Check your connection and reload.</div>'; });
})();
