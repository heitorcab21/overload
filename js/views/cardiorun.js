// Rotinas de cardio: editor, cronômetro (bipe e vibração) e registro com nota de esforço.
import { state, save, uid } from '../store.js';
import { $, esc, fmt, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, meter, fmtDate } from '../ui.js';
import { route, go, rerender, current } from '../router.js';
import { t, tn } from '../i18n.js';
import { lineChart } from '../charts.js';
import { CARDIO_TYPES, INTENSITIES } from '../cardio.js';
import { CARDIO_TEMPLATES, hrMax, HR_ZONE, segmentsOf, planSeconds, planKcal, planIntensity, routineHistory, nextStep, blocksSummary, fmtSec, clock } from '../cardioplan.js';
import { toSpeed, fromSpeed, speedUnit, toDist, fromDist, distUnit, ul } from '../units.js';
import { tone, restAlert } from './workout.js';
import { profile } from '../body.js';
import { locale } from '../i18n.js';

const typeName = k => t((CARDIO_TYPES[k] || CARDIO_TYPES.outro).name);
const intName = i => ({ leve: t('Leve'), moderado: t('Moderado'), forte: t('Forte') })[i] || t('Moderado');
const routines = () => (state.cardioRoutines ??= []);
const copy = o => JSON.parse(JSON.stringify(o));

export function stepText(st) {
  if (!st) return '';
  return {
    round: t('Ficou fácil: suba para {n} rodadas.', { n: st.n }),
    speed: ul(t('Ficou fácil: suba a velocidade para {v} km/h.', { v: fmt(toSpeed(st.v)) })),
    incline: t('Ficou fácil: suba a inclinação para {v}%.', { v: st.v }),
    level: t('Ficou fácil: suba para o nível {v}.', { v: st.v }),
    time: t('Ficou fácil: aumente o bloco principal para {x}.', { x: fmtSec(st.sec) }),
    hold: t('Esforço na medida: repita a rotina igual.'),
    hard: t('Ficou pesado: repita igual ou alivie um pouco.'),
  }[st.key];
}

/** Faixa com todas as etapas, proporcional ao tempo de cada uma. idx = etapa atual (-1 no cartão). */
export function timeline(segs, idx = -1) {
  return `<div class="ctl" aria-hidden="true">${segs.map((s, i) => `<i class="ctl-${s.phase} int-${s.int}${i === idx ? ' now' : i < idx ? ' done' : ''}" style="flex-grow:${s.sec}"></i>`).join('')}</div>`;
}

// ---------- Cartão na aba Cardio ----------

export function routinesCard() {
  const run = state.cardioRun;
  const list = routines();
  return `<div class="card stack">
    <h3>${t('Rotinas com cronômetro')}</h3>
    ${run ? `<a class="btn primary block" href="#/cardiorun">${icon.play}${t('Voltar ao cronômetro')}</a>` : ''}
    ${list.map(r => {
      const hist = routineHistory(r.id);
      const last = hist.at(-1);
      const st = nextStep(r);
      return `<div class="croutine">
        <div class="row between"><span class="grow"><b>${esc(r.name)}</b><br><span class="small muted">${esc(typeName(r.type))} · ${esc(blocksSummary(r.blocks))} · ${fmtSec(planSeconds(r.blocks))}</span></span>
          <a class="icon-btn" href="#/cardiorot/${r.id}" aria-label="${t('Editar rotina')}">${icon.edit}</a></div>
        ${timeline(segmentsOf(r.blocks))}
        ${last ? `<p class="small muted">${t('Última: {d} · esforço {n}/10', { d: fmtDate(last.date, false), n: last.rpe ?? '—' })}</p>` : ''}
        ${st ? `<p class="small step-${st.kind}">${esc(stepText(st))}${st.apply ? ` <button class="btn sm" data-act="cApply" data-id="${r.id}">${t('Aplicar')}</button>` : ''}</p>` : ''}
        <button class="btn primary block" data-act="cStart" data-id="${r.id}"${run ? ' disabled' : ''}>${icon.play}${t('Começar')}</button>
      </div>`;
    }).join('') || `<p class="muted small">${t('Monte rotinas como "aquecer 5 min, 8× 30 s forte / 30 s leve, desaquecer". O cronômetro avisa cada troca com bipe e vibração.')}</p>`}
    <div class="two">
      <a class="btn" href="#/cardiorot/novo">${icon.plus}${t('Nova rotina')}</a>
      <button class="btn" data-act="cTemplates">${icon.list}${t('Modelos prontos')}</button>
    </div>
  </div>`;
}

