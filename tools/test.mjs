// Testes rápidos do interpretador de voz e da progressão:  node tools/test.mjs
import assert from 'node:assert/strict';

// localStorage mínimo para os módulos carregarem fora do navegador
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };

const { parseUtterance, wordsToDigits } = await import('../js/voice.js');
const { state } = await import('../js/store.js');
const { planFor, exGoalStatus, groupGoalStatus, e1rm, toSet, sessionPRs } = await import('../js/logic.js');
// os testes abaixo usam o português; os outros idiomas são testados no fim
state.settings.lang = 'pt';

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// ---- números por extenso ----
eq(wordsToDigits('quarenta e dois e meio quilos'), '42.5 quilos');
eq(wordsToDigits('cento e vinte'), '120');
eq(wordsToDigits('quarenta doze'), '40 12');
eq(wordsToDigits('três séries de dez com cinquenta'), '3 series de 10 com 50');
eq(wordsToDigits('42,5 kg'), '42.5 kg');

// ---- frases ----
const set = (w, r, extra = {}) => ({ type: 'set', ...(w !== undefined ? { w } : {}), ...(r !== undefined ? { r } : {}), ...extra });
eq(parseUtterance('40 quilos 12 repetições'), [set(40, 12)]);
eq(parseUtterance('quarenta quilos, doze repetições'), [set(40, 12)]);
eq(parseUtterance('40kg 12'), [set(40, 12)]);
eq(parseUtterance('40 12'), [set(40, 12)]);
eq(parseUtterance('40 por 12'), [set(40, 12)]);
eq(parseUtterance('40x12'), [set(40, 12)]);
eq(parseUtterance('12 repetições com 40'), [set(40, 12)]);
eq(parseUtterance('doze'), [set(undefined, 12)]);
eq(parseUtterance('42,5 quilos'), [set(42.5)]);
eq(parseUtterance('três séries de dez com cinquenta'), [set(50, 10), set(50, 10), set(50, 10)]);
eq(parseUtterance('3 x 10 com 50'), [set(50, 10), set(50, 10), set(50, 10)]);
eq(parseUtterance('50 quilos doze, dez e oito'), [set(50, 12), set(50, 10), set(50, 8)]);
eq(parseUtterance('40 quilos 8 falhei'), [set(40, 8, { fail: true })]);
eq(parseUtterance('bati a meta'), [{ type: 'planned', all: false }]);
eq(parseUtterance('fiz tudo como planejado'), [{ type: 'planned', all: true }]);
eq(parseUtterance('mais uma'), [{ type: 'delta', dr: 1 }]);
eq(parseUtterance('menos duas reps'), [{ type: 'delta', dr: -2 }]);
eq(parseUtterance('mais 5 quilos'), [{ type: 'delta', dw: 5 }]);
eq(parseUtterance('estava pesado'), [{ type: 'feel', v: 'hard' }]);
eq(parseUtterance('40 quilos 12 estava fácil'), [set(40, 12), { type: 'feel', v: 'easy' }]);
eq(parseUtterance('desfazer'), [{ type: 'undo' }]);
eq(parseUtterance('pular'), [{ type: 'skip' }]);
eq(parseUtterance('próximo'), [{ type: 'next' }]);
eq(parseUtterance('que horas são'), []);

// ---- progressão ----
const ex = { id: 'x', name: 'Supino', group: 'Peito', sets: 3, repMin: 8, repMax: 12, step: 2.5 };
state.exercises.x = ex;
const day = d => new Date(2026, 10, d, 18).toISOString();
const sess = (d, sets, extra = {}) => ({ id: `s${d}`, date: day(d), name: 'A', entries: [{ exId: 'x', sets, flags: [], ...extra }] });

state.sessions = [];
eq(planFor(ex).first, true);
eq(planFor({ ...ex, startW: 42.5 }).w, 42.5, 'carga inicial informada vira a sugestão do primeiro treino');

