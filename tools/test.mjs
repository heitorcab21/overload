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

console.log(`ok: ${n} verificações passaram`);
