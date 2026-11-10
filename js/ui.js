// Utilitários de interface: formatação, ícones, toast e folha modal.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmt = n => (Math.round(n * 100) / 100).toLocaleString('pt-BR');
export const kg = w => (w > 0 ? `${fmt(w)} kg` : 'peso corporal');
export const setStr = s => (s.w > 0 ? `${fmt(s.w)} kg × ${s.r}` : `${s.r} reps`);
export const compact = n => (n >= 10000 ? `${fmt(Math.round(n / 100) / 10)} t` : `${fmt(Math.round(n))} kg`);

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function fmtDate(d, withWeekday = true) {
  const x = new Date(d);
  const dm = `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  return withWeekday ? `${WD[x.getDay()]} ${dm}` : dm;
}
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const I = p => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const icon = {
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  next: I('<path d="M9 5l7 7-7 7"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
  undo: I('<path d="M9 6L4 11l5 5"/><path d="M4 11h10a5 5 0 010 10h-3"/>'),
  list: I('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  home: I('<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>'),
  target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  chart: I('<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>'),
  dumbbell: I('<path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>'),
  play: I('<path d="M7 5l12 7-12 7z"/>'),
  spark: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  trash: I('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8"/>'),
};

/** Ações de clique: qualquer elemento com data-act="nome" chama actions.nome(el, evento). */
export const actions = {};
/** Ações de formulário: data-change="nome" chama changes.nome(el) em "change"/"input". */
export const changes = {};
/** Envio de formulário: data-submit="nome" chama submits.nome(form). */
export const submits = {};

let toastTimer;
export function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function sheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true">
    <button class="icon-btn sheet-x" data-act="closeSheet" aria-label="Fechar">${icon.x}</button>${html}</div>`;
  s.hidden = false;
  document.body.classList.add('no-scroll');
}
export function closeSheet() {
  const s = $('#sheet');
  s.hidden = true;
  s.innerHTML = '';
  document.body.classList.remove('no-scroll');
}
actions.closeSheet = closeSheet;

/** Barra de progresso de meta. */
export function meter(pct, done = false) {
  const p = Math.max(0, Math.min(1, pct || 0));
  return `<div class="meter${done ? ' done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}">
    <i style="width:${(p * 100).toFixed(1)}%"></i></div>`;
}

export const badgeDone = label => `<span class="badge good">${icon.check}${esc(label)}</span>`;

/** Campo numérico com botões de menos e mais. */
export function stepper(name, value, step, label, min = 0, change = '') {
  return `<div class="stepper" data-name="${name}" data-step="${step}" data-min="${min}">
    <span class="stepper-label">${esc(label)}</span>
    <button type="button" class="icon-btn" data-act="stepDown" aria-label="Diminuir ${esc(label)}">${icon.minus}</button>
    <input type="number" inputmode="decimal" name="${name}" value="${value}" step="any" min="${min}" aria-label="${esc(label)}"${change ? ` data-change="${change}"` : ''}>
    <button type="button" class="icon-btn" data-act="stepUp" aria-label="Aumentar ${esc(label)}">${icon.plus}</button>
  </div>`;
}
function bump(el, dir) {
  const box = el.closest('.stepper');
  const input = $('input', box);
  const step = Number(box.dataset.step) || 1;
  const min = Number(box.dataset.min) || 0;
  const v = Math.max(min, Math.round(((Number(input.value) || 0) + dir * step) * 100) / 100);
  input.value = v;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
actions.stepUp = el => bump(el, 1);
actions.stepDown = el => bump(el, -1);

/**
 * Abre o menu de compartilhar do celular (Drive, WhatsApp, e-mail...) quando o
 * navegador aceita o tipo de arquivo; senão, baixa o arquivo.
 * Retorna 'shared', 'downloaded' ou 'cancelled'.
 */
export async function shareFile(filename, text, type = 'text/plain') {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  download(filename, text, type);
  return 'downloaded';
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
