// Treino ativo: registro de séries com um toque, cenários prontos e voz.
import { state, save, uid } from '../store.js';
import { $, esc, kg, setStr, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, fmtDate } from '../ui.js';
import { route, go, current, rerender } from '../router.js';
import { exPhotos, exName, exCues, tg, loadLabel, loadHint, routineName, GROUPS, LIB, ensureExercise, restOf, substitutes, supGroups } from '../data.js';
import { planFor, defaultGroupGoals, entriesFor } from '../logic.js';
import { strengthLevel } from '../body.js';
import { openCardioSheet, cardioLine } from './cardio.js';
import { parseUtterance, voiceSupported, listen, stopListening, abortListening } from '../voice.js';
import { aiEnabled, aiParseVoice } from '../ai.js';
import { refreshIfNeeded, sync, driveConnected } from '../drive.js';
import { t, tn, exPack } from '../i18n.js';
import { toW, fromW, toStep } from '../units.js';

const FEEL = () => ({ easy: t('Fácil'), ok: t('Na medida'), hard: t('Pesado'), fail: t('Até a falha') });
const FLAGS = () => ({ dor: t('Dor ou desconforto'), troca: t('Troquei o aparelho'), execucao: t('Execução ruim'), tempo: t('Sem tempo') });

let restTimer = null;
let restFired = true;
let wakeLock = null;

function newEntry(ex) {
  const plan = planFor(ex);
  return { exId: ex.id, plan, sets: [], warmup: [], cur: { w: plan.w, r: plan.reps[0] }, feel: null, flags: [], skipped: false };
}

export function startWorkout(routineId, onDate = null) {
  const r = state.routines.find(x => x.id === routineId);
  if (!r) return;
  const entries = r.ex.map(id => state.exercises[id]).filter(Boolean).map(newEntry);
  if (!entries.length) { toast(t('Este treino não tem exercícios.')); return; }
  supGroups(r).forEach((ids, g) => ids.forEach((id, k) => {
    const e = entries.find(x => x.exId === id);
    if (e) Object.assign(e, { sg: g + 1, sgi: k, sgn: ids.length });
  }));
  // Renova a autorização do Google agora, no toque de "Começar": ela cobre o treino inteiro
  refreshIfNeeded();
  state.active = { id: uid(), routineId: r.id, name: r.name, tpl: !!r.tpl, startedAt: Date.now(), idx: 0, restEnd: 0, entries, ...(onDate ? { onDate } : {}) };
  save({ touch: false });
  go('#/treino');
}

/** Treino livre: começa vazio e você adiciona os exercícios na hora. */
export function startFreeWorkout() {
  if (state.active) { go('#/treino'); return; }
  refreshIfNeeded();
  state.active = { id: uid(), routineId: null, name: 'Treino livre', tpl: true, startedAt: Date.now(), idx: 0, restEnd: 0, entries: [] };
  save({ touch: false });
  go('#/treino');
  openPicker('add');
}

function cur() {
  const a = state.active;
  const en = a.entries[a.idx];
  return { a, en, ex: state.exercises[en.exId] };
}

/** Séries previstas neste treino: as do exercício + as acrescentadas com "+ Série a mais". */
const goal = (en, ex) => ex.sets + (en.more || 0);
const isDone = (en, ex) => en.skipped || en.sets.length >= goal(en, ex);

let popSet = -1; // índice da série recém-registrada, para a animação

function logSet(en, w, r, tag) {
  en.sets.push(tag ? { w, r, t: tag } : { w, r });
  en.lastLog = 'set';
  popSet = en.sets.length - 1;
  en.skipped = false;
  en.extra = false;
  const pr = en.plan.reps;
  // na primeira vez não há meta por série: a próxima parte do que acabou de ser feito
  en.cur = { w, r: en.plan.first ? r : (pr[en.sets.length] ?? pr.at(-1) ?? r) };
  state.active.restEnd = Date.now() + restOf(state.exercises[en.exId]) * 1000;
  restFired = false;
}

/** Série de aquecimento: fica à parte (fora de progressão, metas, volume e recordes) e o descanso é a metade. */
function logWarm(en, w, r) {
  en.warmup ??= [];
  en.warmup.push({ w, r });
  en.lastLog = 'warm';
  state.active.restEnd = Date.now() + Math.round(restOf(state.exercises[en.exId]) / 2) * 1000;
  restFired = false;
}

/**
 * Registra uma série pela regra única do app (botão Feito e voz usam a mesma):
 * 1ª série com menos de 70% da carga sugerida conta como aquecimento. Devolve 'warm' ou 'set'.
 */
function record(en, ex, w, r, tag) {
  if (warmByLoad(en, ex, w)) { logWarm(en, w, r); return 'warm'; }
  logSet(en, w, r, tag);
  return 'set';
}

/** Desfaz o último registro deste exercício, seja série válida ou aquecimento. */
function undo(en) {
  if (en.lastLog === 'warm' && en.warmup?.length) {
    const s = en.warmup.pop();
    en.cur = { w: s.w, r: s.r };
    en.lastLog = en.sets.length ? 'set' : null;
    state.active.restEnd = 0;
    return true;
  }
  const s = en.sets.pop();
  if (!s) {
    if (en.warmup?.length) { const w = en.warmup.pop(); en.cur = { w: w.w, r: w.r }; state.active.restEnd = 0; return true; }
    return false;
  }
  en.cur = { w: s.w, r: s.r };
  en.lastLog = null;
  state.active.restEnd = 0;
  return true;
}

// ---------- Tela ----------

