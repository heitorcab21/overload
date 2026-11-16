// Rotinas de cardio com cronômetro: blocos contínuos e intervalados, modelos prontos e progressão.
import { state } from './store.js';
import { CARDIO_TYPES, INTENSITIES } from './cardio.js';

/*
 * Rotina: { id, name, type, blocks: [bloco] }
 *  contínuo:   { kind: 'cont', sec, int, speed?, incline?, level?, label? }
 *  intervalado:{ kind: 'int', rounds, work, rest, int (do trabalho), speed?, incline?, level?, restSpeed?, restIncline?, restLevel? }
 * Sessão feita (em state.cardio): { ..., routineId, rpe, plan: cópia dos blocos usados }
 */

export const CARDIO_TEMPLATES = [
  { id: 'hiit-30-30', name: 'HIIT 30/30', type: 'bike', blocks: [
    { kind: 'cont', sec: 300, int: 'leve', label: 'Aquecer' },
    { kind: 'int', rounds: 8, work: 30, rest: 30, int: 'forte' },
    { kind: 'cont', sec: 300, int: 'leve', label: 'Desaquecer' }] },
  { id: 'tabata', name: 'Tabata', type: 'hiit', blocks: [
    { kind: 'cont', sec: 300, int: 'leve', label: 'Aquecer' },
    { kind: 'int', rounds: 8, work: 20, rest: 10, int: 'forte' },
    { kind: 'cont', sec: 180, int: 'leve', label: 'Desaquecer' }] },
  { id: 'esteira-12-3-30', name: 'Esteira inclinada 12-3-30', type: 'esteira', blocks: [
    { kind: 'cont', sec: 1800, int: 'moderado', speed: 4.8, incline: 12 }] },
  { id: 'tiros', name: 'Tiros de corrida', type: 'esteira', blocks: [
    { kind: 'cont', sec: 300, int: 'leve', speed: 7, label: 'Aquecer' },
    { kind: 'int', rounds: 6, work: 60, rest: 90, int: 'forte', speed: 12, restSpeed: 6 },
    { kind: 'cont', sec: 300, int: 'leve', speed: 6, label: 'Desaquecer' }] },
  { id: 'z2', name: 'Zona 2 contínuo', type: 'bike', blocks: [
    { kind: 'cont', sec: 2400, int: 'moderado' }] },
];

/** Duração total da rotina em segundos. */
export const planSeconds = blocks => blocks.reduce((n, b) => n + (b.kind === 'int' ? b.rounds * (b.work + b.rest) : b.sec), 0);

/**
 * Transforma os blocos na sequência de etapas do cronômetro:
 * [{ label, sec, int, speed?, incline?, level?, round?, rounds?, phase: 'cont'|'work'|'rest' }]
 */
export function segmentsOf(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'int') {
      for (let r = 1; r <= b.rounds; r++) {
        out.push({ phase: 'work', sec: b.work, int: b.int || 'forte', speed: b.speed, incline: b.incline, level: b.level, round: r, rounds: b.rounds });
        // o descanso da última rodada também conta (fica como transição para o próximo bloco)
        if (b.rest > 0) out.push({ phase: 'rest', sec: b.rest, int: 'leve', speed: b.restSpeed, incline: b.restIncline, level: b.restLevel, round: r, rounds: b.rounds });
      }
    } else {
      out.push({ phase: 'cont', sec: b.sec, int: b.int || 'moderado', speed: b.speed, incline: b.incline, level: b.level, label: b.label });
    }
  }
  return out;
}

/** Calorias estimadas somando cada etapa pela sua intensidade. */
export function planKcal(type, segs, secDone = Infinity) {
  const met = (CARDIO_TYPES[type] || CARDIO_TYPES.outro).met;
  const kg = state.profile?.weight || 70;
  let left = secDone, kcal = 0;
  for (const s of segs) {
    if (left <= 0) break;
    const sec = Math.min(s.sec, left);
    kcal += met[Math.max(0, INTENSITIES.indexOf(s.int))] * kg * (sec / 3600);
    left -= sec;
  }
  return Math.round(kcal);
}

/** Intensidade que resume a sessão: forte se houver intervalado forte, senão a mais comum. */
export function planIntensity(blocks) {
  if (blocks.some(b => b.kind === 'int' && (b.int || 'forte') === 'forte')) return 'forte';
  const cont = blocks.filter(b => b.kind === 'cont').sort((a, b) => b.sec - a.sec)[0];
  return cont?.int || 'moderado';
}

/** Sessões já feitas desta rotina, da mais antiga para a mais nova. */
export const routineHistory = id => (state.cardio || []).filter(c => c.routineId === id);

/**
 * Próximo avanço, pela nota de esforço (1 a 10) da última sessão:
 *  até 6 (fácil): avança um passo;  7 e 8: mantém;  9 e 10: sugere manter ou aliviar.
 * Passo, nesta ordem: +1 rodada no intervalado (até 12) → +0,5 km/h no trabalho → +1% de inclinação (até 15)
 * → +1 nível → +10% de tempo no bloco contínuo principal (de 30 em 30 s).
 * Devolve { kind: 'up'|'hold'|'down', text, apply?(blocks) } ou null sem sessão anterior.
 */
export function nextStep(routine) {
  const last = routineHistory(routine.id).at(-1);
  if (!last || last.rpe == null || last.applied) return null;
  if (last.rpe >= 9) return { kind: 'down', key: 'hard' };
  if (last.rpe >= 7) return { kind: 'hold', key: 'hold' };
  const blocks = routine.blocks;
  const iInt = blocks.findIndex(b => b.kind === 'int');
  if (iInt >= 0 && blocks[iInt].rounds < 12) {
    return { kind: 'up', key: 'round', n: blocks[iInt].rounds + 1, apply: bs => { bs[iInt].rounds += 1; } };
  }
  const main = blocks.map((b, i) => [b, i]).filter(([b]) => b.kind === 'cont').sort((a, b) => b[0].sec - a[0].sec)[0];
  const target = iInt >= 0 ? [blocks[iInt], iInt] : main;
  if (target && target[0].speed) {
    const v = Math.round((target[0].speed + 0.5) * 10) / 10;
    return { kind: 'up', key: 'speed', v, apply: bs => { bs[target[1]].speed = v; } };
  }
  if (target && target[0].incline != null && target[0].incline < 15) {
    const v = target[0].incline + 1;
    return { kind: 'up', key: 'incline', v, apply: bs => { bs[target[1]].incline = v; } };
  }
  if (target && target[0].level) {
    const v = target[0].level + 1;
    return { kind: 'up', key: 'level', v, apply: bs => { bs[target[1]].level = v; } };
  }
  if (main) {
    const sec = Math.round((main[0].sec * 1.1) / 30) * 30 || main[0].sec + 30;
    return { kind: 'up', key: 'time', sec, apply: bs => { bs[main[1]].sec = sec; } };
  }
  return { kind: 'hold', key: 'hold' };
}

/** Resumo curto: "5 min + 8× 30/30 s + 5 min". */
export function blocksSummary(blocks) {
  return blocks.map(b => (b.kind === 'int' ? `${b.rounds}× ${b.work}/${b.rest} s` : fmtSec(b.sec))).join(' + ');
}
export function fmtSec(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}
export const clock = sec => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
