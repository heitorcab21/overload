// Metas semanais e mensais por grupamento e por exercício, em formato de planilha.
import { state, save } from '../store.js';
import { $, esc, setStr, compact, icon, actions, changes, submits, toast, sheet, closeSheet, meter, stepper, fmtDate, monthName, shareFile } from '../ui.js';
import { route, go, current, rerender } from '../router.js';
import { activeExercises, BODY_PARTS, GROUPS, exName, tg, loadLabel, loadHint } from '../data.js';
import {
  groupGoalStatus, exGoalStatus, suggestGoal, weekStart, addDays, monthKey, daysInMonth, entriesFor,
  setExGoal, setWeekOverride, autoWeekSet, routineGroupSets,
} from '../logic.js';
import { goalsCSV, importGoalsCSV } from '../export.js';
import { t, tn } from '../i18n.js';
import { toW, fromW, toStep } from '../units.js';
import { intent, saveIntent, trainedDaysThisWeek, GOAL_IDS } from '../intent.js';
import { GOAL_PLANS, FOCUS_GROUPS, intentWeekSets } from '../logic.js';

let mode = 'week';
const cap = s => s[0].toUpperCase() + s.slice(1);

function render() {
  const now = new Date();
  const ws = weekStart(now);
  const isWeek = mode === 'week';
  const period = isWeek
    ? t('Semana de {a} a {b}', { a: fmtDate(ws, false), b: fmtDate(addDays(ws, 6), false) })
    : t('{mes} de {ano}', { mes: cap(monthName(now.getMonth())), ano: now.getFullYear() });

  const gs = groupGoalStatus(now).sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  const groupRows = gs.map(g => {
    const done = isWeek ? g.weekDone : g.monthDone;
    const goal = isWeek ? g.weekGoal : g.monthGoal;
    const manual = state.goals.groups[g.group]?.auto === false;
    return `<tr data-act="editGroupGoal" data-g="${esc(g.group)}" tabindex="0">
      <td class="n">${esc(tg(g.group))}${!isWeek && g.monthTon ? `<span class="sub">${t('{v} no mês', { v: compact(g.monthTon) })}</span>` : ''}
        ${manual ? `<span class="sub">${t('definida por você')}</span>` : ''}
        ${goal ? meter(done / goal, done >= goal) : ''}</td>
      <td class="v">${goal ? `${done} / ${goal}` : `${done} <span class="muted">${t('sem meta')}</span>`}</td>
    </tr>`;
  }).join('');

  const exs = activeExercises()
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));
  const exRow = ex => {
    const st = exGoalStatus(ex, now);
    if (!st) {
      return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
        <td class="n">${esc(exName(ex))}</td>
        <td class="v muted">${t('definir meta')}</td></tr>`;
    }
    if (st.expired) {
      const [, m] = st.goal.month.split('-').map(Number);
      return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
        <td class="n">${esc(exName(ex))}<span class="sub">${t('Meta de {mes}: {set} · {status}', { mes: monthName(m - 1), set: setStr(st.goal), status: st.monthDone ? t('batida') : t('não batida') })}</span></td>
        <td class="v"><span class="badge up">${t('renovar')}</span></td></tr>`;
    }
    const target = isWeek ? st.weekSet : st.goal;
    const best = isWeek ? st.weekBest : st.monthBest;
    const pct = isWeek ? st.weekPct : st.monthPct;
    const ok = isWeek ? st.weekDone : st.monthDone;
    const info = isWeek ? (st.weekManual ? ` · ${t('definida por você')}` : ` · ${t('semana {k} de {n}', { k: st.week, n: st.weeks })}`) : '';
    return `<tr data-act="editExGoal" data-id="${esc(ex.id)}" tabindex="0">
      <td class="n">${esc(exName(ex))}
        <span class="sub">${best ? t('Melhor: {set}', { set: setStr(best) }) : isWeek ? t('Ainda não treinou nesta semana') : t('Sem registro neste mês')}${info}</span>
        ${meter(pct, ok)}</td>
      <td class="v">${setStr(target)}${ok ? `<br><span class="badge good">${icon.check}${t('batida')}</span>` : ''}</td>
    </tr>`;
  };
  // separados como em Treinos: parte do corpo > músculo
  const exSections = BODY_PARTS.map(([part, groups]) => {
    if (!exs.some(ex => groups.includes(ex.group))) return '';
    return `<section class="part-card"><h3 class="part-title">${esc(t(part))}</h3>${groups.map(g => {
      const list = exs.filter(ex => ex.group === g);
      return list.length ? `<p class="muscle-title">${esc(tg(g))}</p>
        <div class="card flat"><table class="sheet-table"><tbody>${list.map(exRow).join('')}</tbody></table></div>` : '';
    }).join('')}</section>`;
  }).join('');

  const noGoal = exs.filter(ex => { const st = exGoalStatus(ex, now); return (!st || st.expired) && entriesFor(ex.id).length; }).length;

  $('#view').innerHTML = `
    <div class="head"><div class="grow"><h1>${t('Metas')}</h1><p class="sub">${period}</p></div></div>
    <div class="stack">
      <div class="two top-acts">
        <button class="btn sheet-green-soft" data-act="exportGoals">${icon.share}${t('Exportar planilha')}</button>
        <label class="btn sheet-green-soft">${icon.download}${t('Importar planilha')}<input type="file" accept=".csv,text/csv,text/plain" data-change="importGoals" class="sr"></label>
      </div>
      ${intentCard()}
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${isWeek}" class="${isWeek ? 'on' : ''}" data-act="goalMode" data-m="week">${t('Semana')}</button>
        <button role="tab" aria-selected="${!isWeek}" class="${!isWeek ? 'on' : ''}" data-act="goalMode" data-m="month">${t('Mês')}</button>
      </div>

      <div class="card flat">
        <table class="sheet-table">
          <thead><tr><th>${t('Grupamento')}</th><th class="v">${t('Séries')}</th></tr></thead>
          <tbody>${groupRows || `<tr><td colspan="2" class="empty">${t('Adicione exercícios em Treinos para criar metas.')}</td></tr>`}</tbody>
        </table>
      </div>

      <div class="row between ex-goals-head"><h3>${t('Exercícios ativos')}</h3><span class="small muted">${isWeek ? t('Meta da semana') : t('Meta do mês')}</span></div>
      ${exSections || `<div class="card"><p class="empty">${t('Nenhum exercício nos seus treinos. Adicione em Treinos.')}</p></div>`}
      <p class="small muted">${t('A meta da semana é calculada sozinha, em degraus até a meta do mês, e você pode trocá-la quando quiser. Toque em uma linha para editar.')}</p>

      ${noGoal ? `<button class="btn block" data-act="suggestAll">${icon.spark}${tn(noGoal, 'Sugerir metas para {n} exercício', 'Sugerir metas para {n} exercícios')}</button>` : ''}

      <div class="card stack" id="sheetCard">
        <h3>${t('Como editar a planilha')}</h3>
        <p class="small muted">${t('Exporte, edite no Excel ou no Google Planilhas e importe de volta. Nos grupamentos, escreva séries ("12 séries"); nos exercícios, carga e repetições ("42,5 kg x 10"). As colunas "Feito" e "Situação" são ignoradas.')}</p>
      </div>
    </div>`;
}

