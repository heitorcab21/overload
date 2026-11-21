// Mapa muscular (frente e costas): cada músculo pintado pelas séries efetivas em relação à meta.
// Tocar num músculo mostra as séries e os atalhos (editar meta, completar a ficha).
import { state } from '../store.js';
import { esc, actions } from '../ui.js';
import { t } from '../i18n.js';
import { tg } from '../data.js';
import { routineGroupSets, groupGoalStatus } from '../logic.js';
import { BODY } from '../bodypaths.js';

// músculo do desenho → grupamento do app (o resto fica neutro: cabeça, mãos, antebraços, joelhos...)
const GROUP_OF = {
  chest: 'Peito', 'upper-back': 'Costas', 'lower-back': 'Costas', trapezius: 'Costas', deltoids: 'Ombros',
  biceps: 'Bíceps', triceps: 'Tríceps', abs: 'Abdômen', obliques: 'Abdômen',
  quadriceps: 'Quadríceps', hamstring: 'Posteriores', gluteal: 'Glúteos', calves: 'Panturrilhas',
};

function figure(side, sex, fill) {
  const f = BODY[sex][side];
  const groups = {};
  let base = '';
  for (const [slug, paths] of Object.entries(f.parts)) {
    const d = paths.map(x => `<path d="${x}"/>`).join('');
    const g = GROUP_OF[slug];
    if (g) groups[g] = (groups[g] || '') + d;
    else base += d;
  }
  const muscles = Object.entries(groups).map(([g, d]) =>
    `<g class="bm-m" data-act="mapPick" data-g="${esc(g)}" style="fill:${fill(g)}" tabindex="0" role="button" aria-label="${esc(tg(g))}">${d}</g>`).join('');
  return `<figure class="bm-fig"><svg viewBox="${f.vb}" class="bm-svg" role="group" aria-label="${esc(side === 'front' ? t('Frente') : t('Costas'))}">
    <path d="${f.outline}" class="bm-outline"/><g class="bm-base">${base}</g>${muscles}</svg>
    <figcaption class="bm-cap">${side === 'front' ? t('Frente') : t('Costas')}</figcaption></figure>`;
}

/** gs = groupGoalStatus(), isWeek = aba Semana. Devolve o cartão com o mapa. */
export function bodyMap(gs, isWeek) {
  const by = Object.fromEntries(gs.map(g => [g.group, g]));
  const fill = g => {
    const s = by[g];
    const goal = s && (isWeek ? s.weekGoal : s.monthGoal);
    if (!goal) return 'var(--axis)';
    const r = Math.min(1, (isWeek ? s.weekDone : s.monthDone) / goal);
    return r >= 1 ? 'var(--good)' : `color-mix(in srgb, var(--accent) ${Math.round(30 + 70 * r)}%, var(--surface-2))`;
  };
  const sex = state.profile?.sex === 'f' ? 'f' : 'm';
  return `<div class="card stack bodymap">
    <div class="bm-figs" role="group" aria-label="${t('Mapa muscular')}">${figure('front', sex, fill)}${figure('back', sex, fill)}</div>
    <div class="bm-legend small muted"><span><i style="background:var(--axis)"></i>${t('sem meta')}</span><span><i style="background:color-mix(in srgb, var(--accent) 35%, var(--surface-2))"></i>${t('começando')}</span><span><i style="background:var(--accent)"></i>${t('quase lá')}</span><span><i style="background:var(--good)"></i>${t('meta batida')}</span></div>
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
