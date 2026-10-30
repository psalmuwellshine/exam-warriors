import { html, icon, plural, esc } from '../core/ui.js';
import { resourceCard, eventTile, leaderRows, emptyState } from './shared.js';
import { todayKey } from '../core/ui.js';

export async function render({ S, user, config }) {
  const st = S.state; const c = config(); const u = user();
  const upcoming = st.events.filter((e) => e.date >= todayKey()).slice(0, 3);
  const feat = st.materials.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).slice(0, 6);
  return html`
    <section class="hero">
      ${c.tagline ? html`<span class="tag">${c.tagline}</span>` : ''}
      <h1>${c.heroTitle}</h1><p>${c.heroText}</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/quizzes">${icon('quiz', 19)} Take a quiz</a>
        <a class="btn ghost" href="#/library">${icon('book', 19)} Browse the library</a>
        ${!u && c.registrationOpen ? html`<a class="btn ghost" href="#/register">Create account</a>` : ''}
      </div>
    </section>
    <div class="stats">
      <div class="stat"><b>${st.stats.materials}</b><span>Study resources</span></div>
      <div class="stat"><b>${st.stats.quizzes}</b><span>Practice quizzes</span></div>
      <div class="stat"><b>${st.stats.students}</b><span>Warriors</span></div>
    </div>
    ${u && st.me ? html`<section class="sec"><div class="card row gap wrap-r between"><div class="row gap"><span class="avatar big" style="width:60px;height:60px;font-size:26px">${u.username[0].toUpperCase()}</span>
      <div><p class="muted small">Welcome back</p><h3>${u.username}</h3><p class="small"><span class="chip red">${st.me.rank.title}</span> ${st.me.points} points${st.me.position ? ' · #' + st.me.position + ' on the board' : ''}</p></div></div>
      <a class="btn gold" href="#/profile">View my profile ${icon('arrow', 17)}</a></div></section>` : ''}

    <section class="sec"><div class="sec-head"><div><h2>Fresh for you</h2><p>Pinned and newest resources.</p></div><a class="btn ghost small" href="#/library">See all</a></div>
      ${feat.length ? html`<div class="cards">${feat.map(resourceCard)}</div>` : emptyState('book', 'Nothing here yet', 'New study materials will show up here as soon as they are added.')}</section>

    <section class="sec"><div class="sec-head"><div><h2>Coming up</h2><p>Notices and events from Exam Warriors.</p></div><a class="btn ghost small" href="#/events">All events</a></div>
      ${upcoming.length ? html`<div class="cards">${upcoming.map(eventTile)}</div>` : emptyState('calendar', 'No upcoming events', 'Check back soon.')}</section>

    ${c.leaderboardEnabled ? html`<section class="sec"><div class="sec-head"><div><h2>Top warriors</h2><p>10 points for every correct answer.</p></div><a class="btn ghost small" href="#/board">Full leaderboard</a></div>
      <div class="card flat">${st.board.length ? leaderRows(st.board.slice(0, 5)) : emptyState('trophy', 'Be the first', 'Take a quiz to claim the top spot.')}</div></section>` : ''}`;
}
export const actions = {
  read(el, ev, { S }) {
    // handled in the library module too; the home page shares the same dialog
    import('./library.js').then((m) => m.actions.read(el, ev, { S }));
  },
};