function render() {
  const a = state.active;
  if (!a) { go('#/hoje'); return; }
  if (!a.entries.length) { renderEmpty(); return; }
  a.idx = Math.min(a.idx, a.entries.length - 1);
  const { en, ex } = cur();
  if (!ex) { a.entries.splice(a.idx, 1); a.idx = Math.max(0, a.idx - 1); save({ touch: false }); render(); return; }
  en.warmup ??= [];
  const cues = exCues(ex);
  const logging = !en.skipped && (en.sets.length < goal(en, ex) || en.extra);
  const total = Math.max(goal(en, ex), en.sets.length + (en.extra ? 1 : 0));
  const p = en.plan;

  const warm = en.warmup.map((s, i) => `<button class="set warm" data-act="wDelWarm" data-i="${i}" aria-label="${t('Série de aquecimento')}: ${setStr(s)}">
      <span class="i">A</span><span class="v">${setStr(s)}</span><span class="badge">${t('aquecimento')}</span></button>`).join('');
  const rows = warm + Array.from({ length: total }, (_, i) => {
    if (i < en.sets.length) {
      const s = en.sets[i];
      return `<button class="set done${i === popSet ? ' pop' : ''}" data-act="wEditSet" data-i="${i}" aria-label="${t('Corrigir série {n}', { n: i + 1 })}: ${setStr(s)}">
        <span class="i">${icon.check}</span><span class="v">${setStr(s)}</span>
        ${s.t ? `<span class="badge warn">${t('falhou')}</span>` : s.rir != null ? `<span class="badge">RIR ${s.rir}${s.rir >= 4 ? '+' : ''}</span>` : ''}<span class="edit-ic">${icon.edit}</span></button>`;
    }
    const del = en.more > 0 && i === total - 1 && i >= ex.sets
      ? `<button class="set-del" data-act="wLess" aria-label="${t('Tirar a série acrescentada')}">${icon.x}</button>` : '';
    if (i === en.sets.length && logging) {
      return `<div class="set cur"><span class="i">${i + 1}</span><span class="v" id="curLabel">${setStr(en.cur)}</span><span class="badge">${t('agora')}</span>${del}</div>`;
    }
    return `<div class="set todo"><span class="i">${i + 1}</span><span class="v">${setStr({ w: en.cur.w, r: p.reps[i] ?? p.reps.at(-1) })}</span>${del}</div>`;
  }).join('');

  // sem carga ainda: só uma caixinha com séries × reps; com carga, o cartão completo
  // "+ Série": logo abaixo das séries; acrescenta uma série só neste treino, a qualquer momento
  const more = en.skipped ? '' : `<button class="set add-set" data-act="wMore">${icon.plus}${t('Série')}</button>`;

  // botões rápidos acima das séries: ficam sempre à vista, mesmo em telas com fonte grande
  const quick = logging ? `<div class="quick-acts">
        ${en.sets.length < goal(en, ex) ? `<button class="qa" data-act="wAll"><b>${t('Todas como a meta')}</b></button>` : ''}
        ${en.sets.length || en.warmup.length ? `<button class="qa" data-act="wUndo"><b>${icon.undo}${t('Desfazer')}</b></button>` : `<button class="qa" data-act="wSkip"><b>${t('Pular exercício')}</b></button>`}
        <button class="qa warm" data-act="wWarm"><b>${t('Foi aquecimento')}</b></button>
      </div>` : '';

  let body;
  if (en.skipped) {
    body = `<div class="card stack"><p class="muted">${t('Exercício pulado neste treino.')}</p>
      <button class="btn block" data-act="wUnskip">${t('Fazer mesmo assim')}</button></div>`;
  } else if (logging) {
    body = `<div class="log">
      <p class="small warm-hint" id="warmHint"${willBeWarmup(en, ex) ? '' : ' hidden'}>${t('Carga abaixo de 70% da meta: esta série vai contar como aquecimento. Suba a carga para registrar como série válida.')}</p>
      <p class="small muted load-hint">${esc(loadHint(ex))}</p>
      ${rirRow(en)}
    </div>`;
  } else {
    body = `<div class="log">
      ${rirRow(en)}
      <h3>${t('Aconteceu algo?')}</h3>
      <div class="chips">${Object.entries(FLAGS()).filter(([k]) => k === 'dor' || k === 'troca').map(([k, v]) =>
        `<button class="chip${en.flags.includes(k) ? ' on' : ''}" data-act="wFlag" data-v="${k}" aria-pressed="${en.flags.includes(k)}">${v}</button>`).join('')}</div>
      <button class="btn block" data-act="wUndo">${icon.undo}${t('Desfazer')}</button>
    </div>`;
  }

  const last = a.idx === a.entries.length - 1;
  popSet = -1; // anima só uma vez
  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="wHome" aria-label="${t('Voltar ao início')}">${icon.back}</button>
      <span class="title">${esc(routineName(a))} · ${t('{i} de {n}', { i: a.idx + 1, n: a.entries.length })}</span>
      <button class="icon-btn" data-act="wList" aria-label="${t('Lista de exercícios')}">${icon.list}</button>
    </div>
    ${a.onDate ? `<p class="small past-day">${icon.edit}${t('Registrando o treino de {d}', { d: fmtDate(a.onDate) })}</p>` : ''}
    <div class="dots" aria-hidden="true">${a.entries.map((e, i) => {
      const x = state.exercises[e.exId];
      return `<i class="${i === a.idx ? 'cur' : x && isDone(e, x) ? 'done' : ''}"></i>`;
    }).join('')}</div>
    <div class="ex-name">
      <h1>${esc(exName(ex))}</h1>
      ${cues ? `<button class="how-btn" data-act="wHow" aria-label="${t('Como executar')}">${icon.info}<span>${t('Tutorial')}</span></button>` : ''}
    </div>
    ${en.sg ? `<p class="sup-tag">${icon.link}<b>${en.sgn === 3 ? t('Tri-set') : t('Bi-set')}</b> ${esc(a.entries.filter(e => e.sg === en.sg).map(e => exName(state.exercises[e.exId])).join(' + '))}</p>` : ''}
    ${ex.note ? `<button class="ex-note" data-act="editNote" data-id="${esc(ex.id)}" aria-label="${t('Editar anotação')}">${icon.edit}<span>${esc(ex.note)}</span></button>` : ''}
    <p class="muted ex-info">${esc(tg(ex.group))} · ${ex.sets} × ${ex.repMin}–${ex.repMax} reps · ${en.sg && en.sgi < en.sgn - 1 ? t('sem descanso até o próximo do {x}', { x: en.sgn === 3 ? t('Tri-set') : t('Bi-set') }) : t('descanso {s} s', { s: restOf(ex) })}${(() => { const lv = strengthLevel(ex); return lv.top ? ` · <a class="top-link" href="#/exercicio/${encodeURIComponent(ex.id)}">${t('Top {n}% de força', { n: lv.top })}</a>` : ''; })()}${ex.note ? '' : ` · <button class="note-link" data-act="editNote" data-id="${esc(ex.id)}">${icon.edit}${t('Anotar')}</button>`}</p>
    ${en.plan?.goal && !isDone(en, ex) ? `<p class="small goal-line">${icon.target}${t('Meta da semana: {set}', { set: setStr(en.plan.goal) })}</p>` : ''}
    <div class="ex-actions">
      <button class="btn sm ghost" data-act="wSwap">${icon.sync}${t('Trocar exercício')}</button>
      <button class="btn sm ghost" data-act="wAdd">${icon.plus}${t('Adicionar exercício')}</button>
    </div>
    ${quick}
    <div class="sets">${rows}${more}</div>
    ${body}
    <div class="w-bar">
      <div class="rest" id="rest" hidden>
        <span class="grow">${t('Descanso')} <b class="num" id="restNum"></b></span>
        <button data-act="restAdd" data-s="-15">−15s</button><button data-act="restAdd" data-s="15">+15s</button>
        <button data-act="restSkip">${t('Pular')}</button>
        ${bellAsk() ? `<button class="rest-bell" data-act="restBell" aria-label="${t('Avisar o fim do descanso com o app fora da tela')}">${icon.bell}</button>` : ''}
      </div>
      ${logging && !en.skipped ? `<div class="two w-steps">
        ${stepper('w', toW(en.cur.w), toStep(ex.step || 1), loadLabel(ex), 0, 'wCur').replace('data-change="wCur"', 'data-change="wCur" data-live')}
        ${stepper('r', en.cur.r, 1, t('Repetições'), 0, 'wCur').replace('data-change="wCur"', 'data-change="wCur" data-live')}
      </div>` : ''}
      ${logging && !en.skipped ? `<button class="btn primary big w-done${willBeWarmup(en, ex) ? ' warm-mode' : ''}" data-act="wDone">${icon.check}<span id="doneLabel">${doneText(en, ex)}</span></button>` : ''}
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

let audioCtx = null;
const BEEPS = [[0, 660, 0.16], [0.5, 784, 0.16], [1.0, 1320, 0.55]]; // [início (s), frequência (Hz), duração (s)]

/**
 * No iPhone o som de páginas da web fica travado até um toque tocar algo de fato, e a chave do silencioso
 * corta esse som. Por isso: sessão de áudio "curta" (mistura com a música e toca mesmo no silencioso, iOS 16.4+),
 * destrava a cada toque e, se o áudio da página estiver parado na hora, toca os mesmos bipes num <audio>.
 */
function audioSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* sem suporte */ } }

