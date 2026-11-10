// Gráficos em SVG: colunas (séries por semana) e linha (evolução de um exercício).
import { esc, fmt } from './ui.js';

/** Passos "redondos" para o eixo Y. */
function niceTicks(min, max, count = 4) {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = lo; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function tooltip(box) {
  let tip = box.querySelector('.tip-box');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip-box'; tip.hidden = true; box.appendChild(tip); }
  return {
    show(xPct, yPct, html) {
      tip.innerHTML = html;
      tip.hidden = false;
      tip.style.left = `${Math.max(14, Math.min(86, xPct))}%`;
      tip.style.top = `calc(${yPct}% - 10px)`;
    },
    hide() { tip.hidden = true; },
  };
}

/**
 * Colunas de série única. data: [{ label, value, tip }]
 */
export function columnChart(box, data, { unit = '' } = {}) {
  // viewBox na largura real de um celular, para o texto não encolher
  const W = 340, H = 190, L = 26, R = 6, T = 18, B = 24;
  const max = Math.max(1, ...data.map(d => d.value));
  const ticks = niceTicks(0, max, 3);
  const top = ticks.at(-1);
  const pw = W - L - R, ph = H - T - B;
  const band = pw / data.length;
  const bw = Math.min(24, band - 2);
  const y = v => T + ph - (v / top) * ph;
  const last = data.length - 1;

  const bars = data.map((d, i) => {
    const x = L + band * i + (band - bw) / 2;
    const h = (d.value / top) * ph;
    const r = Math.min(4, h);
    const yy = T + ph - h;
    const path = h > 0
      ? `<path class="bar${i === last ? '' : ' dim'}" d="M${x},${T + ph}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${T + ph}Z"/>`
      : '';
    const lab = i === last && d.value > 0 ? `<text class="val" x="${x + bw / 2}" y="${yy - 5}" text-anchor="middle">${fmt(d.value)}</text>` : '';
    return `${path}${lab}<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>
      <rect class="hit" data-i="${i}" x="${L + band * i}" y="${T}" width="${band}" height="${ph + B}" tabindex="0" role="img" aria-label="${esc(d.tip)}"/>`;
  }).join('');

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de colunas">
    ${ticks.map(t => `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>
      <text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${bars}</svg>`;

  const tip = tooltip(box);
  const show = el => {
    const d = data[Number(el.dataset.i)];
    const x = L + band * Number(el.dataset.i) + band / 2;
    tip.show((x / W) * 100, (y(d.value) / H) * 100, `${fmt(d.value)}${unit}<small>${esc(d.tip)}</small>`);
  };
  for (const el of box.querySelectorAll('.hit')) {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('pointerdown', () => show(el));
    el.addEventListener('focus', () => show(el));
    el.addEventListener('pointerleave', tip.hide);
    el.addEventListener('blur', tip.hide);
  }
}

/**
 * Linha de série única. points: [{ label, value, tip }]; goal: valor de referência (opcional).
 */
export function lineChart(box, points, { goal = null, goalLabel = 'Meta', unit = '' } = {}) {
  const W = 340, H = 200, L = 30, R = 38, T = 16, B = 24;
  const vals = points.map(p => p.value).concat(goal ?? []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || hi * 0.1 || 1) * 0.15;
  const ticks = niceTicks(Math.max(0, lo - pad), hi + pad, 4);
  const y0 = ticks[0], y1 = ticks.at(-1);
  const pw = W - L - R, ph = H - T - B;
  const x = i => L + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const y = v => T + ph - ((v - y0) / (y1 - y0)) * ph;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const lastI = points.length - 1;
  const lp = points[lastI];
  // rótulos do eixo X: primeiro, meio e último, sem sobrepor
  const xl = [...new Set([0, Math.floor(lastI / 2), lastI])];

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de evolução">
    ${ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>
      <text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${goal != null ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}"/>
      <text x="${W - R + 5}" y="${y(goal) + 4}">${esc(goalLabel)}</text>` : ''}
    ${points.length > 1 ? `<path class="area" d="${d}L${x(lastI)},${T + ph}L${x(0)},${T + ph}Z"/><path class="line" d="${d}"/>` : ''}
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" visibility="hidden"/>
    <circle class="dot" cx="${x(lastI)}" cy="${y(lp.value)}" r="4.5"/>
    <circle class="dot hover" r="4.5" visibility="hidden"/>
    ${goal == null || Math.abs(y(goal) - y(lp.value)) > 14 ? `<text class="val" x="${x(lastI) + 8}" y="${y(lp.value) + 4}">${fmt(lp.value)}</text>` : ''}
    ${xl.map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === lastI ? 'end' : 'middle'}">${esc(points[i].label)}</text>`).join('')}
    <rect class="hit" x="${L - 10}" y="${T}" width="${pw + 20}" height="${ph + B}" tabindex="0" aria-label="Passe o dedo para ver cada treino"/>
  </svg>`;

  const svg = box.querySelector('svg');
  const cross = box.querySelector('.cross');
  const hov = box.querySelector('.dot.hover');
  const tip = tooltip(box);
  let sel = lastI;
  const show = i => {
    sel = Math.max(0, Math.min(lastI, i));
    const p = points[sel];
    cross.setAttribute('x1', x(sel)); cross.setAttribute('x2', x(sel)); cross.setAttribute('visibility', 'visible');
    hov.setAttribute('cx', x(sel)); hov.setAttribute('cy', y(p.value)); hov.setAttribute('visibility', 'visible');
    tip.show((x(sel) / W) * 100, (y(p.value) / H) * 100, `${fmt(p.value)}${unit}<small>${esc(p.tip)}</small>`);
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); hov.setAttribute('visibility', 'hidden'); tip.hide(); };
  const hit = box.querySelector('.hit');
  const at = ev => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    show(points.length === 1 ? 0 : Math.round(((px - L) / pw) * lastI));
  };
  hit.addEventListener('pointermove', at);
  hit.addEventListener('pointerdown', at);
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('focus', () => show(sel));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft') { show(sel - 1); ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { show(sel + 1); ev.preventDefault(); }
  });
}
