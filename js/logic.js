// Regras de progressão de carga, metas e estatísticas.
import { state } from './store.js';
import { t as tr, locale } from './i18n.js';
import { imperial, toW, fromW, toStep, snapW, ul } from './units.js';
import { muscleShares } from './shares.js';

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

/**
 * Séries que contam como trabalho: tira as muito leves (abaixo de 60% da maior carga do exercício
 * naquele treino), que são quase sempre aquecimento não marcado. Drop sets (-20 a -30%) continuam valendo.
 */
export const workSets = sets => {
  const top = Math.max(0, ...sets.map(s => s.w || 0));
  return top > 0 ? sets.filter(s => !(s.w > 0 && s.w < top * 0.6)) : sets;
};

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
/**
 * Próximo treino do exercício. Calcula a progressão normal e, se houver meta do mês ativa e a sugestão
 * ficar abaixo do degrau desta semana, puxa até ele: no máximo um degrau de carga por treino, o resto em reps.
 * Não empurra quando a progressão manda segurar ou reduzir (dor, falha, abaixo da faixa).
 */
export function planFor(ex, now = new Date()) {
  return towardGoal(ex, basePlan(ex), now);
}

function towardGoal(ex, p, now) {
  if (p.first || !['reps', 'up'].includes(p.kind) || !state.goals.ex[ex.id]) return p;
  const st = exGoalStatus(ex, now);
  if (!st || st.expired || st.weekDone) return p;
  const tgt = st.weekSet;
  if (!tgt || !(tgt.w > 0) || !(p.w > 0)) return p;
  const targetE = e1rm(tgt.w, tgt.r);
  if (e1rm(p.w, Math.max(...p.reps)) >= targetE - 1e-6) return { ...p, goal: tgt };
  const up = imperial() ? fromW(toW(p.w) + toStep(ex.step || 2.5)) : p.w + (ex.step > 0 ? ex.step : 0);
  const w = Math.max(p.w, Math.min(tgt.w, up));
  const r1 = Math.min(ex.repMax + 2, Math.max(1, Math.ceil(30 * (targetE / w - 1) - 1e-9)));
  const reps = w > p.w
    ? p.reps.map((_, i) => (i === 0 ? r1 : Math.max(ex.repMin, r1 - 1)))
    : p.reps.map((r, i) => (i === 0 ? Math.max(r, r1) : r));
  const setTxt = ul(`${toW(w).toLocaleString(locale())} kg × ${reps[0]}`);
  return { ...p, w, reps, kind: 'goal', goal: tgt, note: tr('Rumo à meta da semana: {set} na primeira série.', { set: setTxt }) };
}

