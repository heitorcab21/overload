// Aba Cardio: registrar sessões (tipo, tempo, distância), meta de minutos por semana, gráfico e histórico.
import { state, save, uid } from '../store.js';
import { $, esc, fmt, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, meter, fmtDate } from '../ui.js';
import { route, rerender } from '../router.js';
import { t, tn } from '../i18n.js';
import { weekStart, addDays } from '../logic.js';
import { columnChart } from '../charts.js';
import { CARDIO_TYPES, INTENSITIES, cardioKcal, cardioIn, cardioMinutes, cardioWeeks } from '../cardio.js';
import { routinesCard } from './cardiorun.js';

export const cardioName = type => t((CARDIO_TYPES[type] || CARDIO_TYPES.outro).name);
const intName = i => ({ leve: t('Leve'), moderado: t('Moderado'), forte: t('Forte') })[i] || t('Moderado');
export const cardioLine = c => `${cardioName(c.type)} · ${c.min} min${c.km ? ` · ${fmt(c.km)} km` : ''}`;

function render() {
  state.cardio ??= [];
  const now = new Date();
  const ws = weekStart(now);
  const week = cardioIn(ws, addDays(ws, 7));
  const min = cardioMinutes(week);
  const goal = state.cardioGoal || 150;
  const weeks = cardioWeeks(8, now);
  const last = state.cardio.at(-1);
  const list = state.cardio.slice().reverse().slice(0, 40);
  $('#view').innerHTML = `
    <div class="head"><h1>${t('Cardio')}</h1></div>
    <div class="stack">
      <div class="card stack">
        <div class="row between"><h3>${t('Meta da semana')}</h3><button class="btn sm ghost" data-act="cardioGoal">${icon.edit}${goal} min</button></div>
        <div class="row between"><span class="big-num">${min} <small class="muted">/ ${goal} min</small></span>
          <span class="small muted">${tn(week.length, '{n} sessão', '{n} sessões')} · ${cardioMinutes(week) ? `${week.reduce((n, c) => n + (c.kcal || 0), 0)} kcal` : ''}</span></div>
        ${meter(min / goal, min >= goal)}
        <p class="small muted">${min >= goal ? t('Meta da semana batida!') : t('Faltam {n} min para a meta da semana.', { n: goal - min })}</p>
      </div>
      <button class="btn primary big" data-act="cardioNew">${icon.plus}${t('Registrar cardio')}</button>
      ${last ? `<button class="btn block" data-act="cardioRepeat">${icon.sync}${t('Repetir: {x}', { x: cardioLine(last) })}</button>` : ''}
      ${routinesCard()}
      ${state.cardio.length ? `<div class="card"><h3>${t('Minutos por semana')}</h3><div class="chart" id="cardioChart"></div></div>` : ''}
      <div class="card flat">
        <h3 style="padding:16px 16px 4px">${t('Histórico')}</h3>
        <div class="list">${list.map(c => `<button class="item" data-act="cardioEdit" data-id="${c.id}">
          <span class="grow"><span class="t">${esc(cardioLine(c))}</span><br><span class="d">${fmtDate(c.date)} · ${intName(c.int)} · ${c.kcal || 0} kcal</span></span>${icon.edit}</button>`).join('')
          || `<p class="empty">${t('Seus treinos de cardio aparecem aqui.')}</p>`}</div>
      </div>
    </div>`;
  if (state.cardio.length) {
    columnChart($('#cardioChart'), weeks.map((w, i) => ({
      label: fmtDate(w.start, false), value: w.min,
      tip: `${i === weeks.length - 1 ? t('Esta semana') : t('Semana de {d}', { d: fmtDate(w.start, false) })} · ${tn(w.count, '{n} sessão', '{n} sessões')}`,
    })), { unit: ' min' });
  }
}

// ---------- Folha de registro (usada na aba Cardio e dentro do treino) ----------

let draft = null; // { id?, type, min, km, int, date, sessionId? }

export function openCardioSheet(opts = {}) {
  const base = opts.id ? state.cardio.find(c => c.id === opts.id) : null;
  const last = state.cardio?.at(-1);
  draft = base ? { ...base } : { type: last?.type || 'esteira', min: last?.min || 20, km: null, int: 'moderado', date: opts.date || new Date().toISOString(), sessionId: opts.sessionId || null };
  drawSheet(!!base);
}