actions.goalMode = el => { mode = el.dataset.m; rerender(); };

// ---------- Grupamento ----------

actions.editGroupGoal = el => {
  const g = el.dataset.g;
  const cur = state.goals.groups[g] || {};
  const fromRoutine = routineGroupSets()[g];
  sheet(`<h2>${t('Meta de {g}', { g: esc(tg(g)) })}</h2>
    <p class="muted">${t('Quantas séries você quer fazer para este grupamento.')}</p>
    <form class="stack" data-submit="saveGroupGoal" data-g="${esc(g)}">
      <div class="two">
        ${stepper('week', cur.week || 0, 1, t('Séries por semana'))}
        ${stepper('month', cur.month || 0, 1, t('Séries no mês'))}
      </div>
      <p class="small muted">${cur.auto === false
        ? t('Definida por você: não muda quando você altera os treinos.')
        : t('Hoje esta meta segue a sua rotina e se ajusta sozinha quando você muda os exercícios. Se salvar um valor, ela passa a ser fixa.')}
        ${t('Deixe o mês em 0 para calcular a partir da semana.')}</p>
      <button class="btn primary big">${t('Salvar')}</button>
      ${fromRoutine && cur.auto === false ? `<button type="button" class="btn ghost block" data-act="groupAuto" data-g="${esc(g)}">${t('Seguir a rotina ({n} séries por semana)', { n: fromRoutine })}</button>` : ''}
    </form>`);
};
submits.saveGroupGoal = form => {
  const week = Math.max(0, Math.round(Number(form.week.value) || 0));
  let month = Math.max(0, Math.round(Number(form.month.value) || 0));
  const old = state.goals.groups[form.dataset.g] || {};
  // se só a semana mudou, o mês acompanha
  if (!month || (week !== (old.week || 0) && month === (old.month || 0))) month = Math.round(week * daysInMonth() / 7);
  if (!week && !month) state.goals.groups[form.dataset.g] = { week: 0, month: 0, auto: false };
  else if (week !== old.week || month !== old.month) state.goals.groups[form.dataset.g] = { week, month, auto: false };
  save(); closeSheet(); rerender();
};
actions.groupAuto = el => {
  const g = el.dataset.g;
  const n = routineGroupSets()[g] || 0;
  state.goals.groups[g] = { week: n, month: Math.round(n * daysInMonth() / 7), auto: true };
  save(); closeSheet(); rerender();
};

