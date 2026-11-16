// Cardio: tipos, calorias estimadas e minutos por semana.
import { state } from './store.js';
import { weekStart, addDays } from './logic.js';

// MET por intensidade (leve, moderado, forte), do Compêndio de Atividades Físicas (valores aproximados)
export const CARDIO_TYPES = {
  esteira: { name: 'Esteira', met: [4.3, 7, 9.8] },
  corrida: { name: 'Corrida na rua', met: [7, 9.8, 11.5] },
  caminhada: { name: 'Caminhada', met: [3, 4, 5] },
  bike: { name: 'Bicicleta', met: [4, 6.8, 8.8] },
  eliptico: { name: 'Elíptico', met: [4, 5, 7] },
  escada: { name: 'Escada', met: [6, 8.8, 10] },
  remo: { name: 'Remo', met: [4.8, 7, 8.5] },
  natacao: { name: 'Natação', met: [5.8, 7, 9.8] },
  hiit: { name: 'HIIT', met: [6, 8, 10] },
  outro: { name: 'Outro', met: [3.5, 5, 7] },
};
export const INTENSITIES = ['leve', 'moderado', 'forte'];

/** Calorias estimadas: MET × peso (kg) × horas. Sem perfil, usa 70 kg. */
export function cardioKcal(type, min, int = 'moderado') {
  const met = (CARDIO_TYPES[type] || CARDIO_TYPES.outro).met[Math.max(0, INTENSITIES.indexOf(int))];
  const kg = state.profile?.weight || 70;
  return Math.round(met * kg * (min / 60));
}

export const cardioIn = (a, b) => (state.cardio || []).filter(c => { const d = new Date(c.date); return d >= a && d < b; });
export const cardioMinutes = list => list.reduce((n, c) => n + (c.min || 0), 0);

/** Minutos de cardio por semana nas últimas n semanas (a última é a atual). */
export function cardioWeeks(n = 8, now = new Date()) {
  const ws = weekStart(now);
  return Array.from({ length: n }, (_, i) => {
    const a = addDays(ws, -7 * (n - 1 - i));
    const list = cardioIn(a, addDays(a, 7));
    return { start: a, min: cardioMinutes(list), count: list.length };
  });
}
