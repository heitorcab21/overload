// Telas: primeiro acesso, Hoje e resumo do treino.
import { state, save, uid } from '../store.js';
import { $, esc, fmt, kg, setStr, compact, icon, actions, toast, sheet, closeSheet, meter, fmtDate } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { TEMPLATES, LIB_BY_ID } from '../data.js';
import {
  planFor, weekStart, addDays, sessionsIn, groupGoalStatus, defaultGroupGoals, DAY,
  sessionPRs, tonnage, exGoalStatus, entriesFor,
} from '../logic.js';
import { startWorkout } from './workout.js';
import { aiEnabled, aiWeeklyAnalysis } from '../ai.js';
import { driveAvailable, driveConnected, driveDirty, hasToken } from '../drive.js';

export function ensureExercise(libId) {
  if (state.exercises[libId]) return state.exercises[libId];
  const l = LIB_BY_ID[libId];
  if (!l) return null;
  state.exercises[libId] = {
    id: libId, lib: libId, name: l.name, group: l.group,
    sets: l.sets, repMin: l.repMin, repMax: l.repMax, step: l.step, bw: !!l.bw,
  };
  return state.exercises[libId];
}

export const planStr = p => (p.first && !p.w ? 'definir carga' : `${kg(p.w)} × ${p.reps.join(' · ')}`);

// ---------- Primeiro acesso ----------

function renderOnboarding() {
  const hero = `<div class="hero">
      <img class="logo" src="icons/icon.svg" alt="">
      <h1>Overload</h1>
      <p class="muted">Registre cada série com um toque ou com a voz. O app calcula a próxima carga e acompanha suas metas da semana e do mês.</p>
    </div>`;

  // 1º passo: entrar com Google (se o Drive estiver configurado e a pessoa ainda não escolheu)
  if (driveAvailable() && !driveConnected() && !state.loginSkipped) {
    $('#view').innerHTML = `${hero}
      <div class="stack">
        <div class="card stack">
          <h2>Entre com sua conta Google</h2>
          <p class="muted">Seus treinos ficam salvos no seu Google Drive e aparecem em qualquer celular ou computador em que você entrar. Se você já usa o Overload, seus dados voltam na hora.</p>
          <button class="btn primary big" data-act="driveConnect">Entrar com Google</button>
          <p class="small muted">O app só acessa os arquivos que ele mesmo cria, numa pasta "Overload" do seu Drive. Se aparecer "O Google não verificou este app", toque em <b>Continuar</b>.</p>
        </div>
        <button class="btn ghost block" data-act="skipLogin">Usar sem conta</button>
        <p class="small muted" style="text-align:center">Sem conta, os dados ficam só neste aparelho. Dá para entrar depois em Ajustes.</p>
      </div>`;
    return;
  }

  // 2º passo: escolher os treinos
  $('#view').innerHTML = `${hero}
    <div class="stack">
      ${driveConnected() ? `<p class="small">Conectado como <b>${esc(state.sync.email)}</b>. Agora escolha seus treinos.</p>` : ''}
      <h3>Escolha um ponto de partida</h3>
      ${TEMPLATES.map(t => `
        <button class="tpl" data-act="pickTemplate" data-id="${t.id}">
          <b>${esc(t.name)}</b><span>${esc(t.desc)}</span>
        </button>`).join('')}
      <button class="tpl" data-act="pickTemplate" data-id="">
        <b>Começar do zero</b><span>Monte seus treinos escolhendo os exercícios.</span>
      </button>
      <p class="small muted">Tudo pode ser editado depois em Treinos.${driveConnected() ? '' : ' Seus dados ficam salvos só neste aparelho.'}</p>
    </div>`;
}

actions.skipLogin = () => { state.loginSkipped = true; save({ touch: false }); rerender(); };
actions.drivePromptLater = () => { state.drivePromptDismissed = true; save({ touch: false }); rerender(); };

