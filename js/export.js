// Exportação em CSV para abrir no Excel ou no Google Planilhas (separador ";" e vírgula decimal).
import { state } from './store.js';
import { GROUPS } from './data.js';
import { groupGoalStatus, exGoalStatus, setExGoal, setWeekOverride, daysInMonth } from './logic.js';

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
  // a coluna "Meta da semana" de exercício também aceita edição e volta na importação
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex, now);
    if (!st || st.expired) { rows.push(['Exercício', ex.name, ex.group, '', '', '', '', 'sem meta']); continue; }
    rows.push(['Exercício', ex.name, ex.group, f(st.weekSet), f(st.weekBest), f(st.goal), f(st.monthBest),
      st.monthDone ? 'mês batido' : st.weekDone ? 'semana batida' : 'em andamento']);
  }
  return csv(rows);
}

// ---------- Importação de metas ----------

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Lê CSV com separador ";", "," ou tabulação (detectado pelo cabeçalho) e campos entre aspas. */
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const head = text.split(/\r?\n/, 1)[0];
  const count = c => head.split(c).length - 1;
  const sep = [';', '\t', ','].reduce((a, b) => (count(b) > count(a) ? b : a));
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

/** "42,5 kg x 10", "42.5x10", "42,5 × 10" -> { w, r };  "12 reps" -> { w: 0, r: 12 }. */
export function parseSet(s) {
  const t = norm(s).replace(/(\d),(\d)/g, '$1.$2');
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+)/);
  if (m) return { w: Number(m[1]), r: Number(m[2]) };
  m = t.match(/^(\d+)\s*(?:reps?|repeticoes)?$/);
  return m ? { w: 0, r: Number(m[1]) } : null;
}
const parseCount = s => { const m = norm(s).match(/^(\d+)/); return m ? Number(m[1]) : null; };

/**
 * Aplica as metas de uma planilha (o mesmo formato que o app exporta).
 * Grupamentos: séries na semana e no mês. Exercícios: meta do mês e, se quiser, da semana.
 * Linhas iguais ao que já existe não mudam nada.
 */
export function importGoalsCSV(text, now = new Date()) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('A planilha está vazia.');
  const h = rows[0].map(norm);
  const col = (...names) => h.findIndex(x => names.some(n => x.startsWith(n)));
  const cTipo = col('tipo');
  const cNome = col('nome', 'exercicio');
  const cWeek = col('meta da semana', 'meta semana', 'semana');
  const cMonth = col('meta do mes', 'meta mes', 'mes');
  if (cNome < 0 || (cWeek < 0 && cMonth < 0)) {
    throw new Error('Não reconheci as colunas. Exporte as metas pelo app e use esse arquivo como modelo.');
  }
  const exByName = Object.fromEntries(Object.values(state.exercises).map(e => [norm(e.name), e]));
  const groupByName = Object.fromEntries(GROUPS.map(g => [norm(g), g]));
  const res = { groups: 0, ex: 0, weeks: 0, unknown: [] };

  for (const r of rows.slice(1)) {
    const raw = (r[cNome] || '').trim();
    const name = norm(raw);
    if (!name) continue;
    const tipo = cTipo >= 0 ? norm(r[cTipo]) : '';
    const wk = cWeek >= 0 ? r[cWeek] : '';
    const mo = cMonth >= 0 ? r[cMonth] : '';
    const isGroup = tipo ? tipo.startsWith('grup') : !exByName[name] && !!groupByName[name];

    if (isGroup) {
      const g = groupByName[name];
      if (!g) { res.unknown.push(raw); continue; }
      const w = parseCount(wk), m = parseCount(mo);
      if (w == null && m == null) continue;
      const cur = state.goals.groups[g] || {};
      const week = w ?? cur.week ?? 0;
      const month = m ?? Math.round(week * daysInMonth(now) / 7);
      if (cur.week === week && cur.month === month) continue;
      state.goals.groups[g] = { week, month, auto: false };
      res.groups++;
      continue;
    }

    const ex = exByName[name];
    if (!ex) { res.unknown.push(raw); continue; }
    const ms = parseSet(mo), ws = parseSet(wk);
    let st = exGoalStatus(ex, now);
    if (ms && ms.r > 0 && (!st || st.expired || st.goal.w !== ms.w || st.goal.r !== ms.r)) {
      setExGoal(ex, ms.w, ms.r, now);
      res.ex++;
      st = exGoalStatus(ex, now);
    }
    if (ws && ws.r > 0 && st && !st.expired && (st.weekSet.w !== ws.w || st.weekSet.r !== ws.r)) {
      setWeekOverride(ex, ws.w, ws.r, now);
      res.weeks++;
    }
  }
  res.unknown = [...new Set(res.unknown)];
  return res;
}