state.sessions = [sess(2, [{ w: 40, r: 12 }, { w: 40, r: 10 }, { w: 40, r: 8 }])];
eq([planFor(ex).w, planFor(ex).reps], [40, [12, 10, 9]], '+1 rep na série mais fraca');

state.sessions = [sess(2, [{ w: 40, r: 12 }, { w: 40, r: 12 }, { w: 40, r: 12 }])];
eq([planFor(ex).w, planFor(ex).reps, planFor(ex).kind], [42.5, [8, 8, 8], 'up'], 'sobe a carga no topo da faixa');

// RIR: folga grande acelera, zero de folga segura; aquecimento não vira base da progressão
state.sessions = [sess(2, [{ w: 40, r: 9, rir: 3 }, { w: 40, r: 9, rir: 3 }, { w: 40, r: 8, rir: 4 }])];
eq([planFor(ex).w, planFor(ex).reps], [40, [11, 11, 10]], 'RIR 3+ em tudo: +2 reps');
state.sessions = [sess(2, [{ w: 40, r: 10, rir: 2 }, { w: 40, r: 9, rir: 1 }, { w: 40, r: 9, rir: 0 }])];
eq([planFor(ex).reps, planFor(ex).kind], [[10, 9, 9], 'hold'], 'RIR 0 na última: repete');
state.sessions = [sess(2, [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 9 }], { warmup: [{ w: 20, r: 15 }, { w: 30, r: 8 }] })];
eq([planFor(ex).w, planFor(ex).reps], [40, [10, 10, 10]], 'séries de aquecimento ficam fora da progressão');

// aquecimento esquecido (carga bem menor) não atrapalha a progressão nem a contagem
state.sessions = [sess(2, [{ w: 20, r: 15 }, { w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 9 }])];
eq([planFor(ex).w, planFor(ex).reps], [40, [10, 10, 10]], 'série leve esquecida não entra na progressão');
const { workSets } = await import('../js/logic.js');
eq(workSets([{ w: 20, r: 15 }, { w: 40, r: 10 }, { w: 30, r: 12 }]).length, 2, 'drop set de -25% continua valendo; -50% não');

state.sessions = [sess(2, [{ w: 40, r: 10 }, { w: 40, r: 9 }, { w: 40, r: 9 }], { feel: 'easy' })];
eq(planFor(ex).reps, [11, 10, 10], 'fácil: +1 em todas');

state.sessions = [sess(2, [{ w: 40, r: 10 }, { w: 40, r: 9 }, { w: 40, r: 9 }], { flags: ['dor'] })];
eq(planFor(ex).reps, [10, 9, 9], 'dor: repete');

state.sessions = [
  sess(2, [{ w: 50, r: 6 }, { w: 50, r: 5 }, { w: 50, r: 5 }]),
  sess(4, [{ w: 50, r: 6 }, { w: 50, r: 6 }, { w: 50, r: 5 }]),
];
eq([planFor(ex).w, planFor(ex).kind], [45, 'down'], 'duas sessões abaixo da faixa: reduz 10%');

state.sessions = [
  sess(2, [{ w: 40, r: 10 }, { w: 40, r: 9 }, { w: 40, r: 9 }]),
  sess(4, [{ w: 30, r: 12 }, { w: 30, r: 12 }, { w: 30, r: 12 }], { flags: ['troca'] }),
];
eq(planFor(ex).w, 40, 'troca de aparelho é ignorada na progressão');

// ---- metas ----
eq(toSet(e1rm(50, 10), ex, 50), { w: 50, r: 10 });
eq(toSet(e1rm(50, 14), ex, 50).w > 50, true, 'passou da faixa: converte em mais carga');

