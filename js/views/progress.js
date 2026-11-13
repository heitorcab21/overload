// Progresso: números do período, séries por semana, evolução por exercício e histórico.
import { state, save } from '../store.js';
import { $, esc, fmt, setStr, compact, icon, actions, changes, submits, sheet, closeSheet, fmtDate, stepper, toast, meter } from '../ui.js';
import { profile, bodyComposition, overallStrength, strengthLevel } from '../body.js';
import { route, rerender } from '../router.js';
import { GROUPS, exName, routineName } from '../data.js';
import { t, tn } from '../i18n.js';
import {
  weekSeries, sessionsIn, monthStart, monthEnd, monthPRCount, entriesFor, bestOf, e1rm, exGoalStatus, tonnage,
} from '../logic.js';
import { columnChart, lineChart } from '../charts.js';


/** Gráfico e tabela de evolução de um exercício (usado aqui e na tela do exercício). */
export function exerciseProgress(ex, { box = 'exChart', table = true } = {}) {
  const hist = entriesFor(ex.id);
  if (!hist.length) return { html: `<p class="empty">${t('Sem registros ainda. O gráfico aparece depois do primeiro treino.')}</p>`, mount() {} };
  const st = exGoalStatus(ex);
  const unit = ex.bw && hist.every(h => h.sets.every(s => !s.w)) ? ' reps' : ' kg';
  const pts = hist.slice(-30).map(h => {
    const top = h.sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
    return { label: fmtDate(h.date, false), value: Math.round(bestOf(h.sets) * 10) / 10, tip: `${fmtDate(h.date)} · ${setStr(top)}` };
  });
  const rows = hist.slice(-8).reverse().map(h => `<tr><td class="n">${fmtDate(h.date)}</td>
    <td class="v">${h.sets.map(s => (s.w > 0 ? `${fmt(s.w)}×${s.r}` : s.r)).join(' · ')}</td></tr>`).join('');
  return {
    html: `<p class="small muted">${unit === ' kg' ? t('Força estimada (1RM calculado da melhor série de cada treino), em kg.') : t('Melhor série de cada treino, em repetições.')}</p>
      <div class="chart" id="${box}"></div>
      ${table ? '' : '<!--'}<table class="sheet-table"><thead><tr><th>${t('Treino')}</th><th class="v">${t('Séries')}</th></tr></thead><tbody>${rows}</tbody></table>${table ? '' : '-->'}`,
    mount() {
      lineChart($('#' + box), pts, {
        goal: st && !st.expired ? Math.round(e1rm(st.goal.w, st.goal.r) * 10) / 10 : null, unit,
      });
    },
  };
}

