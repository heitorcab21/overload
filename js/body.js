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
    // isoladores
    'machine-fly': [42, 63, 89, 119, 152], 'cable-fly': [8, 19, 36, 58, 84], 'db-fly': [8, 15, 24, 35, 47], 'incline-db-fly': [10, 17, 26, 37, 49],
    'db-pullover': [15, 24, 35, 49, 65], 'straight-arm-pulldown': [20, 34, 54, 77, 104], 'db-shrug': [17, 28, 44, 63, 84], 'barbell-shrug': [53, 85, 126, 175, 230],
    'db-lateral-raise': [5, 10, 16, 25, 34], 'cable-lateral-raise': [3, 8, 16, 27, 39], 'db-reverse-fly': [3, 9, 17, 29, 42], 'face-pull': [15, 29, 47, 69, 95],
    'db-front-raise': [4, 10, 17, 27, 38], 'upright-row': [23, 39, 59, 84, 111],
    'concentration-curl': [9, 14, 22, 30, 40], 'cable-curl': [20, 33, 51, 73, 98], 'incline-db-curl': [10, 14, 20, 26, 33], 'machine-curl': [25, 39, 57, 79, 102],
    'rope-pushdown': [17, 30, 46, 66, 89], 'pushdown': [22, 36, 56, 80, 107], 'lying-tricep-ext': [20, 30, 43, 59, 76], 'db-tricep-ext': [6, 12, 22, 33, 47],
    'cable-overhead-ext': [14, 26, 43, 64, 87], 'kickback': [5, 10, 18, 28, 40], 'machine-tricep-ext': [31, 50, 73, 102, 133],
    'leg-extension': [48, 72, 103, 140, 180], 'lying-leg-curl': [30, 46, 66, 90, 116], 'seated-leg-curl': [39, 58, 83, 112, 144], 'standing-leg-curl': [11, 25, 46, 73, 105],
    'hip-abduction': [38, 63, 95, 135, 179], 'hip-adduction': [41, 67, 102, 145, 192], 'cable-kickback': [7, 23, 49, 86, 131],
    'machine-calf-raise': [49, 88, 141, 207, 282], 'seated-calf-raise': [31, 57, 93, 138, 188], 'sled-calf-raise': [84, 136, 204, 286, 377], 'cable-crunch': [26, 44, 68, 97, 130],
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
    'machine-fly': [29, 46, 68, 95, 124], 'cable-fly': [3, 9, 18, 29, 43], 'db-fly': [4, 7, 11, 17, 23], 'incline-db-fly': [4, 8, 12, 19, 26],
    'db-pullover': [7, 12, 18, 26, 35], 'straight-arm-pulldown': [11, 19, 30, 43, 58], 'db-shrug': [6, 14, 24, 37, 52], 'barbell-shrug': [17, 35, 61, 95, 134],
    'db-lateral-raise': [3, 6, 9, 13, 17], 'cable-lateral-raise': [2, 5, 10, 17, 25], 'db-reverse-fly': [3, 5, 10, 15, 21], 'face-pull': [10, 19, 32, 47, 65],
    'db-front-raise': [3, 5, 9, 14, 19], 'upright-row': [11, 19, 30, 42, 57],
    'concentration-curl': [5, 8, 12, 17, 22], 'cable-curl': [7, 15, 24, 37, 51], 'incline-db-curl': [5, 8, 11, 15, 19], 'machine-curl': [8, 16, 26, 38, 52],
    'rope-pushdown': [8, 15, 24, 35, 49], 'pushdown': [9, 17, 28, 42, 59], 'lying-tricep-ext': [7, 12, 20, 29, 40], 'db-tricep-ext': [3, 7, 11, 17, 24],
    'cable-overhead-ext': [6, 12, 20, 32, 45], 'kickback': [4, 7, 10, 14, 19], 'machine-tricep-ext': [14, 24, 39, 56, 76],
    'leg-extension': [22, 38, 59, 86, 115], 'lying-leg-curl': [15, 24, 36, 51, 67], 'seated-leg-curl': [19, 31, 47, 67, 88], 'standing-leg-curl': [4, 13, 30, 53, 80],
    'hip-abduction': [26, 45, 69, 99, 132], 'hip-adduction': [22, 40, 64, 94, 127], 'cable-kickback': [6, 14, 27, 45, 65],
    'machine-calf-raise': [21, 47, 84, 133, 190], 'seated-calf-raise': [14, 34, 63, 102, 147], 'sled-calf-raise': [39, 75, 125, 189, 261], 'cable-crunch': [15, 29, 47, 70, 95],
  },
};
// repetições só com o peso do corpo ("<1" = -4,5 / -3 / -1,5, ver acima)
const REPS = {
  m: { 'pull-ups': [1, 7, 13, 21, 29], 'chin-ups': [1, 7, 13, 21, 29], 'dips': [3, 10, 20, 31, 42], 'push-ups': [6, 20, 38, 60, 84],
    'bench-dips': [1, 14, 31, 51, 72], 'back-extension': [5, 15, 29, 46, 63], 'crunches': [3, 22, 49, 82, 119], 'hanging-leg-raise': [1, 9, 17, 28, 39],
    'lying-leg-raise': [-3, 12, 29, 51, 74], 'ab-wheel': [-3, 8, 21, 37, 55] },
  f: { 'pull-ups': [-4.5, -1.5, 6, 12, 20], 'chin-ups': [-4.5, 1, 7, 11, 17], 'dips': [-3, 1, 9, 19, 29], 'push-ups': [-3, 7, 18, 32, 47],
    'bench-dips': [-3, 9, 20, 32, 46], 'back-extension': [5, 14, 25, 37, 50], 'crunches': [-3, 15, 43, 77, 116], 'hanging-leg-raise': [-3, 7, 14, 24, 33],
    'lying-leg-raise': [-3, 9, 27, 48, 71], 'ab-wheel': [-3, 5, 14, 26, 39] },
};
const PUSHUP_SHARE = 0.64; // a flexão levanta cerca de 64% do peso do corpo
// razão 1RM ÷ peso de referência, nos percentis 5, 20, 50, 80 e 95
const STD = Object.fromEntries(['m', 'f'].map(sex => [sex, {
  ...Object.fromEntries(Object.entries(KG[sex]).map(([k, v]) => [k, v.map(x => x / REF_BW[sex])])),
  ...Object.fromEntries(Object.entries(REPS[sex]).map(([k, v]) => [k, v.map(r => (k === 'push-ups' ? PUSHUP_SHARE : 1) * (1 + r / 30))])),
}]));
const Z = [-1.645, -0.842, 0, 0.842, 1.645]; // percentis 5, 20, 50, 80, 95

