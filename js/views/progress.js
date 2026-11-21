// Progresso: números do período, séries por semana, evolução por exercício e histórico.
import { state, save } from '../store.js';
import { $, esc, fmt, setStr, compact, icon, actions, changes, submits, sheet, closeSheet, fmtDate, stepper, toast, meter, kg } from '../ui.js';
import { profile, bodyComposition, overallStrength, strengthLevel, quickLevel, STRENGTH_LIFTS } from '../body.js';
import { route, go, rerender } from '../router.js';
import { GROUPS, LIB, LIB_BY_ID, exName, routineName, loadHint } from '../data.js';
import { exPack } from '../i18n.js';
import { t, tn, locale } from '../i18n.js';
import {
  weekSeries, sessionsIn, monthStart, monthEnd, monthPRCount, entriesFor, bestOf, e1rm, exGoalStatus, tonnage, workSets, addDays,
} from '../logic.js';
import { columnChart, lineChart } from '../charts.js';
import { imperial, toW, fromW, wUnit, toLen, fromLen, heightStr, ul } from '../units.js';


// modo do gráfico de cada exercício: métrica (força ou volume) e período (por treino ou por mês)
const evoMode = {};
const modeOf = id => evoMode[id] || { m: 'f', p: 't' };
actions.evoMode = el => { evoMode[el.dataset.id] = { ...modeOf(el.dataset.id), [el.dataset.k]: el.dataset.v }; rerender(); };

