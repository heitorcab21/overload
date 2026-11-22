// Regras de progressão de carga, metas e estatísticas.
import { state } from './store.js';
import { t as tr, locale } from './i18n.js';
import { imperial, toW, fromW, toStep, snapW, ul } from './units.js';
import { muscleShares } from './shares.js';
import { LOAD_TYPE, GYM_BOUND } from './loads.js';

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
      if (e.exId === exId && !e.skipped && e.sets.length) out.push({ ...e, date: s.date, gym: s.gym });
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
/** Arredonda uma carga para o degrau do exercício (em libras, para os pesos que existem na academia). */
export const snapLoad = (v, ex) => Math.max(0, imperial() ? snapW(v, ex.step) : +roundStep(v, ex.step).toFixed(2));
/** Reduz uma carga por um fator (0,9 = 10% a menos), caindo pelo menos um degrau: com degraus grandes (5 kg), 10% de 25 kg arredondaria de volta para 25. */
export function cutLoad(w, f, ex) {
  const x = snapLoad(w * f, ex);
  return x < w || !(ex.step > 0) ? x : snapLoad(Math.max(0, w - ex.step), ex);
}

// ---------- Academias ----------
// Quem treina em mais de um lugar: nas máquinas e polias a carga de uma academia não vale na outra.
// Treinos sem academia marcada (os de antes do cadastro) contam como da primeira academia.

export const gyms = () => state.gyms || [];
export function currentGym() {
  const g = gyms();
  return (g.find(x => x.id === state.settings.gym) || g[0])?.id ?? null;
}
/** A carga deste exercício depende do aparelho (e por isso da academia)? */
export const gymBound = ex => GYM_BOUND.has(LOAD_TYPE[ex?.lib || ex?.base]);

/**
 * Histórico que serve de base para a progressão: sem os treinos em que o aparelho foi trocado nem os de dia ruim;
 * nas máquinas, com 2 ou mais academias, só os da academia escolhida. Devolve { hist, other }: other é o último
 * treino em outra academia, quando nesta ainda não há nenhum.
 */
export function baseHistory(ex, gym = currentGym()) {
  const all = entriesFor(ex.id).filter(e => !(e.flags || []).some(f => f === 'troca' || f === 'ruim'));
  const g = gyms();
  if (g.length < 2 || !gymBound(ex)) return { hist: all, other: null };
  const here = all.filter(e => (e.gym || g[0].id) === gym);
  return { hist: here, other: here.length ? null : all.at(-1) ?? null };
}

// ---------- Pausas ----------
// Força e massa se mantêm bem por umas 3 semanas sem treino e caem aos poucos depois (Mujika e Padilla, 2000;
// Bosquet e cols., 2013). Ao voltar, a força volta bem mais rápido do que levou para ser construída
// (Psilander e cols., 2019). Por isso: recua um pouco no primeiro treino e volta à carga de antes em poucos treinos.
export const PAUSE_DAYS = 14;
const pauseCut = days => (days >= 56 ? 0.7 : days >= 28 ? 0.8 : 0.9);
/** Treino de antes da última pausa, se a pausa terminou nos últimos 3 treinos. */
function beforePause(hist) {
  for (let i = hist.length - 1; i >= Math.max(1, hist.length - 3); i--) {
    if ((new Date(hist[i].date) - new Date(hist[i - 1].date)) / DAY >= PAUSE_DAYS) return hist[i - 1];
  }
  return null;
}
const fit = (reps, n) => Array.from({ length: n }, (_, i) => reps[i] ?? reps.at(-1));

/**
 * Próximo treino (dupla progressão: primeiro ganha repetições dentro da faixa, depois sobe a carga) do exercício. Calcula a progressão normal e, se houver meta do mês ativa e a sugestão
 * ficar abaixo do degrau desta semana, puxa até ele: no máximo um degrau de carga por treino, o resto em reps.
 * Não empurra quando a progressão manda segurar ou reduzir (dor, falha, abaixo da faixa).
 */
