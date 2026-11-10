// Ponto de entrada: liga as telas, os eventos globais e o modo offline.
import { state } from './store.js';
import { $, $$, icon, actions, changes, submits, closeSheet } from './ui.js';
import { rerender } from './router.js';
import './views/home.js';
import './views/workout.js';
import './views/goals.js';
import './views/progress.js';
import './views/library.js';
import './views/help.js';
import { applyTheme } from './views/settings.js';
import { initDrive } from './drive.js';

// Ícones da barra inferior
for (const el of $$('[data-ic]')) el.outerHTML = icon[el.dataset.ic];

document.addEventListener('click', ev => {
  if (ev.target.id === 'sheet') { closeSheet(); return; }
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, ev);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (ev.key === 'Enter' && ev.target.matches?.('tr[data-act]')) ev.target.click();
});
// Ao tocar em um número, ele já fica selecionado: é só digitar o novo valor
document.addEventListener('focusin', ev => {
  if (ev.target.matches?.('input[type="number"]')) ev.target.select();
});
const onChange = ev => {
  const el = ev.target.closest?.('[data-change]');
  if (!el) return;
  // campos de busca reagem a cada tecla; os demais, quando o valor é confirmado
  if (ev.type === 'input' && el.type !== 'search') return;
  changes[el.dataset.change]?.(el, ev);
};
document.addEventListener('change', onChange);
document.addEventListener('input', onChange);
document.addEventListener('submit', ev => {
  const form = ev.target.closest('[data-submit]');
  if (!form) return;
  ev.preventDefault();
  submits[form.dataset.submit]?.(form, ev);
});

window.addEventListener('beforeinstallprompt', ev => {
  ev.preventDefault();
  window.__installPrompt = ev;
  const b = $('#installBtn');
  if (b) b.hidden = false;
});

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

if (!location.hash) location.hash = state.onboarded ? '#/hoje' : '#/inicio';
rerender();
initDrive();

// Pede ao navegador para não apagar os dados deste site quando faltar espaço
navigator.storage?.persist?.().catch(() => {});

// Offline: o service worker guarda o app no aparelho. Em localhost fica desligado
// (use ?sw=1 para testar) para não servir arquivos antigos durante o desenvolvimento.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline */ });
}
