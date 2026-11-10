// Treinos (rotinas), exercícios e a tela de execução ideal de cada exercício.
import { state, save, uid } from '../store.js';
import { $, esc, kg, setStr, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, meter } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { GROUPS, LIB, LIB_BY_ID } from '../data.js';
import { planFor, exGoalStatus, entriesFor } from '../logic.js';
import { ensureExercise, defaultGroupGoals, planStr } from './home.js';
import { exerciseProgress } from './progress.js';
import { aiEnabled, aiAskExecution, aiCuesFor } from '../ai.js';

// ---------- Treinos ----------

function renderRoutines() {
  if (!state.onboarded) { go('#/inicio'); return; }
  const all = Object.values(state.exercises)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name));
  $('#view').innerHTML = `
    <div class="head"><h1>Treinos</h1></div>
    <div class="stack">
      ${state.routines.map((r, ri) => `<div class="card flat">
        <div class="row" style="padding:12px 8px 4px 16px">
          <h2 class="grow">${esc(r.name)}</h2>
          <button class="icon-btn" data-act="editRoutine" data-id="${r.id}" aria-label="Renomear ou excluir ${esc(r.name)}">${icon.edit}</button>
        </div>
        <div class="list">${r.ex.map((id, i) => {
          const ex = state.exercises[id];
          if (!ex) return '';
          return `<div class="item">
            <a class="grow" href="#/exercicio/${encodeURIComponent(id)}" style="text-decoration:none">
              <span class="t">${esc(ex.name)}</span><br><span class="d">${esc(ex.group)} · ${ex.sets} × ${ex.repMin}–${ex.repMax}</span></a>
            <button class="icon-btn" data-act="moveEx" data-r="${ri}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(ex.name)}">${icon.up}</button>
            <button class="icon-btn" data-act="removeEx" data-r="${ri}" data-i="${i}" aria-label="Tirar ${esc(ex.name)} do treino">${icon.x}</button>
          </div>`;
        }).join('')}</div>
        <div style="padding:8px 12px 12px"><button class="btn block" data-act="pickEx" data-r="${ri}">${icon.plus}Adicionar exercício</button></div>
      </div>`).join('')}
      <button class="btn primary block" data-act="newRoutine">${icon.plus}Novo treino</button>

      ${all.length ? `<h3 class="group-title">Todos os exercícios</h3>
      <div class="card flat"><div class="list">${all.map(ex => `<a class="item" href="#/exercicio/${encodeURIComponent(ex.id)}">
        <span class="grow"><span class="t">${esc(ex.name)}</span><br><span class="d">${esc(ex.group)} · próxima: ${planStr(planFor(ex))}</span></span>${icon.next}</a>`).join('')}</div></div>` : ''}
    </div>`;
}

