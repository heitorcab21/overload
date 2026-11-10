// Tradução: português (texto original no código), inglês e espanhol.
// t('Texto em português', { variaveis }) devolve o texto no idioma escolhido em Ajustes.
import { state } from './store.js';
import EN from './locales/en.js';
import ES from './locales/es.js';

export const LANGS = [['pt', 'Português'], ['en', 'English'], ['es', 'Español']];
const PACKS = { en: EN, es: ES };
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

/** Idioma do aparelho, quando a pessoa ainda não escolheu um. */
export function detectLang() {
  const n = String((typeof navigator !== 'undefined' && navigator.language) || 'pt').slice(0, 2).toLowerCase();
  return LOCALES[n] ? n : 'pt';
}
export const lang = () => (LOCALES[state.settings?.lang] ? state.settings.lang : detectLang());
export const locale = () => LOCALES[lang()];

export function t(key, vars) {
  const l = lang();
  let s = l === 'pt' ? key : (PACKS[l].ui[key] ?? key);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

/** Plural simples: tn(n, 'treino', 'treinos') -> "1 treino" / "3 treinos" (traduzido). */
export const tn = (n, one, many) => t(n === 1 ? one : many, { n });

/** Ajuda (tutoriais) no idioma atual; o português fica em views/help.js. */
export const helpPack = () => PACKS[lang()]?.help ?? null;

/** Textos de um exercício da biblioteca no idioma atual (nome, execução, erros, dica). */
export const exPack = id => PACKS[lang()]?.ex?.[id] ?? null;

/** Todos os nomes possíveis de um exercício da biblioteca (para importar planilhas em qualquer idioma). */
export const exNamesAll = id => [EN.ex?.[id]?.name, ES.ex?.[id]?.name].filter(Boolean);
/** Todas as traduções de um texto curto (nomes de grupamentos, cabeçalhos). */
export const allLangs = key => [key, EN.ui[key], ES.ui[key]].filter(Boolean);

/** Usado pelo teste de cobertura. */
export const PACKS_FOR_TEST = PACKS;
