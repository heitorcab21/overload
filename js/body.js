// Composição corporal e nível de força: estimativas a partir do perfil e das cargas registradas.
// Tudo aqui é aproximado e o app mostra isso para a pessoa.
import { state } from './store.js';
import { entriesFor, e1rm, addDays, workSets } from './logic.js';

// ---------- Perfil ----------

/** Perfil com idade calculada. Retorna null se faltar o básico (sexo, idade, altura, peso). */
export function profile() {
  const p = state.profile;
  if (!p || !p.sex || !p.birthYear || !p.height || !p.weight) return null;
  return { ...p, age: new Date().getFullYear() - p.birthYear };
}

// ---------- Padrões de força ----------
// Fonte: Strength Level (strengthlevel.com/strength-standards), tabelas "by bodyweight", em kg, consultadas em
// nov/2026. Os níveis são percentis de quem treina e registra os levantamentos lá: iniciante = mais forte que 5%,
// novato 20%, intermediário 50%, avançado 80% e elite 95%. Valores do 1RM para 80 kg (homens) e 60 kg (mulheres);
// halteres: UM halter (o app anota os dois somados, por isso o fator 2 em STRENGTH_LIFTS).
// Exercícios medidos em repetições (barra fixa, paralelas, flexão) viram carga: peso do corpo × (1 + reps/30).
// "<1" (não faz nenhuma) entra como 0,85 a 0,95 do peso do corpo, para manter a escala crescente.
const REF_BW = { m: 80, f: 60 };
const KG = {
  m: {
    'bench-press': [56, 75, 98, 124, 151], 'incline-bench-press': [50, 66, 87, 109, 134], 'decline-bench-press': [58, 79, 104, 133, 164],
    'close-grip-bench-press': [55, 72, 93, 116, 140], 'smith-bench': [53, 72, 95, 120, 148], 'chest-press': [39, 61, 89, 123, 160],
    'db-bench': [19, 28, 40, 53, 68], 'incline-db-bench': [22, 29, 39, 50, 62],
    'shoulder-press': [33, 46, 62, 81, 101], 'machine-shoulder-press': [29, 50, 76, 109, 145], 'db-shoulder-press': [15, 22, 31, 42, 54], 'arnold-press': [10, 16, 24, 34, 44],
    'bent-over-row': [48, 66, 88, 114, 141], 'seated-cable-row': [47, 65, 87, 112, 140], 'machine-row': [47, 72, 104, 142, 184], 't-bar-row': [38, 58, 82, 111, 143], 'db-row': [19, 30, 43, 59, 76],
    'lat-pulldown': [47, 64, 85, 108, 133], 'reverse-pulldown': [52, 70, 92, 118, 145], 'close-pulldown': [54, 71, 92, 115, 139],
    'squat': [75, 101, 132, 168, 206], 'leg-press': [109, 162, 230, 309, 395], 'horizontal-leg-press': [76, 119, 175, 241, 314], 'hack-squat': [63, 102, 152, 213, 280],
    'smith-squat': [57, 84, 118, 158, 202], 'goblet-squat': [15, 26, 41, 59, 80], 'db-bulgarian': [13, 22, 33, 47, 63], 'db-lunge': [10, 18, 30, 45, 62],
    'deadlift': [89, 119, 155, 196, 239], 'sumo-deadlift': [102, 135, 174, 218, 265], 'romanian-deadlift': [65, 92, 125, 163, 203], 'good-morning': [30, 53, 84, 122, 165], 'hip-thrust': [56, 96, 149, 213, 285],
    'barbell-curl': [22, 33, 46, 63, 80], 'db-curl': [8, 14, 22, 32, 42], 'hammer-curl': [11, 16, 24, 33, 42], 'preacher-curl': [20, 31, 45, 61, 78],
  },
  f: {
    'bench-press': [19, 31, 47, 66, 88], 'incline-bench-press': [14, 25, 39, 56, 76], 'decline-bench-press': [19, 32, 50, 71, 95],
    'close-grip-bench-press': [20, 31, 46, 63, 82], 'smith-bench': [16, 28, 43, 62, 83], 'chest-press': [11, 21, 36, 54, 75],
    'db-bench': [7, 12, 19, 28, 38], 'incline-db-bench': [7, 12, 19, 26, 35],
    'shoulder-press': [12, 20, 31, 43, 57], 'machine-shoulder-press': [8, 17, 30, 47, 66], 'db-shoulder-press': [6, 10, 15, 20, 27], 'arnold-press': [6, 8, 12, 16, 21],
    'bent-over-row': [18, 29, 43, 59, 78], 'seated-cable-row': [21, 32, 45, 62, 79], 'machine-row': [21, 34, 51, 72, 96], 't-bar-row': [15, 26, 42, 62, 84], 'db-row': [9, 14, 21, 29, 38],
    'lat-pulldown': [23, 33, 46, 60, 76], 'reverse-pulldown': [26, 37, 50, 66, 83], 'close-pulldown': [27, 37, 51, 66, 82],
    'squat': [32, 49, 72, 99, 129], 'leg-press': [49, 87, 140, 204, 277], 'horizontal-leg-press': [39, 68, 107, 155, 209], 'hack-squat': [24, 50, 87, 135, 190],
    'smith-squat': [22, 38, 61, 88, 119], 'goblet-squat': [10, 17, 26, 37, 49], 'db-bulgarian': [7, 12, 20, 30, 41], 'db-lunge': [6, 11, 18, 28, 39],
    'deadlift': [40, 60, 86, 116, 149], 'sumo-deadlift': [47, 68, 93, 122, 154], 'romanian-deadlift': [31, 47, 67, 90, 116], 'good-morning': [16, 28, 45, 65, 89], 'hip-thrust': [35, 63, 100, 147, 199],
    'barbell-curl': [8, 14, 23, 34, 47], 'db-curl': [4, 7, 12, 18, 24], 'hammer-curl': [5, 8, 12, 17, 22], 'preacher-curl': [8, 15, 23, 34, 46],
  },
};
// repetições só com o peso do corpo ("<1" = -4,5 / -3 / -1,5, ver acima)
const REPS = {
  m: { 'pull-ups': [1, 7, 13, 21, 29], 'chin-ups': [1, 7, 13, 21, 29], 'dips': [3, 10, 20, 31, 42], 'push-ups': [6, 20, 38, 60, 84] },
  f: { 'pull-ups': [-4.5, -1.5, 6, 12, 20], 'chin-ups': [-4.5, 1, 7, 11, 17], 'dips': [-3, 1, 9, 19, 29], 'push-ups': [-3, 7, 18, 32, 47] },
};
const PUSHUP_SHARE = 0.64; // a flexão levanta cerca de 64% do peso do corpo
// razão 1RM ÷ peso de referência, nos percentis 5, 20, 50, 80 e 95
const STD = Object.fromEntries(['m', 'f'].map(sex => [sex, {
  ...Object.fromEntries(Object.entries(KG[sex]).map(([k, v]) => [k, v.map(x => x / REF_BW[sex])])),
  ...Object.fromEntries(Object.entries(REPS[sex]).map(([k, v]) => [k, v.map(r => (k === 'push-ups' ? PUSHUP_SHARE : 1) * (1 + r / 30))])),
}]));
const Z = [-1.645, -0.842, 0, 0.842, 1.645]; // percentis 5, 20, 50, 80, 95

