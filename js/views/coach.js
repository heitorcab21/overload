// Treinador: conversa com a IA (Claude, ChatGPT ou Gemini) usando os dados do app como contexto.
// A conversa fica só neste aparelho (não vai para o Drive) e guarda as últimas mensagens.
import { state } from '../store.js';
import { $, esc, icon, actions, submits, sheet } from '../ui.js';
import { go } from '../router.js';
import { aiEnabled, aiChat, aiProvider, PROVIDERS } from '../ai.js';
import { t } from '../i18n.js';
import { buildSummary } from './home.js';

const KEY = 'overload:coach';
const MAX = 30;
let chat = load();
let busy = false;

function load() {
  try { const c = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(c) ? c : []; } catch { return []; }
}
function keep() {
  chat = chat.slice(-MAX);
  try { localStorage.setItem(KEY, JSON.stringify(chat)); } catch { /* sem espaço */ }
}

const SUGGESTIONS = () => [
  t('Analise minha última semana de treinos'),
  t('Em quais exercícios estou estagnado e o que faço?'),
  t('Monte um aquecimento para o meu próximo treino'),
  t('Meu volume por grupo muscular está equilibrado?'),
  t('Estou cansado hoje: como adapto o treino?'),
];

/** Texto da IA com o mínimo de formatação: parágrafos, listas "- " e **negrito**. */
function fmt(text) {
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(li => `<li>${bold(li)}</li>`).join('')}</ul>`); list = []; } };
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*[-•*]\s+(.*)/.exec(line);
    if (m) { list.push(m[1]); continue; }
    flush();
    if (line.trim()) out.push(`<p>${bold(line.trim())}</p>`);
  }
  flush();
  return out.join('');
}

function bubbles() {
  return chat.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}">${m.role === 'user' ? `<p>${esc(m.content)}</p>` : fmt(m.content)}</div>`).join('')
    + (busy ? `<div class="msg ai typing"><span></span><span></span><span></span></div>` : '');
}

function render() {
  if (!aiEnabled()) {
    sheet(`<h2>${icon.spark}${t('Treinador')}</h2>
      <p class="muted">${t('Converse com uma IA que conhece os seus treinos, cargas e metas: peça análises, ajustes e dicas de execução.')}</p>
      <p class="muted">${t('Para ligar, adicione nos Ajustes a chave da sua IA (Claude, ChatGPT ou Gemini). O Gemini tem um plano gratuito.')}</p>
      <button class="btn primary block" data-act="coachSetup">${t('Configurar IA')}</button>`);
    return;
  }
  sheet(`<div class="coach">
    <div class="coach-head"><h2>${icon.spark}${t('Treinador')}</h2>
      ${chat.length ? `<button class="btn sm ghost" data-act="coachNew">${t('Nova conversa')}</button>` : ''}</div>
    <div class="coach-log" id="coachLog">${chat.length ? bubbles() : `<p class="muted small">${t('Pergunte o que quiser sobre os seus treinos. Eu vejo seus registros, fichas, metas e cardio.')}</p>`}</div>
    ${busy ? '' : `<div class="coach-sugs">${SUGGESTIONS().map(q => `<button class="chip" data-act="coachAsk" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
    <form class="coach-form" data-submit="coachSend">
      <textarea name="q" rows="1" maxlength="1000" placeholder="${t('Escreva sua pergunta…')}" ${busy ? 'disabled' : ''}></textarea>
      <button class="btn primary" ${busy ? 'disabled' : ''} aria-label="${t('Enviar')}">${icon.next}</button>
    </form>
    <p class="small muted coach-note">${t('Usa {p} com a sua chave. A conversa fica só neste aparelho.', { p: PROVIDERS[aiProvider()]?.name || 'IA' })}</p>
  </div>`);
  const log = $('#coachLog');
  if (log) log.scrollTop = log.scrollHeight;
}

async function send(q) {
  q = String(q || '').trim();
  if (!q || busy) return;
  chat.push({ role: 'user', content: q });
  busy = true;
  render();
  try {
    // só as mensagens válidas, alternando pessoa e IA, terminando na pergunta nova
    const msgs = chat.filter(m => !m.error).map(({ role, content }) => ({ role, content }));
    const answer = await aiChat(msgs, buildSummary());
    chat.push({ role: 'assistant', content: answer || t('Sem resposta. Tente de novo.') });
  } catch (e) {
    chat.pop(); // tira a pergunta que não foi respondida, para não quebrar a alternância
    chat.push({ role: 'user', content: q, error: true });
    chat.push({ role: 'assistant', content: e.message || t('Erro da IA. Tente mais tarde.'), error: true });
  }
  busy = false;
  keep();
  if (!$('#sheet').hidden && $('.coach')) render();
}

actions.coachOpen = () => render();
actions.coachAsk = el => send(el.dataset.q);
actions.coachNew = () => { chat = []; keep(); render(); };
actions.coachSetup = () => { go('#/ajustes'); document.querySelector('#sheet [data-act="closeSheet"]')?.click(); };
submits.coachSend = form => send(form.q.value);
