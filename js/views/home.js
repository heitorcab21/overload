// Telas: primeiro acesso, Hoje e resumo do treino.
import { state, save, uid } from '../store.js';
import { googleBtn, $, esc, fmt, kg, setStr, compact, icon, actions, toast, sheet, closeSheet, meter, fmtDate, weekLetters, shareFile } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { TEMPLATES, LIB_BY_ID, OLD_STEP, exName, tg, routineName, templateKey, ensureExercise } from '../data.js';
import {
  planFor, weekStart, addDays, sessionsIn, groupGoalStatus, defaultGroupGoals, DAY,
  sessionPRs, tonnage, exGoalStatus, entriesFor, stalledExercises,
} from '../logic.js';
import { startWorkout, startFreeWorkout } from './workout.js';
import { aiEnabled, aiWeeklyAnalysis } from '../ai.js';
import { profile, bodyComposition, overallStrength, strengthLevel } from '../body.js';
import { driveAvailable, driveConnected, driveDirty, hasToken } from '../drive.js';
import { t, tn, lang, LANGS } from '../i18n.js';

/**
 * Atualiza o passo de aumento dos exercícios com halteres criados antes de a carga
 * passar a ser a total (dois halteres somados). Só mexe se a pessoa não mudou o passo.
 */
export function migrateLoadSteps() {
  let changed = false;
  for (const ex of Object.values(state.exercises)) {
    const l = ex.lib && LIB_BY_ID[ex.lib];
    if (l && OLD_STEP[ex.lib] === ex.step && l.step !== ex.step) { ex.step = l.step; changed = true; }
  }
  // fichas pré-moldadas criadas antes da tradução: passam a seguir o idioma
  for (const r of [...state.routines, ...state.sessions, ...(state.active ? [state.active] : [])]) {
    if (r.tpl !== undefined) continue;
    const key = templateKey(r.name);
    if (key) { r.name = key; r.tpl = true; changed = true; }
  }
  if (changed) save({ touch: false });
}

export { ensureExercise };

export const planStr = p => (p.first && !p.w ? t('definir carga') : `${kg(p.w)} × ${p.reps.join(' · ')}`);

// ---------- Primeiro acesso ----------

function renderOnboarding() {
  // escolha de idioma logo na primeira tela (o inicial segue o idioma do celular)
  const langs = `<div class="seg lang-seg" role="group" aria-label="Idioma · Language · Idioma">
      ${LANGS.map(([id, name]) => `<button type="button" data-act="quickLang" data-l="${id}" class="${lang() === id ? 'on' : ''}" aria-pressed="${lang() === id}">${name}</button>`).join('')}
    </div>`;
  const hero = `${langs}<div class="hero">
      <img class="logo" src="icons/icon.svg" alt="">
      <h1>Overload</h1>
      <p class="muted">${t('Registre cada série com um toque ou com a voz. O app calcula a próxima carga e acompanha suas metas da semana e do mês.')}</p>
    </div>`;

  // 1º passo: entrar com Google (se o Drive estiver configurado e a pessoa ainda não escolheu)
  if (driveAvailable() && !driveConnected() && !state.loginSkipped) {
    $('#view').innerHTML = `${hero}
      <div class="stack">
        <div class="card stack">
          <h2>${t('Entre com sua conta Google')}</h2>
          <p class="muted">${t('Seus treinos ficam salvos no seu Google Drive e aparecem em qualquer celular ou computador em que você entrar. Se você já usa o Overload, seus dados voltam na hora.')}</p>
          ${googleBtn(t('Entrar com Google'), 'big')}
          <p class="small muted">${t('O app só acessa os arquivos que ele mesmo cria, numa pasta "Overload" do seu Drive. Se aparecer "O Google não verificou este app", toque em <b>Continuar</b>.')}</p>
        </div>
        <button class="btn ghost block" data-act="skipLogin">${t('Usar sem conta')}</button>
        <p class="small muted" style="text-align:center">${t('Sem conta, os dados ficam só neste aparelho. Dá para entrar depois em Ajustes.')}</p>
        <p class="small muted" style="text-align:center"><a href="privacidade.html${lang() === 'en' ? '#en' : ''}">${t('Política de privacidade')}</a></p>
      </div>`;
    return;
  }

  // 2º passo: escolher os treinos
  $('#view').innerHTML = `${hero}
    <div class="stack">
      ${driveConnected() ? `<p class="small">${t('Conectado como <b>{email}</b>. Agora escolha seus treinos.', { email: esc(state.sync.email) })}</p>` : ''}
      <a class="tpl tpl-import" href="#/importar">
        <b>${icon.edit}${t('Já anoto meus treinos')}</b><span>${t('Cole o texto do bloco de notas ou do WhatsApp e o app salva todas as suas cargas.')}</span>
      </a>
      <div class="or-sep"><span>${t('ou')}</span></div>
      <h3 class="accent-title"><span class="num-tag">1</span>${t('Monte do zero')}</h3>
      <a class="tpl tpl-own" href="#/montar">
        <b>${icon.plus}${t('Monte seu próprio treino')}</b>
      </a>
      <h3 class="accent-title"><span class="num-tag">2</span>${t('Escolha um treino pronto')}</h3>
      ${TEMPLATES.map(tp => `
        <button class="tpl" data-act="pickTemplate" data-id="${tp.id}">
          <b>${esc(t(tp.name))}</b><span>${esc(t(tp.desc))}</span>
        </button>`).join('')}
      <p class="small muted">${t('Tudo pode ser editado depois em Treinos.')}${driveConnected() ? '' : ` ${t('Seus dados ficam salvos só neste aparelho.')}`}</p>
    </div>`;
}