actions.pickTemplate = el => {
  const t = TEMPLATES.find(x => x.id === el.dataset.id);
  if (t) {
    for (const [name, ids] of t.routines) {
      ids.forEach(ensureExercise);
      state.routines.push({ id: uid(), name, ex: ids.slice() });
    }
    defaultGroupGoals();
  }
  state.onboarded = true;
  save();
  go(t ? '#/cargas' : '#/exercicios');
};

// ---------- Hoje ----------

function renderHome() {
  if (!state.onboarded) { go('#/inicio'); return; }
  const now = new Date();
  const ws = weekStart(now);
  const trained = new Set(sessionsIn(ws, addDays(ws, 7)).map(s => (new Date(s.date).getDay() + 6) % 7));
  const today = (now.getDay() + 6) % 7;
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

  const week = `<div class="card"><div class="week" aria-label="Dias treinados nesta semana">
    ${days.map((d, i) => `<div class="${trained.has(i) ? 'done' : ''}${i === today ? ' today' : ''}">
      ${d}<i>${trained.has(i) ? icon.check : ''}</i></div>`).join('')}
  </div></div>`;

  let main;
  if (state.active) {
    const a = state.active;
    const done = a.entries.filter(e => e.sets.length || e.skipped).length;
    main = `<div class="card stack">
      <h3>Treino em andamento</h3>
      <h2>${esc(a.name)}</h2>
      <p class="muted">${done} de ${a.entries.length} exercícios registrados</p>
      <button class="btn primary big" data-act="resume">${icon.play}Continuar treino</button>
    </div>`;
  } else if (!state.routines.length) {
    main = `<div class="card stack">
      <h2>Monte seu primeiro treino</h2>
      <p class="muted">Crie um treino e escolha os exercícios para começar a registrar.</p>
      <a class="btn primary block" href="#/exercicios">Criar treino</a>
    </div>`;
  } else {
    const r = state.routines[state.next % state.routines.length];
    const exs = r.ex.map(id => state.exercises[id]).filter(Boolean);
    main = `<div class="card stack">
      <div class="row between"><h3>Próximo treino</h3>
        ${state.routines.length > 1 ? `<button class="btn sm ghost" data-act="chooseRoutine">Trocar</button>` : ''}</div>
      <h2>${esc(r.name)}</h2>
      <div>${exs.map(ex => {
        const p = planFor(ex);
        return `<div class="plan-line"><span class="n">${esc(ex.name)}</span>
          ${p.kind === 'up' ? `<span class="badge up">${icon.up}subir</span>` : ''}
          <span class="v num">${planStr(p)}</span></div>`;
      }).join('') || '<p class="muted">Este treino ainda não tem exercícios.</p>'}</div>
      <button class="btn primary big" data-act="start" data-id="${r.id}" ${exs.length ? '' : 'disabled'}>${icon.play}Começar treino</button>
    </div>`;
  }

  const gs = groupGoalStatus(now).filter(g => g.weekGoal > 0).sort((a, b) => a.weekDone / a.weekGoal - b.weekDone / b.weekGoal);
  const goals = gs.length ? `<div class="card">
      <div class="row between" style="margin-bottom:6px"><h3>Metas da semana</h3><a class="btn sm ghost" href="#/metas">Ver todas</a></div>
      ${gs.map(g => `<div class="goal-row">
        <div class="top"><b>${esc(g.group)}</b><span class="num">${g.weekDone} / ${g.weekGoal} séries</span></div>
        ${meter(g.weekDone / g.weekGoal, g.weekDone >= g.weekGoal)}
      </div>`).join('')}
    </div>` : '';

  // Lembrete de backup: os dados só existem neste aparelho
  const lb = state.lastBackup ? new Date(state.lastBackup) : null;
  const daysSince = lb ? Math.floor((now - lb) / DAY) : null;
  const driveRecent = state.sync?.lastSync && now - new Date(state.sync.lastSync) < 7 * DAY;
  const drive = driveConnected() && driveDirty() && !hasToken() ? `<div class="card stack">
      <h3>Google Drive</h3>
      <p class="muted">Há alterações ainda não salvas no seu Drive. Toque para confirmar a conta e enviar.</p>
      <button class="btn primary block" data-act="driveConnect">Sincronizar</button>
    </div>` : '';
  // Para quem já usava o app antes do login existir: convite único para conectar o Drive
  const driveInvite = driveAvailable() && !driveConnected() && !state.drivePromptDismissed && !drive ? `<div class="card stack">
      <h3>Novo: Google Drive</h3>
      <p class="muted">Entre com sua conta Google para seus treinos ficarem salvos no seu Drive e aparecerem em qualquer aparelho.</p>
      <button class="btn primary block" data-act="driveConnect">Entrar com Google</button>
      <button class="btn ghost block" data-act="drivePromptLater">Agora não</button>
    </div>` : '';
  const backup = !driveInvite && !driveRecent && state.sessions.length >= 3 && (!lb || daysSince >= 7) ? `<div class="card stack">
      <h3>Backup</h3>
      <p class="muted">${lb ? `Seu último backup foi há ${daysSince} dias.` : `Você já tem ${state.sessions.length} treinos e nenhum backup.`}
        Os dados ficam só neste aparelho: trocar de celular ou limpar o navegador apaga tudo.</p>
      <button class="btn primary block" data-act="backupNow">Salvar backup agora</button>
    </div>` : '';

  const la = state.lastAnalysis;
  const ai = `<div class="card stack">
    <div class="row between"><h3>Treinador IA</h3>${la ? `<span class="small muted">${fmtDate(la.date)}</span>` : ''}</div>
    ${la ? `<p class="ai-text">${esc(la.text)}</p>` : ''}
    ${aiEnabled()
      ? `<button class="btn block" data-act="aiWeek" ${state.sessions.length ? '' : 'disabled'}>${icon.spark}${la ? 'Atualizar análise' : 'Analisar minha semana'}</button>
         ${state.sessions.length ? '' : '<p class="small muted">Registre um treino para liberar a análise.</p>'}`
      : `<p class="muted">Opcional: adicione uma chave da API do Claude em Ajustes para receber análises da semana e tirar dúvidas de execução. O app funciona normalmente sem ela.</p>
         <a class="btn block" href="#/ajustes">Configurar IA</a>`}
  </div>`;

  $('#view').innerHTML = `
    <div class="head"><div class="brand grow"><b>Overload</b><span class="muted small">${fmtDate(now)}</span></div></div>
    <div class="stack">${week}${main}${drive}${driveInvite}${backup}${goals}${ai}</div>`;
}

