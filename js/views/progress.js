// Progresso: números do período, séries por semana, evolução por exercício e histórico.
import { state, save } from '../store.js';
import { $, esc, fmt, setStr, compact, icon, actions, changes, sheet, closeSheet, fmtDate } from '../ui.js';
import { route, rerender } from '../router.js';
import { GROUPS } from '../data.js';
import {
  weekSeries, sessionsIn, monthStart, monthEnd, monthPRCount, entriesFor, bestOf, e1rm, exGoalStatus, tonnage,
} from '../logic.js';
import { columnChart, lineChart } from '../charts.js';

let selEx = null;

/** Gráfico e tabela de evolução de um exercício (usado aqui e na tela do exercício). */
export function exerciseProgress(ex) {
  const hist = entriesFor(ex.id);
  if (!hist.length) return { html: `<p class="empty">Sem registros ainda. O gráfico aparece depois do primeiro treino.</p>`, mount() {} };
  const st = exGoalStatus(ex);
  const unit = ex.bw && hist.every(h => h.sets.every(s => !s.w)) ? ' reps' : ' kg';
  const pts = hist.slice(-20).map(h => {
    const top = h.sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
    return { label: fmtDate(h.date, false), value: Math.round(bestOf(h.sets) * 10) / 10, tip: `${fmtDate(h.date)} · ${setStr(top)}` };
  });
  const rows = hist.slice(-8).reverse().map(h => `<tr><td class="n">${fmtDate(h.date)}</td>
    <td class="v">${h.sets.map(s => (s.w > 0 ? `${fmt(s.w)}×${s.r}` : s.r)).join(' · ')}</td></tr>`).join('');
  return {
    html: `<p class="small muted">${unit === ' kg' ? 'Força estimada (1RM calculado da melhor série de cada treino), em kg.' : 'Melhor série de cada treino, em repetições.'}</p>
      <div class="chart" id="exChart"></div>
      <table class="sheet-table"><thead><tr><th>Treino</th><th class="v">Séries</th></tr></thead><tbody>${rows}</tbody></table>`,
    mount() {
      lineChart($('#exChart'), pts, {
        goal: st && !st.expired ? Math.round(e1rm(st.goal.w, st.goal.r) * 10) / 10 : null, unit,
      });
    },
  };
}

function render() {
  const now = new Date();
  const weeks = weekSeries(8, now);
  const cw = weeks.at(-1);
  const monthSessions = sessionsIn(monthStart(now), monthEnd(now));
  const exs = Object.values(state.exercises).filter(ex => entriesFor(ex.id).length)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name));
  // por padrão, mostra o exercício com mais histórico
  if (!exs.some(e => e.id === selEx)) {
    selEx = exs.slice().sort((a, b) => entriesFor(b.id).length - entriesFor(a.id).length)[0]?.id || null;
  }
  const ex = selEx && state.exercises[selEx];
  const prog = ex ? exerciseProgress(ex) : null;
  const hasData = state.sessions.length > 0;

  $('#view').innerHTML = `
    <div class="head"><h1>Progresso</h1></div>
    <div class="stack">
      <div class="tiles">
        <div class="tile"><span class="l">Treinos no mês</span><span class="v">${monthSessions.length}</span></div>
        <div class="tile"><span class="l">Séries na semana</span><span class="v">${cw.sets}</span></div>
        <div class="tile"><span class="l">Volume na semana</span><span class="v">${compact(cw.ton)}</span></div>
        <div class="tile"><span class="l">Recordes no mês</span><span class="v">${monthPRCount(now)}</span></div>
      </div>

      <div class="card"><h3>Séries por semana</h3>
        ${hasData ? '<div class="chart" id="weekChart"></div>' : '<p class="empty">Registre seu primeiro treino para ver a evolução.</p>'}
      </div>

      <div class="card stack"><h3>Evolução por exercício</h3>
        ${ex ? `<select data-change="selEx" aria-label="Exercício">
            ${exs.map(e => `<option value="${esc(e.id)}"${e.id === selEx ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>${prog.html}` : '<p class="empty">Nenhum exercício com registros ainda.</p>'}
      </div>

      <div class="card flat">
        <h3 style="padding:16px 16px 4px">Histórico de treinos</h3>
        <div class="list">${state.sessions.slice().reverse().slice(0, 40).map(s => {
          const sets = s.entries.reduce((n, e) => n + e.sets.length, 0);
          const ton = s.entries.reduce((n, e) => n + tonnage(e.sets), 0);
          return `<button class="item" data-act="openSession" data-id="${s.id}">
            <span class="grow"><span class="t">${esc(s.name)}</span><br><span class="d">${fmtDate(s.date)} · ${sets} séries · ${compact(ton)}</span></span>
            ${icon.next}</button>`;
        }).join('') || '<p class="empty">Seus treinos concluídos aparecem aqui.</p>'}</div>
      </div>
    </div>`;

  if (hasData) {
    columnChart($('#weekChart'), weeks.map((w, i) => ({
      label: fmtDate(w.start, false), value: w.sets,
      tip: `${i === weeks.length - 1 ? 'Esta semana' : `Semana de ${fmtDate(w.start, false)}`} · ${w.workouts} treino${w.workouts === 1 ? '' : 's'}`,
    })), { unit: ' séries' });
  }
  prog?.mount();
}

changes.selEx = el => { selEx = el.value; rerender(); };

actions.openSession = el => {
  const s = state.sessions.find(x => x.id === el.dataset.id);
  if (!s) return;
  sheet(`<h2>${esc(s.name)}</h2><p class="muted">${fmtDate(s.date)} · ${s.dur || '?'} min</p>
    <div>${s.entries.map(e => `<div class="plan-line"><span class="n">${esc(state.exercises[e.exId]?.name || 'Exercício removido')}</span>
      <span class="v num">${e.skipped ? 'pulado' : e.sets.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span></div>`).join('')}</div>
    <button class="btn ghost danger block" data-act="delSessionAsk" data-id="${s.id}">${icon.trash}Excluir treino</button>`);
};
actions.delSessionAsk = el => {
  sheet(`<h2>Excluir este treino?</h2><p class="muted">Ele sai do histórico, das metas e dos gráficos. Esta ação não pode ser desfeita.</p>
    <button class="btn danger block" data-act="delSession" data-id="${el.dataset.id}">Excluir treino</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
actions.delSession = el => {
  state.sessions = state.sessions.filter(x => x.id !== el.dataset.id);
  save(); closeSheet(); rerender();
};

route('progresso', render);