function basePlan(ex) {
  // treinos em que o aparelho foi trocado não servem de base para a próxima carga
  const hist = entriesFor(ex.id).filter(e => !(e.flags || []).includes('troca'));
  // cargas importadas do bloco de notas valem como "treino anterior" até haver um treino mais novo
  if (ex.ref?.sets?.length && (!hist.length || new Date(ex.ref.date) > new Date(hist.at(-1).date))) {
    hist.push({ exId: ex.id, sets: ex.ref.sets, date: ex.ref.date, flags: [], ref: true });
  }
  const lastRaw = hist.at(-1);
  const last = lastRaw && { ...lastRaw, sets: workSets(lastRaw.sets) };
  const n = ex.sets;
  if (!last) {
    return {
      w: ex.startW ?? 0, reps: Array(n).fill(ex.repMin), first: true,
      note: tr('Primeira vez: ajuste a carga na primeira série e ela fica salva para os próximos treinos.'),
    };
  }
  const w = workWeight(last.sets);
  const lr = fit(last.sets.map(s => s.r), n);
  const lastTxt = { w, reps: last.sets.map(s => s.r), date: last.date };
  const out = (w2, reps, note, kind) => ({ w: w2, reps, note, kind, last: lastTxt });

  if ((last.flags || []).includes('dor')) {
    return out(w, lr, tr('Você marcou dor ou desconforto da última vez: repita a carga e priorize a execução.'), 'hold');
  }
  const allTop = last.sets.length >= n && lr.every(r => r >= ex.repMax);
  if (allTop) {
    if (ex.step > 0) {
      // em libras sobe um degrau de libra (135 -> 140 lb), sem cair em pesos quebrados
      const w2 = imperial() ? fromW(toW(w) + toStep(ex.step)) : w + ex.step;
      // recomeço inteligente: com a carga nova, as reps saem da força que você mostrou (série mais fraca),
      // e não do início da faixa. Ex.: 80 kg × 10 ≈ 1RM 107 kg → 82,5 kg × 8, e não × 6.
      // Fica pelo menos 1 rep abaixo do topo, para a progressão continuar existindo.
      const E = e1rm(w, Math.min(...lr));
      const fitR = Math.floor(30 * (E / w2 - 1) + 1e-9);
      const r = Math.max(ex.repMin, Math.min(Math.max(ex.repMin, ex.repMax - 1), fitR));
      return out(w2, Array(n).fill(r),
        ul(tr('Você fez {n} reps em todas as séries: suba para {w} kg × {r}, o mesmo nível de força com mais carga.', { n: ex.repMax, w: toW(w2).toLocaleString(locale()), r })), 'up');
    }
    return out(w, lr.map(r => r + 1), tr('Topo da faixa em todas as séries: tente mais uma rep ou adicione carga.'), 'up');
  }
  const below = lr.every(r => r < ex.repMin);
  if (below) {
    const prev = hist.at(-2);
    const prevBelow = prev && workWeight(workSets(prev.sets)) >= w && workSets(prev.sets).every(s => s.r < ex.repMin);
    if (prevBelow && w > 0) {
      const w2 = Math.max(0, imperial() ? snapW(w * 0.9, ex.step) : roundStep(w * 0.9, ex.step));
      return out(w2, Array(n).fill(Math.round((ex.repMin + ex.repMax) / 2)),
        tr('Duas sessões abaixo da faixa de reps: reduza cerca de 10% e reconstrua com boa execução.'), 'down');
    }
    return out(w, lr.map(r => r + 1), tr('Abaixo da faixa: ganhe 1 rep por série antes de mexer na carga.'), 'hold');
  }
  if (last.feel === 'fail') {
    return out(w, lr, tr('Você foi até a falha da última vez: repita os mesmos números com mais folga.'), 'hold');
  }
  // RIR (reps que sobraram), quando informado: muita folga acelera, nenhuma folga segura
  const rirs = last.sets.map(s => s.rir).filter(v => v != null);
  if (rirs.length) {
    if (Math.min(...rirs) >= 3) {
      return out(w, lr.map(r => Math.min(ex.repMax, r + 2)), tr('Sobraram 3 ou mais reps em todas as séries: +2 reps em cada uma.'), 'reps');
    }
    if (rirs.at(-1) === 0) {
      return out(w, lr, tr('Na última série não sobrou nenhuma rep: repita os mesmos números e ganhe folga.'), 'hold');
    }
  }
  if (last.feel === 'easy') {
    return out(w, lr.map(r => Math.min(ex.repMax, r + 1)), tr('Estava fácil: +1 rep em todas as séries.'), 'reps');
  }
  const min = Math.min(...lr);
  const i = lr.indexOf(min);
  const reps = lr.map((r, j) => (j === i ? Math.min(ex.repMax, r + 1) : r));
  return out(w, reps, tr('Mesma carga, +1 rep na {n}ª série.', { n: i + 1 }), 'reps');
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

/** Sugestão de meta mensal: um pouco acima do melhor resultado recente (padrão +5%; growth 1 = manter). */
export function suggestGoal(ex, growth = 1.05) {
  const now = new Date();
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  if (!best) return null;
  const E = e1rm(best.w, best.r) * growth;
  if (best.w <= 0) return { w: 0, r: Math.ceil(E) };
  // tenta manter a carga e ganhar reps; se passar da faixa, sobe a carga
  return toSet(E, ex, best.w);
}

const pad2 = n => String(n).padStart(2, '0');
/** Identifica a semana (segunda-feira) como texto, ex.: "2026-11-09". */
export const weekKey = (d = new Date()) => { const w = weekStart(d); return `${w.getFullYear()}-${pad2(w.getMonth() + 1)}-${pad2(w.getDate())}`; };

/** Prazo das metas de carga: 30 dias corridos a partir da escolha. */
export const GOAL_DAYS = 30;
/** Cria a meta de 30 dias de um exercício, usando o melhor resultado recente como ponto de partida. */
export function setExGoal(ex, w, r, now = new Date()) {
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  const T = e1rm(w, r);
  const until = addDays(now, GOAL_DAYS);
  until.setHours(23, 59, 59, 999);
  state.goals.ex[ex.id] = {
    w, r, month: monthKey(now), created: now.toISOString(), until: until.toISOString(),
    base: best ? Math.min(e1rm(best.w, best.r), T) : T * 0.9,
  };
}
/** Prazo da meta. Metas antigas, sem prazo gravado, também ganham 30 dias desde a criação. */
export function goalUntil(g) {
  if (g.until) return new Date(g.until);
  const d = addDays(new Date(g.created), GOAL_DAYS);
  d.setHours(23, 59, 59, 999);
  return d;
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
  // janela da meta: do dia em que foi criada até o prazo (30 dias corridos)
  const ms = new Date(g.created); ms.setHours(0, 0, 0, 0);
  const me = goalUntil(g);
  const expired = now > me;
  const ws0 = weekStart(new Date(g.created));
  // degraus semanais até o prazo (cerca de 5 numa meta de 30 dias)
  const n = Math.max(1, Math.ceil((me - ws0) / (7 * DAY)));
  const k = Math.min(n, Math.max(1, Math.floor((weekStart(now) - ws0) / (7 * DAY)) + 1));
  const base = g.base ?? 0;
  const ov = !opts.auto && g.weekOverride?.week === weekKey(now) ? g.weekOverride : null;
  const weekE = ov ? e1rm(ov.w, ov.r) : base + (T - base) * (k / n);
  const ws = weekStart(now);
  const bw = bestInRange(ex.id, ws, addDays(ws, 7));
  const bm = bestInRange(ex.id, ms, addDays(me, 1));
  const pct = (best, target) => {
    if (!best) return 0;
    const b = e1rm(best.w, best.r);
    if (target <= base) return b >= target ? 1 : 0;
    return Math.max(0, Math.min(1, (b - base) / (target - base)));
  };
  const weekSet = ov ? { w: ov.w, r: ov.r } : k >= n ? { w: g.w, r: g.r } : toSet(weekE, ex, currentWeight(ex) || g.w);
  return {
    goal: g, expired, until: me, daysLeft: Math.max(0, Math.ceil((me - now) / DAY)), week: k, weeks: n, weekManual: !!ov,
    weekSet, weekBest: bw, weekPct: pct(bw, weekE), weekDone: !!bw && e1rm(bw.w, bw.r) >= weekE - 1e-6,
    monthBest: bm, monthPct: pct(bm, T), monthDone: !!bm && e1rm(bm.w, bm.r) >= T - 1e-6,
  };
}

// ---------- Metas por grupamento ----------

/**
 * Série efetiva (a que conta para o volume): carga de pelo menos 60% da força estimada no exercício
 * (cerca de 20 reps até a falha) e, se as reps que sobraram foram anotadas, no máximo 4.
 * top = melhor 1RM estimado do exercício nos 90 dias até a data.
 */
export const EFFECTIVE_LOAD = 0.6;
export const isEffective = (s, top) => s.r > 0 && (s.rir == null || s.rir <= 4) && (!(s.w > 0) || !(top > 0) || s.w >= top * EFFECTIVE_LOAD);
const topBefore = (exId, until) => {
  const from = addDays(until, -90);
  let top = 0;
  for (const e of entriesFor(exId)) {
    const d = new Date(e.date);
    if (d < from || d > until) continue;
    for (const s of e.sets) if (s.w > 0) top = Math.max(top, e1rm(s.w, s.r));
  }
  return top;
};

export function groupSets(a, b) {
  const m = {};
  const tops = new Map();
  for (const s of sessionsIn(a, b)) {
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      if (!ex || e.skipped) continue;
      if (!tops.has(ex.id)) tops.set(ex.id, topBefore(ex.id, b));
      const n = workSets(e.sets).filter(x => isEffective(x, tops.get(ex.id))).length;
      // contagem fracionada: o principal conta 1 série; os auxiliares, a fração deles
      for (const [g, share] of muscleShares(ex)) m[g] = (m[g] || 0) + n * share;
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
      m[ex.group] = (m[ex.group] || 0) + tonnage(workSets(e.sets));
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
      if (ex) for (const [g, share] of muscleShares(ex)) m[g] = (m[g] || 0) + ex.sets * share;
    }
  }
  return m;
}

