// Treinador: conversa contínua com a IA (Claude, ChatGPT ou Gemini) usando os dados do app como contexto,
// com memória: caderno de fatos sobre a pessoa e resumo das conversas antigas (em state.coach, que sincroniza).
import { state, save } from '../store.js';
import { $, esc, icon, actions, submits, sheet, fmtDate, setStr, toast } from '../ui.js';
import { stalledExercises, groupGoalStatus, weekStart, addDays, entriesFor, bestInRange, sessionsIn } from '../logic.js';
import { coach, apiMessages, foldRange, applyNotes, trimChat, shouldCheckin, memoryText } from '../coachmem.js';
import { cardioIn, cardioMinutes } from '../cardio.js';
import { strengthLevel, profile } from '../body.js';
import { exName, tg, routineName } from '../data.js';
import { go, current, afterRender } from '../router.js';
import { aiEnabled, aiChat, aiProvider, PROVIDERS, aiCoachNotes, aiCoachSummary, aiCoachCheckin } from '../ai.js';
import { t } from '../i18n.js';
import { buildSummary } from './home.js';

import { PROVIDER_ICON } from '../aiicons.js';
const SEND_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const coachIcon = () => (aiEnabled() && PROVIDER_ICON[aiProvider()]) || icon.spark;

// a conversa antiga ficava só no aparelho: passa uma vez para os dados (que sincronizam)
(() => {
  try {
    const old = JSON.parse(localStorage.getItem('overload:coach'));
    if (Array.isArray(old) && old.length && !coach().chat.length) {
      coach().chat = old.filter(m => !m.error).map(m => ({ role: m.role, content: m.content, at: Date.now() }));
      save({ touch: false });
    }
    localStorage.removeItem('overload:coach');
  } catch { /* sem armazenamento */ }
})();
let busy = false;
let view = 'chat'; // 'chat' ou 'mem' (o que o treinador lembra)
const chat = () => coach().chat;
function keep() { trimChat(); save(); }

