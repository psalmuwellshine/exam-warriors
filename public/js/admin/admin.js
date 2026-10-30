/* Exam Warriors admin control panel. */
import { html, raw, mount, icon, api, toast, dialog, confirmBox, fmtDate, ago, pct, initial, kindLabel, initTheme, toggleTheme, readFile, debounce, eventDate, todayKey, plural, ApiError } from '../core/ui.js';
import { parseBulk } from './bulk.js';

initTheme();
const root = document.getElementById('root');
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'students', label: 'Students', icon: 'users' },
  { id: 'materials', label: 'Materials', icon: 'book' },
  { id: 'quizzes', label: 'Quizzes', icon: 'quiz' },
  { id: 'events', label: 'Events', icon: 'calendar' },
  { id: 'notice', label: 'Announcement', icon: 'bell' },
  { id: 'board', label: 'Leaderboard', icon: 'trophy' },
  { id: 'settings', label: 'Site settings', icon: 'settings' },
];
const A = { me: null, config: null, cache: {}, search: '' };
const warn = (el, text, kind = 'bad') => { const b = el.querySelector('.msg'); if (!b) return toast(text, kind === 'bad' ? 'bad' : 'ok'); b.className = 'msg alert ' + kind; b.textContent = text; b.hidden = false; b.scrollIntoView({ block: 'nearest' }); };

/* ---------- sign in ---------- */
function loginView(configured) {
  mount(root, html`<div class="card login-box"><img class="auth-logo" src="/logo.png" alt=""><h2 style="text-align:center">Admin sign in</h2>
    <p class="muted" style="text-align:center;margin:6px 0 20px">Exam Warriors control panel</p>
    ${configured ? '' : html`<div class="alert warning">Admin is not set up yet. Add an <b>ADMIN_PASSWORD</b> variable on your host, then redeploy.</div>`}
    <div class="msg alert bad" hidden role="alert"></div>
    <form data-submit="login" novalidate><label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required autofocus></label>
    <button class="btn primary block" type="submit" ${configured ? '' : raw('disabled')}>Sign in</button></form>
    <p style="text-align:center;margin-top:16px"><a class="small" href="/">← Back to the site</a></p></div>`);
}

/* ---------- shell ---------- */
function shell(sec) {
  return html`<div class="adm"><aside class="side"><a class="brand" href="#/overview"><img src="/logo.png" alt=""><span>Exam Warriors<small>Admin panel</small></span></a>
    <nav aria-label="Admin sections">${SECTIONS.map((s) => html`<a href="#/${s.id}" class="${s.id === sec ? 'on' : ''}">${icon(s.icon, 18)} ${s.label}</a>`)}</nav>
    <div class="foot"><a class="btn ghost small" href="/" target="_blank" rel="noopener">${icon('eye', 16)} View site</a>
      <button class="btn ghost small" data-action="theme" type="button">${icon('moon', 16)} Light / dark</button>
      <button class="btn ghost small" data-action="logout" type="button">${icon('logout', 16)} Sign out</button></div></aside>
    <main class="content" id="content"><div class="skeleton"></div></main></div>`;
}
const head = (title, sub, actions) => html`<div class="bar-top"><div><h1 style="font-size:clamp(26px,4vw,36px)">${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ''}</div><div class="row gap-s wrap-r">${actions || ''}</div></div>`;
const empty = (ic, t, s) => html`<div class="empty">${icon(ic, 34)}<h3>${t}</h3><p>${s}</p></div>`;

