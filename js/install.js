// Instalação do app na tela inicial: ícone no canto superior direito que some depois de instalado.
import { $, icon, actions, sheet, closeSheet, toast } from './ui.js';
import { current } from './router.js';

// Telas em que o ícone não aparece (o topo delas já tem botões)
const HIDE_ON = ['treino', 'resumo', 'exercicio'];

let installed = false;
let promptEvent = null;

/** Aberto pelo ícone da tela inicial (Android, iPhone ou computador). */
const standalone = () => matchMedia('(display-mode: standalone)').matches
  || matchMedia('(display-mode: fullscreen)').matches
  || navigator.standalone === true;

export const isInstalled = () => installed || standalone();

export function updateInstallButton() {
  const btn = $('#installTop');
  if (!btn) return;
  const hide = isInstalled() || HIDE_ON.includes(current().name);
  btn.hidden = hide;
  document.body.classList.toggle('has-install', !hide);
}

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);

function instructions() {
  if (isIOS) {
    return `<ol class="steps">
      <li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima), na barra do navegador.</li>
      <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
      <li>Toque em <b>Adicionar</b>. O ícone do Overload aparece junto dos seus apps.</li>
    </ol>
    <p class="tip">Funciona no Safari e, nas versões recentes do iOS, também no Chrome.</p>`;
  }
  if (isAndroid) {
    return `<ol class="steps">
      <li>Toque no menu de <b>três pontos</b> no canto do Chrome.</li>
      <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
      <li>Confirme em <b>Instalar</b>.</li>
    </ol>`;
  }
  return `<ol class="steps">
    <li>No Chrome ou no Edge, clique no ícone de instalar no fim da barra de endereço, ou abra o menu e escolha <b>Instalar Overload</b>.</li>
    <li>Para usar no celular, abra este mesmo endereço no navegador do celular e toque no ícone de instalar no canto superior direito.</li>
  </ol>`;
}

actions.installApp = async () => {
  if (promptEvent) {
    const p = promptEvent;
    promptEvent = null;
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome !== 'accepted') updateInstallButton();
    return;
  }
  sheet(`<h2>Instalar o Overload</h2>
    <p class="muted">Instalado, o app abre pelo ícone na tela inicial, em tela cheia e funciona sem internet.</p>
    ${instructions()}
    <button class="btn primary block" data-act="closeSheet">Entendi</button>`);
};

export function initInstall() {
  const btn = document.createElement('button');
  btn.id = 'installTop';
  btn.className = 'install-top';
  btn.type = 'button';
  btn.dataset.act = 'installApp';
  btn.title = 'Instalar o app';
  btn.setAttribute('aria-label', 'Instalar o app na tela inicial');
  btn.innerHTML = icon.download;
  btn.hidden = true;
  document.body.appendChild(btn);

  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    promptEvent = ev;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = null;
    closeSheet();
    updateInstallButton();
    toast('App instalado! Abra pelo ícone na tela inicial.', 5000);
  });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallButton);
  window.addEventListener('hashchange', updateInstallButton);

  // Android: descobre se o app já está instalado mesmo quando aberto no navegador
  navigator.getInstalledRelatedApps?.().then(apps => {
    if (apps.length) { installed = true; updateInstallButton(); }
  }).catch(() => {});

  updateInstallButton();
}
