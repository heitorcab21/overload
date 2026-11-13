// Card para stories (1080 × 1920): resumo do treino pronto para postar no Instagram ou WhatsApp.
import { state } from './store.js';
import { exName, routineName } from './data.js';
import { t, tn, locale } from './i18n.js';
import { weekLetters, fmt, compact } from './ui.js';
import { tonnage, bestOf, e1rm, sessionPRs, weekStart, sessionsIn, addDays } from './logic.js';
import { strengthLevel } from './body.js';

const W = 1080, H = 1920;
const ACCENT = '#eb6834';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Quebra o texto em até n linhas; a última ganha reticências se sobrar. */
function wrap(ctx, text, maxW, n) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryLine).width <= maxW || !cur) cur = tryLine;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > n) lines.splice(n - 1, lines.length, lines.slice(n - 1).join(' '));
  return lines.map(l => fitText(ctx, l, maxW));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const bestSet = sets => sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
const setTxt = s => (s.w > 0 ? `${fmt(s.w)} kg × ${s.r}` : `${s.r} reps`);

/** Desenha o card do treino e devolve um Blob PNG. */
export async function storyCard(session) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // fundo escuro com brilho laranja no topo
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 40, W * 0.85, 120, 900);
  glow.addColorStop(0, 'rgba(235,104,52,.45)');
  glow.addColorStop(1, 'rgba(235,104,52,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const X = 84, CW = W - X * 2;
  let y = 150;

  // marca
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.arc(X + 34, y - 14, 34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(X + 34, y + 2); ctx.lineTo(X + 34, y - 32); ctx.moveTo(X + 20, y - 18); ctx.lineTo(X + 34, y - 32); ctx.lineTo(X + 48, y - 18); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `800 52px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Overload', X + 88, y + 4);

  // título
  y += 150;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(t('TREINO CONCLUÍDO').toUpperCase(), X, y);
  y += 92;
  ctx.fillStyle = '#fff';
  ctx.font = `800 76px ${FONT}`;
  for (const [i, line] of wrap(ctx, routineName(session), CW, 2).entries()) {
    if (i) y += 84;
    ctx.fillText(line, X, y);
  }
  y += 58;
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(new Date(session.date).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }), X, y);

  // números
  const done = session.entries.filter(e => !e.skipped && e.sets.length);
  const sets = done.reduce((n, e) => n + e.sets.length, 0);
  const ton = done.reduce((n, e) => n + tonnage(e.sets), 0);
  const prs = sessionPRs(session);
  const prIds = new Set(prs.map(p => p.exId));
  const stats = [
    [session.dur ? `${session.dur}` : '—', t('minutos')],
    [`${sets}`, t('séries')],
    [compact(ton), t('de volume')],
    [`${prs.length}`, tn(prs.length, 'recorde', 'recordes')],
  ];
  y += 70;
  const gap = 20, bw = (CW - gap * 3) / 4, bh = 190;
  stats.forEach(([v, l], i) => {
    const bx = X + i * (bw + gap);
    roundRect(ctx, bx, y, bw, bh, 28);
    ctx.fillStyle = i === 3 && prs.length ? 'rgba(235,104,52,.22)' : 'rgba(255,255,255,.07)';
    ctx.fill();
    ctx.fillStyle = i === 3 && prs.length ? ACCENT : '#fff';
    let size = 64;
    do { ctx.font = `800 ${size}px ${FONT}`; size -= 4; } while (ctx.measureText(v).width > bw - 28 && size > 30);
    ctx.textAlign = 'center';
    ctx.fillText(v, bx + bw / 2, y + 100);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(fitText(ctx, l, bw - 20), bx + bw / 2, y + 150);
    ctx.textAlign = 'left';
  });
  y += bh + 80;

  const lv = done.map(e => [e, state.exercises[e.exId] && strengthLevel(state.exercises[e.exId])]).filter(([, l]) => l?.top)
    .sort((a, b) => a[1].top - b[1].top)[0];
  const by = H - (lv ? 480 : 330);

  // exercícios: quantos couberem antes da semana
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(t('O QUE EU FIZ').toUpperCase(), X, y);
  y += 30;
  const fit = Math.max(1, Math.floor((by - 70 - y) / 84));
  const show = done.slice(0, done.length > fit ? fit - 1 : fit);
  for (const e of show) {
    const ex = state.exercises[e.exId];
    const pr = prIds.has(e.exId);
    y += 84;
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X, y - 58); ctx.lineTo(X + CW, y - 58); ctx.stroke();
    const right = `${setTxt(bestSet(e.sets))}${pr ? '  🏆' : ''}`;
    ctx.font = `700 38px ${FONT}`;
    const rw = ctx.measureText(right).width;
    ctx.fillStyle = pr ? ACCENT : '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(right, X + CW, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(fitText(ctx, ex ? exName(ex) : '—', CW - rw - 30), X, y);
  }
  if (done.length > show.length) {
    y += 70;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = `500 32px ${FONT}`;
    ctx.fillText(tn(done.length - show.length, '+ {n} exercício', '+ {n} exercícios'), X, y);
  }

  // semana
  const ws = weekStart(new Date(session.date));
  const trained = new Set(sessionsIn(ws, addDays(ws, 7)).map(s => (new Date(s.date).getDay() + 6) % 7));
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(t('MINHA SEMANA').toUpperCase(), X, by);
  const step = CW / 7;
  weekLetters().forEach((d, i) => {
    const cx = X + step * i + step / 2, cy = by + 90;
    ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    if (trained.has(i)) { ctx.fillStyle = ACCENT; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.fillStyle = trained.has(i) ? '#fff' : 'rgba(255,255,255,.55)';
    ctx.font = `700 32px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(d, cx, cy + 11);
    ctx.textAlign = 'left';
  });

  if (lv) {
    const [e, l] = lv;
    const ly = by + 190;
    roundRect(ctx, X, ly, CW, 120, 28);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `600 34px ${FONT}`;
    const tag = t('Top {n}% de força', { n: l.top });
    ctx.font = `800 40px ${FONT}`;
    const tw = ctx.measureText(tag).width;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'right';
    ctx.fillText(tag, X + CW - 32, ly + 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(fitText(ctx, exName(state.exercises[e.exId]), CW - tw - 96), X + 32, ly + 72);
  }

  // rodapé
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = `500 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(t('Registrado com o Overload'), W / 2, H - 70);
  ctx.textAlign = 'left';

  return new Promise(res => c.toBlob(res, 'image/png'));
}
