// Estado do app, salvo no localStorage do aparelho.

const KEY = 'overload:v1';

const defaults = () => ({
  v: 1,
  onboarded: false,
  settings: { rest: 90, apiKey: '', model: 'claude-opus-5-5', theme: 'auto' },
  exercises: {},   // id -> { id, name, group, sets, repMin, repMax, step, lib?, bw?, cues? }
  routines: [],    // { id, name, ex: [exId] }
  next: 0,         // índice do próximo treino na rotação
  sessions: [],    // { id, date, routineId, name, dur, entries: [{ exId, sets:[{w,r,t?}], feel, flags, skipped }] }
  active: null,    // treino em andamento
  goals: { ex: {}, groups: {} },
});

function merge(raw) {
  const d = defaults();
  return {
    ...d, ...raw,
    settings: { ...d.settings, ...(raw.settings || {}) },
    goals: { ex: {}, groups: {}, ...(raw.goals || {}) },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch { /* armazenamento indisponível ou corrompido: começa do zero */ }
  return defaults();
}

export let state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem espaço ou modo privado */ }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Backup completo, sem a chave da API. */
export function exportJSON() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.apiKey = '';
  copy.active = null;
  return JSON.stringify(copy, null, 2);
}

/** Restaura um backup. Mantém a chave da API que já estava no aparelho. */
export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions) || !Array.isArray(raw.routines)) {
    throw new Error('Arquivo de backup inválido.');
  }
  const key = state.settings.apiKey;
  state = merge(raw);
  state.settings.apiKey = key;
  state.active = null;
  save();
}

export function resetAll() {
  state = defaults();
  save();
}