actions.newRoutine = () => {
  sheet(`<h2>Novo treino</h2>
    <form class="stack" data-submit="saveRoutine">
      <label class="field">Nome<input type="text" name="name" required maxlength="40" placeholder="Ex.: Treino D · Braços" autocomplete="off"></label>
      <button class="btn primary big">Criar</button>
    </form>`);
};
actions.editRoutine = el => {
  const r = state.routines.find(x => x.id === el.dataset.id);
  sheet(`<h2>Editar treino</h2>
    <form class="stack" data-submit="saveRoutine" data-id="${r.id}">
      <label class="field">Nome<input type="text" name="name" required maxlength="40" value="${esc(r.name)}" autocomplete="off"></label>
      <button class="btn primary big">Salvar</button>
      <button type="button" class="btn ghost danger block" data-act="delRoutineAsk" data-id="${r.id}">Excluir treino</button>
    </form>`);
};
submits.saveRoutine = form => {
  const name = form.name.value.trim();
  if (!name) return;
  const r = state.routines.find(x => x.id === form.dataset.id);
  if (r) r.name = name; else state.routines.push({ id: uid(), name, ex: [] });
  save(); closeSheet(); rerender();
};
actions.delRoutineAsk = el => {
  const r = state.routines.find(x => x.id === el.dataset.id);
  sheet(`<h2>Excluir "${esc(r.name)}"?</h2><p class="muted">Os exercícios e o histórico continuam salvos. Só o treino sai da rotação.</p>
    <button class="btn danger block" data-act="delRoutine" data-id="${r.id}">Excluir treino</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
actions.delRoutine = el => {
  state.routines = state.routines.filter(x => x.id !== el.dataset.id);
  state.next = 0;
  save(); closeSheet(); rerender();
};
actions.moveEx = el => {
  const r = state.routines[Number(el.dataset.r)], i = Number(el.dataset.i);
  if (i > 0) { [r.ex[i - 1], r.ex[i]] = [r.ex[i], r.ex[i - 1]]; save(); rerender(); }
};
actions.removeEx = el => {
  state.routines[Number(el.dataset.r)].ex.splice(Number(el.dataset.i), 1);
  save(); rerender();
};

// ---------- Escolher exercício ----------

let pickRoutine = 0;

function pickerList(q = '') {
  const r = state.routines[pickRoutine];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);
  const custom = Object.values(state.exercises).filter(e => !e.lib);
  const pool = [...LIB.map(l => ({ id: l.id, name: l.name, group: l.group })), ...custom.map(e => ({ id: e.id, name: e.name, group: e.group }))]
    .filter(e => !r.ex.includes(e.id) && (!nq || norm(e.name).includes(nq) || norm(e.group).includes(nq)));
  return GROUPS.map(g => {
    const items = pool.filter(e => e.group === g);
    if (!items.length) return '';
    return `<h3 class="group-title">${esc(g)}</h3><div class="card flat"><div class="list">
      ${items.map(e => `<button class="item" data-act="addEx" data-id="${esc(e.id)}"><span class="grow t">${esc(e.name)}</span>${icon.plus}</button>`).join('')}
    </div></div>`;
  }).join('') || '<p class="empty">Nada encontrado. Crie um exercício personalizado abaixo.</p>';
}

actions.pickEx = el => {
  pickRoutine = Number(el.dataset.r);
  sheet(`<h2>Adicionar a ${esc(state.routines[pickRoutine].name)}</h2>
    <input type="search" placeholder="Buscar exercício ou grupamento" data-change="pickFilter" aria-label="Buscar exercício" autocomplete="off">
    <div id="pickList">${pickerList()}</div>
    <button class="btn block" data-act="newExercise">${icon.plus}Criar exercício personalizado</button>`);
};
changes.pickFilter = el => { $('#pickList').innerHTML = pickerList(el.value); };
actions.addEx = el => {
  const id = el.dataset.id;
  const ex = state.exercises[id] || ensureExercise(id);
  if (!ex) return;
  state.routines[pickRoutine].ex.push(id);
  defaultGroupGoals();
  save();
  toast(`${ex.name} adicionado.`);
  el.remove();
  rerender();
};

function exerciseForm(ex) {
  const e = ex || { name: '', group: GROUPS[0], sets: 3, repMin: 8, repMax: 12, step: 2.5 };
  return `<form class="stack" data-submit="saveExercise" data-id="${esc(ex?.id || '')}">
    <label class="field">Nome<input type="text" name="name" required maxlength="50" value="${esc(e.name)}" autocomplete="off"></label>
    <label class="field">Grupamento<select name="group">${GROUPS.map(g => `<option${g === e.group ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
    <div class="two">
      ${stepper('sets', e.sets, 1, 'Séries', 1)}
      ${stepper('step', e.step, 0.5, 'Aumento (kg)')}
    </div>
    <div class="two">
      ${stepper('repMin', e.repMin, 1, 'Reps mínimas', 1)}
      ${stepper('repMax', e.repMax, 1, 'Reps máximas', 1)}
    </div>
    <p class="small muted">Quando você bate as reps máximas em todas as séries, o app sugere subir a carga pelo valor de aumento.</p>
    <button class="btn primary big">${ex ? 'Salvar' : 'Criar exercício'}</button>
  </form>`;
}
actions.newExercise = () => sheet(`<h2>Novo exercício</h2>${exerciseForm(null)}`);
actions.editExercise = el => sheet(`<h2>Configurar exercício</h2>${exerciseForm(state.exercises[el.dataset.id])}`);
submits.saveExercise = form => {
  const name = form.name.value.trim();
  if (!name) return;
  const n = k => Number(form[k].value) || 0;
  const repMin = Math.max(1, Math.round(n('repMin')));
  const data = {
    name, group: form.group.value, sets: Math.max(1, Math.round(n('sets'))),
    repMin, repMax: Math.max(repMin, Math.round(n('repMax'))), step: Math.max(0, n('step')),
  };
  let ex = state.exercises[form.dataset.id];
  if (ex) Object.assign(ex, data);
  else {
    ex = { id: uid(), ...data };
    state.exercises[ex.id] = ex;
    state.routines[pickRoutine]?.ex.push(ex.id);
  }
  defaultGroupGoals();
  save(); closeSheet(); rerender();
};

// ---------- Tela do exercício ----------

let aiAnswer = { id: null, text: '' };

function renderExercise(id) {
  const ex = state.exercises[id];
  if (!ex) { go('#/exercicios'); return; }
  const c = LIB_BY_ID[ex.lib] || ex.cues;
  const p = planFor(ex);
  const st = exGoalStatus(ex);
  const prog = exerciseProgress(ex);
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} execução correta`)}`;

  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="histBack" aria-label="Voltar">${icon.back}</button>
      <span class="title">${esc(ex.group)}</span>
      <button class="icon-btn" data-act="editExercise" data-id="${esc(ex.id)}" aria-label="Configurar exercício">${icon.edit}</button>
    </div>
    <h1>${esc(ex.name)}</h1>
    <p class="muted" style="margin-bottom:16px">${ex.sets} × ${ex.repMin}–${ex.repMax} reps · aumento de ${kg(ex.step).replace('peso corporal', '0 kg')}</p>
    <div class="stack">
      <div class="target" style="margin:0">
        <h3>Próximo treino</h3>
        <div class="big num">${planStr(p)}</div>
        <div class="note">${esc(p.note)}</div>
      </div>

      ${st && !st.expired ? `<a class="card" href="#/metas" style="text-decoration:none">
        <div class="goal-row"><div class="top"><b>Meta da semana</b><span class="num">${setStr(st.weekSet)}</span></div>${meter(st.weekPct, st.weekDone)}</div>
        <div class="goal-row"><div class="top"><b>Meta do mês</b><span class="num">${setStr(st.goal)}</span></div>${meter(st.monthPct, st.monthDone)}</div>
      </a>` : `<button class="btn block" data-act="editExGoal" data-id="${esc(ex.id)}">${icon.target}Definir meta do mês</button>`}

      <div class="card stack">
        <h3>Execução ideal</h3>
        ${c ? `<ol class="steps">${c.how.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <h3>Erros comuns</h3><ul class="errs">${c.errs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          ${c.tip ? `<p class="tip">${esc(c.tip)}</p>` : ''}`
        : `<p class="muted">Exercício personalizado, ainda sem orientações.</p>
          ${aiEnabled() ? `<button class="btn block" data-act="genCues" data-id="${esc(ex.id)}">${icon.spark}Gerar orientações com a IA</button>` : ''}`}
        <a class="btn block" href="${video}" target="_blank" rel="noopener">Ver vídeos da execução</a>
      </div>

      ${aiEnabled() ? `<div class="card stack">
        <h3>Pergunte ao treinador IA</h3>
        ${aiAnswer.id === ex.id && aiAnswer.text ? `<p class="ai-text">${esc(aiAnswer.text)}</p>` : ''}
        <form class="stack" data-submit="askAI" data-id="${esc(ex.id)}">
          <textarea name="q" required maxlength="400" placeholder="Ex.: sinto mais o ombro do que o peito, o que ajustar?" aria-label="Sua dúvida"></textarea>
          <button class="btn block">${icon.spark}Perguntar</button>
        </form>
      </div>` : ''}

      <div class="card stack"><h3>Evolução</h3>${prog.html}</div>

      <button class="btn ghost danger block" data-act="delExerciseAsk" data-id="${esc(ex.id)}">${icon.trash}Excluir exercício</button>
    </div>`;
  prog.mount();
}

const cuesText = c => (c ? `Execução: ${c.how.join(' ')}\nErros comuns: ${c.errs.join(' ')}` : '');

submits.askAI = async form => {
  const ex = state.exercises[form.dataset.id];
  const q = form.q.value.trim();
  if (!q) return;
  const btn = $('button', form);
  btn.disabled = true;
  btn.textContent = 'Pensando…';
  try {
    aiAnswer = { id: ex.id, text: await aiAskExecution(ex.name, cuesText(LIB_BY_ID[ex.lib] || ex.cues), q) };
  } catch (e) {
    toast(e.message, 5000);
  }
  rerender();
};
actions.genCues = async el => {
  const ex = state.exercises[el.dataset.id];
  el.disabled = true;
  el.textContent = 'Gerando…';
  try {
    const c = await aiCuesFor(ex.name, ex.group);
    if (Array.isArray(c.how) && Array.isArray(c.errs)) { ex.cues = { how: c.how, errs: c.errs, tip: c.tip || '' }; save(); }
  } catch (e) {
    toast(e.message, 5000);
  }
  rerender();
};
actions.histBack = () => (history.length > 1 ? history.back() : go('#/exercicios'));
actions.delExerciseAsk = el => {
  const ex = state.exercises[el.dataset.id];
  const n = entriesFor(ex.id).length;
  sheet(`<h2>Excluir "${esc(ex.name)}"?</h2>
    <p class="muted">Ele sai de todos os treinos${n ? ` e os ${n} registro${n > 1 ? 's' : ''} dele deixam de aparecer nas metas e nos gráficos` : ''}. Esta ação não pode ser desfeita.</p>
    <button class="btn danger block" data-act="delExercise" data-id="${esc(ex.id)}">Excluir exercício</button>
    <button class="btn block" data-act="closeSheet">Cancelar</button>`);
};
actions.delExercise = el => {
  const id = el.dataset.id;
  delete state.exercises[id];
  delete state.goals.ex[id];
  for (const r of state.routines) r.ex = r.ex.filter(x => x !== id);
  save(); closeSheet(); go('#/exercicios');
};

route('exercicios', renderRoutines);
route('exercicio', renderExercise, { tab: 'exercicios' });