/**
 * Metas de grupamento: com objetivo, pela tabela dele; sem objetivo, pela ciência (10 séries por semana,
 * 7 nos grupos pequenos) para cada grupo que está nas fichas. As que você editou ficam como estão.
 */
/**
 * Planos por objetivo: séries por semana em cada grupo (base e priorizados), crescimento da meta de carga
 * do mês e minutos de cardio por semana. Grupos pequenos (braços, panturrilhas, abdômen) recebem 3/4.
 */
/**
 * Séries efetivas por semana para cada grupamento grande, por objetivo: [conservador, moderado, difícil].
 * Base científica: ≥10 séries/semana geram mais hipertrofia que <5 (Schoenfeld, Ogborn e Krieger, 2017); para
 * quem já treina, 12 a 20 séries por músculo (Baz-Valle e cols., 2022); o ganho segue subindo com o volume, mas
 * com retornos decrescentes, e a força satura antes da hipertrofia (meta-regressões de Pelland e cols., 2024).
 * Marcos práticos (volume mínimo efetivo, faixa adaptativa e máximo recuperável, como os de Israetel) para peito/costas:
 * ~8, 12–20 e ~22. Grupos priorizados usam a segunda linha. Grupos pequenos (bíceps, tríceps, panturrilha, abdômen)
 * já recebem volume indireto dos compostos: 3/4 do valor.
 */
