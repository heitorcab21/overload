// Treinador: conversa com a IA (Claude, ChatGPT ou Gemini) usando os dados do app como contexto.
// A conversa fica só neste aparelho (não vai para o Drive) e guarda as últimas mensagens.
import { state } from '../store.js';
import { $, esc, icon, actions, submits, sheet, fmtDate } from '../ui.js';
import { stalledExercises, groupGoalStatus, weekStart, addDays } from '../logic.js';
import { cardioIn, cardioMinutes } from '../cardio.js';
import { strengthLevel, profile } from '../body.js';
import { exName, tg, routineName } from '../data.js';
import { go, current, afterRender } from '../router.js';
import { aiEnabled, aiChat, aiProvider, PROVIDERS } from '../ai.js';
import { t } from '../i18n.js';
import { buildSummary } from './home.js';

// Ícone simplificado de cada IA, nas cores da marca (o genérico ✦ quando não há IA configurada).
const PROVIDER_ICON = {
  claude: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g stroke="#D97757" stroke-width="2.4" stroke-linecap="round">'
    + [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => `<line x1="12" y1="12" x2="12" y2="${i % 2 ? 4.5 : 2.5}" transform="rotate(${a + (i % 2 ? 8 : 0)} 12 12)"/>`).join('')
    + '</g></svg>',
  gemini: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="gemG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A73E8"/><stop offset=".6" stop-color="#4C8DF6"/><stop offset="1" stop-color="#8E9CF5"/></linearGradient></defs>'
    + '<path fill="url(#gemG)" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z"/></svg>',
  openai: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#10A37F" stroke-width="1.9">'
    + [0, 60, 120].map(a => `<ellipse cx="12" cy="12" rx="4" ry="9" transform="rotate(${a} 12 12)"/>`).join('') + '</g></svg>',
};
const coachIcon = () => (aiEnabled() && PROVIDER_ICON[aiProvider()]) || icon.spark;

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

/** Sugestões de pergunta montadas com os dados da pessoa (as mais úteis primeiro, até 6). */
function suggestions() {
  const now = new Date();
  const out = [];
  const day = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const last = state.sessions.reduce((a, b) => (!a || new Date(b.date) > new Date(a.date) ? b : a), null);
  if (last) {
    const days = Math.round((day(now) - day(last.date)) / 864e5);
    const when = days <= 0 ? t('de hoje') : days === 1 ? t('de ontem') : t('de {d}', { d: fmtDate(last.date, false) });
    out.push(t('Analise meu treino {quando} ({x})', { quando: when, x: routineName(last) }));
  }
  const st = stalledExercises(now)[0];
  if (st) out.push(t('Travei no {x}: o que faço para voltar a evoluir?', { x: exName(st.ex) }));
  if (state.routines.length) {
    const r = state.routines[(state.next || 0) % state.routines.length];
    out.push(t('Monte um aquecimento para o {x}', { x: routineName(r) }));
  }
  const behind = groupGoalStatus(now).filter(g => g.weekGoal && g.weekDone < g.weekGoal)
    .sort((a, b) => (b.weekGoal - b.weekDone) - (a.weekGoal - a.weekDone))[0];
  if (behind) out.push(t('Faltam {n} séries de {g} nesta semana. Como encaixo?', { n: behind.weekGoal - behind.weekDone, g: tg(behind.group).toLowerCase() }));
  const ws = weekStart(now);
  const cMin = cardioMinutes(cardioIn(ws, addDays(ws, 7)));
  const cGoal = state.cardioGoal || 150;
  if (cMin < cGoal) out.push(t('Fiz {n} de {g} min de cardio na semana. Como completo?', { n: cMin, g: cGoal }));
  const p = profile();
  if (p) {
    // o exercício em que a pessoa está mais longe do topo: onde há mais para subir
    const lv = Object.values(state.exercises).map(ex => ({ ex, l: strengthLevel(ex, p) })).filter(x => x.l.top).sort((a, b) => b.l.top - a.l.top)[0];
    if (lv) out.push(t('Como subo do Top {n}% no {x}?', { n: lv.l.top, x: exName(lv.ex).toLowerCase() }));
  }
  if (!last) out.push(t('Como começo com segurança?'));
  out.push(t('Estou cansado hoje: como adapto o treino?'));
  return [...new Set(out)].slice(0, 6);
}

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
  const lastErr = chat.length && chat.at(-1).error && !busy;
  return chat.map((m, i) => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}">${m.role === 'user' ? `<p>${esc(m.content)}</p>` : fmt(m.content)}${lastErr && i === chat.length - 1 ? `<button class="btn sm retry" data-act="coachRetry">${t('Tentar de novo')}</button>` : ''}</div>`).join('')
    + (busy ? `<div class="msg ai typing"><span></span><span></span><span></span></div>` : '');
}