/** Bipe curto pelo mesmo áudio destravado do descanso (contagem 3-2-1 do cardio). */
export function tone(freq = 880, dur = 0.12, vol = 0.2) {
  audioSession('transient');
  setTimeout(() => audioSession('auto'), 1200);
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx ??= new Ctx();
    if (audioCtx.state !== 'running') audioCtx.resume?.();
    if (audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime + 0.02;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(now); o.stop(now + dur + 0.02);
  } catch { /* sem som */ }
}

/** Fim do descanso: bipe, bipe, biiipe, como numa largada, mais vibração. */
export function restAlert() {
  try { navigator.vibrate?.([120, 230, 120, 230, 450]); } catch { /* sem vibração */ }
  audioSession('transient');
  setTimeout(() => audioSession('auto'), 2500);
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx ??= new Ctx();
    if (audioCtx.state !== 'running') audioCtx.resume?.();
    if (audioCtx.state !== 'running') { playBeepFile(); return; }
    const now = audioCtx.currentTime + 0.05;
    // sobe a cada bipe e o último é mais agudo e mais longo
    BEEPS.forEach(([at, f, dur]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(0.22, now + at + 0.015);
      g.gain.setValueAtTime(0.22, now + at + dur - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + at);
      o.stop(now + at + dur + 0.02);
    });
  } catch { playBeepFile(); }
}

