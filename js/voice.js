// Registro por voz: reconhecimento do navegador + interpretador de frases em português.

const UNITS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19,
};
const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const HUNDREDS = { cem: 100, cento: 100, duzentos: 200, trezentos: 300 };

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d),(\d)/g, '$1.$2')
  .replace(/(\d)\s*(kg|kilos?|quilos?)\b/g, '$1 kg')
  .replace(/[×*]/g, ' x ')
  .replace(/(\d)x(\d)/g, '$1 x $2')
  .replace(/[^a-z0-9. ]/g, ' ')
  .replace(/\.(?!\d)/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Troca números por extenso por dígitos: "quarenta e dois e meio" -> "42.5". */
export function wordsToDigits(text) {
  const tk = norm(text).split(' ');
  const out = [];
  let i = 0;
  const value = t => UNITS[t] ?? TENS[t] ?? HUNDREDS[t];
  // ordem de grandeza: 3 = centenas, 2 = dezenas, 1 = unidades e "dez a dezenove"
  const cat = t => (t in HUNDREDS ? 3 : t in TENS ? 2 : t in UNITS ? 1 : 0);
  while (i < tk.length) {
    const c = cat(tk[i]);
    const isDigit = /^\d+(\.\d+)?$/.test(tk[i]);
    if (!c && !isDigit) { out.push(tk[i]); i++; continue; }
    let total = c ? value(tk[i]) : Number(tk[i]);
    let level = c;
    i++;
    // "cento e vinte e dois": só soma partes de ordem menor ligadas por "e"
    while (level >= 2 && tk[i] === 'e' && cat(tk[i + 1]) && cat(tk[i + 1]) < level) {
      level = cat(tk[i + 1]);
      total += value(tk[i + 1]);
      i += 2;
    }
    if (tk[i] === 'e' && /^mei[oa]$/.test(tk[i + 1] || '')) { total += 0.5; i += 2; }
    out.push(String(total));
  }
  return out.join(' ');
}

const FEEL = [
  [/\b(facil|leve|tranquilo|sobrou)\b/, 'easy'],
  [/\b(na medida|normal|ok|bom|certinho)\b/, 'ok'],
  [/\b(pesado|dificil|sofrido|puxado)\b/, 'hard'],
  [/\b(ate a falha|falhei|falha)\b/, 'fail'],
];

/**
 * Interpreta o que foi dito e devolve uma lista de ações:
 *  { type:'set', w?, r?, fail? }  { type:'planned', all? }  { type:'delta', dr? , dw? }
 *  { type:'feel', v }  { type:'skip' }  { type:'next' }  { type:'undo' }
 */
export function parseUtterance(raw) {
  const t = wordsToDigits(raw);
  const acts = [];
  if (!t) return acts;

  if (/\b(desfaz|desfazer|apaga|apagar|errei|cancela|cancelar|corrige)\b/.test(t)) return [{ type: 'undo' }];
  if (/\b(pula|pular|pulei)\b/.test(t)) return [{ type: 'skip' }];

  const kgWord = '(?:kg|quilos?|kilos?)';
  // "mais 5 quilos" / "menos 2.5 kg": muda a carga da próxima série
  let m = t.match(new RegExp(`\\b(mais|menos|subi|baixei|aumentei|diminui)\\s+(\\d+(?:\\.\\d+)?)\\s*${kgWord}`));
  if (m) {
    const neg = /menos|baixei|diminui/.test(m[1]);
    acts.push({ type: 'delta', dw: (neg ? -1 : 1) * Number(m[2]) });
  } else if ((m = t.match(/\b(mais|menos)\s+(\d+)\b/))) {
    // "mais uma", "menos duas reps": a meta com reps a mais ou a menos
    acts.push({ type: 'delta', dr: (m[1] === 'menos' ? -1 : 1) * Number(m[2]) });
  } else {
    // números com o papel de cada um
    const tk = t.split(' ');
    const nums = [];
    tk.forEach((x, i) => {
      if (!/^\d+(\.\d+)?$/.test(x)) return;
      const nx = tk[i + 1] || '', pv = tk[i - 1] || '';
      let role = null;
      if (/^(kg|quilos?|kilos?)$/.test(nx)) role = 'w';
      else if (/^(series?|sets?)$/.test(nx)) role = 'n';
      else if (/^(rep|reps|repeticao|repeticoes|vezes)$/.test(nx) && !/^(series?)$/.test(tk[i + 2] || '')) role = 'r';
      else if (/^(com|carga)$/.test(pv)) role = 'w';
      nums.push({ v: Number(x), role });
    });
    // "3 vezes de 10": o primeiro é o número de séries
    if (/\b\d+ vezes de \d+/.test(t)) { const f = nums.find(n => n.role === 'r'); if (f) f.role = 'n'; }

    if (nums.length) {
      let nSets = nums.find(n => n.role === 'n')?.v;
      let w = nums.find(n => n.role === 'w')?.v;
      const reps = nums.filter(n => n.role === 'r').map(n => n.v);
      const free = nums.filter(n => n.role === null).map(n => n.v);
      // "3 x 10 com 50": séries x reps quando a carga já foi dita à parte
      if (w !== undefined && nSets === undefined && free.length === 2 && !reps.length && /\d x \d/.test(t)) nSets = free.shift();
      if (w === undefined && free.length + reps.length >= 2 && free.length) w = free.shift();
      reps.push(...free);
      const fail = /\b(falhei|falha)\b/.test(t);
      const list = reps.length ? reps : [undefined];
      const times = reps.length <= 1 && nSets ? Math.min(nSets, 10) : 1;
      for (let k = 0; k < times; k++) {
        for (const r of list) {
          const a = { type: 'set' };
          if (w !== undefined) a.w = w;
          if (r !== undefined) a.r = Math.round(r);
          if (fail) a.fail = true;
          acts.push(a);
        }
      }
    } else if (/\b(bati|meta|planejado|igual|feito|feita|mesma coisa|completei|consegui|fiz)\b/.test(t)) {
      acts.push({ type: 'planned', all: /\b(tudo|todas|todos|completo|inteiro)\b/.test(t) });
    }
  }

  for (const [re, v] of FEEL) {
    if (re.test(t)) {
      // "falhei" junto de números já marcou a série; só vira sensação se vier sozinho
      if (v === 'fail' && acts.some(a => a.type === 'set')) break;
      acts.push({ type: 'feel', v });
      break;
    }
  }
  if (/\bproximo\b/.test(t)) acts.push({ type: 'next' });
  return acts;
}

// ---------- Reconhecimento de fala do navegador ----------

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const voiceSupported = () => !!SR;
let rec = null;

export function listen(onInterim) {
  return new Promise((resolve, reject) => {
    rec = new SR();
    rec.lang = 'pt-BR';
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
