// Treino ativo: registro de séries com um toque, cenários prontos e voz.
import { state, save, uid } from '../store.js';
import { $, esc, kg, setStr, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, fmtDate } from '../ui.js';
import { route, go, current } from '../router.js';
import { exName, exCues, tg, loadLabel, loadHint, routineName } from '../data.js';
import { planFor } from '../logic.js';
import { parseUtterance, voiceSupported, listen, stopListening, abortListening } from '../voice.js';
import { aiEnabled, aiParseVoice } from '../ai.js';
import { refreshIfNeeded, sync, driveConnected } from '../drive.js';
import { t, tn } from '../i18n.js';

const FEEL = () => ({ easy: t('Fácil'), ok: t('Na medida'), hard: t('Pesado'), fail: t('Até a falha') });
const FLAGS = () => ({ dor: t('Dor ou desconforto'), troca: t('Troquei o aparelho'), execucao: t('Execução ruim'), tempo: t('Sem tempo') });

let restTimer = null;
let restFired = true;
let wakeLock = null;

export function startWorkout(routineId) {
  const r = state.routines.find(x => x.id === routineId);
  if (!r) return;
  const entries = r.ex.map(id => state.exercises[id]).filter(Boolean).map(ex => {
    const plan = planFor(ex);
    return { exId: ex.id, plan, sets: [], cur: { w: plan.w, r: plan.reps[0] }, feel: null, flags: [], skipped: false };
  });
  if (!entries.length) { toast(t('Este treino não tem exercícios.')); return; }
  // Renova a autorização do Google agora, no toque de "Começar": ela cobre o treino inteiro
  refreshIfNeeded();
  state.active = { id: uid(), routineId: r.id, name: r.name, tpl: !!r.tpl, startedAt: Date.now(), idx: 0, restEnd: 0, entries };
  save();
  go('#/treino');
}

function cur() {
  const a = state.active;
  const en = a.entries[a.idx];
  return { a, en, ex: state.exercises[en.exId] };
}

const isDone = (en, ex) => en.skipped || en.sets.length >= ex.sets;

function logSet(en, w, r, tag) {
  en.sets.push(tag ? { w, r, t: tag } : { w, r });
  en.skipped = false;
  en.extra = false;
  const pr = en.plan.reps;
  // na primeira vez não há meta por série: a próxima parte do que acabou de ser feito
  en.cur = { w, r: en.plan.first ? r : (pr[en.sets.length] ?? pr.at(-1) ?? r) };
  state.active.restEnd = Date.now() + state.settings.rest * 1000;
  restFired = false;
}

function undo(en) {
  const s = en.sets.pop();
  if (!s) return false;
  en.cur = { w: s.w, r: s.r };
  state.active.restEnd = 0;
  return true;
}

// ---------- Tela ----------