function drawSheet(editing) {
  sheet(`<h2>${editing ? t('Editar cardio') : t('Registrar cardio')}</h2>
    <form class="stack" data-submit="cardioSave">
      <div class="cardio-types">${Object.keys(CARDIO_TYPES).map(k => `<button type="button" class="chip${draft.type === k ? ' on' : ''}" data-act="cardioType" data-k="${k}" aria-pressed="${draft.type === k}">${esc(cardioName(k))}</button>`).join('')}</div>
      <div class="two">
        ${stepper('min', draft.min, 5, t('Tempo (min)'), 1)}
        ${stepper('km', draft.km ?? '', 0.5, t('Distância (km, opcional)'), 0)}
      </div>
      <div class="seg" role="group" aria-label="${t('Intensidade')}">${INTENSITIES.map(i => `<button type="button" class="${draft.int === i ? 'on' : ''}" data-act="cardioInt" data-i="${i}" aria-pressed="${draft.int === i}">${intName(i)}</button>`).join('')}</div>
      <p class="small muted" id="cardioKcal"></p>
      ${draft.sessionId ? '' : `<label class="field">${t('Data')}<input type="date" name="date" value="${new Date(draft.date).toLocaleDateString('sv-SE')}" max="${new Date().toLocaleDateString('sv-SE')}"></label>`}
      <button class="btn primary big">${t('Salvar')}</button>
      ${editing ? `<button type="button" class="btn ghost danger block" data-act="cardioDel">${icon.trash}${t('Excluir')}</button>` : ''}
    </form>`);
  showKcal();
  for (const n of ['min', 'km']) { const i = $(`#sheet input[name="${n}"]`); if (i) { i.dataset.change = 'cardioNum'; i.dataset.live = ''; } }
}

function readForm() {
  const f = $('#sheet form');
  if (!f) return;
  draft.min = Math.max(1, Math.round(Number(f.min.value) || 0));
  const km = Number(String(f.km.value).replace(',', '.'));
  draft.km = km > 0 ? Math.round(km * 100) / 100 : null;
  if (f.date?.value) draft.date = new Date(`${f.date.value}T${new Date().toTimeString().slice(0, 8)}`).toISOString();
}
function showKcal() {
  const el = $('#cardioKcal');
  if (el) el.textContent = t('Cerca de {n} kcal (estimativa pelo tipo, tempo, intensidade e seu peso).', { n: cardioKcal(draft.type, draft.min, draft.int) });
}

changes.cardioNum = () => { readForm(); showKcal(); };
actions.cardioType = el => { readForm(); draft.type = el.dataset.k; drawSheet(!!draft.id); };
actions.cardioInt = el => { readForm(); draft.int = el.dataset.i; drawSheet(!!draft.id); };
submits.cardioSave = () => {
  readForm();
  state.cardio ??= [];
  const rec = { ...draft, kcal: cardioKcal(draft.type, draft.min, draft.int) };
  if (!rec.km) delete rec.km;
  if (!rec.sessionId) delete rec.sessionId;
  if (rec.id) state.cardio = state.cardio.map(c => (c.id === rec.id ? rec : c));
  else { rec.id = uid(); state.cardio.push(rec); }
  state.cardio.sort((a, b) => new Date(a.date) - new Date(b.date));
  save();
  closeSheet();
  toast(t('Cardio salvo: {x}.', { x: cardioLine(rec) }));
  rerender();
};
actions.cardioDel = () => {
  state.cardio = state.cardio.filter(c => c.id !== draft.id);
  save(); closeSheet(); rerender();
};

actions.cardioNew = () => openCardioSheet();
actions.cardioEdit = el => openCardioSheet({ id: el.dataset.id });
actions.cardioRepeat = () => {
  const last = state.cardio.at(-1);
  if (!last) return;
  const rec = { id: uid(), date: new Date().toISOString(), type: last.type, min: last.min, ...(last.km ? { km: last.km } : {}), int: last.int, kcal: cardioKcal(last.type, last.min, last.int) };
  state.cardio.push(rec);
  save();
  toast(t('Cardio salvo: {x}.', { x: cardioLine(rec) }));
  rerender();
};
actions.cardioGoal = () => {
  sheet(`<h2>${t('Meta de cardio por semana')}</h2>
    <p class="muted small">${t('A recomendação da OMS para adultos é de 150 a 300 minutos de atividade moderada por semana.')}</p>
    <form class="stack" data-submit="cardioGoalSave">
      ${stepper('goal', state.cardioGoal || 150, 15, t('Minutos por semana'), 15)}
      <button class="btn primary big">${t('Salvar')}</button>
    </form>`);
};
submits.cardioGoalSave = form => {
  state.cardioGoal = Math.max(15, Math.round(Number(form.goal.value) || 150));
  save(); closeSheet(); rerender();
};

route('cardio', render);
