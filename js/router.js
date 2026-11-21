// Roteador simples por hash: #/hoje, #/metas, #/exercicio/<id> ...
import { $, $$ } from './ui.js';

const routes = {};
let lastName = null;

export function route(name, fn, opts = {}) { routes[name] = { fn, ...opts }; }

export function go(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}

export function current() {
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: routes[name] ? name : 'hoje', arg: decodeURIComponent(rest.join('/') || '') };
}

let enterTimer = 0;

export function rerender() {
  const { name, arg } = current();
  const r = routes[name];
  $('#tabbar').hidden = !!r.noTabs;
  document.body.classList.toggle('no-tabs', !!r.noTabs);
  for (const a of $$('#tabbar a')) a.classList.toggle('on', a.dataset.tab === (r.tab || name));
  r.fn(arg);
  // a página nunca fica travada sem rolar se nenhuma janela estiver aberta
  if ($('#sheet')?.hidden) document.body.classList.remove('no-scroll');
  if (name !== lastName) {
    const v = $('#view');
    v.classList.remove('enter');
    void v.offsetWidth; // reinicia a animação
    v.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => v.classList.remove('enter'), 800); // atualizações seguintes não reanimam
  }
  if (name !== lastName) window.scrollTo(0, 0);
  else if (window.scrollX) window.scrollTo(0, window.scrollY); // nunca fica deslocada para o lado
  lastName = name;
  afterRender.forEach(f => f());
}

/** Funções chamadas depois de cada tela desenhada (ex.: botão flutuante do Treinador). */
export const afterRender = [];

window.addEventListener('hashchange', rerender);