/* ---------- sections ---------- */
const views = {
  async overview() {
    const o = await api('GET', '/api/admin/overview'); const t = o.totals;
    const max = Math.max(1, ...o.series.map((d) => d.attempts));
    const sx = Math.max(1, ...o.series.map((d) => d.signups));
    const k = (ic, n, l, sub) => html`<div class="kpi">${icon(ic, 22)}<b>${n}</b><span>${l}</span>${sub ? html`<div class="tiny muted">${sub}</div>` : ''}</div>`;
    return html`${head('Overview', 'How the platform is doing right now.', html`<a class="btn ghost small" href="/" target="_blank" rel="noopener">View site</a>`)}
      <div class="k-grid">${k('users', t.students, 'Students', t.activeWeek + ' active this week')}${k('book', t.materials, 'Materials', t.hiddenMaterials ? t.hiddenMaterials + ' hidden' : 'all visible')}${k('quiz', t.quizzes, 'Quizzes', t.hiddenQuizzes ? t.hiddenQuizzes + ' hidden' : 'all visible')}${k('star', t.attempts, 'Quiz attempts', t.guests ? t.guests + ' guest players' : '')}</div>
      <div class="k-grid" style="margin-top:12px">${k('calendar', t.upcoming, 'Upcoming events')}${k('shield', t.disabled, 'Disabled accounts')}${k('file', o.storage === 'mongodb' ? 'MongoDB' : 'File', 'Storage', o.storage === 'file' ? 'Resets on free hosting. Use MongoDB.' : 'Permanent')}</div>
      <section class="sec"><div class="card"><h3>Quiz attempts, last 14 days</h3>
        <div class="chart" role="img" aria-label="Bar chart of daily quiz attempts for the last 14 days">${o.series.map((d) => html`<div class="col" title="${d.date}: ${d.attempts} attempts, ${d.signups} new students"><b>${d.attempts || ''}</b><i style="height:${(d.attempts / max) * 100}%"></i><span>${d.date.slice(8)}</span></div>`)}</div>
        <p class="tiny muted" style="margin-top:8px">New students in the same period: ${o.series.reduce((a, d) => a + d.signups, 0)}</p></div></section>
      <div class="cards" style="margin-top:20px">
        <div class="card"><h3 style="margin-bottom:10px">Most attempted quizzes</h3>${o.top.length && o.top[0].attempts ? html`<table><tbody>${o.top.map((q) => html`<tr><td><b>${q.title}</b><br><span class="tiny muted">${q.course}</span></td><td class="num">${q.attempts} tries</td><td class="num">${q.avgPct === null ? '—' : q.avgPct + '% avg'}</td></tr>`)}</tbody></table>` : html`<p class="muted">No attempts yet.</p>`}</div>
        <div class="card"><h3 style="margin-bottom:10px">Newest students</h3>${o.newest.length ? html`<table><tbody>${o.newest.map((u) => html`<tr><td><b>${u.username}</b></td><td class="num muted">${ago(u.createdAt)}</td></tr>`)}</tbody></table>` : html`<p class="muted">No students yet.</p>`}</div></div>`;
  },

  async students() {
    const list = await api('GET', '/api/admin/users'); A.cache.students = list;
    return html`${head('Students', plural(list.length, 'account') + ' registered.', html`<a class="btn ghost small" href="/api/admin/export/students">${icon('download', 16)} Students CSV</a><a class="btn ghost small" href="/api/admin/export/scores">${icon('download', 16)} Scores CSV</a>`)}
      <div class="toolbar"><label class="searchbox" style="max-width:360px">${icon('search', 18)}<span class="sr">Search students</span><input type="search" placeholder="Search username" data-input="search-students" value="${A.search}"></label></div>
      <div id="stu-table">${studentTable(list)}</div>`;
  },

  async materials() {
    const list = await api('GET', '/api/admin/materials'); A.cache.materials = list;
    return html`${head('Materials', plural(list.length, 'resource') + '. Notes, past questions, slides, videos and links.', html`<button class="btn primary" data-action="mat-new" type="button">${icon('plus', 18)} Add material</button>`)}
      ${list.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Title</th><th>Course</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${list.map((m) => html`<tr><td><b>${m.title}</b><br><span class="tiny muted">${m.fileName || m.link || 'Notes only'}</span></td><td><span class="chip">${m.course}</span></td><td>${kindLabel[m.kind] || m.kind}</td>
        <td>${m.pinned ? html`<span class="chip red">Pinned</span> ` : ''}${m.hidden ? html`<span class="chip grey">Hidden</span>` : html`<span class="chip good">Live</span>`}</td>
        <td><div class="actions"><button class="btn ghost small icon" data-action="mat-pin" data-id="${m.id}" type="button" title="${m.pinned ? 'Unpin' : 'Pin to top'}" aria-label="${m.pinned ? 'Unpin' : 'Pin'}">${icon('pin', 17)}</button>
        <button class="btn ghost small icon" data-action="mat-hide" data-id="${m.id}" type="button" title="${m.hidden ? 'Show' : 'Hide'}" aria-label="${m.hidden ? 'Show' : 'Hide'}">${icon(m.hidden ? 'eye' : 'eyeoff', 17)}</button>
        <button class="btn ghost small icon" data-action="mat-edit" data-id="${m.id}" type="button" title="Edit" aria-label="Edit ${m.title}">${icon('edit', 17)}</button>
        <button class="btn ghost small icon" data-action="mat-del" data-id="${m.id}" type="button" title="Delete" aria-label="Delete ${m.title}">${icon('trash', 17)}</button></div></td></tr>`)}</tbody></table></div>` : empty('book', 'No materials yet', 'Add your first study resource.')}`;
  },

  async quizzes() {
    const list = await api('GET', '/api/admin/quizzes'); A.cache.quizzes = list;
    return html`${head('Quizzes', plural(list.length, 'quiz', 'quizzes') + '.', html`<button class="btn primary" data-action="qz-new" type="button">${icon('plus', 18)} New quiz</button>`)}
      ${list.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Quiz</th><th>Course</th><th class="num">Questions</th><th class="num">Attempts</th><th class="num">Avg</th><th>Status</th><th></th></tr></thead><tbody>${list.map((q) => html`<tr><td><b>${q.title}</b></td><td><span class="chip">${q.course}</span></td><td class="num">${q.questions.length}</td><td class="num">${q.stats.attempts}</td><td class="num">${q.stats.avgPct === null ? '—' : q.stats.avgPct + '%'}</td>
        <td>${q.hidden ? html`<span class="chip grey">Hidden</span>` : html`<span class="chip good">Live</span>`}</td>
        <td><div class="actions"><button class="btn ghost small icon" data-action="qz-hide" data-id="${q.id}" type="button" title="${q.hidden ? 'Show' : 'Hide'}" aria-label="${q.hidden ? 'Show' : 'Hide'} ${q.title}">${icon(q.hidden ? 'eye' : 'eyeoff', 17)}</button>
        <button class="btn ghost small icon" data-action="qz-edit" data-id="${q.id}" type="button" title="Edit" aria-label="Edit ${q.title}">${icon('edit', 17)}</button>
        <button class="btn ghost small icon" data-action="qz-del" data-id="${q.id}" type="button" title="Delete" aria-label="Delete ${q.title}">${icon('trash', 17)}</button></div></td></tr>`)}</tbody></table></div>` : empty('quiz', 'No quizzes yet', 'Create a quiz or paste many questions at once.')}`;
  },

  async events() {
    const list = await api('GET', '/api/admin/events'); A.cache.events = list; const t = todayKey();
    return html`${head('Events', 'Shown on the home page and the Events page.', html`<button class="btn primary" data-action="ev-new" type="button">${icon('plus', 18)} Add event</button>`)}
      ${list.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Event</th><th>When</th><th>Where</th><th></th></tr></thead><tbody>${list.map((e) => html`<tr><td><b>${e.title}</b> ${e.date < t ? html`<span class="chip grey">Past</span>` : ''}</td><td>${eventDate(e).long}${e.time ? ' · ' + e.time : ''}</td><td>${e.location || '—'}</td>
        <td><div class="actions"><button class="btn ghost small icon" data-action="ev-edit" data-id="${e.id}" type="button" aria-label="Edit ${e.title}">${icon('edit', 17)}</button><button class="btn ghost small icon" data-action="ev-del" data-id="${e.id}" type="button" aria-label="Delete ${e.title}">${icon('trash', 17)}</button></div></td></tr>`)}</tbody></table></div>` : empty('calendar', 'No events', 'Add a test, meeting or study session.')}`;
  },

  async notice() {
    const n = await api('GET', '/api/admin/notice');
    return html`${head('Announcement', 'A banner shown at the top of every page. Leave it empty to hide it.')}
      <div class="card" style="max-width:640px"><div class="msg alert bad" hidden role="alert"></div>
        <form data-submit="notice-save" novalidate><label class="field"><span>Message</span><textarea name="text" maxlength="240" placeholder="e.g. MBH222 test holds on Friday at 10am">${n.text}</textarea><small>Up to 240 characters.</small></label>
        <label class="field"><span>Style</span><select name="level"><option value="info" ${n.level === 'info' ? raw('selected') : ''}>Information (gold)</option><option value="warning" ${n.level === 'warning' ? raw('selected') : ''}>Important (red)</option><option value="success" ${n.level === 'success' ? raw('selected') : ''}>Good news (green)</option></select></label>
        <div class="row gap-s"><button class="btn primary" type="submit">Publish</button><button class="btn ghost" data-action="notice-clear" type="button">Remove banner</button></div></form></div>`;
  },

  async board() {
    const rows = await api('GET', '/api/admin/board');
    return html`${head('Leaderboard', 'Remove a score, or start a fresh season.', html`<button class="btn danger" data-action="board-reset" type="button">${icon('refresh', 16)} Reset everything</button>`)}
      ${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th class="num">#</th><th>Name</th><th>Type</th><th class="num">Points</th><th class="num">Quizzes</th><th></th></tr></thead><tbody>${rows.map((r) => html`<tr><td class="num">${r.rank}</td><td><b>${r.name}</b></td><td>${r.isUser ? html`<span class="chip good">Student</span>` : html`<span class="chip grey">Guest</span>`}</td><td class="num">${r.points}</td><td class="num">${r.done}</td>
        <td><div class="actions"><button class="btn ghost small" data-action="board-del" data-id="${r.id}" data-name="${r.name}" type="button">${icon('trash', 16)} Clear scores</button></div></td></tr>`)}</tbody></table></div>` : empty('trophy', 'Nothing on the board', 'Scores appear after students take quizzes.')}`;
  },

  async settings() {
    const c = await api('GET', '/api/admin/config'); A.config = c; const L = c.links;
    const tg = (name, on, title, sub) => html`<label class="toggle-row"><input type="checkbox" name="${name}" ${on ? raw('checked') : ''}><span><b>${title}</b><small class="muted" style="display:block">${sub}</small></span></label>`;
    return html`${head('Site settings', 'Everything students see on the site, in one place.')}
      <form data-submit="settings-save" novalidate style="max-width:760px"><div class="msg alert bad" hidden role="alert"></div>
        <div class="card"><h3 style="margin-bottom:12px">Home page text</h3>
          <div class="grid2"><label class="field"><span>Site name</span><input name="siteName" maxlength="60" value="${c.siteName}"></label><label class="field"><span>Tagline</span><input name="tagline" maxlength="120" value="${c.tagline}"></label></div>
          <label class="field"><span>Hero headline</span><input name="heroTitle" maxlength="90" value="${c.heroTitle}"></label>
          <label class="field"><span>Hero text</span><textarea name="heroText" maxlength="300">${c.heroText}</textarea></label>
          <label class="field"><span>Footer text</span><input name="footerText" maxlength="120" value="${c.footerText}"></label></div>
        <div class="card" style="margin-top:16px"><h3>Access and features</h3>
          ${tg('registrationOpen', c.registrationOpen, 'Allow new registrations', 'Turn off to stop new accounts being created.')}
          ${tg('requireLogin', c.requireLogin, 'Require login for quizzes', 'When off, guests can take quizzes, but scores are stored per device.')}
          ${tg('leaderboardEnabled', c.leaderboardEnabled, 'Show the leaderboard', 'Hides rankings everywhere on the site.')}</div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:6px">Courses</h3><p class="muted small" style="margin-bottom:10px">One per line, like <span class="mono">MBH222 - Metabolism of Macromolecules</span>. These feed the course lists in the admin forms.</p>
          <textarea class="code" name="courses">${c.courses.map((x) => x.code + (x.name ? ' - ' + x.name : '')).join('\n')}</textarea></div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:12px">Contact links</h3><p class="muted small" style="margin-bottom:12px">Shown in the site footer. Leave blank to hide.</p>
          <div class="grid2"><label class="field"><span>WhatsApp link</span><input name="whatsapp" inputmode="url" placeholder="https://" value="${L.whatsapp}"></label><label class="field"><span>Telegram link</span><input name="telegram" inputmode="url" placeholder="https://" value="${L.telegram}"></label>
          <label class="field"><span>Instagram link</span><input name="instagram" inputmode="url" placeholder="https://" value="${L.instagram}"></label><label class="field"><span>Website</span><input name="website" inputmode="url" placeholder="https://" value="${L.website}"></label></div>
          <label class="field"><span>Email</span><input name="email" type="email" value="${L.email}"></label></div>
        <div style="margin-top:18px"><button class="btn primary" type="submit">Save settings</button></div></form>`;
  },
};

function studentTable(list) {
  const q = A.search.trim().toLowerCase();
  const rows = list.filter((u) => !q || u.username.toLowerCase().includes(q));
  if (!rows.length) return empty('users', q ? 'No match' : 'No students yet', q ? 'Try another name.' : 'Students show up here after they register.');
  return html`<div class="tbl-wrap"><table><thead><tr><th>Student</th><th>Rank</th><th class="num">Points</th><th class="num">Quizzes</th><th>Last login</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((u) => html`<tr>
    <td><b>${u.username}</b><br><span class="tiny muted">Joined ${fmtDate(u.createdAt)}${u.hasRecovery ? '' : ' · no recovery phrase'}</span></td><td>${u.rank}</td><td class="num">${u.points}</td><td class="num">${u.done}</td><td>${ago(u.lastLoginAt)}</td>
    <td>${u.disabled ? html`<span class="chip red">Disabled</span>` : html`<span class="chip good">Active</span>`}</td>
    <td><div class="actions"><button class="btn ghost small" data-action="stu-view" data-id="${u.id}" type="button">View</button>
    <button class="btn ghost small" data-action="stu-pw" data-id="${u.id}" data-name="${u.username}" type="button">${icon('lock', 15)} Password</button>
    <button class="btn ghost small" data-action="stu-disable" data-id="${u.id}" data-name="${u.username}" data-state="${u.disabled ? 1 : 0}" type="button">${u.disabled ? 'Enable' : 'Disable'}</button>
    <button class="btn ghost small icon" data-action="stu-del" data-id="${u.id}" data-name="${u.username}" type="button" aria-label="Delete ${u.username}">${icon('trash', 16)}</button></div></td></tr>`)}</tbody></table></div>`;
}

/* ---------- router ---------- */
let token = 0;
async function route() {
  const sec = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
  const id = views[sec] ? sec : 'overview';
  const my = ++token;
  mount(root, shell(id));
  const box = document.getElementById('content');
  try {
    const out = await views[id]();
    if (my !== token) return;
    mount(box, out);
  } catch (e) {
    if (my !== token) return;
    if (e instanceof ApiError && e.status === 401) return start();
    mount(box, html`<div class="alert bad">${e.message}</div><button class="btn ghost" data-action="reload" type="button">Try again</button>`);
  }
}
const reload = () => route();

/* ---------- dialogs: materials ---------- */
const courseOptions = (sel) => (A.config ? A.config.courses : []).map((c) => html`<option value="${c.code}" ${c.code === sel ? raw('selected') : ''}>${c.code}${c.name ? ' · ' + c.name : ''}</option>`);
function materialDialog(m) {
  const edit = !!m;
  const { box, close } = dialog(html`<h3>${edit ? 'Edit material' : 'Add material'}</h3><div class="msg alert bad" hidden role="alert"></div>
    <form data-submit="mat-save" novalidate>
      <label class="field"><span>Title</span><input name="title" maxlength="120" required value="${edit ? m.title : ''}" autofocus></label>
      <div class="grid2"><label class="field"><span>Course code</span><input name="course" list="courses" maxlength="10" required value="${edit ? m.course : ''}" placeholder="MBH222" style="text-transform:uppercase"><datalist id="courses">${(A.config ? A.config.courses : []).map((c) => html`<option value="${c.code}">${c.name}</option>`)}</datalist></label>
      <label class="field"><span>Type</span><select name="kind">${Object.keys(kindLabel).map((k) => html`<option value="${k}" ${edit && m.kind === k ? raw('selected') : ''}>${kindLabel[k]}</option>`)}</select></label></div>
      <label class="field"><span>Notes (optional)</span><textarea name="note" maxlength="8000">${edit ? m.note || '' : ''}</textarea></label>
      <label class="field"><span>Link (optional)</span><input name="link" inputmode="url" placeholder="https://… YouTube, Drive, etc." value="${edit ? m.link || '' : ''}"></label>
      <label class="field"><span>File (optional, up to 12 MB)</span><input type="file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt"><small>${edit && m.fileName ? 'Current file: ' + m.fileName + '. Choose a new one to replace it.' : 'PDF, Word, PowerPoint, Excel, image, CSV or text.'}</small></label>
      ${edit && m.fileId ? html`<label class="check small" style="margin-bottom:14px"><input type="checkbox" name="removeFile"> Remove the current file</label>` : ''}
      <div class="row gap wrap-r" style="margin-bottom:16px"><label class="check"><input type="checkbox" name="pinned" ${edit && m.pinned ? raw('checked') : ''}> Pin to top</label><label class="check"><input type="checkbox" name="hidden" ${edit && m.hidden ? raw('checked') : ''}> Hidden from students</label></div>
      <div class="row end gap"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" type="submit">${edit ? 'Save changes' : 'Add material'}</button></div></form>`, { wide: true });
  box.querySelector('form').dataset.id = edit ? m.id : '';
  box.querySelector('form').closeFn = close;
}

