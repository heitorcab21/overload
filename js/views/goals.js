// Metas semanais e mensais por grupamento e por exercício, em formato de planilha.
import { state, save } from '../store.js';
import { $, esc, setStr, compact, icon, actions, submits, toast, sheet, closeSheet, meter, stepper, fmtDate, MONTHS } from '../ui.js';
import { route, rerender } from '../router.js';
import { GROUPS } from '../data.js';
import {
  groupGoalStatus, exGoalStatus, suggestGoal, bestInRange, e1rm, weekStart, addDays, monthKey,
  daysInMonth, entriesFor,
} from '../logic.js';
import { goalsCSV } from '../export.js';
import { download } from '../ui.js';

let mode = 'week';

function render() {
  const now = new Date();
  const ws = weekStart(now);
  const isWeek = mode === 'week';
  const period = isWeek
    ? `Semana de ${fmtDate(ws, false)} a ${fmtDate(addDays(ws, 6), false)}`
    : `${MONTHS[now.getMonth()][0].toUpperCase()}${MONTHS[now.getMonth()].slice(1)} de ${now.getFullYear()}`;

  const gs = groupGoalStatus(now).sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  const groupRows = gs.map(g => {
    const done = isWeek ? g.weekDone : g.monthDone;
    const goal = isWeek ? g.weekGoal : g.monthGoal;
    return `<tr data-act="editGroupGoal" data-g="${esc(g.group)}" tabindex="0">
      <td class="n">${esc(g.group)}${!isWeek && g.monthTon ? `<span class="sub">${compact(g.monthTon)} no mês</span>` : ''}
        ${goal ? meter(done / goal, done >= goal) : ''}</td>
      <td class="v">${goal ? `${done} / ${goal}` : `${done} <span class="muted">sem meta</span>`}</td>
    </tr>`;
  }).join('');

  const exs = Object.values(state.exercises)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name));
  const exRows = exs.map(ex => {
    const st = exGoalStatus(ex, now);
    if (!st) {
      return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
        <td class="n">${esc(ex.name)}<span class="sub">${esc(ex.group)}</span></td>
        <td class="v muted">definir meta</td></tr>`;
    }
    if (st.expired) {
      const [, m] = st.goal.month.split('-').map(Number);
      return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
        <td class="n">${esc(ex.name)}<span class="sub">Meta de ${MONTHS[m - 1]}: ${setStr(st.goal)} · ${st.monthDone ? 'batida' : 'não batida'}</span></td>
        <td class="v"><span class="badge up">renovar</span></td></tr>`;
    }
    const target = isWeek ? st.weekSet : st.goal;
    const best = isWeek ? st.weekBest : st.monthBest;
    const pct = isWeek ? st.weekPct : st.monthPct;
    const ok = isWeek ? st.weekDone : st.monthDone;
    return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
      <td class="n">${esc(ex.name)}
        <span class="sub">${best ? `Melhor: ${setStr(best)}` : isWeek ? 'Ainda não treinou nesta semana' : 'Sem registro neste mês'}${isWeek ? ` · semana ${st.week} de ${st.weeks}` : ''}</span>
        ${meter(pct, ok)}</td>
      <td class="v">${setStr(target)}${ok ? `<br><span class="badge good">${icon.check}batida</span>` : ''}</td>
    </tr>`;
  }).join('');

  const noGoal = exs.filter(ex => { const st = exGoalStatus(ex, now); return (!st || st.expired) && entriesFor(ex.id).length; }).length;

  $('#view').innerHTML = `
    <div class="head"><div class="grow"><h1>Metas</h1><p class="sub">${period}</p></div></div>
    <div class="stack">
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${isWeek}" class="${isWeek ? 'on' : ''}" data-act="goalMode" data-m="week">Semana</button>
        <button role="tab" aria-selected="${!isWeek}" class="${!isWeek ? 'on' : ''}" data-act="goalMode" data-m="month">Mês</button>
      </div>

      <div class="card flat">
        <table class="sheet-table">
          <thead><tr><th>Grupamento</th><th class="v">Séries</th></tr></thead>
          <tbody>${groupRows || `<tr><td colspan="2" class="empty">Adicione exercícios em Treinos para criar metas.</td></tr>`}</tbody>
        </table>
      </div>

      <div class="card flat">
        <table class="sheet-table">
          <thead><tr><th>Exercício</th><th class="v">${isWeek ? 'Meta da semana' : 'Meta do mês'}</th></tr></thead>
          <tbody>${exRows || `<tr><td colspan="2" class="empty">Nenhum exercício cadastrado.</td></tr>`}</tbody>
        </table>
      </div>
      <p class="small muted">A meta da semana de cada exercício é calculada sozinha: degraus iguais entre o seu ponto de partida e a meta do mês. Toque em uma linha para editar.</p>

      ${noGoal ? `<button class="btn block" data-act="suggestAll">${icon.spark}Sugerir metas para ${noGoal} exercício${noGoal > 1 ? 's' : ''}</button>` : ''}
      <button class="btn block" data-act="exportGoals">Exportar metas (planilha CSV)</button>
    </div>`;
}

actions.goalMode = el => { mode = el.dataset.m; rerender(); };

actions.editGroupGoal = el => {
  const g = el.dataset.g;
  const cur = state.goals.groups[g] || {};
  sheet(`<h2>Meta de ${esc(g)}</h2>
    <p class="muted">Quantas séries você quer fazer para este grupamento.</p>
    <form class="stack" data-submit="saveGroupGoal" data-g="${esc(g)}">
      <div class="two">
        ${stepper('week', cur.week || 0, 1, 'Séries por semana')}
        ${stepper('month', cur.month || 0, 1, 'Séries no mês')}
      </div>
      <p class="small muted">Deixe o mês em 0 para calcular a partir da semana.</p>
      <button class="btn primary big">Salvar</button>
    </form>`);
};
submits.saveGroupGoal = form => {
  const week = Math.max(0, Math.round(Number(form.week.value) || 0));
  let month = Math.max(0, Math.round(Number(form.month.value) || 0));
  const old = state.goals.groups[form.dataset.g] || {};
  // se só a semana mudou, o mês acompanha
  if (!month || (week !== (old.week || 0) && month === (old.month || 0))) month = Math.round(week * daysInMonth() / 7);
  if (!week && !month) delete state.goals.groups[form.dataset.g];
  else state.goals.groups[form.dataset.g] = { week, month };
  save(); closeSheet(); rerender();
};

function setGoal(ex, w, r) {
  const now = new Date();
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  const T = e1rm(w, r);
  state.goals.ex[ex.id] = {
    w, r, month: monthKey(now), created: now.toISOString(),
    base: best ? Math.min(e1rm(best.w, best.r), T) : T * 0.9,
  };
}

actions.editExGoal = el => {
  const ex = state.exercises[el.dataset.id];
  if (!ex) return;
  const st = exGoalStatus(ex);
  const sug = suggestGoal(ex);
  const start = st && !st.expired ? st.goal : sug || { w: ex.startW || 0, r: ex.repMax };
  const now = new Date();
  sheet(`<h2>${esc(ex.name)}</h2>
    <p class="muted">Meta para o fim de ${MONTHS[now.getMonth()]}: a melhor série que você quer conseguir.</p>
    <form class="stack" data-submit="saveExGoal" data-id="${esc(ex.id)}">
      <div class="two">
        ${stepper('w', start.w, ex.step || 1, ex.bw ? 'Carga extra (kg)' : 'Carga (kg)')}
        ${stepper('r', start.r, 1, 'Repetições', 1)}
      </div>
      ${sug ? `<p class="small muted">Sugestão do app (cerca de 5% acima do seu melhor recente): <b>${setStr(sug)}</b></p>`
            : `<p class="small muted">Sem histórico ainda: defina uma meta realista e ajuste depois do primeiro treino.</p>`}
      <button class="btn primary big">Salvar meta</button>
      ${st ? `<button type="button" class="btn ghost danger block" data-act="delExGoal" data-id="${esc(ex.id)}">Remover meta</button>` : ''}
    </form>`);
};
submits.saveExGoal = form => {
  const ex = state.exercises[form.dataset.id];
  const w = Math.max(0, Number(form.w.value) || 0);
  const r = Math.max(1, Math.round(Number(form.r.value) || 0));
  setGoal(ex, w, r);
  save(); closeSheet(); rerender();
};
actions.delExGoal = el => { delete state.goals.ex[el.dataset.id]; save(); closeSheet(); rerender(); };

actions.suggestAll = () => {
  let n = 0;
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex);
    if (st && !st.expired) continue;
    const sug = suggestGoal(ex);
    if (sug) { setGoal(ex, sug.w, sug.r); n++; }
  }
  save(); rerender();
  toast(n ? `${n} meta${n > 1 ? 's' : ''} criada${n > 1 ? 's' : ''} para este mês.` : 'Registre treinos para o app sugerir metas.');
};

actions.exportGoals = () => download(`overload-metas-${monthKey()}.csv`, goalsCSV(), 'text/csv');

route('metas', render);
