// Memória do Treinador: conversa contínua, caderno de fatos sobre a pessoa e resumo das conversas antigas.
// Fica em state.coach, que sincroniza pelo Drive junto com o resto dos dados.
import { state, uid } from './store.js';

export const KEEP = 12;        // mensagens recentes que vão inteiras para a IA
export const FOLD_AT = 24;     // acima disso (fora do resumo), as mais antigas viram resumo
export const MAX_STORED = 120; // mensagens guardadas para mostrar na tela
export const MAX_NOTES = 40;   // fatos no caderno

export const coach = () => (state.coach ??= { chat: [], notes: [], summary: '', folded: 0, checkinAt: 0 });

/**
 * Mensagens para a IA: só as válidas, depois do que já virou resumo, as últimas KEEP,
 * juntando mensagens seguidas do mesmo lado e começando por uma da pessoa (as APIs exigem).
 */
export function apiMessages(chat = coach().chat, folded = coach().folded) {
  const live = chat.slice(folded).filter(m => !m.error).slice(-KEEP);
  const out = [];
  for (const m of live) {
    const last = out.at(-1);
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '(abri o chat do Treinador)' });
  return out;
}

/** Trecho que deve virar resumo agora: [de, até) no chat, ou null se ainda não precisa. */
export function foldRange(chat = coach().chat, folded = coach().folded) {
  const pending = chat.length - folded;
  if (pending <= FOLD_AT) return null;
  return [folded, chat.length - KEEP];
}

/** Aplica as mudanças sugeridas pela IA no caderno: { add: [texto], update: [{ id, text }], remove: [id] }. */
export function applyNotes(ops, now = new Date()) {
  const c = coach();
  const day = now.toISOString().slice(0, 10);
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const rm = new Set(ops?.remove || []);
  c.notes = c.notes.filter(n => !rm.has(n.id));
  for (const u of ops?.update || []) {
    const n = c.notes.find(x => x.id === u.id);
    if (n && clean(u.text)) { n.text = clean(u.text); n.at = day; }
  }
  for (const a of (ops?.add || []).slice(0, 3)) {
    const text = clean(a);
    if (text && !c.notes.some(n => n.text.toLowerCase() === text.toLowerCase())) c.notes.push({ id: uid(), text, at: day });
  }
  c.notes = c.notes.slice(-MAX_NOTES);
  return c.notes;
}

/** Corta o histórico guardado sem perder o que ainda não virou resumo. */
export function trimChat() {
  const c = coach();
  const cut = Math.max(0, Math.min(c.folded, c.chat.length - MAX_STORED));
  if (cut > 0) { c.chat = c.chat.slice(cut); c.folded -= cut; }
}

/**
 * O Treinador puxa assunto ao abrir o chat: no máximo uma vez a cada 18 h, se já houver algo para comentar
 * (caderno, conversa ou treinos) e a última mensagem tiver mais de 3 h.
 */
export function shouldCheckin(now = Date.now()) {
  const c = coach();
  const last = c.chat.at(-1);
  const hasMaterial = c.notes.length || c.chat.length || state.sessions.length;
  if (!hasMaterial) return false;
  if (now - (c.checkinAt || 0) < 18 * 3600e3) return false;
  if (last && now - (last.at || 0) < 3 * 3600e3) return false;
  return true;
}

/** Texto do caderno e do resumo para o pedido à IA. */
export function memoryText() {
  const c = coach();
  const notes = c.notes.length ? c.notes.map(n => `- [${n.id}] ${n.at.split('-').reverse().join('/')}: ${n.text}`).join('\n') : '- (vazio)';
  return { notes, summary: c.summary || '(nenhuma conversa anterior resumida)' };
}
