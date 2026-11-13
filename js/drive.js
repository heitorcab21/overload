// Sincronização com o Google Drive da própria pessoa.
// Sem servidor: o navegador recebe uma autorização do Google (válida por cerca de 1 hora)
// e grava um arquivo "overload-dados.json" numa pasta "Overload" do Drive.
// O app só consegue ver os arquivos que ele mesmo criou (permissão drive.file).
import { state, save, onSave, exportData, applyRemote, mergeRemote, resetAll } from './store.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { rerender } from './router.js';
import { t } from './i18n.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE = 'overload-dados.json';
const FOLDER = 'Overload';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'overload:gtoken';

export const driveAvailable = () => !!GOOGLE_CLIENT_ID;
export const driveConnected = () => !!state.sync?.connected;
/** Há alterações neste aparelho que ainda não foram para o Drive. */
export const driveDirty = () => driveConnected() && (state.updatedAt || 0) > (state.sync?.syncedAt || 0);

class NeedLogin extends Error {
  constructor() { super(t('Entre de novo com o Google para sincronizar.')); this.needLogin = true; }
}

// ---------- Login (Google Identity Services) ----------

let gisPromise = null;
export function loadGoogle() {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gisPromise = null; reject(new Error(t('Não foi possível falar com o Google. Verifique a internet.'))); };
    document.head.appendChild(s);
  });
  return gisPromise;
}
export const googleReady = () => !!window.google?.accounts?.oauth2;

function cachedToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY));
    if (t && t.exp > Date.now() + 60_000) return t.token;
  } catch { /* sem token */ }
  return null;
}
export const hasToken = () => !!cachedToken();

/** Abre a janela do Google. Precisa ser chamado direto de um toque (senão o navegador bloqueia). */
function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      login_hint: state.sync?.email || undefined,
      callback: r => {
        if (r.error) {
          reject(new Error(r.error === 'access_denied'
            ? t('O Google não liberou o acesso. Se apareceu que o app está em teste, peça ao dono do app para adicionar seu e-mail à lista.')
            : t('Falha ao entrar com o Google.')));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
          reject(new Error(t('Marque a permissão do Google Drive para sincronizar.')));
          return;
        }
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + r.expires_in * 1000 })); } catch { /* ok */ }
        resolve(r.access_token);
      },
      error_callback: e => reject(new Error(
        e.type === 'popup_closed' ? t('Login cancelado.')
          : e.type === 'popup_failed_to_open' ? t('O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.')
            : t('Falha ao entrar com o Google.'))),
    });
    client.requestAccessToken({ prompt });
  });
}

// ---------- Drive ----------

async function api(url, opts = {}) {
  const token = cachedToken();
  if (!token) throw new NeedLogin();
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  } catch {
    throw new Error(t('Sem conexão com o Google Drive.'));
  }
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); throw new NeedLogin(); }
  if (res.status === 404) { const e = new Error(t('Arquivo não encontrado no Drive.')); e.notFound = true; throw e; }
  if (res.status === 403) throw new Error(t('O Google recusou o acesso. Confira se seu e-mail está na lista de testadores do app.'));
  if (!res.ok) throw new Error(t('Erro do Google Drive ({n}). Tente mais tarde.', { n: res.status }));
  return res;
}

const q = s => encodeURIComponent(s);

async function findFile() {
  const r = await (await api(`${API}/files?q=${q(`name='${FILE}' and trashed=false`)}&spaces=drive&orderBy=modifiedTime desc&fields=files(id)`)).json();
  return r.files?.[0]?.id || null;
}

async function folderId() {
  const r = await (await api(`${API}/files?q=${q(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`)).json();
  if (r.files?.[0]) return r.files[0].id;
  const c = await (await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  })).json();
  return c.id;
}

const download = async id => (await api(`${API}/files/${id}?alt=media`)).json();

async function upload(data) {
  const body = JSON.stringify(data);
  const s = state.sync;
  if (s.fileId) {
    try {
      await api(`${UPLOAD}/files/${s.fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      return;
    } catch (e) {
      if (!e.notFound) throw e;
      s.fileId = null; // apagado no Drive: cria de novo
    }
  }
  const parent = await folderId();
  const b = `overload${Date.now()}`;
  const meta = { name: FILE, mimeType: 'application/json', parents: [parent] };
  const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
    + `--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  const r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: multipart,
  })).json();
  s.fileId = r.id;
}

// ---------- Sincronização ----------

let running = null;
let lastTry = 0;

/** Sincroniza agora. Não faz nada durante um treino em andamento (ele sincroniza ao terminar). */
export function sync() {
  if (!driveConnected() || state.active) return Promise.resolve(false);
  if (!running) {
    running = doSync().finally(() => { running = null; notify(); });
    notify();
  }
  return running;
}
export const isSyncing = () => !!running;
/** Avisa a interface (selo vermelho/verde) que o estado da sincronização mudou. */
const notify = () => { try { window.dispatchEvent(new Event('overload-sync')); } catch { /* fora do navegador */ } };

