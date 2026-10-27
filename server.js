'use strict';
/*
  Exam Warriors server. Uses only Node's built-in modules (plus `mongodb`, loaded
  only when MONGODB_URI is set), so there is nothing heavy to install.
*/
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { createStore } = require('./store');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('exam-warriors:' + ADMIN_PASSWORD).digest('hex');
const SESSION_HOURS = 12;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_BODY_BYTES = 18 * 1024 * 1024;
const KINDS = ['notes', 'pq', 'slides', 'other'];
const PUBLIC_DIR = path.join(__dirname, 'public');

const FILE_TYPES = {
  'application/pdf': { inline: true },
  'image/png': { inline: true },
  'image/jpeg': { inline: true },
  'image/gif': { inline: true },
  'image/webp': { inline: true },
  'text/plain': { inline: true },
  'text/csv': { inline: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { inline: false },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { inline: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { inline: false },
};
const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
};

/* ---------- helpers ---------- */
const newId = () => crypto.randomBytes(8).toString('hex');
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');
const isHttp = (u) => /^https?:\/\/[^\s]+$/i.test(u || '');
const okCourse = (c) => /^[A-Z0-9]{2,10}$/.test(c || '');
const okDevice = (d) => typeof d === 'string' && /^[a-z0-9]{16,40}$/.test(d);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return ''; }
    }
  }
  return '';
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const [exp, mac] = readCookie(req, 'ew_admin').split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Date.now() > Number(exp)) return false;
  return safeEqual(mac, sign('admin.' + exp));
}
function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}
function isSecure(req) { return req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted; }

const hits = new Map();
function limited(req, name, max, windowMs) {
  const key = name + ':' + clientIp(req);
  const now = Date.now();
  let h = hits.get(key);
  if (!h || now > h.reset) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
  return ++h.count > max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.reset) hits.delete(k); }, 60000).unref();

