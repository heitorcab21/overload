// Metas de carga à prova de distração: cada exercício das fichas precisa de uma decisão —
// um dos 3 cenários (conservador, moderado, difícil) ou "seguir minha progressão". O app pede essa escolha
// logo depois de definir o objetivo, avisa em Metas e em Treinos enquanto faltar alguma e pede de novo
// quando um exercício novo entra no treino.
import { state, save } from '../store.js';
import { $, esc, icon, actions, toast, stepper, setStr } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { activeExercises, exName, tg, GROUPS, loadLabel } from '../data.js';
import { scenarios } from '../scenarios.js';
import { scenarioMini } from './goals.js';
import { t, tn } from '../i18n.js';
import { toW, fromW, toStep } from '../units.js';

import { decision, undecided } from '../goalchoice.js';
export { decision, undecided };

const own = () => (state.goals.own ??= {});

/** Aviso fixo (Metas e Treinos) enquanto faltar escolher alguma meta de carga. */
export function lgBanner(back) {
  const n = undecided().length;
  if (!n) return '';
  return `<a class="card lg-banner" href="#/metas-carga/${back}">
    <span class="lg-ic">${icon.target}</span>
    <b class="grow">${tn(n, 'Falta escolher a meta de 1 exercício', 'Falta escolher a meta de {n} exercícios')}</b>${icon.next}</a>`;
}

/** As opções de um exercício: 3 cenários (ou a carga atual, se não der para estimar) e "seguir minha progressão". */
export function lgOptions(ex) {
  const d = decision(ex);
  const g = state.goals.ex[ex.id];
  const mini = scenarioMini(ex, d === 'goal' ? g : null);
  return `${mini || `<div class="lg-start">
      <p class="small muted">${t('Para calcular as 3 opções, diga a carga que você usa hoje neste exercício.')}</p>
      ${stepper('lgW', toW(ex.startW || 0), toStep(ex.step || 1), loadLabel(ex), 0)}
      <button class="btn sm block" data-act="lgStart" data-id="${esc(ex.id)}">${t('Ver as 3 opções')}</button></div>`}
    <button class="btn sm block lg-own${d === 'own' ? ' on' : ''}" data-act="lgOwn" data-id="${esc(ex.id)}" aria-pressed="${d === 'own'}">${d === 'own' ? icon.check : ''}${t('Seguir minha progressão')}</button>`;
}

function card(ex) {
  const d = decision(ex);
  const g = state.goals.ex[ex.id];
  const status = d === 'goal' ? `<span class="badge good">${icon.check}${esc(setStr(g))}</span>`
    : d === 'own' ? `<span class="badge">${t('sua progressão')}</span>` : `<span class="badge warn">${t('escolha')}</span>`;
  return `<div class="card stack lg-card${d ? ' done' : ''}" id="lg-${esc(ex.id)}">
    <div class="row between"><span class="grow"><b>${esc(exName(ex))}</b><br><span class="small muted">${esc(tg(ex.group))}</span></span>${status}</div>
    ${lgOptions(ex)}
  </div>`;
}

function render(back) {
  const all = activeExercises().sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));
  const todo = all.filter(ex => !decision(ex));
  const done = all.filter(ex => decision(ex));
  const target = `#/${back || 'metas'}`;
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="${target}" aria-label="${t('Voltar')}">${icon.back}</a></div>
    <div class="stack lg-screen">
      <h1>${t('Metas de carga')}</h1>
      <p class="sub muted">${t('Para cada exercício, escolha a meta dos próximos 30 dias: três opções calculadas pelas suas cargas e pelo seu nível. O treino passa a mirar nela, em degraus semanais. Se preferir, siga só a sua progressão, treino a treino.')}</p>
      <div class="lg-progress"><b>${t('{d} de {n} escolhidas', { d: done.length, n: all.length })}</b>${todo.length ? `<button class="btn sm" data-act="lgAllModerate">${t('Moderado em todos os que faltam')}</button>` : ''}</div>
      ${todo.length ? todo.map(card).join('') : `<div class="card"><p>${icon.check} ${t('Tudo escolhido. Você pode mudar quando quiser.')}</p></div>`}
      ${done.length ? `<details class="own-goal"${todo.length ? '' : ' open'}><summary><b>${tn(done.length, 'Já escolhida (1)', 'Já escolhidas ({n})')}</b></summary><div class="stack">${done.map(card).join('')}</div></details>` : ''}
      <a class="btn primary big" href="${target}">${todo.length ? t('Escolher depois') : t('Concluir')}</a>
    </div>`;
}

actions.lgOwn = el => {
  const id = el.dataset.id;
  if (own()[id] && !state.goals.ex[id]) delete own()[id];
  else { own()[id] = true; delete state.goals.ex[id]; }
  save(); rerender();
};
actions.lgStart = el => {
  const ex = state.exercises[el.dataset.id];
  const box = el.closest('.lg-start');
  const w = fromW(Number(String(box?.querySelector('input[name="lgW"]')?.value ?? '').replace(',', '.')) || 0);
  if (!ex || !(w > 0)) { toast(t('Informe a carga que você usa hoje.'), 2500); return; }
  ex.startW = w;
  const act = state.active, en = act?.entries?.[act.idx];
  if (en && en.exId === ex.id && !en.sets.length && en.cur && !(en.cur.w > 0)) en.cur.w = w;
  save(); rerender();
};
actions.lgAllModerate = () => {
  let n = 0;
  for (const ex of undecided()) {
    const sc = scenarios(ex);
    if (!sc) continue;
    actions.pickScenario({ dataset: { id: ex.id, w: sc[1].set.w, r: sc[1].set.r, k: 'moderado' } }, null, { quiet: true });
    n++;
  }
  rerender();
  toast(n ? tn(n, 'Moderado em 1 exercício.', 'Moderado em {n} exercícios.') : t('Nenhum exercício com opções calculadas: informe a carga de cada um.'), 3000);
};

route('metas-carga', render, { noTabs: true, tab: 'metas' });
