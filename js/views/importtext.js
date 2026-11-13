// Importar treinos de texto: cola o que estava no bloco de notas ou no WhatsApp, confere e salva.
import { state, save, uid } from '../store.js';
import { $, esc, fmt, icon, actions, changes, toast } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { GROUPS, LIB, LIB_BY_ID, tg, exName, ensureExercise } from '../data.js';
import { t, tn, exPack } from '../i18n.js';
import { parseWorkoutText, matchExercise, setsOfLine } from '../textimport.js';
import { aiEnabled, aiParseWorkoutText } from '../ai.js';
import { defaultGroupGoals } from '../logic.js';

let text = '';
let draft = null; // { sessions: [{ date, name, items: [{ raw, group, rest, sets, id }] }] }
let busy = false;

const EXAMPLE = `12/11 Treino A
• Peito
Supino reto
40kg 12 rep
40kg 10 rep
Crucifixo: 14kg 12/10/10
• Tríceps
Corda 3x12 com 25kg`;

const dateInput = iso => (iso ? new Date(iso) : new Date()).toLocaleDateString('sv-SE'); // AAAA-MM-DD
const setsText = sets => sets.map(s => (s.w > 0 ? `${fmt(s.w)}x${s.r}` : `${s.r}`)).join(' ');

function exOptions(item) {
  const name = id => (LIB_BY_ID[id] ? exPack(id)?.name ?? LIB_BY_ID[id].name : exName(state.exercises[id]));
  const custom = Object.values(state.exercises).filter(e => !e.lib);
  const opts = GROUPS.map(g => {
    const list = [...LIB.filter(l => l.group === g).map(l => l.id), ...custom.filter(c => c.group === g).map(c => c.id)];
    return `<optgroup label="${esc(tg(g))}">${list.map(id => `<option value="${esc(id)}"${id === item.id ? ' selected' : ''}>${esc(name(id))}</option>`).join('')}</optgroup>`;
  }).join('');
  return `<option value=""${item.id ? '' : ' selected'}>${t('Criar exercício novo: {x}', { x: esc(item.raw || t('sem nome')) })}</option>${opts}`;
}

function render() {
  const back = state.onboarded ? '#/ajustes' : '#/inicio';
  const head = `<div class="head"><a class="icon-btn" href="${back}" aria-label="${t('Voltar')}">${icon.back}</a><h1 class="grow">${t('Importar de texto')}</h1></div>`;
  if (!draft) {
    $('#view').innerHTML = `${head}
      <div class="stack">
        <p class="muted">${t('Já anota seus treinos no bloco de notas ou no WhatsApp? Cole o texto aqui e o app transforma em treinos, com as cargas e repetições de cada exercício. Assim a próxima carga já vem sugerida.')}</p>
        <textarea id="impText" rows="12" placeholder="${esc(EXAMPLE)}" aria-label="${t('Texto dos treinos')}">${esc(text)}</textarea>
        <p class="small muted">${t('Entende formatos como "15kg 10 rep", "40x12", "3x10 com 50kg", "50kg 12/10/8", datas ("12/11") e grupamentos ("• Tríceps"). Pode colar vários treinos de uma vez.')}</p>
        <button class="btn primary big" data-act="impRead" ${busy ? 'disabled' : ''}>${t('Ler texto')}</button>
        ${aiEnabled() ? `<button class="btn block" data-act="impAI" ${busy ? 'disabled' : ''}>${icon.spark}${busy ? t('Lendo com a IA…') : t('Organizar com a IA (texto bagunçado)')}</button>` : ''}
      </div>`;
    return;
  }
  const total = draft.sessions.reduce((n, s) => n + s.items.length, 0);
  $('#view').innerHTML = `${head}
    <div class="stack">
      <p class="muted">${t('Confira o que o app entendeu. Troque o exercício se ele errou e corrija as séries no formato carga x reps.')}</p>
      ${draft.sessions.map((s, si) => `<div class="card stack">
        <div class="two">
          <label class="field">${t('Data')}<input type="date" value="${dateInput(s.date)}" data-change="impDate" data-s="${si}"></label>
          <label class="field">${t('Nome do treino')}<input type="text" value="${esc(s.name || '')}" placeholder="${t('Treino importado')}" data-change="impName" data-s="${si}" maxlength="40"></label>
        </div>
        ${s.items.map((it, ii) => `<div class="imp-item stack">
          <div class="row between"><span class="small muted">${t('Você escreveu')}: <b>${esc(it.raw || '—')}</b></span>
            <button class="icon-btn" data-act="impDel" data-s="${si}" data-i="${ii}" aria-label="${t('Remover')}">${icon.trash}</button></div>
          <select data-change="impEx" data-s="${si}" data-i="${ii}" aria-label="${t('Exercício')}">${exOptions(it)}</select>
          ${it.id ? '' : `<select data-change="impGroup" data-s="${si}" data-i="${ii}" aria-label="${t('Grupamento')}">${GROUPS.map(g => `<option value="${esc(g)}"${g === (it.group || GROUPS[0]) ? ' selected' : ''}>${esc(tg(g))}</option>`).join('')}</select>`}
          <input type="text" value="${esc(setsText(it.sets))}" data-change="impSets" data-s="${si}" data-i="${ii}" aria-label="${t('Séries')}" inputmode="text">
          <span class="small muted">${tn(it.sets.length, '{n} série', '{n} séries')}${it.rest ? ` · ${t('descanso {s} s', { s: it.rest })}` : ''}</span>
        </div>`).join('')}
      </div>`).join('')}
      <label class="check"><input type="checkbox" id="impRoutine"${state.routines.length ? '' : ' checked'}>${t('Criar também fichas de treino com esses exercícios')}</label>
      <button class="btn primary big" data-act="impSave"${total ? '' : ' disabled'}>${tn(draft.sessions.length, 'Salvar {n} treino', 'Salvar {n} treinos')}</button>
      <button class="btn ghost block" data-act="impBack">${t('Voltar ao texto')}</button>
    </div>`;
}

