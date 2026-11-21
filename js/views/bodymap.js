// Mapa muscular (frente e costas): cada músculo pintado pelas séries efetivas em relação à meta.
// Tocar num músculo mostra as séries e os atalhos (editar meta, completar a ficha).
import { state } from '../store.js';
import { esc, actions } from '../ui.js';
import { t } from '../i18n.js';
import { tg } from '../data.js';
import { routineGroupSets, groupGoalStatus } from '../logic.js';

const el = (tag, attrs) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
const mirror = (x0, s) => s.replace(/X(-?\d+(?:\.\d+)?)/g, (_, d) => String(x0 + Number(d)));
// formas descritas em relação ao centro do corpo (X±dx); a direita é o espelho da esquerda
const pair = (x0, fn) => fn(-1, x0) + fn(1, x0);

// partes que não são grupamento (cabeça, antebraços, canelas...)
function base(x0, back) {
  const b = d => el('path', { d: mirror(x0, d), class: 'bm-base' });
  return el('circle', { cx: x0, cy: 24, r: 13, class: 'bm-base' })
    + b('MX-6 36 LX6 36 LX7 48 LX-7 48 Z')
    + b('MX-22 50 QX0 44 X22 50 LX25 70 LX19 126 QX0 134 X-19 126 LX-25 70 Z')
    + b('MX-19 124 QX0 132 X19 124 LX21 146 LX-21 146 Z')
    + pair(x0, (s, x) => el('ellipse', { cx: x + s * 35, cy: 121, rx: 6, ry: 15, class: 'bm-base' })
      + el('circle', { cx: x + s * 37, cy: 142, r: 5, class: 'bm-base' })
      + el('ellipse', { cx: x + s * 11, cy: back ? 236 : 214, rx: 6.5, ry: back ? 7 : 24, class: 'bm-base' })
      + el('ellipse', { cx: x + s * 12, cy: 246, rx: 7, ry: 4, class: 'bm-base' }))
    + (back ? b('MX-9 108 LX9 108 LX9 124 LX-9 124 Z') : '');
}

// cada músculo: [grupo, svg]
function muscles(x0, back) {
  const p = d => el('path', { d: mirror(x0, d) });
  const e = (dx, cy, rx, ry) => pair(x0, (s, x) => el('ellipse', { cx: x + s * dx, cy, rx, ry }));
  if (!back) {
    return [
      ['Ombros', e(27, 61, 9.5, 11)],
      ['Peito', p('MX-1 56 LX-19 58 QX-25 66 X-21 78 QX-11 84 X-1 80 Z') + p('MX1 56 LX19 58 QX25 66 X21 78 QX11 84 X1 80 Z')],
      ['Bíceps', e(31, 90, 7, 14)],
      ['Abdômen', el('rect', { x: x0 - 10, y: 85, width: 20, height: 38, rx: 6 })],
      ['Quadríceps', e(11, 165, 10, 30)],
    ];
  }
  return [
    ['Ombros', e(27, 61, 9.5, 11)],
    ['Costas', p('MX0 44 LX-16 56 LX16 56 Z') + p('MX-3 60 LX-18 60 QX-24 80 X-16 104 LX-3 106 Z') + p('MX3 60 LX18 60 QX24 80 X16 104 LX3 106 Z')],
    ['Tríceps', e(31, 90, 7, 14)],
    ['Glúteos', e(10, 138, 10, 12)],
    ['Posteriores', e(11, 176, 9, 24)],
    ['Panturrilhas', e(11, 216, 7, 16)],
  ];
}

/** gs = groupGoalStatus(), isWeek = aba Semana. Devolve o cartão com o mapa. */
export function bodyMap(gs, isWeek) {
  const by = Object.fromEntries(gs.map(g => [g.group, g]));
  const fill = g => {
    const s = by[g];
    const goal = s && (isWeek ? s.weekGoal : s.monthGoal);
    if (!goal) return 'var(--axis)';
    const r = Math.min(1, (isWeek ? s.weekDone : s.monthDone) / goal);
    return r >= 1 ? 'var(--good)' : `color-mix(in srgb, var(--accent) ${Math.round(14 + 86 * r)}%, var(--surface-2))`;
  };
  const fig = (x0, back) => base(x0, back) + muscles(x0, back).map(([g, svg]) =>
    `<g class="bm-m" data-act="mapPick" data-g="${esc(g)}" style="fill:${fill(g)}" tabindex="0" role="button" aria-label="${esc(tg(g))}">${svg}</g>`).join('');
  return `<div class="card stack bodymap">
    <svg viewBox="26 0 268 268" class="bm-svg" role="group" aria-label="${t('Mapa muscular')}">
      ${fig(80, false)}${fig(240, true)}
      <text x="80" y="264" text-anchor="middle" class="bm-cap">${t('Frente')}</text>
      <text x="240" y="264" text-anchor="middle" class="bm-cap">${t('Costas')}</text>
    </svg>
    <div class="bm-legend small muted"><span><i style="background:var(--axis)"></i>${t('sem meta')}</span><span><i style="background:color-mix(in srgb, var(--accent) 30%, var(--surface-2))"></i>${t('começando')}</span><span><i style="background:var(--accent)"></i>${t('quase lá')}</span><span><i style="background:var(--good)"></i>${t('meta batida')}</span></div>
    <div class="bm-info small" data-week="${isWeek ? 1 : 0}">${t('Toque em um músculo para ver as séries.')}</div>
  </div>`;
}

actions.mapPick = node => {
  const card = node.closest('.bodymap');
  const info = card.querySelector('.bm-info');
  const isWeek = info.dataset.week === '1';
  card.querySelectorAll('.bm-m.sel').forEach(x => x.classList.remove('sel'));
  card.querySelectorAll(`.bm-m[data-g="${CSS.escape(node.dataset.g)}"]`).forEach(x => x.classList.add('sel'));
  const g = node.dataset.g;
  const s = mapData(g);
  const done = isWeek ? s.weekDone : s.monthDone;
  const goal = isWeek ? s.weekGoal : s.monthGoal;
  const have = routineGroupSets()[g] || 0;
  const line = goal
    ? (done >= goal
      ? t('{d} de {m} séries efetivas: meta batida.', { d: done, m: goal })
      : t('{d} de {m} séries efetivas: faltam {f}.', { d: done, m: goal, f: goal - done }))
    : t('{d} séries efetivas, sem meta.', { d: done });
  info.innerHTML = `<b>${esc(tg(g))}</b> · ${isWeek ? t('nesta semana') : t('neste mês')}<br>${line}
    <span class="bm-acts"><button class="link-btn" data-act="editGroupGoal" data-g="${esc(g)}">${goal ? t('Editar meta') : t('Definir meta')}</button>
    ${isWeek && goal && have < goal ? ` · <button class="link-btn" data-act="fillRoutine" data-g="${esc(g)}">${t('Completar a ficha')}</button>` : ''}</span>`;
};

// dados do grupo no momento do toque
function mapData(g) {
  return groupGoalStatus().find(x => x.group === g) || { weekDone: 0, weekGoal: state.goals.groups[g]?.week || 0, monthDone: 0, monthGoal: state.goals.groups[g]?.month || 0 };
}
