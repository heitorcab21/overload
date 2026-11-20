// Unidades: o app guarda tudo em métrico (kg, cm, km, km/h) e converte só na tela e na digitação.
// Trocar para imperial (lb, pés/polegadas, milhas, mph) não altera nenhum dado salvo.
import { state } from './store.js';

export const LB = 0.45359237; // kg por libra
export const INCH = 2.54;     // cm por polegada
export const MILE = 1.609344; // km por milha

export const imperial = () => state.settings?.units === 'imperial';

// ---------- Peso ----------
export const wUnit = () => (imperial() ? 'lb' : 'kg');
/** kg -> número exibido (lb com 1 casa). */
export const toW = kg => (imperial() ? Math.round((Number(kg) || 0) / LB * 10) / 10 : Number(kg) || 0);
/** Número digitado na unidade da tela -> kg. */
export const fromW = v => (imperial() ? Math.round((Number(v) || 0) * LB * 10000) / 10000 : Number(v) || 0);
/** Degrau de carga na tela: em libras, múltiplos de 2,5 lb (2,5 kg -> 5 lb; 5 kg -> 10 lb). */
export const toStep = stepKg => (imperial() ? Math.max(1, Math.round((Number(stepKg) || 0) / LB / 2.5) * 2.5) : stepKg);
/** Arredonda uma carga (kg) para o degrau da tela; em libras cai nos pesos que existem na academia. */
export function snapW(kg, stepKg) {
  if (!imperial()) return kg;
  const st = toStep(stepKg || 2.5);
  return fromW(Math.round(toW(kg) / st) * st);
}

// ---------- Comprimento e altura ----------
export const lenUnit = () => (imperial() ? 'in' : 'cm');
export const toLen = cm => (imperial() ? Math.round((Number(cm) || 0) / INCH * 10) / 10 : Number(cm) || 0);
export const fromLen = v => (imperial() ? Math.round((Number(v) || 0) * INCH * 10) / 10 : Number(v) || 0);
/** Altura legível: 181 cm ou 5'11". */
export function heightStr(cm) {
  if (!imperial()) return `${String(Math.round(cm)).replace('.', ',')} cm`;
  const inches = Math.round(cm / INCH);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

// ---------- Distância e velocidade ----------
export const distUnit = () => (imperial() ? 'mi' : 'km');
export const toDist = km => (imperial() ? Math.round((Number(km) || 0) / MILE * 100) / 100 : Number(km) || 0);
export const fromDist = v => (imperial() ? Math.round((Number(v) || 0) * MILE * 1000) / 1000 : Number(v) || 0);
export const speedUnit = () => (imperial() ? 'mph' : 'km/h');
export const toSpeed = kmh => (imperial() ? Math.round((Number(kmh) || 0) / MILE * 10) / 10 : Number(kmh) || 0);
export const fromSpeed = v => (imperial() ? Math.round((Number(v) || 0) * MILE * 100) / 100 : Number(v) || 0);

/** Troca as unidades escritas num texto já traduzido (os números devem ter sido convertidos antes). */
export function ul(s) {
  if (!imperial()) return s;
  return String(s).replace(/\bkm\/h\b/g, 'mph').replace(/\bkg\b/g, 'lb').replace(/\bcm\b/g, 'in').replace(/\bkm\b/g, 'mi');
}