// Os mesmos três bipes como arquivo de som (WAV gerado aqui), para quando o áudio da página estiver travado.
let beepEl = null;
function beepWav() {
  const rate = 22050, total = Math.ceil(1.6 * rate), data = new Int16Array(total);
  for (const [at, f, dur] of BEEPS) {
    const a = Math.floor(at * rate), n = Math.floor(dur * rate);
    for (let k = 0; k < n && a + k < total; k++) {
      const env = Math.min(1, k / 300, (n - k) / 800);
      data[a + k] = (Math.sin(2 * Math.PI * f * k / rate) >= 0 ? 1 : -1) * 0.22 * env * 32767;
    }
  }
  const buf = new ArrayBuffer(44 + total * 2), v = new DataView(buf);
  const str = (o, x) => [...x].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, total * 2, true);
  new Int16Array(buf, 44).set(data);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function playBeepFile() {
  try {
    beepEl ??= new Audio(beepWav());
    beepEl.muted = false;
    beepEl.currentTime = 0;
    beepEl.play()?.catch(() => {});
  } catch { /* sem áudio */ }
}

/** A cada toque: garante o áudio da página rodando (o iPhone exige um som tocado dentro do toque). */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx ??= new Ctx();
    if (audioCtx.state !== 'running') {
      audioCtx.resume?.();
      const src = audioCtx.createBufferSource();
      src.buffer = audioCtx.createBuffer(1, 1, 22050);
      src.connect(audioCtx.destination);
      src.start(0);
    }
    // destrava também o arquivo de bipes (toca mudo uma vez, dentro do toque)
    if (!beepEl) {
      beepEl = new Audio(beepWav());
      beepEl.muted = true;
      beepEl.play()?.then(() => { beepEl.pause(); beepEl.currentTime = 0; beepEl.muted = false; }).catch(() => { beepEl.muted = false; });
    }
  } catch { /* sem áudio */ }
}
for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, unlockAudio, { passive: true });

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

// ---------- Aviso do fim do descanso com o app fora da tela ----------
// Apps instalados pelo navegador não acessam a ilha dinâmica nem as notificações "ao vivo" do sistema.
// O possível: ao sair do app durante o descanso, uma notificação discreta com a hora em que ele acaba;
// quando acaba, ela vira um alerta com som e vibração. Funciona bem no Android; no iPhone o sistema
// pausa o app em segundo plano e o alerta pode não chegar.
const NOTE_TAG = 'overload-rest';
const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator;
const notifyOn = () => notifySupported() && Notification.permission === 'granted' && state.settings.restNotify !== false;
const bellAsk = () => notifySupported() && Notification.permission === 'default' && !state.settings.restNotifyAsked;
let noteTimer = 0;

async function restNote(title, opts) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { tag: NOTE_TAG, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/treino' }, ...opts });
  } catch { /* sem notificação */ }
}
async function clearRestNote() {
  clearTimeout(noteTimer);
  try { (await (await navigator.serviceWorker.ready).getNotifications({ tag: NOTE_TAG })).forEach(n => n.close()); } catch { /* ok */ }
}
function nextSetText() {
  if (!state.active?.entries?.length) return '';
  const { en, ex } = cur();
  return en && ex ? `${exName(ex)} · ${t('série {n}', { n: en.sets.length + 1 })}` : '';
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { clearRestNote(); return; }
  const a = state.active;
  if (!a || !notifyOn()) return;
  const left = a.restEnd - Date.now();
  if (left <= 1500) return;
  const end = new Date(a.restEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  restNote(t('Descansando até {h}', { h: end }), { body: t('Próxima: {x}', { x: nextSetText() }), silent: true, timestamp: a.restEnd });
  noteTimer = setTimeout(() => {
    if (document.visibilityState === 'visible' || !state.active) return;
    restNote(t('Descanso acabou!'), { body: t('Próxima: {x}', { x: nextSetText() }), renotify: true, silent: false, requireInteraction: true, vibrate: [120, 230, 120, 230, 450] });
  }, left);
});

/** Teste nos Ajustes: uma notificação agora e outra em 10 s, para conferir com o app fora da tela. */
export function testRestNotify() {
  const vib = [120, 230, 120, 230, 450];
  restNote(t('Teste do Overload'), { tag: 'overload-test', body: t('Notificações funcionando. Saia do app agora: em 10 segundos chega a segunda.'), vibrate: vib });
  setTimeout(() => restNote(t('Teste: 10 segundos'), { tag: 'overload-test', renotify: true, requireInteraction: true, vibrate: vib,
    body: document.visibilityState === 'hidden'
      ? t('Chegou com o app fora da tela: o aviso do fim do descanso vai funcionar.')
      : t('Chegou, mas o app estava aberto. Repita saindo do app para testar de verdade.') }), 10000);
}

/** Pede a permissão (precisa partir de um toque) e liga o aviso. */
export async function askRestNotify(quiet = false) {
  state.settings.restNotifyAsked = true;
  let p = 'denied';
  try { p = await Notification.requestPermission(); } catch { /* navegador antigo */ }
  state.settings.restNotify = p === 'granted';
  save({ touch: false });
  if (quiet) return p;
  toast(p === 'granted'
    ? t('Pronto: no fim do descanso você recebe uma notificação, mesmo com o app fora da tela.')
    : t('Sem permissão para notificar. Dá para liberar depois nas configurações do navegador.'), 5000);
  return p;
}
actions.restBell = async () => { await askRestNotify(); render(); };

/** No primeiro acesso: pede a permissão de notificação uma única vez, junto do toque que conclui a configuração. */
export function askNotifyOnce() {
  if (!notifySupported() || Notification.permission !== 'default' || state.settings.restNotifyAsked) return;
  askRestNotify(true);
}

// O treino em andamento fica só neste aparelho até ser finalizado: mexer nele não conta
// como alteração a enviar ao Drive (senão o selo ficaria vermelho o treino inteiro).
const done = () => { save({ touch: false }); render(); };

