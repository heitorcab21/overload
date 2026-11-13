// Montar o próprio treino no primeiro acesso: a pessoa escolhe os exercícios de cada treino
// e só entra no app quando concluir. Dá para voltar e escolher um treino pronto.
import { state, save, uid } from '../store.js';
import { $, $$, esc, icon, actions, changes, toast } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { GROUPS, LIB, LIB_BY_ID, tg, ensureExercise } from '../data.js';
import { t, tn, exPack } from '../i18n.js';
import { defaultGroupGoals } from '../logic.js';

const LETTERS = 'ABCDEFG';
let draft = null; // { routines: [{ name, ex: [] }], cur: 0 }

const newRoutine = i => ({ name: t('Treino {l}', { l: LETTERS[i] || i + 1 }), ex: [] });
const exLabel = id => exPack(id)?.name ?? LIB_BY_ID[id]?.name ?? id;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function summary() {
  const r = draft.routines[draft.cur];
  return r.ex.length
    ? `<ol class="steps small builder-sel">${r.ex.map(id => `<li>${esc(exLabel(id))}</li>`).join('')}</ol>`
    : `<p class="small muted">${t('Toque nos exercícios abaixo para adicionar a este treino.')}</p>`;
}

function render() {
  if (state.onboarded) { go('#/hoje'); return; }
  if (!draft) draft = { routines: [newRoutine(0)], cur: 0 };
  const r = draft.routines[draft.cur];
  const total = draft.routines.filter(x => x.ex.length).length;
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="#/inicio" aria-label="${t('Voltar')}">${icon.back}</a><h1 class="grow">${t('Monte seu treino')}</h1></div>
    <div class="stack">
      <p class="muted small">${t('Crie quantos treinos quiser (A, B, C...) e escolha os exercícios de cada um. Dá para mudar tudo depois.')}</p>
      <div class="chips builder-tabs">
        ${draft.routines.map((x, i) => `<button class="chip${i === draft.cur ? ' on' : ''}" data-act="bSel" data-i="${i}" aria-pressed="${i === draft.cur}">${esc(x.name)}${x.ex.length ? ` · ${x.ex.length}` : ''}</button>`).join('')}
        ${draft.routines.length < LETTERS.length ? `<button class="chip" data-act="bAdd">${icon.plus}${t('Treino')}</button>` : ''}
      </div>
      <div class="card stack">
        <label class="field">${t('Nome do treino')}<input type="text" value="${esc(r.name)}" maxlength="40" data-change="bName"></label>
        <div id="bSummary">${summary()}</div>
        ${draft.routines.length > 1 ? `<button class="btn ghost danger sm" data-act="bDel">${icon.trash}${t('Remover este treino')}</button>` : ''}
      </div>
      <input type="search" placeholder="${t('Buscar exercício ou grupamento')}" data-change="bFilter" aria-label="${t('Buscar exercício')}" autocomplete="off">
      ${GROUPS.map(g => {
        const items = LIB.filter(l => l.group === g);
        return `<div class="builder-group" data-g="${esc(norm(tg(g)))}">
          <h3 class="group-title">${esc(tg(g))}</h3>
          <div class="card flat"><div class="list">${items.map(l => {
            const on = r.ex.includes(l.id);
            return `<button class="item builder-ex${on ? ' on' : ''}" data-act="bToggle" data-id="${l.id}" data-n="${esc(norm(exLabel(l.id)))}" aria-pressed="${on}">
              <span class="grow t">${esc(exLabel(l.id))}</span><span class="bx">${on ? icon.check : icon.plus}</span></button>`;
          }).join('')}</div></div></div>`;
      }).join('')}
      <div class="builder-bar">
        <button class="btn primary big block" data-act="bDone"${total ? '' : ' disabled'}>${total ? tn(total, 'Concluir {n} treino', 'Concluir {n} treinos') : t('Escolha pelo menos um exercício')}</button>
      </div>
    </div>`;
}

const refreshTop = () => {
  const r = draft.routines[draft.cur];
  $('#bSummary').innerHTML = summary();
  const tab = $(`.builder-tabs [data-i="${draft.cur}"]`);
  if (tab) tab.textContent = `${r.name}${r.ex.length ? ` · ${r.ex.length}` : ''}`;
  const total = draft.routines.filter(x => x.ex.length).length;
  const done = $('[data-act="bDone"]');
  done.disabled = !total;
  done.textContent = total ? tn(total, 'Concluir {n} treino', 'Concluir {n} treinos') : t('Escolha pelo menos um exercício');
};

actions.bToggle = el => {
  const r = draft.routines[draft.cur];
  const id = el.dataset.id;
  const i = r.ex.indexOf(id);
  if (i >= 0) r.ex.splice(i, 1); else r.ex.push(id);
  const on = i < 0;
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', on);
  $('.bx', el).innerHTML = on ? icon.check : icon.plus;
  refreshTop();
};
actions.bSel = el => { draft.cur = Number(el.dataset.i); rerender(); };
actions.bAdd = () => { draft.routines.push(newRoutine(draft.routines.length)); draft.cur = draft.routines.length - 1; rerender(); window.scrollTo(0, 0); };
actions.bDel = () => { draft.routines.splice(draft.cur, 1); draft.cur = Math.max(0, draft.cur - 1); rerender(); };
changes.bName = el => { draft.routines[draft.cur].name = el.value.trim() || newRoutine(draft.cur).name; refreshTop(); };
changes.bFilter = el => {
  const q = norm(el.value.trim());
  for (const grp of $$('.builder-group')) {
    const gHit = !q || grp.dataset.g.includes(q);
    let any = false;
    for (const b of $$('.builder-ex', grp)) {
      const show = gHit || b.dataset.n.includes(q);
      b.hidden = !show;
      any ||= show;
    }
    grp.hidden = !any;
  }
};

actions.bDone = () => {
  const list = draft.routines.filter(x => x.ex.length);
  if (!list.length) return;
  for (const r of list) {
    r.ex.forEach(ensureExercise);
    state.routines.push({ id: uid(), name: r.name, ex: r.ex.slice() });
  }
  defaultGroupGoals();
  state.onboarded = true;
  save();
  draft = null;
  toast(tn(list.length, '{n} treino criado.', '{n} treinos criados.'));
  go('#/cargas');
};

route('montar', render, { noTabs: true });
