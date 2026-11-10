// Testes rápidos do interpretador de voz e da progressão:  node tools/test.mjs
import assert from 'node:assert/strict';

// localStorage mínimo para os módulos carregarem fora do navegador
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };

const { parseUtterance, wordsToDigits } = await import('../js/voice.js');
const { state } = await import('../js/store.js');
const { planFor, exGoalStatus, groupGoalStatus, e1rm, toSet, sessionPRs } = await import('../js/logic.js');

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

console.log(`ok: ${n} verificações passaram`);
