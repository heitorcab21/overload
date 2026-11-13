// Ajustes: idioma, descanso, tema, IA, conta, dados e instalação.
import { state, save, exportJSON, importJSON, emptyData, resetKeepAccount } from '../store.js';
import { googleBtn, $, $$, esc, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, shareFile, fmtDate, fmtTime } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { sessionsCSV } from '../export.js';
import { aiEnabled, aiAskExecution, PROVIDERS, aiProvider, aiKey, aiModel, setAiConfig, listModels } from '../ai.js';
import { driveAvailable, driveConnected, driveDirty, connect, sync, hasToken, refreshIfNeeded, logout, wipeRemote } from '../drive.js';
import { isInstalled } from '../install.js';
import { syncState, syncLabel, updateSyncBadge } from '../syncbadge.js';
import { t, tn, lang, LANGS } from '../i18n.js';

/** Aplica o idioma às partes fixas da página (abas, atributo lang). */
export function applyLang() {
  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[lang()];
  const labels = { hoje: t('Hoje'), metas: t('Metas'), progresso: t('Progresso'), exercicios: t('Treinos'), ajuda: t('Ajuda'), ajustes: t('Ajustes') };
  for (const a of $$('#tabbar a')) {
    const l = a.querySelector('.tab-label');
    if (l) l.textContent = labels[a.dataset.tab];
  }
  $('#tabbar')?.setAttribute('aria-label', t('Seções'));
  const ib = $('#installTop');
  if (ib) { ib.title = t('Instalar o app'); ib.setAttribute('aria-label', t('Instalar o app na tela inicial')); }
}

function accountCard() {
  if (!driveAvailable()) return '';
  const s = state.sync;
  if (!driveConnected()) {
    return `<div class="card stack">
      <h3>${t('Conta')}</h3>
      <p class="muted small">${t('Você está usando o app sem conta: os dados ficam só neste aparelho. Entre com sua conta Google para salvar tudo no seu Drive e usar em qualquer aparelho. O app só enxerga os arquivos que ele mesmo cria, numa pasta "Overload".')}</p>
      ${googleBtn(t('Entrar com Google'), 'block')}
    </div>`;
  }
  const status = s.error ? `<span class="badge warn">${esc(t(s.error))}</span>`
    : !hasToken() ? (driveDirty() ? `<span class="badge warn">${t('alterações ainda não enviadas')}</span>` : `<span class="badge">${t('toque em Sincronizar para atualizar')}</span>`)
      : driveDirty() ? `<span class="badge">${t('enviando…')}</span>` : `<span class="badge good">${icon.check}${t('em dia')}</span>`;
  return `<div class="card stack">
    <h3>${t('Conta')}</h3>
    <p class="small">${t('Conectado como <b>{email}</b>', { email: esc(s.email) })}</p>
    <p class="small muted">${t('Última sincronização com o Google Drive: {quando}', { quando: s.lastSync ? t('{dia} às {hora}', { dia: fmtDate(s.lastSync), hora: fmtTime(s.lastSync) }) : t('nunca') })}</p>
    <div>${status}</div>
    <button class="btn block sync-btn ${syncState()}" id="syncNow" data-act="driveConnect">${syncState() === 'ok' ? `${icon.check}${t('Sincronizado')}` : `${icon.sync}${t('Sincronizar agora')}`}</button>
    <p class="muted small">${t('O app salva no Drive sozinho, inclusive ao finalizar cada treino.')}</p>
    <button class="btn block" data-act="logoutAsk">${t('Sair da conta')}</button>
    <p class="muted small">${t('Para usar outro perfil, saia e entre com outra conta Google.')}</p>
  </div>`;
}

export function applyTheme() {
  const th = state.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0d0d0d' : '#f9f9f7';
}