actions.cTemplates = () => {
  sheet(`<h2>${t('Modelos prontos')}</h2>
    <p class="small muted">${t('Protocolos estudados. Toque para adicionar e ajuste depois como quiser.')}</p>
    <div class="ctpl-list">${CARDIO_TEMPLATES.map(tp => `<button class="ctpl" data-act="cAddTpl" data-id="${tp.id}">
      <span class="row between"><b>${esc(t(tp.name))}</b>${icon.plus}</span>
      <span class="small muted">${esc(typeName(tp.type))} · ${esc(blocksSummary(tp.blocks))} · ${fmtSec(planSeconds(tp.blocks))}</span>
      ${timeline(segmentsOf(tp.blocks))}
      ${tp.about ? `<span class="small">${esc(t(tp.about))}</span>` : ''}</button>`).join('')}</div>`);
};
actions.cAddTpl = el => {
  const tp = CARDIO_TEMPLATES.find(x => x.id === el.dataset.id);
  routines().push({ id: uid(), name: t(tp.name), type: tp.type, blocks: copy(tp.blocks) });
  save(); closeSheet(); rerender();
  toast(t('Rotina adicionada: {x}.', { x: t(tp.name) }));
};
actions.cApply = el => {
  const r = routines().find(x => x.id === el.dataset.id);
  const st = r && nextStep(r);
  if (!st?.apply) return;
  st.apply(r.blocks);
  // marca que o avanço já foi aplicado, para não sugerir de novo até a próxima sessão
  const last = routineHistory(r.id).at(-1);
  if (last) last.applied = true;
  save(); rerender();
  toast(t('Avanço aplicado. Bom treino!'));
};

// ---------- Editor ----------

let draft = null;

function blockHtml(b, i, n) {
  const num = (name, val, label, step = 0.5) => `<label class="field mini">${label}<input type="number" inputmode="decimal" step="${step}" min="0" name="b${i}_${name}" value="${val ?? ''}" data-change="cField"></label>`;
  const seg = (name, val) => `<div class="seg sm">${INTENSITIES.map(x => `<button type="button" class="${val === x ? 'on' : ''}" data-act="cInt" data-i="${i}" data-k="${name}" data-v="${x}">${intName(x)}</button>`).join('')}</div>`;
  const tools = `<div class="row"><button type="button" class="icon-btn" data-act="cUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${t('Subir')}">${icon.up}</button>
    <button type="button" class="icon-btn" data-act="cDel" data-i="${i}" ${n === 1 ? 'disabled' : ''} aria-label="${t('Remover')}">${icon.x}</button></div>`;
  if (b.kind === 'int') {
    return `<div class="cblock int"><div class="row between"><b>${icon.sync}${t('Intervalado')}</b>${tools}</div>
      <div class="three">${num('rounds', b.rounds, t('Rodadas'), 1)}${num('work', b.work, t('Forte (s)'), 5)}${num('rest', b.rest, t('Descanso (s)'), 5)}</div>
      ${seg('int', b.int || 'forte')}
      <p class="small muted">${t('Metas no forte (opcional)')}</p>
      <div class="three">${num('speed', b.speed != null ? toSpeed(b.speed) : b.speed, speedUnit())}${num('incline', b.incline, t('Inclinação %'), 1)}${num('level', b.level, t('Nível'), 1)}</div>
      <p class="small muted">${t('No descanso (opcional)')}</p>
      <div class="three">${num('restSpeed', b.restSpeed != null ? toSpeed(b.restSpeed) : b.restSpeed, speedUnit())}${num('restIncline', b.restIncline, t('Inclinação %'), 1)}${num('restLevel', b.restLevel, t('Nível'), 1)}</div>
    </div>`;
  }
  return `<div class="cblock"><div class="row between"><b>${icon.play}${t('Contínuo')}</b>${tools}</div>
    <div class="three">${num('min', Math.round((b.sec / 60) * 100) / 100, t('Minutos'), 0.5)}${num('speed', b.speed != null ? toSpeed(b.speed) : b.speed, speedUnit())}${num('incline', b.incline, t('Inclinação %'), 1)}</div>
    <div class="three">${num('level', b.level, t('Nível'), 1)}<label class="field mini">${t('Nome (opcional)')}<input type="text" maxlength="20" name="b${i}_label" value="${esc(b.label ? t(b.label) : '')}" data-change="cField"></label></div>
    ${seg('int', b.int || 'moderado')}
  </div>`;
}

