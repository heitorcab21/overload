// Treinos (rotinas), exercícios e a tela de execução ideal de cada exercício.
import { state, save, uid } from '../store.js';
import { $, esc, kg, fmt, fmtDate, setStr, icon, actions, changes, submits, toast, sheet, closeSheet, stepper, meter } from '../ui.js';
import { route, go, rerender } from '../router.js';
import { BODY_PARTS as BODY_PARTS_DATA, supGroups, TEMPLATES, exPhotos, GROUPS, LIB, exName, exCues, tg, loadHint, loadShort, routineName } from '../data.js';
import { t, tn, exPack } from '../i18n.js';
import { planFor, exGoalStatus, entriesFor, defaultGroupGoals } from '../logic.js';
import { ensureExercise, planStr } from './home.js';
import { exerciseProgress, groupWord } from './progress.js';
import { strengthLevel, profile, oneRepMax } from '../body.js';
import { aiEnabled, aiAskExecution, aiCuesFor } from '../ai.js';

// ---------- Treinos ----------

const BODY_PARTS = () => BODY_PARTS_DATA.map(([k, g]) => [t(k), g]);

function renderRoutines() {
  if (!state.onboarded) { go('#/inicio'); return; }
  const all = Object.values(state.exercises)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));
  $('#view').innerHTML = `
    <div class="head"><h1>${t('Treinos')}</h1></div>
    <div class="stack">
      <div class="two top-acts">
        <button class="btn accent-soft" data-act="addTemplate">${icon.list}${t('Adicionar treino pronto')}</button>
        <a class="btn accent-soft" href="#/importar">${icon.edit}${t('Importar do bloco de notas')}</a>
      </div>
      ${state.routines.map((r, ri) => `<div class="card flat">
        <div class="row" style="padding:12px 8px 4px 16px">
          <h2 class="grow">${esc(routineName(r))}</h2>
          <button class="icon-btn" data-act="editRoutine" data-id="${r.id}" aria-label="${t('Renomear ou excluir {x}', { x: esc(routineName(r)) })}">${icon.edit}</button>
        </div>
        <div class="list">${r.ex.map((id, i) => {
          const ex = state.exercises[id];
          if (!ex) return '';
          const grp = supGroups(r).find(g => g.includes(id));
          const pos = grp ? grp.indexOf(id) : -1;
          const tag = grp ? `<b class="sup-label">${grp.length === 3 ? t('Tri-set') : t('Bi-set')}</b> · ` : '';
          return `<div class="item${grp ? ` in-sup${pos === 0 ? ' sup-first' : ''}${pos === grp.length - 1 ? ' sup-last' : ''}` : ''}">
            <a class="grow" href="#/exercicio/${encodeURIComponent(id)}" style="text-decoration:none">
              <span class="t">${esc(exName(ex))}</span><br><span class="d">${tag}${esc(tg(ex.group))} · ${ex.sets} × ${ex.repMin}–${ex.repMax}</span></a>
            ${i < r.ex.length - 1 ? `<button class="icon-btn link-btn${r.link?.[id] ? ' on' : ''}" data-act="toggleLink" data-r="${ri}" data-i="${i}" aria-pressed="${!!r.link?.[id]}" aria-label="${t('Juntar com o próximo em bi-set')}">${icon.link}</button>` : '<span class="icon-btn-space"></span>'}
            <button class="icon-btn" data-act="moveEx" data-r="${ri}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${t('Subir {x}', { x: esc(exName(ex)) })}">${icon.up}</button>
            <button class="icon-btn" data-act="removeEx" data-r="${ri}" data-i="${i}" aria-label="${t('Tirar {x} do treino', { x: esc(exName(ex)) })}">${icon.x}</button>
          </div>`;
        }).join('')}</div>
        <div style="padding:8px 12px 12px"><button class="btn block" data-act="pickEx" data-r="${ri}">${icon.plus}${t('Adicionar exercício')}</button></div>
      </div>`).join('')}
      <button class="btn primary block" data-act="newRoutine">${icon.plus}${t('Novo treino')}</button>
      ${state.routines.length ? `<button class="btn block" data-act="planSaveAsk">${icon.download}${t('Salvar meus treinos')}</button>` : ''}
      ${noHistory().length ? `<a class="btn block" href="#/cargas">${t('Definir cargas iniciais')}</a>` : ''}

      ${all.length ? `<h3 class="group-title">${t('Todos os exercícios')}</h3>
      ${BODY_PARTS().map(([label, groups]) => {
        if (!all.some(ex => groups.includes(ex.group))) return '';
        return `<section class="part-card"><h3 class="part-title">${esc(label)}</h3>${groups.map(g => {
          const list = all.filter(ex => ex.group === g);
          return list.length ? `<p class="muscle-title">${esc(tg(g))}</p>
      <div class="card flat"><div class="list">${list.map(ex => `<a class="item" href="#/exercicio/${encodeURIComponent(ex.id)}">
        <span class="grow"><span class="t">${esc(exName(ex))}</span><br><span class="d">${t('próxima')}: ${planStr(planFor(ex), ex)}</span></span>${icon.next}</a>`).join('')}</div></div>` : '';
        }).join('')}</section>`;
      }).join('')}` : ''}
    </div>`;
}