/** Pontos do gráfico conforme o modo. */
export function evoPoints(hist, { m, p }) {
  const vol = h => { const w = workSets(h.sets); return w.reduce((n, s) => n + (s.w > 0 ? s.w * s.r : s.r), 0); };
  if (p === 't') {
    return hist.slice(-30).map(h => {
      const top = h.sets.reduce((x, y) => (e1rm(y.w, y.r) > e1rm(x.w, x.r) ? y : x));
      const value = m === 'f' ? Math.round(bestOf(h.sets) * 10) / 10 : Math.round(vol(h));
      return { label: fmtDate(h.date, false), value, tip: `${fmtDate(h.date)} · ${m === 'f' ? setStr(top) : tn(workSets(h.sets).length, '{n} série', '{n} séries')}` };
    });
  }
  const months = new Map();
  for (const h of hist) {
    const d = new Date(h.date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = months.get(k) || { d, best: 0, vol: 0, n: 0 };
    cur.best = Math.max(cur.best, bestOf(h.sets));
    cur.vol += vol(h);
    cur.n++;
    months.set(k, cur);
  }
  return [...months.values()].slice(-12).map(x => {
    const label = x.d.toLocaleDateString(locale(), { month: 'short' }).replace('.', '');
    return { label, value: m === 'f' ? Math.round(x.best * 10) / 10 : Math.round(x.vol), tip: `${x.d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })} · ${tn(x.n, '{n} treino', '{n} treinos')}` };
  });
}

/** Gráfico e tabela de evolução de um exercício (usado aqui e na tela do exercício). */
export function exerciseProgress(ex, { box = 'exChart', table = true } = {}) {
  const hist = entriesFor(ex.id);
  if (!hist.length) return { html: `<p class="empty">${t('Sem registros ainda. O gráfico aparece depois do primeiro treino.')}</p>`, mount() {} };
  const st = exGoalStatus(ex);
  const repsOnly = ex.bw && hist.every(h => h.sets.every(s => !s.w));
  const mode = modeOf(ex.id);
  const pts = evoPoints(hist, mode);
  const unit = repsOnly ? ' reps' : ` ${wUnit()}`;
  const caption = mode.m === 'f'
    ? (repsOnly ? t('Melhor série de cada treino, em repetições.') : ul(t('Força estimada (1RM calculado da melhor série de cada treino), em kg.')))
    : (repsOnly ? t('Repetições somadas, sem contar aquecimento.') : t('Volume: carga × repetições somadas, sem contar aquecimento.'));
  const seg = (k, v, label) => `<button type="button" class="${mode[k] === v ? 'on' : ''}" data-act="evoMode" data-id="${esc(ex.id)}" data-k="${k}" data-v="${v}" aria-pressed="${mode[k] === v}">${label}</button>`;
  const rows = hist.slice(-8).reverse().map(h => `<tr><td class="n">${fmtDate(h.date)}</td>
    <td class="v">${h.sets.map(s => (s.w > 0 ? `${fmt(toW(s.w))}×${s.r}` : s.r)).join(' · ')}</td></tr>`).join('');
  return {
    html: `<div class="row evo-modes">
        <div class="seg sm" role="group" aria-label="${t('Métrica')}">${seg('m', 'f', t('Força'))}${seg('m', 'v', t('Volume'))}</div>
        <div class="seg sm" role="group" aria-label="${t('Período')}">${seg('p', 't', t('Por treino'))}${seg('p', 'm', t('Por mês'))}</div>
      </div>
      <p class="small muted">${caption}</p>
      <div class="chart" id="${box}"></div>
      ${table ? `<table class="sheet-table"><thead><tr><th>${t('Treino')}</th><th class="v">${t('Séries')}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}`,
    mount() {
      // os valores ficam em kg; na tela vão para a unidade escolhida
      const cv = v => (repsOnly || v == null ? v : Math.round(toW(v) * 10) / 10);
      lineChart($('#' + box), pts.map(x => ({ ...x, value: cv(x.value) })), {
        goal: mode.m === 'f' && mode.p === 't' && st && !st.expired ? cv(Math.round(e1rm(st.goal.w, st.goal.r) * 10) / 10) : null,
        unit: mode.m === 'v' && !repsOnly ? ` ${wUnit()}` : unit,
      });
    },
  };
}

// ---------- Este mês x mês passado (mesmo número de dias) ----------

export function monthCompare(now = new Date()) {
  const a = monthStart(now);
  const day = now.getDate();
  const pa = new Date(a.getFullYear(), a.getMonth() - 1, 1);
  const pEnd = new Date(pa.getFullYear(), pa.getMonth(), Math.min(day, new Date(pa.getFullYear(), pa.getMonth() + 1, 0).getDate()) + 1);
  const sum = ss => {
    let sets = 0, ton = 0;
    for (const s of ss) for (const e of s.entries) if (!e.skipped) { const w = workSets(e.sets); sets += w.length; ton += tonnage(w); }
    return { workouts: ss.length, sets, ton };
  };
  return { cur: sum(sessionsIn(a, addDays(now, 1))), prev: sum(sessionsIn(pa, pEnd)) };
}

function deltaChip(cur, prev, fmtFn = v => v) {
  if (!prev && !cur) return '';
  const d = cur - prev;
  if (!prev) return `<span class="delta up">${t('novo')}</span>`;
  const pct = Math.round((d / prev) * 100);
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<span class="delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${d === 0 ? t('igual') : `${Math.abs(pct)}%`}</span>`;
}

function render() {
  const now = new Date();
  const weeks = weekSeries(8, now);
  const cw = weeks.at(-1);
  const mc = monthCompare(now);
  const exs = Object.values(state.exercises).filter(ex => entriesFor(ex.id).length)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || exName(a).localeCompare(exName(b)));
  const progs = exs.map((ex, i) => ({ ex, prog: exerciseProgress(ex, { box: `exChart${i}`, table: false }) }));
  const hasData = state.sessions.length > 0;

  $('#view').innerHTML = `
    <div class="head"><h1>${t('Progresso')}</h1></div>
    <div class="stack">
      ${strengthOverview()}
      ${bodyCard()}
      <div class="card stack">
        <div class="row between"><h3>${t('Este mês')}</h3><span class="small muted">${t('comparado ao mesmo período do mês passado')}</span></div>
        <div class="tiles">
          <div class="tile"><span class="l">${t('Treinos')}</span><span class="v">${mc.cur.workouts}</span>${deltaChip(mc.cur.workouts, mc.prev.workouts)}</div>
          <div class="tile"><span class="l">${t('Séries')}</span><span class="v">${mc.cur.sets}</span>${deltaChip(mc.cur.sets, mc.prev.sets)}</div>
          <div class="tile"><span class="l">${t('Volume')}</span><span class="v">${compact(mc.cur.ton)}</span>${deltaChip(mc.cur.ton, mc.prev.ton)}</div>
          <div class="tile"><span class="l">${t('Recordes no mês')}</span><span class="v">${monthPRCount(now)}</span></div>
        </div>
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
        <span class="d num">${e.warmup?.length ? `<span class="warm-text">${t('aquec.')} ${e.warmup.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span> · ` : ''}${e.skipped ? t('pulado') : e.sets.map(x => (x.w > 0 ? `${fmt(x.w)}×${x.r}` : x.r)).join(' · ')}</span></span>
      ${icon.edit}</button>`).join('')}</div></div>
    <button class="btn block" data-act="shareStory" data-id="${s.id}">${icon.share}${t('Compartilhar nos stories')}</button>
    <button class="btn ghost danger block" data-act="delSessionAsk" data-id="${s.id}">${icon.trash}${t('Excluir treino')}</button>`);
}
actions.openSession = el => {
  const s = state.sessions.find(x => x.id === el.dataset.id);
  if (s) sessionSheet(s);
};

// ---------- Corrigir um exercício de um treino já salvo ----------

let draft = null; // { sid, ei, sets: [{ w, r, t?, rir?, warm? }] } (aquecimento primeiro, marcado com warm)

function entrySheet() {
  const s = state.sessions.find(x => x.id === draft.sid);
  const ex = state.exercises[s.entries[draft.ei].exId];
  sheet(`<h2>${esc(ex ? exName(ex) : t('Exercício removido'))}</h2><p class="muted">${esc(routineName(s))} · ${fmtDate(s.date)}</p>
    <form class="stack" data-submit="saveEntry">
      <p class="small muted">${t('Toque em "Aquec." para marcar ou desmarcar uma série como aquecimento.')}</p>
      ${draft.sets.map((x, i) => `<div class="set-edit${x.warm ? ' is-warm' : ''}">
        <span class="i">${x.warm ? 'A' : draft.sets.slice(0, i + 1).filter(y => !y.warm).length}</span>
        <input type="number" inputmode="decimal" step="any" min="0" name="w${i}" value="${toW(x.w)}" aria-label="${ul(t('Carga da série {n} em kg', { n: i + 1 }))}">
        <span class="muted">${wUnit()} ×</span>
        <input type="number" inputmode="numeric" step="1" min="0" name="r${i}" value="${x.r}" aria-label="${t('Repetições da série {n}', { n: i + 1 })}">
        <button type="button" class="warm-toggle${x.warm ? ' on' : ''}" data-act="entryWarm" data-i="${i}" aria-pressed="${!!x.warm}">${t('Aquec.')}</button>
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
    x.w = fromW(Math.max(0, Number(f[`w${i}`].value) || 0));
    x.r = Math.max(0, Math.round(Number(f[`r${i}`].value) || 0));
  });
}
actions.editEntry = el => {
  const s = state.sessions.find(x => x.id === el.dataset.s);
  const e = s?.entries[Number(el.dataset.e)];
  if (!e) return;
  draft = { sid: s.id, ei: Number(el.dataset.e), sets: [...(e.warmup || []).map(x => ({ ...x, warm: true })), ...e.sets.map(x => ({ ...x }))] };
  entrySheet();
};
actions.entryAddSet = () => {
  readDraft();
  const last = draft.sets.at(-1);
  draft.sets.push(last ? { w: last.w, r: last.r } : { w: 0, r: 0 });
  entrySheet();
};
actions.entryWarm = el => {
  readDraft();
  const x = draft.sets[Number(el.dataset.i)];
  x.warm = !x.warm;
  // aquecimento fica sempre antes das séries válidas
  draft.sets.sort((a, b) => (b.warm ? 1 : 0) - (a.warm ? 1 : 0));
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
  const clean = ({ warm, ...x }) => x;
  const sets = draft.sets.filter(x => x.r > 0 && !x.warm).map(clean);
  const warmup = draft.sets.filter(x => x.r > 0 && x.warm).map(({ w, r }) => ({ w, r }));
  if (sets.length || warmup.length) {
    const e = s.entries[draft.ei];
    e.sets = sets;
    if (warmup.length) e.warmup = warmup; else delete e.warmup;
    e.skipped = false;
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
  const s = state.sessions.find(x => x.id === el.dataset.id);
  sheet(`<h2>${t('Tem certeza que quer excluir este treino?')}</h2>
    ${s ? `<p><b>${esc(routineName(s))}</b> · ${fmtDate(s.date)}</p>` : ''}
    <p class="muted">${t('Ele sai do histórico, das metas e dos gráficos. Esta ação não pode ser desfeita.')}</p>
    <button class="btn danger block" data-act="delSession" data-id="${el.dataset.id}" data-wait="5">${icon.trash}${t('Sim, excluir treino')}</button>
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

// ---------- Radar de força: um eixo por padrão de movimento, valor = percentil ----------
// Os 6 padrões fundamentais. Ordem no sentido horário a partir do canto superior direito:
// à direita a parte de trás do corpo (puxar, quadril), à esquerda a da frente (empurrar, agachar);
// em cima o tronco, embaixo as pernas. Assim o formato já mostra o desequilíbrio.
const RADAR_AXES = () => [
  [t('Puxar'), t('vertical'), ['pullup']], [t('Puxar'), t('horizontal'), ['row']], [t('Dobradiça'), t('de quadril'), ['deadlift', 'hipthrust']],
  [t('Agachar'), '', ['squat']], [t('Empurrar'), t('horizontal'), ['bench', 'dip']], [t('Empurrar'), t('vertical'), ['ohp']],
];
/** Radar de força (só o gráfico), usado dentro do cartão "Seu nível de força". */
const radarAxes = p => RADAR_AXES().map(([n1, n2, lifts]) => {
  const name = n2 ? `${n1} ${n2}` : n1;
  const best = Object.values(state.exercises).map(ex => ({ ex, l: strengthLevel(ex, p) }))
    .filter(x => x.l.pct !== undefined && lifts.includes(x.l.lift)).sort((a, b) => b.l.pct - a.l.pct)[0];
  return { name, n1, n2, lifts, best };
});
function radarSvg(p, placeholder = false) {
  // sem perfil: o desenho do radar vazio, só para mostrar o que vai aparecer
  const axes = placeholder
    ? RADAR_AXES().map(([n1, n2, lifts]) => ({ name: n2 ? `${n1} ${n2}` : n1, n1, n2, lifts, best: null }))
    : radarAxes(p);
  if (!placeholder && !axes.some(a => a.best)) return '';
  const W = 320, H = 250, cx = W / 2, cy = 126, R = 80;
  const pt = (i, f) => { const a = -Math.PI / 3 + i * Math.PI * 2 / 6; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const poly = f => axes.map((_, i) => pt(i, f).map(v => v.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${poly(f)}" class="r-ring"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="r-ring"/>`; }).join('');
  const vals = axes.map((a, i) => pt(i, a.best ? Math.max(0.04, a.best.l.pct / 100) : 0).map(v => v.toFixed(1)).join(',')).join(' ');
  const labels = axes.map((a, i) => {
    const [x, y] = pt(i, 1.14);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
    const lines = [[a.n1, 'r-name'], ...(a.n2 ? [[a.n2, 'r-name']] : []), [a.best ? t('Top {n}%', { n: a.best.l.top }) : '—', `r-val${a.best ? '' : ' none'}`]];
    // em cima o texto sobe a partir do vértice, embaixo desce, nos lados fica centrado
    const y0 = y < cy - 10 ? y - 14 * (lines.length - 1) - 2 : y > cy + 10 ? y + 12 : y + 4 - 7 * (lines.length - 1);
    return lines.map(([txt, cls], k) => `<text x="${x.toFixed(1)}" y="${(y0 + 14 * k).toFixed(1)}" text-anchor="${anchor}" class="${cls}">${esc(txt)}</text>`).join('');
  }).join('');
  const dots = axes.map((a, i) => (a.best ? (() => { const [x, y] = pt(i, Math.max(0.04, a.best.l.pct / 100)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="r-dot"/>`; })() : '')).join('');
  // fatias: cada eixo ganha a sua fatia dentro do hexágono (centro, meio das arestas vizinhas e o vértice),
  // com fundo laranja claro e borda pontilhada, para ficar claro que cada uma é um botão
  const mid = (i, j) => { const [x1, y1] = pt(i, 1), [x2, y2] = pt(j, 1); return [(x1 + x2) / 2, (y1 + y2) / 2]; };
  const seps = axes.map((_, i) => {
    const n = axes.length, pts = [[cx, cy], mid((i + n - 1) % n, i), pt(i, 1), mid(i, (i + 1) % n)];
    return `<polygon points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" class="r-slice" data-i="${i}"/>`;
  }).join('');
  // área de toque de cada eixo: uma fatia de 60° em volta dele
  const hits = axes.map((a, i) => {
    const ang = k => -Math.PI / 3 + i * Math.PI / 3 + k * Math.PI / 6;
    const q = k => `${(cx + Math.cos(ang(k)) * R * 1.6).toFixed(1)},${(cy + Math.sin(ang(k)) * R * 1.6).toFixed(1)}`;
    return `<polygon points="${cx},${cy} ${q(-1)} ${q(0)} ${q(1)}" class="r-hit" data-act="radarPick" data-i="${i}" tabindex="0" role="button" aria-label="${esc(a.name)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="radar" role="img" aria-label="${esc(axes.map(a => `${a.name}: ${a.best ? t('Top {n}%', { n: a.best.l.top }) : t('sem dado')}`).join(', '))}">
      ${hits}${rings}${spokes}${seps}<polygon points="${vals}" class="r-area"/>${dots}${labels}
</svg>`;
}

function strengthOverview() {
  const p = profile();
  // sem perfil: radar apagado e inativo, com o convite grande para preencher os dados
  if (!p) {
    return `<div class="card stack strength-card locked">
      <h3>${t('Seu nível de força')}</h3>
      <div class="radar-lock">
        <div class="radar-ghost" aria-hidden="true">${radarSvg(null, true)}</div>
        <div class="lock-msg">
          <span class="lock-ic">${icon.target}</span>
          <b class="lock-title">${t('Complete seus dados para liberar seus percentis de força e desempenho')}</b>
          <p class="small">${t('Com sexo, idade, altura e peso, o app compara você com pessoas como você e mostra em que top você está em cada exercício.')}</p>
          <button class="btn primary block" data-act="editProfile">${t('Preencher meus dados')}</button>
          <p class="small muted">${t('Opcional: cintura, pescoço e quadril deixam a gordura e a massa magra bem mais precisas.')}</p>
        </div>
      </div>
    </div>`;
  }
  const rows = strengthRows(p);
  if (!rows.length) {
    return `<a class="card stack strength-card link-card" href="#/forca"><div class="row between"><h3>${t('Seu nível de força')}</h3>${icon.next}</div>
      <p class="muted">${t('Registre exercícios com barra, halteres ou peso corporal (supino, agachamento, terra, remada, barra fixa...) para ver em que top de força você está.')}</p></a>`;
  }
  return `<a class="card stack strength-card link-card" href="#/forca">
    <div class="row between"><h3>${t('Seu nível de força')}</h3>${icon.next}</div>
    ${radarSvg(p)}
    <div class="r-info r-tap">${icon.target} ${t('Toque numa fatia para ver os exercícios dela e quanto de carga você precisa para o top que quiser.')}</div>
  </a>`;
}

// consulta rápida: qualquer exercício comparável, sem salvar nada
// Padrões de movimento (como treinadores e tabelas de força organizam os testes): [nome, lifts]
const PATTERNS = () => [
  [t('Empurrar na horizontal'), ['bench', 'dip']], [t('Empurrar na vertical'), ['ohp']],
  [t('Puxar na horizontal'), ['row']], [t('Puxar na vertical'), ['pullup']],
  [t('Agachar'), ['squat']], [t('Dobradiça de quadril'), ['deadlift', 'hipthrust']],
  // isoladores: têm nível, mas não entram no radar
  [t('Bíceps'), ['curl']], [t('Tríceps'), ['triceps']], [t('Peito (isoladores)'), ['chest-iso']], [t('Costas e lombar (isoladores)'), ['back-iso']],
  [t('Ombros (isoladores)'), ['shoulder-iso']], [t('Pernas e glúteos (isoladores)'), ['leg-iso']], [t('Panturrilha'), ['calf']], [t('Abdômen'), ['core']],
];
const libName = id => exPack(id)?.name ?? LIB_BY_ID[id].name;

function quickCalc() {
  const parts = PATTERNS().map(([label, lifts]) => {
    const ids = LIB.filter(l => STRENGTH_LIFTS[l.id] && lifts.includes(STRENGTH_LIFTS[l.id][0])).map(l => l.id);
    if (!ids.length) return '';
    return `<details class="quick-part"><summary><b>${esc(label)}</b><span class="small muted">${tn(ids.length, '{n} exercício', '{n} exercícios')}</span>${icon.down}</summary>
      <div class="list">${ids.map(id => `<button class="item" data-act="quickLevel" data-id="${id}"><span class="grow t">${esc(libName(id))}</span>${icon.next}</button>`).join('')}</div></details>`;
  }).join('');
  return `<div class="card stack quick-card">
    <h3>${t('Consultar qualquer exercício')}</h3>
    <p class="small muted">${t('Escolha o exercício, informe carga e repetições e veja seu top na hora. Nada fica salvo.')}</p>
    ${parts}
  </div>`;
}

actions.quickLevel = el => {
  const id = el.dataset.id;
  const bw = STRENGTH_LIFTS[id][2];
  sheet(`<h2>${esc(libName(id))}</h2>
    <form class="stack" data-quick="${id}" onsubmit="return false">
      <div class="two">
        ${stepper('w', bw ? 0 : (imperial() ? 95 : 40), imperial() ? 5 : 2.5, ul(bw ? t('Peso extra (kg)') : t('Carga total (kg)')), 0, 'quickCalc')}
        ${stepper('r', 8, 1, t('Repetições'), 1, 'quickCalc')}
      </div>
      <p class="small muted">${esc(loadHint({ lib: id }))}</p>
      <div id="quickOut" class="quick-out" aria-live="polite"></div>
      <p class="small muted">${t('Use uma série feita até perto da falha. Até 10 reps a estimativa é mais precisa.')}</p>
    </form>`);
  const form = $(`form[data-quick="${id}"]`);
  form.querySelectorAll('input').forEach(i => { i.dataset.live = ''; }); // resultado muda a cada tecla
  showQuick(form);
};
function showQuick(form) {
  const id = form.dataset.quick;
  const w = fromW(Number(form.w.value) || 0), r = Math.round(Number(form.r.value) || 0);
  const q = quickLevel(id, w, r);
  $('#quickOut').innerHTML = q
    ? `<span class="top-chip big">${t('Top {n}%', { n: q.top })}</span>${meter(q.pct / 100)}
       <span class="small muted">${ul(t('1RM estimado: {w} kg', { w: Math.round(toW(q.oneRM)) }))}</span>`
    : `<span class="small muted">${t('Informe a carga e as repetições.')}</span>`;
}
changes.quickCalc = el => showQuick(el.closest('form'));

function renderStrength() {
  const p = profile();
  const rows = p ? strengthRows(p) : [];
  // sem registro: na mesma ordem dos padrões de movimento
  const order = PATTERNS().flatMap(([, l]) => l);
  const rank = ex => order.indexOf(STRENGTH_LIFTS[ex.lib]?.[0]);
  const pending = p ? Object.values(state.exercises).filter(ex => strengthLevel(ex, p).reason === 'noData').sort((a, b) => rank(a) - rank(b)) : [];
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="#/progresso" aria-label="${t('Voltar')}">${icon.back}</a><h1 class="grow">${t('Nível de força')}</h1></div>
    <div class="stack">
      ${!p ? `<div class="card stack"><p>${t('Descubra em que top de força você está em cada exercício, comparado a pessoas do seu sexo, idade e peso que treinam musculação.')}</p>
        <button class="btn primary block" data-act="editProfile">${t('Preencher perfil')}</button></div>` : `
      <p class="muted small">${ul(t('Seu nível de treino: pelas suas séries dos últimos 60 dias (séries iguais contam como reserva), comparado com {grupo} de {idade} anos e cerca de {peso} kg (normas do Cooper Institute, usadas pelo ACSM). Top 50% = a média.', { grupo: groupWord(p), idade: p.age, peso: Math.round(toW(p.weight)) }))}
        ${t('Top 10% quer dizer que você é mais forte que 90% dessas pessoas.')}</p>
      ${quickCalc()}
      ${rows.length ? `<h3 class="group-title">${t('Pelos seus treinos')}</h3>` : ''}
      ${PATTERNS().map(([label, lifts]) => {
        const list = rows.filter(x => lifts.includes(x.lv.lift));
        return list.length ? `<p class="muscle-title">${esc(label)}</p>${list.map(({ ex, lv }) => `<a class="card stack strength-row" href="#/exercicio/${encodeURIComponent(ex.id)}">
        <div class="row between"><b class="grow">${esc(exName(ex))}</b><span class="top-chip">${t('Top {n}%', { n: lv.top })}</span></div>
        ${meter(lv.pct / 100)}
        <span class="small muted">${ul(t('1RM estimado: {w} kg', { w: Math.round(toW(lv.oneRM)) }))} · ${lv.src.test ? t('teste de força') : setStr(lv.src)} · ${fmtDate(lv.src.date, false)}</span>
      </a>`).join('')}` : '';
      }).join('') || `<div class="card"><p class="muted">${t('Registre exercícios com barra, halteres ou peso corporal (supino, agachamento, terra, remada, barra fixa...) para ver em que top de força você está.')}</p></div>`}
      ${pending.length ? `<h3 class="group-title">${t('Ainda sem registro')}</h3>
        <div class="card flat"><div class="list">${pending.map(ex => `<a class="item" href="#/exercicio/${encodeURIComponent(ex.id)}">
          <span class="grow t">${esc(exName(ex))}</span><span class="small muted">${t('treine ou faça um teste')}</span>${icon.next}</a>`).join('')}</div></div>` : ''}
      <p class="small muted">${t('Cada exercício usa a própria tabela da Strength Level, ajustada para adultos em geral pelas normas do Cooper Institute (ACSM). Os isoladores (cadeiras, crucifixos, tríceps, panturrilha, abdômen) também têm nível, mas ficam fora do radar. A força máxima (1RM), comparada só com quem treina sério, fica na tela do exercício.')}</p>`}
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
      <p class="muted">${t('Com os mesmos dados, o app estima seu IMC, o percentual de gordura, a massa magra e a massa gorda, e acompanha seu peso.')}</p>
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
    <p class="small muted">${p.sex === 'm' ? t('Homem') : t('Mulher')} · ${t('{n} anos', { n: p.age })} · ${heightStr(p.height)} · ${fmt1(toW(p.weight))} ${wUnit()}</p>
    <div class="tiles">
      <div class="tile"><span class="l">${t('Massa magra')}</span><span class="v">${fmt1(toW(c.leanKg))} ${wUnit()}</span></div>
      <div class="tile"><span class="l">${t('Massa gorda')}</span><span class="v">${fmt1(toW(c.fatKg))} ${wUnit()}</span></div>
      <div class="tile"><span class="l">${t('Gordura estimada')}</span><span class="v">${fmt1(c.bf)}%</span><span class="small muted">±${fmt(c.margin)} ${t('pontos')}</span></div>
      <div class="tile"><span class="l">${t('IMC')}</span><span class="v">${fmt1(c.bmi)}</span></div>
    </div>
    <div class="segbar" role="img" aria-label="${t('Massa magra {a}%, massa gorda {b}%', { a: leanPct, b: 100 - leanPct })}">
      <span class="seg-lean" style="width:${leanPct}%">${leanPct >= 18 ? `${leanPct}%` : ''}</span><span class="seg-fat" style="width:${100 - leanPct}%">${100 - leanPct >= 12 ? `${100 - leanPct}%` : ''}</span>
    </div>
    <div class="legend small"><span><i class="sw-lean"></i>${t('Massa magra')}</span><span><i class="sw-fat"></i>${t('Massa gorda')}</span></div>
    ${weightBlock(p)}
    <p class="small muted">${method}</p>

    <p class="small muted">${t('Estimativas aproximadas. Não substituem uma avaliação física (bioimpedância, dobras cutâneas ou DEXA).')}</p>
  </div>`;
}

// ---------- Peso corporal ----------

function weightBlock(p) {
  const ws = (p.weights || []).slice(-30);
  const chart = ws.length >= 2;
  let delta = '';
  if (chart) {
    const d = Math.round((toW(ws.at(-1).kg) - toW(ws[0].kg)) * 10) / 10;
    delta = ul(t('{d} kg desde {data}', { d: (d > 0 ? '+' : '') + fmt(d), data: fmtDate(ws[0].date, false) }));
  }
  return `<b>${t('Peso corporal')}</b>
    ${chart ? `<p class="small muted">${delta}</p><div class="chart" id="bwChart"></div>` : `<p class="small muted">${t('Atualize seu peso de vez em quando (por exemplo, toda semana, em jejum) para ver o gráfico.')}</p>`}`;
}
function mountWeightChart() {
  const box = $('#bwChart');
  const ws = (state.profile?.weights || []).slice(-30);
  if (!box || ws.length < 2) return;
  lineChart(box, ws.map(w => ({ label: fmtDate(w.date, false), value: toW(w.kg), tip: `${fmtDate(w.date)} · ${kg(w.kg)}` })), { unit: ` ${wUnit()}` });
}

// perfil novo: valores de partida para ajustar no + e no − (o sexo continua obrigatório de escolher)
const START = { age: 25, height: 170, weight: 70 }; // métrico; na tela vai para a unidade escolhida
const reqOk = form => ['m', 'f'].includes(form.sex.value)
  && Number(form.age.value) >= 10 && Number(form.age.value) <= 100
  && fromLen(form.height.value) >= 100 && fromLen(form.height.value) <= 250
  && fromW(form.weight.value) >= 30 && fromW(form.weight.value) <= 300;

/** Formulário do perfil (janela do Progresso e tela do primeiro acesso). */
function profileForm(next = '') {
  const p = state.profile || {};
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : START.age;
  const start = (html, k) => html.replace('class="stepper"', `class="stepper" data-start="${START[k]}"`);
  return `<form class="stack" data-submit="saveProfile" data-change="profReq" data-live${next ? ` data-next="${next}"` : ''}>
      <h3>${t('Obrigatórios')}</h3>
      <label class="field">${t('Sexo')}
        <select name="sex" required>
          ${p.sex ? '' : `<option value="" selected disabled>${t('Escolha')}</option>`}
          <option value="m"${p.sex === 'm' ? ' selected' : ''}>${t('Masculino')}</option>
          <option value="f"${p.sex === 'f' ? ' selected' : ''}>${t('Feminino')}</option>
        </select></label>
      <p class="small muted">${t('Sexo biológico, usado nas fórmulas de corpo e de força.')}</p>
      <div class="two">
        ${start(stepper('age', age, 1, t('Idade (anos)'), 10), 'age')}
        ${start(stepper('height', Math.round(toLen(p.height || START.height)), 1, ul(t('Altura (cm)')), Math.round(toLen(100))), 'height')}
      </div>
      ${start(stepper('weight', toW(p.weight || START.weight), imperial() ? 1 : 0.5, ul(t('Peso (kg)')), Math.round(toW(30))), 'weight')}
      <p class="small muted">${t('Pese-se sempre no mesmo horário, de preferência ao acordar.')}</p>
      <fieldset class="opt-fields" id="optFields"${p.sex && p.height && p.weight ? '' : ' disabled'}>
      <h3>${t('Opcionais')} <span class="opt-why">${t('(para medições mais precisas)')}</span></h3>
      <p class="small opt-lock">${t('Preencha os obrigatórios acima para liberar.')}</p>
      <div class="two">
        <label class="field">${ul(t('Cintura (cm)'))}<input type="number" inputmode="decimal" step="any" min="0" name="waist" value="${p.waist ? toLen(p.waist) : ''}"></label>
        <label class="field">${ul(t('Pescoço (cm)'))}<input type="number" inputmode="decimal" step="any" min="0" name="neck" value="${p.neck ? toLen(p.neck) : ''}"></label>
      </div>
      <label class="field">${ul(t('Quadril (cm)'))}<input type="number" inputmode="decimal" step="any" min="0" name="hip" value="${p.hip ? toLen(p.hip) : ''}"></label>
      <p class="small muted">${t('Com fita métrica, sem apertar. Cintura: na altura do umbigo. Pescoço: logo abaixo do pomo de adão. Quadril (mulheres): na parte mais larga.')}</p>
      </fieldset>
      <button class="btn primary big" id="profSave"${p.sex && p.height && p.weight ? '' : ' disabled'}>${next ? t('Continuar') : t('Salvar')}</button>
    </form>`;
}
actions.editProfile = () => sheet(`<h2>${t('Seu perfil')}</h2>${profileForm()}`);

// os opcionais e o Salvar só liberam com sexo, idade, altura e peso preenchidos
changes.profReq = form => {
  const ok = reqOk(form);
  $('#optFields').disabled = !ok;
  $('#profSave').disabled = !ok;
};
submits.saveProfile = form => {
  // o que se digita está na unidade da tela; guarda sempre em cm e kg
  const n = (k, min, max, conv = v => v) => { const v = conv(Number(form[k].value)); return v >= min && v <= max ? v : null; };
  const age = n('age', 10, 100), height = n('height', 100, 250, v => Math.round(fromLen(v))), weight = n('weight', 30, 300, v => Math.round(fromW(v) * 10) / 10);
  if (!['m', 'f'].includes(form.sex.value)) { toast(t('Escolha o sexo.'), 4000); return; }
  if (!age || !height || !weight) { toast(t('Confira idade, altura e peso.'), 4000); return; }
  const old = state.profile || {};
  const weights = [...(old.weights || [])];
  if (old.weight !== weight) {
    if (weights.length && new Date(weights.at(-1).date).toDateString() === new Date().toDateString()) weights.pop();
    weights.push({ date: new Date().toISOString(), kg: weight });
  }
  state.profile = {
    sex: form.sex.value, birthYear: new Date().getFullYear() - Math.round(age), height, weight,
    waist: n('waist', 40, 200, fromLen), neck: n('neck', 20, 70, fromLen), hip: n('hip', 50, 200, fromLen), weights: weights.slice(-200),
  };
  state.settings.profileAsked = true;
  save();
  if (form.dataset.next) { go(form.dataset.next); return; }
  closeSheet(); rerender();
};

// ---------- Primeiro acesso: "Seu corpo" ----------
// Pedido uma vez só, logo depois de montar os treinos: libera nível de força, composição corporal e gráfico do peso.
function renderBodyIntro() {
  $('#view').innerHTML = `
    <div class="head"><div class="grow"><h1>${t('Seu corpo')}</h1>
      <p class="sub">${t('Com estes dados o app libera:')}</p></div></div>
    <div class="stack">
      <ul class="perks">
        <li>${icon.trophy}<span><b>${t('Nível de força')}</b><br><span class="small muted">${t('Em que top você está em cada exercício (ex.: Top 20%), comparado a quem tem seu sexo, idade e peso.')}</span></span></li>
        <li>${icon.target || icon.chart}<span><b>${t('Metas para subir de nível')}</b><br><span class="small muted">${t('Veja quanto falta para o próximo degrau e acompanhe a evolução.')}</span></span></li>
        <li>${icon.chart}<span><b>${t('Composição corporal')}</b><br><span class="small muted">${t('Estimativa de massa magra, gordura e gráfico do seu peso.')}</span></span></li>
      </ul>
      ${profileForm('#/hoje')}
      <button class="btn ghost block" data-act="skipBodyIntro">${t('Preencher depois')}</button>
      <p class="small muted center">${t('Dá para mudar quando quiser em Progresso.')}</p>
    </div>`;
}
actions.skipBodyIntro = () => { state.settings.profileAsked = true; save(); go('#/hoje'); };

route('perfil', renderBodyIntro, { noTabs: true });
route('progresso', render);
route('forca', renderStrength, { tab: 'progresso' });

// ---------- Fatia do radar: exercícios do eixo e carga necessária para o top que a pessoa quer ----------

/** Carga (total, ou extra nos de peso corporal) para chegar ao top % com tantas reps. null se fora de alcance. */
export function loadForTop(libId, top, reps, p = profile()) {
  const map = STRENGTH_LIFTS[libId];
  if (!map || !p) return null;
  const target = 100 - top;
  const pct = w => quickLevel(libId, w, reps, p)?.pct ?? 0;
  if (map[2] && pct(0) >= target) return 0; // só o peso do corpo já basta
  let lo = map[2] ? 0 : 0.5, hi = 1000;
  if (pct(hi) < target) return null;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (pct(mid) < target) lo = mid; else hi = mid; }
  const step = LIB_BY_ID[libId]?.step || 2.5;
  return Math.ceil(hi / step - 1e-9) * step;
}

let axisState = { i: 0, top: 20, reps: 8 };

function axisRows() {
  const p = profile();
  const a = radarAxes(p)[axisState.i];
  const mine = Object.fromEntries(Object.values(state.exercises).filter(ex => ex.lib).map(ex => [ex.lib, ex]));
  const ids = LIB.filter(l => STRENGTH_LIFTS[l.id] && a.lifts.includes(STRENGTH_LIFTS[l.id][0])).map(l => l.id)
    .sort((x, y) => (mine[y] ? 1 : 0) - (mine[x] ? 1 : 0));
  return ids.map(id => {
    const ex = mine[id];
    const lv = ex ? strengthLevel(ex, p) : null;
    const w = loadForTop(id, axisState.top, axisState.reps, p);
    const bw = STRENGTH_LIFTS[id][2];
    const need = w == null ? '—'
      : bw ? (w > 0 ? `+${fmt(toW(w))} ${wUnit()} × ${axisState.reps}` : t('{r} reps só com o peso do corpo', { r: axisState.reps }))
        : `${fmt(toW(w))} ${wUnit()} × ${axisState.reps}`;
    return `<div class="item axis-row${ex ? ' mine' : ''}">
      <span class="grow"><span class="t">${esc(ex ? exName(ex) : libName(id))}</span><br>
        <span class="d">${ex ? (lv?.top ? t('Você hoje: Top {n}%', { n: lv.top }) : t('nas suas fichas, ainda sem registro')) : t('não está nas suas fichas')}</span></span>
      <b class="num need">${esc(need)}</b></div>`;
  }).join('');
}

function axisSheet() {
  const p = profile();
  const a = radarAxes(p)[axisState.i];
  sheet(`<h2>${esc(a.name)}</h2>
    <p class="small muted">${a.best ? esc(t('Seu melhor neste eixo: {ex}, Top {n}%.', { ex: exName(a.best.ex), n: a.best.l.top })) : t('Ainda sem registro neste eixo: treine um dos exercícios abaixo para ele aparecer no radar.')}</p>
    <div class="card stack radar-calc">
      <b>${t('Em qual top você quer estar, e com quantas repetições?')}</b>
      <div class="chips">${[50, 30, 20, 10, 5].map(n => `<button class="chip${axisState.top === n ? ' on' : ''}" data-act="axisTop" data-n="${n}">${t('Top {n}%', { n })}</button>`).join('')}</div>
      <div class="two">${stepper('axTop', axisState.top, 5, t('Top %'), 1, 'axisCalc')}${stepper('axReps', axisState.reps, 1, t('Repetições'), 1, 'axisCalc')}</div>
      <p class="small muted">${ul(t('Para {g}, {a} anos e {w} kg. Carga total, como você anota no treino; nos exercícios com peso do corpo, o peso extra.', { g: groupWord(p), a: p.age, w: Math.round(toW(p.weight)) }))}</p>
    </div>
    <h3>${t('Exercícios que contam neste eixo')}</h3>
    <div class="card flat"><div class="list" id="axisList">${axisRows()}</div></div>
    <p class="small muted">${t('O radar usa o seu melhor exercício do eixo, pelo seu nível de treino. Cargas pela tabela de cada exercício, comparadas com adultos em geral (Cooper Institute / ACSM).')}</p>`);
}
actions.radarPick = (el, ev) => {
  ev?.preventDefault();
  const p = profile();
  if (!p) return;
  const a = radarAxes(p)[Number(el.dataset.i)];
  // começa um pouco acima do nível atual (10 pontos melhor), ou no meio da tabela
  axisState = { i: Number(el.dataset.i), top: a.best ? Math.max(1, a.best.l.top - 10) : 50, reps: axisState.reps || 8 };
  axisSheet();
};
actions.axisTop = el => { axisState.top = Number(el.dataset.n); axisSheet(); };
changes.axisCalc = el => {
  const box = el.closest('.sheet-card');
  axisState.top = Math.max(1, Math.min(99, Math.round(Number(box.querySelector('input[name="axTop"]').value) || 20)));
  axisState.reps = Math.max(1, Math.min(30, Math.round(Number(box.querySelector('input[name="axReps"]').value) || 8)));
  box.querySelectorAll('.radar-calc .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.n) === axisState.top));
  $('#axisList').innerHTML = axisRows();
};
