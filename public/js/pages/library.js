import { html, icon, dialog, kindLabel, debounce, mount } from '../core/ui.js';
import { resourceCard, emptyState } from './shared.js';

const F = { q: '', course: '', kind: '' };

function filtered(st) {
  const q = F.q.toLowerCase();
  return st.materials.filter((m) => (!F.course || m.course === F.course) && (!F.kind || m.kind === F.kind) &&
    (!q || (m.title + ' ' + m.course + ' ' + (m.note || '')).toLowerCase().includes(q)));
}
const grid = (st) => { const l = filtered(st); return l.length ? html`<div class="cards">${l.map(resourceCard)}</div>` : emptyState('search', 'No matches', 'Try another course or a different word.'); };

export async function render({ S }) {
  const st = S.state;
  const courses = [...new Set(st.materials.map((m) => m.course))].sort();
  const kinds = [...new Set(st.materials.map((m) => m.kind))];
  return html`
    <div class="sec-head"><div><h2>Library</h2><p>${st.materials.length} resources: notes, past questions, slides and videos.</p></div></div>
    <div class="row gap wrap-r" style="margin-bottom:14px"><label class="searchbox">${icon('search', 18)}<span class="sr">Search</span><input type="search" placeholder="Search by title or course" value="${F.q}" data-input="lib-search"></label></div>
    <div class="filters" id="lib-courses"><button class="pill ${F.course ? '' : 'on'}" data-action="lib-course" data-v="" type="button">All courses</button>${courses.map((c) => html`<button class="pill ${F.course === c ? 'on' : ''}" data-action="lib-course" data-v="${c}" type="button">${c}</button>`)}</div>
    ${kinds.length > 1 ? html`<div class="filters" id="lib-kinds">${['', ...kinds].map((k) => html`<button class="pill ${F.kind === k ? 'on' : ''}" data-action="lib-kind" data-v="${k}" type="button">${k ? kindLabel[k] || k : 'Everything'}</button>`)}</div>` : ''}
    <div id="lib-grid">${grid(st)}</div>`;
}

function refresh(S) {
  document.getElementById('lib-grid').innerHTML = grid(S.state).s;
  document.querySelectorAll('#lib-courses .pill').forEach((b) => b.classList.toggle('on', b.dataset.v === F.course));
  document.querySelectorAll('#lib-kinds .pill').forEach((b) => b.classList.toggle('on', b.dataset.v === F.kind));
}
export const actions = {
  'lib-search': debounce((el, ev, { S }) => { F.q = el.value; refresh(S); }, 120),
  'lib-course': (el, ev, { S }) => { F.course = el.dataset.v; refresh(S); },
  'lib-kind': (el, ev, { S }) => { F.kind = el.dataset.v; refresh(S); },
  read(el, ev, { S }) {
    const m = S.state.materials.find((x) => x.id === el.dataset.id); if (!m) return;
    dialog(html`<div class="row gap-s wrap-r" style="margin-bottom:10px"><span class="chip">${m.course}</span><span class="chip grey">${kindLabel[m.kind] || 'Resource'}</span></div>
      <h3>${m.title}</h3><div style="white-space:pre-line;margin:12px 0 20px;line-height:1.65">${m.note || ''}</div>
      <div class="row end gap-s wrap-r">${m.fileId ? html`<a class="btn primary small" href="/files/${m.fileId}" target="_blank" rel="noopener">${icon('download', 16)} Open file</a>` : ''}
      ${m.link ? html`<a class="btn ghost small" href="${m.link}" target="_blank" rel="noopener noreferrer">${icon('link', 16)} Open link</a>` : ''}
      <button class="btn ghost small" data-close type="button" autofocus>Close</button></div>`, { wide: true });
  },
};
