// Composição corporal e nível de força: estimativas a partir do perfil e das cargas registradas.
// Tudo aqui é aproximado e o app mostra isso para a pessoa.
import { state } from './store.js';
import { entriesFor, e1rm, addDays } from './logic.js';

// ---------- Perfil ----------

/** Perfil com idade calculada. Retorna null se faltar o básico (sexo, idade, altura, peso). */
export function profile() {
  const p = state.profile;
  if (!p || !p.sex || !p.birthYear || !p.height || !p.weight) return null;
  return { ...p, age: new Date().getFullYear() - p.birthYear };
}

// ---------- Padrões de força ----------
// 1RM ÷ peso corporal de quem treina musculação, nos percentis 5, 20, 50, 80 e 95
// (iniciante, novato, intermediário, avançado, elite), para um peso de referência
// (80 kg homens, 60 kg mulheres). Valores aproximados de tabelas de força usadas por treinadores.
const STD = {
  m: {
    bench: [0.5, 0.75, 1.0, 1.5, 2.0],
    squat: [0.75, 1.25, 1.5, 2.25, 2.75],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    ohp: [0.35, 0.55, 0.75, 1.0, 1.25],
    row: [0.5, 0.7, 0.9, 1.2, 1.5],
    curl: [0.2, 0.35, 0.5, 0.7, 0.85],
    hipthrust: [0.75, 1.25, 1.75, 2.5, 3.25],
    pullup: [1.0, 1.15, 1.35, 1.6, 1.85],
    dip: [1.1, 1.3, 1.55, 1.9, 2.2],
  },
  f: {
    bench: [0.3, 0.45, 0.6, 0.9, 1.2],
    squat: [0.55, 0.9, 1.15, 1.7, 2.1],
    deadlift: [0.75, 1.1, 1.5, 1.9, 2.3],
    ohp: [0.22, 0.35, 0.5, 0.65, 0.8],
    row: [0.35, 0.5, 0.65, 0.85, 1.05],
    curl: [0.13, 0.22, 0.33, 0.45, 0.55],
    hipthrust: [0.75, 1.25, 1.75, 2.5, 3.0],
    pullup: [0.6, 0.85, 1.05, 1.25, 1.5],
    dip: [0.8, 1.0, 1.2, 1.5, 1.8],
  },
};
const REF_BW = { m: 80, f: 60 };
const Z = [-1.645, -0.842, 0, 0.842, 1.645]; // percentis 5, 20, 50, 80, 95

/**
 * Exercícios comparáveis: [movimento base, fator]. O fator converte a carga do exercício
 * na carga equivalente do movimento base (ex.: dois halteres somados no supino ≈ 80% da barra).
 * bw: true = peso corporal + peso extra.
 */
export const STRENGTH_LIFTS = {
  'supino-reto': ['bench', 1.0],
  'supino-reto-halteres': ['bench', 0.8],
  'supino-inclinado-halteres': ['bench', 0.7],
  'remada-curvada': ['row', 1.0],
  'remada-unilateral': ['row', 0.5],
  'desenvolvimento-halteres': ['ohp', 0.8],
  'rosca-direta': ['curl', 1.0],
  'rosca-alternada': ['curl', 0.8],
  'rosca-martelo': ['curl', 0.85],
  'rosca-scott': ['curl', 0.85],
  'agachamento-livre': ['squat', 1.0],
  'levantamento-terra': ['deadlift', 1.0],
  'stiff': ['deadlift', 0.7],
  'elevacao-pelvica': ['hipthrust', 1.0],
  'barra-fixa': ['pullup', 1.0, true],
  'mergulho': ['dip', 1.0, true],
};

/** Força cai depois dos 40 e ainda não chegou ao pico na adolescência. */
export function ageFactor(age) {
  if (age < 14) return 0.75;
  if (age < 18) return 0.85 + (age - 14) * 0.0375;
  if (age < 23) return 0.95 + (age - 18) * 0.01;
  if (age <= 40) return 1;
  return Math.max(0.6, 1 - (age - 40) * 0.01);
}

const phi = z => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3))); // distribuição normal acumulada

/** Percentil (0 a 100) de uma razão de força, interpolando os padrões em escala logarítmica. */
export function percentileOf(ratio, std) {
  const L = std.map(Math.log);
  const x = Math.log(Math.max(ratio, 1e-6));
  let i = L.findIndex(v => x <= v);
  if (i === 0) i = 1;
  if (i === -1) i = L.length - 1;
  const z = Z[i - 1] + (x - L[i - 1]) * (Z[i] - Z[i - 1]) / (L[i] - L[i - 1]);
  return Math.min(99.9, Math.max(0.1, phi(z) * 100));
}

