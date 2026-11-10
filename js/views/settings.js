// Ajustes: descanso, tema, IA, dados e instalação.
import { state, save, exportJSON, importJSON, resetAll } from '../store.js';
import { $, esc, actions, changes, submits, toast, sheet, closeSheet, stepper, download } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { sessionsCSV } from '../export.js';
import { aiEnabled, aiAskExecution } from '../ai.js';

const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (recomendado)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (mais rápido)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 (mais barato)'],
];

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0d0d0d' : '#f9f9f7';
}

function render() {
  const s = state.settings;
  $('#view').innerHTML = `
    <div class="head"><h1>Ajustes</h1></div>
    <div class="stack">
      <div class="card stack">
        <h3>Treino</h3>
        ${stepper('rest', s.rest, 15, 'Descanso entre séries (segundos)', 0, 'setRest')}
        <label class="field">Aparência
          <select data-change="setTheme">
            <option value="auto"${s.theme === 'auto' ? ' selected' : ''}>Seguir o sistema</option>
            <option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Escuro</option>
            <option value="light"${s.theme === 'light' ? ' selected' : ''}>Claro</option>
          </select></label>
      </div>

      <div class="card stack">
        <h3>Treinador IA (opcional)</h3>
        <p class="muted small">Com uma chave da API do Claude, o app entende frases de voz mais livres, analisa sua semana e tira dúvidas de execução. Sem chave, tudo o mais funciona normalmente, inclusive sem internet.</p>
        <form class="stack" data-submit="saveKey">
          <label class="field">Chave da API
            <input type="password" name="key" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"></label>
          <label class="field">Modelo
            <select name="model">${MODELS.map(([id, n]) => `<option value="${id}"${s.model === id ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <div class="row">
            <button class="btn primary grow">Salvar</button>
            ${aiEnabled() ? `<button type="button" class="btn" data-act="testAI">Testar</button>` : ''}
          </div>
        </form>
        <p class="muted small">A chave fica guardada só neste aparelho e é enviada apenas à Anthropic. O uso é cobrado na sua conta da API. Crie a chave no Console da Anthropic (platform.claude.com) e, se puder, defina um limite de gastos.</p>
      </div>

      <div class="card stack">
        <h3>Seus dados</h3>
        <p class="muted small">${state.sessions.length} treino${state.sessions.length === 1 ? '' : 's'} salvo${state.sessions.length === 1 ? '' : 's'} neste aparelho. Faça backup de vez em quando: limpar os dados do navegador apaga tudo.</p>
        <button class="btn block" data-act="exportCSV">Exportar treinos (planilha CSV)</button>
        <button class="btn block" data-act="exportBackup">Salvar backup completo</button>
        <label class="btn block">Restaurar backup<input type="file" accept="application/json,.json" data-change="importBackup" class="sr"></label>
        <button class="btn ghost danger block" data-act="resetAsk">Apagar todos os dados</button>
      </div>

      <div class="card stack">
        <h3>Instalar no celular</h3>
        <p class="muted small"><b>Android (Chrome):</b> menu de três pontos, depois "Instalar app" ou "Adicionar à tela inicial".<br>
        <b>iPhone (Safari):</b> botão Compartilhar, depois "Adicionar à Tela de Início".</p>
        <button class="btn block" id="installBtn" data-act="install" hidden>Instalar o Overload</button>
      </div>
      <p class="small muted" style="text-align:center">Overload · feito para uso pessoal</p>
    </div>`;
  if (window.__installPrompt) $('#installBtn').hidden = false;
}

changes.setRest = el => { state.settings.rest = Math.max(0, Math.round(Number(el.value) || 0)); save(); };
changes.setTheme = el => { state.settings.theme = el.value; save(); applyTheme(); };

submits.saveKey = form => {
  state.settings.apiKey = form.key.value.trim();
  state.settings.model = form.model.value;
  save();
  toast(state.settings.apiKey ? 'IA configurada.' : 'IA desativada.');
  rerender();
};
actions.testAI = async el => {
  el.disabled = true;
  el.textContent = 'Testando…';
  try {
    await aiAskExecution('Teste de conexão', '', 'Responda apenas: ok');
    toast('Conexão com a IA funcionando.');
  } catch (e) {
    toast(e.message, 6000);
  }
  rerender();
};

const stamp = () => new Date().toISOString().slice(0, 10);
actions.exportCSV = () => download(`overload-treinos-${stamp()}.csv`, sessionsCSV(), 'text/csv');
actions.exportBackup = () => download(`overload-backup-${stamp()}.json`, exportJSON(), 'application/json');
changes.importBackup = async el => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    JSON.parse(text);
    window.__pendingImport = text;
    sheet(`<h2>Restaurar este backup?</h2>
      <p class="muted">Os dados atuais deste aparelho serão substituídos pelos do arquivo "${esc(file.name)}".</p>
      <button class="btn primary block" data-act="importNow">Restaurar</button>
      <button class="btn block" data-act="closeSheet">Cancelar</button>`);
  } catch {
    toast('Não consegui ler este arquivo de backup.', 5000);
  }
  el.value = '';
};
actions.importNow = () => {
  try {
    importJSON(window.__pendingImport);
    toast('Backup restaurado.');
  } catch (e) {
    toast(e.message, 5000);
  }
  window.__pendingImport = null;
  closeSheet(); applyTheme(); rerender();
};
actions.resetAsk = () => {
  sheet(`<h2>Apagar todos os dados?</h2>
    <p class="muted">Treinos, exercícios, metas e ajustes serão apagados deste aparelho. Esta ação não pode ser desfeita. Salve um backup antes se quiser guardar seu histórico.</p>
    <button class="btn danger block" data-act="resetNow">Apagar tudo</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
actions.resetNow = () => { resetAll(); closeSheet(); applyTheme(); go('#/inicio'); };
actions.install = async () => {
  const p = window.__installPrompt;
  if (!p) return;
  p.prompt();
  await p.userChoice;
  window.__installPrompt = null;
  rerender();
};

route('ajustes', render);