actions.skipLogin = () => { state.loginSkipped = true; save({ touch: false }); rerender(); };
actions.drivePromptLater = () => { state.drivePromptDismissed = true; save({ touch: false }); rerender(); };

actions.pickTemplate = el => {
  const tp = TEMPLATES.find(x => x.id === el.dataset.id);
  if (tp) {
    for (const [name, ids] of tp.routines) {
      ids.forEach(ensureExercise);
      // nome guardado como chave do modelo: aparece no idioma escolhido até ser renomeado
      state.routines.push({ id: uid(), name, tpl: true, ex: ids.slice() });
    }
    defaultGroupGoals();
  }
  state.onboarded = true;
  save();
  go(tp ? '#/cargas' : '#/exercicios');
};

// ---------- Hoje ----------

function renderHome() {
  if (!state.onboarded) { go('#/inicio'); return; }
  const now = new Date();
  const ws = weekStart(now);
  const trained = new Set(sessionsIn(ws, addDays(ws, 7)).map(s => (new Date(s.date).getDay() + 6) % 7));
  const today = (now.getDay() + 6) % 7;

  const week = `<div class="card"><div class="week" aria-label="${t('Dias treinados nesta semana')}">
    ${weekLetters().map((d, i) => `<div class="${trained.has(i) ? 'done' : ''}${i === today ? ' today' : ''}">
      ${d}<i>${trained.has(i) ? icon.check : ''}</i></div>`).join('')}
  </div></div>`;

  let main;
  if (state.active) {
    const a = state.active;
    const done = a.entries.filter(e => e.sets.length || e.skipped).length;
    main = `<div class="card stack">
      <h3>${t('Treino em andamento')}</h3>
      <h2>${esc(routineName(a))}</h2>
      <p class="muted">${t('{done} de {total} exercícios registrados', { done, total: a.entries.length })}</p>
      <button class="btn primary big" data-act="resume">${icon.play}${t('Continuar treino')}</button>
    </div>`;
  } else if (!state.routines.length) {
    main = `<div class="card stack">
      <h2>${t('Monte seu primeiro treino')}</h2>
      <p class="muted">${t('Crie um treino e escolha os exercícios para começar a registrar.')}</p>
      <a class="btn primary block" href="#/exercicios">${t('Criar treino')}</a>
      <button class="btn ghost block" data-act="freeWorkout">${icon.plus}${t('Treino livre')}</button>
    </div>`;
  } else {
    const r = state.routines[state.next % state.routines.length];
    const exs = r.ex.map(id => state.exercises[id]).filter(Boolean);
    main = `<div class="card stack">
      <div class="row between"><h3>${t('Próximo treino')}</h3>
        ${state.routines.length > 1 ? `<button class="btn sm ghost" data-act="chooseRoutine">${t('Trocar')}</button>` : ''}</div>
      <h2>${esc(routineName(r))}</h2>
      <div>${exs.map(ex => {
        const p = planFor(ex);
        return `<div class="plan-line"><span class="n">${esc(exName(ex))}</span>
          ${p.kind === 'up' ? `<span class="badge up">${icon.up}${t('subir')}</span>` : ''}
          <span class="v num">${planStr(p)}</span></div>`;
      }).join('') || `<p class="muted">${t('Este treino ainda não tem exercícios.')}</p>`}</div>
      <button class="btn primary big" data-act="start" data-id="${r.id}" ${exs.length ? '' : 'disabled'}>${icon.play}${t('Começar treino')}</button>
      <button class="btn ghost block" data-act="freeWorkout">${icon.plus}${t('Treino livre')}</button>
    </div>`;
  }

  // Lembrete de backup: os dados só existem neste aparelho
  const lb = state.lastBackup ? new Date(state.lastBackup) : null;
  const daysSince = lb ? Math.floor((now - lb) / DAY) : null;
  const driveRecent = state.sync?.lastSync && now - new Date(state.sync.lastSync) < 7 * DAY;
  const drive = driveConnected() && driveDirty() && !hasToken() ? `<div class="card stack">
      <h3>Google Drive</h3>
      <p class="muted">${t('Há alterações ainda não salvas no seu Drive. Toque para confirmar a conta e enviar.')}</p>
      <button class="btn primary block" data-act="driveConnect">${t('Sincronizar')}</button>
    </div>` : '';
  // Para quem já usava o app antes do login existir: convite único para conectar o Drive
  const driveInvite = driveAvailable() && !driveConnected() && !state.drivePromptDismissed && !drive ? `<div class="card stack">
      <h3>${t('Novo: Google Drive')}</h3>
      <p class="muted">${t('Entre com sua conta Google para seus treinos ficarem salvos no seu Drive e aparecerem em qualquer aparelho.')}</p>
      ${googleBtn(t('Entrar com Google'), 'block')}
      <button class="btn ghost block" data-act="drivePromptLater">${t('Agora não')}</button>
    </div>` : '';
  const backup = !driveInvite && !driveRecent && state.sessions.length >= 3 && (!lb || daysSince >= 7) ? `<div class="card stack">
      <h3>Backup</h3>
      <p class="muted">${lb ? t('Seu último backup foi há {n} dias.', { n: daysSince }) : t('Você já tem {n} treinos e nenhum backup.', { n: state.sessions.length })}
        ${t('Os dados ficam só neste aparelho: trocar de celular ou limpar o navegador apaga tudo.')}</p>
      <button class="btn primary block" data-act="backupNow">${t('Salvar backup agora')}</button>
    </div>` : '';

  const la = state.lastAnalysis;
  const ai = `<div class="card stack">
    <div class="row between"><h3>${t('Treinador IA')}</h3>${la ? `<span class="small muted">${fmtDate(la.date)}</span>` : ''}</div>
    ${la ? `<p class="ai-text">${esc(la.text)}</p>` : ''}
    ${aiEnabled()
      ? `<button class="btn block" data-act="aiWeek" ${state.sessions.length ? '' : 'disabled'}>${icon.spark}${la ? t('Atualizar análise') : t('Analisar minha semana')}</button>
         ${state.sessions.length ? '' : `<p class="small muted">${t('Registre um treino para liberar a análise.')}</p>`}`
      : `<p class="muted">${t('Opcional: adicione em Ajustes uma chave de API da sua IA favorita (Claude, ChatGPT ou Gemini) para receber análises da semana e tirar dúvidas de execução. O app funciona normalmente sem ela.')}</p>
         <a class="btn block" href="#/ajustes">${t('Configurar IA')}</a>`}
  </div>`;

  $('#view').innerHTML = `
    <div class="head"><div class="brand grow"><b>Overload</b><span class="muted small">${fmtDate(now)}</span></div></div>
    <div class="stack">${week}${main}${stalledCard()}${ai}${drive}${driveInvite}${backup}</div>`;
}

