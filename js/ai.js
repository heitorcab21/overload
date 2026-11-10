// IA opcional (Claude). Só é usada se houver uma chave da API nas configurações.
// A chave fica salva apenas neste aparelho e as chamadas vão direto do navegador para a Anthropic.
import { state } from './store.js';
import { t, lang } from './i18n.js';

// Idioma em que a IA deve responder
const REPLY = () => ({ pt: 'português do Brasil', en: 'inglês (English)', es: 'espanhol (español)' }[lang()]);

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.8.0';
const DEFAULT_MODEL = 'claude-opus-5-5';
// Modelos que aceitam o fallback automático do servidor quando um pedido é recusado.
const FALLBACK_OK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);

export const aiEnabled = () => !!state.settings.apiKey;

let Anthropic = null;
async function getClient() {
  if (!navigator.onLine) throw new Error(t('Sem internet: a IA precisa de conexão.'));
  try {
    Anthropic ??= (await import(SDK_URL)).default;
  } catch {
    throw new Error(t('Não foi possível carregar a biblioteca da IA. Verifique a conexão.'));
  }
  return new Anthropic({ apiKey: state.settings.apiKey, dangerouslyAllowBrowser: true });
}

async function ask({ system, user, effort = 'medium', schema }) {
  const client = await getClient();
  const model = state.settings.model || DEFAULT_MODEL;
  const params = {
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
  };
  let res;
  try {
    res = FALLBACK_OK.has(model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error(t('Chave da API inválida. Confira em Ajustes.'));
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error(t('Sua chave não tem permissão para este modelo.'));
    if (err instanceof Anthropic.NotFoundError) throw new Error(t('Modelo não encontrado. Escolha outro em Ajustes.'));
    if (err instanceof Anthropic.RateLimitError) throw new Error(t('Limite de uso atingido. Tente de novo em instantes.'));
    if (err instanceof Anthropic.BadRequestError) throw new Error(t('A IA rejeitou o pedido: {msg}', { msg: err.message }));
    if (err instanceof Anthropic.APIConnectionError) throw new Error(t('Falha de conexão com a IA.'));
    if (err instanceof Anthropic.APIError) throw new Error(t('Erro da IA ({n}). Tente mais tarde.', { n: err.status }));
    throw err;
  }
  if (res.stop_reason === 'refusal') throw new Error(t('A IA não pôde responder a este pedido.'));
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (res.stop_reason === 'max_tokens' && schema) throw new Error(t('A resposta da IA veio incompleta. Tente de novo.'));
  return text;
}

const ACTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actions'],
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'weight', 'reps', 'failed', 'feel'],
        properties: {
          type: { type: 'string', enum: ['set', 'planned', 'planned_all', 'feel', 'skip', 'next', 'undo'] },
          weight: { type: ['number', 'null'], description: 'Carga em kg, ou null para manter a carga atual.' },
          reps: { type: ['integer', 'null'], description: 'Repetições, ou null para usar a meta.' },
          failed: { type: 'boolean', description: 'true se a pessoa disse que falhou nessa série.' },
          feel: { type: ['string', 'null'], enum: ['easy', 'ok', 'hard', 'fail', null] },
        },
      },
    },
  },
};

/** Interpreta uma frase que o interpretador local não entendeu. */
export async function aiParseVoice(transcript, ctx) {
  const text = await ask({
    effort: 'low',
    schema: ACTIONS_SCHEMA,
    system: `Você converte o que uma pessoa falou durante um treino de musculação em ações estruturadas.
A fala vem de reconhecimento de voz em ${REPLY()} e pode ter erros de transcrição.
Tipos de ação:
- "set": uma série feita. Uma ação por série (se a pessoa disse "três séries de dez com cinquenta", devolva três ações).
- "planned": a pessoa fez a próxima série exatamente como a meta. "planned_all": fez todas as séries restantes como a meta.
- "feel": como foi o exercício (easy = fácil, ok = na medida, hard = pesado, fail = até a falha).
- "skip": pular o exercício. "next": ir para o próximo exercício. "undo": desfazer a última série.
Se a frase não tiver relação com o registro do treino, devolva uma lista vazia.`,
    user: `Exercício atual: ${ctx.exercise}
Próxima série planejada: ${ctx.planned}
Séries já registradas neste exercício: ${ctx.done || 'nenhuma'}

O que a pessoa disse: "${transcript}"`,
  });
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  return (data.actions || []).map(a => {
    if (a.type === 'set') {
      const o = { type: 'set' };
      if (typeof a.weight === 'number') o.w = a.weight;
      if (typeof a.reps === 'number') o.r = a.reps;
      if (a.failed) o.fail = true;
      return o;
    }
    if (a.type === 'planned') return { type: 'planned' };
    if (a.type === 'planned_all') return { type: 'planned', all: true };
    if (a.type === 'feel') return a.feel ? { type: 'feel', v: a.feel } : null;
    return { type: a.type };
  }).filter(Boolean);
}

const COACH = () => `Você é um treinador de musculação experiente e direto, especialista em sobrecarga progressiva.
Responda em ${REPLY()}, em texto simples, sem markdown, sem tabelas e sem emojis.
As cargas anotadas são a carga total levantada (barra + anilhas, ou os dois halteres somados).
Baseie-se apenas nos dados fornecidos. Não dê diagnóstico médico: se houver relato de dor persistente, recomende procurar um profissional de saúde.`;

/** Análise da semana a partir do resumo dos treinos e das metas. */
export function aiWeeklyAnalysis(summary) {
  return ask({
    effort: 'medium',
    system: `${COACH()}
Escreva uma análise curta (no máximo 180 palavras) com três partes, cada uma em um parágrafo iniciado pelo título seguido de dois-pontos:
${t('"O que foi bem", "O que ajustar" e "Foco da próxima semana"')}. Cite exercícios e números concretos dos dados.`,
    user: summary,
  });
}

/** Tira dúvidas sobre a execução de um exercício. */
export function aiAskExecution(exerciseName, cues, question) {
  return ask({
    effort: 'low',
    system: `${COACH()}
A pessoa está na academia, com o celular na mão. Responda em no máximo 120 palavras, com orientação prática de execução.`,
    user: `Exercício: ${exerciseName}
${cues ? `Orientações que o app já mostra:\n${cues}\n` : ''}
Pergunta: ${question}`,
  });
}

/** Gera as orientações de execução para um exercício personalizado. */
export async function aiCuesFor(exerciseName, group) {
  const text = await ask({
    effort: 'low',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['how', 'errs', 'tip'],
      properties: {
        how: { type: 'array', items: { type: 'string' }, description: 'Três passos da execução ideal, na ordem.' },
        errs: { type: 'array', items: { type: 'string' }, description: 'Dois erros comuns.' },
        tip: { type: 'string', description: 'Uma dica prática curta.' },
      },
    },
    system: `${COACH()}
Descreva a execução ideal do exercício pedido: três passos objetivos (posição inicial, movimento, retorno), dois erros comuns e uma dica. Frases curtas.`,
    user: `Exercício: ${exerciseName} (grupamento: ${group})`,
  });
  return JSON.parse(text);
}
