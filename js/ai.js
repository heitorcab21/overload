// IA opcional: Claude (Anthropic), ChatGPT (OpenAI) ou Gemini (Google), com a chave da própria pessoa.
// A chave fica salva apenas neste aparelho e as chamadas vão direto do navegador para o provedor escolhido.
import { state } from './store.js';
import { t, lang } from './i18n.js';

// Idioma em que a IA deve responder
const REPLY = () => ({ pt: 'português do Brasil', en: 'inglês (English)', es: 'espanhol (español)' }[lang()]);

export const PROVIDERS = {
  claude: { name: 'Claude (Anthropic)', keyHint: 'sk-ant-...', keyUrl: 'https://platform.claude.com/settings/keys' },
  openai: { name: 'ChatGPT (OpenAI)', keyHint: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys' },
  gemini: { name: 'Gemini (Google)', keyHint: 'AIza...', keyUrl: 'https://aistudio.google.com/apikey' },
};

// ---------- Configuração (uma chave e um modelo por provedor) ----------

/** Configurações antigas tinham só a chave do Claude em settings.apiKey. */
function migrate() {
  const st = state.settings;
  if (!st.aiKeys) {
    st.aiKeys = { claude: st.apiKey || '' };
    st.aiModels = { claude: st.model || 'claude-opus-5-5' };
    st.aiProvider = 'claude';
  }
}
export const aiProvider = () => { migrate(); return PROVIDERS[state.settings.aiProvider] ? state.settings.aiProvider : 'claude'; };
export const aiKey = (p = aiProvider()) => { migrate(); return state.settings.aiKeys[p] || ''; };
export const aiModel = (p = aiProvider()) => { migrate(); return state.settings.aiModels?.[p] || (p === 'claude' ? 'claude-opus-5-5' : ''); };
export const aiEnabled = () => !!aiKey() && !!aiModel();

export function setAiConfig(provider, key, model) {
  migrate();
  const st = state.settings;
  st.aiProvider = provider;
  st.aiKeys = { ...st.aiKeys, [provider]: key };
  st.aiModels = { ...(st.aiModels || {}), [provider]: model };
  st.apiKey = ''; // formato antigo
}

// ---------- Erros ----------

function httpError(status, detail) {
  if (status === 401) return new Error(t('Chave da API inválida. Confira em Ajustes.'));
  if (status === 403) return new Error(t('Sua chave não tem permissão para este modelo.'));
  if (status === 404) return new Error(t('Modelo não encontrado. Escolha outro em Ajustes.'));
  if (status === 429) return new Error(t('Limite de uso atingido. Tente de novo em instantes.'));
  if (status === 400) {
    // o Gemini responde 400 para chave inválida
    if (/api key/i.test(detail || '')) return new Error(t('Chave da API inválida. Confira em Ajustes.'));
    return new Error(t('A IA rejeitou o pedido: {msg}', { msg: detail || status }));
  }
  return new Error(t('Erro da IA ({n}). Tente mais tarde.', { n: status }));
}

async function http(url, opts) {
  let res;
  try { res = await fetch(url, opts); } catch { throw new Error(t('Falha de conexão com a IA.')); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, body?.error?.message);
  return body;
}

// ---------- Claude (SDK oficial da Anthropic) ----------

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.8.0';
// Modelos que aceitam o fallback automático do servidor quando um pedido é recusado.
const FALLBACK_OK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);
let Anthropic = null;

async function claudeClient() {
  try {
    Anthropic ??= (await import(SDK_URL)).default;
  } catch {
    throw new Error(t('Não foi possível carregar a biblioteca da IA. Verifique a conexão.'));
  }
  return new Anthropic({ apiKey: aiKey('claude'), dangerouslyAllowBrowser: true });
}

async function askClaude({ system, user, effort, schema }) {
  const client = await claudeClient();
  const model = aiModel('claude');
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

// ---------- ChatGPT (API da OpenAI) e Gemini (API do Google) ----------
// Pedem JSON pelo modo de resposta em JSON de cada provedor, com o formato descrito no texto.

const jsonRule = schema => `\n\nResponda somente com um objeto JSON válido (sem texto antes ou depois) que siga este JSON Schema:\n${JSON.stringify(schema)}`;

async function askOpenAI({ system, user, schema }) {
  const body = {
    model: aiModel('openai'),
    messages: [{ role: 'system', content: system + (schema ? jsonRule(schema) : '') }, { role: 'user', content: user }],
    ...(schema ? { response_format: { type: 'json_object' } } : {}),
  };
  const data = await http('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey('openai')}` },
    body: JSON.stringify(body),
  });
  const c = data.choices?.[0];
  if (!c || c.finish_reason === 'content_filter' || c.message?.refusal) throw new Error(t('A IA não pôde responder a este pedido.'));
  if (c.finish_reason === 'length' && schema) throw new Error(t('A resposta da IA veio incompleta. Tente de novo.'));
  return (c.message?.content || '').trim();
}

async function askGemini({ system, user, schema }) {
  const model = aiModel('gemini');
  const data = await http(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiKey('gemini') },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system + (schema ? jsonRule(schema) : '') }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      ...(schema ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    }),
  });
  const c = data.candidates?.[0];
  if (!c || data.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(c.finishReason || '')) {
    throw new Error(t('A IA não pôde responder a este pedido.'));
  }
  if (c.finishReason === 'MAX_TOKENS' && schema) throw new Error(t('A resposta da IA veio incompleta. Tente de novo.'));
  return (c.content?.parts || []).map(x => x.text || '').join('').trim();
}

