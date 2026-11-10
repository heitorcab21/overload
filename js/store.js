// Estado do app, salvo no localStorage do aparelho (e, se conectado, sincronizado com o Google Drive).

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
  lastBackup: null, // data do último backup salvo ou compartilhado
  updatedAt: 0,     // momento da última alteração nos dados (para sincronizar)
  sync: null,       // só deste aparelho: { connected, email, fileId, syncedAt, lastSync, needLogin }
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

const listeners = [];
/** Avisa quando os dados mudam (usado pela sincronização). */
export const onSave = fn => listeners.push(fn);

/**
 * Grava no aparelho. touch=false grava sem contar como alteração
 * (ex.: ao receber dados do Drive ou anotar o status da sincronização).
 */
export function save({ touch = true } = {}) {
  if (touch) state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem espaço ou modo privado */ }
  if (touch) for (const fn of listeners) fn();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Dados que saem do aparelho (backup e Drive): sem chave da API, treino em andamento e status de sincronização. */
export function exportData() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.apiKey = '';
  copy.active = null;
  delete copy.sync;
  return copy;
}
export const exportJSON = () => JSON.stringify(exportData(), null, 2);

const valid = raw => raw && typeof raw === 'object' && Array.isArray(raw.sessions) && Array.isArray(raw.routines);

/** Troca os dados pelos de outro lugar, mantendo o que é só deste aparelho. */
function replaceWith(raw) {
  const keep = { apiKey: state.settings.apiKey, active: state.active, sync: state.sync };
  state = merge(raw);
  state.settings.apiKey = keep.apiKey;
  state.active = keep.active;
  state.sync = keep.sync;
}

/** Restaura um backup. Mantém a chave da API e a conexão com o Drive deste aparelho. */
export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!valid(raw)) throw new Error('Arquivo de backup inválido.');
  replaceWith(raw);
  state.active = null;
  save();
}

/** Usa a versão do Drive (quando só ela mudou). */
export function applyRemote(raw) {
  if (!valid(raw)) throw new Error('O arquivo do Google Drive está corrompido.');
  replaceWith(raw);
  save({ touch: false });
}

/**
 * Junta as duas versões quando houve mudança nos dois lados (ex.: dois aparelhos sem internet).
 * Treinos: soma dos dois, sem repetir. O resto (rotinas, exercícios, metas, ajustes): a versão mais recente.
 */
export function mergeRemote(raw) {
  if (!valid(raw)) throw new Error('O arquivo do Google Drive está corrompido.');
  const local = exportData();
  const remoteNewer = (raw.updatedAt || 0) > (local.updatedAt || 0);
  const [newer, older] = remoteNewer ? [raw, local] : [local, raw];
  const byId = new Map(older.sessions.map(s => [s.id, s]));
  for (const s of newer.sessions) byId.set(s.id, s);
  const sessions = [...byId.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  replaceWith({ ...newer, sessions, exercises: { ...older.exercises, ...newer.exercises } });
  save();
}

/** Apaga tudo deste aparelho, inclusive a conexão com o Drive (o arquivo no Drive continua lá). */
export function resetAll() {
  state = defaults();
  save({ touch: false });
}

/** Conjunto de dados vazio, como o de um app recém-instalado (para "começar do zero"). */
export function emptyData() {
  const d = defaults();
  delete d.sync;
  d.updatedAt = Date.now();
  return d;
}

/** Começa do zero neste aparelho mantendo só a conta Google conectada. */
export function resetKeepAccount(updatedAt) {
  const sync = state.sync;
  state = defaults();
  state.updatedAt = updatedAt;
  if (sync) state.sync = { ...sync, syncedAt: updatedAt, lastSync: new Date().toISOString(), needLogin: false, error: null };
  save({ touch: false });
}