function renderEditor(id) {
  if (!draft || draft._for !== id) {
    const r = id !== 'novo' && routines().find(x => x.id === id);
    draft = r ? { ...copy(r), _for: id } : { _for: id, name: '', type: 'esteira', blocks: [{ kind: 'cont', sec: 600, int: 'moderado' }] };
  }
  const r = id !== 'novo' && routines().find(x => x.id === id);
  const hist = r ? routineHistory(r.id) : [];
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="#/cardio" aria-label="${t('Voltar')}">${icon.back}</a><h1 class="grow">${r ? esc(r.name) : t('Nova rotina')}</h1></div>
    <div class="stack" id="cEditor">
      <label class="field">${t('Nome da rotina')}<input type="text" name="name" maxlength="40" value="${esc(draft.name)}" placeholder="${t('Ex.: Tiros na esteira')}" data-change="cField"></label>
      <label class="field">${t('Aparelho ou atividade')}<select name="type" data-change="cField">${Object.keys(CARDIO_TYPES).map(k => `<option value="${k}"${draft.type === k ? ' selected' : ''}>${esc(typeName(k))}</option>`).join('')}</select></label>
      ${draft.blocks.map((b, i) => blockHtml(b, i, draft.blocks.length)).join('')}
      <div class="two">
        <button class="btn" data-act="cAddCont">${icon.plus}${t('Bloco contínuo')}</button>
        <button class="btn" data-act="cAddInt">${icon.plus}${t('Intervalado')}</button>
      </div>
      <p class="small muted" id="cTotal">${t('Duração total: {x}', { x: fmtSec(planSeconds(draft.blocks)) })}</p>
      <button class="btn primary big" data-act="cSave">${t('Salvar rotina')}</button>
      ${r ? `<button class="btn ghost danger block" data-act="cDelRoutine" data-id="${r.id}">${icon.trash}${t('Excluir rotina')}</button>` : ''}
      ${hist.length ? `<div class="card stack"><h3>${t('Evolução')}</h3>
        ${hist.length > 1 ? '<div class="chart" id="cChart"></div>' : ''}
        <div class="list">${hist.slice().reverse().slice(0, 10).map(c => `<div class="item"><span class="grow">${fmtDate(c.date, false)} · ${c.min} min${c.km ? ` · ${fmt(toDist(c.km))} ${distUnit()}` : ''}</span><span class="badge">${t('esforço {n}', { n: c.rpe ?? '—' })}</span></div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  if (hist.length > 1) {
    lineChart($('#cChart'), hist.slice(-20).map(c => ({ label: fmtDate(c.date, false), value: c.km ? toDist(c.km) : c.min, tip: `${fmtDate(c.date)} · ${c.min} min${c.km ? ` · ${fmt(toDist(c.km))} ${distUnit()}` : ''} · ${t('esforço {n}', { n: c.rpe ?? '—' })}` })),
      { unit: hist.some(c => c.km) ? ` ${distUnit()}` : ' min' });
  }
}

/** Lê os campos do editor para o rascunho (sem redesenhar, para não fechar o teclado). */
function readEditor() {
  const root = $('#cEditor');
  if (!root || !draft) return;
  const v = n => root.querySelector(`[name="${n}"]`)?.value;
  const num = n => { const x = Number(String(v(n) ?? '').replace(',', '.')); return x > 0 ? x : null; };
  draft.name = (v('name') || '').trim();
  draft.type = v('type') || draft.type;
  draft.blocks.forEach((b, i) => {
    if (b.kind === 'int') {
      b.rounds = Math.max(1, Math.round(num(`b${i}_rounds`) || 1));
      b.work = Math.max(5, Math.round(num(`b${i}_work`) || 30));
      b.rest = Math.max(0, Math.round(Number(v(`b${i}_rest`)) || 0));
      for (const k of ['speed', 'incline', 'level', 'restSpeed', 'restIncline', 'restLevel']) { let x = num(`b${i}_${k}`); if (x != null && /speed/i.test(k)) x = fromSpeed(x); if (x == null) delete b[k]; else b[k] = x; }
    } else {
      b.sec = Math.max(30, Math.round((num(`b${i}_min`) || 1) * 60));
      for (const k of ['speed', 'incline', 'level']) { const x = num(`b${i}_${k}`); if (x == null) delete b[k]; else b[k] = x; }
      const lbl = (v(`b${i}_label`) || '').trim();
      if (lbl) b.label = lbl; else delete b.label;
    }
  });
  const tot = $('#cTotal');
  if (tot) tot.textContent = t('Duração total: {x}', { x: fmtSec(planSeconds(draft.blocks)) });
}
changes.cField = () => readEditor();
actions.cInt = el => { readEditor(); draft.blocks[Number(el.dataset.i)][el.dataset.k] = el.dataset.v; rerender(); };
actions.cAddCont = () => { readEditor(); draft.blocks.push({ kind: 'cont', sec: 300, int: 'leve' }); rerender(); };
actions.cAddInt = () => { readEditor(); draft.blocks.push({ kind: 'int', rounds: 8, work: 30, rest: 30, int: 'forte' }); rerender(); };
actions.cUp = el => { readEditor(); const i = Number(el.dataset.i); [draft.blocks[i - 1], draft.blocks[i]] = [draft.blocks[i], draft.blocks[i - 1]]; rerender(); };
actions.cDel = el => { readEditor(); draft.blocks.splice(Number(el.dataset.i), 1); rerender(); };
actions.cSave = () => {
  readEditor();
  if (!draft.name) { toast(t('Dê um nome para a rotina.'), 3000); return; }
  const { _for, ...data } = draft;
  const list = routines();
  const i = list.findIndex(x => x.id === data.id);
  if (i >= 0) list[i] = data; else list.push({ ...data, id: uid() });
  draft = null;
  save();
  go('#/cardio');
  toast(t('Rotina salva.'));
};
actions.cDelRoutine = el => {
  sheet(`<h2>${t('Excluir esta rotina?')}</h2><p class="muted">${t('As sessões já feitas continuam no histórico de cardio.')}</p>
    <button class="btn danger block" data-act="cDelRoutineNow" data-id="${el.dataset.id}">${t('Excluir rotina')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
actions.cDelRoutineNow = el => {
  state.cardioRoutines = routines().filter(x => x.id !== el.dataset.id);
  draft = null; save(); closeSheet(); go('#/cardio');
};

// ---------- Cronômetro ----------

let audio = null;
let ticker = null;
let wake = null;
let lastBeep = -1;

function beep(freq = 880, ms = 120, vol = 0.25) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* sem som */ }
}
const buzz = p => { try { navigator.vibrate?.(p); } catch { /* sem vibração */ } };

// ---------- Voz: anuncia cada etapa (dá para desligar no cronômetro) ----------
const voiceOn = () => state.settings.cardioVoice !== false;
function say(text) {
  if (!voiceOn() || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale(); u.rate = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}
const PREP = 3; // segundos de "prepare-se" antes da primeira etapa

actions.cStart = async el => {
  const r = routines().find(x => x.id === el.dataset.id);
  if (!r) return;
  beep(660, 60, 0.01); // libera o som do navegador neste toque
  try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* sem voz */ } // e a voz
  const segs = segmentsOf(r.blocks);
  const now = Date.now();
  state.cardioRun = { rid: r.id, name: r.name, type: r.type, blocks: copy(r.blocks), segs, idx: 0, prepUntil: now + PREP * 1000, endAt: now + (PREP + segs[0].sec) * 1000, doneSec: 0, startedAt: now, paused: false };
  say(t('Prepare-se. Começa com {x}.', { x: phaseName(segs[0]) }));
  save({ touch: false });
  buzz(200);
  go('#/cardiorun');
};

const phaseName = s => (s.phase === 'work' ? t('Forte') : s.phase === 'rest' ? t('Descanso') : s.label ? t(s.label) : `${t('Contínuo')} · ${intName(s.int)}`);
const targets = s => [s.speed && `${fmt(toSpeed(s.speed))} ${speedUnit()}`, s.incline != null && `${t('inclinação')} ${fmt(s.incline)}%`, s.level && `${t('nível')} ${s.level}`].filter(Boolean).join(' · ');
// guia de intensidade: batimentos (se houver idade no perfil) e o teste da fala
const TALK = () => ({ leve: t('dá para conversar'), moderado: t('frases curtas'), forte: t('poucas palavras') });
function hrGuide(s) {
  const int = s.phase === 'rest' ? 'leve' : s.int || 'moderado';
  const p = profile();
  const z = HR_ZONE[int];
  const hr = p ? `${Math.round(hrMax(p.age) * z[0])}–${Math.round(hrMax(p.age) * z[1])} bpm · ` : '';
  return `${hr}${TALK()[int]}`;
}
const R_RING = 100, C_RING = 2 * Math.PI * R_RING;
// o que a voz fala ao entrar numa etapa
function sayPhase(run) {
  const s = run.segs[run.idx];
  const lastRound = s.phase === 'work' && s.rounds > 1 && s.round === s.rounds;
  const parts = [phaseName(s), lastRound ? t('Última rodada!') : s.phase === 'work' && s.rounds ? t('Rodada {i} de {n}', { i: s.round, n: s.rounds }) : '', targets(s)];
  say(parts.filter(Boolean).join('. '));
}

function renderRun() {
  const run = state.cardioRun;
  if (!run) { go('#/cardio'); return; }
  const s = run.segs[run.idx];
  const next = run.segs[run.idx + 1];
  const prep = run.prepUntil && Date.now() < run.prepUntil;
  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="cHome" aria-label="${t('Voltar')}">${icon.back}</button>
      <span class="title">${esc(run.name)}</span>
      <button class="icon-btn" data-act="cVoice" aria-pressed="${voiceOn()}" aria-label="${voiceOn() ? t('Desligar a voz') : t('Ligar a voz')}">${voiceOn() ? SPK_ON : SPK_OFF}</button>
    </div>
    <div class="crun phase-${prep ? 'prep' : s.phase}" id="crun">
      <p class="crun-phase" id="cPhase">${prep ? t('Prepare-se') : esc(phaseName(s))}</p>
      ${s.rounds && !prep ? `<p class="crun-round" id="cRound">${s.round === s.rounds && s.phase === 'work' && s.rounds > 1 ? t('Última rodada!') : t('Rodada {i} de {n}', { i: s.round, n: s.rounds })}</p>` : '<p class="crun-round" id="cRound"></p>'}
      <div class="crun-ring">
        <svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="${R_RING}" class="ring-bg"/><circle cx="110" cy="110" r="${R_RING}" class="ring-fg" id="cRing" stroke-dasharray="${C_RING.toFixed(1)}" stroke-dashoffset="0" transform="rotate(-90 110 110)"/></svg>
        <p class="crun-clock num" id="cClock">${clock(prep ? PREP : s.sec)}</p>
      </div>
      <p class="crun-target" id="cTarget">${prep ? `${t('Começa com')}: ${esc(phaseName(s))}` : esc(targets(s))}</p>
      <p class="crun-hr small">${prep ? '' : esc(hrGuide(s))}</p>
      ${timeline(run.segs, prep ? -1 : run.idx)}
      <p class="small muted" id="cNext">${next ? `${t('Próximo')}: ${esc(phaseName(next))} · ${clock(next.sec)}` : t('Última etapa')}</p>
      <p class="small muted" id="cLeft"></p>
    </div>
    <div class="crun-btns">
      <button class="btn big" data-act="cPause" id="cPauseBtn">${run.paused ? `${icon.play}${t('Continuar')}` : t('Pausar')}</button>
      <button class="btn" data-act="cPlus">${t('+30 s')}</button>
      <button class="btn" data-act="cSkip">${t('Pular etapa')}</button>
      <button class="btn ghost danger" data-act="cStopAsk">${t('Encerrar')}</button>
    </div>`;
  keepOn();
  clearInterval(ticker);
  ticker = setInterval(tick, 200);
  tick();
}

async function keepOn() {
  try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* ok */ }
}

function tick() {
  const run = state.cardioRun;
  if (!run || current().name !== 'cardiorun') { clearInterval(ticker); return; }
  const now = Date.now();
  let left = run.paused ? run.left : (run.endAt - now) / 1000;
  // terminou a etapa (inclusive se o app ficou em segundo plano): avança quantas forem precisas
  let changed = false;
  while (!run.paused && left <= 0) {
    run.doneSec += run.segs[run.idx].sec;
    run.idx++;
    changed = true;
    if (run.idx >= run.segs.length) { finishRun(true); return; }
    run.endAt += run.segs[run.idx].sec * 1000;
    left = (run.endAt - now) / 1000;
  }
  if (changed) {
    restAlert();
    buzz([200, 100, 200]);
    lastBeep = -1;
    save({ touch: false });
    renderRun();
    sayPhase(run);
    return;
  }
  const s = run.segs[run.idx];
  // fim do "prepare-se": entra na primeira etapa
  const prep = run.prepUntil && !run.paused && now < run.prepUntil;
  if (run.prepUntil && !run.paused && now >= run.prepUntil) {
    delete run.prepUntil;
    restAlert(); buzz(200); lastBeep = -1;
    save({ touch: false }); renderRun(); sayPhase(run);
    return;
  }
  const shown = prep ? (run.prepUntil - now) / 1000 : left;
  // bipe curto nos 3 últimos segundos (da etapa e do "prepare-se")
  const whole = Math.ceil(shown);
  if (!run.paused && whole <= 3 && whole >= 1 && whole !== lastBeep) { lastBeep = whole; tone(880, 0.11); }
  const total = run.segs.reduce((n, x) => n + x.sec, 0);
  const done = prep ? 0 : run.doneSec + (s.sec - Math.max(0, left));
  // metade da rotina, uma vez
  if (!run.half && !prep && done >= total / 2 && total >= 600) { run.half = true; say(t('Metade da rotina. Continue assim!')); }
  const c = $('#cClock'); if (c) c.textContent = clock(shown);
  const ring = $('#cRing');
  if (ring) ring.setAttribute('stroke-dashoffset', (C_RING * (1 - Math.max(0, shown) / (prep ? PREP : s.sec))).toFixed(1));
  const l = $('#cLeft'); if (l) l.textContent = t('Faltam {x} no total', { x: clock(total - done) });
}

actions.cPause = () => {
  const run = state.cardioRun;
  if (!run) return;
  if (run.prepUntil) { delete run.prepUntil; run.endAt = Date.now() + run.segs[0].sec * 1000; }
  if (run.paused) { run.endAt = Date.now() + run.left * 1000; run.paused = false; delete run.left; }
  else { run.left = Math.max(0, (run.endAt - Date.now()) / 1000); run.paused = true; }
  save({ touch: false });
  renderRun();
};
actions.cPlus = () => {
  const run = state.cardioRun;
  if (!run || run.prepUntil) return;
  run.segs[run.idx].sec += 30;
  if (run.paused) run.left += 30; else run.endAt += 30000;
  save({ touch: false });
  toast(t('+30 s nesta etapa.'), 1500);
  tick();
};
actions.cVoice = () => {
  state.settings.cardioVoice = !voiceOn();
  save({ touch: false });
  if (!voiceOn()) { try { speechSynthesis.cancel(); } catch { /* ok */ } }
  renderRun();
};
const SPK_ON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SPK_OFF = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
actions.cSkip = () => {
  const run = state.cardioRun;
  if (!run) return;
  if (run.prepUntil) {
    delete run.prepUntil;
    run.endAt = Date.now() + run.segs[0].sec * 1000;
    run.paused = false; delete run.left;
    restAlert(); buzz(150); save({ touch: false }); renderRun(); sayPhase(run);
    return;
  }
  const left = run.paused ? run.left : Math.max(0, (run.endAt - Date.now()) / 1000);
  run.doneSec += run.segs[run.idx].sec - left;
  run.idx++;
  if (run.idx >= run.segs.length) { finishRun(true); return; }
  run.endAt = Date.now() + run.segs[run.idx].sec * 1000;
  run.paused = false; delete run.left;
  restAlert(); buzz(150);
  save({ touch: false });
  renderRun();
  sayPhase(run);
};
actions.cHome = () => go('#/cardio');
actions.cStopAsk = () => {
  sheet(`<h2>${t('Encerrar a rotina?')}</h2><p class="muted">${t('O que você já fez fica registrado.')}</p>
    <button class="btn primary block" data-act="cStopNow">${t('Encerrar e registrar')}</button>
    <button class="btn ghost danger block" data-act="cDiscard">${t('Descartar sem registrar')}</button>
    <button class="btn block" data-act="closeSheet">${t('Continuar')}</button>`);
};
actions.cStopNow = () => { closeSheet(); finishRun(false); };
actions.cDiscard = () => { state.cardioRun = null; save({ touch: false }); closeSheet(); clearInterval(ticker); releaseWake(); go('#/cardio'); };
function releaseWake() { try { wake?.release(); } catch { /* ok */ } wake = null; }

// ---------- Fim: nota de esforço e registro ----------

function finishRun(complete) {
  const run = state.cardioRun;
  clearInterval(ticker);
  if (!run.ended) {
    if (!complete) {
      const left = run.paused ? run.left : Math.max(0, (run.endAt - Date.now()) / 1000);
      run.doneSec += run.segs[run.idx].sec - left;
    }
    run.ended = true;
    save({ touch: false });
  }
  if (complete) { restAlert(); buzz([300, 120, 300, 120, 300]); say(t('Rotina concluída. Muito bem!')); }
  releaseWake();
  go('#/cardio');
  const rpeLabel = n => (n <= 4 ? t('fácil') : n <= 6 ? t('moderado') : n <= 8 ? t('difícil') : t('máximo'));
  sheet(`<h2>${complete ? t('Rotina concluída!') : t('Rotina encerrada')}</h2>
    <p class="muted">${esc(run.name)} · ${clock(run.doneSec)}</p>
    <form class="stack" data-submit="cRunSave">
      <h3>${t('Esforço de 1 a 10')}</h3>
      <div class="rpe">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="chip" data-act="cRpe" data-v="${i + 1}" title="${rpeLabel(i + 1)}">${i + 1}</button>`).join('')}</div>
      <p class="small muted">${t('1 a 4 fácil · 5 e 6 moderado · 7 e 8 difícil · 9 e 10 no limite. É com essa nota que o app sugere o próximo avanço.')}</p>
      <input type="hidden" name="rpe" value="">
      ${stepper('km', '', 0.1, ul(t('Distância (km, opcional)')), 0)}
      <button class="btn primary big">${t('Salvar')}</button>
    </form>`);
}
actions.cRpe = el => {
  for (const b of document.querySelectorAll('.rpe .chip')) b.classList.toggle('on', b === el);
  $('#sheet input[name="rpe"]').value = el.dataset.v;
};
submits.cRunSave = form => {
  const run = state.cardioRun;
  if (!run) { closeSheet(); return; }
  const rpe = Number(form.rpe.value) || null;
  if (!rpe) { toast(t('Escolha a nota de esforço.'), 2500); return; }
  const km = fromDist(Number(String(form.km.value).replace(',', '.')));
  const rec = {
    id: uid(), date: new Date(run.startedAt).toISOString(), type: run.type,
    min: Math.max(1, Math.round(run.doneSec / 60)), int: planIntensity(run.blocks), kcal: planKcal(run.type, run.segs, run.doneSec),
    routineId: run.rid, rpe, plan: run.blocks, ...(km > 0 ? { km: Math.round(km * 100) / 100 } : {}),
  };
  state.cardio ??= [];
  state.cardio.push(rec);
  state.cardio.sort((a, b) => new Date(a.date) - new Date(b.date));
  state.cardioRun = null;
  save();
  closeSheet();
  rerender();
  const r = routines().find(x => x.id === run.rid);
  const st = r ? nextStep(r) : null;
  toast(st ? stepText(st) : t('Cardio salvo.'), 5000);
};

route('cardiorot', renderEditor, { tab: 'cardio' });
route('cardiorun', renderRun, { noTabs: true });