// ---------- Exercício parado ----------

function stalledCard() {
  if (state.active) return '';
  const list = stalledExercises().filter(x => !(state.stallDismissed || {})[x.ex.id] || (state.stallDismissed[x.ex.id] < x.n)).slice(0, 3);
  if (!list.length) return '';
  return `<div class="card stack stall-card">
    <h3>${t('Exercícios parados')}</h3>
    ${list.map(({ ex, n }) => `<div class="row between"><span class="grow"><b>${esc(exName(ex))}</b><br><span class="small muted">${tn(n, 'há {n} treino sem superar seu melhor', 'há {n} treinos sem superar seu melhor')}</span></span>
      <button class="btn sm ghost" data-act="stallTips" data-id="${esc(ex.id)}">${t('O que fazer')}</button></div>`).join('')}
  </div>`;
}
actions.stallTips = el => {
  const ex = state.exercises[el.dataset.id];
  sheet(`<h2>${esc(exName(ex))}</h2>
    <p class="muted">${t('Normal acontecer. Escolha uma saída e mantenha por 2 a 3 semanas:')}</p>
    <ol class="steps">
      <li>${t('<b>Recue e suba de novo</b>: reduza cerca de 10% da carga e volte a progredir com boa execução.')}</li>
      <li>${t('<b>Mude a faixa de reps</b>: se treina 8–12, passe para 6–8 com mais carga (ou o contrário).')}</li>
      <li>${t('<b>Troque por uma variação</b>: halter no lugar da barra, inclinado no lugar do reto.')}</li>
      <li>${t('<b>Confira o básico</b>: sono, alimentação e descanso entre séries fazem diferença.')}</li>
    </ol>
    <button class="btn block" data-act="stallDismiss" data-id="${esc(ex.id)}">${t('Entendi, esconder aviso')}</button>`);
};
actions.stallDismiss = el => {
  const x = stalledExercises().find(s => s.ex.id === el.dataset.id);
  state.stallDismissed = { ...(state.stallDismissed || {}), [el.dataset.id]: x ? x.n + 2 : 99 };
  save({ touch: false }); closeSheet(); rerender();
};