state.sessions = [sess(3, [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 9 }])];
state.goals.ex.x = { w: 45, r: 10, month: '2026-11', created: day(1), base: e1rm(40, 10) };
const now = new Date(2026, 10, 10, 12);
const st = exGoalStatus(ex, now);
eq([st.expired, st.monthDone, st.weeks >= 4, st.week], [false, false, true, 3]);
eq(st.weekSet.w >= 40 && e1rm(st.weekSet.w, st.weekSet.r) < e1rm(45, 10) + 0.01, true, 'meta da semana fica entre a base e a meta do mês');

state.sessions.push(sess(10, [{ w: 45, r: 10 }, { w: 45, r: 9 }, { w: 45, r: 8 }]));
const st2 = exGoalStatus(ex, now);
eq([st2.monthDone, st2.weekDone, st2.monthPct], [true, true, 1]);
eq(sessionPRs(state.sessions[1]).length, 1, 'recorde detectado');

state.routines = [{ id: 'r', name: 'A', ex: ['x'] }];
state.goals.groups.Peito = { week: 6, month: 26 };
const g = groupGoalStatus(now).find(x => x.group === 'Peito');
eq([g.weekDone, g.weekGoal, g.monthDone], [3, 6, 6]);

// ---- metas de grupamento seguem a rotina ----
const { defaultGroupGoals, setWeekOverride, autoWeekSet } = await import('../js/logic.js');
state.goals.groups = {};
state.routines = [{ id: 'r', name: 'A', ex: ['x'] }];
defaultGroupGoals(now);
eq(state.goals.groups.Peito, { week: 3, month: 13, auto: true }, 'meta criada pela rotina');
state.exercises.y = { id: 'y', name: 'Crucifixo', group: 'Peito', sets: 4, repMin: 10, repMax: 15, step: 5 };
state.exercises.z = { id: 'z', name: 'Remada', group: 'Costas', sets: 3, repMin: 8, repMax: 12, step: 2.5 };
state.routines[0].ex.push('y', 'z');
defaultGroupGoals(now);
eq([state.goals.groups.Peito.week, state.goals.groups.Costas.week], [7, 3], 'rotina mudou: metas automáticas acompanham');
state.goals.groups.Costas = { week: 10, month: 40, auto: false };
state.routines[0].ex = ['x'];
defaultGroupGoals(now);
eq([state.goals.groups.Peito.week, state.goals.groups.Costas], [3, { week: 10, month: 40, auto: false }], 'meta editada fica; automática ajusta');

// ---- meta da semana à mão ----
const auto = autoWeekSet(ex, now);
setWeekOverride(ex, 44, 9, now);
eq([exGoalStatus(ex, now).weekSet, exGoalStatus(ex, now).weekManual], [{ w: 44, r: 9 }, true]);
eq(exGoalStatus(ex, new Date(2026, 10, 17, 12)).weekManual, false, 'ajuste vale só para aquela semana');
setWeekOverride(ex, auto.w, auto.r, now);
eq(exGoalStatus(ex, now).weekManual, false, 'igual ao automático volta ao automático');

// ---- planilha de metas ----
const { goalsCSV, importGoalsCSV, parseCSV, parseSet } = await import('../js/export.js');
eq(parseSet('42,5 kg x 10'), { w: 42.5, r: 10 });
eq(parseSet('42.5×10'), { w: 42.5, r: 10 });
eq(parseSet('12 reps'), { w: 0, r: 12 });
eq(parseCSV('a,b\n"1,5",x'), [['a', 'b'], ['1,5', 'x']], 'CSV com vírgula e aspas');

const before = JSON.stringify(state.goals);
eq(importGoalsCSV(goalsCSV(), now), { groups: 0, ex: 0, weeks: 0, unknown: [] }, 'exportar e importar sem mudar nada não altera metas');
eq(JSON.stringify(state.goals), before);