export function planFor(ex, now = new Date()) {
  return towardGoal(ex, basePlan(ex, now), now);
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

function basePlan(ex, now = new Date()) {
  // treinos em que o aparelho foi trocado e os de dia ruim não servem de base para a próxima carga
  const { hist, other } = baseHistory(ex);
  // cargas importadas do bloco de notas valem como "treino anterior" até haver um treino mais novo
  if (ex.ref?.sets?.length && (!hist.length || new Date(ex.ref.date) > new Date(hist.at(-1).date))) {
    hist.push({ exId: ex.id, sets: ex.ref.sets, date: ex.ref.date, flags: [], ref: true });
  }
  const lastRaw = hist.at(-1);
  const last = lastRaw && { ...lastRaw, sets: workSets(lastRaw.sets) };
  const n = ex.sets;
  const mid = Math.round((ex.repMin + ex.repMax) / 2);
  if (!last && other) {
    // máquina nova: parte da carga da outra academia, mas a primeira série decide
    const ow = workWeight(workSets(other.sets));
    return {
      w: ow, reps: Array(n).fill(mid), first: true, kind: 'gym',
      note: tr('Primeira vez nesta academia: a máquina pode pesar diferente. Comece pela carga da outra academia e ajuste na primeira série.'),
    };
  }
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

  // recomeço escolhido em "Exercícios parados" (recuar 10% ou mudar a faixa): vale até o próximo treino
  if (ex.reset && new Date(ex.reset.date) > new Date(last.date)) {
    const R = ex.reset, wt = toW(R.w).toLocaleString(locale());
    return out(R.w, Array(n).fill(R.r), ul(R.why === 'range'
      ? tr('Faixa nova de {a}–{b} reps: {w} kg × {r}, o mesmo nível de força com outra carga.', { a: ex.repMin, b: ex.repMax, w: wt, r: R.r })
      : tr('Recomeço planejado: {w} kg × {r}, cerca de 10% abaixo, para voltar a progredir com boa execução.', { w: wt, r: R.r })), 'reset');
  }

  // pausa: 14 dias ou mais sem este exercício (contando qualquer treino dele, inclusive dia ruim)
  const lastAny = entriesFor(ex.id).at(-1);
  const gap = lastAny && !last.ref ? Math.floor((now - new Date(lastAny.date)) / DAY) : 0;
  if (gap >= PAUSE_DAYS && w > 0) {
    const cut = pauseCut(gap);
    const w2 = cutLoad(w, cut, ex);
    return out(w2, Array(n).fill(mid), ul(tr('Você ficou {n} dias sem fazer este exercício: comece com {w} kg (cerca de {p}% a menos). A força volta rápido, em poucos treinos.',
      { n: gap, w: toW(w2).toLocaleString(locale()), p: Math.round((1 - cut) * 100) })), 'back');
  }

  // voltando da pausa: sobe metade do que falta para a carga de antes a cada treino (pelo menos um degrau)
  const pre = beforePause(hist);
  if (pre && ex.step > 0 && w > 0 && !(last.flags || []).includes('dor') && !lr.every(r => r < ex.repMin)) {
    const preW = workWeight(workSets(pre.sets));
    if (preW > w + 1e-6) {
      const up = imperial() ? fromW(toW(w) + toStep(ex.step)) : w + ex.step;
      const w2 = Math.min(preW, Math.max(up, snapLoad(w + (preW - w) / 2, ex)));
      const E = e1rm(w, Math.min(...lr));
      const r = Math.max(ex.repMin, Math.min(Math.max(ex.repMin, ex.repMax - 1), Math.floor(30 * (E / w2 - 1) + 1e-9)));
      return { ...out(w2, Array(n).fill(r), ul(tr('Voltando da pausa: {w} kg agora, a caminho dos {p} kg de antes.',
        { w: toW(w2).toLocaleString(locale()), p: toW(preW).toLocaleString(locale()) })), 'up'), pause: true };
    }
  }

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
  // "Como foi?" (fácil, até a falha) saiu do treino; vale para treinos antigos. Hoje o RIR faz esse papel.
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
/** Meta de séries de 30 dias a partir da meta semanal (30 dias = 30/7 semanas). */
export const sets30 = week => Math.round(week * GOAL_DAYS / 7);
/** Janela das metas de séries de 30 dias: os últimos 30 dias, hoje incluído. Devolve [início, fim exclusivo]. */
export function last30(now = new Date()) {
  const end = new Date(now); end.setHours(0, 0, 0, 0);
  return [addDays(end, 1 - GOAL_DAYS), addDays(end, 1)];
}
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
/**
 * Quanto uma série vale na contagem de volume, de 0 a 1. Série efetiva vale 1. As outras (aquecimento e séries leves)
 * valem uma fração pela distância da falha, estimada pela carga e pela sua força no exercício (Epley invertida):
 * até 4 reps sobrando conta inteira; daí cai em linha reta até 0 com 12 ou mais sobrando. O ganho de massa cai aos
 * poucos conforme a série termina mais longe da falha, sem um corte brusco (Robinson e cols., 2024; Refalo e cols., 2023).
 * Sem carga ou sem força de referência não dá para estimar a distância: o aquecimento fica em 0.
 * Arredonda para 0,05 para os números ficarem legíveis.
 */
export function setValue(s, top, warm = false) {
  if (!(s.r > 0)) return 0;
  if (!warm && isEffective(s, top)) return 1;
  if (!(s.w > 0) || !(top > 0)) return 0;
  const left = Math.max(0, 30 * (top / s.w - 1) - s.r, s.rir ?? 0);
  return Math.round(Math.max(0, Math.min(1, (12 - left) / 8)) * 20) / 20;
}
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
      // cada série vale de 0 a 1 (efetiva = 1; aquecimento e séries leves, pela distância da falha)
      const top = tops.get(ex.id);
      const n = e.sets.reduce((acc, x) => acc + setValue(x, top), 0) + (e.warmup || []).reduce((acc, x) => acc + setValue(x, top, true), 0);
      // contagem fracionada: o principal conta o valor da série; os auxiliares, esse valor × a fração deles
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
 * Planos por objetivo: séries efetivas por semana (vol e focusVol) e minutos de cardio por semana (cardio).
 * O ritmo das metas de carga não fica aqui: vem do nível da pessoa (scenarios.js).
 *
 * Séries efetivas por semana para cada grupamento grande, por objetivo: [conservador, moderado, difícil].
 * Base científica: ≥10 séries/semana geram mais hipertrofia que <5 (Schoenfeld, Ogborn e Krieger, 2017); para
 * quem já treina, 12 a 20 séries por músculo (Baz-Valle e cols., 2022); o ganho segue subindo com o volume, mas
 * com retornos decrescentes, e a força satura antes da hipertrofia (meta-regressões de Pelland e cols., 2024).
 * Marcos práticos (volume mínimo efetivo, faixa adaptativa e máximo recuperável, como os de Israetel) para peito/costas:
 * ~8, 12–20 e ~22. Grupos priorizados usam a segunda linha. Grupos pequenos (bíceps, tríceps, panturrilha, abdômen)
 * já recebem volume indireto dos compostos: 3/4 do valor.
 */
export const GOAL_PLANS = {
  massa: { vol: [10, 14, 20], focusVol: [14, 18, 22], cardio: 90 },
  forca: { vol: [8, 10, 14], focusVol: [10, 14, 18], cardio: 60 },
  emagrecer: { vol: [8, 10, 14], focusVol: [10, 14, 18], cardio: 225 },
  saude: { vol: [6, 10, 12], focusVol: [8, 12, 14], cardio: 150 },
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

/**
 * Metas de grupamento: com objetivo, pela tabela dele; sem objetivo, o moderado geral (10 séries por semana,
 * 3/4 nos grupos pequenos) para cada grupo que está nas fichas. As que você editou ficam como estão.
 */
export function defaultGroupGoals(now = new Date()) {
  const it = state.intent && GOAL_PLANS[state.intent.goal] ? state.intent : null;
  if (it) {
    // com objetivo: os grupos dos treinos e os priorizados recebem a meta do objetivo
    const groups = new Set([...Object.keys(routineGroupSets()), ...(it.focus || []).flatMap(f => FOCUS_GROUPS[f] || [])]);
    for (const g of groups) {
      if (state.goals.groups[g]?.auto === false) continue;
      const n = intentWeekSets(g, it);
      state.goals.groups[g] = { week: n, month: sets30(n), auto: true };
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
    state.goals.groups[g] = { week: n, month: sets30(n), auto: true };
  }
  for (const [g, cur] of Object.entries(state.goals.groups)) {
    if (cur.auto !== false && !per[g]) delete state.goals.groups[g];
  }
}

export function groupGoalStatus(now = new Date()) {
  const ws = weekStart(now);
  const week = groupSets(ws, addDays(ws, 7));
  // "30 dias" = os últimos 30 dias, o mesmo prazo das metas de carga (e não o mês do calendário)
  const [a30, b30] = last30(now);
  const month = groupSets(a30, b30);
  const ton = groupTonnage(a30, b30);
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
  return Object.values(state.exercises).map(ex => stallOf(ex, now)).filter(Boolean).sort((a, b) => b.n - a.n);
}

/**
 * Um exercício está parado? Mesma regra de stalledExercises, com o histórico base (sem dia ruim e, nas máquinas,
 * só desta academia) e só depois da última saída escolhida (recuar ou mudar a faixa), para o aviso recomeçar do zero.
 */
export function stallOf(ex, now = new Date()) {
  const fix = ex.stallFix ? new Date(ex.stallFix) : null;
  const hist = baseHistory(ex).hist.filter(e => !fix || new Date(e.date) > fix);
  if (hist.length < 4) return null;
  if ((now - new Date(hist.at(-1).date)) / DAY > 30) return null;
  const before = Math.max(...hist.slice(0, -3).map(h => bestOf(workSets(h.sets))));
  if (!hist.slice(-3).every(h => bestOf(workSets(h.sets)) <= before + 1e-6)) return null;
  // treinos desde que o melhor foi alcançado pela primeira vez
  const bestIdx = hist.findIndex(h => bestOf(workSets(h.sets)) >= before - 1e-6);
  return { ex, n: hist.length - 1 - bestIdx, best: before };
}

/** Saída do platô 1: recuar cerca de 10% e subir de novo. Grava o recomeço no exercício; devolve-o (ou null). */
export function planReset(ex, now = new Date()) {
  const last = baseHistory(ex).hist.at(-1);
  const w = last ? workWeight(workSets(last.sets)) : 0;
  if (!(w > 0) || !(ex.step > 0)) return null;
  ex.reset = { w: cutLoad(w, 0.9, ex), r: Math.round((ex.repMin + ex.repMax) / 2), date: now.toISOString(), why: 'down' };
  ex.stallFix = now.toISOString();
  return ex.reset;
}

/**
 * Saída do platô 2: mudar a faixa de reps em 2 (8–12 vira 6–10; 6–10 vira 8–12; nunca acima de 12).
 * A carga do próximo treino sai da força que você mostrou, como no recomeço inteligente. Devolve { lo, hi, reset }.
 */
export function shiftRange(ex, now = new Date()) {
  const [lo, hi] = ex.repMin >= 8 ? [ex.repMin - 2, ex.repMax - 2] : [ex.repMin + 2, Math.min(12, ex.repMax + 2)];
  const last = baseHistory(ex).hist.at(-1);
  const sets = last ? workSets(last.sets) : [];
  const w = workWeight(sets);
  ex.repMin = lo; ex.repMax = Math.max(lo + 1, hi); ex.repAuto = false;
  ex.stallFix = now.toISOString();
  delete ex.reset;
  if (w > 0 && ex.step > 0 && sets.length) {
    const E = e1rm(w, Math.min(...sets.map(s => s.r)));
    const w2 = snapLoad(E / (1 + (lo + 1) / 30), ex);
    const r = Math.max(lo, Math.min(ex.repMax - 1, Math.floor(30 * (E / w2 - 1) + 1e-9)));
    ex.reset = { w: w2, r, date: now.toISOString(), why: 'range' };
  }
  return { lo, hi: ex.repMax, reset: ex.reset || null };
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