/* ---------- dialogs: quizzes ---------- */
let Q = null; // the quiz being edited
function qEditor() {
  return html`${Q.questions.map((q, i) => html`<div class="q-edit" data-qi="${i}"><div class="row between" style="margin-bottom:8px"><b>Question ${i + 1}</b><button class="btn ghost small" data-action="qz-rmq" data-i="${i}" type="button" ${Q.questions.length < 2 ? raw('disabled') : ''}>${icon('trash', 15)} Remove</button></div>
    <label class="field"><span class="sr">Question ${i + 1} text</span><textarea data-q="q" placeholder="Question text" maxlength="500" style="min-height:64px">${q.q}</textarea></label>
    ${q.o.map((o, k) => html`<div class="o"><input type="radio" name="ans${i}" data-q="a" value="${k}" ${q.a === k ? raw('checked') : ''} aria-label="Option ${'ABCD'[k]} is correct"><input data-q="o${k}" placeholder="Option ${'ABCD'[k]}" maxlength="250" value="${o}" aria-label="Option ${'ABCD'[k]}"></div>`)}
    <label class="field" style="margin:6px 0 0"><span class="sr">Explanation</span><input data-q="e" placeholder="Why is it right? (optional)" maxlength="800" value="${q.e || ''}"></label></div>`)}`;
}
function syncQ(form) {
  form.querySelectorAll('.q-edit').forEach((el) => {
    const i = Number(el.dataset.qi); const q = Q.questions[i]; if (!q) return;
    q.q = el.querySelector('[data-q=q]').value;
    q.o = [0, 1, 2, 3].map((k) => el.querySelector(`[data-q=o${k}]`).value);
    const a = el.querySelector('[data-q=a]:checked'); q.a = a ? Number(a.value) : -1;
    q.e = el.querySelector('[data-q=e]').value;
  });
}
function quizDialog(qz) {
  Q = qz ? JSON.parse(JSON.stringify(qz)) : { title: '', course: '', hidden: false, questions: [{ q: '', o: ['', '', '', ''], a: -1, e: '' }] };
  const { box, close } = dialog(html`<h3>${qz ? 'Edit quiz' : 'New quiz'}</h3><div class="msg alert bad" hidden role="alert"></div>
    <form data-submit="qz-save" novalidate>
      <div class="grid2"><label class="field"><span>Quiz title</span><input name="title" maxlength="120" required value="${Q.title}" autofocus></label>
      <label class="field"><span>Course code</span><input name="course" list="courses2" maxlength="10" required value="${Q.course}" placeholder="MBH222" style="text-transform:uppercase"><datalist id="courses2">${(A.config ? A.config.courses : []).map((c) => html`<option value="${c.code}">${c.name}</option>`)}</datalist></label></div>
      <label class="check" style="margin-bottom:16px"><input type="checkbox" name="hidden" ${Q.hidden ? raw('checked') : ''}> Hidden from students (draft)</label>
      <div id="q-list">${qEditor()}</div>
      <div class="row gap-s wrap-r" style="margin-bottom:18px"><button class="btn ghost small" data-action="qz-addq" type="button">${icon('plus', 15)} Add question</button><button class="btn ghost small" data-action="qz-bulk" type="button">${icon('upload', 15)} Paste many questions</button></div>
      <div class="row end gap"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" type="submit">${qz ? 'Save quiz' : 'Create quiz'}</button></div></form>`, { wide: true });
  const f = box.querySelector('form'); f.dataset.id = qz ? qz.id : ''; f.closeFn = close;
}
function bulkDialog(form) {
  const { box, close } = dialog(html`<h3>Paste many questions</h3><p class="muted small" style="margin-bottom:10px">One question per block, blocks separated by a blank line. <span class="mono">Why:</span> is optional.</p>
    <pre class="mono card flat" style="white-space:pre-wrap;margin-bottom:12px;padding:12px">Q: Which organ makes insulin?
A) Liver
B) Pancreas
C) Kidney
D) Spleen
Answer: B
Why: Beta cells of the islets of Langerhans.</pre>
    <div class="msg alert bad" hidden role="alert"></div>
    <label class="field"><span class="sr">Questions</span><textarea class="code" name="bulk" autofocus style="min-height:220px"></textarea></label>
    <div class="row end gap"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" data-action="qz-bulk-go" type="button">Add questions</button></div>`, { wide: true });
  box.bulkTarget = form; box.closeFn = close;
}