// População geral: normas do Cooper Institute (referência do ACSM), supino 1RM ÷ peso, 20 a 29 anos
// (Physical Fitness Assessments and Norms for Adults and Law Enforcement, reproduzidas pela ACE em 2020).
// Percentis 5, 20, 80 e 95 da tabela; o 50 é a média dos percentis 40 e 60 (homens 0,99 e 1,14; mulheres 0,59 e 0,70).
// Cada exercício usa a tabela dele da Strength Level, deslocada em cada percentil pela razão Cooper ÷ Strength Level
// do supino: assim todo exercício fica comparado com adultos em geral, e não só com quem registra treinos.
const COOPER_BENCH = { m: [0.72, 0.88, 1.065, 1.32, 1.63], f: [0.44, 0.51, 0.645, 0.80, 1.01] };
const GYM = Object.fromEntries(['m', 'f'].map(sex => {
  const shift = COOPER_BENCH[sex].map((v, i) => v / STD[sex]['bench-press'][i]);
  return [sex, Object.fromEntries(Object.entries(STD[sex]).map(([k, arr]) => {
    const out = arr.map((v, i) => v * shift[i]);
    for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] * 1.03); // sempre crescente
    return [k, out];
  }))];
}));

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
  'rosca-concentrada': ['curl', 1, false, 'concentration-curl'],
  'rosca-polia': ['curl', 1, false, 'cable-curl'],
  'rosca-inclinada': ['curl', 2, false, 'incline-db-curl'],
  'rosca-scott-maquina': ['curl', 1, false, 'machine-curl'],
  // isoladores: têm nível de força, mas ficam fora do radar (não dizem a força no padrão de movimento)
  'peck-deck': ['chest-iso', 1, false, 'machine-fly'],
  'crossover': ['chest-iso', 1, false, 'cable-fly'],
  'crossover-baixo': ['chest-iso', 1, false, 'cable-fly'],
  'crucifixo-halteres': ['chest-iso', 2, false, 'db-fly'],
  'crucifixo-inclinado': ['chest-iso', 2, false, 'incline-db-fly'],
  'pullover': ['back-iso', 1, false, 'db-pullover'],
  'pulldown-braco-reto': ['back-iso', 1, false, 'straight-arm-pulldown'],
  'encolhimento': ['back-iso', 2, false, 'db-shrug'],
  'encolhimento-barra': ['back-iso', 1, false, 'barbell-shrug'],
  'hiperextensao': ['back-iso', 1, true, 'back-extension'],
  'elevacao-lateral': ['shoulder-iso', 2, false, 'db-lateral-raise'],
  'elevacao-lateral-polia': ['shoulder-iso', 1, false, 'cable-lateral-raise'],
  'crucifixo-inverso': ['shoulder-iso', 2, false, 'db-reverse-fly'],   // com halteres (na máquina varia)
  'face-pull': ['shoulder-iso', 1, false, 'face-pull'],
  'elevacao-frontal': ['shoulder-iso', 2, false, 'db-front-raise'],
  'remada-alta': ['shoulder-iso', 1, false, 'upright-row'],
  'triceps-corda': ['triceps', 1, false, 'rope-pushdown'],
  'triceps-barra': ['triceps', 1, false, 'pushdown'],
  'triceps-testa': ['triceps', 1, false, 'lying-tricep-ext'],
  'triceps-frances': ['triceps', 1, false, 'db-tricep-ext'],
  'triceps-unilateral': ['triceps', 1, false, 'db-tricep-ext'],
  'triceps-frances-polia': ['triceps', 1, false, 'cable-overhead-ext'],
  'triceps-coice': ['triceps', 1, false, 'kickback'],
  'triceps-maquina': ['triceps', 1, false, 'machine-tricep-ext'],
  'triceps-banco': ['triceps', 1, true, 'bench-dips'],
  'cadeira-extensora': ['leg-iso', 1, false, 'leg-extension'],
  'mesa-flexora': ['leg-iso', 1, false, 'lying-leg-curl'],
  'cadeira-flexora': ['leg-iso', 1, false, 'seated-leg-curl'],
  'flexora-em-pe': ['leg-iso', 1, false, 'standing-leg-curl'],
  'cadeira-abdutora': ['leg-iso', 1, false, 'hip-abduction'],
  'cadeira-adutora': ['leg-iso', 1, false, 'hip-adduction'],
  'gluteo-polia': ['leg-iso', 1, false, 'cable-kickback'],
  'panturrilha-em-pe': ['calf', 1, false, 'machine-calf-raise'],
  'panturrilha-sentado': ['calf', 1, false, 'seated-calf-raise'],
  'panturrilha-leg-press': ['calf', 1, false, 'sled-calf-raise'],
  'abdominal-polia': ['core', 1, false, 'cable-crunch'],
  'abdominal-supra': ['core', 1, true, 'crunches'],
  'abdominal-infra': ['core', 1, true, 'lying-leg-raise'],
  'elevacao-pernas': ['core', 1, true, 'hanging-leg-raise'],
  'rodinha': ['core', 1, true, 'ab-wheel'],
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
export function inferredRir(s, sets, generous = false) {
  if (s.rir != null) return { rir: s.rir, inferred: false };
  if (s.t) return { rir: 0, inferred: false }; // falhou: sem reserva
  const k = sets.filter(x => x.w === s.w && x.r >= s.r && !x.t).length;
  // no nível de treino, cada série igual a mais indica ~1 rep de reserva; na força máxima, mais conservador
  const rir = Math.min(3, generous ? k - 1 : Math.floor((k - 1) * 0.75));
  return { rir: Math.max(0, rir), inferred: rir > 0 };
}