actions.toggleLink = el => {
  const r = state.routines[Number(el.dataset.r)];
  const id = r.ex[Number(el.dataset.i)];
  r.link ??= {};
  if (r.link[id]) { delete r.link[id]; save(); rerender(); return; }
  r.link[id] = true;
  // no máximo 3 exercícios seguidos (tri-set)
  if (supGroups(r).some(g => g.length > 3)) { delete r.link[id]; toast(t('Máximo de 3 exercícios juntos (tri-set).'), 3500); return; }
  save(); rerender();
  const g = supGroups(r).find(x => x.includes(id));
  toast(g.length === 3 ? t('Tri-set criado: os 3 exercícios são feitos em sequência, sem descanso entre eles.') : t('Bi-set criado: os 2 exercícios são feitos em sequência, sem descanso entre eles.'), 4000);
};

// ---------- Treinos prontos e treinos salvos: adicionar ou substituir, sempre com confirmação ----------

const plans = () => (state.savedPlans ??= []);
const snapshot = () => state.routines.map(({ name, tpl, ex, link }) => ({ name, tpl: !!tpl, ex: ex.slice(), ...(link ? { link: { ...link } } : {}) }));

/** Guarda os treinos atuais como um conjunto salvo (para restaurar depois com um toque). */
function savePlan(name) {
  if (!state.routines.length) return null;
  const p = { id: uid(), name: name.slice(0, 40), date: new Date().toISOString(), routines: snapshot() };
  plans().unshift(p);
  state.savedPlans = plans().slice(0, 20);
  return p;
}

actions.addTemplate = () => {
  const saved = plans();
  sheet(`<h2>${t('Treinos prontos e salvos')}</h2>
    ${saved.length ? `<h3>${t('Meus treinos salvos')}</h3>
      <div class="card flat"><div class="list">${saved.map(p => `<div class="item">
        <button class="grow plain" data-act="planPick" data-kind="saved" data-id="${p.id}"><span class="t">${esc(p.name)}</span><br>
          <span class="d">${esc(p.routines.map(r => routineName(r)).join(' · '))}</span></button>
        <button class="icon-btn" data-act="planDelAsk" data-id="${p.id}" aria-label="${t('Excluir')}">${icon.trash}</button></div>`).join('')}</div></div>` : ''}
    <h3>${t('Treinos prontos')}</h3>
    <div class="card flat"><div class="list">${TEMPLATES.map(tp => `<button class="item" data-act="planPick" data-kind="tpl" data-id="${tp.id}">
      <span class="grow"><span class="t">${esc(t(tp.name))}</span><br><span class="d">${esc(t(tp.desc))}</span></span>${icon.next}</button>`).join('')}</div></div>`);
};

function planOf(kind, id) {
  if (kind === 'saved') {
    const p = plans().find(x => x.id === id);
    return p && { name: p.name, routines: p.routines.map(r => ({ ...r, ex: r.ex.filter(e => state.exercises[e] || LIB.some(l => l.id === e)) })) };
  }
  const tp = TEMPLATES.find(x => x.id === id);
  return tp && { name: t(tp.name), routines: tp.routines.map(([name, ex]) => ({ name, tpl: true, ex })) };
}

