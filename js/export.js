// Exportação em CSV para abrir no Excel ou no Google Planilhas.
// Português e espanhol: separador ";" e vírgula decimal. Inglês: separador "," e ponto decimal.
import { state } from './store.js';
import { GROUPS, exName, tg, routineName } from './data.js';
import { groupGoalStatus, exGoalStatus, setExGoal, setWeekOverride, daysInMonth } from './logic.js';
import { t, lang, locale, allLangs, exNamesAll } from './i18n.js';

const BOM = '\ufeff';
const dec = () => (lang() === 'en' ? '.' : ',');
const sepChar = () => (lang() === 'en' ? ',' : ';');
const num = v => String(v).replace('.', dec());
const cell = v => {
  const s = typeof v === 'number' ? num(v) : String(v ?? '');
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = rows => BOM + rows.map(r => r.map(cell).join(sepChar())).join('\r\n');

export function sessionsCSV() {
  const FEEL = { easy: t('fácil'), ok: t('na medida'), hard: t('pesado'), fail: t('até a falha') };
  const FLAG = { dor: t('dor ou desconforto'), troca: t('trocou o aparelho'), execucao: t('execução ruim'), tempo: t('sem tempo') };
  const rows = [[t('Data'), t('Treino'), t('Exercício'), t('Grupamento'), t('Série'), t('Carga total (kg)'), t('Repetições'), t('Falhou'), t('Sensação'), t('Observações')]];
  for (const s of state.sessions) {
    const date = new Date(s.date).toLocaleDateString(locale());
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      const name = ex ? exName(ex) : e.exId, group = ex ? tg(ex.group) : '';
      const obs = (e.flags || []).map(f => FLAG[f]).filter(Boolean).join(', ');
      if (e.skipped) { rows.push([date, routineName(s), name, group, '', '', '', '', '', t('pulado')]); continue; }
      e.sets.forEach((x, i) => rows.push([date, routineName(s), name, group, i + 1, x.w, x.r, x.t ? t('sim') : '', FEEL[e.feel] || '', obs]));
    }
  }
  return csv(rows);
}

export function goalsCSV() {
  const now = new Date();
  const rows = [[t('Tipo'), t('Nome'), t('Grupamento'), t('Meta da semana'), t('Feito na semana'), t('Meta do mês'), t('Feito no mês'), t('Situação')]];
  const series = n => t('{n} séries', { n });
  const status = (month, week) => (month ? t('mês batido') : week ? t('semana batida') : t('em andamento'));
  for (const g of groupGoalStatus(now)) {
    rows.push([t('Grupamento'), tg(g.group), tg(g.group), series(g.weekGoal), series(g.weekDone), series(g.monthGoal), series(g.monthDone),
      status(g.monthGoal && g.monthDone >= g.monthGoal, g.weekGoal && g.weekDone >= g.weekGoal)]);
  }
  const f = s => (s ? (s.w > 0 ? `${num(s.w)} kg x ${s.r}` : `${s.r} reps`) : '');
  // a coluna "Meta da semana" de exercício também aceita edição e volta na importação
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex, now);
    if (!st || st.expired) { rows.push([t('Exercício'), exName(ex), tg(ex.group), '', '', '', '', t('sem meta')]); continue; }
    rows.push([t('Exercício'), exName(ex), tg(ex.group), f(st.weekSet), f(st.weekBest), f(st.goal), f(st.monthBest), status(st.monthDone, st.weekDone)]);
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
  if (rows.length < 2) throw new Error(t('A planilha está vazia.'));
  const h = rows[0].map(norm);
  const col = (...names) => h.findIndex(x => names.some(n => x.startsWith(n)));
  // cabeçalhos aceitos em português, inglês e espanhol
  const names = (...keys) => keys.flatMap(k => allLangs(k)).map(norm);
  const cTipo = col(...names('Tipo'));
  const cNome = col(...names('Nome', 'Exercício'));
  const cWeek = col(...names('Meta da semana'), 'meta semana', 'semana', 'week');
  const cMonth = col(...names('Meta do mês'), 'meta mes', 'mes', 'month');
  if (cNome < 0 || (cWeek < 0 && cMonth < 0)) {
    throw new Error(t('Não reconheci as colunas. Exporte as metas pelo app e use esse arquivo como modelo.'));
  }
  // nomes de exercícios e grupamentos em qualquer um dos três idiomas
  const exByName = {};
  for (const e of Object.values(state.exercises)) {
    for (const n of [e.name, exName(e), ...(e.lib ? exNamesAll(e.lib) : [])]) exByName[norm(n)] = e;
  }
  const groupByName = {};
  for (const g of GROUPS) for (const n of allLangs(g)) groupByName[norm(n)] = g;
  const groupWords = names('Grupamento');
  const res = { groups: 0, ex: 0, weeks: 0, unknown: [] };

  for (const r of rows.slice(1)) {
    const raw = (r[cNome] || '').trim();
    const name = norm(raw);
    if (!name) continue;
    const tipo = cTipo >= 0 ? norm(r[cTipo]) : '';
    const wk = cWeek >= 0 ? r[cWeek] : '';
    const mo = cMonth >= 0 ? r[cMonth] : '';
    const isGroup = tipo ? groupWords.some(w => tipo.startsWith(w.slice(0, 5))) : !exByName[name] && !!groupByName[name];

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
