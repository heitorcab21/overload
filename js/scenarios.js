// Metas de carga do mês em 3 cenários (conservador, moderado, difícil porém possível) e o veredito
// para uma meta escolhida pela pessoa. O ritmo vem do nível dela: quem está começando evolui mais rápido.
import { state } from './store.js';
import { e1rm, toSet, bestInRange, addDays, entriesFor } from './logic.js';
import { maxLevel, quickLevel, profile, STRENGTH_LIFTS } from './body.js';
import { imperial, snapW } from './units.js';

// ganho de força (1RM estimado) por mês, por nível (percentil): [conservador, moderado, difícil]
const RATES = [[50, [0.025, 0.05, 0.08]], [80, [0.015, 0.03, 0.05]], [95, [0.01, 0.02, 0.035]], [101, [0.005, 0.01, 0.02]]];
export const SCENARIOS = ['conservador', 'moderado', 'dificil'];
const CHANCE = [0.85, 0.6, 0.3];

/**
 * Base de comparação: a melhor série dos últimos 45 dias; sem ela, a melhor de sempre.
 * Sem nenhum treino, estima (est): pela carga inicial informada ou, nos exercícios comparáveis,
 * pelos padrões de força de quem tem o mesmo peso, idade e sexo (nível de quem está começando).
 */
function baseOf(ex, now) {
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1)) || bestInRange(ex.id, new Date(0), addDays(now, 1));
  if (best) return { best, base: e1rm(best.w, best.r) };
  return estimateBase(ex);
}
const START_PCT = 30; // percentil de força usado para quem ainda não treinou o exercício
// carga de trabalho típica de quem está começando (8 a 10 reps), em fração do peso corporal; homens (mulheres: × 0,6 no tronco, × 0,8 nas pernas)
const START_RATIO = {
  'peck-deck': 0.35, 'puxada-frente': 0.55, 'remada-baixa': 0.55, 'elevacao-lateral': 0.14, 'face-pull': 0.2,
  'triceps-corda': 0.2, 'triceps-maquina': 0.3, 'triceps-testa': 0.25, 'leg-press': 1.0, 'mesa-flexora': 0.35, 'panturrilha-em-pe': 0.6,
};
const GROUP_RATIO = { Peito: 0.35, Costas: 0.5, Ombros: 0.2, 'Bíceps': 0.18, 'Tríceps': 0.22, 'Quadríceps': 0.5, Posteriores: 0.35, 'Glúteos': 0.6, Panturrilhas: 0.5 };
function estimateBase(ex) {
  const r = ex.repMin || 8;
  const step = ex.step > 0 ? ex.step : 2.5;
  const snap = w => Math.max(step, Math.round(w / step) * step);
  if (ex.startW > 0 && !ex.bw) return { best: { w: ex.startW, r }, base: e1rm(ex.startW, r), est: 'start' };
  const p = profile();
  const map = ex.lib && STRENGTH_LIFTS[ex.lib];
  // peso corporal: parte de algumas repetições e o ganho vem em reps
  if (ex.bw) return { best: { w: 0, r }, base: e1rm(0, r), est: 'reps' };
  if (!map || map[2]) {
    // aparelhos e polias não têm padrão de força: carga típica de quem está começando, em fração do peso corporal
    const kg = p?.weight || state.profile?.weight;
    const ratio = START_RATIO[ex.lib] ?? GROUP_RATIO[ex.group];
    if (!(kg > 0) || !ratio) return null;
    const lower = ['Quadríceps', 'Posteriores', 'Glúteos', 'Panturrilhas'].includes(ex.group);
    const sexF = (p?.sex || state.profile?.sex) === 'f' ? (lower ? 0.8 : 0.6) : 1;
    const w = snap(kg * ratio * sexF);
    return { best: { w, r }, base: e1rm(w, r), est: 'bw' };
  }
  if (!p) return null;
  // 1RM que dá o percentil START_PCT (busca binária: o percentil sobe com a carga)
  let lo = 1, hi = 500;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if ((quickLevel(ex.lib, mid, 1, p, 'sl')?.pct ?? 0) < START_PCT) lo = mid; else hi = mid;
  }
  const w = snap(hi / (1 + r / 30));
  return { best: { w, r }, base: e1rm(w, r), est: 'std' };
}

/** Ritmos do mês para este exercício e esta pessoa. */
export function rates(ex) {
  const lv = maxLevel(ex, profile());
  const pct = lv.pct ?? (entriesFor(ex.id).length < 12 ? 30 : 65); // sem percentil: experiência no exercício
  const r = RATES.find(([lim]) => pct < lim)[1];
  const slow = state.intent?.goal === 'emagrecer' ? 0.5 : 1; // emagrecendo, o foco é manter a força
  return r.map(x => x * slow);
}

/** Os 3 cenários: [{ key, growth, set: { w, r }, top, chance, est }]. Null quando não há como estimar. */
export function scenarios(ex, now = new Date()) {
  const b = baseOf(ex, now);
  if (!b) return null;
  const bwReps = !(b.best.w > 0); // só repetições (peso corporal): o ganho vem em reps, mais rápido
  return rates(ex).map((g, i) => {
    const growth = bwReps ? g * 3 : g;
    let set = toSet(b.base * (1 + growth), ex, b.best.w);
    if (set.w > 0 && imperial()) set = { ...set, w: snapW(set.w, ex.step) };
    const top = ex.lib && profile() ? quickLevel(ex.lib, set.w, set.r)?.top ?? null : null;
    return { key: SCENARIOS[i], growth, set, top, chance: CHANCE[i], est: b.est || null };
  });
}

/**
 * Veredito de uma meta da pessoa para o mês: 'facil', 'realista', 'ambiciosa', 'muito-dificil' ou 'ilusoria',
 * com o ganho pedido e o máximo realista (o cenário difícil). Null sem histórico.
 */
export function judgeGoal(ex, w, r, now = new Date()) {
  const b = baseOf(ex, now);
  const sc = scenarios(ex, now);
  if (!b || !sc) return null;
  const growth = e1rm(w, r) / b.base - 1;
  const [, mod, hard] = sc.map(s => s.growth);
  const level = growth <= 0 ? 'facil' : growth <= mod * 1.05 ? 'realista' : growth <= hard * 1.05 ? 'ambiciosa' : growth <= hard * 1.8 ? 'muito-dificil' : 'ilusoria';
  return { level, growth, max: hard };
}
