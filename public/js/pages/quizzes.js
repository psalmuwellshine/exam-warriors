import { html, mount, icon, api, toast, pct, esc } from '../core/ui.js';
import { quizCard, emptyState, scopeBar, inScope, currentScope, scopeState } from './shared.js';

const F = { course: '' };

export async function render({ S, user, config }) {
  const st = S.state; const best = (st.me && st.me.best) || {};
  const u = user(); const sc = currentScope(u);
  const pool = st.quizzes.filter((q) => inScope(S, u, sc, q.course));
  if (F.course && !pool.some((q) => q.course === F.course)) F.course = '';
  const courses = [...new Set(pool.map((q) => q.course))].sort();
  const list = pool.filter((q) => !F.course || q.course === F.course);
  const gate = config().requireLogin && !user();
  return html`<div class="sec-head"><div><h2>Quizzes</h2><p>Practise, see the right answer straight away, and climb the leaderboard.</p></div></div>
    ${gate ? html`<div class="alert info">You need an account to take quizzes and save your scores. <a href="#/login?next=%2Fquizzes">Log in</a> or <a href="#/register">create one free</a>.</div>` : ''}
    ${scopeBar(S, u, 'qz-scope')}
    ${courses.length > 1 ? html`<div class="filters"><button class="pill ${F.course ? '' : 'on'}" data-action="qz-course" data-v="" type="button">All courses</button>${courses.map((c) => html`<button class="pill ${F.course === c ? 'on' : ''}" data-action="qz-course" data-v="${c}" type="button">${c}</button>`)}</div>` : ''}
    ${list.length ? html`<div class="cards">${list.map((q) => quizCard(q, best[q.id], null))}</div>` : emptyState('quiz', 'No quizzes yet', 'New quizzes will appear here soon.')}`;
}

/* ---------- quiz runner ---------- */
let run = null;
const L = ['A', 'B', 'C', 'D'];

function screen() {
  const { quiz } = run; const q = quiz.questions[run.i]; const n = quiz.questions.length;
  const locked = run.picked !== null;
  return html`<div class="row between small"><button class="btn ghost small" data-action="qz-quit" type="button">${icon('x', 15)} Leave</button><span class="muted"><b>${run.i + 1}</b> of ${n}</span></div>
    <div class="bar" style="margin-top:12px" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${run.i + (locked ? 1 : 0)}"><i style="width:${((run.i + (locked ? 1 : 0)) / n) * 100}%"></i></div>
    <h2 class="q-text">${q.q}</h2>
    <div class="opts">${q.o.map((o, i) => {
      let cls = '';
      if (locked) cls = i === q.a ? 'right' : (i === run.picked ? 'wrong' : '');
      return html`<button class="opt ${cls}" data-action="qz-pick" data-i="${i}" type="button" ${locked ? raw0('disabled') : ''}><span class="l">${locked && i === q.a ? icon('check', 18) : locked && i === run.picked ? icon('x', 18) : L[i]}</span><span>${o}</span></button>`;
    })}</div>
    ${locked ? html`${q.e ? html`<div class="expl"><b>Why: </b>${q.e}</div>` : ''}
      <div class="row end" style="margin-top:18px"><button class="btn primary" data-action="qz-next" type="button" autofocus>${run.i + 1 === n ? 'Finish quiz' : 'Next question'} ${icon('arrow', 17)}</button></div>` : ''}`;
}
import { raw } from '../core/ui.js';
const raw0 = raw;