// ---------- Exercício ----------

actions.editExGoal = el => {
  const ex = state.exercises[el.dataset.id];
  if (!ex) return;
  const st = exGoalStatus(ex);
  const active = st && !st.expired;
  const sug = suggestGoal(ex);
  const start = active ? st.goal : sug || { w: ex.startW || 0, r: ex.repMax };
  const auto = active ? autoWeekSet(ex) : null;
  const wLabel = loadLabel(ex);
  const now = new Date();
  sheet(`<h2>${esc(exName(ex))}</h2>
    <form class="stack" data-submit="saveExGoal" data-id="${esc(ex.id)}"
      data-week0="${active ? `${st.weekSet.w}|${st.weekSet.r}` : ''}">
      <h3>${t('Meta do mês (até o fim de {mes})', { mes: monthName(now.getMonth()) })}</h3>
      <div class="two">
        ${stepper('w', toW(start.w), toStep(ex.step || 1), wLabel)}
        ${stepper('r', start.r, 1, t('Repetições'), 1)}
      </div>
      <p class="small muted">${esc(loadHint(ex))}</p>
      ${sug ? `<p class="small muted">${t('Sugestão do app (cerca de 5% acima do seu melhor recente): <b>{set}</b>', { set: setStr(sug) })}</p>`
            : `<p class="small muted">${t('Sem histórico ainda: defina uma meta realista e ajuste depois do primeiro treino.')}</p>`}
      ${active ? `<h3>${t('Meta desta semana')}</h3>
      <div class="two">
        ${stepper('ww', toW(st.weekSet.w), toStep(ex.step || 1), wLabel)}
        ${stepper('wr', st.weekSet.r, 1, t('Repetições'), 1)}
      </div>
      <p class="small muted">${st.weekManual
        ? t('Definida por você. O cálculo automático daria {set}.', { set: setStr(auto) })
        : t('Calculada sozinha, em degraus até a meta do mês. Mude se quiser outra meta só nesta semana.')}</p>
      ${st.weekManual ? `<button type="button" class="btn ghost block" data-act="weekAuto" data-id="${esc(ex.id)}">${t('Voltar ao cálculo automático')}</button>` : ''}` : ''}
      <button class="btn primary big">${t('Salvar meta')}</button>
      ${st ? `<button type="button" class="btn ghost danger block" data-act="delExGoal" data-id="${esc(ex.id)}">${t('Remover meta')}</button>` : ''}
    </form>`);
};
submits.saveExGoal = form => {
  const ex = state.exercises[form.dataset.id];
  const now = new Date();
  const num = (v, min) => Math.max(min, Number(v) || 0);
  const w = fromW(num(form.w.value, 0));
  const r = Math.round(num(form.r.value, 1));
  const st = exGoalStatus(ex, now);
  // só recria a meta do mês se ela mudou: recriar reinicia os degraus semanais
  if (!st || st.expired || st.goal.w !== w || st.goal.r !== r) { setExGoal(ex, w, r, now); state.goals.ex[ex.id].auto = false; }
  if (form.ww) {
    const ww = fromW(num(form.ww.value, 0));
    const wr = Math.round(num(form.wr.value, 1));
    if (`${ww}|${wr}` !== form.dataset.week0) setWeekOverride(ex, ww, wr, now);
  }
  save(); closeSheet(); rerender();
};
actions.weekAuto = el => {
  delete state.goals.ex[el.dataset.id]?.weekOverride;
  save(); closeSheet(); rerender();
};
actions.delExGoal = el => { delete state.goals.ex[el.dataset.id]; save(); closeSheet(); rerender(); };