async function doSync() {
  lastTry = Date.now();
  const s = state.sync;
  let changed = false;
  try {
    if (!s.fileId) s.fileId = await findFile();
    let remote = null;
    if (s.fileId) {
      try { remote = await download(s.fileId); } catch (e) { if (e.notFound) s.fileId = null; else throw e; }
    }
    const localDirty = (state.updatedAt || 0) > (s.syncedAt || 0);
    const remoteNew = !!remote && (remote.updatedAt || 0) > (s.syncedAt || 0);
    const firstTime = !s.syncedAt;

    // versão que fica igual nos dois lados ao fim; alterações feitas durante o envio
    // têm data mais nova e continuam marcadas como pendentes
    let version = state.updatedAt;
    const send = async () => { const data = exportData(); version = data.updatedAt; await upload(data); };

    if (remote && firstTime && !remote.sessions?.length && state.onboarded) {
      // primeira conexão deste aparelho e o Drive ainda não tem treinos: vale o que está aqui
      await send();
    } else if (remoteNew && (!localDirty || !state.sessions.length)) {
      // só o Drive mudou, ou este aparelho ainda não tem treinos: usa a versão do Drive
      applyRemote(remote);
      version = state.updatedAt;
      changed = true;
    } else if (remoteNew && localDirty) {
      // os dois lados mudaram: junta e envia o resultado
      mergeRemote(remote);
      await send();
      changed = true;
    } else if (localDirty || !remote) {
      await send();
    }
    state.sync.syncedAt = version;
    state.sync.lastSync = new Date().toISOString();
    state.sync.needLogin = false;
    state.sync.error = null;
    save({ touch: false });
    if (changed) rerender();
    return true;
  } catch (e) {
    if (state.sync) {
      state.sync.needLogin = !!e.needLogin;
      state.sync.error = e.needLogin ? null : e.message;
      save({ touch: false });
    }
    throw e;
  }
}

/**
 * Renova a autorização do Google aproveitando um toque que a pessoa já dá (Começar ou Finalizar treino).
 * Como o app já foi autorizado antes, a janela do Google abre e fecha sozinha, sem perguntar nada.
 * Precisa ser chamada direto do toque, antes de qualquer espera, senão o navegador bloqueia a janela.
 * Resolve true quando há autorização válida.
 */
export function refreshIfNeeded() {
  if (!driveConnected()) return Promise.resolve(false);
  if (hasToken()) return Promise.resolve(true);
  if (!googleReady()) { loadGoogle().catch(() => {}); return Promise.resolve(false); }
  return requestToken('').then(() => true, () => false);
}

/** Entrar com o Google (a partir de um toque) e sincronizar. */
export async function connect() {
  if (!googleReady()) {
    loadGoogle().catch(() => {});
    throw new Error(t('Carregando o Google… toque de novo em alguns segundos.'));
  }
  const first = !state.sync?.email;
  await requestToken(first ? 'select_account' : '');
  const about = await (await api(`${API}/about?fields=user(emailAddress)`)).json();
  const email = about.user?.emailAddress || '';
  // outra conta: começa a sincronização do zero com ela
  if (state.sync?.email && state.sync.email !== email) state.sync = null;
  state.sync = { ...(state.sync || {}), connected: true, email, needLogin: false };
  save({ touch: false });
  await sync();
}

export function disconnect() {
  const token = cachedToken();
  if (token && googleReady()) window.google.accounts.oauth2.revoke(token, () => {});
  localStorage.removeItem(TOKEN_KEY);
  state.sync = null;
  save({ touch: false });
}

/**
 * Sair da conta: desconecta e limpa este aparelho. Os dados continuam no Drive da conta.
 * Na próxima entrada o Google mostra a escolha de conta, para trocar de perfil.
 */
export function logout() {
  disconnect();
  resetAll();
}

/** Substitui o arquivo do Drive por dados vazios. Se falhar, lança erro e nada muda. */
export async function wipeRemote(empty) {
  const s = state.sync;
  if (!s.fileId) s.fileId = await findFile();
  await upload(empty);
}

/** Sincroniza sozinho: ao abrir o app, ao voltar para ele e alguns segundos depois de cada alteração. */
export function initDrive() {
  if (!driveAvailable()) return;
  loadGoogle().catch(() => {});
  let timer;
  const quiet = () => sync().catch(() => rerender());
  onSave(() => {
    if (!driveConnected() || state.active || !hasToken()) return;
    clearTimeout(timer);
    timer = setTimeout(quiet, 5000);
  });
  if (driveConnected() && hasToken()) quiet();
  else if (driveConnected()) { state.sync.needLogin = true; save({ touch: false }); }
  document.addEventListener('visibilitychange', () => {
    if (!driveConnected() || !hasToken()) return;
    if (document.visibilityState === 'hidden' && driveDirty()) quiet();
    if (document.visibilityState === 'visible' && Date.now() - lastTry > 5 * 60_000) quiet();
  });
}