/* ---------- dialogs: events ---------- */
function eventDialog(e) {
  const { box, close } = dialog(html`<h3>${e ? 'Edit event' : 'Add event'}</h3><div class="msg alert bad" hidden role="alert"></div>
    <form data-submit="ev-save" novalidate><label class="field"><span>Title</span><input name="title" maxlength="120" required value="${e ? e.title : ''}" autofocus></label>
      <div class="grid2"><label class="field"><span>Date</span><input type="date" name="date" required value="${e ? e.date : ''}"></label><label class="field"><span>Time (optional)</span><input type="time" name="time" value="${e ? e.time || '' : ''}"></label></div>
      <label class="field"><span>Location (optional)</span><input name="location" maxlength="120" value="${e ? e.location || '' : ''}"></label>
      <label class="field"><span>Details (optional)</span><textarea name="description" maxlength="1000">${e ? e.description || '' : ''}</textarea></label>
      <label class="field"><span>Link (optional)</span><input name="link" inputmode="url" placeholder="https://" value="${e ? e.link || '' : ''}"></label>
      <div class="row end gap"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" type="submit">${e ? 'Save event' : 'Add event'}</button></div></form>`);
  const f = box.querySelector('form'); f.dataset.id = e ? e.id : ''; f.closeFn = close;
}