/**
 * Exercícios comparáveis: [padrão de movimento (eixo do radar), fator, peso do corpo, tabela].
 * Cada um usa a SUA tabela da Strength Level. fator = quanto da carga anotada corresponde à carga da tabela
 * (2 = o app anota os dois halteres e a tabela é de um). peso do corpo: true = corpo todo + extra; 0,64 = flexão.
 */
export const STRENGTH_LIFTS = {
  // empurrar na horizontal
  'supino-reto': ['bench', 1, false, 'bench-press'],
  'supino-inclinado-barra': ['bench', 1, false, 'incline-bench-press'],
  'supino-declinado': ['bench', 1, false, 'decline-bench-press'],
  'supino-fechado': ['bench', 1, false, 'close-grip-bench-press'],
  'supino-smith': ['bench', 1, false, 'smith-bench'],
  'supino-maquina': ['bench', 1, false, 'chest-press'],
  'supino-reto-halteres': ['bench', 2, false, 'db-bench'],
  'supino-inclinado-halteres': ['bench', 2, false, 'incline-db-bench'],
  'flexao': ['bench', 1, PUSHUP_SHARE, 'push-ups'],
  'mergulho': ['dip', 1, true, 'dips'],
  // empurrar na vertical
  'desenvolvimento-barra': ['ohp', 1, false, 'shoulder-press'],
  'desenvolvimento-maquina': ['ohp', 1, false, 'machine-shoulder-press'],
  'desenvolvimento-halteres': ['ohp', 2, false, 'db-shoulder-press'],
  'desenvolvimento-arnold': ['ohp', 2, false, 'arnold-press'],
  // puxar na vertical
  'barra-fixa': ['pullup', 1, true, 'pull-ups'],
  'puxada-frente': ['pullup', 1, false, 'lat-pulldown'],
  'puxada-supinada': ['pullup', 1, false, 'reverse-pulldown'],
  'puxada-triangulo': ['pullup', 1, false, 'close-pulldown'],
  // puxar na horizontal
  'remada-curvada': ['row', 1, false, 'bent-over-row'],
  'remada-baixa': ['row', 1, false, 'seated-cable-row'],
  'remada-maquina': ['row', 1, false, 'machine-row'],
  'remada-cavalinho': ['row', 1, false, 't-bar-row'],
  'remada-unilateral': ['row', 1, false, 'db-row'],
  'remada-halteres': ['row', 2, false, 'db-row'],
  // agachar
  'agachamento-livre': ['squat', 1, false, 'squat'],
  'leg-press': ['squat', 1, false, 'leg-press'],
  'leg-press-horizontal': ['squat', 1, false, 'horizontal-leg-press'],
  'hack': ['squat', 1, false, 'hack-squat'],
  'agachamento-smith': ['squat', 1, false, 'smith-squat'],
  'agachamento-goblet': ['squat', 1, false, 'goblet-squat'],
  'agachamento-sumo': ['squat', 1, false, 'goblet-squat'],     // com um halter, como o goblet
  'agachamento-bulgaro': ['squat', 2, false, 'db-bulgarian'],
  'afundo': ['squat', 2, false, 'db-lunge'],
  'afundo-caminhando': ['squat', 2, false, 'db-lunge'],
  'subida-banco': ['squat', 2, false, 'db-lunge'],             // sem tabela própria: usa a do afundo
  // dobradiça de quadril
  'levantamento-terra': ['deadlift', 1, false, 'deadlift'],
  'terra-sumo': ['deadlift', 1, false, 'sumo-deadlift'],
  'stiff': ['deadlift', 1, false, 'romanian-deadlift'],
  'bom-dia': ['deadlift', 1, false, 'good-morning'],
  'elevacao-pelvica': ['hipthrust', 1, false, 'hip-thrust'],
  'ponte-gluteo': ['hipthrust', 0.9, false, 'hip-thrust'],    // sem tabela própria: ~90% do hip thrust
  // braços
  'rosca-direta': ['curl', 1, false, 'barbell-curl'],
  'rosca-alternada': ['curl', 2, false, 'db-curl'],
  'rosca-martelo': ['curl', 2, false, 'hammer-curl'],
  'rosca-scott': ['curl', 1, false, 'preacher-curl'],
};