/** Depois de uma série válida. Em bi-set/tri-set: vai para o próximo exercício do grupo sem descanso;
 *  no último do grupo, descansa e volta para o primeiro que ainda tem séries. */
function afterWorkSet(said = []) {
  const a = state.active;
  const { en } = cur();
  if (!en.sg) { done(); if (said.length) toast(said.join(' · '), 3500); return; }
  const group = a.entries.map((e, i) => ({ e, i })).filter(x => x.e.sg === en.sg);
  const pos = group.findIndex(x => x.i === a.idx);
  const pending = x => { const ex = state.exercises[x.e.exId]; return ex && !x.e.skipped && x.e.sets.length < goal(x.e, ex); };
  const ahead = group.slice(pos + 1).find(pending);
  let msg = '';
  if (ahead) {
    a.restEnd = 0;
    a.idx = ahead.i;
    msg = t('Agora: {x}, sem descanso', { x: exName(state.exercises[ahead.e.exId]) });
  } else {
    const back = group.find(pending);
    if (back && back.i !== a.idx) { a.idx = back.i; msg = t('Descanse e volte para {x}', { x: exName(state.exercises[back.e.exId]) }); }
  }
  save({ touch: false });
  render();
  if (msg) window.scrollTo(0, 0);
  const all = [...said, msg].filter(Boolean);
  if (all.length) toast(all.join(' · '), 3500);
}

// ---------- Ações de toque ----------

changes.wCur = el => {
  const { en, ex } = cur();
  const v = Math.max(0, Number(el.value) || 0);
  if (el.name === 'w') en.cur.w = fromW(v); else en.cur.r = Math.round(v);
  save({ touch: false });
  const label = setStr(en.cur);
  if ($('#curLabel')) $('#curLabel').textContent = label;
  paintDone(en, ex);
};

/** Com esta carga, a série conta como aquecimento? (1ª série com menos de 70% da carga sugerida) */
function warmByLoad(en, ex, w) {
  const ref = en.plan.first ? 0 : en.plan.w;
  return !en.sets.length && ref > 0 && w > 0 && w < ref * 0.7 && !ex.bw;
}
const willBeWarmup = (en, ex) => warmByLoad(en, ex, en.cur.w);
const doneText = (en, ex) => `${willBeWarmup(en, ex) ? t('Aquecimento') : t('Feito')} · ${setStr(en.cur)}`;
function paintDone(en, ex) {
  const b = $('[data-act="wDone"]');
  if (!b) return;
  b.classList.toggle('warm-mode', willBeWarmup(en, ex));
  $('#doneLabel').textContent = doneText(en, ex);
  const hint = $('#warmHint');
  if (hint) hint.hidden = !willBeWarmup(en, ex);
}

actions.wDone = () => {
  const { en, ex } = cur();
  // 1ª série com carga bem abaixo da sugerida (menos de 70%): conta como aquecimento sozinha;
  // se não era, um toque na série devolve.
  if (record(en, ex, en.cur.w, en.cur.r) === 'warm') {
    toast(t('Carga bem abaixo da meta: contei como aquecimento. Se não era, toque na série.'), 4500);
    done();
    return;
  }
  afterWorkSet();
};

