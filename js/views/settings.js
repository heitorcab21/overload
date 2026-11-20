// Ajustes: idioma, descanso, tema, IA, conta, dados e instalação.
import { state, save, exportJSON, importJSON, emptyData, resetKeepAccount } from '../store.js';
import { googleBtn, $, $$, esc, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, shareFile, fmtDate, fmtTime, waitDone, startWait, stopWait } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { sessionsCSV } from '../export.js';
import { askRestNotify, testRestNotify } from './workout.js';
import { aiEnabled, aiAskExecution, PROVIDERS, aiProvider, aiKey, aiModel, setAiConfig, listModels } from '../ai.js';
import { driveAvailable, driveConnected, driveDirty, connect, sync, hasToken, refreshIfNeeded, logout, wipeRemote } from '../drive.js';
import { isInstalled } from '../install.js';
import { syncState, syncLabel, updateSyncBadge } from '../syncbadge.js';
import { t, tn, lang, LANGS } from '../i18n.js';

/** Aplica o idioma às partes fixas da página (abas, atributo lang). */
export function applyLang() {
  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[lang()];
  const labels = { hoje: t('Hoje'), metas: t('Metas'), progresso: t('Progresso'), exercicios: t('Treinos'), cardio: t('Cardio'), ajustes: t('Ajustes/Ajuda') };
  for (const a of $$('#tabbar a')) {
    const l = a.querySelector('.tab-label');
    // "Ajustes/Ajuda" quebra depois da barra quando não cabe
    if (l) l.innerHTML = esc(labels[a.dataset.tab]).replace('/', '/<wbr>');
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
      <a class="btn block help-btn" href="#/ajuda">${icon.bulb}<span class="grow">${t('Ajuda')}<br><small>${t('Tutoriais de cada parte do app')}</small></span>${icon.next}</a>
      <div class="card stack">
        <label class="field">${t('Idioma')} · Language · Idioma
          <select data-change="setLang">
            ${LANGS.map(([id, name]) => `<option value="${id}"${lang() === id ? ' selected' : ''}>${name}</option>`).join('')}
          </select></label>
      </div>

      <div class="card stack">
        <h3>${t('Treino')}</h3>
        ${stepper('rest', s.rest, 15, t('Descanso entre séries (segundos)'), 0, 'setRest')}
        ${restNotifyRow()}
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
        <h3>${t('Backup')}</h3>
        <p class="muted small">${tn(n, '{n} treino salvo neste aparelho.', '{n} treinos salvos neste aparelho.')} ${t('Faça backup de vez em quando: limpar os dados do navegador apaga tudo.')}</p>
        <p class="small"><b>${t('Último backup:')}</b> ${state.lastBackup ? fmtDate(state.lastBackup) : t('nunca')}</p>
        <button class="btn primary block" data-act="backupNow">${t('Salvar backup completo')}</button>
        <p class="muted small">${t('No celular, abre o menu de compartilhar para mandar o arquivo ao Google Drive, WhatsApp ou e-mail. Se o navegador não permitir, o arquivo é baixado.')}</p>
        <label class="btn block">${t('Restaurar backup')}<input type="file" accept="application/json,.json,text/plain,.txt" data-change="importBackup" class="sr"></label>
      </div>

      <div class="card stack">
        <h3>${t('Planilhas e importação')}</h3>
        <p class="muted small">${t('Abra no Excel ou no Google Planilhas. A planilha de metas pode ser editada e importada de volta.')}</p>
        <button class="btn block sheet-green" data-act="exportCSV">${icon.share}${t('Exportar treinos (planilha CSV)')}</button>
        <button class="btn block sheet-green" data-act="exportGoals">${icon.share}${t('Exportar metas (CSV)')}</button>
        <label class="btn block sheet-green-soft">${icon.download}${t('Importar metas (CSV)')}<input type="file" accept=".csv,text/csv,text/plain" data-change="importGoals" class="sr"></label>
        <a class="btn block" href="#/importar">${icon.edit}${t('Importar do bloco de notas')}</a>
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
      <p class="small muted" style="text-align:center">${t('Overload · feito para uso pessoal')} · <span id="appVersion"></span><br>
        <a href="sobre.html">${t('Sobre o app')}</a> · <a href="privacidade.html${lang() === 'en' ? '#en' : ''}">${t('Política de privacidade')}</a></p>
    </div>`;
  showVersion();
}

/** Mostra a versão instalada (nome do cache do service worker), para conferir se o app atualizou. */
function showVersion() {
  if (!window.caches) return;
  caches.keys().then(keys => {
    const v = keys.map(k => k.match(/^overload-v(\d+)$/)?.[1]).filter(Boolean).sort((a, b) => b - a)[0];
    const el = document.getElementById('appVersion');
    if (el) el.textContent = v ? t('versão {v}', { v }) : t('versão de desenvolvimento');
  }).catch(() => {});
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
    <p class="muted small">${t('Com uma chave de API da sua IA favorita (Claude, ChatGPT ou Gemini), você conversa com o Treinador sobre os seus treinos, e o app entende frases de voz mais livres e tira dúvidas de execução. Sem chave, tudo o mais funciona normalmente, inclusive sem internet.')}</p>
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
      <a class="btn block" href="${info.keyUrl}" target="_blank" rel="noopener">${t('Criar chave de API: {ia}', { ia: info.name })}</a>
    </form>
    <p class="muted small">${note}</p>
    <p class="muted small">${t('A chave fica guardada só neste aparelho e é enviada apenas à empresa da IA escolhida.')}</p>
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

// Troca rápida de idioma na primeira tela
actions.quickLang = el => {
  state.settings.lang = el.dataset.l;
  save({ touch: false });
  applyLang();
  rerender();
};

changes.setLang = el => {
  state.settings.lang = el.value;
  save();
  applyLang();
  rerender();
};
/** Aviso do fim do descanso com o app fora da tela (notificação). */
function restNotifyRow() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return `<p class="small muted">${t('Este navegador não permite notificações; o aviso do fim do descanso toca só com o app aberto.')}</p>`;
  const p = Notification.permission;
  if (p === 'granted') return `<label class="check"><input type="checkbox" data-change="setRestNotify"${state.settings.restNotify !== false ? ' checked' : ''}>${t('Avisar o fim do descanso com o app fora da tela')}</label>
    <p class="small muted">${t('Notificações: liberadas.')}</p>
    <button class="btn block" data-act="testRestNotify">${icon.bell}${t('Testar notificação')}</button>`;
  if (p === 'denied') return `<p class="small muted">${t('Notificações bloqueadas. Para liberar no Android: Configurações do celular → Apps → Overload (ou Chrome, se não instalou o app) → Notificações → Permitir. Depois feche e abra o app.')}</p>`;
  return `<p class="small muted">${t('Notificações: ainda não liberadas.')}</p>
    <button class="btn block" data-act="askRestNotify">${icon.bell}${t('Avisar o fim do descanso com o app fora da tela')}</button>`;
}
changes.setRestNotify = el => { state.settings.restNotify = el.checked; save(); };
actions.askRestNotify = async () => { await askRestNotify(); rerender(); };
actions.testRestNotify = () => { testRestNotify(); toast(t('Primeira notificação enviada. Saia do app: em 10 segundos chega a segunda.'), 5000); };
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
  const plans = (state.savedPlans || []).length;
  const cardio = (state.cardio || []).length;
  const connected = driveConnected();
  sheet(`<h2>${t('Apagar tudo e começar do zero?')}</h2>
    <p class="muted">${t('O que vai acontecer:')}</p>
    <ul class="errs">
      <li><b>${t('Todos os seus treinos e dados salvos serão apagados:')}</b>
        <ul class="wipe-what">
          <li>${tn(n, '{n} treino registrado no histórico', '{n} treinos registrados no histórico')}</li>
          <li>${tn(rt, '{n} dia de treino', '{n} dias de treino')} · ${tn(plans, '{n} treino em "Meus treinos salvos"', '{n} treinos em "Meus treinos salvos"')}</li>
          <li>${tn(ex, '{n} exercício, com cargas e anotações', '{n} exercícios, com cargas e anotações')} · ${tn(goals, '{n} meta', '{n} metas')}</li>
          <li>${tn(cardio, '{n} registro de cardio', '{n} registros de cardio')}${(state.cardioRoutines || []).length ? ` · ${tn(state.cardioRoutines.length, '{n} rotina de cardio', '{n} rotinas de cardio')}` : ''}</li>
          ${state.profile ? `<li>${t('Seu perfil: peso, medidas e histórico de peso')}</li>` : ''}
        </ul></li>
      ${connected
        ? `<li>${t('Também no seu Google Drive (<b>{email}</b>). Outros aparelhos com esta conta ficam vazios na próxima sincronização.', { email: esc(state.sync.email) })}</li>
           <li>${t('Você continua conectado com esta conta e escolhe os treinos de novo.')}</li>`
        : `<li>${t('Apenas neste aparelho. O app volta para a tela inicial.')}</li>`}
      <li>${Object.values(state.settings.aiKeys || {}).some(Boolean) || state.settings.apiKey ? t('Os ajustes voltam ao padrão e a chave da IA é removida.') : t('Os ajustes voltam ao padrão.')}</li>
      <li><b>${t('Não dá para desfazer.')}</b></li>
    </ul>
    ${n ? `<button class="btn block" data-act="backupNow">${t('Salvar um backup antes')}</button>` : ''}
    <label class="check"><input type="checkbox" data-change="wipeCheck">${t('Entendo que todos os meus treinos e dados salvos serão apagados para sempre.')}</label>
    <p class="small muted">${t('Depois de marcar, o botão libera em 5 segundos, por segurança.')}</p>
    <button class="btn danger block" id="wipeBtn" data-act="wipeFinal" data-wait="5" data-gate="#sheet input[data-change=wipeCheck]" disabled>${t('Apagar tudo')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
// a contagem de 5 segundos só começa depois de marcar que entendeu; desmarcar trava de novo
changes.wipeCheck = el => (el.checked ? startWait : stopWait)($('#wipeBtn'));
// última janela: só abre depois da caixa marcada e dos 5 segundos
let wipeArmed = false;
actions.wipeFinal = el => {
  if (!$('#sheet input[data-change=wipeCheck]')?.checked || !waitDone(el)) return;
  wipeArmed = true;
  sheet(`<h2>${t('Tem certeza?')}</h2>
    <p class="muted">${t('Todos os seus treinos e dados salvos serão apagados para sempre. Não dá para desfazer.')}</p>
    <button class="btn block" data-act="wipeCancel">${t('Cancelar')}</button>
    <button class="btn danger block" data-act="wipeNow">${t('Sim, apagar tudo')}</button>`);
};
actions.wipeCancel = () => { wipeArmed = false; closeSheet(); };
actions.wipeNow = el => {
  if (!wipeArmed) return;
  wipeArmed = false;
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
    wipeArmed = true;
    el.disabled = false;
    el.textContent = t('Sim, apagar tudo');
  });
};

route('ajustes', render);