actions.start = el => startWorkout(el.dataset.id);
actions.freeWorkout = () => startFreeWorkout();
actions.resume = () => go('#/treino');
actions.chooseRoutine = () => {
  sheet(`<h2>${t('Qual treino hoje?')}</h2>
    <div class="card flat"><div class="list">
      ${state.routines.map((r, i) => `<button class="item" data-act="setNext" data-i="${i}">
        <span class="grow"><span class="t">${esc(routineName(r))}</span><br><span class="d">${tn(r.ex.length, '{n} exercício', '{n} exercícios')}</span></span>
        ${i === state.next % state.routines.length ? `<span class="badge">${t('próximo')}</span>` : ''}
      </button>`).join('')}
    </div></div>`);
};
actions.setNext = el => { state.next = Number(el.dataset.i); save(); closeSheet(); rerender(); };

/** Resumo em texto dos últimos treinos e metas, enviado à IA (em português; a IA responde no idioma escolhido). */
function buildSummary() {
  const now = new Date();
  const from = addDays(now, -14);
  const L = [`Data de hoje: ${now.toLocaleDateString('pt-BR')}`, '', 'TREINOS DOS ÚLTIMOS 14 DIAS:'];
  const feel = { easy: 'fácil', ok: 'na medida', hard: 'pesado', fail: 'até a falha' };
  const flag = { dor: 'dor ou desconforto', troca: 'trocou o aparelho', execucao: 'execução ruim', tempo: 'sem tempo' };
  const d = x => new Date(x).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const w = s => (s.w > 0 ? `${s.w} kg × ${s.r}` : `${s.r} reps`);
  for (const s of sessionsIn(from, addDays(now, 1))) {
    L.push(`- ${d(s.date)} · ${s.name} (${s.dur || '?'} min)`);
    for (const e of s.entries) {
      const ex = state.exercises[e.exId];
      if (!ex) continue;
      if (e.skipped) { L.push(`    ${ex.name}: pulado`); continue; }
      const extra = [e.feel && feel[e.feel], ...(e.flags || []).map(f => flag[f])].filter(Boolean).join(', ');
      L.push(`    ${ex.name} [${ex.group}, faixa ${ex.repMin}-${ex.repMax} reps]: ${e.sets.map(x => w(x) + (x.t ? ' (falhou)' : '') + (x.rir != null ? ` (RIR ${x.rir})` : '')).join(' | ')}${extra ? ` — ${extra}` : ''}`);
    }
  }
  const p = profile();
  if (p) {
    const c = bodyComposition(p, overallStrength(p));
    L.push('', 'PERFIL:', `- ${p.sex === 'm' ? 'homem' : 'mulher'}, ${p.age} anos, ${p.height} cm, ${p.weight} kg, gordura estimada ${Math.round(c.bf)}%, massa magra ${Math.round(c.leanKg)} kg`);
    const lv = Object.values(state.exercises).map(ex => [ex, strengthLevel(ex, p)]).filter(([, l]) => l.top);
    if (lv.length) L.push('NÍVEL DE FORÇA (top % entre praticantes do mesmo sexo, idade e peso):', ...lv.map(([ex, l]) => `- ${ex.name}: top ${l.top}% (1RM estimado ${Math.round(l.oneRM)} kg)`));
  }
  L.push('', 'METAS DE SÉRIES POR GRUPAMENTO (feito / meta):');
  for (const g of groupGoalStatus(now)) {
    if (g.weekGoal || g.monthGoal) L.push(`- ${g.group}: semana ${g.weekDone}/${g.weekGoal}, mês ${g.monthDone}/${g.monthGoal}`);
  }
  L.push('', 'METAS DE CARGA POR EXERCÍCIO NO MÊS:');
  for (const ex of Object.values(state.exercises)) {
    const st = exGoalStatus(ex, now);
    if (!st || st.expired) continue;
    L.push(`- ${ex.name}: meta ${w(st.goal)}, melhor do mês ${st.monthBest ? w(st.monthBest) : 'sem registro'}, meta desta semana ${w(st.weekSet)} (${st.weekDone ? 'batida' : 'pendente'})`);
  }
  L.push('', 'PRÓXIMAS CARGAS SUGERIDAS PELO APP:');
  for (const ex of Object.values(state.exercises)) {
    if (!entriesFor(ex.id).length) continue;
    const p = planFor(ex);
    L.push(`- ${ex.name}: ${p.w > 0 ? `${p.w} kg` : 'peso corporal'} × ${p.reps.join(' · ')}`);
  }
  return L.join('\n');
}

