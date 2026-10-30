'use strict';
/* Admin control panel API. Every route here needs the admin cookie. */
const H = require('../lib/helpers');
const D = require('../lib/domain');
const { FILE_TYPES, MAX_FILE_BYTES, looksLike } = require('../lib/files');

const { HttpError, clean, okCourse, isHttp, newId, isDate, isTime, bool } = H;
const KINDS = ['notes', 'pq', 'slides', 'video', 'other'];
const LEVELS = ['info', 'success', 'warning'];
const day = 86400000;

// Spreadsheet programs run text that starts with = + - @ as a formula. Prefix it so they do not.
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const csv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

module.exports = function registerAdmin({ route, store, send }) {
  const A = { admin: true };

  /* ---------- sign in ---------- */
  route('POST', '/api/admin/login', { limit: ['login', 8, 15 * 60 * 1000] }, async (req, res, ctx) => {
    if (!H.ADMIN_PASSWORD) throw new HttpError(503, 'Admin is not set up. Set the ADMIN_PASSWORD variable on the server.');
    const pw = ctx.body.password;
    if (typeof pw !== 'string' || !H.safeEqual(H.sha(pw), H.sha(H.ADMIN_PASSWORD))) throw new HttpError(401, 'Wrong password.');
    send(res, 200, { ok: true }, { 'Set-Cookie': H.makeCookie(req, 'ew_admin', 'admin', 'admin', 0, H.ADMIN_SESSION_HOURS * 3600) });
  });
  route('POST', '/api/admin/logout', {}, async (req, res) => send(res, 200, { ok: true }, { 'Set-Cookie': H.clearCookie('ew_admin') }));
  route('GET', '/api/admin/me', {}, async (req, res) => send(res, 200, { admin: H.isAdmin(req), configured: !!H.ADMIN_PASSWORD, storage: store.kind }));

  /* ---------- overview ---------- */
  route('GET', '/api/admin/overview', A, async (req, res) => {
    const [users, scores, quizzes, materials, events] = await Promise.all([
      store.list('users'), store.list('scores'), store.list('quizzes'), store.list('materials'), store.list('events'),
    ]);
    const now = Date.now();
    const stats = D.quizStats(scores, quizzes);
    const attempts = Object.values(stats).reduce((a, s) => a + s.attempts, 0);
    const today = new Date(now + 3600000).toISOString().slice(0, 10);
    const top = quizzes.map((q) => ({ id: q.id, title: q.title, course: q.course, ...stats[q.id] })).sort((a, b) => b.attempts - a.attempts).slice(0, 5);
    const newest = users.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6).map((u) => ({ id: u.id, username: u.username, createdAt: u.createdAt || null }));
    send(res, 200, {
      totals: {
        students: users.length, disabled: users.filter((u) => u.disabled).length,
        guests: scores.filter((s) => !users.some((u) => u.id === s.id)).length,
        materials: materials.length, hiddenMaterials: materials.filter((m) => m.hidden).length,
        quizzes: quizzes.length, hiddenQuizzes: quizzes.filter((q) => q.hidden).length,
        attempts, events: events.length, upcoming: events.filter((e) => e.date >= today).length,
        activeWeek: users.filter((u) => (u.lastLoginAt || 0) > now - 7 * day).length,
      },
      series: D.activitySeries(scores, users, 14, now),
      top, newest, storage: store.kind,
    });
  });

  /* ---------- students ---------- */
  const userRow = (u, rec, quizIds) => {
    const p = D.pointsFor(rec, quizIds);
    return {
      id: u.id, username: u.username, createdAt: u.createdAt || null, lastLoginAt: u.lastLoginAt || null,
      disabled: !!u.disabled, hasRecovery: !!u.recovery, points: p.points, done: p.done, rank: D.rankInfo(p.points).title,
      attempts: D.historyOf(rec).length || p.done,
    };
  };
  route('GET', '/api/admin/users', A, async (req, res) => {
    const [users, scores, quizzes] = await Promise.all([store.list('users'), store.list('scores'), store.list('quizzes')]);
    const ids = new Set(quizzes.map((q) => q.id));
    const byId = new Map(scores.map((s) => [s.id, s]));
    send(res, 200, users.map((u) => userRow(u, byId.get(u.id), ids)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  });
  route('GET', '/api/admin/users/:id', A, async (req, res, ctx) => {
    const user = await store.get('users', ctx.params[0]);
    if (!user) throw new HttpError(404, 'Student not found.');
    const [quizzes, scores, users, config] = await Promise.all([store.list('quizzes'), store.list('scores'), store.list('users'), D.loadConfig(store)]);
    const board = D.buildBoard(new Map(users.map((u) => [u.id, u])), scores, new Set(quizzes.map((q) => q.id)));
    const profile = D.buildProfile({ user, rec: scores.find((s) => s.id === user.id) || null, quizzes, config, board, now: Date.now() });
    profile.user.disabled = !!user.disabled;
    profile.user.hasRecovery = !!user.recovery;
    send(res, 200, profile);
  });
  route('POST', '/api/admin/users/:id/password', A, async (req, res, ctx) => {
    const user = await store.get('users', ctx.params[0]);
    if (!user) throw new HttpError(404, 'Student not found.');
    const pw = H.str(ctx.body.newPassword, 200);
    if (pw.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
    user.password = await H.hashPassword(pw);
    user.sv = (user.sv || 0) + 1; // signs them out everywhere
    await store.put('users', user);
    send(res, 200, { ok: true });
  });
  route('POST', '/api/admin/users/:id/disable', A, async (req, res, ctx) => {
    const user = await store.get('users', ctx.params[0]);
    if (!user) throw new HttpError(404, 'Student not found.');
    user.disabled = bool(ctx.body.disabled);
    user.sv = (user.sv || 0) + 1;
    await store.put('users', user);
    send(res, 200, { ok: true, disabled: user.disabled });
  });
  route('POST', '/api/admin/users/:id/clear-scores', A, async (req, res, ctx) => {
    await store.del('scores', ctx.params[0]);
    send(res, 200, { ok: true });
  });
  route('DELETE', '/api/admin/users/:id', A, async (req, res, ctx) => {
    await store.del('users', ctx.params[0]);
    await store.del('scores', ctx.params[0]);
    send(res, 200, { ok: true });
  });

  /* ---------- materials ---------- */
  async function readMaterial(b, existing) {
    const title = clean(b.title, 120);
    const course = clean(b.course, 10).toUpperCase();
    const kind = KINDS.includes(b.kind) ? b.kind : 'other';
    const note = clean(b.note, 8000);
    const link = clean(b.link, 500);
    if (!title) throw new HttpError(400, 'Add a title.');
    if (!okCourse(course)) throw new HttpError(400, 'Course code must be 2 to 10 letters or digits, like MBH222.');
    if (link && !isHttp(link)) throw new HttpError(400, 'The link must start with http:// or https://.');
    const doc = { id: existing ? existing.id : newId(), title, course, kind, addedAt: existing ? existing.addedAt : Date.now(), pinned: bool(b.pinned), hidden: bool(b.hidden) };
    if (note) doc.note = note;
    if (link) doc.link = link;
    let fileBuf = null; let dropFile = null;
    if (existing && existing.fileId && !bool(b.removeFile)) {
      doc.fileId = existing.fileId; doc.fileType = existing.fileType; doc.fileName = existing.fileName;
    } else if (existing && existing.fileId) dropFile = existing.fileId;
    if (b.file && b.file.data) {
      const type = String(b.file.type || '');
      if (!FILE_TYPES[type]) throw new HttpError(400, 'That file type is not allowed. Use PDF, Word, PowerPoint, Excel, image, CSV or text.');
      fileBuf = Buffer.from(String(b.file.data), 'base64');
      if (!fileBuf.length) throw new HttpError(400, 'The file is empty.');
      if (fileBuf.length > MAX_FILE_BYTES) throw new HttpError(400, 'That file is over 12 MB.');
      if (!looksLike(fileBuf, type)) throw new HttpError(400, 'The file contents do not match its type.');
      if (doc.fileId) dropFile = doc.fileId;
      doc.fileId = newId(); doc.fileType = type; doc.fileName = clean(b.file.name, 100) || 'file';
    }
    if (!doc.note && !doc.link && !doc.fileId) throw new HttpError(400, 'Add a note, a file or a link.');
    return { doc, fileBuf, dropFile };
  }
  async function saveMaterial({ doc, fileBuf, dropFile }) {
    if (fileBuf) await store.putFile(doc.fileId, fileBuf);
    await store.put('materials', doc);
    if (dropFile) await store.delFile(dropFile);
  }
  route('GET', '/api/admin/materials', A, async (req, res) => {
    const list = await store.list('materials');
    send(res, 200, list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
  });
  route('POST', '/api/admin/materials', A, async (req, res, ctx) => {
    const r = await readMaterial(ctx.body, null);
    await saveMaterial(r);
    send(res, 200, { ok: true, id: r.doc.id });
  });
  route('PUT', '/api/admin/materials/:id', A, async (req, res, ctx) => {
    const m = await store.get('materials', ctx.params[0]);
    if (!m) throw new HttpError(404, 'Material not found.');
    const r = await readMaterial(ctx.body, m);
    await saveMaterial(r);
    send(res, 200, { ok: true });
  });
  route('DELETE', '/api/admin/materials/:id', A, async (req, res, ctx) => {
    const m = await store.get('materials', ctx.params[0]);
    if (m) { if (m.fileId) await store.delFile(m.fileId); await store.del('materials', m.id); }
    send(res, 200, { ok: true });
  });

  /* ---------- quizzes ---------- */
  function readQuiz(b, existing) {
    const title = clean(b.title, 120);
    const course = clean(b.course, 10).toUpperCase();
    if (!title) throw new HttpError(400, 'Add a quiz title.');
    if (!okCourse(course)) throw new HttpError(400, 'Course code must be 2 to 10 letters or digits, like MBH222.');
    if (!Array.isArray(b.questions) || b.questions.length < 1 || b.questions.length > 150) throw new HttpError(400, 'A quiz needs 1 to 150 questions.');
    const questions = b.questions.map((q0, i) => {
      const q = q0 || {};
      const text = clean(q.q, 500);
      const opts = Array.isArray(q.o) ? q.o.map((o) => clean(o, 250)) : [];
      if (!text || opts.length !== 4 || opts.some((o) => !o) || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) {
        throw new HttpError(400, 'Question ' + (i + 1) + ' is not complete: it needs text, four options and an answer.');
      }
      const item = { q: text, o: opts, a: q.a };
      const e = clean(q.e, 800); if (e) item.e = e;
      return item;
    });
    return { id: existing ? existing.id : newId(), title, course, questions, addedAt: existing ? existing.addedAt : Date.now(), hidden: bool(b.hidden) };
  }
  route('GET', '/api/admin/quizzes', A, async (req, res) => {
    const [quizzes, scores] = await Promise.all([store.list('quizzes'), store.list('scores')]);
    const stats = D.quizStats(scores, quizzes);
    send(res, 200, quizzes.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).map((q) => Object.assign({}, q, { stats: stats[q.id] })));
  });
  route('POST', '/api/admin/quizzes', A, async (req, res, ctx) => {
    const doc = readQuiz(ctx.body, null);
    await store.put('quizzes', doc);
    send(res, 200, { ok: true, id: doc.id, count: doc.questions.length });
  });
  route('PUT', '/api/admin/quizzes/:id', A, async (req, res, ctx) => {
    const q = await store.get('quizzes', ctx.params[0]);
    if (!q) throw new HttpError(404, 'Quiz not found.');
    const doc = readQuiz(ctx.body, q);
    await store.put('quizzes', doc);
    send(res, 200, { ok: true });
  });
  route('DELETE', '/api/admin/quizzes/:id', A, async (req, res, ctx) => {
    await store.del('quizzes', ctx.params[0]);
    send(res, 200, { ok: true });
  });

  /* ---------- events ---------- */
  function readEvent(b, existing) {
    const title = clean(b.title, 120);
    const date = clean(b.date, 10);
    const time = clean(b.time, 5);
    const link = clean(b.link, 500);
    if (!title) throw new HttpError(400, 'Add an event title.');
    if (!isDate(date)) throw new HttpError(400, 'Pick a valid date.');
    if (time && !isTime(time)) throw new HttpError(400, 'Time must look like 14:30.');
    if (link && !isHttp(link)) throw new HttpError(400, 'The link must start with http:// or https://.');
    const doc = { id: existing ? existing.id : newId(), title, date, createdAt: existing ? existing.createdAt : Date.now() };
    if (time) doc.time = time;
    const location = clean(b.location, 120); if (location) doc.location = location;
    const description = clean(b.description, 1000); if (description) doc.description = description;
    if (link) doc.link = link;
    return doc;
  }
  route('GET', '/api/admin/events', A, async (req, res) => {
    const list = await store.list('events');
    send(res, 200, list.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))));
  });
  route('POST', '/api/admin/events', A, async (req, res, ctx) => {
    const doc = readEvent(ctx.body, null);
    await store.put('events', doc);
    send(res, 200, { ok: true, id: doc.id });
  });
  route('PUT', '/api/admin/events/:id', A, async (req, res, ctx) => {
    const e = await store.get('events', ctx.params[0]);
    if (!e) throw new HttpError(404, 'Event not found.');
    await store.put('events', readEvent(ctx.body, e));
    send(res, 200, { ok: true });
  });
  route('DELETE', '/api/admin/events/:id', A, async (req, res, ctx) => {
    await store.del('events', ctx.params[0]);
    send(res, 200, { ok: true });
  });

  /* ---------- announcement banner ---------- */
  route('GET', '/api/admin/notice', A, async (req, res) => {
    const n = await store.get('settings', 'notice');
    send(res, 200, { text: (n && n.text) || '', level: (n && n.level) || 'info' });
  });
  route('PUT', '/api/admin/notice', A, async (req, res, ctx) => {
    const text = clean(ctx.body.text, 240);
    const level = LEVELS.includes(ctx.body.level) ? ctx.body.level : 'info';
    if (!text) { await store.del('settings', 'notice'); return send(res, 200, { ok: true, text: '', level }); }
    await store.put('settings', { id: 'notice', text, level, at: Date.now() });
    send(res, 200, { ok: true, text, level });
  });

  /* ---------- site settings ---------- */
  route('GET', '/api/admin/config', A, async (req, res) => send(res, 200, await D.loadConfig(store)));
  route('PUT', '/api/admin/config', A, async (req, res, ctx) => {
    const b = ctx.body;
    const cur = await D.loadConfig(store);
    const next = {
      id: 'config',
      siteName: clean(b.siteName, 60) || cur.siteName,
      tagline: clean(b.tagline, 120),
      heroTitle: clean(b.heroTitle, 90) || cur.heroTitle,
      heroText: clean(b.heroText, 300),
      footerText: clean(b.footerText, 120),
      registrationOpen: bool(b.registrationOpen),
      requireLogin: bool(b.requireLogin),
      leaderboardEnabled: bool(b.leaderboardEnabled),
      courses: cur.courses,
      links: {},
    };
    if (b.courses !== undefined) {
      if (!Array.isArray(b.courses) || b.courses.length > 60) throw new HttpError(400, 'Courses must be a list of up to 60.');
      const seen = new Set();
      next.courses = b.courses.map((c) => {
        const code = clean(c && c.code, 10).toUpperCase();
        if (!okCourse(code)) throw new HttpError(400, 'Course code "' + code + '" must be 2 to 10 letters or digits.');
        if (seen.has(code)) throw new HttpError(400, 'Course ' + code + ' is listed twice.');
        seen.add(code);
        return { code, name: clean(c.name, 80) };
      });
    }
    const L = b.links || {};
    Object.keys(D.DEFAULT_CONFIG.links).forEach((k) => {
      const v = clean(L[k], 200);
      if (!v) { next.links[k] = ''; return; }
      if (k === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, 'That email address does not look right.');
      } else if (!isHttp(v)) throw new HttpError(400, 'The ' + k + ' link must start with http:// or https://.');
      next.links[k] = v;
    });
    await store.put('settings', next);
    send(res, 200, D.mergeConfig(next));
  });

  /* ---------- leaderboard ---------- */
  route('GET', '/api/admin/board', A, async (req, res) => {
    const [users, scores, quizzes] = await Promise.all([store.list('users'), store.list('scores'), store.list('quizzes')]);
    const board = D.buildBoard(new Map(users.map((u) => [u.id, u])), scores, new Set(quizzes.map((q) => q.id)));
    send(res, 200, board.map((b, i) => ({ rank: i + 1, id: b.id, name: b.name, isUser: b.isUser, points: b.points, done: b.done })));
  });
  route('DELETE', '/api/admin/board/:id', A, async (req, res, ctx) => {
    await store.del('scores', ctx.params[0]);
    send(res, 200, { ok: true });
  });
  route('POST', '/api/admin/board/reset', A, async (req, res, ctx) => {
    if (ctx.body.confirm !== 'RESET') throw new HttpError(400, 'Type RESET to confirm.');
    const scores = await store.list('scores');
    for (const s of scores) await store.del('scores', s.id);
    send(res, 200, { ok: true, cleared: scores.length });
  });

  /* ---------- CSV downloads ---------- */
  route('GET', '/api/admin/export/:what', A, async (req, res, ctx) => {
    const what = ctx.params[0];
    const [users, scores, quizzes] = await Promise.all([store.list('users'), store.list('scores'), store.list('quizzes')]);
    const ids = new Set(quizzes.map((q) => q.id));
    const byId = new Map(scores.map((s) => [s.id, s]));
    let rows;
    if (what === 'students') {
      rows = [['Username', 'Joined', 'Last login', 'Status', 'Points', 'Quizzes done', 'Rank']].concat(users.map((u) => {
        const r = userRow(u, byId.get(u.id), ids);
        return [r.username, r.createdAt ? new Date(r.createdAt).toISOString() : '', r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : '', r.disabled ? 'disabled' : 'active', r.points, r.done, r.rank];
      }));
    } else if (what === 'scores') {
      const name = new Map(users.map((u) => [u.id, u.username]));
      rows = [['Student', 'Quiz', 'Course', 'Best correct', 'Out of', 'Percent']];
      scores.forEach((s) => {
        Object.keys(s.best || {}).forEach((qid) => {
          const q = quizzes.find((x) => x.id === qid); if (!q) return;
          const b = s.best[qid];
          rows.push([name.get(s.id) || s.nick || 'Guest', q.title, q.course, b.correct, b.total, b.total ? Math.round((b.correct / b.total) * 100) : 0]);
        });
      });
    } else throw new HttpError(404, 'Unknown export.');
    send(res, 200, '﻿' + csv(rows), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="exam-warriors-${what}.csv"`,
      'Cache-Control': 'no-store',
    });
  });
};