/** Melhor 1RM estimado dos últimos 90 dias (carga total; peso corporal somado nos exercícios de barra/paralelas). */
function best1RM(exId, bw, isBw) {
  let best = 0;
  const from = addDays(new Date(), -90);
  for (const e of entriesFor(exId)) {
    if (new Date(e.date) < from) continue;
    for (const s of e.sets) {
      if (!s.r) continue;
      const w = isBw ? bw + (s.w || 0) : s.w;
      if (w > 0) best = Math.max(best, e1rm(w, s.r));
    }
  }
  return best;
}

/**
 * Nível de força num exercício. Retorna { pct, top, lift } ou { reason } quando não dá para comparar:
 * 'noProfile' (perfil incompleto), 'notComparable' (aparelho/polia), 'noData' (sem registros recentes).
 */
export function strengthLevel(ex, p = profile()) {
  const map = ex?.lib && STRENGTH_LIFTS[ex.lib];
  if (!map) return { reason: 'notComparable' };
  if (!p) return { reason: 'noProfile' };
  const [lift, factor, isBw] = map;
  const one = best1RM(ex.id, p.weight, isBw);
  if (!one) return { reason: 'noData' };
  const ref = REF_BW[p.sex];
  // normaliza pelo peso corporal (escala alométrica: quem é mais pesado levanta menos por kg) e pela idade
  const ratio = (one / factor / ref) * (ref / p.weight) ** 0.67 / ageFactor(p.age);
  const pct = percentileOf(ratio, STD[p.sex][lift]);
  return { pct, top: Math.max(1, Math.round(100 - pct)), lift, oneRM: one };
}

/** Média dos percentis de força de todos os exercícios comparáveis com registros. */
export function overallStrength(p = profile()) {
  if (!p) return null;
  const levels = Object.values(state.exercises).map(ex => strengthLevel(ex, p)).filter(l => l.pct !== undefined);
  if (!levels.length) return null;
  const pct = levels.reduce((a, l) => a + l.pct, 0) / levels.length;
  return { pct, top: Math.max(1, Math.round(100 - pct)), count: levels.length };
}

// ---------- Composição corporal ----------

export const bmi = (w, hCm) => w / (hCm / 100) ** 2;

export function bmiClass(v) {
  if (v < 18.5) return 'under';
  if (v < 25) return 'normal';
  if (v < 30) return 'over';
  return 'obese';
}

/** Fórmula da Marinha americana (medidas em cm). */
export function navyBodyFat(sex, hCm, waist, neck, hip) {
  if (sex === 'm') {
    if (!(waist > neck)) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(hCm)) - 450;
  }
  if (!(hip && waist + hip > neck)) return null;
  return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(hCm)) - 450;
}

/** Fórmula de Deurenberg (IMC, idade e sexo). */
export const deurenbergBodyFat = (sex, bmiV, age) => 1.2 * bmiV + 0.23 * age - 10.8 * (sex === 'm' ? 1 : 0) - 5.4;

/**
 * Ajuste pela força (só na fórmula de Deurenberg): o IMC não separa músculo de gordura,
 * então quem é forte para o próprio peso tem a gordura superestimada. Até −4 pontos.
 */
export function strengthAdjustment(bmiV, strengthPct) {
  if (strengthPct == null || strengthPct <= 50) return 0;
  const weight = Math.min(1, Math.max(0, (bmiV - 22) / 6)); // pesa mais quando o IMC é alto
  return -4 * ((strengthPct - 50) / 50) * weight || 0;
}

/** Estimativa completa. method: 'navy' ou 'bmi'. */
export function bodyComposition(p = profile(), strength = overallStrength(p)) {
  if (!p) return null;
  const b = bmi(p.weight, p.height);
  const navy = navyBodyFat(p.sex, p.height, p.waist, p.neck, p.hip);
  let bf, method, adj = 0, margin;
  if (navy != null && navy > 2 && navy < 60) {
    bf = navy; method = 'navy'; margin = 3.5;
  } else {
    adj = strengthAdjustment(b, strength?.pct);
    bf = deurenbergBodyFat(p.sex, b, p.age) + adj; method = 'bmi'; margin = 5;
  }
  bf = Math.min(60, Math.max(p.sex === 'm' ? 3 : 8, bf));
  const fat = p.weight * bf / 100;
  return { bmi: b, bmiClass: bmiClass(b), bf, method, adj, margin, fatKg: fat, leanKg: p.weight - fat };
}