function render() {
  const now = new Date();
  const weeks = weekSeries(8, now);
  const cw = weeks.at(-1);
  const monthSessions = sessionsIn(monthStart(now), monthEnd(now));
  const exs = Object.values(state.exercises).filter(ex => entriesFor(ex.id).length)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));
  const progs = exs.map((ex, i) => ({ ex, prog: exerciseProgress(ex, { box: `exChart${i}`, table: false }) }));
  const hasData = state.sessions.length > 0;

  $('#view').innerHTML = `
    <div class="head"><h1>${t('Progresso')}</h1></div>
    <div class="stack">
      ${strengthOverview()}
      ${bodyCard()}
      <div class="tiles">
        <div class="tile"><span class="l">${t('Treinos no mês')}</span><span class="v">${monthSessions.length}</span></div>
        <div class="tile"><span class="l">${t('Séries na semana')}</span><span class="v">${cw.sets}</span></div>
        <div class="tile"><span class="l">${t('Volume na semana')}</span><span class="v">${compact(cw.ton)}</span></div>
        <div class="tile"><span class="l">${t('Recordes no mês')}</span><span class="v">${monthPRCount(now)}</span></div>
      </div>

      <div class="card"><h3>${t('Séries por semana')}</h3>
        ${hasData ? '<div class="chart" id="weekChart"></div>' : `<p class="empty">${t('Registre seu primeiro treino para ver a evolução.')}</p>`}
      </div>

      <div class="stack">
        <h3 class="group-title">${t('Evolução por exercício')}</h3>
        ${progs.length ? `<p class="small muted">${t('Cada ponto é um treino em que você fez o exercício. Passe o dedo no gráfico para ver a série de cada dia.')}</p>
          ${progs.map(({ ex, prog }) => exEvoCard(ex, prog)).join('')}`
          : `<div class="card"><p class="empty">${t('Nenhum exercício com registros ainda.')}</p></div>`}
      </div>

      <div class="card flat">
        <h3 style="padding:16px 16px 4px">${t('Histórico de treinos')}</h3>
        <div class="list">${state.sessions.slice().reverse().slice(0, 40).map(s => {
          const sets = s.entries.reduce((n, e) => n + e.sets.length, 0);
          const ton = s.entries.reduce((n, e) => n + tonnage(e.sets), 0);
          return `<button class="item" data-act="openSession" data-id="${s.id}">
            <span class="grow"><span class="t">${esc(routineName(s))}</span><br><span class="d">${fmtDate(s.date)} · ${tn(sets, '{n} série', '{n} séries')} · ${compact(ton)}</span></span>
            ${icon.next}</button>`;
        }).join('') || `<p class="empty">${t('Seus treinos concluídos aparecem aqui.')}</p>`}</div>
      </div>
    </div>`;

  if (hasData) {
    columnChart($('#weekChart'), weeks.map((w, i) => ({
      label: fmtDate(w.start, false), value: w.sets,
      tip: `${i === weeks.length - 1 ? t('Esta semana') : t('Semana de {d}', { d: fmtDate(w.start, false) })} · ${tn(w.workouts, '{n} treino', '{n} treinos')}`,
    })), { unit: ` ${t('séries')}` });
  }
  progs.forEach(p => p.prog.mount());
  mountWeightChart();
}


