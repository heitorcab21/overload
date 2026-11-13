// Importar treinos escritos em texto livre (bloco de notas, WhatsApp...).
// Funciona sem IA: reconhece séries ("15kg 10 rep", "40x12", "3x10 com 50"), descanso ("1:30 min"),
// datas, grupamentos ("• Tríceps") e nomes de exercícios, inclusive abreviados ("EL. LATERAL").
import { LIB, GROUPS } from './data.js';
import { exNamesAll, allLangs } from './i18n.js';
import { state } from './store.js';

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9.,:/x×\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- Grupamentos ----------

const GROUP_ALIASES = {
  'Peito': ['peito', 'peitoral', 'chest', 'pecho', 'pec'],
  'Costas': ['costas', 'costa', 'dorsal', 'back', 'espalda'],
  'Ombros': ['ombro', 'ombros', 'deltoide', 'deltoides', 'shoulder', 'shoulders', 'hombro', 'hombros'],
  'Bíceps': ['biceps', 'bicep', 'bi'],
  'Tríceps': ['triceps', 'tricep', 'tri'],
  'Quadríceps': ['quadriceps', 'quadricep', 'quad', 'quads', 'perna', 'pernas', 'legs', 'leg day', 'piernas', 'coxa', 'coxas'],
  'Posteriores': ['posterior', 'posteriores', 'posterior de coxa', 'hamstrings', 'isquiotibiais', 'femoral', 'femorales'],
  'Glúteos': ['gluteo', 'gluteos', 'glutes', 'glute', 'bumbum'],
  'Panturrilhas': ['panturrilha', 'panturrilhas', 'calves', 'calf', 'gemeos', 'pantorrilla', 'pantorrillas', 'gemelos'],
  'Abdômen': ['abdomen', 'abdominal', 'abdominais', 'abs', 'abdome', 'core'],
};
const GROUP_OF = new Map();
for (const g of GROUPS) {
  for (const a of [...(GROUP_ALIASES[g] || []), ...allLangs(g).map(norm)]) GROUP_OF.set(norm(a), g);
}
/** Se a linha for só o nome de um grupamento ("• Tríceps_", "OMBRO:"), devolve o grupamento. */
export function groupOfLine(line) {
  const n = norm(line).replace(/[.:,\-/]/g, ' ').replace(/\s+/g, ' ').trim();
  return GROUP_OF.get(n) || null;
}

// ---------- Exercícios ----------

const ABBR = {
  el: 'elevacao', elev: 'elevacao', desenv: 'desenvolvimento', desenvolv: 'desenvolvimento', sup: 'supino',
  agach: 'agachamento', agacho: 'agachamento', ext: 'extensora', flex: 'flexora', abd: 'abdominal', pant: 'panturrilha',
  tri: 'triceps', bi: 'biceps', inc: 'inclinado', incl: 'inclinado', cross: 'crossover', alt: 'alternada',
  unil: 'unilateral', lat: 'lateral', front: 'frontal', hbc: 'halteres', halter: 'halteres', db: 'halteres',
  pulldown: 'puxada', pulley: 'polia', rdl: 'stiff', elevacao: 'elevacao', gemeos: 'panturrilha',
};
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'na', 'no', 'nas', 'nos', 'em', 'e', 'a', 'o', 'as', 'os', 'the', 'with',
  'con', 'en', 'el', 'la', 'los', 'las', 'y', 'on', 'of', 'para', 'por', 'pe', 'aparelho']);
const tokens = s => norm(s).replace(/[.,:/\-×]/g, ' ').split(' ').filter(Boolean)
  .map(w => ABBR[w] || w).filter(w => !STOP.has(w));

// gírias e nomes comuns de academia que não estão no nome do exercício
const ALIASES = {
  'triceps-corda': ['corda', 'triceps corda', 'pulley corda'],
  'triceps-barra': ['barra v', 'triceps barra', 'pulley', 'triceps pulley', 'pushdown', 'barra reta'],
  'triceps-testa': ['testa', 'triceps testa', 'skull'],
  'triceps-frances': ['frances', 'triceps frances'],
  'triceps-coice': ['coice', 'kickback'],
  'peck-deck': ['voador', 'peck deck', 'fly maquina', 'crucifixo maquina'],
  'crucifixo-inverso': ['voador inverso', 'crucifixo inverso', 'peck deck inverso', 'reverse fly'],
  'crossover': ['cross', 'cross over', 'crossover', 'cross infra', 'cross alto', 'cross baixo'],
  'puxada-frente': ['puxada alta', 'puxada', 'pulley frente', 'lat pulldown', 'puxada aberta'],
  'remada-unilateral': ['serrote', 'remada serrote'],
  'leg-press': ['leg', 'leg 45', 'leg press', 'legpress'],
  'cadeira-extensora': ['extensora', 'cadeira extensora'],
  'mesa-flexora': ['flexora', 'mesa flexora', 'flexora deitado'],
  'cadeira-flexora': ['flexora sentado', 'cadeira flexora'],
  'elevacao-pelvica': ['hip thrust', 'elevacao pelvica', 'pelvica'],
  'mergulho': ['paralela', 'paralelas', 'dips'],
  'barra-fixa': ['barra fixa', 'pull up', 'pullup', 'barra'],
  'agachamento-livre': ['agachamento', 'squat', 'agachamento barra'],
  'levantamento-terra': ['terra', 'deadlift', 'lev terra'],
  'abdominal-supra': ['abdominal', 'abdominal supra', 'crunch'],
  'panturrilha-em-pe': ['panturrilha', 'gemeos'],
  'desenvolvimento-halteres': ['desenvolvimento'],
  'elevacao-lateral': ['lateral', 'elevacao lateral'],
  'rosca-direta': ['rosca', 'rosca barra'],
  'supino-reto': ['supino'],
};