export function best1RM(ex, bw, isBw, { days = 90, tests = true, generous = false } = {}) {
  let best = null;
  const consider = (s, date, test, sets = []) => {
    if (!s.r) return;
    const w = isBw ? bw * bwShare(isBw) + (s.w || 0) : s.w;
    if (!(w > 0)) return;
    // reps que sobraram (anotadas, ou estimadas pelas séries repetidas) contam para estimar o máximo (até 4)
    const { rir: r0, inferred } = test ? { rir: s.rir || 0, inferred: false } : inferredRir(s, sets, generous);
    const rir = Math.min(4, r0 || 0);
    const value = oneRepMax(w, s.r + rir);
    if (!best || value > best.value) best = { value, w: s.w || 0, r: s.r, rir: s.rir ?? (inferred ? rir : null), rirInferred: inferred, sets: inferred ? sets.filter(x => x.w === s.w && x.r >= s.r).length : 0, date, test };
  };
  const from = addDays(new Date(), -days), from180 = addDays(new Date(), -180);
  for (const e of entriesFor(ex.id)) {
    if (new Date(e.date) < from) continue;
    const work = workSets(e.sets);
    for (const s of work) consider(s, e.date, false, work);
  }
  if (tests) for (const tst of ex.tests || []) {
    if (new Date(tst.date) >= from180) consider(tst, tst.date, true);
  }
  return best;
}