async function ask(opts) {
  if (!navigator.onLine) throw new Error(t('Sem internet: a IA precisa de conexão.'));
  const p = aiProvider();
  const o = { effort: 'medium', ...opts };
  if (p === 'openai') return askOpenAI(o);
  if (p === 'gemini') return askGemini(o);
  return askClaude(o);
}

/** Lê o JSON da resposta, mesmo que venha entre crases de bloco de código. */
export function parseJSON(text) {
  const s = String(text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(s); } catch { /* tenta achar o objeto dentro do texto */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error(t('A resposta da IA veio incompleta. Tente de novo.'));
}

// ---------- Lista de modelos de cada provedor ----------

const versionOf = id => Number((id.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0);

/** Busca os modelos de texto disponíveis na chave e indica um padrão rápido e barato. */
export async function listModels(provider, key) {
  if (!navigator.onLine) throw new Error(t('Sem internet: a IA precisa de conexão.'));
  if (provider === 'openai') {
    const data = await http('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    const skip = /(audio|realtime|transcribe|tts|image|search|embedding|instruct|codex|moderation|dall-e|whisper|computer|babbage|davinci)/;
    const ids = (data.data || []).filter(m => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !skip.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0)).map(m => m.id);
    const pick = ids.find(id => /^gpt-.*mini/.test(id) && !/\d{4}-\d{2}-\d{2}$/.test(id)) || ids.find(id => /^gpt-/.test(id)) || ids[0];
    return { models: ids, recommended: pick };
  }
  if (provider === 'gemini') {
    const data = await http('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const skip = /(embedding|image|tts|audio|live|vision|aqa|learnlm|gemma)/;
    const ids = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(id => id.startsWith('gemini') && !skip.test(id))
      .sort((a, b) => versionOf(b) - versionOf(a));
    const stable = ids.filter(id => !/(preview|exp|latest)/.test(id));
    const pick = stable.find(id => /flash/.test(id) && !/lite/.test(id)) || stable[0] || ids[0];
    return { models: ids, recommended: pick };
  }
  // Claude: lista pelo SDK oficial; o padrão continua sendo o Claude Opus 5.5
  try {
    Anthropic ??= (await import(SDK_URL)).default;
  } catch {
    throw new Error(t('Não foi possível carregar a biblioteca da IA. Verifique a conexão.'));
  }
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const ids = [];
  try {
    for await (const m of client.models.list()) ids.push(m.id);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error(t('Chave da API inválida. Confira em Ajustes.'));
    throw new Error(t('Falha de conexão com a IA.'));
  }
  return { models: ids, recommended: ids.includes('claude-opus-5-5') ? 'claude-opus-5-5' : ids[0] };
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
  try { data = parseJSON(text); } catch { return []; }
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
  return parseJSON(text);
}

/** Converte anotações de treino em texto livre (bloco de notas, WhatsApp) em treinos estruturados. */
export async function aiParseWorkoutText(text, library) {
  const out = await ask({
    effort: 'low',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['sessions'],
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'name', 'exercises'],
            properties: {
              date: { type: ['string', 'null'], description: 'Data do treino em AAAA-MM-DD, ou null se o texto não disser.' },
              name: { type: ['string', 'null'], description: 'Nome do treino, se houver (ex.: "Treino A", "Peito").' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'libId', 'group', 'restSec', 'sets'],
                  properties: {
                    name: { type: 'string', description: 'Nome do exercício como a pessoa escreveu, corrigido e legível.' },
                    libId: { type: ['string', 'null'], description: 'id da biblioteca que corresponde ao exercício, ou null se nenhum corresponder.' },
                    group: { type: ['string', 'null'], description: 'Grupamento muscular, um dos nomes da lista, ou null.' },
                    restSec: { type: ['integer', 'null'], description: 'Descanso entre séries em segundos, se informado.' },
                    sets: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['w', 'r'],
                        properties: { w: { type: 'number', description: 'Carga total em kg (0 se peso corporal).' }, r: { type: 'integer', description: 'Repetições.' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    system: `Você converte anotações de treino de musculação, escritas livremente em bloco de notas ou WhatsApp, em dados estruturados.
Regras:
- Uma série por item em "sets". "3x10 com 50kg" vira três séries de 50 kg × 10. "40kg 12/10/8" vira três séries.
- Ignore enfeites (traços, emojis, marcadores). Linhas como "• Tríceps" indicam o grupamento dos exercícios seguintes.
- Mapeie cada exercício para o libId mais parecido da biblioteca, considerando gírias de academia (ex.: "corda" = tríceps na polia com corda, "barra V" = tríceps na polia com barra, "voador" = peck deck, "cross" = crossover, "serrote" = remada unilateral). Use null se não houver correspondência razoável.
- Datas sem ano: use o ano atual (${new Date().getFullYear()}). Se não houver datas, devolva uma sessão com date null.
- Não invente séries nem cargas que não estejam no texto.
Grupamentos válidos: Peito, Costas, Ombros, Bíceps, Tríceps, Quadríceps, Posteriores, Glúteos, Panturrilhas, Abdômen.
Biblioteca (libId: nome):
${library}`,
    user: text.slice(0, 12000),
  });
  return parseJSON(out);
}
