// Medidas do corpo com fita métrica (opcionais): histórico por data, como o peso.
// Cintura, pescoço e quadril também alimentam a fórmula de gordura; o perfil guarda sempre a última de cada uma.
// Tudo em cm; a tela converte para polegadas no modo imperial.

/** [chave, nome, mínimo, máximo] em cm. A ordem é a da tela. */
export const MEASURES = [
  ['waist', 'Cintura', 40, 200],
  ['hip', 'Quadril', 50, 200],
  ['chest', 'Peito', 50, 200],
  ['arm', 'Braço', 15, 70],
  ['thigh', 'Coxa', 30, 100],
  ['calf', 'Panturrilha', 20, 70],
  ['neck', 'Pescoço', 20, 70],
];
const BY_KEY = Object.fromEntries(MEASURES.map(m => [m[0], m]));
// as três que a fórmula de gordura usa ficam também soltas no perfil
const FORMULA = ['waist', 'neck', 'hip'];

/** Valor válido em cm (arredondado a 0,1) ou null. */
export function measureOk(key, cm) {
  const m = BY_KEY[key];
  const v = Math.round(Number(cm) * 10) / 10;
  return m && v >= m[2] && v <= m[3] ? v : null;
}

/**
 * Anota medidas no perfil (vals = { chave: cm }; o que vier vazio ou fora da faixa é ignorado).
 * Várias anotações no mesmo dia viram um registro só. Devolve quantas medidas entraram.
 */
export function addMeasures(p, vals, now = new Date()) {
  const ok = {};
  for (const [k] of MEASURES) {
    const v = measureOk(k, vals[k]);
    if (v != null) ok[k] = v;
  }
  const n = Object.keys(ok).length;
  if (!n) return 0;
  const list = [...(p.measures || [])];
  const last = list.at(-1);
  if (last && new Date(last.date).toDateString() === now.toDateString()) list[list.length - 1] = { ...last, ...ok, date: now.toISOString() };
  else list.push({ date: now.toISOString(), ...ok });
  p.measures = list.slice(-200);
  for (const k of FORMULA) if (ok[k] != null) p[k] = ok[k];
  return n;
}

/** Histórico de uma medida: [{ date, cm }] em ordem de data. */
export const measureSeries = (p, key) => (p?.measures || []).filter(m => m[key] != null).map(m => ({ date: m.date, cm: m[key] }));

/** Última medida de cada tipo: { chave: { cm, date } }. */
export function lastMeasures(p) {
  const out = {};
  for (const m of p?.measures || []) for (const [k] of MEASURES) if (m[k] != null) out[k] = { cm: m[k], date: m.date };
  return out;
}