/**
 * Nível de TREINO num exercício (o que o radar e o app mostram): pelas séries de trabalho dos últimos 60 dias,
 * contando as séries repetidas como reserva, comparado com adultos em geral (Cooper Institute / ACSM).
 * Retorna { pct, top, lift } ou { reason }: 'noProfile', 'notComparable' (isolador), 'noData' (sem treino recente).
 */
export function strengthLevel(ex, p = profile()) {
  return levelOf(ex, p, { days: 60, tests: false, generous: true }, 'gym');
}
/** Força MÁXIMA: melhor 1RM estimado (ou teste de força) dos últimos 90 dias, comparado com quem registra treinos (Strength Level). */
export function maxLevel(ex, p = profile()) {
  return levelOf(ex, p, { days: 90, tests: true, generous: false }, 'sl');
}
function levelOf(ex, p, opts, refTable) {
  const map = ex?.lib && STRENGTH_LIFTS[ex.lib];
  if (!map) return { reason: 'notComparable' };
  if (!p) return { reason: 'noProfile' };
  const [lift, factor, isBw, std] = map;
  const src = best1RM(ex, p.weight, isBw, opts);
  if (!src) return { reason: 'noData' };
  return { ...levelOf1RM(std, factor, src.value, p, refTable), lift, oneRM: src.value, src, bw: !!isBw };
}

/** Percentil a partir de um 1RM (carga total, já com o peso do corpo nos exercícios de peso corporal). */
function levelOf1RM(std, factor, one, p, refTable = 'gym') {
  const ref = REF_BW[p.sex];
  // normaliza pelo peso corporal (escala alométrica: quem é mais pesado levanta menos por kg) e pela idade
  const ratio = (one / factor / ref) * (ref / p.weight) ** 0.67 / ageFactor(p.age);
  const pct = percentileOf(ratio, (refTable === 'sl' ? STD : GYM)[p.sex][std]);
  return { pct, top: Math.max(1, Math.round(100 - pct)) };
}

/**
 * Consulta rápida, sem salvar nada: em que top de força fica uma série de carga × reps neste exercício.
 * w é a carga total (ou o peso extra, nos exercícios de peso corporal). Retorna null se não der para comparar.
 */
export function quickLevel(libId, w, r, p = profile(), refTable = 'gym') {
  const map = STRENGTH_LIFTS[libId];
  if (!map || !p || !(r >= 1)) return null;
  const [, factor, isBw, std] = map;
  const load = isBw ? p.weight * bwShare(isBw) + (w || 0) : w;
  if (!(load > 0)) return null;
  const one = oneRepMax(load, r);
  return { ...levelOf1RM(std, factor, one, p, refTable), oneRM: one };
}

/** Média dos percentis de força de todos os exercícios comparáveis com registros. */
export function overallStrength(p = profile()) {
  if (!p) return null;
  const levels = Object.values(state.exercises).map(ex => maxLevel(ex, p)).filter(l => l.pct !== undefined);
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
