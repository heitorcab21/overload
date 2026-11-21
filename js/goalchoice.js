// Decisão de meta de carga por exercício: um dos 3 cenários (meta do mês) ou seguir a própria progressão.
import { state } from './store.js';
import { activeExercises } from './data.js';
import { exGoalStatus } from './logic.js';

const own = () => (state.goals.own ??= {});

/** 'goal' (meta do mês ativa), 'own' (segue a própria progressão) ou null (falta escolher). */
export function decision(ex, now = new Date()) {
  const st = exGoalStatus(ex, now);
  if (st && !st.expired) return 'goal';
  if (own()[ex.id]) return 'own';
  return null;
}
export const undecided = (now = new Date()) => activeExercises().filter(ex => !decision(ex, now));
