// Metas de carga do mês em 3 cenários (conservador, moderado, difícil porém possível) e o veredito
// para uma meta escolhida pela pessoa. O ritmo vem do nível dela: quem está começando evolui mais rápido.
import { state } from './store.js';
import { e1rm, toSet, bestInRange, addDays, entriesFor } from './logic.js';
import { strengthLevel, quickLevel, profile } from './body.js';
import { imperial, snapW } from './units.js';

// ganho de força (1RM estimado) por mês, por nível (percentil): [conservador, moderado, difícil]
const RATES = [[50, [0.025, 0.05, 0.08]], [80, [0.015, 0.03, 0.05]], [95, [0.01, 0.02, 0.035]], [101, [0.005, 0.01, 0.02]]];
export const SCENARIOS = ['conservador', 'moderado', 'dificil'];
const CHANCE = [0.85, 0.6, 0.3];

/** Melhor série recente (45 dias) e a base de comparação. Null sem histórico. */
function baseOf(ex, now) {
  const best = bestInRange(ex.id, addDays(now, -45), addDays(now, 1));
  return best ? { best, base: e1rm(best.w, best.r) } : null;
}

/** Ritmos do mês para este exercício e esta pessoa. */
export function rates(ex) {
  const lv = strengthLevel(ex, profile());
  const pct = lv.pct ?? (entriesFor(ex.id).length < 12 ? 30 : 65); // sem percentil: experiência no exercício
  const r = RATES.find(([lim]) => pct < lim)[1];
  const slow = state.intent?.goal === 'emagrecer' ? 0.5 : 1; // emagrecendo, o foco é manter a força
  return r.map(x => x * slow);
}

/** Os 3 cenários: [{ key, growth, set: { w, r }, top, chance }]. Null sem histórico recente. */
export function scenarios(ex, now = new Date()) {
  const b = baseOf(ex, now);
  if (!b) return null;
  const bwReps = !(b.best.w > 0); // só repetições (peso corporal): o ganho vem em reps, mais rápido
  return rates(ex).map((g, i) => {
    const growth = bwReps ? g * 3 : g;
    let set = toSet(b.base * (1 + growth), ex, b.best.w);
    if (set.w > 0 && imperial()) set = { ...set, w: snapW(set.w, ex.step) };
    const top = ex.lib && profile() ? quickLevel(ex.lib, set.w, set.r)?.top ?? null : null;
    return { key: SCENARIOS[i], growth, set, top, chance: CHANCE[i] };
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