export const GOAL_PLANS = {
  massa: { vol: [10, 14, 20], focusVol: [14, 18, 22], base: 14, focus: 18, growth: 1.05, cardio: 90 },
  forca: { vol: [8, 10, 14], focusVol: [10, 14, 18], base: 10, focus: 14, growth: 1.05, cardio: 60 },
  emagrecer: { vol: [8, 10, 14], focusVol: [10, 14, 18], base: 10, focus: 14, growth: 1, cardio: 225 },
  saude: { vol: [6, 10, 12], focusVol: [8, 12, 14], base: 10, focus: 12, growth: 1.025, cardio: 150 },
};
const NO_GOAL_VOL = [8, 10, 14];
/** Opções de prioridade e os grupamentos que cada uma inclui. */
export const FOCUS_GROUPS = {
  Peito: ['Peito'], Costas: ['Costas'], Ombros: ['Ombros'], 'Braços': ['Bíceps', 'Tríceps'],
  Pernas: ['Quadríceps', 'Posteriores'], 'Glúteos': ['Glúteos'], Panturrilhas: ['Panturrilhas'], 'Abdômen': ['Abdômen'],
};
const SMALL_GROUPS = ['Bíceps', 'Tríceps', 'Panturrilhas', 'Abdômen'];
/** Meta semanal de séries de um grupo para o objetivo (null sem objetivo). */
export function intentWeekSets(group, it = state.intent) {
  const plan = it && GOAL_PLANS[it.goal];
  if (!plan) return null;
  const focus = (it.focus || []).flatMap(f => FOCUS_GROUPS[f] || []).includes(group);
  const n = (focus ? plan.focusVol : plan.vol)[1];
  return Math.round(SMALL_GROUPS.includes(group) ? n * 0.75 : n);
}

/**
 * Três metas de séries por semana para um grupo (conservador, moderado, difícil).
 * Moderado = o do objetivo (ou 10, 7 nos grupos pequenos). Acima de ~20 séries o ganho extra é pequeno.
 */
export function groupScenarios(group, it = state.intent) {
  const plan = it && GOAL_PLANS[it.goal];
  const focus = plan && (it.focus || []).flatMap(f => FOCUS_GROUPS[f] || []).includes(group);
  const vol = plan ? (focus ? plan.focusVol : plan.vol) : NO_GOAL_VOL;
  const small = SMALL_GROUPS.includes(group);
  const n = vol.map(v => Math.max(4, Math.round(small ? v * 0.75 : v)));
  return [{ key: 'conservador', n: n[0] }, { key: 'moderado', n: n[1] }, { key: 'dificil', n: n[2] }];
}