const cur = el => draft.sessions[Number(el.dataset.s)];
const itemOf = el => cur(el).items[Number(el.dataset.i)];

actions.impRead = () => {
  text = $('#impText').value;
  const r = parseWorkoutText(text);
  if (!r.sessions.length) { toast(t('Não encontrei séries no texto. Use algo como "40kg 12 rep" ou "40x12".'), 5000); return; }
  draft = r;
  rerender();
  window.scrollTo(0, 0);
};

actions.impAI = async () => {
  text = $('#impText').value;
  if (!text.trim()) return;
  busy = true; rerender();
  try {
    const lib = LIB.map(l => `${l.id}: ${l.name}`).join('\n');
    const data = await aiParseWorkoutText(text, lib);
    const sessions = (data.sessions || []).map(s => ({
      date: s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? new Date(`${s.date}T12:00:00`).toISOString() : null,
      name: s.name || null,
      items: (s.exercises || []).filter(e => e.sets?.length).map(e => {
        const group = GROUPS.includes(e.group) ? e.group : null;
        const id = e.libId && LIB_BY_ID[e.libId] ? e.libId : matchExercise(e.name, group).id;
        return { raw: e.name, group, rest: e.restSec || null, sets: e.sets.filter(x => x.r > 0).map(x => ({ w: Math.max(0, Number(x.w) || 0), r: Math.round(x.r) })), id };
      }),
    })).filter(s => s.items.length);
    if (!sessions.length) toast(t('A IA não encontrou séries no texto.'), 5000);
    else draft = { sessions };
  } catch (e) {
    toast(e.message, 6000);
  }
  busy = false;
  rerender();
  window.scrollTo(0, 0);
};

actions.impBack = () => { draft = null; rerender(); };
actions.impDel = el => { cur(el).items.splice(Number(el.dataset.i), 1); draft.sessions = draft.sessions.filter(s => s.items.length); if (!draft.sessions.length) draft = null; rerender(); };
changes.impDate = el => { cur(el).date = el.value ? new Date(`${el.value}T12:00:00`).toISOString() : null; };
changes.impName = el => { cur(el).name = el.value.trim() || null; };
changes.impEx = el => { itemOf(el).id = el.value || null; rerender(); };
changes.impGroup = el => { itemOf(el).group = el.value; };
changes.impSets = el => {
  // aceita "40x12 40x10", "40kg 12 rep", "12" (peso corporal), separados por espaço, vírgula ou ponto e vírgula
  const parts = el.value.split(/[;,]|\s+(?=\d+(?:[.,]\d+)?\s*(?:x|kg))/i).map(p => p.trim()).filter(Boolean);
  const sets = [];
  for (const p of parts) {
    const s = setsOfLine(p);
    if (s.length) sets.push(...s);
    else if (/^\d{1,3}$/.test(p)) sets.push({ w: 0, r: Number(p) });
  }
  itemOf(el).sets = sets;
  // sem redesenhar a tela, para não fechar o teclado enquanto a pessoa digita
  const info = el.nextElementSibling;
  if (info) info.textContent = tn(sets.length, '{n} série', '{n} séries');
};

actions.impSave = () => {
  const mkRoutine = $('#impRoutine')?.checked;
  const created = {};
  let nSessions = 0;
  for (const s of draft.sessions) {
    const entries = [];
    for (const it of s.items) {
      if (!it.sets.length) continue;
      let ex = it.id && (state.exercises[it.id] || ensureExercise(it.id));
      if (!ex) {
        // exercício que não está na biblioteca: cria um personalizado (o mesmo nome reaproveita)
        const key = `${(it.raw || '').toLowerCase()}|${it.group}`;
        ex = created[key];
        if (!ex) {
          const reps = it.sets.map(x => x.r);
          const repMin = Math.max(1, Math.min(...reps)), repMax = Math.max(repMin, Math.max(...reps));
          ex = { id: uid(), name: (it.raw || t('Exercício')).slice(0, 50), group: it.group || GROUPS[0], sets: Math.min(6, it.sets.length), repMin, repMax, step: 2.5, bw: it.sets.every(x => !x.w) };
          state.exercises[ex.id] = created[key] = ex;
        }
      }
      if (it.rest && !ex.rest) ex.rest = it.rest;
      const same = entries.find(e => e.exId === ex.id);
      if (same) same.sets.push(...it.sets);
      else entries.push({ exId: ex.id, sets: it.sets.map(x => ({ w: x.w, r: x.r })), feel: null, flags: [], skipped: false });
    }
    if (!entries.length) continue;
    const name = s.name || 'Treino importado';
    state.sessions.push({ id: uid(), date: s.date || new Date().toISOString(), name, tpl: !s.name, imported: true, entries });
    nSessions++;
    if (mkRoutine) {
      const r = state.routines.find(x => x.name === name);
      if (r) entries.forEach(e => { if (!r.ex.includes(e.exId)) r.ex.push(e.exId); });
      else state.routines.push({ id: uid(), name, tpl: !s.name, ex: entries.map(e => e.exId) });
    }
  }
  state.sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  state.onboarded = true;
  defaultGroupGoals();
  save();
  draft = null; text = '';
  toast(tn(nSessions, '{n} treino importado. A próxima carga já considera esses dados.', '{n} treinos importados. A próxima carga já considera esses dados.'), 5000);
  go('#/hoje');
};

route('importar', render, { tab: 'ajustes' });