function render() {
  const a = state.active;
  if (!a) { go('#/hoje'); return; }
  const { en, ex } = cur();
  if (!ex) { a.entries.splice(a.idx, 1); a.idx = Math.max(0, a.idx - 1); save(); if (!a.entries.length) { state.active = null; save(); } render(); return; }
  const cues = exCues(ex);
  const logging = !en.skipped && (en.sets.length < ex.sets || en.extra);
  const total = Math.max(ex.sets, en.sets.length + (en.extra ? 1 : 0));
  const p = en.plan;

  const rows = Array.from({ length: total }, (_, i) => {
    if (i < en.sets.length) {
      const s = en.sets[i];
      return `<button class="set done" data-act="wEditSet" data-i="${i}" aria-label="${t('Corrigir série {n}', { n: i + 1 })}: ${setStr(s)}">
        <span class="i">${icon.check}</span><span class="v">${setStr(s)}</span>
        ${s.t ? `<span class="badge warn">${t('falhou')}</span>` : ''}<span class="edit-ic">${icon.edit}</span></button>`;
    }
    if (i === en.sets.length && logging) {
      return `<div class="set cur"><span class="i">${i + 1}</span><span class="v" id="curLabel">${setStr(en.cur)}</span><span class="badge">${t('agora')}</span></div>`;
    }
    return `<div class="set todo"><span class="i">${i + 1}</span><span class="v">${setStr({ w: en.cur.w, r: p.reps[i] ?? p.reps.at(-1) })}</span></div>`;
  }).join('');

  const target = `<div class="target">
    <h3>${t('Meta de hoje')}</h3>
    <div class="big num">${p.first && !p.w ? `${ex.sets} × ${ex.repMin}–${ex.repMax} reps` : `${kg(p.w)} × ${p.reps.join(' · ')}`}</div>
    ${p.last ? `<div class="small muted num">${t('Último')} (${fmtDate(p.last.date)}): ${kg(p.last.w)} × ${p.last.reps.join(' · ')}</div>` : ''}
    <div class="note">${esc(p.note)}</div>
  </div>`;

  let body;
  if (en.skipped) {
    body = `<div class="card stack"><p class="muted">${t('Exercício pulado neste treino.')}</p>
      <button class="btn block" data-act="wUnskip">${t('Fazer mesmo assim')}</button></div>`;
  } else if (logging) {
    body = `<div class="log">
      ${p.first && !p.w && !ex.bw && !en.sets.length ? `<h3>${t('Carga total de hoje (kg)')}</h3>
      <div class="chips">${[5, 10, 15, 20, 30, 40, 50, 60, 80, 100].map(v =>
        `<button class="chip${en.cur.w === v ? ' on' : ''}" data-act="wSetW" data-w="${v}" aria-pressed="${en.cur.w === v}">${v}</button>`).join('')}</div>` : ''}
      <div class="two">
        ${stepper('w', en.cur.w, ex.step || 1, loadLabel(ex), 0, 'wCur')}
        ${stepper('r', en.cur.r, 1, t('Repetições'), 0, 'wCur')}
      </div>
      <p class="small muted load-hint">${esc(loadHint(ex))}</p>
      <button class="btn primary big" data-act="wDone">${icon.check}<span id="doneLabel">${t('Feito')} · ${setStr(en.cur)}</span></button>
      <h3>${t('Foi diferente?')}</h3>
      <div class="chips">
        <button class="chip" data-act="wDelta" data-d="1">+1 rep</button>
        <button class="chip" data-act="wDelta" data-d="2">+2 reps</button>
        <button class="chip" data-act="wDelta" data-d="-1">−1 rep</button>
        <button class="chip" data-act="wDelta" data-d="-2">−2 reps</button>
        <button class="chip" data-act="wFail">${t('Falhei nesta')}</button>
      </div>
      <div class="row wrap">
        ${en.sets.length < ex.sets ? `<button class="btn grow" data-act="wAll">${t('Todas como a meta')}</button>` : ''}
        ${en.sets.length ? `<button class="btn" data-act="wUndo">${icon.undo}${t('Desfazer')}</button>` : `<button class="btn" data-act="wSkip">${t('Pular exercício')}</button>`}
      </div>
    </div>`;
  } else {
    body = `<div class="log">
      <h3>${t('Como foi?')}</h3>
      <div class="chips">${Object.entries(FEEL()).map(([k, v]) =>
        `<button class="chip${en.feel === k ? ' on' : ''}" data-act="wFeel" data-v="${k}" aria-pressed="${en.feel === k}">${v}</button>`).join('')}</div>
      <h3>${t('Aconteceu algo?')}</h3>
      <div class="chips">${Object.entries(FLAGS()).map(([k, v]) =>
        `<button class="chip${en.flags.includes(k) ? ' on' : ''}" data-act="wFlag" data-v="${k}" aria-pressed="${en.flags.includes(k)}">${v}</button>`).join('')}</div>
      <div class="row wrap">
        <button class="btn grow" data-act="wExtra">${icon.plus}${t('Série extra')}</button>
        <button class="btn" data-act="wUndo">${icon.undo}${t('Desfazer')}</button>
      </div>
    </div>`;
  }

  const last = a.idx === a.entries.length - 1;
  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="wHome" aria-label="${t('Voltar ao início')}">${icon.back}</button>
      <span class="title">${esc(routineName(a))} · ${t('{i} de {n}', { i: a.idx + 1, n: a.entries.length })}</span>
      <button class="icon-btn" data-act="wList" aria-label="${t('Lista de exercícios')}">${icon.list}</button>
    </div>
    <div class="dots" aria-hidden="true">${a.entries.map((e, i) => {
      const x = state.exercises[e.exId];
      return `<i class="${i === a.idx ? 'cur' : x && isDone(e, x) ? 'done' : ''}"></i>`;
    }).join('')}</div>
    <div class="ex-name">
      <h1>${esc(exName(ex))}</h1>
      ${cues ? `<button class="icon-btn" data-act="wHow" aria-label="${t('Como executar')}">${icon.info}</button>` : ''}
    </div>
    <p class="muted">${esc(tg(ex.group))} · ${ex.sets} × ${ex.repMin}–${ex.repMax} reps</p>
    ${target}
    <div class="sets">${rows}</div>
    ${body}
    <div class="w-bar">
      <div class="rest" id="rest" hidden>
        <span class="grow">${t('Descanso')} <b class="num" id="restNum"></b></span>
        <button data-act="restAdd" data-s="-15">−15s</button><button data-act="restAdd" data-s="15">+15s</button>
        <button data-act="restSkip">${t('Pular')}</button>
      </div>
      <div class="w-nav">
        <button class="btn" data-act="wPrev" ${a.idx === 0 ? 'disabled' : ''}>${icon.back}${t('Anterior')}</button>
        <button class="mic" data-act="mic" aria-label="${t('Registrar por voz')}">${icon.mic}</button>
        <button class="btn${isDone(en, ex) ? ' primary' : ''}" data-act="${last ? 'wFinish' : 'wNext'}">${last ? t('Finalizar') : t('Próximo')}${last ? '' : icon.next}</button>
      </div>
    </div>`;
  tickRest();
  clearInterval(restTimer);
  restTimer = setInterval(tickRest, 250);
  keepAwake();
}

function tickRest() {
  const box = $('#rest');
  if (!state.active || current().name !== 'treino' || !box) { clearInterval(restTimer); return; }
  const left = Math.ceil((state.active.restEnd - Date.now()) / 1000);
  if (left > 0) {
    box.hidden = false;
    $('#restNum').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  } else {
    box.hidden = true;
    if (!restFired && state.active.restEnd) { restFired = true; restAlert(); }
  }
}

function restAlert() {
  try { navigator.vibrate?.([180, 90, 180]); } catch { /* sem vibração */ }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close();
  } catch { /* sem áudio */ }
}

async function keepAwake() {
  try {
    if (!wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* não suportado */ }
}
function releaseAwake() { try { wakeLock?.release(); } catch { /* ok */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.active && current().name === 'treino') keepAwake();
});

const done = () => { save(); render(); };

// ---------- Ações de toque ----------

changes.wCur = el => {
  const { en } = cur();
  const v = Math.max(0, Number(el.value) || 0);
  if (el.name === 'w') en.cur.w = v; else en.cur.r = Math.round(v);
  save();
  const label = setStr(en.cur);
  if ($('#curLabel')) $('#curLabel').textContent = label;
  if ($('#doneLabel')) $('#doneLabel').textContent = `${t('Feito')} · ${label}`;
};

actions.wDone = () => { const { en } = cur(); logSet(en, en.cur.w, en.cur.r); done(); };
actions.wDelta = el => {
  const { en } = cur();
  logSet(en, en.cur.w, Math.max(0, en.cur.r + Number(el.dataset.d)));
  done();
};
actions.wFail = () => {
  const { en } = cur();
  sheet(`<h2>${t('Quantas reps saíram antes de falhar?')}</h2>
    <form class="stack" data-submit="wFailSave">
      ${stepper('r', Math.max(0, en.cur.r - 1), 1, t('Repetições completas'))}
      <button class="btn primary big">${t('Registrar')}</button>
    </form>`);
};
submits.wFailSave = form => {
  const { en } = cur();
  logSet(en, en.cur.w, Math.max(0, Math.round(Number(form.r.value) || 0)), 'F');
  closeSheet();
  done();
};
actions.wSetW = el => { cur().en.cur.w = Number(el.dataset.w); done(); };

// Corrigir ou excluir uma série já registrada neste treino
actions.wEditSet = el => {
  const { en, ex } = cur();
  const i = Number(el.dataset.i);
  const s = en.sets[i];
  if (!s) return;
  sheet(`<h2>${t('Corrigir série {n}', { n: i + 1 })}</h2>
    <form class="stack" data-submit="wEditSave" data-i="${i}">
      <div class="two">
        ${stepper('w', s.w, ex.step || 1, loadLabel(ex))}
        ${stepper('r', s.r, 1, t('Repetições'))}
      </div>
      <label class="check"><input type="checkbox" name="fail"${s.t ? ' checked' : ''}>${t('Falhei nesta série')}</label>
      <button class="btn primary big">${t('Salvar')}</button>
      <button type="button" class="btn ghost danger block" data-act="wDelSet" data-i="${i}">${t('Excluir série')}</button>
    </form>`);
};
submits.wEditSave = form => {
  const { en } = cur();
  const w = Math.max(0, Number(form.w.value) || 0);
  const r = Math.max(0, Math.round(Number(form.r.value) || 0));
  en.sets[Number(form.dataset.i)] = form.fail.checked ? { w, r, t: 'F' } : { w, r };
  closeSheet();
  done();
};
actions.wDelSet = el => {
  const { en } = cur();
  en.sets.splice(Number(el.dataset.i), 1);
  const pr = en.plan.reps;
  if (!en.plan.first) en.cur.r = pr[en.sets.length] ?? pr.at(-1) ?? en.cur.r;
  closeSheet();
  done();
};

actions.wAll = () => {
  const { en, ex } = cur();
  while (en.sets.length < ex.sets) logSet(en, en.cur.w, en.cur.r);
  state.active.restEnd = 0;
  done();
};
actions.wUndo = () => { const { en } = cur(); if (undo(en)) done(); };
actions.wSkip = () => { const { en } = cur(); en.skipped = true; save(); nextExercise(); };
actions.wUnskip = () => { cur().en.skipped = false; done(); };
actions.wExtra = () => { cur().en.extra = true; done(); };
actions.wFeel = el => { const { en } = cur(); en.feel = en.feel === el.dataset.v ? null : el.dataset.v; done(); };
actions.wFlag = el => {
  const { en } = cur();
  const k = el.dataset.v;
  en.flags = en.flags.includes(k) ? en.flags.filter(f => f !== k) : [...en.flags, k];
  done();
};
actions.restAdd = el => { state.active.restEnd = Math.max(Date.now(), state.active.restEnd + Number(el.dataset.s) * 1000); save(); tickRest(); };
actions.restSkip = () => { state.active.restEnd = 0; save(); tickRest(); };

function nextExercise() {
  const a = state.active;
  if (a.idx < a.entries.length - 1) { a.idx++; save(); render(); window.scrollTo(0, 0); } else actions.wFinish();
}
actions.wNext = nextExercise;
actions.wPrev = () => { const a = state.active; if (a.idx > 0) { a.idx--; save(); render(); window.scrollTo(0, 0); } };
actions.wHome = () => go('#/hoje');
actions.wJump = el => { state.active.idx = Number(el.dataset.i); save(); closeSheet(); render(); window.scrollTo(0, 0); };

actions.wList = () => {
  const a = state.active;
  sheet(`<h2>${esc(routineName(a))}</h2>
    <div class="card flat"><div class="list">${a.entries.map((e, i) => {
      const ex = state.exercises[e.exId];
      const st = e.skipped ? t('pulado') : e.sets.length ? e.sets.map(s => (s.w > 0 ? `${s.w}×${s.r}` : s.r)).join(' · ') : t('pendente');
      return `<button class="item" data-act="wJump" data-i="${i}">
        <span class="grow"><span class="t">${esc(exName(ex))}</span><br><span class="d num">${st}</span></span>
        ${i === a.idx ? `<span class="badge">${t('agora')}</span>` : ex && isDone(e, ex) ? `<span class="badge good">${icon.check}${t('feito')}</span>` : ''}
      </button>`;
    }).join('')}</div></div>
    <button class="btn primary block" data-act="wFinish">${t('Finalizar treino')}</button>
    <button class="btn ghost danger block" data-act="wDiscardAsk">${t('Descartar treino')}</button>`);
};

actions.wHow = () => {
  const { ex } = cur();
  const c = exCues(ex);
  if (!c) return;
  sheet(`<h2>${esc(exName(ex))}</h2>
    <h3>${t('Execução')}</h3><ol class="steps">${c.how.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h3>${t('Erros comuns')}</h3><ul class="errs">${c.errs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    ${c.tip ? `<p class="tip">${esc(c.tip)}</p>` : ''}
    <a class="btn block" href="#/exercicio/${encodeURIComponent(ex.id)}" data-act="closeSheet">${t('Ver histórico e detalhes')}</a>`);
};

actions.wFinish = () => {
  const a = state.active;
  const pend = a.entries.filter(e => !e.sets.length && !e.skipped).length;
  const sets = a.entries.reduce((n, e) => n + e.sets.length, 0);
  if (!sets) {
    sheet(`<h2>${t('Nenhuma série registrada')}</h2><p class="muted">${t('Você pode continuar treinando ou descartar este treino.')}</p>
      <button class="btn primary block" data-act="closeSheet">${t('Continuar treinando')}</button>
      <button class="btn ghost danger block" data-act="wDiscard">${t('Descartar treino')}</button>`);
    return;
  }
  if (!pend) { finish(); return; }
  sheet(`<h2>${t('Finalizar treino?')}</h2>
    <p class="muted">${tn(pend, 'Ainda há {n} exercício sem registro.', 'Ainda há {n} exercícios sem registro.')} ${t('Eles ficam de fora deste treino.')}</p>
    <button class="btn primary block" data-act="wFinishNow">${t('Finalizar assim mesmo')}</button>
    <button class="btn block" data-act="closeSheet">${t('Continuar treinando')}</button>`);
};
actions.wFinishNow = () => { closeSheet(); finish(); };
actions.wDiscardAsk = () => {
  sheet(`<h2>${t('Descartar este treino?')}</h2><p class="muted">${t('As séries registradas agora serão apagadas. Esta ação não pode ser desfeita.')}</p>
    <button class="btn danger block" data-act="wDiscard">${t('Descartar treino')}</button>
    <button class="btn block" data-act="closeSheet">${t('Voltar')}</button>`);
};
actions.wDiscard = () => { state.active = null; save(); closeSheet(); releaseAwake(); go('#/hoje'); };

function finish() {
  // No toque de "Finalizar": se a autorização venceu durante o treino, renova sem perguntar nada
  const ready = refreshIfNeeded();
  const a = state.active;
  const entries = a.entries.filter(e => e.sets.length || e.skipped)
    .map(({ exId, sets, feel, flags, skipped }) => ({ exId, sets, feel, flags, skipped: skipped && !sets.length }));
  state.sessions.push({
    id: a.id, date: new Date(a.startedAt).toISOString(), routineId: a.routineId, name: a.name, tpl: !!a.tpl,
    dur: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)), entries,
  });
  const i = state.routines.findIndex(r => r.id === a.routineId);
  if (i >= 0 && state.routines.length) state.next = (i + 1) % state.routines.length;
  state.active = null;
  save();
  releaseAwake();
  clearInterval(restTimer);
  go(`#/resumo/${a.id}`);
  if (driveConnected()) {
    // Envia o treino ao Drive e mostra o resultado no resumo
    ready.then(ok => (ok ? sync() : false)).then(ok => ok, () => false).then(ok => {
      const note = $('#syncNote');
      if (!note) return;
      note.className = `badge ${ok ? 'good' : 'warn'}`;
      note.innerHTML = ok ? `${icon.check}${t('Salvo no seu Google Drive')}`
        : t('Não deu para salvar no Drive agora. Toque em Sincronizar na tela Hoje.');
    });
  }
}

// ---------- Voz ----------

const voiceSheet = (status, listening) => `
  <h2>${t('Fale o que você fez')}</h2>
  ${listening ? `<div class="pulse">${icon.mic}</div>` : ''}
  <p class="voice-live" id="voiceLive">${esc(status)}</p>
  ${listening ? `<button class="btn block" data-act="micStop">${t('Pronto')}</button>` : voiceSupported() ? `<button class="btn primary block" data-act="mic">${icon.mic}${t('Falar de novo')}</button>` : ''}
  <ul class="hints">
    <li>${t('<b>"40 quilos, 12 repetições"</b> registra uma série')}</li>
    <li>${t('<b>"bati a meta"</b> ou <b>"mais uma"</b> usa a meta como base')}</li>
    <li>${t('<b>"três séries de dez com cinquenta"</b> registra várias')}</li>
    <li>${t('<b>"estava pesado"</b>, <b>"desfazer"</b>, <b>"pular"</b>, <b>"próximo"</b>')}</li>
  </ul>
  <form class="row" data-submit="voiceText">
    <input type="text" name="t" placeholder="${t('ou digite: 40 12')}" autocomplete="off" aria-label="${t('Digitar em vez de falar')}">
    <button class="btn">OK</button>
  </form>`;

actions.mic = async () => {
  if (!voiceSupported()) {
    sheet(voiceSheet(t('Este navegador não tem reconhecimento de voz. Use o Chrome ou o Safari, ou digite abaixo.'), false));
    return;
  }
  sheet(voiceSheet(t('Ouvindo…'), true));
  try {
    const text = await listen(txt => { const el = $('#voiceLive'); if (el) el.textContent = txt; });
    closeSheet();
    await applyVoice(text);
  } catch (e) {
    if ($('#sheet').hidden) return; // fechado pelo usuário
    const msg = e.message === 'not-allowed' || e.message === 'service-not-allowed'
      ? t('Permita o uso do microfone para registrar por voz.')
      : e.message === 'no-speech' ? t('Não ouvi nada. Tente de novo.')
      : e.message === 'network' ? t('O reconhecimento de voz precisa de internet neste navegador.')
      : t('Não foi possível ouvir. Tente de novo ou digite.');
    sheet(voiceSheet(msg, false));
  }
};
actions.micStop = () => stopListening();
submits.voiceText = async form => {
  const text = form.t.value.trim();
  if (!text) return;
  abortListening();
  closeSheet();
  await applyVoice(text);
};

async function applyVoice(text) {
  let acts = parseUtterance(text);
  if (!acts.length && aiEnabled()) {
    const { en, ex } = cur();
    toast(t('Interpretando com a IA…'), 15000);
    try {
      acts = await aiParseVoice(text, {
        exercise: `${exName(ex)} (${ex.sets} × ${ex.repMin}-${ex.repMax} reps)`,
        planned: setStr(en.cur),
        done: en.sets.map(setStr).join(', '),
      });
    } catch (e) { toast(e.message, 5000); return; }
  }
  if (!acts.length || !state.active) {
    toast(t('Não entendi "{text}". Tente: "40 quilos, 12 repetições".', { text }), 5000);
    return;
  }
  const said = [];
  let move = null;
  for (const act of acts) {
    const { en, ex } = cur();
    if (act.type === 'set') {
      const w = act.w ?? en.cur.w, r = act.r ?? en.cur.r;
      logSet(en, w, r, act.fail ? 'F' : undefined);
      said.push(setStr({ w, r }) + (act.fail ? ` (${t('falhou')})` : ''));
    } else if (act.type === 'planned') {
      const n = act.all ? Math.max(1, ex.sets - en.sets.length) : 1;
      for (let i = 0; i < n; i++) { said.push(setStr(en.cur)); logSet(en, en.cur.w, en.cur.r); }
    } else if (act.type === 'delta') {
      if (act.dw) { en.cur.w = Math.max(0, en.cur.w + act.dw); said.push(t('carga ajustada para {w}', { w: kg(en.cur.w) })); }
      else { const r = Math.max(0, en.cur.r + act.dr); said.push(setStr({ w: en.cur.w, r })); logSet(en, en.cur.w, r); }
    } else if (act.type === 'feel') {
      en.feel = act.v; said.push(FEEL()[act.v].toLowerCase());
    } else if (act.type === 'undo') {
      said.push(undo(en) ? t('última série desfeita') : t('nada para desfazer'));
    } else if (act.type === 'skip') {
      en.skipped = !en.sets.length; move = 'next'; said.push(t('exercício pulado'));
    } else if (act.type === 'next') {
      move = 'next';
    }
  }
  save();
  if (move === 'next') nextExercise(); else render();
  if (said.length) toast(said.join(' · '), 3500);
}

route('treino', render, { noTabs: true });