/** Três metas de cardio por semana, em minutos, a partir do objetivo (ou dos 150 da OMS). */
export function cardioScenarios(it = state.intent) {
  const mod = (it && GOAL_PLANS[it.goal]?.cardio) || 150;
  const r15 = x => Math.round(x / 15) * 15;
  return [{ key: 'conservador', n: Math.max(60, r15(mod * 0.6)) }, { key: 'moderado', n: mod }, { key: 'dificil', n: Math.min(420, Math.max(300, r15(mod * 1.4))) }];
}

export function defaultGroupGoals(now = new Date()) {
  const it = state.intent && GOAL_PLANS[state.intent.goal] ? state.intent : null;
  if (it) {
    // com objetivo: os grupos dos treinos e os priorizados recebem a meta do objetivo
    const groups = new Set([...Object.keys(routineGroupSets()), ...(it.focus || []).flatMap(f => FOCUS_GROUPS[f] || [])]);
    for (const g of groups) {
      if (state.goals.groups[g]?.auto === false) continue;
      const n = intentWeekSets(g, it);
      state.goals.groups[g] = { week: n, month: Math.round(n * daysInMonth(now) / 7), auto: true };
    }
    for (const [g, cur] of Object.entries(state.goals.groups)) if (cur.auto !== false && !groups.has(g)) delete state.goals.groups[g];
    return;
  }
  const per = routineGroupSets();
  for (const g of Object.keys(per)) {
    const cur = state.goals.groups[g];
    if (cur && cur.auto === false) continue;
    // sem objetivo: o moderado geral (10 séries; 3/4 nos grupos pequenos)
    const n = Math.round(SMALL_GROUPS.includes(g) ? NO_GOAL_VOL[1] * 0.75 : NO_GOAL_VOL[1]);
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
    for (const s of ss) for (const e of s.entries) if (!e.skipped) { const w = workSets(e.sets); sets += w.length; ton += tonnage(w); }
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

/**
 * Exercícios parados: 3 treinos seguidos sem superar a melhor força dos treinos anteriores
 * (e o último foi nos últimos 30 dias). Devolve [{ ex, n, best, since }].
 */
export function stalledExercises(now = new Date()) {
  const out = [];
  for (const ex of Object.values(state.exercises)) {
    const hist = entriesFor(ex.id).filter(e => !(e.flags || []).includes('troca'));
    if (hist.length < 4) continue;
    if ((now - new Date(hist.at(-1).date)) / 864e5 > 30) continue;
    const before = Math.max(...hist.slice(0, -3).map(h => bestOf(workSets(h.sets))));
    const recent = hist.slice(-3);
    if (recent.every(h => bestOf(workSets(h.sets)) <= before + 1e-6)) {
      // treinos desde que o melhor foi alcançado pela primeira vez
      const bestIdx = hist.findIndex(h => bestOf(workSets(h.sets)) >= before - 1e-6);
      out.push({ ex, n: hist.length - 1 - bestIdx, best: before });
    }
  }
  return out.sort((a, b) => b.n - a.n);
}

/**
 * Proposta para a ficha entregar a meta semanal de um grupo: +1 série por vez no exercício do grupo com
 * menos séries (até 6 cada). Devolve { have, goal, plan: [{ ex, from, to }] } ou null se já entrega.
 */
export function fillPlan(group, goal) {
  const have = routineGroupSets()[group] || 0;
  if (!goal || have >= goal) return null;
  const uses = {};
  for (const r of state.routines) for (const id of r.ex) if (state.exercises[id]?.group === group) uses[id] = (uses[id] || 0) + 1;
  const sets = Object.fromEntries(Object.keys(uses).map(id => [id, state.exercises[id].sets]));
  let total = have;
  while (total < goal) {
    const next = Object.keys(sets).filter(id => sets[id] < 6).sort((a, b) => sets[a] - sets[b])[0];
    if (!next) break;
    sets[next]++;
    total += uses[next];
  }
  const plan = Object.keys(sets).filter(id => sets[id] !== state.exercises[id].sets).map(id => ({ ex: state.exercises[id], from: state.exercises[id].sets, to: sets[id] }));
  return { have, goal, total, plan };
}
