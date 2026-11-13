// Registro por voz: reconhecimento do navegador + interpretador de frases em português, inglês e espanhol.
import { lang, locale } from './i18n.js';

const RANGE = (words, start = 0) => Object.fromEntries(words.map((w, i) => [w, start + i]));

// Vocabulário de cada idioma (sem acentos: o texto é normalizado antes)
const VOCAB = {
  pt: {
    units: {
      zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
      dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
      dezessete: 17, dezoito: 18, dezenove: 19,
    },
    tens: { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 },
    hundreds: { cem: 100, cento: 100, duzentos: 200, trezentos: 300 },
    and: ['e'], half: /^mei[oa]$/, joinWithoutAnd: false,
    kg: 'kg|quilos?|kilos?', sets: 'series?|sets?', reps: 'rep|reps|repeticao|repeticoes|vezes', weightBefore: 'com|carga',
    setsOf: /\b\d+ (vezes|series) de \d+/,
    undo: /\b(desfaz|desfazer|apaga|apagar|errei|cancela|cancelar|corrige)\b/,
    skip: /\b(pula|pular|pulei)\b/,
    upW: 'mais|subi|aumentei', downW: 'menos|baixei|diminui',
    moreReps: /\b(mais|menos)\s+(\d+)\b/, moreRepsNeg: 'menos',
    fail: /\b(falhei|falha)\b/,
    planned: /\b(bati|meta|planejado|igual|feito|feita|mesma coisa|completei|consegui|fiz)\b/,
    all: /\b(tudo|todas|todos|completo|inteiro)\b/,
    feel: [[/\b(facil|leve|tranquilo|sobrou)\b/, 'easy'], [/\b(na medida|normal|ok|bom|certinho)\b/, 'ok'],
      [/\b(pesado|dificil|sofrido|puxado)\b/, 'hard'], [/\b(ate a falha|falhei|falha)\b/, 'fail']],
    next: /\bproximo\b/,
    warm: /\b(aquecimento|aquecendo|aqueci|aquecer)\b/,
    notWarm: /\b(nao (foi|era) aquecimento|nao e aquecimento|(era|foi|e) (uma )?serie valida|era valida|valeu sim)\b/,
  },
  en: {
    units: {
      ...RANGE(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']),
    },
    tens: { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 },
    hundreds: {},
    and: ['and'], half: /^half$/, joinWithoutAnd: true,
    kg: 'kg|kgs|kilos?|kilograms?', sets: 'sets?', reps: 'reps?|repetitions?|times', weightBefore: 'with|at',
    setsOf: /\b\d+ sets of \d+/,
    undo: /\b(undo|delete|cancel|wrong|oops)\b/,
    skip: /\b(skip|skipped)\b/,
    upW: 'plus|add|added|up', downW: 'minus|less|down|drop',
    moreReps: /\b(plus|minus)\s+(\d+)\b|\b(\d+)\s+(more|less|fewer)\b/, moreRepsNeg: 'minus|less|fewer',
    fail: /\b(failed|fail)\b/,
    planned: /\b(hit|target|goal|planned|same|done|did it|completed|nailed)\b/,
    all: /\b(all|everything)\b/,
    feel: [[/\b(easy|light)\b/, 'easy'], [/\b(ok|okay|fine|good|normal)\b/, 'ok'],
      [/\b(hard|heavy|tough)\b/, 'hard'], [/\b(to failure|failed|failure)\b/, 'fail']],
    next: /\bnext\b/,
    warm: /\b(warm ?up|warmup|warming up|warm-up)\b/,
    notWarm: /\b(not (a )?warm ?up|wasn t (a )?warm ?up|working set|it counted|it was valid)\b/,
  },
  es: {
    units: {
      cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
      diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
      diecinueve: 19, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
      veintisiete: 27, veintiocho: 28, veintinueve: 29,
    },
    tens: { veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 },
    hundreds: { cien: 100, ciento: 100, doscientos: 200, trescientos: 300 },
    and: ['y'], half: /^medi[oa]$/, joinWithoutAnd: false,
    kg: 'kg|kilos?|kilogramos?', sets: 'series?|sets?', reps: 'rep|reps|repeticion|repeticiones|veces', weightBefore: 'con|carga',
    setsOf: /\b\d+ (veces|series) de \d+/,
    undo: /\b(deshacer|deshaz|borrar|borra|cancelar|cancela|me equivoque)\b/,
    skip: /\b(saltar|salta|salte|omitir)\b/,
    upW: 'mas|subi|aumente', downW: 'menos|baje',
    moreReps: /\b(mas|menos)\s+(\d+)\b|\b(\d+)\s+(mas|menos)\b/, moreRepsNeg: 'menos',
    fail: /\b(falle|fallo)\b/,
    planned: /\b(cumpli|meta|objetivo|planeado|igual|hecho|hecha|lo hice|complete|logre)\b/,
    all: /\b(todo|todas|todos|completo)\b/,
    feel: [[/\b(facil|ligero|tranquilo)\b/, 'easy'], [/\b(bien|normal|ok|justo)\b/, 'ok'],
      [/\b(pesado|dificil|duro)\b/, 'hard'], [/\b(al fallo|falle)\b/, 'fail']],
    next: /\bsiguiente\b/,
    warm: /\b(calentamiento|calentando|calente|calentar)\b/,
    notWarm: /\b(no (fue|era|es) calentamiento|(era|fue|es) (una )?serie valida|era valida)\b/,
  },
};

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d),(\d)/g, '$1.$2')
  .replace(/(\d)\s*(kg|kgs|kilos?|quilos?)\b/g, '$1 kg')
  .replace(/[×*]/g, ' x ')
  .replace(/(\d)x(\d)/g, '$1 x $2')
  .replace(/[^a-z0-9. ]/g, ' ')
  .replace(/\.(?!\d)/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Troca números por extenso por dígitos: "quarenta e dois e meio" / "forty two and a half" -> "42.5". */
export function wordsToDigits(text, l = lang()) {
  const V = VOCAB[l] || VOCAB.pt;
  const tk = norm(text).split(' ');
  const out = [];
  let i = 0;
  const value = w => V.units[w] ?? V.tens[w] ?? V.hundreds[w];
  // ordem de grandeza: 3 = centenas, 2 = dezenas, 1 = unidades (inclui "dez a dezenove")
  const cat = w => (w in V.hundreds ? 3 : w in V.tens ? 2 : w in V.units ? 1 : 0);
  while (i < tk.length) {
    const c = cat(tk[i]);
    const isDigit = /^\d+(\.\d+)?$/.test(tk[i]);
    if (!c && !isDigit) { out.push(tk[i]); i++; continue; }
    let total = c ? value(tk[i]) : Number(tk[i]);
    let level = c;
    i++;
    // inglês: "one hundred twenty"
    if (tk[i] === 'hundred' && c === 1) { total *= 100; level = 3; i++; }
    // partes de ordem menor: "cento e vinte e dois", "treinta y dos", "twenty two"
    for (;;) {
      if (level < 2) break;
      if (V.and.includes(tk[i]) && cat(tk[i + 1]) && cat(tk[i + 1]) < level) {
        level = cat(tk[i + 1]); total += value(tk[i + 1]); i += 2; continue;
      }
      if (V.joinWithoutAnd && cat(tk[i]) && cat(tk[i]) < level) {
        level = cat(tk[i]); total += value(tk[i]); i++; continue;
      }
      break;
    }
    // "e meio" / "y medio" / "and a half"
    if (V.and.includes(tk[i]) && V.half.test(tk[i + 1] || '')) { total += 0.5; i += 2; }
    else if (V.and.includes(tk[i]) && tk[i + 1] === 'a' && V.half.test(tk[i + 2] || '')) { total += 0.5; i += 3; }
    else if (tk[i] === 'point' && cat(tk[i + 1]) === 1 && value(tk[i + 1]) < 10) { total += value(tk[i + 1]) / 10; i += 2; }
    out.push(String(total));
  }
  return out.join(' ');
}

/**
 * Interpreta o que foi dito e devolve uma lista de ações:
 *  { type:'set', w?, r?, fail? }  { type:'planned', all? }  { type:'delta', dr? , dw? }
 *  { type:'feel', v }  { type:'skip' }  { type:'next' }  { type:'undo' }
 *  { type:'warm' } (a última série, ou a próxima, foi aquecimento)  { type:'unwarm' } (não foi aquecimento)
 *  séries ditas junto com "aquecimento" vêm com warm: true
 */
export function parseUtterance(raw, l = lang()) {
  const V = VOCAB[l] || VOCAB.pt;
  const txt = wordsToDigits(raw, l);
  const acts = [];
  if (!txt) return acts;

  if (V.notWarm.test(txt)) return [{ type: 'unwarm' }];
  const warm = V.warm.test(txt);
  if (V.undo.test(txt)) return [{ type: 'undo' }];
  if (V.skip.test(txt)) return [{ type: 'skip' }];

  // "mais 5 quilos" / "plus 5 kilos" / "más 5 kilos": muda a carga da próxima série
  let m = txt.match(new RegExp(`\\b(${V.upW}|${V.downW})\\s+(\\d+(?:\\.\\d+)?)\\s*(?:${V.kg})\\b`));
  if (m) {
    const neg = new RegExp(`^(${V.downW})$`).test(m[1]);
    acts.push({ type: 'delta', dw: (neg ? -1 : 1) * Number(m[2]) });
  } else if ((m = txt.match(V.moreReps))) {
    // "mais uma" / "one more" / "menos dos": a meta com reps a mais ou a menos
    const word = m[1] || m[4];
    const n = Number(m[2] || m[3]);
    const neg = new RegExp(`^(${V.moreRepsNeg})$`).test(word);
    acts.push({ type: 'delta', dr: (neg ? -1 : 1) * n });
  } else {
    // números com o papel de cada um
    const tk = txt.split(' ');
    const nums = [];
    tk.forEach((x, i) => {
      if (!/^\d+(\.\d+)?$/.test(x)) return;
      const nx = tk[i + 1] || '', pv = tk[i - 1] || '';
      let role = null;
      if (new RegExp(`^(${V.kg})$`).test(nx)) role = 'w';
      else if (new RegExp(`^(${V.sets})$`).test(nx)) role = 'n';
      else if (new RegExp(`^(${V.reps})$`).test(nx) && !new RegExp(`^(${V.sets})$`).test(tk[i + 2] || '')) role = 'r';
      else if (new RegExp(`^(${V.weightBefore})$`).test(pv)) role = 'w';
      nums.push({ v: Number(x), role });
    });
    // "3 vezes de 10": o primeiro é o número de séries
    if (V.setsOf.test(txt)) {
      const f = nums.find(n => n.role === 'r' || n.role === 'n');
      if (f) f.role = 'n';
      const second = nums.find(n => n !== f && n.role !== 'w');
      if (second && second.role === null) second.role = 'r';
    }

    if (nums.length) {
      let nSets = nums.find(n => n.role === 'n')?.v;
      let w = nums.find(n => n.role === 'w')?.v;
      const reps = nums.filter(n => n.role === 'r').map(n => n.v);
      const free = nums.filter(n => n.role === null).map(n => n.v);
      // "3 x 10 com 50": séries x reps quando a carga já foi dita à parte
      if (w !== undefined && nSets === undefined && free.length === 2 && !reps.length && /\d x \d/.test(txt)) nSets = free.shift();
      if (w === undefined && free.length + reps.length >= 2 && free.length) w = free.shift();
      reps.push(...free);
      const fail = V.fail.test(txt);
      const list = reps.length ? reps : [undefined];
      const times = reps.length <= 1 && nSets ? Math.min(nSets, 10) : 1;
      for (let k = 0; k < times; k++) {
        for (const r of list) {
          const a = { type: 'set' };
          if (w !== undefined) a.w = w;
          if (r !== undefined) a.r = Math.round(r);
          if (fail) a.fail = true;
          if (warm) a.warm = true;
          acts.push(a);
        }
      }
    } else if (V.planned.test(txt)) {
      acts.push({ type: 'planned', all: V.all.test(txt) });
    }
  }

  for (const [re, v] of V.feel) {
    if (re.test(txt)) {
      // "falhei" junto de números já marcou a série; só vira sensação se vier sozinho
      if (v === 'fail' && acts.some(a => a.type === 'set')) break;
      acts.push({ type: 'feel', v });
      break;
    }
  }
  // "foi aquecimento" sem números: marca a última série (ou a próxima) como aquecimento
  if (warm && !acts.some(a => a.type === 'set')) return [{ type: 'warm' }];
  if (V.next.test(txt)) acts.push({ type: 'next' });
  return acts;
}

// ---------- Reconhecimento de fala do navegador ----------

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const voiceSupported = () => !!SR;
let rec = null;

export function listen(onInterim) {
  return new Promise((resolve, reject) => {
    rec = new SR();
    rec.lang = locale();
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let text = '';
    rec.onresult = e => {
      text = [...e.results].map(r => r[0].transcript).join(' ');
      onInterim?.(text);
    };
    rec.onerror = e => reject(new Error(e.error || 'erro'));
    rec.onend = () => (text ? resolve(text) : reject(new Error('no-speech')));
    rec.start();
  });
}

export function stopListening() { try { rec?.stop(); } catch { /* já parado */ } }
export function abortListening() { try { rec?.abort(); } catch { /* já parado */ } }