function render() {
  const s = state.settings;
  const n = state.sessions.length;
  $('#view').innerHTML = `
    <div class="head"><h1>${t('Ajustes')}</h1></div>
    <div class="stack">
      <div class="card stack">
        <label class="field">${t('Idioma')} · Language · Idioma
          <select data-change="setLang">
            ${LANGS.map(([id, name]) => `<option value="${id}"${lang() === id ? ' selected' : ''}>${name}</option>`).join('')}
          </select></label>
      </div>

      <div class="card stack">
        <h3>${t('Treino')}</h3>
        ${stepper('rest', s.rest, 15, t('Descanso entre séries (segundos)'), 0, 'setRest')}
        <label class="field">${t('Aparência')}
          <select data-change="setTheme">
            <option value="auto"${s.theme === 'auto' ? ' selected' : ''}>${t('Seguir o sistema')}</option>
            <option value="dark"${s.theme === 'dark' ? ' selected' : ''}>${t('Escuro')}</option>
            <option value="light"${s.theme === 'light' ? ' selected' : ''}>${t('Claro')}</option>
          </select></label>
      </div>

      ${aiCard()}

      ${accountCard()}

      <div class="card stack">
        <h3>${t('Seus dados')}</h3>
        <p class="muted small">${tn(n, '{n} treino salvo neste aparelho.', '{n} treinos salvos neste aparelho.')} ${t('Faça backup de vez em quando: limpar os dados do navegador apaga tudo.')}</p>
        <p class="small"><b>${t('Último backup:')}</b> ${state.lastBackup ? fmtDate(state.lastBackup) : t('nunca')}</p>
        <button class="btn primary block" data-act="backupNow">${t('Salvar backup completo')}</button>
        <p class="muted small">${t('No celular, abre o menu de compartilhar para mandar o arquivo ao Google Drive, WhatsApp ou e-mail. Se o navegador não permitir, o arquivo é baixado.')}</p>
        <button class="btn block" data-act="exportCSV">${t('Exportar treinos (planilha CSV)')}</button>
        <label class="btn block">${t('Restaurar backup')}<input type="file" accept="application/json,.json,text/plain,.txt" data-change="importBackup" class="sr"></label>
      </div>

      ${isInstalled() ? '' : `<div class="card stack">
        <h3>${t('Instalar no celular')}</h3>
        <p class="muted small">${t('Instalado, o app abre pelo ícone na tela inicial, em tela cheia e funciona sem internet.')}</p>
        <button class="btn block" data-act="installApp">${icon.download}${t('Instalar o Overload')}</button>
      </div>`}

      <div class="card stack">
        <h3>${t('Começar do zero')}</h3>
        <p class="muted small">${driveConnected() ? t('Apaga todos os treinos, exercícios, metas e ajustes, neste aparelho e no seu Google Drive.') : t('Apaga todos os treinos, exercícios, metas e ajustes.')}</p>
        <button class="btn ghost danger block" data-act="wipeAsk">${icon.trash}${t('Apagar tudo e começar do zero')}</button>
      </div>
      <p class="small muted" style="text-align:center">${t('Overload · feito para uso pessoal')}<br>
        <a href="sobre.html">${t('Sobre o app')}</a> · <a href="privacidade.html">${t('Política de privacidade')}</a></p>
    </div>`;
}

// ---------- Treinador IA: Claude, ChatGPT ou Gemini ----------

const loadedModels = {}; // provedor -> lista de modelos buscada na chave

