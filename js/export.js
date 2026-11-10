// Exportação em CSV para abrir no Excel ou no Google Planilhas (separador ";" e vírgula decimal).
import { state } from './store.js';
import { groupGoalStatus, exGoalStatus } from './logic.js';

const BOM = '﻿';
const cell = v => {
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = rows => BOM + rows.map(r => r.map(cell).join(';')).join('\r\n');

const FEEL = { easy: 'fácil', ok: 'na medida', hard: 'pesado', fail: 'até a falha' };
const FLAG = { dor: 'dor ou desconforto', troca: 'trocou o aparelho', execucao: 'execução ruim', tempo: 'sem tempo' };

export function sessionsCSV() {
  const rows = [['Data', 'Treino', 'Exercício', 'Grupamento', 'Série', 'Carga (kg)', 'Repetições', 'Falhou', 'Sensação', 'Observações']];
  for (const s of state.sessions) {
    const date = new Date(s.date).toLocaleDateString('pt-BR');
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      const name = ex?.name || e.exId, group = ex?.group || '';
      const obs = (e.flags || []).map(f => FLAG[f]).filter(Boolean).join(', ');
      if (e.skipped) { rows.push([date, s.name, name, group, '', '', '', '', '', 'pulado']); continue; }
      e.sets.forEach((x, i) => rows.push([date, s.name, name, group, i + 1, x.w, x.r, x.t ? 'sim' : '', FEEL[e.feel] || '', obs]));
    }
  }
  return csv(rows);
}

export function goalsCSV() {
  const now = new Date();
  const rows = [['Tipo', 'Nome', 'Grupamento', 'Meta da semana', 'Feito na semana', 'Meta do mês', 'Feito no mês', 'Situação']];
  for (const g of groupGoalStatus(now)) {
    rows.push(['Grupamento', g.group, g.group, `${g.weekGoal} séries`, `${g.weekDone} séries`, `${g.monthGoal} séries`, `${g.monthDone} séries`,
      g.monthGoal && g.monthDone >= g.monthGoal ? 'mês batido' : g.weekGoal && g.weekDone >= g.weekGoal ? 'semana batida' : 'em andamento']);
  }
  const f = s => (s ? (s.w > 0 ? `${String(s.w).replace('.', ',')} kg x ${s.r}` : `${s.r} reps`) : '');
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex, now);
    if (!st || st.expired) { rows.push(['Exercício', ex.name, ex.group, '', '', '', '', 'sem meta']); continue; }
    rows.push(['Exercício', ex.name, ex.group, f(st.weekSet), f(st.weekBest), f(st.goal), f(st.monthBest),
      st.monthDone ? 'mês batido' : st.weekDone ? 'semana batida' : 'em andamento']);
  }
  return csv(rows);
}