const sheetTxt = `Tipo;Nome;Grupamento;Meta da semana;Feito na semana;Meta do mês;Feito no mês;Situação
Grupamento;Peito;Peito;10 séries;;40 séries;;
Exercício;supino;Peito;46 kg x 8;;"47,5 kg x 10";;
Exercício;Agachamento Inexistente;;;;50 kg x 5;;`;
const res = importGoalsCSV(sheetTxt, now);
eq(res, { groups: 1, ex: 1, weeks: 1, unknown: ['Agachamento Inexistente'] });
eq(state.goals.groups.Peito, { week: 10, month: 40, auto: false });
eq([state.goals.ex.x.w, state.goals.ex.x.r], [47.5, 10]);
eq(exGoalStatus(ex, now).weekSet, { w: 46, r: 8 });

const commaTxt = 'Tipo,Nome,Meta da semana,Meta do mês\nGrupamento,Costas,12 séries,\n';
importGoalsCSV(commaTxt, now);
eq(state.goals.groups.Costas, { week: 12, month: 51, auto: false }, 'CSV com vírgula, mês calculado pela semana');
assert.throws(() => importGoalsCSV('a;b\n1;2', now), /colunas/);
n++;

// ---- sincronização: juntar versões de dois aparelhos ----
const store = await import('../js/store.js');
const S = () => store.state;
store.resetAll();
S().sessions = [{ id: 'a', date: day(1), entries: [] }, { id: 'b', date: day(3), entries: [] }];
S().routines = [{ id: 'r1', name: 'Local', ex: [] }];
S().settings.apiKey = 'chave-local';
S().sync = { connected: true, email: 'x@y', syncedAt: 1 };
store.save();
eq(S().updatedAt > 1, true, 'alteração marca a data');
const exported = store.exportData();
eq([exported.settings.apiKey, 'sync' in exported, exported.active], ['', false, null], 'chave e status ficam fora do arquivo do Drive');

const remote = { ...exported, sessions: [{ id: 'b', date: day(3), entries: [] }, { id: 'c', date: day(2), entries: [] }],
  routines: [{ id: 'r2', name: 'Do outro celular', ex: [] }], updatedAt: S().updatedAt + 1000 };
store.mergeRemote(remote);
eq(S().sessions.map(s => s.id), ['a', 'c', 'b'], 'treinos dos dois aparelhos, sem repetir, em ordem de data');
eq(S().routines[0].name, 'Do outro celular', 'rotina da versão mais recente');
eq([S().settings.apiKey, S().sync.email], ['chave-local', 'x@y'], 'chave e conexão deste aparelho são mantidas');

store.applyRemote({ ...remote, sessions: [], updatedAt: 5 });
eq([S().sessions.length, S().updatedAt, S().settings.apiKey], [0, 5, 'chave-local'], 'aplicar o Drive não conta como alteração local');
assert.throws(() => store.applyRemote({ foo: 1 }), /corrompido/);
n++;