/** Fração do peso do corpo que entra na carga (true = o corpo todo; 0,64 = flexão). */
export const bwShare = isBw => (isBw === true ? 1 : Number(isBw) || 0);

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

/** 1RM de uma série: com 1 rep (e nada sobrando) é a própria carga; senão, fórmula de Epley. */
export const oneRepMax = (w, reps) => (reps <= 1 ? w : e1rm(w, reps));

/**
 * Melhor 1RM estimado, com a série que o originou: treinos dos últimos 90 dias e testes de força
 * dos últimos 180. Carga total; nos exercícios de peso corporal, soma o peso da pessoa.
 * Retorna { value, w, r, rir, date, test } ou null.
 */
/**
 * Reps que provavelmente sobraram numa série sem RIR anotado, pelas séries repetidas do mesmo treino.
 * Indo até a falha, as reps caem de uma série para a outra (1 a 3 por série, com 1 a 3 min de descanso).
 * Repetir a mesma carga e as mesmas reps em k séries indica reserva: 2 séries iguais → 0, 3 → 1, 4 → 2, 5+ → 3.
 */
export function inferredRir(s, sets) {
  if (s.rir != null) return { rir: s.rir, inferred: false };
  if (s.t) return { rir: 0, inferred: false }; // falhou: sem reserva
  const k = sets.filter(x => x.w === s.w && x.r >= s.r && !x.t).length;
  const rir = Math.min(3, Math.floor((k - 1) * 0.75));
  return { rir: Math.max(0, rir), inferred: rir > 0 };
}