/* ---------- actions ---------- */
async function busy(form, work) {
  const btn = form.querySelector('button[type=submit]'); const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try { await work(); } catch (e) { warn(form.closest('.modal') || form.parentElement, e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
const val = (f, n) => String(new FormData(f).get(n) || '').trim();
const chk = (f, n) => !!f.querySelector(`[name=${n}]`)?.checked;
const byId = (list, id) => (A.cache[list] || []).find((x) => x.id === id);
const sure = (title, text, yes, danger = true) => confirmBox({ title, text, yes, danger });

const actions = {
  theme: toggleTheme, reload,
  async logout() { try { await api('POST', '/api/admin/logout'); } catch (e) { /* ignore */ } start(); },
  'search-students': debounce((el) => { A.search = el.value; const t = document.getElementById('stu-table'); if (t) t.innerHTML = studentTable(A.cache.students || []).s; }, 120),

  /* students */
  async 'stu-view'(el) {
    const p = await api('GET', '/api/admin/users/' + el.dataset.id);
    dialog(html`<div class="row gap"><span class="avatar big" style="width:64px;height:64px;font-size:28px">${initial(p.user.username)}</span><div><h3 style="margin:0">${p.user.username}</h3><p class="muted small">Joined ${fmtDate(p.user.createdAt)} · last login ${ago(p.user.lastLoginAt)}</p>
      <p style="margin-top:4px"><span class="chip red">${p.rank.title}</span> ${p.user.disabled ? html`<span class="chip grey">Disabled</span>` : ''} ${p.user.hasRecovery ? '' : html`<span class="chip grey">No recovery phrase</span>`}</p></div></div>
      <div class="kpis" style="margin:16px 0"><div class="kpi"><b>${p.points}</b><span>Points</span></div><div class="kpi"><b>${p.done}</b><span>Quizzes</span></div><div class="kpi"><b>${p.accuracy === null ? '—' : p.accuracy + '%'}</b><span>Accuracy</span></div><div class="kpi"><b>${p.streak.longest}</b><span>Best streak</span></div></div>
      ${p.quizzes.some((q) => q.best) ? html`<div class="tbl-wrap"><table><thead><tr><th>Quiz</th><th class="num">Best</th><th class="num">Tries</th></tr></thead><tbody>${p.quizzes.filter((q) => q.best).map((q) => html`<tr><td>${q.title} <span class="chip">${q.course}</span></td><td class="num">${q.best.correct}/${q.best.total}</td><td class="num">${q.attempts}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No quiz scores yet.</p>`}
      <div class="row end gap" style="margin-top:18px"><button class="btn ghost small" data-action="stu-clear" data-id="${el.dataset.id}" data-name="${p.user.username}" type="button">Clear scores</button><button class="btn primary" data-close type="button">Close</button></div>`, { wide: true });
  },
  async 'stu-pw'(el) {
    const { box, close } = dialog(html`<h3>Set a new password</h3><p class="muted">For <b>${el.dataset.name}</b>. They will be signed out everywhere. Tell them the new password privately.</p><div class="msg alert bad" hidden role="alert"></div>
      <form data-submit="stu-pw-save" data-id="${el.dataset.id}" novalidate><label class="field"><span>New password (6+ characters)</span><input name="pw" type="text" minlength="6" autocomplete="off" autofocus></label>
      <div class="row end gap"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" type="submit">Set password</button></div></form>`);
    box.querySelector('form').closeFn = close;
  },
  async 'stu-disable'(el) {
    const on = el.dataset.state === '1';
    if (!on && !(await sure('Disable ' + el.dataset.name + '?', 'They will be signed out and will not be able to log in or appear on the leaderboard.', 'Disable'))) return;
    await api('POST', `/api/admin/users/${el.dataset.id}/disable`, { disabled: !on }); toast(on ? 'Account enabled.' : 'Account disabled.'); reload();
  },
  async 'stu-clear'(el) {
    if (!(await sure('Clear scores for ' + el.dataset.name + '?', 'All their quiz scores and history will be removed. This cannot be undone.', 'Clear scores'))) return;
    await api('POST', `/api/admin/users/${el.dataset.id}/clear-scores`); document.querySelector('.modal-back')?.remove(); document.body.classList.remove('noscroll'); toast('Scores cleared.'); reload();
  },
  async 'stu-del'(el) {
    if (!(await confirmBox({ title: 'Delete ' + el.dataset.name + '?', text: 'The account and all of its scores will be permanently removed.', yes: 'Delete account', danger: true, typed: 'DELETE' }))) return;
    await api('DELETE', '/api/admin/users/' + el.dataset.id); toast('Account deleted.'); reload();
  },

  /* materials */
  'mat-new': () => materialDialog(null),
  'mat-edit': (el) => materialDialog(byId('materials', el.dataset.id)),
  async 'mat-pin'(el) { const m = byId('materials', el.dataset.id); await api('PUT', '/api/admin/materials/' + m.id, { ...m, pinned: !m.pinned }); reload(); },
  async 'mat-hide'(el) { const m = byId('materials', el.dataset.id); await api('PUT', '/api/admin/materials/' + m.id, { ...m, hidden: !m.hidden }); toast(m.hidden ? 'Now visible to students.' : 'Hidden from students.'); reload(); },
  async 'mat-del'(el) {
    const m = byId('materials', el.dataset.id);
    if (!(await sure('Delete “' + m.title + '”?', 'The material and its file will be removed for good. You can hide it instead.', 'Delete'))) return;
    await api('DELETE', '/api/admin/materials/' + m.id); toast('Deleted.'); reload();
  },

  /* quizzes */
  'qz-new': () => quizDialog(null),
  'qz-edit': (el) => quizDialog(byId('quizzes', el.dataset.id)),
  'qz-addq'(el) { const f = el.closest('form'); syncQ(f); if (Q.questions.length >= 150) return toast('A quiz can have up to 150 questions.', 'bad'); Q.questions.push({ q: '', o: ['', '', '', ''], a: -1, e: '' }); document.getElementById('q-list').innerHTML = qEditor().s; const t = f.querySelectorAll('.q-edit'); t[t.length - 1].scrollIntoView({ block: 'center' }); },
  'qz-rmq'(el) { const f = el.closest('form'); syncQ(f); Q.questions.splice(Number(el.dataset.i), 1); document.getElementById('q-list').innerHTML = qEditor().s; },
  'qz-bulk'(el) { const f = el.closest('form'); syncQ(f); bulkDialog(f); },
  'qz-bulk-go'(el) {
    const box = el.closest('.modal'); const { questions, errors } = parseBulk(box.querySelector('[name=bulk]').value);
    if (errors.length) return warn(box, errors.slice(0, 3).join(' '));
    if (!questions.length) return warn(box, 'Nothing to add yet. Paste at least one question.');
    const f = box.bulkTarget;
    Q.questions = Q.questions.filter((q) => q.q.trim() || q.o.some((o) => o.trim())).concat(questions).slice(0, 150);
    if (!Q.questions.length) Q.questions = questions;
    document.getElementById('q-list').innerHTML = qEditor().s;
    box.closeFn(); toast(plural(questions.length, 'question') + ' added. Check them, then save.');
  },
  async 'qz-hide'(el) { const q = byId('quizzes', el.dataset.id); await api('PUT', '/api/admin/quizzes/' + q.id, { ...q, hidden: !q.hidden }); reload(); },
  async 'qz-del'(el) {
    const q = byId('quizzes', el.dataset.id);
    if (!(await sure('Delete “' + q.title + '”?', 'The quiz will be removed. Student points from it will no longer count. You can hide it instead.', 'Delete'))) return;
    await api('DELETE', '/api/admin/quizzes/' + q.id); toast('Deleted.'); reload();
  },

  /* events */
  'ev-new': () => eventDialog(null),
  'ev-edit': (el) => eventDialog(byId('events', el.dataset.id)),
  async 'ev-del'(el) {
    const e = byId('events', el.dataset.id);
    if (!(await sure('Delete “' + e.title + '”?', 'This event will be removed from the site.', 'Delete'))) return;
    await api('DELETE', '/api/admin/events/' + e.id); toast('Deleted.'); reload();
  },

  /* notice and board */
  async 'notice-clear'() { await api('PUT', '/api/admin/notice', { text: '' }); toast('Banner removed.'); reload(); },
  async 'board-del'(el) {
    if (!(await sure('Clear scores for ' + el.dataset.name + '?', 'They will disappear from the leaderboard and lose their quiz history.', 'Clear scores'))) return;
    await api('DELETE', '/api/admin/board/' + el.dataset.id); toast('Cleared.'); reload();
  },
  async 'board-reset'() {
    if (!(await confirmBox({ title: 'Reset the whole leaderboard?', text: 'Every student’s and guest’s quiz scores will be erased. Accounts stay. This cannot be undone.', yes: 'Erase all scores', danger: true, typed: 'RESET' }))) return;
    const r = await api('POST', '/api/admin/board/reset', { confirm: 'RESET' }); toast('Cleared ' + r.cleared + ' score records.'); reload();
  },
};

const submits = {
  async login(form) {
    await busy(form, async () => { await api('POST', '/api/admin/login', { password: new FormData(form).get('password') }); start(); });
  },
  async 'stu-pw-save'(form) {
    await busy(form, async () => { await api('POST', `/api/admin/users/${form.dataset.id}/password`, { newPassword: val(form, 'pw') }); form.closeFn(); toast('Password updated.'); });
  },
  async 'mat-save'(form) {
    await busy(form, async () => {
      const body = { title: val(form, 'title'), course: val(form, 'course').toUpperCase(), kind: val(form, 'kind'), note: val(form, 'note'), link: val(form, 'link'), pinned: chk(form, 'pinned'), hidden: chk(form, 'hidden'), removeFile: chk(form, 'removeFile') };
      const file = form.querySelector('[name=file]').files[0];
      if (file) { if (file.size > 12 * 1024 * 1024) throw new Error('That file is over 12 MB.'); body.file = await readFile(file); }
      const id = form.dataset.id;
      await api(id ? 'PUT' : 'POST', '/api/admin/materials' + (id ? '/' + id : ''), body);
      form.closeFn(); toast(id ? 'Saved.' : 'Material added.'); reload();
    });
  },
  async 'qz-save'(form) {
    syncQ(form);
    await busy(form, async () => {
      const body = { title: val(form, 'title'), course: val(form, 'course').toUpperCase(), hidden: chk(form, 'hidden'), questions: Q.questions };
      const id = form.dataset.id;
      await api(id ? 'PUT' : 'POST', '/api/admin/quizzes' + (id ? '/' + id : ''), body);
      form.closeFn(); toast(id ? 'Quiz saved.' : 'Quiz created.'); reload();
    });
  },
  async 'ev-save'(form) {
    await busy(form, async () => {
      const body = { title: val(form, 'title'), date: val(form, 'date'), time: val(form, 'time'), location: val(form, 'location'), description: val(form, 'description'), link: val(form, 'link') };
      const id = form.dataset.id;
      await api(id ? 'PUT' : 'POST', '/api/admin/events' + (id ? '/' + id : ''), body);
      form.closeFn(); toast(id ? 'Event saved.' : 'Event added.'); reload();
    });
  },
  async 'notice-save'(form) {
    await busy(form, async () => { await api('PUT', '/api/admin/notice', { text: val(form, 'text'), level: val(form, 'level') }); toast('Announcement published.'); });
  },
  async 'settings-save'(form) {
    await busy(form, async () => {
      const lines = String(new FormData(form).get('courses') || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const courses = lines.map((l) => { const m = l.match(/^([A-Za-z0-9]+)\s*[-–:]?\s*(.*)$/); return { code: m ? m[1] : l, name: m ? m[2] : '' }; });
      const body = { siteName: val(form, 'siteName'), tagline: val(form, 'tagline'), heroTitle: val(form, 'heroTitle'), heroText: val(form, 'heroText'), footerText: val(form, 'footerText'),
        registrationOpen: chk(form, 'registrationOpen'), requireLogin: chk(form, 'requireLogin'), leaderboardEnabled: chk(form, 'leaderboardEnabled'), courses,
        links: { whatsapp: val(form, 'whatsapp'), telegram: val(form, 'telegram'), instagram: val(form, 'instagram'), website: val(form, 'website'), email: val(form, 'email') } };
      A.config = await api('PUT', '/api/admin/config', body); toast('Settings saved. The site is updated.');
    });
  },
};

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]'); if (!el || !actions[el.dataset.action]) return;
  try { await actions[el.dataset.action](el, ev); } catch (e) { if (e instanceof ApiError && e.status === 401) return start(); toast(e.message, 'bad'); }
});
document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-submit]'); if (!f) return; ev.preventDefault();
  if (submits[f.dataset.submit]) submits[f.dataset.submit](f);
});
document.addEventListener('input', (ev) => { const el = ev.target.closest('[data-input]'); if (el && actions[el.dataset.input]) actions[el.dataset.input](el, ev); });
window.addEventListener('hashchange', () => { if (A.me && A.me.admin) route(); });

async function start() {
  try { A.me = await api('GET', '/api/admin/me'); } catch (e) { root.textContent = e.message; return; }
  if (!A.me.admin) return loginView(A.me.configured);
  try { A.config = await api('GET', '/api/admin/config'); } catch (e) { /* settings load later */ }
  route();
}
start();
