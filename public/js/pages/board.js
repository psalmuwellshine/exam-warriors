import { html, initial, icon } from '../core/ui.js';
import { leaderRows, emptyState } from './shared.js';

export async function render({ S, user }) {
  const st = S.state; const rows = st.board;
  if (!st.config.leaderboardEnabled) return emptyState('trophy', 'Leaderboard is off', 'The admins have switched the leaderboard off for now.');
  const top = rows.slice(0, 3);
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const me = rows.find((r) => r.me);
  return html`<div class="sec-head"><div><h2>Leaderboard</h2><p>10 points for every correct answer, counted from your best attempt at each quiz.</p></div></div>
    ${!user() && st.config.requireLogin ? html`<div class="alert info">Log in to appear on the leaderboard. <a href="#/login?next=%2Fboard">Log in</a></div>` : ''}
    ${me ? html`<div class="alert ok">You are #${me.rank} with ${me.points} points. Keep going!</div>` : ''}
    ${rows.length ? html`
      <div class="podium">${order.map((r) => html`<div class="pod p${r.rank}"><span class="avatar">${initial(r.name)}</span><b>${r.name}</b><span>${r.points} pts</span><div class="medal">${icon('medal', 18)} #${r.rank}</div></div>`)}</div>
      <div class="card flat">${leaderRows(rows)}</div>` : emptyState('trophy', 'No scores yet', 'Be the first on the board: take a quiz.')}`;
}
export const actions = {};