// ---------- Contexto completo: o resumo do app e o que ele não cobre (meses, peso, anotações, dores, cardio) ----------
function fullContext() {
  const now = new Date();
  const L = [buildSummary()];
  const d = x => new Date(x).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  // evolução de 3 meses: melhor série de cada mês, por exercício
  const months = [2, 1, 0].map(k => { const a = new Date(now.getFullYear(), now.getMonth() - k, 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1)]; });
  const evo = Object.values(state.exercises).filter(ex => entriesFor(ex.id).length).map(ex => {
    const parts = months.map(([a, b]) => { const x = bestInRange(ex.id, a, b); return x ? setStr(x) : '—'; });
    return parts.some(p => p !== '—') ? `- ${ex.name}: ${parts.join(' → ')}` : null;
  }).filter(Boolean);
  if (evo.length) L.push('', `EVOLUÇÃO NOS ÚLTIMOS 3 MESES (melhor série de cada mês, ${months.map(([a]) => a.toLocaleDateString('pt-BR', { month: 'short' })).join(' → ')}):`, ...evo);
  const ws = (state.profile?.weights || []).slice(-8);
  if (ws.length > 1) L.push('', `PESO CORPORAL (últimos registros): ${ws.map(w => `${d(w.date)} ${Math.round(w.kg * 10) / 10} kg`).join(', ')}`);
  const notes = Object.values(state.exercises).filter(ex => ex.note).map(ex => `- ${ex.name}: ${ex.note}`);
  if (notes.length) L.push('', 'ANOTAÇÕES DA PESSOA NOS EXERCÍCIOS:', ...notes);
  const pain = [];
  for (const s of sessionsIn(addDays(now, -60), addDays(now, 1))) {
    for (const e of s.entries) if ((e.flags || []).includes('dor')) pain.push(`${d(s.date)} ${state.exercises[e.exId]?.name || '?'}`);
  }
  if (pain.length) L.push('', `RELATOS DE DOR OU DESCONFORTO NOS TREINOS (60 dias): ${pain.join('; ')}`);
  const cr = (state.cardioRoutines || []).map(r => {
    const h = (state.cardio || []).filter(c => c.routineId === r.id).slice(-3);
    return h.length ? `- ${r.name}: ${h.map(c => `${d(c.date)} ${c.min} min, esforço ${c.rpe ?? '?'}/10`).join('; ')}` : null;
  }).filter(Boolean);
  if (cr.length) L.push('', 'ROTINAS DE CARDIO (últimas sessões):', ...cr);
  return L.join('\n');
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
    out.push([t('Analisar último treino'), t('Analise meu treino {quando} ({x})', { quando: when, x: routineName(last) })]);
  }
  const st = stalledExercises(now)[0];
  if (st) out.push([t('Travei no {x}', { x: exName(st.ex).split(' (')[0] }), t('Travei no {x}: o que faço para voltar a evoluir?', { x: exName(st.ex) })]);
  if (state.routines.length) {
    const r = state.routines[(state.next || 0) % state.routines.length];
    out.push([t('Aquecimento de hoje'), t('Monte um aquecimento para o {x}', { x: routineName(r) })]);
  }
  const behind = groupGoalStatus(now).filter(g => g.weekGoal && g.weekDone < g.weekGoal)
    .sort((a, b) => (b.weekGoal - b.weekDone) - (a.weekGoal - a.weekDone))[0];
  if (behind) out.push([t('Séries de {g} da semana', { g: tg(behind.group).toLowerCase() }), t('Faltam {n} séries de {g} nesta semana. Como encaixo?', { n: behind.weekGoal - behind.weekDone, g: tg(behind.group).toLowerCase() })]);
  const ws = weekStart(now);
  const cMin = cardioMinutes(cardioIn(ws, addDays(ws, 7)));
  const cGoal = state.cardioGoal || 150;
  if (cMin < cGoal) out.push([t('Completar o cardio'), t('Fiz {n} de {g} min de cardio na semana. Como completo?', { n: cMin, g: cGoal })]);
  const p = profile();
  if (p) {
    // o exercício em que a pessoa está mais longe do topo: onde há mais para subir
    const lv = Object.values(state.exercises).map(ex => ({ ex, l: strengthLevel(ex, p) })).filter(x => x.l.top).sort((a, b) => b.l.top - a.l.top)[0];
    if (lv) out.push([t('Evoluir no {x}', { x: exName(lv.ex).split(' (')[0].toLowerCase() }), t('Como subo do Top {n}% no {x}?', { n: lv.l.top, x: exName(lv.ex).toLowerCase() })]);
  }
  if (!last) out.push([t('Como começar'), t('Como começo com segurança?')]);
  out.push([t('Estou cansado hoje'), t('Estou cansado hoje: como adapto o treino?')]);
  // rótulo curto no botão; a pergunta completa vai para a IA
  return out.slice(0, 5);
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
  const list = chat();
  const lastErr = list.length && list.at(-1).error && !busy;
  return list.map((m, i) => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}">${m.role === 'user' ? `<p>${esc(m.content)}</p>` : fmt(m.content)}${lastErr && i === list.length - 1 ? `<button class="btn sm retry" data-act="coachRetry">${t('Tentar de novo')}</button>` : ''}</div>`).join('')
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
  const c = coach();
  if (view === 'mem') { renderMemory(); return; }
  sheet(`<div class="coach">
    <div class="coach-head"><h2>${coachIcon()}${t('Treinador')}</h2>
      <button class="btn sm ghost coach-mem-btn" data-act="coachMem">${MEM_IC}${c.notes.length ? t('Memória ({n})', { n: c.notes.length }) : t('Memória')}</button></div>
    <div class="coach-log" id="coachLog">${chat().length || busy ? bubbles() : `<p class="muted small">${t('Pergunte o que quiser sobre os seus treinos. Eu vejo seus registros, fichas, metas e cardio, e lembro do que você me contar.')}</p>`}</div>
    ${busy ? '' : `<div class="coach-sugs">${suggestions().map(([label, q]) => `<button class="chip" data-act="coachAsk" data-q="${esc(q)}">${esc(label)}</button>`).join('')}</div>`}
    <form class="coach-form" data-submit="coachSend">
      <textarea name="q" rows="1" maxlength="1000" placeholder="${t('Escreva sua pergunta…')}" ${busy ? 'disabled' : ''}></textarea>
      <button class="coach-send" ${busy ? 'disabled' : ''} aria-label="${t('Enviar')}">${SEND_IC}</button>
    </form>
  </div>`);
  // borda e detalhes na cor da IA em uso
  $('#sheet .sheet-card')?.classList.add('coach-card', `prov-${aiProvider()}`);
  const log = $('#coachLog');
  if (log) log.scrollTop = log.scrollHeight;
}

const MEM_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11a1 1 0 011 1v16l-6-3.5L6 20V4a1 1 0 010-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const isOpen = () => !$('#sheet').hidden && ($('.coach') || $('.coach-memory'));

async function send(q) {
  q = String(q || '').trim();
  if (!q || busy) return;
  chat().push({ role: 'user', content: q, at: Date.now() });
  busy = true;
  render();
  let answer = null;
  try {
    const answerText = await aiChat(apiMessages(), fullContext(), memoryText());
    answer = answerText || t('Sem resposta. Tente de novo.');
    chat().push({ role: 'assistant', content: answer, at: Date.now() });
  } catch (e) {
    chat().pop(); // tira a pergunta que não foi respondida, para não quebrar a alternância
    chat().push({ role: 'user', content: q, error: true, at: Date.now() });
    chat().push({ role: 'assistant', content: e.message || t('Erro da IA. Tente mais tarde.'), error: true, at: Date.now() });
  }
  busy = false;
  keep();
  if (isOpen() && view === 'chat') render();
  if (answer) remember(q, answer);
}