function aiCard() {
  const p = aiProvider();
  const info = PROVIDERS[p];
  const current = aiModel(p);
  const models = [...new Set([current, ...(loadedModels[p] || [])].filter(Boolean))];
  const note = {
    claude: t('Cobrado por uso na sua conta da Anthropic. Dá para definir um limite de gastos no Console.'),
    openai: t('Cobrado por uso na sua conta da OpenAI. A assinatura ChatGPT Plus não inclui a API: a chave é criada à parte.'),
    gemini: t('Tem um uso gratuito com limites diários. No plano gratuito, o Google pode usar o que é enviado para melhorar os produtos dele.'),
  }[p];
  return `<div class="card stack">
    <h3>${t('Treinador IA (opcional)')}</h3>
    <p class="muted small">${t('Com uma chave de API da sua IA favorita (Claude, ChatGPT ou Gemini), o app entende frases de voz mais livres, analisa sua semana e tira dúvidas de execução. Sem chave, tudo o mais funciona normalmente, inclusive sem internet.')}</p>
    <form class="stack" data-submit="saveKey">
      <label class="field">${t('IA')}
        <select name="provider" data-change="setAiProvider">
          ${Object.entries(PROVIDERS).map(([id, v]) => `<option value="${id}"${id === p ? ' selected' : ''}>${v.name}</option>`).join('')}
        </select></label>
      <label class="field">${t('Chave da API')}
        <input type="password" name="key" value="${esc(aiKey(p))}" placeholder="${info.keyHint}" autocomplete="off" spellcheck="false"></label>
      <label class="field">${t('Modelo')}
        <select name="model">
          ${models.length ? models.map(m => `<option value="${esc(m)}"${m === current ? ' selected' : ''}>${esc(m)}</option>`).join('')
            : `<option value="">${t('Escolhido ao salvar a chave')}</option>`}
        </select></label>
      ${aiKey(p) ? `<button type="button" class="btn ghost block" data-act="loadModels">${t('Atualizar lista de modelos')}</button>` : ''}
      <div class="row">
        <button class="btn primary grow">${t('Salvar')}</button>
        ${aiEnabled() ? `<button type="button" class="btn" data-act="testAI">${t('Testar')}</button>` : ''}
      </div>
    </form>
    <p class="muted small">${note}</p>
    <p class="muted small">${t('A chave fica guardada só neste aparelho e é enviada apenas à empresa da IA escolhida.')}</p>
    <a class="btn block" href="${info.keyUrl}" target="_blank" rel="noopener">${t('Criar chave de API: {ia}', { ia: info.name })}</a>
  </div>`;
}

changes.setAiProvider = el => { state.settings.aiProvider = el.value; save(); rerender(); };

/** Busca os modelos da chave e guarda a configuração. Devolve o modelo escolhido. */
async function fetchModels(p, key, keepModel) {
  const { models, recommended } = await listModels(p, key);
  loadedModels[p] = models;
  const model = keepModel && models.includes(keepModel) ? keepModel : recommended;
  if (!model) throw new Error(t('Nenhum modelo de texto encontrado para esta chave.'));
  return model;
}

actions.loadModels = async el => {
  const form = el.closest('form');
  const p = form.provider.value, key = form.key.value.trim();
  el.disabled = true;
  el.textContent = t('Buscando modelos…');
  try {
    const model = await fetchModels(p, key, form.model.value);
    setAiConfig(p, key, model);
    save();
    toast(t('{n} modelos encontrados.', { n: loadedModels[p].length }));
  } catch (e) {
    toast(e.message, 6000);
  }
  rerender();
};

submits.saveKey = async form => {
  const p = form.provider.value, key = form.key.value.trim();
  let model = form.model.value;
  if (!key) {
    setAiConfig(p, '', model);
    save(); toast(t('IA desativada.')); rerender();
    return;
  }
  const btn = form.querySelector('button.primary');
  btn.disabled = true;
  btn.textContent = t('Salvando…');
  try {
    // sem modelo escolhido (ou trocou de provedor): busca a lista e escolhe um padrão bom
    if (!model || !loadedModels[p]) model = await fetchModels(p, key, model);
    setAiConfig(p, key, model);
    save();
    toast(t('IA configurada: {ia}, modelo {m}.', { ia: PROVIDERS[p].name, m: model }), 4000);
  } catch (e) {
    setAiConfig(p, key, model);
    save();
    toast(e.message, 6000);
  }
  rerender();
};