// ---- idiomas ----
const i18n = await import('../js/i18n.js');
const { collectKeys } = await import('./i18n-keys.mjs');
const keys = collectKeys();
for (const l of ['en', 'es']) {
  const pack = i18n.PACKS_FOR_TEST[l];
  eq(keys.filter(k => !(k in pack.ui)), [], `todo texto tem tradução em ${l}`);
  // as variáveis {x} de cada texto existem também na tradução
  const vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
  eq(keys.filter(k => k in pack.ui && vars(k) !== vars(pack.ui[k])), [], `variáveis iguais em ${l}`);
}
const { LIB, exName: nameOf, loadHint, loadType } = await import('../js/data.js');
S().settings.lang = 'en';
eq(i18n.t('Começar treino'), 'Start workout');
eq(i18n.t('Você fez {n} reps em todas as séries: hora de subir para {w} kg.', { n: 12, w: 42.5 }), 'You did 12 reps on every set: time to move up to 42.5 kg.');
eq(nameOf({ lib: 'supino-reto', name: 'Supino reto com barra' }), 'Barbell bench press', 'nome do exercício traduzido');
eq(nameOf({ lib: 'supino-reto', name: 'Meu supino' }), 'Meu supino', 'nome editado pela pessoa é mantido');
eq(LIB.every(l => loadType({ lib: l.id })), true, 'todo exercício da biblioteca tem regra de carga');
const { IMG } = await import('../js/data.js');
const { existsSync } = await import('node:fs');
eq(LIB.filter(l => !IMG[l.id] || ![0, 1].every(n => existsSync(new URL(`../img/ex/${l.id}-${n}.jpg`, import.meta.url)))).map(l => l.id), [], 'todo exercício da biblioteca tem as duas fotos');
eq(new Set(LIB.map(l => l.id)).size, LIB.length, 'ids de exercício não se repetem');
eq(loadHint({ lib: 'supino-reto-halteres' }).includes('40 kg'), true, 'halteres: os dois somados');
eq(parseUtterance('forty kilos twelve reps'), [set(40, 12)]);
eq(parseUtterance('three sets of ten at fifty'), [set(50, 10), set(50, 10), set(50, 10)]);
eq(parseUtterance('one more'), [{ type: 'delta', dr: 1 }]);
eq(parseUtterance('forty two and a half kilos'), [set(42.5)]);
eq(parseUtterance('it was hard'), [{ type: 'feel', v: 'hard' }]);
S().settings.lang = 'es';
eq(i18n.t('Começar treino'), 'Empezar entrenamiento');
eq(parseUtterance('cuarenta kilos doce repeticiones'), [set(40, 12)]);
eq(parseUtterance('tres series de diez con cincuenta'), [set(50, 10), set(50, 10), set(50, 10)]);
eq(parseUtterance('una más'), [{ type: 'delta', dr: 1 }]);
eq(parseUtterance('cuarenta y dos y medio kilos'), [set(42.5)]);
// planilha exportada em espanhol volta ao app mesmo com o app em português
const esSheet = 'Tipo;Nombre;Grupo muscular;Meta semanal;Hecho en la semana;Meta mensual;Hecho en el mes;Estado\nGrupo muscular;Pecho;Pecho;11 series;;44 series;;';
S().settings.lang = 'pt';
eq(importGoalsCSV(esSheet, now).groups, 1, 'importa planilha em espanhol');
eq(S().goals.groups.Peito, { week: 11, month: 44, auto: false });


// ---- nomes das fichas pré-moldadas seguem o idioma ----
const data = await import('../js/data.js');
eq(data.templateKey('Workout A · Chest and triceps'), 'Treino A · Peito e tríceps', 'reconhece nome em inglês');
eq(data.templateKey('Entreno A · Pecho y tríceps'), 'Treino A · Peito e tríceps', 'reconhece nome em espanhol');
eq(data.templateKey('Meu treino'), null);
S().settings.lang = 'en';
eq(data.routineName({ name: 'Treino A · Peito e tríceps', tpl: true }), 'Workout A · Chest and triceps');
eq(data.routineName({ name: 'Treino de sexta', tpl: false }), 'Treino de sexta', 'nome próprio não é traduzido');
S().settings.lang = 'pt';

