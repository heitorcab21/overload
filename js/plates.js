// Calculadora de anilhas: quais anilhas pôr de cada lado para chegar à carga total anotada.
// Só nos exercícios que usam anilhas: barra livre (barra + anilhas), aparelhos de anilha (leg press, hack) e Smith.
// A regra de anotação do app é a carga total: na barra, barra + anilhas; nos aparelhos, só as anilhas (sem o aparelho).
import { LOAD_TYPE } from './loads.js';
import { imperial, toW } from './units.js';

/** Anilhas comuns em academia (por lado), da maior para a menor. Com elas, pegar sempre a maior que cabe é o ideal. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
/** Barras: olímpica (20 kg / 45 lb), feminina ou técnica (15 / 35), W ou curta (10 / 25) e sem barra. */
export const BARS = [20, 15, 10, 0];
const BAR_LB = { 20: 45, 15: 35, 10: 25, 0: 0 };
// barras W ou curtas nos exercícios de braço em que são o padrão
const EZ = new Set(['triceps-testa', 'rosca-scott']);
// Smith fica na lista de aparelhos, mas carrega anilhas (o peso da barra guiada não entra)
const SMITH = new Set(['agachamento-smith', 'supino-smith', 'panturrilha-smith']);
// remada cavalinho: as anilhas ficam numa ponta só
const ONE_END = new Set(['remada-cavalinho']);

/** Tipo de carga com anilhas: 'bar' (barra + anilhas), 'plate' (só anilhas) ou null (sem calculadora). */
export function plateKind(ex) {
  const id = ex?.lib || ex?.base;
  const k = LOAD_TYPE[id];
  if (k === 'bar') return 'bar';
  if (k === 'plate' || SMITH.has(id)) return 'plate';
  return null;
}

/** Barra usada no exercício (kg nominal: 20, 15, 10 ou 0). Pode ser trocada por exercício. */
export const barOf = ex => (BARS.includes(ex?.bar) ? ex.bar : EZ.has(ex?.lib || ex?.base) ? 10 : 20);

/**
 * Anilhas para uma carga total, na unidade da tela. Devolve { side: [anilhas de um lado], bar, ends, rest }:
 * ends = 2 (dois lados) ou 1 (cavalinho); rest = o que sobra por lado sem anilha que feche (0 quando fecha).
 * Null quando a carga não passa da barra.
 */
export function platesFor(total, { bar = 0, ends = 2, plates = PLATES_KG } = {}) {
  const per = (total - bar) / ends;
  if (!(per > 0.001)) return null;
  const side = [];
  let left = per;
  for (const p of plates) {
    while (left >= p - 1e-6) { side.push(p); left -= p; }
  }
  return { side, bar, ends, rest: left > 0.01 ? +left.toFixed(2) : 0 };
}

/** As anilhas da carga de um exercício (w em kg, como o app guarda), já na unidade da tela. */
export function platesOf(ex, w) {
  const kind = plateKind(ex);
  if (!kind || !(w > 0)) return null;
  const lb = imperial();
  const bar = kind === 'bar' ? (lb ? BAR_LB[barOf(ex)] : barOf(ex)) : 0;
  const r = platesFor(toW(w), { bar, ends: ONE_END.has(ex.lib || ex.base) ? 1 : 2, plates: lb ? PLATES_LB : PLATES_KG });
  return r && { ...r, kind };
}
