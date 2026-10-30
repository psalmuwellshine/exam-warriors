/* Pieces used by more than one student page. */
import { html, icon, esc, kindLabel, kindIcon, eventDate, todayKey, pct, initial } from '../core/ui.js';

export function resourceCard(m) {
  const long = (m.note || '').length > 140;
  return html`<article class="card res ${m.pinned ? 'pinned' : ''}">
    <div class="row gap-s"><div class="ico-box ${m.kind === 'video' ? 'red' : ''}">${icon(kindIcon[m.kind] || 'file', 22)}</div>
      <div class="top grow"><span class="chip">${m.course}</span><span class="chip grey">${kindLabel[m.kind] || 'Resource'}</span>${m.pinned ? html`<span class="chip red">${icon('pin', 13)} Pinned</span>` : ''}</div></div>
    <h3>${m.title}</h3>
    ${m.note ? html`<p class="note">${m.note}</p>` : ''}
    <div class="go row wrap-r gap-s">
      ${m.fileId ? html`<a class="btn primary small" href="/files/${m.fileId}" target="_blank" rel="noopener">${icon('download', 16)} Open file</a>` : ''}
      ${m.link ? html`<a class="btn ${m.fileId ? 'ghost' : 'primary'} small" href="${m.link}" target="_blank" rel="noopener noreferrer">${icon(m.kind === 'video' ? 'video' : 'link', 16)} ${m.kind === 'video' ? 'Watch' : 'Open link'}</a>` : ''}
      ${long || (m.note && !m.fileId && !m.link) ? html`<button class="btn ghost small" data-action="read" data-id="${m.id}" type="button">Read notes</button>` : ''}
    </div>
  </article>`;
}

export function eventTile(e) {
  const d = eventDate(e); const past = e.date < todayKey();
  return html`<article class="card ev ${past ? 'past' : ''}">
    <div class="date-tile"><i>${d.mon}</i><b>${d.day}</b></div>
    <div class="grow"><h3>${e.title}</h3>
      <p class="muted small">${d.long}${e.time ? ' · ' + e.time : ''}</p>
      ${e.location ? html`<p class="small row gap-s" style="margin-top:4px">${icon('pin2', 16)} ${e.location}</p>` : ''}
      ${e.description ? html`<p class="small muted" style="margin-top:8px;white-space:pre-line">${e.description}</p>` : ''}
      ${e.link ? html`<p style="margin-top:10px"><a class="btn ghost small" href="${e.link}" target="_blank" rel="noopener noreferrer">${icon('link', 15)} More info</a></p>` : ''}
    </div>
  </article>`;
}

export function quizCard(q, best, ctx) {
  const done = best ? pct(best.correct, best.total) : null;
  return html`<article class="card quiz-card">
    <div class="row gap-s wrap-r"><span class="chip">${q.course}</span><span class="chip grey">${q.questions.length} questions</span>${best ? html`<span class="chip good">${icon('check', 13)} Done</span>` : ''}</div>
    <h3>${q.title}</h3>
    ${best ? html`<div><div class="row between small"><span class="muted">Best score</span><b>${best.correct}/${best.total}</b></div><div class="bar" style="margin-top:6px"><i style="width:${done}%"></i></div></div>` : html`<p class="muted small">Not tried yet. Every correct answer earns 10 points.</p>`}
    <a class="btn ${best ? 'ghost' : 'primary'} block" style="margin-top:auto" href="#/quiz/${q.id}">${best ? 'Try again' : 'Start quiz'} ${icon('arrow', 17)}</a>
  </article>`;
}

export function leaderRows(rows) {
  return html`<ol class="lb">${rows.map((r) => html`<li class="${r.me ? 'me' : ''}"><span class="n">${r.rank}</span><span class="avatar" style="width:36px;height:36px;font-size:15px">${initial(r.name)}</span><span class="grow"><b>${r.name}</b>${r.me ? html` <span class="chip red">You</span>` : ''}<br><span class="tiny muted">${r.done} quiz${r.done === 1 ? '' : 'zes'}</span></span><span class="pts">${r.points} pts</span></li>`)}</ol>`;
}

export const emptyState = (ic, title, text) => html`<div class="empty">${icon(ic, 36)}<h3>${title}</h3><p>${text}</p></div>`;