actions.start = el => startWorkout(el.dataset.id);
actions.resume = () => go('#/treino');
actions.chooseRoutine = () => {
  sheet(`<h2>Qual treino hoje?</h2>
    <div class="card flat"><div class="list">
      ${state.routines.map((r, i) => `<button class="item" data-act="setNext" data-i="${i}">
        <span class="grow"><span class="t">${esc(r.name)}</span><br><span class="d">${r.ex.length} exercícios</span></span>
        ${i === state.next % state.routines.length ? '<span class="badge">próximo</span>' : ''}
      </button>`).join('')}
    </div></div>`);
};
actions.setNext = el => { state.next = Number(el.dataset.i); save(); closeSheet(); rerender(); };

/** Resumo em texto dos últimos treinos e metas, enviado à IA. */
function buildSummary() {
  const now = new Date();
  const from = addDays(now, -14);
  const L = [`Data de hoje: ${now.toLocaleDateString('pt-BR')}`, '', 'TREINOS DOS ÚLTIMOS 14 DIAS:'];
  const feel = { easy: 'fácil', ok: 'na medida', hard: 'pesado', fail: 'até a falha' };
  const flag = { dor: 'dor ou desconforto', troca: 'trocou o aparelho', execucao: 'execução ruim', tempo: 'sem tempo' };
  for (const s of sessionsIn(from, addDays(now, 1))) {
    L.push(`- ${fmtDate(s.date)} · ${s.name} (${s.dur || '?'} min)`);
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      if (!ex) continue;
      if (e.skipped) { L.push(`    ${ex.name}: pulado`); continue; }
      const extra = [e.feel && feel[e.feel], ...(e.flags || []).map(f => flag[f])].filter(Boolean).join(', ');
      L.push(`    ${ex.name} [${ex.group}, faixa ${ex.repMin}-${ex.repMax} reps]: ${e.sets.map(x => setStr(x) + (x.t ? ' (falhou)' : '')).join(' | ')}${extra ? ` — ${extra}` : ''}`);
    }
  }
  L.push('', 'METAS DE SÉRIES POR GRUPAMENTO (feito / meta):');
  for (const g of groupGoalStatus(now)) {
    if (g.weekGoal || g.monthGoal) L.push(`- ${g.group}: semana ${g.weekDone}/${g.weekGoal}, mês ${g.monthDone}/${g.monthGoal}`);
  }
  L.push('', 'METAS DE CARGA POR EXERCÍCIO NO MÊS:');
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex, now);
    if (!st || st.expired) continue;
    L.push(`- ${ex.name}: meta ${setStr(st.goal)}, melhor do mês ${st.monthBest ? setStr(st.monthBest) : 'sem registro'}, meta desta semana ${setStr(st.weekSet)} (${st.weekDone ? 'batida' : 'pendente'})`);
  }
  L.push('', 'PRÓXIMAS CARGAS SUGERIDAS PELO APP:');
  for (const ex of Object.values(state.exercises)) {
    if (entriesFor(ex.id).length) L.push(`- ${ex.name}: ${planStr(planFor(ex))}`);
  }
  return L.join('\n');
}