function sessionSheet(s) {
  sheet(`<h2>${esc(routineName(s))}</h2><p class="muted">${fmtDate(s.date)} · ${s.dur || '?'} min · ${t('toque em um exercício para corrigir')}</p>
    <div class="card flat"><div class="list">${s.entries.map((e, i) => `<button class="item" data-act="editEntry" data-s="${s.id}" data-e="${i}">
      <span class="grow"><span class="t">${esc(state.exercises[e.exId] ? exName(state.exercises[e.exId]) : t('Exercício removido'))}</span><br>
        <span class="d num">${e.skipped ? t('pulado') : e.sets.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span></span>
      ${icon.edit}</button>`).join('')}</div></div>
    <button class="btn ghost danger block" data-act="delSessionAsk" data-id="${s.id}">${icon.trash}${t('Excluir treino')}</button>`);
}
actions.openSession = el => {
  const s = state.sessions.find(x => x.id === el.dataset.id);
  if (s) sessionSheet(s);
};

// ---------- Corrigir um exercício de um treino já salvo ----------

let draft = null; // { sid, ei, sets: [{ w, r, t? }] }

function entrySheet() {
  const s = state.sessions.find(x => x.id === draft.sid);
  const ex = state.exercises[s.entries[draft.ei].exId];
  sheet(`<h2>${esc(ex ? exName(ex) : t('Exercício removido'))}</h2><p class="muted">${esc(routineName(s))} · ${fmtDate(s.date)}</p>
    <form class="stack" data-submit="saveEntry">
      ${draft.sets.map((x, i) => `<div class="set-edit">
        <span class="i">${i + 1}</span>
        <input type="number" inputmode="decimal" step="any" min="0" name="w${i}" value="${x.w}" aria-label="${t('Carga da série {n} em kg', { n: i + 1 })}">
        <span class="muted">kg ×</span>
        <input type="number" inputmode="numeric" step="1" min="0" name="r${i}" value="${x.r}" aria-label="${t('Repetições da série {n}', { n: i + 1 })}">
        <button type="button" class="icon-btn" data-act="entryDelSet" data-i="${i}" aria-label="${t('Excluir série {n}', { n: i + 1 })}">${icon.x}</button>
      </div>`).join('') || `<p class="muted">${t('Sem séries. Salvar assim tira o exercício deste treino.')}</p>`}
      <button type="button" class="btn block" data-act="entryAddSet">${icon.plus}${t('Adicionar série')}</button>
      <button class="btn primary big">${t('Salvar')}</button>
      <button type="button" class="btn block" data-act="entryCancel">${t('Cancelar')}</button>
    </form>`);
}
/** Guarda no rascunho o que está digitado antes de redesenhar a folha. */
function readDraft() {
  const f = $('#sheet form');
  draft.sets.forEach((x, i) => {
    x.w = Math.max(0, Number(f[`w${i}`].value) || 0);
    x.r = Math.max(0, Math.round(Number(f[`r${i}`].value) || 0));
  });
}
actions.editEntry = el => {
  const s = state.sessions.find(x => x.id === el.dataset.s);
  const e = s?.entries[Number(el.dataset.e)];
  if (!e) return;
  draft = { sid: s.id, ei: Number(el.dataset.e), sets: e.sets.map(x => ({ ...x })) };
  entrySheet();
};
actions.entryAddSet = () => {
  readDraft();
  const last = draft.sets.at(-1);
  draft.sets.push(last ? { w: last.w, r: last.r } : { w: 0, r: 0 });
  entrySheet();
};
actions.entryDelSet = el => { readDraft(); draft.sets.splice(Number(el.dataset.i), 1); entrySheet(); };
actions.entryCancel = () => {
  const s = state.sessions.find(x => x.id === draft.sid);
  draft = null;
  if (s) sessionSheet(s); else closeSheet();
};
submits.saveEntry = () => {
  readDraft();
  const s = state.sessions.find(x => x.id === draft.sid);
  const sets = draft.sets.filter(x => x.r > 0);
  if (sets.length) {
    s.entries[draft.ei].sets = sets;
    s.entries[draft.ei].skipped = false;
  } else {
    s.entries.splice(draft.ei, 1);
    if (!s.entries.length) state.sessions = state.sessions.filter(x => x.id !== s.id);
  }
  draft = null;
  save();
  rerender();
  if (state.sessions.includes(s)) sessionSheet(s); else closeSheet();
};
actions.delSessionAsk = el => {
  sheet(`<h2>${t('Excluir este treino?')}</h2><p class="muted">${t('Ele sai do histórico, das metas e dos gráficos. Esta ação não pode ser desfeita.')}</p>
    <button class="btn danger block" data-act="delSession" data-id="${el.dataset.id}">${t('Excluir treino')}</button>
    <button class="btn block" data-act="closeSheet">${t('Cancelar')}</button>`);
};
actions.delSession = el => {
  state.sessions = state.sessions.filter(x => x.id !== el.dataset.id);
  save(); closeSheet(); rerender();
};


// ---------- Evolução de cada exercício ----------

function exEvoCard(ex, prog) {
  const hist = entriesFor(ex.id);
  const first = bestOf(hist[0].sets), last = bestOf(hist.at(-1).sets);
  const pct = first > 0 ? Math.round((last / first - 1) * 100) : 0;
  const lv = strengthLevel(ex);
  const lastSets = hist.at(-1).sets.map(s => (s.w > 0 ? `${fmt(s.w)}×${s.r}` : s.r)).join(' · ');
  return `<div class="card stack ex-evo">
    <a class="row between ex-evo-head" href="#/exercicio/${encodeURIComponent(ex.id)}">
      <span class="grow"><b>${esc(exName(ex))}</b><br><span class="small muted">${tn(hist.length, '{n} treino', '{n} treinos')} · ${t('último: {s}', { s: lastSets })}</span></span>
      ${lv.top ? `<span class="top-chip">${t('Top {n}%', { n: lv.top })}</span>` : ''}
    </a>
    ${hist.length > 1 ? `<p class="small ${pct > 0 ? 'good-text' : 'muted'}">${pct > 0 ? t('+{n}% de força desde o primeiro treino', { n: pct }) : pct < 0 ? t('{n}% em relação ao primeiro treino', { n: pct }) : t('Mesma força do primeiro treino')}</p>` : ''}
    ${prog.html}
  </div>`;
}

// ---------- Nível de força: cartão no Progresso e tela por exercício ----------

function strengthRows(p) {
  return Object.values(state.exercises).map(ex => ({ ex, lv: strengthLevel(ex, p) })).filter(x => x.lv.top)
    .sort((a, b) => a.lv.top - b.lv.top);
}

function strengthOverview() {
  const p = profile();
  if (!p) {
    return `<div class="card stack strength-card">
      <h3>${t('Seu nível de força')}</h3>
      <p>${t('Descubra em que top de força você está em cada exercício, comparado a pessoas do seu sexo, idade e peso que treinam musculação.')}</p>
      <button class="btn primary block" data-act="editProfile">${t('Preencher perfil')}</button>
    </div>`;
  }
  const rows = strengthRows(p);
  if (!rows.length) {
    return `<a class="card stack strength-card link-card" href="#/forca"><div class="row between"><h3>${t('Seu nível de força')}</h3>${icon.next}</div>
      <p class="muted">${t('Registre exercícios com barra, halteres ou peso corporal (supino, agachamento, terra, remada, barra fixa...) para ver em que top de força você está.')}</p></a>`;
  }
  const best = rows[0];
  return `<a class="card stack strength-card link-card" href="#/forca">
    <div class="row between"><h3>${t('Seu nível de força')}</h3>${icon.next}</div>
    <div class="row between"><span class="grow"><span class="small muted">${t('Seu destaque')}</span><br><b>${esc(exName(best.ex))}</b></span>
      <span class="top-chip big">${t('Top {n}%', { n: best.lv.top })}</span></div>
    <p class="small muted">${tn(rows.length, 'Veja o seu nível em {n} exercício', 'Veja o seu nível em cada um dos {n} exercícios')}</p>
  </a>`;
}

function renderStrength() {
  const p = profile();
  const rows = p ? strengthRows(p) : [];
  const pending = p ? Object.values(state.exercises).filter(ex => strengthLevel(ex, p).reason === 'noData') : [];
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="#/progresso" aria-label="${t('Voltar')}">${icon.back}</a><h1 class="grow">${t('Nível de força')}</h1></div>
    <div class="stack">
      ${!p ? `<div class="card stack"><p>${t('Descubra em que top de força você está em cada exercício, comparado a pessoas do seu sexo, idade e peso que treinam musculação.')}</p>
        <button class="btn primary block" data-act="editProfile">${t('Preencher perfil')}</button></div>` : `
      <p class="muted small">${t('Entre {grupo} que treinam musculação, com {idade} anos e cerca de {peso} kg.', { grupo: groupWord(p), idade: p.age, peso: Math.round(p.weight) })}
        ${t('Top 10% quer dizer que você é mais forte que 90% dessas pessoas.')}</p>
      ${rows.map(({ ex, lv }) => `<a class="card stack strength-row" href="#/exercicio/${encodeURIComponent(ex.id)}">
        <div class="row between"><b class="grow">${esc(exName(ex))}</b><span class="top-chip">${t('Top {n}%', { n: lv.top })}</span></div>
        ${meter(lv.pct / 100)}
        <span class="small muted">${t('1RM estimado: {w} kg', { w: Math.round(lv.oneRM) })} · ${lv.src.test ? t('teste de força') : `${fmt(lv.src.w)} kg × ${lv.src.r}`} · ${fmtDate(lv.src.date, false)}</span>
      </a>`).join('') || `<div class="card"><p class="muted">${t('Registre exercícios com barra, halteres ou peso corporal (supino, agachamento, terra, remada, barra fixa...) para ver em que top de força você está.')}</p></div>`}
      ${pending.length ? `<h3 class="group-title">${t('Ainda sem registro')}</h3>
        <div class="card flat"><div class="list">${pending.map(ex => `<a class="item" href="#/exercicio/${encodeURIComponent(ex.id)}">
          <span class="grow t">${esc(exName(ex))}</span><span class="small muted">${t('treine ou faça um teste')}</span>${icon.next}</a>`).join('')}</div></div>` : ''}
      <p class="small muted">${t('Só entram exercícios com barra, halteres ou peso corporal; aparelhos e polias variam demais entre academias. Estimativa baseada em padrões de força de praticantes; não é um ranking oficial.')}</p>`}
    </div>`;
}

// ---------- Seu corpo ----------

const fmt1 = v => fmt(Math.round(v * 10) / 10);
export const groupWord = p => (p.sex === 'm' ? t('homens') : t('mulheres'));

function bodyCard() {
  const p = profile();
  if (!p) {
    return `<div class="card stack">
      <h3>${t('Seu corpo')}</h3>
      <p class="muted">${t('Informe sexo, idade, altura e peso para ver seu IMC, o percentual de gordura estimado, a massa magra e a massa gorda, e em que top de força você está em cada exercício.')}</p>
      <button class="btn primary block" data-act="editProfile">${t('Preencher perfil')}</button>
    </div>`;
  }
  const strength = overallStrength(p);
  const c = bodyComposition(p, strength);
  const leanPct = Math.round(100 - c.bf);
  const method = c.method === 'navy'
    ? t('Estimado pela fórmula da Marinha americana (cintura e pescoço). Margem de erro: cerca de ±{m} pontos.', { m: fmt(c.margin) })
    : `${t('Estimado por IMC, idade e sexo (fórmula de Deurenberg). Margem de erro: cerca de ±{m} pontos.', { m: fmt(c.margin) })}`
      + (c.adj ? ` ${t('Inclui ajuste de {x} pontos pela sua força: quem é forte para o próprio peso tem mais músculo do que o IMC sugere.', { x: fmt1(c.adj) })}` : '')
      + ` ${t('Informe cintura e pescoço para uma estimativa mais precisa.')}`;
  return `<div class="card stack">
    <div class="row between"><h3>${t('Seu corpo')}</h3><button class="btn sm ghost" data-act="editProfile">${t('Atualizar')}</button></div>
    <p class="small muted">${p.sex === 'm' ? t('Homem') : t('Mulher')} · ${t('{n} anos', { n: p.age })} · ${fmt(p.height)} cm · ${fmt1(p.weight)} kg</p>
    ${weightBlock(p)}
    <div class="tiles">
      <div class="tile"><span class="l">${t('Massa magra')}</span><span class="v">${fmt1(c.leanKg)} kg</span></div>
      <div class="tile"><span class="l">${t('Massa gorda')}</span><span class="v">${fmt1(c.fatKg)} kg</span></div>
      <div class="tile"><span class="l">${t('Gordura estimada')}</span><span class="v">${fmt1(c.bf)}%</span><span class="small muted">±${fmt(c.margin)} ${t('pontos')}</span></div>
      <div class="tile"><span class="l">${t('IMC')}</span><span class="v">${fmt1(c.bmi)}</span><span class="small muted">${t('só informativo')}</span></div>
    </div>
    <div class="segbar" role="img" aria-label="${t('Massa magra {a}%, massa gorda {b}%', { a: leanPct, b: 100 - leanPct })}">
      <span class="seg-lean" style="width:${leanPct}%">${leanPct >= 18 ? `${leanPct}%` : ''}</span><span class="seg-fat" style="width:${100 - leanPct}%">${100 - leanPct >= 12 ? `${100 - leanPct}%` : ''}</span>
    </div>
    <div class="legend small"><span><i class="sw-lean"></i>${t('Massa magra')}</span><span><i class="sw-fat"></i>${t('Massa gorda')}</span></div>
    <p class="small muted">${method}</p>
    <p class="small muted">${t('O IMC é só peso dividido pela altura ao quadrado e não diferencia músculo de gordura. Para quem treina, o que importa é a massa magra e a massa gorda.')}</p>

    <p class="small muted">${t('Estimativas aproximadas. Não substituem uma avaliação física (bioimpedância, dobras cutâneas ou DEXA).')}</p>
  </div>`;
}

// ---------- Peso corporal ----------

function weightBlock(p) {
  const ws = (p.weights || []).slice(-30);
  const chart = ws.length >= 2;
  let delta = '';
  if (chart) {
    const d = Math.round((ws.at(-1).kg - ws[0].kg) * 10) / 10;
    delta = t('{d} kg desde {data}', { d: (d > 0 ? '+' : '') + fmt(d), data: fmtDate(ws[0].date, false) });
  }
  return `<div class="row between"><b>${t('Peso corporal')}</b><button class="btn sm" data-act="logWeight">${icon.plus}${t('Registrar peso')}</button></div>
    ${chart ? `<p class="small muted">${delta}</p><div class="chart" id="bwChart"></div>` : `<p class="small muted">${t('Registre seu peso de vez em quando (por exemplo, toda semana, em jejum) para ver o gráfico.')}</p>`}`;
}
function mountWeightChart() {
  const box = $('#bwChart');
  const ws = (state.profile?.weights || []).slice(-30);
  if (!box || ws.length < 2) return;
  lineChart(box, ws.map(w => ({ label: fmtDate(w.date, false), value: w.kg, tip: `${fmtDate(w.date)} · ${fmt(w.kg)} kg` })), { unit: ' kg' });
}

actions.logWeight = () => {
  sheet(`<h2>${t('Registrar peso')}</h2>
    <form class="stack" data-submit="saveWeight">
      ${stepper('weight', state.profile.weight, 0.1, t('Peso (kg)'), 30)}
      <p class="small muted">${t('Dica: pese-se sempre no mesmo horário, de preferência ao acordar.')}</p>
      <button class="btn primary big">${t('Salvar')}</button>
    </form>`);
};
submits.saveWeight = form => {
  const kg = Math.round(Number(form.weight.value) * 10) / 10;
  if (!(kg >= 30 && kg <= 300)) { toast(t('Confira idade, altura e peso.'), 4000); return; }
  const p = state.profile;
  const ws = [...(p.weights || [])];
  const today = new Date().toDateString();
  // um registro por dia: pesar de novo no mesmo dia substitui
  if (ws.length && new Date(ws.at(-1).date).toDateString() === today) ws.pop();
  ws.push({ date: new Date().toISOString(), kg });
  p.weight = kg;
  p.weights = ws.slice(-200);
  save(); closeSheet(); rerender();
};

actions.editProfile = () => {
  const p = state.profile || {};
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : 25;
  sheet(`<h2>${t('Seu perfil')}</h2>
    <form class="stack" data-submit="saveProfile">
      <label class="field">${t('Sexo')}
        <select name="sex">
          <option value="m"${p.sex !== 'f' ? ' selected' : ''}>${t('Masculino')}</option>
          <option value="f"${p.sex === 'f' ? ' selected' : ''}>${t('Feminino')}</option>
        </select></label>
      <p class="small muted">${t('As fórmulas de composição corporal e os padrões de força usam o sexo biológico.')}</p>
      <div class="two">
        ${stepper('age', age, 1, t('Idade (anos)'), 10)}
        ${stepper('height', p.height || 170, 1, t('Altura (cm)'), 100)}
      </div>
      ${stepper('weight', p.weight || 70, 0.5, t('Peso (kg)'), 30)}
      <h3>${t('Medidas opcionais (mais precisão)')}</h3>
      <p class="small muted">${t('Com fita métrica, sem apertar. Cintura: na altura do umbigo. Pescoço: logo abaixo do pomo de adão. Quadril (mulheres): na parte mais larga.')}</p>
      <div class="two">
        <label class="field">${t('Cintura (cm)')}<input type="number" inputmode="decimal" step="any" min="0" name="waist" value="${p.waist || ''}"></label>
        <label class="field">${t('Pescoço (cm)')}<input type="number" inputmode="decimal" step="any" min="0" name="neck" value="${p.neck || ''}"></label>
      </div>
      <label class="field">${t('Quadril (cm)')}<input type="number" inputmode="decimal" step="any" min="0" name="hip" value="${p.hip || ''}"></label>
      <button class="btn primary big">${t('Salvar')}</button>
    </form>`);
};
submits.saveProfile = form => {
  const n = (k, min, max) => { const v = Number(form[k].value); return v >= min && v <= max ? v : null; };
  const age = n('age', 10, 100), height = n('height', 100, 250), weight = n('weight', 30, 300);
  if (!age || !height || !weight) { toast(t('Confira idade, altura e peso.'), 4000); return; }
  const old = state.profile || {};
  const weights = [...(old.weights || [])];
  if (old.weight !== weight) {
    if (weights.length && new Date(weights.at(-1).date).toDateString() === new Date().toDateString()) weights.pop();
    weights.push({ date: new Date().toISOString(), kg: weight });
  }
  state.profile = {
    sex: form.sex.value, birthYear: new Date().getFullYear() - Math.round(age), height, weight,
    waist: n('waist', 40, 200), neck: n('neck', 20, 70), hip: n('hip', 50, 200), weights: weights.slice(-200),
  };
  save(); closeSheet(); rerender();
};

route('progresso', render);
route('forca', renderStrength, { tab: 'progresso' });