// Em segundo plano, depois da resposta: anota no caderno e resume o que ficou antigo (falhas não atrapalham a conversa).
async function remember(q, answer) {
  try {
    const before = coach().notes.length;
    applyNotes(await aiCoachNotes(memoryText().notes, q, answer));
    save();
    const added = coach().notes.length - before;
    if (added > 0 && isOpen() && view === 'chat') { render(); toast(t('Anotei isso na minha memória.'), 2000); }
  } catch { /* fica para a próxima */ }
  try {
    const r = foldRange();
    if (r) {
      const c = coach();
      const msgs = c.chat.slice(r[0], r[1]).filter(m => !m.error);
      c.summary = await aiCoachSummary(c.summary, msgs);
      c.folded = r[1];
      keep();
    }
  } catch { /* tenta de novo na próxima mensagem */ }
}

// Ao abrir: o Treinador puxa assunto (no máximo uma vez a cada 18 h)
async function checkin() {
  if (!aiEnabled() || busy || !shouldCheckin()) return;
  coach().checkinAt = Date.now();
  busy = true;
  render();
  try {
    const text = await aiCoachCheckin(fullContext(), memoryText());
    if (text) chat().push({ role: 'assistant', content: text, at: Date.now(), checkin: true });
  } catch { /* sem puxar assunto desta vez */ }
  busy = false;
  keep();
  if (isOpen() && view === 'chat') render();
}

// ---------- O que o treinador lembra ----------
function renderMemory() {
  const c = coach();
  sheet(`<div class="coach-memory stack">
    <div class="coach-head"><h2>${MEM_IC}${t('O que o treinador lembra')}</h2></div>
    <p class="small muted">${t('Fatos que você contou na conversa. O treinador usa isso nas respostas. Apague o que não valer mais.')}</p>
    ${c.notes.length ? `<div class="card flat"><div class="list">${c.notes.slice().reverse().map(n => `<div class="item mem-item">
      <span class="grow"><span class="t">${esc(n.text)}</span><br><span class="d">${n.at.split('-').reverse().join('/')}</span></span>
      <button class="icon-btn" data-act="coachForget" data-id="${esc(n.id)}" aria-label="${t('Esquecer')}">${icon.x}</button></div>`).join('')}</div></div>`
      : `<p class="muted">${t('Ainda nada. Conte ao treinador sobre dores, equipamento, horários ou objetivos e ele vai lembrar.')}</p>`}
    ${c.summary ? `<details class="own-goal"><summary><b>${t('Resumo das conversas antigas')}</b></summary><p class="small">${esc(c.summary)}</p></details>` : ''}
    <button class="btn block" data-act="coachBack">${t('Voltar à conversa')}</button>
    <button class="btn ghost danger block" data-act="coachWipeAsk">${icon.trash}${t('Apagar conversa e memória')}</button>
  </div>`);
  $('#sheet .sheet-card')?.classList.add('coach-card', `prov-${aiProvider()}`);
}
actions.coachMem = () => { view = 'mem'; render(); };
actions.coachBack = () => { view = 'chat'; render(); };
actions.coachForget = el => { coach().notes = coach().notes.filter(n => n.id !== el.dataset.id); save(); render(); };
actions.coachWipeAsk = () => {
  sheet(`<h2>${t('Apagar conversa e memória?')}</h2>
    <p class="muted">${t('O treinador esquece tudo o que você contou e a conversa some, em todos os aparelhos. Não dá para desfazer.')}</p>
    <button class="btn danger block" data-act="coachWipe">${t('Apagar tudo')}</button>
    <button class="btn block" data-act="coachMem">${t('Cancelar')}</button>`);
};
actions.coachWipe = () => {
  state.coach = { chat: [], notes: [], summary: '', folded: 0, checkinAt: Date.now() };
  save(); view = 'chat'; render();
  toast(t('Conversa e memória apagadas.'), 2500);
};

actions.coachOpen = () => { view = 'chat'; render(); checkin(); };
actions.coachAsk = el => send(el.dataset.q);
// reenvia a última pergunta que deu erro
actions.coachRetry = () => {
  const list = chat();
  const i = list.map(m => m.role === 'user' && m.error).lastIndexOf(true);
  if (i < 0 || busy) return;
  const q = list[i].content;
  coach().chat = list.slice(0, i);
  send(q);
};
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
