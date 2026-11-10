// Metas semanais e mensais por grupamento e por exercício, em formato de planilha.
import { state, save } from '../store.js';
import { $, esc, setStr, compact, icon, actions, changes, submits, toast, sheet, closeSheet, meter, stepper, fmtDate, MONTHS, shareFile } from '../ui.js';
import { route, rerender } from '../router.js';
import { GROUPS } from '../data.js';
import {
  groupGoalStatus, exGoalStatus, suggestGoal, weekStart, addDays, monthKey, daysInMonth, entriesFor,
  setExGoal, setWeekOverride, autoWeekSet, routineGroupSets,
} from '../logic.js';
import { goalsCSV, importGoalsCSV } from '../export.js';

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
    const manual = state.goals.groups[g.group]?.auto === false;
    return `<tr data-act="editGroupGoal" data-g="${esc(g.group)}" tabindex="0">
      <td class="n">${esc(g.group)}${!isWeek && g.monthTon ? `<span class="sub">${compact(g.monthTon)} no mês</span>` : ''}
        ${manual ? '<span class="sub">definida por você</span>' : ''}
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
    const info = isWeek ? (st.weekManual ? ' · definida por você' : ` · semana ${st.week} de ${st.weeks}`) : '';
    return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
      <td class="n">${esc(ex.name)}
        <span class="sub">${best ? `Melhor: ${setStr(best)}` : isWeek ? 'Ainda não treinou nesta semana' : 'Sem registro neste mês'}${info}</span>
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
      <p class="small muted">A meta da semana é calculada sozinha, em degraus até a meta do mês, e você pode trocá-la quando quiser. Toque em uma linha para editar.</p>

      ${noGoal ? `<button class="btn block" data-act="suggestAll">${icon.spark}Sugerir metas para ${noGoal} exercício${noGoal > 1 ? 's' : ''}</button>` : ''}

      <div class="card stack">
        <h3>Planilha de metas</h3>
        <p class="small muted">Exporte, edite no Excel ou no Google Planilhas e importe de volta. Nos grupamentos, escreva séries ("12 séries"); nos exercícios, carga e repetições ("42,5 kg x 10"). As colunas "Feito" e "Situação" são ignoradas.</p>
        <button class="btn block" data-act="exportGoals">Exportar metas (CSV)</button>
        <label class="btn block">Importar metas (CSV)<input type="file" accept=".csv,text/csv,text/plain" data-change="importGoals" class="sr"></label>
      </div>
    </div>`;
}

actions.goalMode = el => { mode = el.dataset.m; rerender(); };

// ---------- Grupamento ----------

actions.editGroupGoal = el => {
  const g = el.dataset.g;
  const cur = state.goals.groups[g] || {};
  const fromRoutine = routineGroupSets()[g];
  sheet(`<h2>Meta de ${esc(g)}</h2>
    <p class="muted">Quantas séries você quer fazer para este grupamento.</p>
    <form class="stack" data-submit="saveGroupGoal" data-g="${esc(g)}">
      <div class="two">
        ${stepper('week', cur.week || 0, 1, 'Séries por semana')}
        ${stepper('month', cur.month || 0, 1, 'Séries no mês')}
      </div>
      <p class="small muted">${cur.auto === false
        ? 'Definida por você: não muda quando você altera os treinos.'
        : 'Hoje esta meta segue a sua rotina e se ajusta sozinha quando você muda os exercícios. Se salvar um valor, ela passa a ser fixa.'}
        Deixe o mês em 0 para calcular a partir da semana.</p>
      <button class="btn primary big">Salvar</button>
      ${fromRoutine && cur.auto === false ? `<button type="button" class="btn ghost block" data-act="groupAuto" data-g="${esc(g)}">Seguir a rotina (${fromRoutine} séries por semana)</button>` : ''}
    </form>`);
};
submits.saveGroupGoal = form => {
  const week = Math.max(0, Math.round(Number(form.week.value) || 0));
  let month = Math.max(0, Math.round(Number(form.month.value) || 0));
  const old = state.goals.groups[form.dataset.g] || {};
  // se só a semana mudou, o mês acompanha
  if (!month || (week !== (old.week || 0) && month === (old.month || 0))) month = Math.round(week * daysInMonth() / 7);
  if (!week && !month) state.goals.groups[form.dataset.g] = { week: 0, month: 0, auto: false };
  else if (week !== old.week || month !== old.month) state.goals.groups[form.dataset.g] = { week, month, auto: false };
  save(); closeSheet(); rerender();
};
actions.groupAuto = el => {
  const g = el.dataset.g;
  const n = routineGroupSets()[g] || 0;
  state.goals.groups[g] = { week: n, month: Math.round(n * daysInMonth() / 7), auto: true };
  save(); closeSheet(); rerender();
};

// ---------- Exercício ----------