function render() {
  if (!aiEnabled()) {
    sheet(`<h2>${coachIcon()}${t('Treinador')}</h2>
      <p class="muted">${t('Converse com uma IA que conhece os seus treinos, cargas e metas: peça análises, ajustes e dicas de execução.')}</p>
      <p class="muted">${t('Para ligar, adicione nos Ajustes a chave da sua IA (Claude, ChatGPT ou Gemini). O Gemini tem um plano gratuito.')}</p>
      <button class="btn primary block" data-act="coachSetup">${t('Configurar IA')}</button>`);
    return;
  }
  sheet(`<div class="coach">
    <div class="coach-head"><h2>${coachIcon()}${t('Treinador')}</h2>
      ${chat.length ? `<button class="btn sm ghost" data-act="coachNew">${t('Nova conversa')}</button>` : ''}</div>
    <div class="coach-log" id="coachLog">${chat.length ? bubbles() : `<p class="muted small">${t('Pergunte o que quiser sobre os seus treinos. Eu vejo seus registros, fichas, metas e cardio.')}</p>`}</div>
    ${busy ? '' : `<div class="coach-sugs">${suggestions().map(q => `<button class="chip" data-act="coachAsk" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
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
// reenvia a última pergunta que deu erro
actions.coachRetry = () => {
  const i = chat.map(m => m.role === 'user' && m.error).lastIndexOf(true);
  if (i < 0 || busy) return;
  const q = chat[i].content;
  chat = chat.slice(0, i);
  send(q);
};
actions.coachNew = () => { chat = []; keep(); render(); };
actions.coachSetup = () => { go('#/ajustes'); document.querySelector('#sheet [data-act="closeSheet"]')?.click(); };
submits.coachSend = form => send(form.q.value);

// ---------- Botão flutuante: em todas as telas com abas, menos Ajustes/Ajuda; fora do treino em andamento ----------
const HIDE_ON = ['ajustes', 'ajuda'];
let fab = null;
export function updateCoachFab() {
  if (!fab) {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'coach-fab';
    fab.dataset.act = 'coachOpen';
    document.body.appendChild(fab);
  }
  const show = !document.body.classList.contains('no-tabs') && !HIDE_ON.includes(current().name);
  fab.hidden = !show;
  fab.classList.remove('away'); // ao trocar de tela ele sempre volta
  document.body.classList.toggle('has-coach', show);
  fab.innerHTML = `<span class="coach-ic">${coachIcon()}</span><span>${t('Treinador')}</span>`;
  fab.setAttribute('aria-label', t('Abrir o Treinador (conversa com a IA)'));
}
afterRender.push(updateCoachFab);

// some enquanto a pessoa rola para baixo (para não cobrir o conteúdo) e volta ao rolar para cima ou no topo
let lastY = 0;
window.addEventListener('scroll', () => {
  if (!fab || fab.hidden) return;
  const y = window.scrollY;
  if (y < 40) { fab.classList.remove('away'); lastY = y; return; }
  // compara com a última posição em que mudou: a rolagem suave anda em passos pequenos
  if (Math.abs(y - lastY) < 12) return;
  fab.classList.toggle('away', y > lastY);
  lastY = y;
}, { passive: true });