export function best1RM(ex, bw, isBw) {
  let best = null;
  const consider = (s, date, test, sets = []) => {
    if (!s.r) return;
    const w = isBw ? bw * bwShare(isBw) + (s.w || 0) : s.w;
    if (!(w > 0)) return;
    // reps que sobraram (anotadas, ou estimadas pelas séries repetidas) contam para estimar o máximo (até 4)
    const { rir: r0, inferred } = test ? { rir: s.rir || 0, inferred: false } : inferredRir(s, sets);
    const rir = Math.min(4, r0 || 0);
    const value = oneRepMax(w, s.r + rir);
    if (!best || value > best.value) best = { value, w: s.w || 0, r: s.r, rir: s.rir ?? (inferred ? rir : null), rirInferred: inferred, sets: inferred ? sets.filter(x => x.w === s.w && x.r >= s.r).length : 0, date, test };
  };
  const from90 = addDays(new Date(), -90), from180 = addDays(new Date(), -180);
  for (const e of entriesFor(ex.id)) {
    if (new Date(e.date) < from90) continue;
    const work = workSets(e.sets);
    for (const s of work) consider(s, e.date, false, work);
  }
  for (const tst of ex.tests || []) {
    if (new Date(tst.date) >= from180) consider(tst, tst.date, true);
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
  const [lift, factor, isBw, std] = map;
  const src = best1RM(ex, p.weight, isBw);
  if (!src) return { reason: 'noData' };
  return { ...levelOf1RM(std, factor, src.value, p), lift, oneRM: src.value, src, bw: !!isBw };
}

/** Percentil a partir de um 1RM (carga total, já com o peso do corpo nos exercícios de peso corporal). */
function levelOf1RM(std, factor, one, p) {
  const ref = REF_BW[p.sex];
  // normaliza pelo peso corporal (escala alométrica: quem é mais pesado levanta menos por kg) e pela idade
  const ratio = (one / factor / ref) * (ref / p.weight) ** 0.67 / ageFactor(p.age);
  const pct = percentileOf(ratio, STD[p.sex][std]);
  return { pct, top: Math.max(1, Math.round(100 - pct)) };
}

/**
 * Consulta rápida, sem salvar nada: em que top de força fica uma série de carga × reps neste exercício.
 * w é a carga total (ou o peso extra, nos exercícios de peso corporal). Retorna null se não der para comparar.
 */
export function quickLevel(libId, w, r, p = profile()) {
  const map = STRENGTH_LIFTS[libId];
  if (!map || !p || !(r >= 1)) return null;
  const [, factor, isBw, std] = map;
  const load = isBw ? p.weight * bwShare(isBw) + (w || 0) : w;
  if (!(load > 0)) return null;
  const one = oneRepMax(load, r);
  return { ...levelOf1RM(std, factor, one, p), oneRM: one };
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