// Corrigir ou excluir uma série já registrada neste treino
actions.wEditSet = el => {
  const { en, ex } = cur();
  const i = Number(el.dataset.i);
  const s = en.sets[i];
  if (!s) return;
  sheet(`<h2>${t('Corrigir série {n}', { n: i + 1 })}</h2>
    <form class="stack" data-submit="wEditSave" data-i="${i}">
      <div class="two">
        ${stepper('w', toW(s.w), toStep(ex.step || 1), loadLabel(ex))}
        ${stepper('r', s.r, 1, t('Repetições'))}
      </div>
      <label class="field">${t('Reps que sobraram (RIR)')}
        <select name="rir"><option value="">${t('não informado')}</option>${[0, 1, 2, 3, 4].map(v => `<option value="${v}"${s.rir === v ? ' selected' : ''}>${v === 4 ? '4+' : v}</option>`).join('')}</select></label>
      <button class="btn primary big">${t('Salvar')}</button>
      <button type="button" class="btn warm-soft block" data-act="wSetToWarm" data-i="${i}">${t('Era aquecimento')}</button>
      <button type="button" class="btn ghost danger block" data-act="wDelSet" data-i="${i}">${t('Excluir série')}</button>
    </form>`);
};
submits.wEditSave = form => {
  const { en } = cur();
  const w = fromW(Math.max(0, Number(form.w.value) || 0));
  const r = Math.max(0, Math.round(Number(form.r.value) || 0));
  const rir = form.rir.value === '' ? null : Number(form.rir.value);
  en.sets[Number(form.dataset.i)] = rir != null ? { w, r, rir } : { w, r };
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

actions.wSetToWarm = el => {
  const { en } = cur();
  const [s] = en.sets.splice(Number(el.dataset.i), 1);
  if (s) {
    en.warmup ??= [];
    en.warmup.push({ w: s.w, r: s.r });
    const pr = en.plan.reps;
    if (!en.plan.first) en.cur.r = pr[en.sets.length] ?? pr.at(-1) ?? en.cur.r;
    en.lastLog = null;
  }
  closeSheet();
  done();
};

actions.wAll = () => {
  const { en, ex } = cur();
  while (en.sets.length < goal(en, ex)) logSet(en, en.cur.w, en.cur.r);
  state.active.restEnd = 0;
  done();
};
actions.wUndo = () => { const { en } = cur(); if (undo(en)) done(); };
actions.wSkip = () => { const { en } = cur(); en.skipped = true; save({ touch: false }); nextExercise(); };
actions.wUnskip = () => { cur().en.skipped = false; done(); };
actions.wExtra = () => { cur().en.extra = true; done(); };
// "+ Série a mais": acrescenta uma série a este exercício só neste treino (a ficha não muda)
actions.wMore = () => { const { en } = cur(); en.more = (en.more || 0) + 1; done(); };
actions.wLess = () => { const { en, ex } = cur(); if (en.more > 0 && en.sets.length < goal(en, ex)) { en.more--; done(); } };
actions.wFeel = el => { const { en } = cur(); en.feel = en.feel === el.dataset.v ? null : el.dataset.v; done(); };
actions.wFlag = el => {
  const { en } = cur();
  const k = el.dataset.v;
  en.flags = en.flags.includes(k) ? en.flags.filter(f => f !== k) : [...en.flags, k];
  done();
};
actions.restAdd = el => { state.active.restEnd = Math.max(Date.now(), state.active.restEnd + Number(el.dataset.s) * 1000); save({ touch: false }); tickRest(); };
actions.restSkip = () => { state.active.restEnd = 0; save({ touch: false }); tickRest(); };

function nextExercise() {
  const a = state.active;
  if (a.idx < a.entries.length - 1) { a.idx++; save({ touch: false }); render(); window.scrollTo(0, 0); } else actions.wFinish();
}
actions.wNext = nextExercise;
actions.wPrev = () => { const a = state.active; if (a.idx > 0) { a.idx--; save({ touch: false }); render(); window.scrollTo(0, 0); } };
actions.wHome = () => go('#/hoje');
actions.wJump = el => { state.active.idx = Number(el.dataset.i); save({ touch: false }); closeSheet(); render(); window.scrollTo(0, 0); };

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
    ${(state.cardio || []).filter(c => c.sessionId === a.id).map(c => `<p class="small cardio-in">${icon.heart}${esc(cardioLine(c))}</p>`).join('')}
    <button class="btn block" data-act="wAdd">${icon.plus}${t('Adicionar exercício')}</button>
    <button class="btn block" data-act="wCardio">${icon.heart}${t('Adicionar cardio')}</button>
    <button class="btn primary block" data-act="wFinish">${t('Finalizar treino')}</button>
    <button class="btn ghost danger block" data-act="wDiscardAsk">${t('Descartar treino')}</button>`);
};

actions.wCardio = () => {
  const a = state.active;
  closeSheet();
  openCardioSheet({ sessionId: a.id, date: a.onDate || new Date().toISOString() });
};

actions.wHow = () => {
  const { ex } = cur();
  const c = exCues(ex);
  if (!c) return;
  sheet(`<h2>${esc(exName(ex))}</h2>
    ${exPhotos(ex)}
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
actions.wDiscard = () => { state.active = null; save({ touch: false }); closeSheet(); releaseAwake(); go('#/hoje'); };

function finish() {
  // No toque de "Finalizar": se a autorização venceu durante o treino, renova sem perguntar nada
  const ready = refreshIfNeeded();
  const a = state.active;
  // séries de aquecimento ficam guardadas à parte: não entram na progressão, nas metas, no volume nem nos recordes
  const entries = a.entries.filter(e => e.sets.length || e.skipped || e.warmup?.length)
    .map(({ exId, sets, warmup, feel, flags, skipped }) => ({ exId, sets, ...(warmup?.length ? { warmup } : {}), feel, flags, skipped: skipped && !sets.length }));
  // treino registrado depois (dia esquecido): fica salvo na data escolhida, sem duração
  state.sessions.push({
    id: a.id, date: a.onDate || new Date(a.startedAt).toISOString(), routineId: a.routineId, name: a.name, tpl: !!a.tpl,
    ...(a.onDate ? {} : { dur: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)) }), entries,
  });
  if (a.onDate) state.sessions.sort((x, y) => new Date(x.date) - new Date(y.date));
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

// ---------- RIR: quantas reps sobraram ----------

function rirRow(en) {
  const last = en.sets.at(-1);
  if (!last || last.t) return '';
  return `<h3>${t('Quantas reps sobraram na última série? (opcional)')}</h3>
    <div class="chips">${[0, 1, 2, 3, 4].map(v => `<button class="chip${last.rir === v ? ' on' : ''}" data-act="wRir" data-v="${v}" aria-pressed="${last.rir === v}">${v === 4 ? '4+' : v}</button>`).join('')}</div>`;
}
actions.wRir = el => {
  const { en } = cur();
  const last = en.sets.at(-1);
  if (!last) return;
  const v = Number(el.dataset.v);
  if (last.rir === v) delete last.rir; else last.rir = v;
  done();
};

// ---------- Aquecimento ----------