actions.planPick = el => {
  const p = planOf(el.dataset.kind, el.dataset.id);
  if (!p) return;
  const has = state.routines.length;
  sheet(`<h2>${esc(p.name)}</h2>
    <div class="card flat"><div class="list">${p.routines.map(r => `<div class="item"><span class="grow"><span class="t">${esc(routineName(r))}</span><br>
      <span class="d">${tn(r.ex.length, '{n} exercício', '{n} exercícios')}</span></span></div>`).join('')}</div></div>
    ${has ? `<p class="small muted">${t('Você já tem {n} na sua lista. Escolha como usar este:', { n: tn(state.routines.length, '{n} treino', '{n} treinos') })}</p>` : ''}
    <button class="btn primary block" data-act="planApply" data-kind="${el.dataset.kind}" data-id="${el.dataset.id}" data-mode="add">${icon.plus}${has ? t('Adicionar aos meus treinos') : t('Usar estes treinos')}</button>
    ${has ? `<button class="btn danger-soft block" data-act="planApply" data-kind="${el.dataset.kind}" data-id="${el.dataset.id}" data-mode="replace">${icon.sync}${t('Substituir meus treinos')}</button>
      <p class="small muted">${t('Ao substituir, seus treinos atuais são guardados em "Meus treinos salvos", para você voltar a eles quando quiser. O histórico não muda.')}</p>` : ''}
    <button class="btn block" data-act="addTemplate">${t('Voltar')}</button>`);
};

actions.planApply = el => {
  const p = planOf(el.dataset.kind, el.dataset.id);
  if (!p) return;
  if (el.dataset.mode === 'replace' && state.routines.length) {
    savePlan(t('Antes da troca · {d}', { d: new Date().toLocaleDateString() }));
    state.routines = [];
    state.next = 0;
  }
  for (const r of p.routines) {
    r.ex.forEach(id => { if (!state.exercises[id]) ensureExercise(id); });
    const ex = r.ex.filter(id => state.exercises[id]);
    if (!ex.length) continue;
    state.routines.push({ id: uid(), name: r.name, tpl: !!r.tpl, ex, ...(r.link ? { link: { ...r.link } } : {}) });
  }
  defaultGroupGoals();
  save(); closeSheet(); rerender();
  toast(el.dataset.mode === 'replace' ? t('Treinos substituídos. Os anteriores estão em "Meus treinos salvos".') : tn(p.routines.length, '{n} treino adicionado.', '{n} treinos adicionados.'), 4500);
};

actions.planSaveAsk = () => {
  if (!state.routines.length) { toast(t('Crie ou adicione treinos primeiro.')); return; }
  sheet(`<h2>${t('Salvar meus treinos')}</h2>
    <p class="muted small">${t('Guarda todos os seus treinos atuais ({x}) para você restaurar com um toque depois, mesmo que troque de ficha.', { x: state.routines.map(r => routineName(r)).join(', ') })}</p>
    <form class="stack" data-submit="planSave">
      <label class="field">${t('Nome')}<input type="text" name="name" required maxlength="40" value="${esc(t('Meus treinos · {d}', { d: new Date().toLocaleDateString() }))}"></label>
      <button class="btn primary big">${t('Salvar')}</button>
    </form>`);
};
submits.planSave = form => {
  const p = savePlan(form.name.value.trim() || t('Meus treinos'));
  save(); closeSheet();
  if (p) toast(t('Salvo em "Meus treinos salvos". Para restaurar: Adicionar treino pronto.'), 4500);
};
actions.planDelAsk = el => {
  const p = plans().find(x => x.id === el.dataset.id);
  sheet(`<h2>${t('Excluir "{x}"?', { x: esc(p?.name || '') })}</h2>
    <p class="muted">${t('Só o conjunto salvo é apagado. Seus treinos atuais e o histórico não mudam.')}</p>
    <button class="btn danger block" data-act="planDel" data-id="${el.dataset.id}">${t('Excluir')}</button>
    <button class="btn block" data-act="addTemplate">${t('Cancelar')}</button>`);
};
actions.planDel = el => {
  state.savedPlans = plans().filter(x => x.id !== el.dataset.id);
  save(); actions.addTemplate();
};

