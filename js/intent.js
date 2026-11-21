// Objetivo da pessoa (ganhar massa, força, emagrecer, saúde) e as metas que o app monta a partir dele:
// séries por grupo, meta de cardio e treinos por semana. As metas de carga a pessoa escolhe em 3 cenários.
import { state } from './store.js';
import { defaultGroupGoals, GOAL_PLANS, sessionsIn, weekStart, addDays } from './logic.js';

export const GOAL_IDS = ['massa', 'forca', 'emagrecer', 'saude'];
export const intent = () => (state.intent && GOAL_PLANS[state.intent.goal] ? state.intent : null);

/** Guarda o objetivo e refaz as metas de séries e cardio (as editadas à mão ficam como estão). */
export function saveIntent({ goal, focus = [], days = 3 }, now = new Date()) {
  state.intent = { goal, focus: [...new Set(focus)], days: Math.max(1, Math.min(7, Math.round(days))), set: now.toISOString() };
  state.cardioGoal = GOAL_PLANS[goal].cardio;
  defaultGroupGoals(now);
}

/** Dias diferentes com treino nesta semana (para a meta de frequência). */
export function trainedDaysThisWeek(now = new Date()) {
  const ws = weekStart(now);
  return new Set(sessionsIn(ws, addDays(ws, 7)).map(s => new Date(s.date).toDateString())).size;
}
