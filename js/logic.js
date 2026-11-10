// Regras de progressão de carga, metas e estatísticas.
import { state } from './store.js';

export const DAY = 864e5;

/** 1RM estimado (Epley). Sem carga (peso corporal), usa as reps como medida. */
export const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : r);
export const bestOf = sets => sets.reduce((m, s) => Math.max(m, e1rm(s.w, s.r)), 0);
export const tonnage = sets => sets.reduce((t, s) => t + s.w * s.r, 0);

export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // segunda-feira
  return x;
}
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const monthEnd = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1); // exclusivo
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export function sessionsIn(a, b) {
  return state.sessions.filter(s => { const t = new Date(s.date); return t >= a && t < b; });
}

/** Histórico de um exercício em ordem cronológica. */
export function entriesFor(exId) {
  const out = [];
  for (const s of state.sessions) {
    for (const e of s.entries) {
      if (e.exId === exId && !e.skipped && e.sets.length) out.push({ ...e, date: s.date });
    }
  }
  return out;
}

export function bestInRange(exId, a, b) {
  let best = null;
  for (const e of entriesFor(exId)) {
    const t = new Date(e.date);
    if (t < a || t >= b) continue;
    for (const s of e.sets) if (!best || e1rm(s.w, s.r) > e1rm(best.w, best.r)) best = s;
  }
  return best;
}

/** Carga de trabalho de uma sessão: a mais repetida (empate: a maior). */
export function workWeight(sets) {
  const count = {};
  for (const s of sets) count[s.w] = (count[s.w] || 0) + 1;
  return Object.keys(count).map(Number).sort((a, b) => count[b] - count[a] || b - a)[0] ?? 0;
}

const roundStep = (v, step) => (step > 0 ? Math.round(v / step) * step : Math.round(v));
const fit = (reps, n) => Array.from({ length: n }, (_, i) => reps[i] ?? reps.at(-1));

/**
 * Sugestão para o treino de hoje (dupla progressão):
 * primeiro ganha repetições dentro da faixa, depois sobe a carga.
 */
export function planFor(ex) {
  // treinos em que o aparelho foi trocado não servem de base para a próxima carga
  const hist = entriesFor(ex.id).filter(e => !(e.flags || []).includes('troca'));
  const last = hist.at(-1);
  const n = ex.sets;
  if (!last) {
    return {
      w: ex.startW ?? 0, reps: Array(n).fill(ex.repMin), first: true,
      note: 'Primeira vez: ajuste a carga na primeira série e ela fica salva para os próximos treinos.',
    };
  }
  const w = workWeight(last.sets);
  const lr = fit(last.sets.map(s => s.r), n);
  const lastTxt = { w, reps: last.sets.map(s => s.r), date: last.date };
  const out = (w2, reps, note, kind) => ({ w: w2, reps, note, kind, last: lastTxt });

  if ((last.flags || []).includes('dor')) {
    return out(w, lr, 'Você marcou dor ou desconforto da última vez: repita a carga e priorize a execução.', 'hold');
  }
  const allTop = last.sets.length >= n && lr.every(r => r >= ex.repMax);
  if (allTop) {
    if (ex.step > 0) {
      const w2 = w + ex.step;
      return out(w2, Array(n).fill(ex.repMin),
        `Você fez ${ex.repMax} reps em todas as séries: hora de subir para ${w2.toLocaleString('pt-BR')} kg.`, 'up');
    }
    return out(w, lr.map(r => r + 1), 'Topo da faixa em todas as séries: tente mais uma rep ou adicione carga.', 'up');
  }
  const below = lr.every(r => r < ex.repMin);
  if (below) {
    const prev = hist.at(-2);
    const prevBelow = prev && workWeight(prev.sets) >= w && prev.sets.every(s => s.r < ex.repMin);
    if (prevBelow && w > 0) {
      const w2 = Math.max(0, roundStep(w * 0.9, ex.step));
      return out(w2, Array(n).fill(Math.round((ex.repMin + ex.repMax) / 2)),
        'Duas sessões abaixo da faixa de reps: reduza cerca de 10% e reconstrua com boa execução.', 'down');
    }
    return out(w, lr.map(r => r + 1), 'Abaixo da faixa: ganhe 1 rep por série antes de mexer na carga.', 'hold');
  }
  if (last.feel === 'fail') {
    return out(w, lr, 'Você foi até a falha da última vez: repita os mesmos números com mais folga.', 'hold');
  }
  if (last.feel === 'easy') {
    return out(w, lr.map(r => Math.min(ex.repMax, r + 1)), 'Estava fácil: +1 rep em todas as séries.', 'reps');
  }
  const min = Math.min(...lr);
  const i = lr.indexOf(min);
  const reps = lr.map((r, j) => (j === i ? Math.min(ex.repMax, r + 1) : r));
  return out(w, reps, `Mesma carga, +1 rep na ${i + 1}ª série.`, 'reps');
}

