// Objetivo da pessoa (ganhar massa, força, emagrecer, saúde) e as metas que o app monta a partir dele:
// séries por grupo, metas de carga do mês (renovadas sozinhas), meta de cardio e treinos por semana.
import { state } from './store.js';
import { activeExercises } from './data.js';
import { defaultGroupGoals, exGoalStatus, setExGoal, suggestGoal, GOAL_PLANS, sessionsIn, weekStart, addDays } from './logic.js';

export const GOAL_IDS = ['massa', 'forca', 'emagrecer', 'saude'];
export const intent = () => (state.intent && GOAL_PLANS[state.intent.goal] ? state.intent : null);

/** Guarda o objetivo e refaz as metas automáticas (as que a pessoa editou à mão ficam como estão). */
export function saveIntent({ goal, focus = [], days = 3 }, now = new Date()) {
  state.intent = { goal, focus: [...new Set(focus)], days: Math.max(1, Math.min(7, Math.round(days))), set: now.toISOString() };
  state.cardioGoal = GOAL_PLANS[goal].cardio;
  defaultGroupGoals(now);
  return autoExGoals(now, true);
}

/**
 * Metas de carga do mês para os exercícios dos treinos atuais.
 * Cria as que faltam e renova as vencidas: bateu a meta, sobe de novo; errou dois meses seguidos, alivia
 * (a nova meta é manter o melhor recente). fresh = objetivo acabou de mudar: refaz também as automáticas do mês.
 * Devolve quantas metas foram criadas ou trocadas.
 */
export function autoExGoals(now = new Date(), fresh = false) {
  const it = intent();
  if (!it) return 0;
  let n = 0;
  for (const ex of activeExercises()) {
    const g = state.goals.ex[ex.id];
    const st = g ? exGoalStatus(ex, now) : null;
    if (g && !st.expired && !(fresh && g.auto === true)) continue;
    const misses = g && st.expired ? (st.monthDone ? 0 : (g.misses || 0) + 1) : (g?.misses || 0);
    const sug = suggestGoal(ex, misses >= 2 ? 1 : GOAL_PLANS[it.goal].growth);
    if (!sug) continue;
    setExGoal(ex, sug.w, sug.r, now);
    Object.assign(state.goals.ex[ex.id], { auto: true, misses });
    n++;
  }
  return n;
}

/** Dias diferentes com treino nesta semana (para a meta de frequência). */
export function trainedDaysThisWeek(now = new Date()) {
  const ws = weekStart(now);
  return new Set(sessionsIn(ws, addDays(ws, 7)).map(s => new Date(s.date).toDateString())).size;
}