changes.setLang = el => {
  state.settings.lang = el.value;
  save();
  applyLang();
  rerender();
};
changes.setRest = el => { state.settings.rest = Math.max(0, Math.round(Number(el.value) || 0)); save(); };
changes.setTheme = el => { state.settings.theme = el.value; save(); applyTheme(); };

actions.testAI = async el => {
  el.disabled = true;
  el.textContent = t('Testando…');
  try {
    await aiAskExecution('Teste de conexão', '', 'Responda apenas: ok');
    toast(t('Conexão com a IA funcionando.'));
  } catch (e) {
    toast(e.message, 6000);
  }
  rerender();
};

const stamp = () => new Date().toISOString().slice(0, 10);
actions.exportCSV = () => shareFile(`overload-${t('treinos')}-${stamp()}.csv`, sessionsCSV(), 'text/csv');
// Usado em Ajustes e no lembrete da tela Hoje
actions.backupNow = async () => {
  const r = await shareFile(`overload-backup-${stamp()}.json`, exportJSON(), 'application/json');
  if (r === 'cancelled') return;
  state.lastBackup = new Date().toISOString();
  save();
  toast(r === 'shared' ? t('Backup enviado.') : t('Arquivo de backup gerado. Guarde-o fora do celular.'), 4000);
  rerender();
};
changes.importBackup = async el => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    JSON.parse(text);
    window.__pendingImport = text;
    sheet(`<h2>${t('Restaurar este backup?')}</h2>
      <p class="muted">${t('Os dados atuais deste aparelho serão substituídos pelos do arquivo "{nome}".', { nome: esc(file.name) })}</p>
      <button class="btn primary block" data-act="importNow">${t('Restaurar')}</button>
      <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
  } catch {
    toast(t('Não consegui ler este arquivo de backup.'), 5000);
  }
  el.value = '';
};
actions.importNow = () => {
  try {
    importJSON(window.__pendingImport);
    toast(t('Backup restaurado.'));
  } catch (e) {
    toast(t(e.message), 5000);
  }
  window.__pendingImport = null;
  closeSheet(); applyTheme(); applyLang(); rerender();
};
// Entrar, reconectar ou sincronizar (também usado na tela Hoje e no primeiro acesso)
actions.driveConnect = async el => {
  const label = el.innerHTML;
  el.disabled = true;
  el.textContent = t('Conectando…');
  const wasNew = !state.onboarded;
  try {
    if (driveConnected() && hasToken()) {
      if (!(await sync())) throw new Error(t('Não foi possível sincronizar agora. Tente de novo.'));
    } else await connect();
    applyLang();
    if (wasNew) {
      if (state.onboarded) { toast(t('Seus dados foram recuperados do Google Drive.'), 4000); go('#/hoje'); return; }
      toast(t('Conta conectada.'), 3000);
    } else {
      toast(t('Dados sincronizados com o Google Drive.'));
    }
  } catch (e) {
    toast(e.message, 6000);
  }
  el.disabled = false;
  el.innerHTML = label;
  rerender();
  updateSyncBadge();
};

// ---------- Sair da conta ----------

actions.logoutAsk = () => {
  const s = state.sync;
  sheet(`<h2>${t('Sair da conta?')}</h2>
    <ul class="errs">
      <li>${t('Seus treinos continuam salvos no Google Drive de <b>{email}</b>.', { email: esc(s.email) })}</li>
      <li>${t('Este aparelho fica sem dados e volta para a tela de entrada.')}</li>
      <li>${t('Para usar outro perfil, escolha outra conta Google na próxima entrada. Para voltar a este, entre com a mesma conta e tudo reaparece.')}</li>
    </ul>
    ${driveDirty() ? `<p class="tip">${t('Há alterações deste aparelho ainda não enviadas. O app tenta enviar antes de sair.')}</p>` : ''}
    <button class="btn primary block" data-act="logoutNow">${t('Sair')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
function doLogout() {
  logout();
  closeSheet();
  applyTheme();
  applyLang();
  toast(t('Você saiu da conta.'));
  go('#/inicio');
}
actions.logoutNow = el => {
  if (!driveDirty()) { doLogout(); return; }
  // envia o que falta antes de sair (a renovação precisa partir deste toque)
  const ready = refreshIfNeeded();
  el.disabled = true;
  el.textContent = t('Salvando no Drive…');
  ready.then(ok => (ok ? sync() : false)).catch(() => false).then(() => {
    if (!driveDirty()) { doLogout(); return; }
    sheet(`<h2>${t('Não deu para salvar as últimas alterações')}</h2>
      <p class="muted">${t('Sem internet ou sem confirmar a conta, o app não conseguiu enviar o que mudou desde a última sincronização. Se sair agora, essas alterações se perdem; o que já estava no Drive continua lá.')}</p>
      <button class="btn block" data-act="closeSheet">${t('Cancelar e tentar depois')}</button>
      <button class="btn danger block" data-act="logoutForce">${t('Sair mesmo assim')}</button>`);
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
  sheet(`<h2>${t('Apagar tudo e começar do zero?')}</h2>
    <p class="muted">${t('O que vai acontecer:')}</p>
    <ul class="errs">
      <li>${t('<b>{treinos}</b>, {exercicios}, {rotinas} e {metas} serão apagados.', {
        treinos: tn(n, '{n} treino', '{n} treinos'), exercicios: tn(ex, '{n} exercício', '{n} exercícios'),
        rotinas: tn(rt, '{n} rotina', '{n} rotinas'), metas: tn(goals, '{n} meta', '{n} metas'),
      })}</li>
      ${connected
        ? `<li>${t('Também no seu Google Drive (<b>{email}</b>). Outros aparelhos com esta conta ficam vazios na próxima sincronização.', { email: esc(state.sync.email) })}</li>
           <li>${t('Você continua conectado com esta conta e escolhe os treinos de novo.')}</li>`
        : `<li>${t('Apenas neste aparelho. O app volta para a tela inicial.')}</li>`}
      <li>${Object.values(state.settings.aiKeys || {}).some(Boolean) || state.settings.apiKey ? t('Os ajustes voltam ao padrão e a chave da IA é removida.') : t('Os ajustes voltam ao padrão.')}</li>
      <li><b>${t('Não dá para desfazer.')}</b></li>
    </ul>
    ${n ? `<button class="btn block" data-act="backupNow">${t('Salvar um backup antes')}</button>` : ''}
    <label class="check"><input type="checkbox" data-change="wipeCheck">${n > 1 ? t('Entendo que meus {n} treinos serão apagados para sempre.', { n }) : n === 1 ? t('Entendo que meu treino será apagado para sempre.') : t('Entendo que tudo será apagado para sempre.')}</label>
    <button class="btn danger block" id="wipeBtn" data-act="wipeNow" disabled>${t('Apagar tudo')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
changes.wipeCheck = el => { $('#wipeBtn').disabled = !el.checked; };
actions.wipeNow = el => {
  if (!$('#sheet input[data-change=wipeCheck]')?.checked) return;
  const connected = driveConnected();
  // a renovação da conta precisa partir deste toque
  const ready = connected ? refreshIfNeeded() : Promise.resolve(true);
  el.disabled = true;
  el.textContent = t('Apagando…');
  (async () => {
    const empty = emptyData();
    if (connected) {
      if (!(await ready)) throw new Error(t('Não foi possível confirmar a conta Google.'));
      await wipeRemote(empty); // primeiro o Drive: se falhar, nada é apagado
    }
    resetKeepAccount(empty.updatedAt);
  })().then(() => {
    closeSheet();
    applyTheme();
    applyLang();
    toast(t('Tudo apagado. Vamos começar do zero.'), 4000);
    go('#/inicio');
  }, e => {
    toast(`${e.message} ${t('Nada foi apagado.')}`, 6000);
    el.disabled = false;
    el.textContent = t('Apagar tudo');
  });
};

route('ajustes', render);
