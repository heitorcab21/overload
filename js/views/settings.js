// Ajustes: descanso, tema, IA, dados e instalação.
import { state, save, exportJSON, importJSON, emptyData, resetKeepAccount } from '../store.js';
import { $, esc, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, shareFile, fmtDate } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { sessionsCSV } from '../export.js';
import { aiEnabled, aiAskExecution } from '../ai.js';
import { driveAvailable, driveConnected, driveDirty, connect, sync, hasToken, refreshIfNeeded, logout, wipeRemote } from '../drive.js';
import { isInstalled } from '../install.js';

function accountCard() {
  if (!driveAvailable()) return '';
  const s = state.sync;
  if (!driveConnected()) {
    return `<div class="card stack">
      <h3>Conta</h3>
      <p class="muted small">Você está usando o app sem conta: os dados ficam só neste aparelho. Entre com sua conta Google para salvar tudo no seu Drive e usar em qualquer aparelho. O app só enxerga os arquivos que ele mesmo cria, numa pasta "Overload".</p>
      <button class="btn primary block" data-act="driveConnect">Entrar com Google</button>
    </div>`;
  }
  const status = s.error ? `<span class="badge warn">${esc(s.error)}</span>`
    : !hasToken() ? (driveDirty() ? '<span class="badge warn">alterações ainda não enviadas</span>' : '<span class="badge">toque em Sincronizar para atualizar</span>')
      : driveDirty() ? '<span class="badge">enviando…</span>' : `<span class="badge good">${icon.check}em dia</span>`;
  return `<div class="card stack">
    <h3>Conta</h3>
    <p class="small">Conectado como <b>${esc(s.email)}</b></p>
    <p class="small muted">Última sincronização com o Google Drive: ${s.lastSync ? `${fmtDate(s.lastSync)} às ${new Date(s.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'nunca'}</p>
    <div>${status}</div>
    <button class="btn primary block" data-act="driveConnect">Sincronizar agora</button>
    <p class="muted small">O app salva no Drive sozinho, inclusive ao finalizar cada treino.</p>
    <button class="btn block" data-act="logoutAsk">Sair da conta</button>
    <p class="muted small">Para usar outro perfil, saia e entre com outra conta Google.</p>
  </div>`;
}

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

      ${accountCard()}

      <div class="card stack">
        <h3>Seus dados</h3>
        <p class="muted small">${state.sessions.length} treino${state.sessions.length === 1 ? '' : 's'} salvo${state.sessions.length === 1 ? '' : 's'} neste aparelho. Faça backup de vez em quando: limpar os dados do navegador apaga tudo.</p>
        <p class="small"><b>Último backup:</b> ${state.lastBackup ? fmtDate(state.lastBackup) : 'nunca'}</p>
        <button class="btn primary block" data-act="backupNow">Salvar backup completo</button>
        <p class="muted small">No celular, abre o menu de compartilhar para mandar o arquivo ao Google Drive, WhatsApp ou e-mail. Se o navegador não permitir, o arquivo é baixado.</p>
        <button class="btn block" data-act="exportCSV">Exportar treinos (planilha CSV)</button>
        <label class="btn block">Restaurar backup<input type="file" accept="application/json,.json,text/plain,.txt" data-change="importBackup" class="sr"></label>
      </div>

      ${isInstalled() ? '' : `<div class="card stack">
        <h3>Instalar no celular</h3>
        <p class="muted small">Instalado, o app abre pelo ícone na tela inicial, em tela cheia e funciona sem internet.</p>
        <button class="btn block" data-act="installApp">${icon.download}Instalar o Overload</button>
      </div>`}

      <div class="card stack">
        <h3>Começar do zero</h3>
        <p class="muted small">Apaga todos os treinos, exercícios, metas e ajustes${driveConnected() ? ', neste aparelho e no seu Google Drive' : ''}.</p>
        <button class="btn ghost danger block" data-act="wipeAsk">${icon.trash}Apagar tudo e começar do zero</button>
      </div>
      <p class="small muted" style="text-align:center">Overload · feito para uso pessoal</p>
    </div>`;
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
actions.exportCSV = () => shareFile(`overload-treinos-${stamp()}.csv`, sessionsCSV(), 'text/csv');
// Usado em Ajustes e no lembrete da tela Hoje
actions.backupNow = async () => {
  const r = await shareFile(`overload-backup-${stamp()}.json`, exportJSON(), 'application/json');
  if (r === 'cancelled') return;
  state.lastBackup = new Date().toISOString();
  save();
  toast(r === 'shared' ? 'Backup enviado.' : 'Arquivo de backup gerado. Guarde-o fora do celular.', 4000);
  rerender();
};
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
// Entrar, reconectar ou sincronizar (também usado na tela Hoje e no primeiro acesso)
actions.driveConnect = async el => {
  const label = el.textContent;
  el.disabled = true;
  el.textContent = 'Conectando…';
  const wasNew = !state.onboarded;
  try {
    if (driveConnected() && hasToken()) await sync();
    else await connect();
    if (wasNew) {
      if (state.onboarded) { toast('Seus dados foram recuperados do Google Drive.', 4000); go('#/hoje'); return; }
      toast('Conta conectada.', 3000);
    } else {
      toast('Dados sincronizados com o Google Drive.');
    }
  } catch (e) {
    toast(e.message, 6000);
  }
  el.disabled = false;
  el.textContent = label;
  rerender();
};
// ---------- Sair da conta ----------

actions.logoutAsk = () => {
  const s = state.sync;
  sheet(`<h2>Sair da conta?</h2>
    <ul class="errs">
      <li>Seus treinos continuam salvos no Google Drive de <b>${esc(s.email)}</b>.</li>
      <li>Este aparelho fica sem dados e volta para a tela de entrada.</li>
      <li>Para usar outro perfil, escolha outra conta Google na próxima entrada. Para voltar a este, entre com a mesma conta e tudo reaparece.</li>
    </ul>
    ${driveDirty() ? '<p class="tip">Há alterações deste aparelho ainda não enviadas. O app tenta enviar antes de sair.</p>' : ''}
    <button class="btn primary block" data-act="logoutNow">Sair</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
function doLogout() {
  logout();
  closeSheet();
  applyTheme();
  toast('Você saiu da conta.');
  go('#/inicio');
}
actions.logoutNow = el => {
  if (!driveDirty()) { doLogout(); return; }
  // envia o que falta antes de sair (a renovação precisa partir deste toque)
  const ready = refreshIfNeeded();
  el.disabled = true;
  el.textContent = 'Salvando no Drive…';
  ready.then(ok => (ok ? sync() : false)).catch(() => false).then(() => {
    if (!driveDirty()) { doLogout(); return; }
    sheet(`<h2>Não deu para salvar as últimas alterações</h2>
      <p class="muted">Sem internet ou sem confirmar a conta, o app não conseguiu enviar o que mudou desde a última sincronização. Se sair agora, essas alterações se perdem; o que já estava no Drive continua lá.</p>
      <button class="btn block" data-act="closeSheet">Cancelar e tentar depois</button>
      <button class="btn danger block" data-act="logoutForce">Sair mesmo assim</button>`);
  });
};
actions.logoutForce = () => doLogout();

// ---------- Apagar tudo e começar do zero ----------

actions.wipeAsk = () => {
  const n = state.sessions.length;
  const ex = Object.keys(state.exercises).length;
  const rt = state.routines.length;
  const goals = Object.keys(state.goals.ex).length + Object.keys(state.goals.groups).length;
  const connected = driveConnected();
  sheet(`<h2>Apagar tudo e começar do zero?</h2>
    <p class="muted">O que vai acontecer:</p>
    <ul class="errs">
      <li><b>${n} treino${n === 1 ? '' : 's'}</b>, ${ex} exercício${ex === 1 ? '' : 's'}, ${rt} rotina${rt === 1 ? '' : 's'} e ${goals} meta${goals === 1 ? '' : 's'} serão apagados.</li>
      ${connected
        ? `<li>Também no seu Google Drive (<b>${esc(state.sync.email)}</b>). Outros aparelhos com esta conta ficam vazios na próxima sincronização.</li>
           <li>Você continua conectado com esta conta e escolhe os treinos de novo.</li>`
        : '<li>Apenas neste aparelho. O app volta para a tela inicial.</li>'}
      <li>Os ajustes voltam ao padrão${state.settings.apiKey ? ' e a chave da IA é removida' : ''}.</li>
      <li><b>Não dá para desfazer.</b></li>
    </ul>
    ${n ? '<button class="btn block" data-act="backupNow">Salvar um backup antes</button>' : ''}
    <label class="check"><input type="checkbox" data-change="wipeCheck">Entendo que ${n > 1 ? `meus ${n} treinos serão apagados` : n === 1 ? 'meu treino será apagado' : 'tudo será apagado'} para sempre.</label>
    <button class="btn danger block" id="wipeBtn" data-act="wipeNow" disabled>Apagar tudo</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
changes.wipeCheck = el => { $('#wipeBtn').disabled = !el.checked; };
actions.wipeNow = el => {
  if (!$('#sheet input[data-change=wipeCheck]')?.checked) return;
  const connected = driveConnected();
  // a renovação da conta precisa partir deste toque
  const ready = connected ? refreshIfNeeded() : Promise.resolve(true);
  el.disabled = true;
  el.textContent = 'Apagando…';
  (async () => {
    const empty = emptyData();
    if (connected) {
      if (!(await ready)) throw new Error('Não foi possível confirmar a conta Google.');
      await wipeRemote(empty); // primeiro o Drive: se falhar, nada é apagado
    }
    resetKeepAccount(empty.updatedAt);
  })().then(() => {
    closeSheet();
    applyTheme();
    toast('Tudo apagado. Vamos começar do zero.', 4000);
    go('#/inicio');
  }, e => {
    toast(`${e.message} Nada foi apagado.`, 6000);
    el.disabled = false;
    el.textContent = 'Apagar tudo';
  });
};

route('ajustes', render);