function resultScreen() {
  const { quiz, result: r } = run; const p = pct(r.correct, r.total);
  const msg = p === 100 ? 'Flawless! 🔥' : p >= 70 ? 'Strong work!' : p >= 50 ? 'Good effort. Go again?' : 'Keep practising, you will get there.';
  return html`<div class="result card pop"><div class="ring" style="--p:${p}"><b>${p}<small>%</small></b></div>
    <h2>${msg}</h2><p class="muted" style="margin-top:6px">You got <b>${r.correct}</b> of <b>${r.total}</b> in ${quiz.title}.</p>
    <p style="margin-top:12px">${r.improved ? html`<span class="chip good">${icon('star', 13)} New best score</span>` : html`<span class="chip grey">Your best score stays the same</span>`} ${r.rank ? html`<span class="chip brand">${r.rank} · ${r.points} pts</span>` : ''}</p>
    ${r.newBadges && r.newBadges.length ? html`<div class="alert warning" style="margin-top:16px">${icon('medal', 18)} New badge${r.newBadges.length > 1 ? 's' : ''} unlocked: <b>${r.newBadges.join(', ')}</b></div>` : ''}
    ${r.guest ? html`<div class="alert info" style="margin-top:16px">Create an account to keep your scores safe. <a href="#/register">Sign up</a></div>` : ''}
    <div class="row gap wrap-r" style="justify-content:center;margin-top:20px">
      <button class="btn primary" data-action="qz-again" type="button">${icon('refresh', 17)} Try again</button>
      <button class="btn gold" data-action="qz-review" type="button">Review answers</button>
      <a class="btn ghost" href="#/quizzes">All quizzes</a></div></div>
    <div id="review"></div>`;
}
function reviewHtml() {
  const { quiz } = run;
  return html`<h3 style="margin:28px 0 12px">Your answers</h3>${quiz.questions.map((q, i) => {
    const a = run.answers[i]; const ok = a === q.a;
    return html`<div class="card flat" style="margin-bottom:12px"><div class="row gap-s">${ok ? html`<span class="chip good">${icon('check', 13)} Correct</span>` : html`<span class="chip bad">${icon("x", 13)} Wrong</span>`}<span class="muted small">Question ${i + 1}</span></div>
      <p style="font-weight:700;margin:8px 0">${q.q}</p>
      <p class="small"><b>Your answer:</b> ${a === null || a === undefined ? '— skipped' : q.o[a]}</p>
      ${ok ? '' : html`<p class="small"><b>Correct answer:</b> ${q.o[q.a]}</p>`}
      ${q.e ? html`<p class="small muted" style="margin-top:6px">${q.e}</p>` : ''}</div>`;
  })}`;
}
const draw = () => mount(document.getElementById('runner'), run.result ? resultScreen() : screen());

export const runner = {
  needsLogin: ({ config }) => config().requireLogin,
  async render({ S }, { id }) {
    const quiz = S.state.quizzes.find((q) => q.id === id);
    if (!quiz) return html`<div class="empty">${icon('quiz', 34)}<h3>Quiz not available</h3><p>It may have been removed or hidden.</p><p style="margin-top:14px"><a class="btn primary" href="#/quizzes">Back to quizzes</a></p></div>`;
    if (quiz.locked) return html`<div class="empty">${icon('lock', 34)}<h3>This quiz is locked</h3><p>Unlock it to take it.</p><p style="margin-top:14px"><a class="btn primary" href="#/quizzes">Back to quizzes</a></p></div>`;
    run = { quiz, i: 0, answers: quiz.questions.map(() => null), picked: null, result: null };
    return html`<div class="runner ${quiz.paid ? 'no-copy' : ''}" id="runner"></div>`;
  },
  after() { if (run) draw(); },
};
runner.needsLogin.displayName = 'needsLogin';

export const actions = {
  'qz-scope': (el, ev, { renderView }) => { scopeState.v = el.dataset.v; F.course = ''; renderView(); },
  'qz-course': (el, ev, { renderView }) => { F.course = el.dataset.v; renderView(); },
  'qz-pick'(el) {
    if (!run || run.picked !== null) return;
    run.picked = Number(el.dataset.i); run.answers[run.i] = run.picked; draw();
    const nx = document.querySelector('[data-action="qz-next"]'); if (nx) nx.focus();
  },
  async 'qz-next'(el, ev, { S, load, user }) {
    if (!run || run.picked === null) return;
    if (run.i + 1 < run.quiz.questions.length) { run.i++; run.picked = null; draw(); window.scrollTo(0, 0); return; }
    el.disabled = true;
    try {
      const r = await api('POST', '/api/scores', { quizId: run.quiz.id, answers: run.answers, deviceId: S.device });
      r.guest = !user();
      run.result = r; draw(); window.scrollTo(0, 0);
      load().catch(() => {});
    } catch (e) { el.disabled = false; toast(e.message, 'bad'); }
  },
  'qz-again'() { const q = run.quiz; run = { quiz: q, i: 0, answers: q.questions.map(() => null), picked: null, result: null }; draw(); window.scrollTo(0, 0); },
  'qz-review'() { const b = document.getElementById('review'); b.innerHTML = reviewHtml().s; b.scrollIntoView({ behavior: 'smooth' }); },
  'qz-quit'(el, ev, { go }) { if (!run.result && run.picked === null && run.i === 0 || confirm('Leave this quiz? Your progress will be lost.')) go('/quizzes'); },
};