actions.aiWeek = async el => {
  el.disabled = true;
  el.textContent = t('Analisando…');
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
    if (st && !st.expired && st.monthDone) hit.push(t('{ex}: meta do mês batida', { ex: exName(ex) }));
    else if (st && !st.expired && st.weekDone) hit.push(t('{ex}: meta da semana batida', { ex: exName(ex) }));
  }
  $('#view').innerHTML = `
    <div class="hero"><h1>${t('Treino concluído')}</h1><p class="muted">${esc(routineName(s))} · ${fmtDate(s.date)}</p>
      ${driveConnected() ? `<div><span class="badge${driveDirty() ? '' : ' good'}" id="syncNote">${driveDirty() ? t('Salvando no seu Google Drive…') : `${icon.check}${t('Salvo no seu Google Drive')}`}</span></div>` : ''}
    </div>
    <div class="stack">
      <div class="tiles">
        <div class="tile"><span class="l">${t('Séries')}</span><span class="v">${sets}</span></div>
        <div class="tile"><span class="l">${t('Duração')}</span><span class="v">${s.dur} min</span></div>
        <div class="tile"><span class="l">${t('Volume total')}</span><span class="v">${compact(ton)}</span></div>
        <div class="tile"><span class="l">${t('Recordes')}</span><span class="v">${prs.length}</span></div>
      </div>
      ${prs.length ? `<div class="card"><h3>${t('Novos recordes')}</h3>
        ${prs.map(p => `<div class="plan-line"><span class="n">${esc(exName(state.exercises[p.exId]))}</span>
          <span class="badge up">${icon.trophy}${setStr(p.set)}</span></div>`).join('')}</div>` : ''}
      ${hit.length ? `<div class="card"><h3>${t('Metas')}</h3>
        ${hit.map(h => `<div class="plan-line"><span class="n">${esc(h)}</span><span class="badge good">${icon.check}ok</span></div>`).join('')}</div>` : ''}
      <div class="card"><h3>${t('O que você fez')}</h3>
        ${s.entries.map(e => `<div class="plan-line"><span class="n">${esc(state.exercises[e.exId] ? exName(state.exercises[e.exId]) : t('Exercício removido'))}</span>
          <span class="v num">${e.skipped ? t('pulado') : e.sets.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span></div>`).join('')}
      </div>
      <button class="btn big story-btn" data-act="shareStory" data-id="${s.id}">${icon.share}${t('Compartilhar nos stories')}</button>
      <a class="btn primary big" href="#/hoje">${t('Concluir')}</a>
    </div>`;
}

// ---------- Card para stories ----------

let storyBlob = null, storyUrl = null;
actions.shareStory = async el => {
  const s = state.sessions.find(x => x.id === el.dataset.id);
  if (!s) return;
  el.disabled = true;
  try {
    const { storyCard } = await import('../storycard.js');
    storyBlob = await storyCard(s);
    if (storyUrl) URL.revokeObjectURL(storyUrl);
    storyUrl = URL.createObjectURL(storyBlob);
    sheet(`<h2>${t('Card para stories')}</h2>
      <img class="story-preview" src="${storyUrl}" alt="${t('Resumo do treino em imagem')}">
      <button class="btn primary big" data-act="storySend">${icon.share}${t('Compartilhar')}</button>
      <p class="small muted">${t('No celular, escolha Instagram, WhatsApp ou salve na galeria.')}</p>`);
  } catch (e) {
    toast(e.message, 4000);
  }
  el.disabled = false;
};
actions.storySend = async () => {
  if (!storyBlob) return;
  const r = await shareFile(`overload-${new Date().toISOString().slice(0, 10)}.png`, storyBlob, 'image/png');
  if (r === 'downloaded') toast(t('Imagem salva. Agora é só postar.'), 4000);
};

route('inicio', renderOnboarding, { noTabs: true });
route('hoje', renderHome);
route('resumo', renderSummary, { noTabs: true });
