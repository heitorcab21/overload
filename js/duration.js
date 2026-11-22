// Tempo estimado de um treino.
// Cada série = preparar e anotar + ~4 s por repetição; entre as séries, o descanso do exercício; entre exercícios, a troca
// de aparelho; no começo, um aquecimento curto. Nos bi-sets e tri-sets não há descanso entre os exercícios do grupo,
// só a troca rápida. Depois a estimativa se ajusta ao SEU ritmo: a mediana entre o tempo que seus treinos levaram de
// verdade e o que esta conta daria para eles (com 3 ou mais treinos cronometrados).
import { state } from './store.js';
import { restOf, supGroups } from './data.js';
import { t } from './i18n.js';

const REP_SEC = 4;      // ~2 s descendo e ~1–2 s subindo
const SET_EXTRA = 15;   // pegar o peso, posicionar e anotar
const SET_MAX = 90;     // teto por série (prancha e exercícios em segundos não estouram a conta)
const GROUP_SWITCH = 15; // bi-set: ir de um exercício ao outro do grupo
const SWITCH_SEC = 90;  // trocar de aparelho, regular e preparar
const WARM_SEC = 240;   // aquecimento antes do primeiro exercício

const setSec = reps => Math.min(SET_MAX, SET_EXTRA + REP_SEC * reps);

/**
 * Segundos de uma lista de exercícios na ordem do treino: [{ ex, sets, reps, sg? }].
 * sg marca o grupo do bi-set; warm = conta o aquecimento inicial.
 */
export function rawSeconds(items, warm = true) {
  const list = items.filter(it => it.ex && it.sets > 0);
  let s = warm && list.length ? WARM_SEC : 0;
  list.forEach((it, i) => {
    const next = list[i + 1];
    const work = setSec(it.reps);
    if (it.sg && next?.sg === it.sg) {
      s += it.sets * (work + GROUP_SWITCH); // vai direto para o próximo do grupo
    } else {
      s += it.sets * work + (it.sets - 1) * restOf(it.ex) + (next ? SWITCH_SEC : 0);
    }
  });
  return s;
}

const median = xs => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/**
 * O seu ritmo: quanto os seus treinos cronometrados levaram em relação à estimativa (mediana dos últimos 10, entre 0,6 e 1,6).
 * Ignora treinos registrados depois (sem duração), muito curtos e os que ficaram abertos por horas.
 */
export function paceFactor() {
  const ratios = [];
  for (const s of [...state.sessions].reverse()) {
    if (!(s.dur >= 10) || s.dur > 240) continue;
    const items = s.entries.filter(e => e.sets?.length).map(e => ({
      ex: state.exercises[e.exId] || { rest: state.settings.rest },
      sets: e.sets.length, reps: e.sets.reduce((n, x) => n + (x.r || 0), 0) / e.sets.length,
    }));
    const est = rawSeconds(items);
    if (est > 0) ratios.push((s.dur * 60) / est);
    if (ratios.length >= 10) break;
  }
  if (ratios.length < 3) return { f: 1, fit: false };
  return { f: Math.max(0.6, Math.min(1.6, median(ratios))), fit: true };
}

/** Itens de um treino salvo: séries do exercício, reps no meio da faixa, grupos de bi-set. */
function routineItems(r) {
  const groups = supGroups(r);
  return r.ex.map(id => state.exercises[id]).filter(Boolean).map(ex => ({
    ex, sets: ex.sets, reps: (ex.repMin + ex.repMax) / 2, sg: groups.findIndex(g => g.includes(ex.id)) + 1 || 0,
  }));
}

/** Minutos arredondados (de 5 em 5 a partir de 20 min). */
const roundMin = sec => { const m = sec / 60; return m < 20 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5; };

/** Tempo estimado de um treino salvo, em minutos: { min, fit } (fit = ajustado ao seu ritmo). */
export function routineMinutes(r) {
  const sec = rawSeconds(routineItems(r));
  if (!sec) return null;
  const p = paceFactor();
  return { min: roundMin(sec * p.f), fit: p.fit };
}

/**
 * Quanto falta do treino em andamento, em minutos. sets(en, ex) = séries previstas do exercício neste treino.
 * mode: 'now' (como está), 'short' (com "Pouco tempo": 2 séries nos que faltam) ou 'full' (sem "Pouco tempo").
 */
export function activeMinutesLeft(a, sets, mode = 'now') {
  const started = a.entries.some(e => e.sets.length);
  const items = [];
  for (const en of a.entries) {
    const ex = state.exercises[en.exId];
    if (!ex || en.skipped) continue;
    const full = sets(en, ex) + (en.cut || 0);
    const total = mode === 'full' ? full : mode === 'short' ? Math.min(full, Math.max(2, en.sets.length)) : sets(en, ex);
    const left = total - en.sets.length;
    if (left > 0) items.push({ ex, sets: left, reps: en.plan?.reps?.[0] || (ex.repMin + ex.repMax) / 2, sg: en.sg || 0 });
  }
  const sec = rawSeconds(items, !started);
  return roundMin(sec * paceFactor().f);
}

/** "cerca de 55 min" / "cerca de 1 h 10 min". */
export function fmtMinutes(min) {
  if (min < 60) return t('cerca de {n} min', { n: min });
  const h = Math.floor(min / 60), m = min % 60;
  return m ? t('cerca de {h} h {m} min', { h, m }) : t('cerca de {h} h', { h });
}