actions.wWarm = () => {
  const { en } = cur();
  logWarm(en, en.cur.w, en.cur.r);
  toast(t('Série de aquecimento registrada. Ela não conta na progressão nem nas metas.'), 3000);
  done();
};
actions.wDelWarm = el => {
  const i = Number(el.dataset.i);
  sheet(`<h2>${t('Série de aquecimento')}</h2>
    <p class="muted small">${t('Séries de aquecimento ficam guardadas, mas não contam na progressão, nas metas nem nos recordes.')}</p>
    <button class="btn primary block" data-act="wWarmToWork" data-i="${i}">${t('Era série válida')}</button>
    <button class="btn danger block" data-act="wDelWarmNow" data-i="${i}">${t('Excluir série')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
actions.wWarmToWork = el => {
  const { en } = cur();
  const [w] = en.warmup.splice(Number(el.dataset.i), 1);
  if (w) { en.sets.unshift(w); en.lastLog = null; en.cur = { ...en.cur, r: en.plan.reps[en.sets.length] ?? en.cur.r }; }
  closeSheet(); done();
};
actions.wDelWarmNow = el => { cur().en.warmup.splice(Number(el.dataset.i), 1); closeSheet(); done(); };

// ---------- Anotação do exercício ("banco na altura 4", "pegada fechada") ----------

actions.editNote = el => {
  const ex = state.exercises[el.dataset.id];
  if (!ex) return;
  sheet(`<h2>${t('Anotação')}</h2>
    <p class="muted small">${esc(exName(ex))}. ${t('Aparece sempre que você abrir este exercício: regulagem do aparelho, pegada, lado da academia...')}</p>
    <form class="stack" data-submit="saveNote" data-id="${esc(ex.id)}">
      <textarea name="note" maxlength="160" rows="3" placeholder="${t('Ex.: banco na altura 4, pegada fechada')}">${esc(ex.note || '')}</textarea>
      <button class="btn primary big">${t('Salvar')}</button>
      ${ex.note ? `<button type="button" class="btn ghost danger block" data-act="delNote" data-id="${esc(ex.id)}">${t('Apagar anotação')}</button>` : ''}
    </form>`);
  setTimeout(() => $('textarea[name="note"]')?.focus(), 50);
};
submits.saveNote = form => {
  const ex = state.exercises[form.dataset.id];
  const v = form.note.value.trim().slice(0, 160);
  if (v) ex.note = v; else delete ex.note;
  save(); closeSheet(); rerender();
};
actions.delNote = el => { delete state.exercises[el.dataset.id].note; save(); closeSheet(); rerender(); };

// ---------- Trocar ou adicionar exercício ----------

let pickMode = 'add';

function renderEmpty() {
  const a = state.active;
  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="wHome" aria-label="${t('Voltar ao início')}">${icon.back}</button>
      <span class="title">${esc(routineName(a))}</span>
      <button class="icon-btn" data-act="wList" aria-label="${t('Lista de exercícios')}">${icon.list}</button>
    </div>
    <div class="card stack">
      <h2>${t('Treino livre')}</h2>
      <p class="muted">${t('Adicione os exercícios conforme for treinando. A carga sugerida vem do seu histórico.')}</p>
      <button class="btn primary big" data-act="wAdd">${icon.plus}${t('Adicionar exercício')}</button>
      <button class="btn ghost danger block" data-act="wDiscard">${t('Descartar treino')}</button>
    </div>`;
}

function pickerItems(q = '') {
  const a = state.active;
  const used = new Set(a.entries.map(e => e.exId));
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nq = norm(q);
  const custom = Object.values(state.exercises).filter(e => !e.lib);
  const pool = [...LIB.map(l => ({ id: l.id, name: exPack(l.id)?.name ?? l.name, group: l.group })), ...custom.map(e => ({ id: e.id, name: e.name, group: e.group }))]
    .filter(e => !used.has(e.id) && (!nq || norm(e.name).includes(nq) || norm(tg(e.group)).includes(nq)));
  return GROUPS.map(g => {
    const items = pool.filter(e => e.group === g);
    if (!items.length) return '';
    return `<h3 class="group-title">${esc(tg(g))}</h3><div class="card flat"><div class="list">
      ${items.map(e => `<button class="item" data-act="wPick" data-id="${esc(e.id)}"><span class="grow t">${esc(e.name)}</span>${icon.plus}</button>`).join('')}
    </div></div>`;
  }).join('') || `<p class="empty">${t('Nada encontrado.')}</p>`;
}

function openPicker(mode) {
  pickMode = mode;
  const a = state.active;
  const r = a.routineId && state.routines.find(x => x.id === a.routineId);
  const curEx = a.entries.length ? state.exercises[a.entries[a.idx].exId] : null;
  const curEn = a.entries.length ? a.entries[a.idx] : null;
  const used = new Set(a.entries.map(e => e.exId));
  const subs = mode === 'swap' && curEx ? substitutes(curEx, curEn?.cur?.w || curEn?.plan?.w || 0, 3, used) : [];
  const subLine = s => {
    const ex = state.exercises[s.id];
    const own = ex && entriesFor(ex.id).length ? planFor(ex).w : null; // já fez esse exercício: vale a carga dele
    const w = own ?? s.w;
    return { w: own == null ? s.w : null, label: w ? `${own != null ? t('sua carga') : t('carga sugerida')}: ${kg(w)}` : t('ajuste a carga na primeira série') };
  };
  sheet(`<h2>${mode === 'swap' ? t('Trocar {x} por…', { x: esc(exName(curEx)) }) : t('Adicionar exercício')}</h2>
    ${subs.length ? `<h3>${t('Sugestões equivalentes')}</h3><div class="card flat subs"><div class="list">${subs.map(s => {
      const l = subLine(s);
      return `<button class="item" data-act="wPick" data-id="${esc(s.id)}"${l.w ? ` data-w="${l.w}"` : ''}>
        <span class="grow"><span class="t">${esc(exPack(s.id)?.name ?? LIB.find(x => x.id === s.id)?.name)}</span><br><span class="d">${esc(l.label)}</span></span>${icon.sync}</button>`;
    }).join('')}</div></div><h3>${t('Ou escolha outro')}</h3>` : ''}
    ${r ? `<label class="check"><input type="checkbox" id="pickSave">${mode === 'swap' ? t('Trocar também na ficha {x}', { x: esc(routineName(r)) }) : t('Adicionar também na ficha {x}', { x: esc(routineName(r)) })}</label>` : ''}
    <input type="search" placeholder="${t('Buscar exercício ou grupamento')}" data-change="wPickFilter" aria-label="${t('Buscar exercício')}" autocomplete="off">
    <div id="wPickList">${pickerItems()}</div>`);
}
changes.wPickFilter = el => { $('#wPickList').innerHTML = pickerItems(el.value); };

actions.wSwap = () => {
  const { en } = cur();
  if (en.sets.length) {
    toast(t('Este exercício já tem séries registradas. Use "Adicionar exercício" para fazer outro.'), 5000);
    return;
  }
  openPicker('swap');
};
actions.wAdd = () => openPicker('add');

actions.wPick = el => {
  const a = state.active;
  const ex = state.exercises[el.dataset.id] || ensureExercise(el.dataset.id);
  if (!ex) return;
  const alsoRoutine = $('#pickSave')?.checked;
  const r = a.routineId && state.routines.find(x => x.id === a.routineId);
  let routineChanged = false;
  if (pickMode === 'swap' && a.entries.length) {
    const old = a.entries[a.idx];
    const oldId = old.exId;
    const ne = newEntry(ex);
    if (old.sg) Object.assign(ne, { sg: old.sg, sgi: old.sgi, sgn: old.sgn });
    // substituto sugerido sem histórico próprio: começa na carga estimada
    if (el.dataset.w && ne.plan.first) ne.cur.w = Number(el.dataset.w);
    a.entries[a.idx] = ne;
    if (alsoRoutine && r) {
      const i = r.ex.indexOf(oldId);
      if (i >= 0) r.ex[i] = ex.id; else r.ex.push(ex.id);
      routineChanged = true;
    }
    toast(t('Trocado por {x}.', { x: exName(ex) }));
  } else {
    const at = a.entries.length ? a.idx + 1 : 0;
    a.entries.splice(at, 0, newEntry(ex));
    if (alsoRoutine && r) {
      const prev = a.entries[a.idx]?.exId;
      const i = r.ex.indexOf(prev);
      r.ex.splice(i >= 0 ? i + 1 : r.ex.length, 0, ex.id);
      routineChanged = true;
    }
    a.idx = at;
    toast(t('{x} adicionado.', { x: exName(ex) }));
  }
  if (routineChanged) { defaultGroupGoals(); save(); } else save({ touch: false });
  closeSheet();
  render();
  window.scrollTo(0, 0);
};

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
    <li>${t('<b>"desfazer"</b>, <b>"pular"</b>, <b>"próximo"</b>')}</li>
    <li class="warm-li">${t('<b>"foi aquecimento"</b> ou <b>"aquecimento, 20 quilos, 15"</b> marca aquecimento; <b>"não foi aquecimento"</b> desfaz')}</li>
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
  let worked = false;
  for (const act of acts) {
    const { en, ex } = cur();
    if (act.type === 'set' && act.warm) {
      const w = act.w != null ? fromW(act.w) : en.cur.w, r = act.r ?? en.cur.r;
      logWarm(en, w, r);
      said.push(`${setStr({ w, r })} (${t('aquecimento')})`);
    } else if (act.type === 'set') {
      const w = act.w != null ? fromW(act.w) : en.cur.w, r = act.r ?? en.cur.r;
      const kind = record(en, ex, w, r, act.fail ? 'F' : undefined);
      said.push(setStr({ w, r }) + (kind === 'warm' ? ` (${t('aquecimento')})` : act.fail ? ` (${t('falhou')})` : ''));
      if (kind === 'set') worked = true;
    } else if (act.type === 'warm') {
      // acabou de registrar uma série válida: ela vira aquecimento; senão, registra a atual como aquecimento
      const last = en.lastLog === 'set' ? en.sets.pop() : null;
      const s = last ? { w: last.w, r: last.r } : { w: en.cur.w, r: en.cur.r };
      logWarm(en, s.w, s.r);
      said.push(`${setStr(s)} ${t('contada como aquecimento')}`);
    } else if (act.type === 'unwarm') {
      const w = en.warmup.pop();
      if (w) { en.sets.push(w); en.lastLog = null; said.push(`${setStr(w)} ${t('contada como série válida')}`); }
      else said.push(t('nenhum aquecimento para desfazer'));
    } else if (act.type === 'planned') {
      const n = act.all ? Math.max(1, goal(en, ex) - en.sets.length) : 1;
      for (let i = 0; i < n; i++) { said.push(setStr(en.cur)); logSet(en, en.cur.w, en.cur.r); }
      worked = true;
    } else if (act.type === 'delta') {
      if (act.dw) { en.cur.w = Math.max(0, en.cur.w + act.dw); said.push(t('carga ajustada para {w}', { w: kg(en.cur.w) })); }
      else { const r = Math.max(0, en.cur.r + act.dr); said.push(setStr({ w: en.cur.w, r })); logSet(en, en.cur.w, r); }
    } else if (act.type === 'undo') {
      said.push(undo(en) ? t('última série desfeita') : t('nada para desfazer'));
    } else if (act.type === 'skip') {
      en.skipped = !en.sets.length; move = 'next'; said.push(t('exercício pulado'));
    } else if (act.type === 'next') {
      move = 'next';
    }
  }
  save({ touch: false });
  if (move === 'next') nextExercise();
  else if (worked && !move) afterWorkSet(said);
  else render();
  if (said.length && !(worked && state.active?.entries[state.active.idx]?.sg)) toast(said.join(' · '), 3500);
}

route('treino', render, { noTabs: true });