actions.suggestAll = () => {
  let n = 0;
  for (const ex of activeExercises()) {
    const st = exGoalStatus(ex);
    if (st && !st.expired) continue;
    const sug = suggestGoal(ex);
    if (sug) { setExGoal(ex, sug.w, sug.r); n++; }
  }
  save(); rerender();
  toast(n ? tn(n, '{n} meta criada para este mês.', '{n} metas criadas para este mês.') : t('Registre treinos para o app sugerir metas.'));
};

// ---------- Planilha ----------

actions.toSheet = () => $('#sheetCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

actions.exportGoals = () => shareFile(`overload-${t('metas')}-${monthKey()}.csv`, goalsCSV(), 'text/csv');

changes.importGoals = async el => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const r = importGoalsCSV(await file.text());
    save();
    rerender();
    const parts = [];
    if (r.groups) parts.push(tn(r.groups, '{n} grupamento', '{n} grupamentos'));
    if (r.ex) parts.push(tn(r.ex, '{n} meta do mês', '{n} metas do mês'));
    if (r.weeks) parts.push(tn(r.weeks, '{n} meta da semana', '{n} metas da semana'));
    let msg = parts.length ? t('Atualizado: {lista}.', { lista: parts.join(', ') }) : t('Nenhuma meta mudou.');
    if (r.unknown.length) msg += ` ${t('Não encontrei: {lista}.', { lista: r.unknown.slice(0, 3).join(', ') + (r.unknown.length > 3 ? '…' : '') })}`;
    toast(msg, 6000);
  } catch (e) {
    toast(e.message || t('Não consegui ler esta planilha.'), 6000);
  }
  el.value = '';
};

route('metas', render);

// ---------- Objetivo ----------

const GOAL_NAME = () => ({ massa: t('Ganhar massa'), forca: t('Ficar mais forte'), emagrecer: t('Emagrecer e definir'), saude: t('Saúde e condicionamento') });
const GOAL_DESC = () => ({
  massa: t('Mais séries por grupo e cargas subindo aos poucos.'),
  forca: t('Foco em subir a carga nos movimentos principais.'),
  emagrecer: t('Manter a força e mais cardio na semana.'),
  saude: t('Volume moderado e 150 min de cardio por semana.'),
});

function intentCard() {
  const it = intent();
  if (!it) {
    return `<div class="card stack intent-card">
      <p>${t('Diga o seu objetivo e o app monta as metas de séries, cargas e cardio para você.')}</p>
      <a class="btn primary block" href="#/objetivo/editar">${t('Definir meu objetivo')}</a></div>`;
  }
  const days = trainedDaysThisWeek();
  const focus = (it.focus || []).map(f => t(f)).join(', ');
  return `<div class="card stack intent-card">
    <div class="row between"><span class="grow"><span class="small muted">${t('Seu objetivo')}</span><br><b>${esc(GOAL_NAME()[it.goal])}</b>${focus ? `<br><span class="small muted">${t('Prioridade: {x}', { x: esc(focus) })}</span>` : ''}</span>
      <a class="btn sm ghost" href="#/objetivo/editar">${t('Mudar')}</a></div>
    <div class="row between small"><span>${t('Treinos nesta semana')}</span><b>${days} / ${it.days}</b></div>
    ${meter(days / it.days, days >= it.days)}
  </div>`;
}