function looksLike(buf, type) {
  const s = (a, o = 0) => a.every((b, i) => buf[o + i] === b);
  switch (type) {
    case 'application/pdf': return s([0x25, 0x50, 0x44, 0x46]);
    case 'image/png': return s([0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg': return s([0xff, 0xd8, 0xff]);
    case 'image/gif': return s([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp': return s([0x52, 0x49, 0x46, 0x46]) && s([0x57, 0x45, 0x42, 0x50], 8);
    case 'text/plain':
    case 'text/csv': return !buf.includes(0);
    default: return s([0x50, 0x4b, 0x03, 0x04]); // docx, pptx, xlsx are zip containers
  }
}
function pointsFor(rec, quizIds) {
  let pts = 0; let done = 0;
  for (const id of Object.keys(rec.best || {})) {
    if (quizIds.has(id)) { pts += rec.best[id].correct * 10; done++; }
  }
  return { points: pts, done };
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function send(res, status, body, headers) {
  const h = Object.assign({}, SEC_HEADERS, headers || {});
  if (body !== undefined && !Buffer.isBuffer(body) && typeof body !== 'string') {
    body = JSON.stringify(body);
    h['Content-Type'] = 'application/json; charset=utf-8';
    h['Cache-Control'] = 'no-store';
  }
  res.writeHead(status, h);
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > MAX_BODY_BYTES) { req.resume(); return reject(new HttpError(413, 'That upload is too large.')); }
    const chunks = []; let size = 0; let dead = false;
    req.on('data', (c) => {
      if (dead) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) { dead = true; reject(new HttpError(413, 'That upload is too large.')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (dead) return;
      if (!size) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch (e) { reject(new HttpError(400, 'Bad request.')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel === '/admin') rel = '/admin.html';
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      if (pathname === '/login.html') {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
    }
  fs.readFile(file, (err, buf) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, b2) =>
        e2 ? send(res, 404, 'Not found', { 'Content-Type': 'text/plain' })
          : send(res, 404, b2, { 'Content-Type': STATIC_TYPES['.html'] }));
    }
    const ext = path.extname(file).toLowerCase();
    send(res, 200, buf, {
      'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
  });
}

/* ---------- app ---------- */
async function main() {
  const store = await createStore();

  const routes = []; // [method, regex, handler, {admin, limit:[name,max,ms]}]
  function route(method, pattern, opts, handler) {
    const re = new RegExp('^' + pattern.replace(/:[a-z]+/gi, '([^/]+)') + '$');
    routes.push({ method, re, opts: opts || {}, handler });
  }

  /* ----- public API ----- */
    // --- User Authentication Routes ---
  
  route('POST', '/api/register', {}, async (req, res, ctx) => {
    const { username, password } = ctx.body || {};
    if (!username || !password) throw new HttpError(400, 'Username and password required.');
    
    const users = await store.list('users');
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new HttpError(400, 'Username already taken.');
    }
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const newUser = { 
      id: crypto.randomBytes(8).toString('hex'), 
      username, 
      password: hashedPassword,
      createdAt: Date.now()
    };
    await store.put('users', newUser);
    
    send(res, 200, { message: 'Registration successful! You can now log in.' });
  });

  route('POST', '/api/login', {}, async (req, res, ctx) => {
    const { username, password } = ctx.body || {};
    if (!username || !password) throw new HttpError(400, 'Username and password required.');
    
    const users = await store.list('users');
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) throw new HttpError(401, 'Invalid username or password.');
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password !== hashedPassword) throw new HttpError(401, 'Invalid username or password.');
    
    send(res, 200, { 
      message: 'Login successful!', 
      user: { id: user.id, username: user.username } 
    });
  });

  route('GET', '/api/state', {}, async (req, res, ctx) => {
    const [materials, quizzes, scores, notice] = await Promise.all([
      store.list('materials'), store.list('quizzes'), store.list('scores'), store.get('settings', 'notice'),
    ]);
    const quizIds = new Set(quizzes.map((q) => q.id));
    const board = scores
      .map((s) => ({ id: s.id, nick: s.nick || '', ...pointsFor(s, quizIds), updatedAt: s.updatedAt || 0 }))
      .filter((s) => s.points > 0)
      .sort((a, b) => b.points - a.points || a.updatedAt - b.updatedAt);
    let me = null;
    const dev = String(ctx.query.get('device') || '');
    if (okDevice(dev)) {
      const rec = scores.find((s) => s.id === dev);
      if (rec) {
        const idx = board.findIndex((b) => b.id === dev);
        me = { nick: rec.nick || '', best: rec.best || {}, ...pointsFor(rec, quizIds), rank: idx >= 0 ? idx + 1 : null };
      }
    }
    send(res, 200, {
      notice: notice ? notice.text : '',
      materials: materials
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .map((m) => ({ id: m.id, title: m.title, course: m.course, kind: m.kind, note: m.note || '', link: m.link || '', fileId: m.fileId || '', fileName: m.fileName || '', addedAt: m.addedAt })),
      quizzes: quizzes.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)),
      board: board.slice(0, 100).map((b, i) => ({ rank: i + 1, nick: b.nick, points: b.points, done: b.done, me: b.id === dev })),
      totalWarriors: board.length,
      me,
    });
  });

  route('GET', '/files/:id', {}, async (req, res, ctx) => {
    const id = ctx.params[0];
    const mats = await store.list('materials');
    const m = mats.find((x) => x.fileId === id);
    const buf = m ? await store.getFile(id) : null;
    if (!buf) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const meta = FILE_TYPES[m.fileType] || { inline: false };
    const name = (m.fileName || 'file').replace(/[^\w.\- ]+/g, '_');
    send(res, 200, buf, {
      'Content-Type': m.fileType || 'application/octet-stream',
      'Content-Disposition': (meta.inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(name),
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'public, max-age=3600',
    });
  });

  route('POST', '/api/nick', { limit: ['nick', 20, 10 * 60 * 1000] }, async (req, res, ctx) => {
    const b = ctx.body;
    const nick = clean(b.nick, 24);
    if (!okDevice(b.deviceId) || !nick) throw new HttpError(400, 'A name is required.');
    const rec = (await store.get('scores', b.deviceId)) || { id: b.deviceId, nick: '', best: {} };
    rec.nick = nick; rec.updatedAt = Date.now();
    await store.put('scores', rec);
    send(res, 200, { ok: true, nick });
  });

  route('POST', '/api/scores', { limit: ['scores', 60, 10 * 60 * 1000] }, async (req, res, ctx) => {
    const { deviceId, quizId, answers } = ctx.body;
    if (!okDevice(deviceId) || typeof quizId !== 'string') throw new HttpError(400, 'Invalid request.');
    const quiz = await store.get('quizzes', quizId);
    if (!quiz) throw new HttpError(404, 'That quiz no longer exists.');
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) throw new HttpError(400, 'Answers do not match the quiz.');
    let correct = 0;
    quiz.questions.forEach((q, i) => { if (answers[i] === q.a) correct++; });
    const total = quiz.questions.length;
    const rec = (await store.get('scores', deviceId)) || { id: deviceId, nick: '', best: {} };
    const prev = rec.best[quizId];
    const improved = !prev || correct > prev.correct;
    if (improved) rec.best[quizId] = { correct, total };
    rec.updatedAt = Date.now();
    await store.put('scores', rec);
    send(res, 200, { correct, total, improved });
  });

  /* ----- admin API ----- */
  route('POST', '/api/admin/login', { limit: ['login', 8, 15 * 60 * 1000] }, async (req, res, ctx) => {
    if (!ADMIN_PASSWORD) throw new HttpError(503, 'Admin is not set up. Set the ADMIN_PASSWORD variable on the server.');
    const pw = ctx.body.password;
    if (typeof pw !== 'string' || !safeEqual(sha(pw), sha(ADMIN_PASSWORD))) throw new HttpError(401, 'Wrong password.');
    const exp = String(Date.now() + SESSION_HOURS * 3600 * 1000);
    send(res, 200, { ok: true }, {
      'Set-Cookie': `ew_admin=${exp}.${sign('admin.' + exp)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 3600}${isSecure(req) ? '; Secure' : ''}`,
    });
  });
  route('POST', '/api/admin/logout', {}, async (req, res) => {
    send(res, 200, { ok: true }, { 'Set-Cookie': 'ew_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  });
  route('GET', '/api/admin/me', {}, async (req, res) => send(res, 200, { admin: isAdmin(req), configured: !!ADMIN_PASSWORD }));

  route('PUT', '/api/admin/notice', { admin: true }, async (req, res, ctx) => {
    const text = clean(ctx.body.text, 200);
    if (!text) { await store.del('settings', 'notice'); return send(res, 200, { ok: true, text: '' }); }
    await store.put('settings', { id: 'notice', text, at: Date.now() });
    send(res, 200, { ok: true, text });
  });

  route('POST', '/api/admin/materials', { admin: true }, async (req, res, ctx) => {
    const b = ctx.body;
    const title = clean(b.title, 120);
    const course = clean(b.course, 10).toUpperCase();
    const kind = KINDS.includes(b.kind) ? b.kind : 'other';
    const note = clean(b.note, 8000);
    const link = clean(b.link, 500);
    if (!title) throw new HttpError(400, 'Add a title.');
    if (!okCourse(course)) throw new HttpError(400, 'Course code must be 2 to 10 letters or digits, like MBH222.');
    if (link && !isHttp(link)) throw new HttpError(400, 'The link must start with http:// or https://.');
    const doc = { id: newId(), title, course, kind, addedAt: Date.now() };
    if (note) doc.note = note;
    if (link) doc.link = link;
    let fileBuf = null;
    if (b.file && b.file.data) {
      const type = String(b.file.type || '');
      if (!FILE_TYPES[type]) throw new HttpError(400, 'That file type is not allowed. Use PDF, Word, PowerPoint, Excel, image, CSV or text.');
      fileBuf = Buffer.from(String(b.file.data), 'base64');
      if (!fileBuf.length) throw new HttpError(400, 'The file is empty.');
      if (fileBuf.length > MAX_FILE_BYTES) throw new HttpError(400, 'That file is over 12 MB.');
      if (!looksLike(fileBuf, type)) throw new HttpError(400, 'The file contents do not match its type.');
      doc.fileId = newId(); doc.fileType = type; doc.fileName = clean(b.file.name, 100) || 'file';
    }
    if (!doc.note && !doc.link && !doc.fileId) throw new HttpError(400, 'Add a note, a file or a link.');
    if (fileBuf) await store.putFile(doc.fileId, fileBuf);
    await store.put('materials', doc);
    send(res, 200, { ok: true, id: doc.id });
  });
  route('DELETE', '/api/admin/materials/:id', { admin: true }, async (req, res, ctx) => {
    const m = await store.get('materials', ctx.params[0]);
    if (m) { if (m.fileId) await store.delFile(m.fileId); await store.del('materials', m.id); }
    send(res, 200, { ok: true });
  });

  route('POST', '/api/admin/quizzes', { admin: true }, async (req, res, ctx) => {
    const b = ctx.body;
    const title = clean(b.title, 120);
    const course = clean(b.course, 10).toUpperCase();
    if (!title) throw new HttpError(400, 'Add a quiz title.');
    if (!okCourse(course)) throw new HttpError(400, 'Course code must be 2 to 10 letters or digits, like MBH222.');
    if (!Array.isArray(b.questions) || b.questions.length < 1 || b.questions.length > 150) throw new HttpError(400, 'A quiz needs 1 to 150 questions.');
    const questions = [];
    for (let i = 0; i < b.questions.length; i++) {
      const q = b.questions[i] || {};
      const text = clean(q.q, 500);
      const opts = Array.isArray(q.o) ? q.o.map((o) => clean(o, 250)) : [];
      if (!text || opts.length !== 4 || opts.some((o) => !o) || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) {
        throw new HttpError(400, 'Question ' + (i + 1) + ' is not complete: it needs text, four options and an answer.');
      }
      const item = { q: text, o: opts, a: q.a };
      const e = clean(q.e, 800); if (e) item.e = e;
      questions.push(item);
    }
    const doc = { id: newId(), title, course, questions, addedAt: Date.now() };
    await store.put('quizzes', doc);
    send(res, 200, { ok: true, id: doc.id, count: questions.length });
  });
  route('DELETE', '/api/admin/quizzes/:id', { admin: true }, async (req, res, ctx) => {
    await store.del('quizzes', ctx.params[0]);
    send(res, 200, { ok: true });
  });

  route('GET', '/api/admin/scores', { admin: true }, async (req, res) => {
    const [scores, quizzes] = await Promise.all([store.list('scores'), store.list('quizzes')]);
    const ids = new Set(quizzes.map((q) => q.id));
    send(res, 200, scores.map((s) => ({ id: s.id, nick: s.nick || '', ...pointsFor(s, ids) })).sort((a, b) => b.points - a.points));
  });
  route('DELETE', '/api/admin/scores/:id', { admin: true }, async (req, res, ctx) => {
    await store.del('scores', ctx.params[0]);
    send(res, 200, { ok: true });
  });

  /* ----- dispatcher ----- */
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch (e) { throw new HttpError(400, 'Bad request.'); }

      let matched = null; let pathMatch = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (m) { pathMatch = true; if (r.method === req.method) { matched = { r, params: m.slice(1) }; break; } }
      }
      if (matched) {
        const { r, params } = matched;
        if (r.opts.admin && !isAdmin(req)) throw new HttpError(401, 'Admin login required.');
        if (r.opts.limit && limited(req, ...r.opts.limit)) throw new HttpError(429, 'Too many requests. Please wait a bit and try again.');
        const body = ['POST', 'PUT'].includes(req.method) ? await readJson(req) : {};
        return await r.handler(req, res, { params: params.map(decodeURIComponent), query: url.searchParams, body });
      }
      if (pathname.startsWith('/api/') || pathMatch) throw new HttpError(pathMatch ? 405 : 404, pathMatch ? 'Method not allowed.' : 'Not found.');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
      serveStatic(req, res, pathname);
    } catch (e) {
      if (res.headersSent) return res.end();
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Something went wrong.' });
    }
  });
  server.requestTimeout = 120000;
  server.listen(PORT, () => {
    console.log('Exam Warriors running on port ' + PORT + ' (storage: ' + store.kind + ')');
    if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set, so the admin page is disabled.');
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