// ---------- Metas por exercício ----------

/** Converte um 1RM estimado em uma série concreta (carga × reps). */
export function toSet(E, ex, w0) {
  let w = w0 > 0 ? w0 : 0;
  if (w <= 0) return { w: 0, r: Math.max(1, Math.ceil(E - 1e-9)) };
  let r = Math.ceil(30 * (E / w - 1) - 1e-9);
  let guard = 0;
  while (r > ex.repMax && ex.step > 0 && guard++ < 200) {
    w += ex.step;
    r = Math.ceil(30 * (E / w - 1) - 1e-9);
  }
  return { w, r: Math.max(1, r) };
}

export function currentWeight(ex) {
  const last = entriesFor(ex.id).at(-1);
  return last ? workWeight(last.sets) : (ex.startW ?? 0);
}

/** Sugestão de meta mensal: cerca de 5% acima do melhor resultado recente. */
export function suggestGoal(ex) {
  const now = new Date();
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  if (!best) return null;
  const E = e1rm(best.w, best.r) * 1.05;
  if (best.w <= 0) return { w: 0, r: Math.ceil(E) };
  // tenta manter a carga e ganhar reps; se passar da faixa, sobe a carga
  return toSet(E, ex, best.w);
}

const pad2 = n => String(n).padStart(2, '0');
/** Identifica a semana (segunda-feira) como texto, ex.: "2026-11-09". */
export const weekKey = (d = new Date()) => { const w = weekStart(d); return `${w.getFullYear()}-${pad2(w.getMonth() + 1)}-${pad2(w.getDate())}`; };

/** Cria a meta do mês de um exercício, usando o melhor resultado recente como ponto de partida. */
export function setExGoal(ex, w, r, now = new Date()) {
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  const T = e1rm(w, r);
  state.goals.ex[ex.id] = {
    w, r, month: monthKey(now), created: now.toISOString(),
    base: best ? Math.min(e1rm(best.w, best.r), T) : T * 0.9,
  };
}

/** Meta da semana calculada pelo app, ignorando ajuste manual. */
export const autoWeekSet = (ex, now = new Date()) => exGoalStatus(ex, now, { auto: true })?.weekSet ?? null;

/** Define a meta desta semana à mão. Igual ao cálculo automático = volta ao automático. */
export function setWeekOverride(ex, w, r, now = new Date()) {
  const g = state.goals.ex[ex.id];
  if (!g) return;
  const a = autoWeekSet(ex, now);
  if (a && a.w === w && a.r === r) delete g.weekOverride;
  else g.weekOverride = { week: weekKey(now), w, r };
}

export function exGoalStatus(ex, now = new Date(), opts = {}) {
  const g = state.goals.ex[ex.id];
  if (!g) return null;
  const T = e1rm(g.w, g.r);
  const [y, m] = g.month.split('-').map(Number);
  const ms = new Date(y, m - 1, 1);
  const me = monthEnd(ms);
  const expired = g.month !== monthKey(now);
  const ws0 = weekStart(new Date(g.created));
  const n = Math.max(1, Math.ceil((me - ws0) / (7 * DAY)));
  const k = Math.min(n, Math.max(1, Math.floor((weekStart(now) - ws0) / (7 * DAY)) + 1));
  const base = g.base ?? 0;
  const ov = !opts.auto && g.weekOverride?.week === weekKey(now) ? g.weekOverride : null;
  const weekE = ov ? e1rm(ov.w, ov.r) : base + (T - base) * (k / n);
  const ws = weekStart(now);
  const bw = bestInRange(ex.id, ws, addDays(ws, 7));
  const bm = bestInRange(ex.id, ms, me);
  const pct = (best, target) => {
    if (!best) return 0;
    const b = e1rm(best.w, best.r);
    if (target <= base) return b >= target ? 1 : 0;
    return Math.max(0, Math.min(1, (b - base) / (target - base)));
  };
  const weekSet = ov ? { w: ov.w, r: ov.r } : k >= n ? { w: g.w, r: g.r } : toSet(weekE, ex, currentWeight(ex) || g.w);
  return {
    goal: g, expired, week: k, weeks: n, weekManual: !!ov,
    weekSet, weekBest: bw, weekPct: pct(bw, weekE), weekDone: !!bw && e1rm(bw.w, bw.r) >= weekE - 1e-6,
    monthBest: bm, monthPct: pct(bm, T), monthDone: !!bm && e1rm(bm.w, bm.r) >= T - 1e-6,
  };
}

