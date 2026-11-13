// Selo de sincronização no topo das telas principais:
// vermelho quando há alteração ainda não enviada ao Google Drive, verde quando está tudo salvo.
import { $, icon } from './ui.js';
import { current } from './router.js';
import { onSave } from './store.js';
import { driveConnected, driveDirty, isSyncing } from './drive.js';
import { t } from './i18n.js';

// Telas sem o selo (o topo delas já tem botões; o treino sincroniza ao finalizar)
const HIDE_ON = ['treino', 'resumo', 'exercicio'];

/** Estado da sincronização: 'off' (sem conta), 'busy', 'dirty' ou 'ok'. */
export function syncState() {
  if (!driveConnected()) return 'off';
  if (isSyncing()) return 'busy';
  return driveDirty() ? 'dirty' : 'ok';
}

export const syncLabel = st => ({ busy: t('Sincronizando…'), dirty: t('Sincronizar'), ok: t('Sincronizado') }[st] ?? '');

export function updateSyncBadge() {
  const b = $('#syncTop');
  if (!b) return;
  const st = syncState();
  const hide = st === 'off' || HIDE_ON.includes(current().name);
  b.hidden = hide;
  document.body.classList.toggle('has-sync', !hide);
  if (hide) return;
  b.className = `sync-top ${st}`;
  b.innerHTML = `${st === 'ok' ? icon.check : icon.sync}<span>${syncLabel(st)}</span>`;
  b.setAttribute('aria-label', st === 'dirty' ? t('Há alterações não enviadas ao Google Drive. Toque para sincronizar.') : syncLabel(st));
  b.disabled = st === 'busy';
  // o botão de Ajustes acompanha as mesmas cores
  const sb = $('#syncNow');
  if (sb) sb.className = `btn block sync-btn ${st}`;
}

export function initSyncBadge() {
  const b = document.createElement('button');
  b.id = 'syncTop';
  b.type = 'button';
  b.dataset.act = 'driveConnect';
  b.hidden = true;
  document.body.appendChild(b);
  window.addEventListener('overload-sync', updateSyncBadge);
  window.addEventListener('hashchange', () => setTimeout(updateSyncBadge));
  onSave(updateSyncBadge);
  updateSyncBadge();
}