let idraft = null;
function renderIntent(arg) {
  const it = intent();
  idraft ??= it ? { ...it, focus: [...(it.focus || [])] } : { goal: '', focus: [], days: Math.max(2, Math.min(6, state.routines.length || 3)) };
  const editing = arg === 'editar';
  const plan = idraft.goal && GOAL_PLANS[idraft.goal];
  const preview = plan ? t('Metas: {a} séries por semana em cada grupo{b}, cargas {c} e {d} min de cardio por semana.', {
    a: plan.base, b: idraft.focus.length ? t(' e {n} nos priorizados', { n: plan.focus }) : '',
    c: plan.growth > 1 ? t('subindo cerca de {p}% por mês', { p: Math.round((plan.growth - 1) * 100) }) : t('mantidas'), d: plan.cardio,
  }) : '';
  $('#view').innerHTML = `
    <div class="head">${editing ? `<a class="icon-btn" href="#/metas" aria-label="${t('Voltar')}">${icon.back}</a>` : ''}<div class="grow"><h1>${t('Seu objetivo')}</h1>
      <p class="sub">${t('O app usa isso para montar as suas metas de séries, cargas e cardio.')}</p></div></div>
    <div class="stack">
      <div class="goal-opts">${GOAL_IDS.map(g => `<button class="goal-opt${idraft.goal === g ? ' on' : ''}" data-act="intentGoal" data-g="${g}" aria-pressed="${idraft.goal === g}">
        <b>${esc(GOAL_NAME()[g])}</b><span class="small muted">${esc(GOAL_DESC()[g])}</span></button>`).join('')}</div>
      <h3>${t('Grupos para priorizar (opcional)')}</h3>
      <div class="chips wrap">${Object.keys(FOCUS_GROUPS).map(f => `<button class="chip${idraft.focus.includes(f) ? ' on' : ''}" data-act="intentFocus" data-f="${esc(f)}" aria-pressed="${idraft.focus.includes(f)}">${esc(t(f))}</button>`).join('')}</div>
      ${stepper('days', idraft.days, 1, t('Treinos por semana'), 1, 'intentDays')}
      ${preview ? `<p class="small intent-preview">${esc(preview)}</p>` : ''}
      <button class="btn primary big" data-act="intentSave" ${idraft.goal ? '' : 'disabled'}>${t('Definir minhas metas')}</button>
      ${editing ? '' : `<button class="btn ghost block" data-act="intentSkip">${t('Preencher depois')}</button>`}
      <p class="small muted center">${t('As metas que você editar à mão ficam como estão.')}</p>
    </div>`;
}
actions.intentGoal = el => { idraft.goal = el.dataset.g; rerender(); };
actions.intentFocus = el => {
  const f = el.dataset.f;
  idraft.focus = idraft.focus.includes(f) ? idraft.focus.filter(x => x !== f) : [...idraft.focus, f];
  rerender();
};
changes.intentDays = el => { idraft.days = Math.max(1, Math.min(7, Math.round(Number(el.value) || 1))); };
actions.intentSave = () => {
  if (!idraft?.goal) return;
  const days = Number($('#view input[name="days"]')?.value) || idraft.days;
  const n = saveIntent({ ...idraft, days });
  state.settings.intentAsked = true;
  save();
  const editing = current().arg === 'editar';
  idraft = null;
  toast(n ? tn(n, 'Metas montadas pelo seu objetivo ({n} de carga).', 'Metas montadas pelo seu objetivo ({n} de carga).') : t('Metas montadas pelo seu objetivo.'), 4000);
  go(editing ? '#/metas' : '#/hoje');
};
actions.intentSkip = () => { state.settings.intentAsked = true; idraft = null; save(); go('#/hoje'); };

route('objetivo', renderIntent, { noTabs: true, tab: 'metas' });