function candidates() {
  const list = [];
  for (const l of LIB) {
    const names = [l.name, ...exNamesAll(l.id), ...(ALIASES[l.id] || [])];
    for (const n of names) list.push({ id: l.id, group: l.group, toks: tokens(n), alias: (ALIASES[l.id] || []).includes(n) });
  }
  for (const ex of Object.values(state.exercises || {})) {
    if (!ex.lib) list.push({ id: ex.id, group: ex.group, toks: tokens(ex.name) });
  }
  return list;
}

const tokMatch = (h, n) => h === n || (h.length >= 3 && n.length >= 3 && (n.startsWith(h) || h.startsWith(n)));

/** Encontra o exercício mais parecido com o nome escrito. Retorna { id, score } (id null se não achou). */
export function matchExercise(raw, group = null) {
  const H = tokens(raw);
  if (!H.length) return { id: null, score: 0 };
  let best = { id: null, score: 0 };
  for (const c of candidates()) {
    if (!c.toks.length) continue;
    const hit = H.filter(h => c.toks.some(n => tokMatch(h, n))).length;
    if (!hit) continue;
    const nHit = c.toks.filter(n => H.some(h => tokMatch(h, n))).length;
    let score = (hit / H.length) * 0.7 + (nHit / c.toks.length) * 0.3;
    // o grupamento anotado antes ajuda a desempatar, na proporção do que o nome já bateu
    if (group) score += (c.group === group ? 0.25 : -0.15) * (hit / H.length);
    if (c.alias && hit === H.length && nHit === c.toks.length) score += 0.1; // apelido exato
    if (score > best.score) best = { id: c.id, score };
  }
  return best.score >= 0.5 ? best : { id: null, score: best.score };
}

// ---------- Linhas ----------

const NUM = '(\\d+(?:[.,]\\d+)?)';
const num = s => Number(String(s).replace(',', '.'));

/** Séries de uma linha. "15kg 10 rep", "40x12", "40 kg x 12", "3x10 com 50", "50kg 12/10/8", "12 reps". */
export function setsOfLine(line) {
  const s = norm(line).replace(/×/g, 'x');
  let m;
  // 3x10 com 50kg | 4 x 12 50kg | 3x10 @ 40
  if ((m = s.match(new RegExp(`^(\\d{1,2})\\s*x\\s*(\\d{1,3})\\s*(?:com|c/|de|@|-|:)?\\s*${NUM}\\s*(?:kg|kgs|quilos?)\\b`)))
    || (m = s.match(new RegExp(`^(\\d{1,2})\\s*x\\s*(\\d{1,3})\\s*(?:com|c/|@)\\s*${NUM}`)))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 10) return Array.from({ length: n }, () => ({ w: num(m[3]), r: Number(m[2]) }));
  }
  // 50kg 12/10/8 | 50kg: 12, 10, 8
  if ((m = s.match(new RegExp(`^${NUM}\\s*(?:kg|kgs|quilos?)\\s*[:\\-]?\\s*((?:\\d{1,3}\\s*[/,;-]\\s*)+\\d{1,3})\\s*(?:reps?|repeticoes|r)?$`)))) {
    return m[2].split(/[/,;-]/).map(r => ({ w: num(m[1]), r: Number(r.trim()) })).filter(x => x.r > 0);
  }
  // 15kg 10 rep | 15 kg - 10 reps | 15kg x 10 | 40x12 | 40 x 12 reps
  if ((m = s.match(new RegExp(`${NUM}\\s*(?:kg|kgs|quilos?)\\s*(?:x|-|:|,|por)?\\s*(\\d{1,3})\\s*(?:reps?|repeticoes|repeticiones|r)?\\b`)))
    || (m = s.match(new RegExp(`^${NUM}\\s*x\\s*(\\d{1,3})\\s*(?:reps?|repeticoes|r)?$`)))
    || (m = s.match(new RegExp(`^(\\d{1,3})\\s*(?:reps?|repeticoes|repeticiones)\\s*(?:com|c/|de|@|-|x)?\\s*${NUM}\\s*(?:kg|kgs)`)))) {
    // o último padrão vem como reps, carga
    const isRepsFirst = /^\d{1,3}\s*(?:reps?|repeticoes|repeticiones)/.test(s);
    return [isRepsFirst ? { w: num(m[2]), r: Number(m[1]) } : { w: num(m[1]), r: Number(m[2]) }];
  }
  // só repetições (peso corporal): "12 reps"
  if ((m = s.match(/^(\d{1,3})\s*(?:reps?|repeticoes|repeticiones)$/))) return [{ w: 0, r: Number(m[1]) }];
  return [];
}