// ---- composição corporal e nível de força ----
const body = await import('../js/body.js');
eq(Math.round(body.bmi(80, 178) * 10) / 10, 25.2);
eq(body.bmiClass(25.2), 'over');
eq(Math.round(body.navyBodyFat('m', 178, 85, 38)), 16, 'Marinha, homem');
eq(Math.round(body.navyBodyFat('f', 165, 72, 32, 98)), 27, 'Marinha, mulher');
eq(body.navyBodyFat('f', 165, 72, 32), null, 'mulher precisa do quadril');
eq(Math.round(body.deurenbergBodyFat('m', 25, 30) * 10) / 10, 20.7, 'Deurenberg');
eq(body.strengthAdjustment(28, 90) < -2, true, 'forte e IMC alto: desconta gordura');
eq(body.strengthAdjustment(22, 90), 0, 'IMC baixo: sem ajuste');
eq(body.strengthAdjustment(28, 40), 0, 'força abaixo da média: sem ajuste');
const std = [0.5, 0.75, 1.0, 1.5, 2.0];
eq(Math.round(body.percentileOf(1.0, std)), 50, 'no padrão intermediário = percentil 50');
eq(Math.round(body.percentileOf(1.5, std)), 80);
eq(body.percentileOf(3, std) > 95 && body.percentileOf(3, std) <= 99.9, true, 'acima de elite fica entre 95 e 99,9');
eq(body.ageFactor(30), 1);
eq(body.ageFactor(60) < 1, true, 'força cai com a idade');
const nowIso = new Date().toISOString();
S().profile = { sex: 'm', birthYear: new Date().getFullYear() - 30, height: 178, weight: 80 };
S().exercises['supino-reto'] = { id: 'supino-reto', lib: 'supino-reto', name: 'Supino reto com barra', group: 'Peito', sets: 3, repMin: 6, repMax: 10, step: 2.5 };
S().exercises['peck-deck'] = { id: 'peck-deck', lib: 'peck-deck', name: 'x', group: 'Peito', sets: 3, repMin: 10, repMax: 15, step: 5 };
S().sessions.push({ id: 'bench', date: nowIso, entries: [{ exId: 'supino-reto', sets: [{ w: 120, r: 1 }] }] });
const lv = body.strengthLevel(S().exercises['supino-reto']);
eq([lv.lift, lv.top >= 15 && lv.top <= 22], ['bench', true], 'supino 1,5x o peso: por volta do top 18%');
eq(body.strengthLevel(S().exercises['peck-deck']).reason, 'notComparable', 'aparelho não entra no ranking');
S().sessions.push({ id: 'bench2', date: nowIso, entries: [{ exId: 'supino-reto', sets: [{ w: 100, r: 5, rir: 3 }] }] });
eq(Math.round(body.strengthLevel(S().exercises['supino-reto']).oneRM), Math.round(e1rm(100, 8)), 'RIR entra na estimativa do 1RM');
const lvR = body.strengthLevel(S().exercises['supino-reto']);
eq([lvR.src.w, lvR.src.r, lvR.src.rir, lvR.src.test], [100, 5, 3, false], 'mostra a série que gerou o 1RM');
S().exercises['supino-reto'].tests = [{ date: nowIso, w: 140, r: 1 }];
const lvT = body.strengthLevel(S().exercises['supino-reto']);
eq([lvT.oneRM, lvT.src.test], [140, true], 'teste de 1 rep: o 1RM é a própria carga');
S().exercises['supino-reto'].tests = [{ date: new Date(Date.now() - 200 * 864e5).toISOString(), w: 200, r: 1 }];
eq(body.strengthLevel(S().exercises['supino-reto']).src.test, false, 'teste com mais de 180 dias deixa de valer');
delete S().exercises['supino-reto'].tests;
const topAt = kgW => { S().profile.weight = kgW; return body.strengthLevel(S().exercises['supino-reto']).top; };
const pw = S().profile.weight;
eq(topAt(60) < topAt(110), true, 'o percentil acompanha o peso do perfil: mais leve, mesmo 1RM, top menor (mais forte)');
S().profile.weight = pw;
S().profile = null;
eq(body.strengthLevel(S().exercises['supino-reto']).reason, 'noProfile');