// ---------- Metas por grupamento ----------

export function groupSets(a, b) {
  const m = {};
  for (const s of sessionsIn(a, b)) {
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      if (!ex || e.skipped) continue;
      m[ex.group] = (m[ex.group] || 0) + e.sets.filter(x => x.r > 0).length;
    }
  }
  return m;
}

export function groupTonnage(a, b) {
  const m = {};
  for (const s of sessionsIn(a, b)) {
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      if (!ex || e.skipped) continue;
      m[ex.group] = (m[ex.group] || 0) + tonnage(e.sets);
    }
  }
  return m;
}

/** Séries por semana que a rotina atual entrega se cada treino for feito 1x. */
export function routineGroupSets() {
  const m = {};
  for (const r of state.routines) {
    for (const id of r.ex) {
      const ex = state.exercises[id];
      if (ex) m[ex.group] = (m[ex.group] || 0) + ex.sets;
    }
  }
  return m;
}

/**
 * Metas de grupamento que acompanham a rotina (cumprir o plano = bater a meta).
 * As automáticas mudam quando a rotina muda; as que você editou ficam como estão.
 */
export function defaultGroupGoals(now = new Date()) {
  const per = routineGroupSets();
  for (const [g, n] of Object.entries(per)) {
    const cur = state.goals.groups[g];
    if (cur && cur.auto === false) continue;
    state.goals.groups[g] = { week: n, month: Math.round(n * daysInMonth(now) / 7), auto: true };
  }
  for (const [g, cur] of Object.entries(state.goals.groups)) {
    if (cur.auto !== false && !per[g]) delete state.goals.groups[g];
  }
}

export function groupGoalStatus(now = new Date()) {
  const ws = weekStart(now);
  const week = groupSets(ws, addDays(ws, 7));
  const month = groupSets(monthStart(now), monthEnd(now));
  const ton = groupTonnage(monthStart(now), monthEnd(now));
  const groups = new Set([...Object.keys(state.goals.groups), ...Object.keys(routineGroupSets())]);
  return [...groups].map(g => {
    const goal = state.goals.groups[g] || {};
    return {
      group: g,
      weekDone: week[g] || 0, weekGoal: goal.week || 0,
      monthDone: month[g] || 0, monthGoal: goal.month || 0,
      monthTon: ton[g] || 0,
    };
  });
}

// ---------- Estatísticas ----------

export function weekSeries(nWeeks = 8, now = new Date()) {
  const out = [];
  const ws = weekStart(now);
  for (let i = nWeeks - 1; i >= 0; i--) {
    const a = addDays(ws, -7 * i);
    const ss = sessionsIn(a, addDays(a, 7));
    let sets = 0, ton = 0;
    for (const s of ss) for (const e of s.entries) if (!e.skipped) { sets += e.sets.length; ton += tonnage(e.sets); }
    out.push({ start: a, sets, ton, workouts: ss.length });
  }
  return out;
}

/** Recordes de um treino em relação a todo o histórico anterior a ele. */
export function sessionPRs(session) {
  const prs = [];
  for (const e of session.entries) {
    if (e.skipped || !e.sets.length) continue;
    let prev = 0, any = false;
    for (const s of state.sessions) {
      if (s.id === session.id || new Date(s.date) >= new Date(session.date)) continue;
      for (const pe of s.entries) if (pe.exId === e.exId && pe.sets.length) { any = true; prev = Math.max(prev, bestOf(pe.sets)); }
    }
    const cur = bestOf(e.sets);
    if (any && cur > prev + 1e-6) {
      const top = e.sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
      prs.push({ exId: e.exId, set: top });
    }
  }
  return prs;
}

export function monthPRCount(now = new Date()) {
  return sessionsIn(monthStart(now), monthEnd(now)).reduce((n, s) => n + sessionPRs(s).length, 0);
}