actions.newRoutine = () => {
  sheet(`<h2>${t('Novo treino')}</h2>
    <form class="stack" data-submit="saveRoutine">
      <label class="field">${t('Nome')}<input type="text" name="name" required maxlength="40" placeholder="${t('Ex.: Treino D · Braços')}" autocomplete="off"></label>
      <button class="btn primary big">${t('Criar')}</button>
    </form>`);
};
actions.editRoutine = el => {
  const r = state.routines.find(x => x.id === el.dataset.id);
  sheet(`<h2>${t('Editar treino')}</h2>
    <form class="stack" data-submit="saveRoutine" data-id="${r.id}">
      <label class="field">${t('Nome')}<input type="text" name="name" required maxlength="40" value="${esc(routineName(r))}" autocomplete="off"></label>
      <button class="btn primary big">${t('Salvar')}</button>
      <button type="button" class="btn ghost danger block" data-act="delRoutineAsk" data-id="${r.id}">${t('Excluir treino')}</button>
    </form>`);
};
submits.saveRoutine = form => {
  const name = form.name.value.trim();
  if (!name) return;
  const r = state.routines.find(x => x.id === form.dataset.id);
  // renomeou: o nome passa a ser seu e não muda mais com o idioma
  if (r) { if (name !== routineName(r)) { r.name = name; r.tpl = false; } } else state.routines.push({ id: uid(), name, tpl: false, ex: [] });
  save(); closeSheet(); rerender();
};
actions.delRoutineAsk = el => {
  const r = state.routines.find(x => x.id === el.dataset.id);
  sheet(`<h2>${t('Excluir "{x}"?', { x: esc(routineName(r)) })}</h2><p class="muted">${t('Os exercícios e o histórico continuam salvos. Só o treino sai da rotação.')}</p>
    <button class="btn danger block" data-act="delRoutine" data-id="${r.id}">${t('Excluir treino')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
actions.delRoutine = el => {
  state.routines = state.routines.filter(x => x.id !== el.dataset.id);
  state.next = 0;
  defaultGroupGoals();
  save(); closeSheet(); rerender();
};
actions.moveEx = el => {
  const r = state.routines[Number(el.dataset.r)], i = Number(el.dataset.i);
  if (i > 0) { [r.ex[i - 1], r.ex[i]] = [r.ex[i], r.ex[i - 1]]; save(); rerender(); }
};
actions.removeEx = el => {
  const r = state.routines[Number(el.dataset.r)];
  const [gone] = r.ex.splice(Number(el.dataset.i), 1);
  if (r.link) delete r.link[gone];
  defaultGroupGoals();
  save(); rerender();
};

// ---------- Escolher exercício ----------

let pickRoutine = 0;

function pickerList(q = '') {
  const r = state.routines[pickRoutine];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);
  const custom = Object.values(state.exercises).filter(e => !e.lib);
  const pool = [...LIB.map(l => ({ id: l.id, name: exPack(l.id)?.name ?? l.name, group: l.group })), ...custom.map(e => ({ id: e.id, name: e.name, group: e.group }))]
    .filter(e => !r.ex.includes(e.id) && (!nq || norm(e.name).includes(nq) || norm(tg(e.group)).includes(nq)));
  return GROUPS.map(g => {
    const items = pool.filter(e => e.group === g);
    if (!items.length) return '';
    return `<h3 class="group-title">${esc(tg(g))}</h3><div class="card flat"><div class="list">
      ${items.map(e => `<button class="item" data-act="addEx" data-id="${esc(e.id)}"><span class="grow t">${esc(e.name)}</span>${icon.plus}</button>`).join('')}
    </div></div>`;
  }).join('') || `<p class="empty">${t('Nada encontrado. Crie um exercício personalizado abaixo.')}</p>`;
}

actions.pickEx = el => {
  pickRoutine = Number(el.dataset.r);
  sheet(`<h2>${t('Adicionar a {x}', { x: esc(routineName(state.routines[pickRoutine])) })}</h2>
    <input type="search" placeholder="${t('Buscar exercício ou grupamento')}" data-change="pickFilter" aria-label="${t('Buscar exercício')}" autocomplete="off">
    <div id="pickList">${pickerList()}</div>
    <button class="btn block" data-act="newExercise">${icon.plus}${t('Criar exercício personalizado')}</button>`);
};
changes.pickFilter = el => { $('#pickList').innerHTML = pickerList(el.value); };
actions.addEx = el => {
  const id = el.dataset.id;
  const ex = state.exercises[id] || ensureExercise(id);
  if (!ex) return;
  state.routines[pickRoutine].ex.push(id);
  defaultGroupGoals();
  save();
  toast(t('{x} adicionado.', { x: exName(ex) }));
  el.remove();
  rerender();
};

function exerciseForm(ex) {
  const e = ex || { name: '', group: GROUPS[0], sets: 3, repMin: 8, repMax: 12, step: 2.5 };
  return `<form class="stack" data-submit="saveExercise" data-id="${esc(ex?.id || '')}">
    <label class="field">${t('Nome')}<input type="text" name="name" required maxlength="50" value="${esc(ex ? exName(ex) : e.name)}" autocomplete="off"></label>
    <label class="field">${t('Grupamento')}<select name="group">${GROUPS.map(g => `<option value="${esc(g)}"${g === e.group ? ' selected' : ''}>${esc(tg(g))}</option>`).join('')}</select></label>
    <div class="two">
      ${stepper('sets', e.sets, 1, t('Séries'), 1)}
      ${stepper('step', e.step, 0.5, t('Aumento (kg)'))}
    </div>
    <div class="two">
      ${stepper('repMin', e.repMin, 1, t('Reps mínimas'), 1)}
      ${stepper('repMax', e.repMax, 1, t('Reps máximas'), 1)}
    </div>
    <p class="small muted">${t('Quando você bate as reps máximas em todas as séries, o app sugere subir a carga pelo valor de aumento.')}</p>
    ${stepper('rest', e.rest || 0, 15, t('Descanso (segundos)'), 0)}
    <p class="small muted">${t('0 usa o descanso padrão dos Ajustes ({s} s).', { s: state.settings.rest })}</p>
    <button class="btn primary big">${ex ? t('Salvar') : t('Criar exercício')}</button>
  </form>`;
}
actions.newExercise = () => sheet(`<h2>${t('Novo exercício')}</h2>${exerciseForm(null)}`);
actions.editExercise = el => sheet(`<h2>${t('Configurar exercício')}</h2>${exerciseForm(state.exercises[el.dataset.id])}`);
submits.saveExercise = form => {
  const name = form.name.value.trim();
  if (!name) return;
  const n = k => Number(form[k].value) || 0;
  const repMin = Math.max(1, Math.round(n('repMin')));
  const data = {
    name, group: form.group.value, sets: Math.max(1, Math.round(n('sets'))),
    repMin, repMax: Math.max(repMin, Math.round(n('repMax'))), step: Math.max(0, n('step')),
    rest: Math.max(0, Math.round(n('rest'))),
  };
  let ex = state.exercises[form.dataset.id];
  // nome de exercício da biblioteca não mudou: mantém o original (assim ele segue o idioma escolhido)
  if (ex && name === exName(ex)) data.name = ex.name;
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
  const c = exCues(ex);
  const p = planFor(ex);
  const st = exGoalStatus(ex);
  const prog = exerciseProgress(ex);
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(t('{x} execução correta', { x: exName(ex) }))}`;

  $('#view').innerHTML = `
    <div class="w-top">
      <button class="icon-btn" data-act="histBack" aria-label="${t('Voltar')}">${icon.back}</button>
      <span class="title">${esc(tg(ex.group))}</span>
      <button class="icon-btn" data-act="editExercise" data-id="${esc(ex.id)}" aria-label="${t('Configurar exercício')}">${icon.edit}</button>
    </div>
    <h1>${esc(exName(ex))}</h1>
    <p class="muted" style="margin-bottom:16px">${ex.sets} × ${ex.repMin}–${ex.repMax} reps · ${t('aumento de {w}', { w: ex.step > 0 ? kg(ex.step) : '0 kg' })}</p>
    <div class="stack">
      <div class="target" style="margin:0">
        <h3>${t('Próximo treino')}</h3>
        <div class="big num">${planStr(p, ex)}</div>
        <div class="note">${esc(p.note)}</div>
      </div>

      <div class="tip"><b>${t('Como anotar a carga')}:</b> ${esc(loadHint(ex))}</div>

      <button class="ex-note${ex.note ? '' : ' empty'}" data-act="editNote" data-id="${esc(ex.id)}">${icon.edit}<span>${ex.note ? esc(ex.note) : t('Adicionar anotação (ex.: banco na altura 4)')}</span></button>
      ${strengthCard(ex)}

      ${st && !st.expired ? `<a class="card" href="#/metas" style="text-decoration:none">
        <div class="goal-row"><div class="top"><b>${t('Meta da semana')}</b><span class="num">${setStr(st.weekSet)}</span></div>${meter(st.weekPct, st.weekDone)}</div>
        <div class="goal-row"><div class="top"><b>${t('Meta do mês')}</b><span class="num">${setStr(st.goal)}</span></div>${meter(st.monthPct, st.monthDone)}</div>
      </a>` : `<button class="btn block" data-act="editExGoal" data-id="${esc(ex.id)}">${icon.target}${t('Definir meta do mês')}</button>`}

      <div class="card stack">
        <h3>${t('Execução ideal')}</h3>
        ${exPhotos(ex)}
        ${c ? `<ol class="steps">${c.how.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <h3>${t('Erros comuns')}</h3><ul class="errs">${c.errs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          ${c.tip ? `<p class="tip">${esc(c.tip)}</p>` : ''}`
        : `<p class="muted">${t('Exercício personalizado, ainda sem orientações.')}</p>
          ${aiEnabled() ? `<button class="btn block" data-act="genCues" data-id="${esc(ex.id)}">${icon.spark}${t('Gerar orientações com a IA')}</button>` : ''}`}
        <a class="btn block" href="${video}" target="_blank" rel="noopener">${t('Ver vídeos da execução')}</a>
      </div>

      ${aiEnabled() ? `<div class="card stack">
        <h3>${t('Pergunte ao treinador IA')}</h3>
        ${aiAnswer.id === ex.id && aiAnswer.text ? `<p class="ai-text">${esc(aiAnswer.text)}</p>` : ''}
        <form class="stack" data-submit="askAI" data-id="${esc(ex.id)}">
          <textarea name="q" required maxlength="400" placeholder="${t('Ex.: sinto mais o ombro do que o peito, o que ajustar?')}" aria-label="${t('Sua dúvida')}"></textarea>
          <button class="btn block">${icon.spark}${t('Perguntar')}</button>
        </form>
      </div>` : ''}

      <div class="card stack"><h3>${t('Evolução')}</h3>${prog.html}</div>

      <button class="btn ghost danger block" data-act="delExerciseAsk" data-id="${esc(ex.id)}">${icon.trash}${t('Excluir exercício')}</button>
    </div>`;
  prog.mount();
}

function strengthCard(ex) {
  const lv = strengthLevel(ex);
  if (lv.reason === 'notComparable') return '';
  if (lv.reason === 'noProfile') {
    return `<a class="card stack" href="#/progresso" style="text-decoration:none"><h3>${t('Seu nível de força')}</h3>
      <p class="muted">${t('Preencha seu perfil (sexo, idade, altura e peso) na aba Progresso para ver em que top de força você está neste exercício.')}</p></a>`;
  }
  const testBtn = `<button class="btn block" data-act="strengthTest" data-id="${esc(ex.id)}">${icon.target}${t('Fazer teste de força')}</button>`;
  if (lv.reason === 'noData') {
    return `<div class="card stack"><h3>${t('Seu nível de força')}</h3><p class="muted">${t('Registre este exercício ou faça um teste de força para ver em que top de força você está.')}</p>${testBtn}</div>`;
  }
  const p = profile();
  const s = lv.src;
  const load = lv.bw ? (s.w ? t('peso corporal + {w} kg', { w: fmt(s.w) }) : t('peso corporal')) : `${fmt(s.w)} kg`;
  const setTxt = `${load} × ${s.r}${s.rir ? ` (${t('sobraram {n}', { n: s.rir >= 4 ? '4+' : s.rir })})` : ''}`;
  const reps = s.r + Math.min(4, s.rir || 0);
  const how = reps <= 1 ? t('Uma repetição máxima: o 1RM é a própria carga.')
    : t('Calculado pela fórmula de Epley: carga × (1 + reps ÷ 30).');
  return `<div class="card stack">
    <h3>${t('Seu nível de força')}</h3>
    <div class="row between"><span class="big-num">${t('Top {n}%', { n: lv.top })}</span><span class="small muted">${t('1RM estimado: {w} kg', { w: Math.round(lv.oneRM) })}</span></div>
    ${meter(lv.pct / 100)}
    <p class="small muted">${t('Entre {grupo} que treinam musculação, com {idade} anos e cerca de {peso} kg. Estimativa baseada em padrões de força de praticantes; não é um ranking oficial.', { grupo: groupWord(p), idade: p.age, peso: Math.round(p.weight) })}</p>
    <div class="src-box small">
      <b>${s.test ? t('Base: teste de força de {d}', { d: fmtDate(s.date, false) }) : t('Base: sua melhor série dos últimos 90 dias ({d})', { d: fmtDate(s.date, false) })}</b><br>
      ${esc(setTxt)}. ${how}${lv.bw ? ` ${t('Nos exercícios de peso corporal, seu peso entra na conta.')}` : ''}
      ${reps > 10 ? `<br><span class="warn-text">${t('Séries com mais de 10 reps dão uma estimativa menos precisa. Um teste de força deixa o número mais confiável.')}</span>` : ''}
    </div>
    ${testBtn}
  </div>`;
}

// ---------- Teste de força: uma série até não conseguir mais ----------

actions.strengthTest = el => {
  const ex = state.exercises[el.dataset.id];
  const last = entriesFor(ex.id).at(-1);
  const w0 = (ex.tests || []).at(-1)?.w ?? (last ? Math.max(...last.sets.map(s => s.w || 0)) : ex.startW || 0);
  const tests = (ex.tests || []).slice(-5).reverse();
  sheet(`<h2>${t('Teste de força')}</h2>
    <p class="muted small">${esc(exName(ex))}</p>
    <ol class="steps small">
      <li>${t('Aqueça com 2 ou 3 séries leves, aumentando a carga.')}</li>
      <li>${t('Escolha uma carga que você aguente entre 1 e 8 reps.')}</li>
      <li>${t('Faça uma única série até não conseguir mais nenhuma rep com boa execução. Use um parceiro ou travas de segurança.')}</li>
    </ol>
    <form class="stack" data-submit="saveStrengthTest" data-id="${esc(ex.id)}">
      <div class="two">
        ${stepper('w', w0, ex.step > 0 ? ex.step : 1, ex.bw ? t('Peso extra (kg)') : t('Carga total (kg)'))}
        ${stepper('r', 5, 1, t('Repetições'), 1)}
      </div>
      <p class="small muted">${esc(loadHint(ex))}</p>
      <p class="small muted">${t('Fez 1 rep máxima? Coloque 1: o app usa a carga como seu 1RM real. O teste não altera a progressão dos treinos.')}</p>
      <button class="btn primary big">${t('Salvar teste')}</button>
    </form>
    ${tests.length ? `<h3>${t('Testes anteriores')}</h3><div class="list">${tests.map(x => `<div class="item"><span class="grow">${fmtDate(x.date, false)} · ${ex.bw ? `+${fmt(x.w)}` : fmt(x.w)} kg × ${x.r}</span>
      <button class="icon-btn" data-act="delStrengthTest" data-id="${esc(ex.id)}" data-date="${esc(x.date)}" aria-label="${t('Excluir teste')}">${icon.trash}</button></div>`).join('')}</div>` : ''}`);
};
submits.saveStrengthTest = form => {
  const ex = state.exercises[form.dataset.id];
  const w = Math.max(0, Number(form.w.value) || 0), r = Math.round(Number(form.r.value) || 0);
  if (r < 1 || r > 30 || (!ex.bw && !(w > 0))) { toast(t('Confira a carga e as repetições.'), 4000); return; }
  ex.tests = [...(ex.tests || []), { date: new Date().toISOString(), w, r }].slice(-20);
  save(); closeSheet(); rerender();
  const lv = strengthLevel(ex);
  toast(lv.top ? t('Teste salvo. Seu nível agora: top {n}%.', { n: lv.top }) : t('Teste salvo.'), 4000);
};
actions.delStrengthTest = el => {
  const ex = state.exercises[el.dataset.id];
  ex.tests = (ex.tests || []).filter(x => x.date !== el.dataset.date);
  save(); closeSheet(); rerender();
};

const cuesText = c => (c ? `Execução: ${c.how.join(' ')}\nErros comuns: ${c.errs.join(' ')}` : '');

submits.askAI = async form => {
  const ex = state.exercises[form.dataset.id];
  const q = form.q.value.trim();
  if (!q) return;
  const btn = $('button', form);
  btn.disabled = true;
  btn.textContent = t('Pensando…');
  try {
    aiAnswer = { id: ex.id, text: await aiAskExecution(exName(ex), cuesText(exCues(ex)), q) };
  } catch (e) {
    toast(e.message, 5000);
  }
  rerender();
};
actions.genCues = async el => {
  const ex = state.exercises[el.dataset.id];
  el.disabled = true;
  el.textContent = t('Gerando…');
  try {
    const c = await aiCuesFor(exName(ex), tg(ex.group));
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
  sheet(`<h2>${t('Excluir "{x}"?', { x: esc(exName(ex)) })}</h2>
    <p class="muted">${n ? tn(n, 'Ele sai de todos os treinos e o {n} registro dele deixa de aparecer nas metas e nos gráficos.', 'Ele sai de todos os treinos e os {n} registros dele deixam de aparecer nas metas e nos gráficos.') : t('Ele sai de todos os treinos.')} ${t('Esta ação não pode ser desfeita.')}</p>
    <button class="btn danger block" data-act="delExercise" data-id="${esc(ex.id)}">${t('Excluir exercício')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
actions.delExercise = el => {
  const id = el.dataset.id;
  delete state.exercises[id];
  delete state.goals.ex[id];
  for (const r of state.routines) r.ex = r.ex.filter(x => x !== id);
  defaultGroupGoals();
  save(); closeSheet(); go('#/exercicios');
};

// ---------- Cargas iniciais ----------

const noHistory = () => Object.values(state.exercises).filter(ex => !entriesFor(ex.id).length)
  .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));

function renderLoads() {
  const pending = noHistory();
  $('#view').innerHTML = `
    <div class="head"><div class="grow"><h1>${t('Cargas iniciais')}</h1>
      <p class="sub">${t('Opcional. Informe a carga que você usa hoje para o primeiro treino já vir preenchido. O que ficar em branco você ajusta na hora.')}</p></div></div>
    <div class="stack">
      <div class="tip">${t('Anote sempre a <b>carga total</b> levantada. Barra: some a barra e as anilhas dos dois lados (barra de 20 kg + 30 kg de cada lado = 80 kg). Halteres: some os dois (20 kg em cada mão = 40 kg). Aparelho e polia: o valor marcado. Cada exercício mostra a regra embaixo do nome.')}</div>
      ${pending.length ? `<div class="card flat"><div class="list">${pending.map(ex => `<label class="item load-row">
        <span class="grow"><span class="t">${esc(exName(ex))}</span><br>
          <span class="d">${esc(tg(ex.group))} · ${ex.sets} × ${ex.repMin}–${ex.repMax} · ${esc(loadShort(ex))}</span></span>
        <input type="number" inputmode="decimal" step="any" min="0" value="${ex.startW || ''}" placeholder="kg"
          data-change="setStartW" data-id="${esc(ex.id)}" aria-label="${t('Carga inicial de {x} em kg', { x: esc(exName(ex)) })}">
      </label>`).join('')}</div></div>`
      : `<p class="empty">${t('Todos os seus exercícios já têm histórico. A carga agora vem dos treinos.')}</p>`}
      <a class="btn primary big" href="#/hoje">${t('Concluir')}</a>
    </div>`;
}
changes.setStartW = el => {
  const ex = state.exercises[el.dataset.id];
  if (!ex) return;
  const v = Number(el.value);
  if (v > 0) ex.startW = v; else delete ex.startW;
  save();
};

route('cargas', renderLoads, { tab: 'exercicios' });
route('exercicios', renderRoutines);
route('exercicio', renderExercise, { tab: 'exercicios' });