// ---- IA: três provedores ----
const ai = await import('../js/ai.js');
S().settings = { ...S().settings, apiKey: 'sk-ant-antiga', model: 'claude-opus-5-5' };
delete S().settings.aiKeys; delete S().settings.aiModels; delete S().settings.aiProvider;
eq([ai.aiProvider(), ai.aiKey(), ai.aiModel(), ai.aiEnabled()], ['claude', 'sk-ant-antiga', 'claude-opus-5-5', true], 'chave antiga do Claude continua valendo');
ai.setAiConfig('gemini', 'AIza-teste', 'gemini-modelo');
eq([ai.aiProvider(), ai.aiKey(), ai.aiModel(), ai.aiKey('claude')], ['gemini', 'AIza-teste', 'gemini-modelo', 'sk-ant-antiga'], 'cada provedor guarda a própria chave');
ai.setAiConfig('openai', 'sk-x', '');
eq(ai.aiEnabled(), false, 'sem modelo escolhido a IA fica desligada');
eq(ai.parseJSON('```json\n{"a":1}\n```'), { a: 1 }, 'JSON entre crases');
eq(ai.parseJSON('Claro! {"a":2} pronto'), { a: 2 }, 'JSON no meio do texto');
eq(store.exportData().settings.aiKeys, {}, 'chaves de IA não vão para o Drive nem para o backup');

// ---- treino aberto não marca alteração pendente ----
const before2 = S().updatedAt;
S().active = { id: 'a1', entries: [] };
store.save({ touch: false });
eq(S().updatedAt, before2, 'mexer no treino em andamento não muda a versão a enviar');
S().active = null;

// ---- descanso por exercício ----
const dmod = await import('../js/data.js');
S().settings.rest = 90;
eq([dmod.restOf({ rest: 150 }), dmod.restOf({ rest: 0 }), dmod.restOf({})], [150, 90, 90], 'descanso próprio ou o padrão');
const libId = dmod.LIB.find(l => !S().exercises[l.id]).id;
eq(dmod.ensureExercise(libId), S().exercises[libId], 'exercício da biblioteca entra na lista ao ser adicionado');

// ---- importar de texto ----
const ti = await import('../js/textimport.js');
eq(ti.setsOfLine('15kg 10 rep'), [{ w: 15, r: 10 }]);
eq(ti.setsOfLine('40x12'), [{ w: 40, r: 12 }]);
eq(ti.setsOfLine('3x10 com 50kg').length, 3);
eq(ti.setsOfLine('50kg 12/10/8').map(x => x.r), [12, 10, 8]);
eq(ti.setsOfLine('12 reps'), [{ w: 0, r: 12 }]);
eq(ti.setsOfLine('22,5 kg x 8'), [{ w: 22.5, r: 8 }]);
eq(ti.restOfLine('(1:30 min descanso)'), 90);
const imp = ti.parseWorkoutText(`12/11 Treino A
• Tríceps_
————EM PÉ CORDA————
(1:30 min descanso)
15kg 10 rep
15kg 9 rep
————Barra V————
17kg 8 rep
• Ombro_
———EL. LATERAL———
7kg 13 rep
Leg press 3x12 com 120kg
Desenv. maquina 50kg 10`, new Date(2026, 10, 13));
const items = imp.sessions[0].items;
eq(items.map(i => i.id), ['triceps-corda', 'triceps-barra', 'elevacao-lateral', 'leg-press', 'desenvolvimento-maquina'], 'reconhece exercícios abreviados e gírias');
eq([items[0].rest, items[0].sets.length, items[3].sets.length], [90, 2, 3]);
eq([imp.sessions[0].date.slice(0, 10), imp.sessions[0].name], ['2026-11-12', 'Treino A']);
eq(ti.parseWorkoutText('só texto sem séries').sessions, []);

// ---- consulta rápida de força ----
S().profile = { sex: 'm', birthYear: new Date().getFullYear() - 30, height: 178, weight: 80 };
const q1 = body.quickLevel('supino-reto', 100, 5), q2 = body.quickLevel('supino-reto', 60, 5);
eq([q1.top < q2.top, Math.round(q1.oneRM)], [true, Math.round(e1rm(100, 5))], 'mais carga, top menor');
eq(body.quickLevel('peck-deck', 50, 10), null, 'aparelho não entra');
eq(body.quickLevel('barra-fixa', 0, 10).top > 0, true, 'peso corporal usa o peso do perfil');
S().profile = null;

console.log(`ok: ${n} verificações passaram`);