actions.aiWeek = async el => {
  el.disabled = true;
  el.textContent = 'Analisando…';
  try {
    const text = await aiWeeklyAnalysis(buildSummary());
    state.lastAnalysis = { date: new Date().toISOString(), text };
    save();
  } catch (e) {
    toast(e.message, 5000);
  }
  rerender();
};

// ---------- Resumo do treino ----------

function renderSummary(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) { go('#/hoje'); return; }
  const sets = s.entries.reduce((n, e) => n + e.sets.length, 0);
  const ton = s.entries.reduce((n, e) => n + tonnage(e.sets), 0);
  const prs = sessionPRs(s);
  const hit = [];
  for (const e of s.entries) {
    const ex = state.exercises[e.exId];
    const st = ex && exGoalStatus(ex);
    if (st && !st.expired && st.monthDone) hit.push(`${ex.name}: meta do mês batida`);
    else if (st && !st.expired && st.weekDone) hit.push(`${ex.name}: meta da semana batida`);
  }
  $('#view').innerHTML = `
    <div class="hero"><h1>Treino concluído</h1><p class="muted">${esc(s.name)} · ${fmtDate(s.date)}</p></div>
    <div class="stack">
      <div class="tiles">
        <div class="tile"><span class="l">Séries</span><span class="v">${sets}</span></div>
        <div class="tile"><span class="l">Duração</span><span class="v">${s.dur} min</span></div>
        <div class="tile"><span class="l">Volume total</span><span class="v">${compact(ton)}</span></div>
        <div class="tile"><span class="l">Recordes</span><span class="v">${prs.length}</span></div>
      </div>
      ${prs.length ? `<div class="card"><h3>Novos recordes</h3>
        ${prs.map(p => `<div class="plan-line"><span class="n">${esc(state.exercises[p.exId]?.name || '')}</span>
          <span class="badge up">${icon.trophy}${setStr(p.set)}</span></div>`).join('')}</div>` : ''}
      ${hit.length ? `<div class="card"><h3>Metas</h3>
        ${hit.map(h => `<div class="plan-line"><span class="n">${esc(h)}</span><span class="badge good">${icon.check}ok</span></div>`).join('')}</div>` : ''}
      <div class="card"><h3>O que você fez</h3>
        ${s.entries.map(e => `<div class="plan-line"><span class="n">${esc(state.exercises[e.exId]?.name || 'Exercício removido')}</span>
          <span class="v num">${e.skipped ? 'pulado' : e.sets.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span></div>`).join('')}
      </div>
      <a class="btn primary big" href="#/hoje">Concluir</a>
    </div>`;
}

route('inicio', renderOnboarding, { noTabs: true });
route('hoje', renderHome);
route('resumo', renderSummary, { noTabs: true });