actions.editExGoal = el => {
  const ex = state.exercises[el.dataset.id];
  if (!ex) return;
  const st = exGoalStatus(ex);
  const active = st && !st.expired;
  const sug = suggestGoal(ex);
  const start = active ? st.goal : sug || { w: ex.startW || 0, r: ex.repMax };
  const auto = active ? autoWeekSet(ex) : null;
  const wLabel = ex.bw ? 'Carga extra (kg)' : 'Carga (kg)';
  const now = new Date();
  sheet(`<h2>${esc(ex.name)}</h2>
    <form class="stack" data-submit="saveExGoal" data-id="${esc(ex.id)}"
      data-week0="${active ? `${st.weekSet.w}|${st.weekSet.r}` : ''}">
      <h3>Meta do mês (até o fim de ${MONTHS[now.getMonth()]})</h3>
      <div class="two">
        ${stepper('w', start.w, ex.step || 1, wLabel)}
        ${stepper('r', start.r, 1, 'Repetições', 1)}
      </div>
      ${sug ? `<p class="small muted">Sugestão do app (cerca de 5% acima do seu melhor recente): <b>${setStr(sug)}</b></p>`
            : `<p class="small muted">Sem histórico ainda: defina uma meta realista e ajuste depois do primeiro treino.</p>`}
      ${active ? `<h3>Meta desta semana</h3>
      <div class="two">
        ${stepper('ww', st.weekSet.w, ex.step || 1, wLabel)}
        ${stepper('wr', st.weekSet.r, 1, 'Repetições', 1)}
      </div>
      <p class="small muted">${st.weekManual
        ? `Definida por você. O cálculo automático daria ${setStr(auto)}.`
        : 'Calculada sozinha, em degraus até a meta do mês. Mude se quiser outra meta só nesta semana.'}</p>
      ${st.weekManual ? `<button type="button" class="btn ghost block" data-act="weekAuto" data-id="${esc(ex.id)}">Voltar ao cálculo automático</button>` : ''}` : ''}
      <button class="btn primary big">Salvar meta</button>
      ${st ? `<button type="button" class="btn ghost danger block" data-act="delExGoal" data-id="${esc(ex.id)}">Remover meta</button>` : ''}
    </form>`);
};
submits.saveExGoal = form => {
  const ex = state.exercises[form.dataset.id];
  const now = new Date();
  const num = (v, min) => Math.max(min, Number(v) || 0);
  const w = num(form.w.value, 0);
  const r = Math.round(num(form.r.value, 1));
  const st = exGoalStatus(ex, now);
  // só recria a meta do mês se ela mudou: recriar reinicia os degraus semanais
  if (!st || st.expired || st.goal.w !== w || st.goal.r !== r) setExGoal(ex, w, r, now);
  if (form.ww) {
    const ww = num(form.ww.value, 0);
    const wr = Math.round(num(form.wr.value, 1));
    if (`${ww}|${wr}` !== form.dataset.week0) setWeekOverride(ex, ww, wr, now);
  }
  save(); closeSheet(); rerender();
};
actions.weekAuto = el => {
  delete state.goals.ex[el.dataset.id]?.weekOverride;
  save(); closeSheet(); rerender();
};
actions.delExGoal = el => { delete state.goals.ex[el.dataset.id]; save(); closeSheet(); rerender(); };

actions.suggestAll = () => {
  let n = 0;
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex);
    if (st && !st.expired) continue;
    const sug = suggestGoal(ex);
    if (sug) { setExGoal(ex, sug.w, sug.r); n++; }
  }
  save(); rerender();
  toast(n ? `${n} meta${n > 1 ? 's' : ''} criada${n > 1 ? 's' : ''} para este mês.` : 'Registre treinos para o app sugerir metas.');
};

// ---------- Planilha ----------

actions.exportGoals = () => shareFile(`overload-metas-${monthKey()}.csv`, goalsCSV(), 'text/csv');

changes.importGoals = async el => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const r = importGoalsCSV(await file.text());
    save();
    rerender();
    const parts = [];
    if (r.groups) parts.push(`${r.groups} grupamento${r.groups > 1 ? 's' : ''}`);
    if (r.ex) parts.push(`${r.ex} meta${r.ex > 1 ? 's' : ''} do mês`);
    if (r.weeks) parts.push(`${r.weeks} meta${r.weeks > 1 ? 's' : ''} da semana`);
    let msg = parts.length ? `Atualizado: ${parts.join(', ')}.` : 'Nenhuma meta mudou.';
    if (r.unknown.length) msg += ` Não encontrei: ${r.unknown.slice(0, 3).join(', ')}${r.unknown.length > 3 ? '…' : ''}.`;
    toast(msg, 6000);
  } catch (e) {
    toast(e.message || 'Não consegui ler esta planilha.', 6000);
  }
  el.value = '';
};

route('metas', render);