/** Descanso em segundos: "(1:30 min descanso)", "1:30min", "90s", "2 min". */
export function restOfLine(line) {
  const s = norm(line);
  if (/\d\s*(kg|reps?)\b/.test(s)) return null;
  let m;
  if ((m = s.match(/(\d{1,2}):(\d{2})\s*(min|m)?/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/(\d{1,3})\s*(s|seg|segundos|segs|sec)\b/))) return Number(m[1]);
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(min|minutos?|minutes?)\b/))) return Math.round(num(m[1]) * 60);
  return null;
}

/** Data no começo da linha: "12/11", "12/11/2026", "12.11.26". Devolve ISO ou null. */
export function dateOfLine(line, now = new Date()) {
  const m = norm(line).match(/^(?:\D{0,12})?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (!m || /kg|rep/.test(norm(line))) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  let y = m[3] ? Number(m[3]) : now.getFullYear();
  if (y < 100) y += 2000;
  const dt = new Date(y, mo - 1, d, 12);
  if (!m[3] && dt > now) dt.setFullYear(y - 1); // "12/12" em novembro = ano passado
  return dt.toISOString();
}

const SESSION_WORDS = /^(treino|workout|entreno|entrenamiento|dia|day|ficha|rotina|sessao)\b/;

/**
 * Lê o texto e devolve { sessions: [{ date, name, items: [{ raw, group, rest, sets, id, score }] }] }.
 * Cada exercício ganha o id do exercício mais parecido (ou null, para virar um exercício novo).
 */
export function parseWorkoutText(text, now = new Date()) {
  const sessions = [];
  let cur = null, item = null, group = null;
  const newSession = (date = null, name = null) => { cur = { date, name, items: [] }; sessions.push(cur); item = null; };
  const newItem = raw => {
    if (!cur) newSession();
    item = { raw: raw.trim(), group, rest: null, sets: [] };
    cur.items.push(item);
  };
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/[─—–_=*#|•·►▶➤✅✔️🔥💪]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const sets = setsOfLine(line);
    if (sets.length && !/^[^\d]*[a-z]{3,}/i.test(norm(line))) {
      if (!item) newItem('');
      item.sets.push(...sets);
      continue;
    }
    // nome e séries na mesma linha: "Leg press 3x12 com 120kg", "Rosca alternada: 14kg 12/10/8"
    const inl = line.match(/^(.*?[A-Za-zÀ-ÿ]{3,}.*?)[\s:–—-]+(\d.*)$/);
    if (inl && !dateOfLine(line, now)) {
      const s2 = setsOfLine(inl[2]);
      if (s2.length) {
        newItem(inl[1].replace(/[\s:.,–—-]+$/, ''));
        item.sets.push(...s2);
        continue;
      }
    }
    const date = dateOfLine(line, now);
    if (date) {
      const rest = line.replace(/^\D{0,12}\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?/, '').replace(/^[\s:,-]+/, '').trim();
      newSession(date, rest && !groupOfLine(rest) ? rest : null);
      if (rest && groupOfLine(rest)) group = groupOfLine(rest);
      continue;
    }
    const rest = restOfLine(line);
    if (rest != null && !/[a-z]{4,}/.test(norm(line).replace(/(min|minutos?|descanso|intervalo|rest|segundos|seg)/g, ''))) {
      if (item) item.rest = rest;
      continue;
    }
    const g = groupOfLine(line);
    if (g) { group = g; item = null; continue; }
    if (SESSION_WORDS.test(norm(line)) && !matchExercise(line, group).id) {
      if (!cur || cur.items.length) newSession(cur?.date ?? null, line);
      else cur.name = line;
      continue;
    }
    if (/[a-z]/i.test(norm(line))) newItem(line);
  }
  for (const s of sessions) {
    s.items = s.items.filter(i => i.sets.length);
    for (const i of s.items) Object.assign(i, matchExercise(i.raw, i.group));
  }
  return { sessions: sessions.filter(s => s.items.length) };
}
