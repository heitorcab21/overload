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
eq(parseUtterance('estava pesado'), [], 'sensação não é mais registrada pela voz');
eq(parseUtterance('40 quilos 12 estava fácil'), [set(40, 12)]);
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
eq([planFor(ex).w, planFor(ex).reps, planFor(ex).kind], [42.5, [9, 9, 9], 'up'], 'sobe a carga no topo da faixa com recomeço inteligente: 40 × 12 ≈ 1RM 56 → 42,5 × 9 (não volta para 8)');

// ---- sistema imperial: guarda em kg, mostra em lb e sobe em degraus de libra ----
{
  const U = await import('../js/units.js');
  const { setsOfLine } = await import('../js/textimport.js');
  const { parseSet } = await import('../js/export.js');
  state.settings.units = 'imperial';
  const lb = v => Math.round(v * U.LB * 10000) / 10000;
  eq([U.toW(80), U.fromW(176.4), U.toStep(2.5), U.toStep(2), U.toStep(5)], [176.4, 80.0137, 5, 5, 10], 'conversões de carga e degraus em lb');
  eq([U.heightStr(181), U.toLen(80), U.toDist(5), U.toSpeed(10)], ['5\'11"', 31.5, 3.11, 6.2], 'altura, medidas, distância e velocidade');
  state.sessions = [sess(2, [{ w: lb(135), r: 12 }, { w: lb(135), r: 12 }, { w: lb(135), r: 12 }])];
  eq(U.toW(planFor(ex).w), 140, 'imperial: 135 lb no topo da faixa sobe para 140 lb, não para 140,5');
  eq(planFor(ex).note, 'Você fez 12 reps em todas as séries: suba para 140 lb × 10, o mesmo nível de força com mais carga.', 'aviso de subida em lb');
  eq(setsOfLine('135 lb x 10').map(s => U.toW(s.w)), [135], 'texto em libras vira kg');
  eq(setsOfLine('3x10 com 95').map(s => U.toW(s.w)), [95, 95, 95], 'imperial: número sem unidade é libra');
  eq(U.toW(parseSet('135 lb x 10').w), 135, 'planilha em libras');
  state.settings.units = 'metric';
  eq([U.toW(80), U.toStep(2.5), U.heightStr(181)], [80, 2.5, '181 cm'], 'métrico continua igual');
  eq(setsOfLine('3x10 com 50kg').map(s => s.w), [50, 50, 50], 'métrico: kg sem conversão');
  delete state.settings.units;
}

// ---- o treino mira a meta do mês ----
{
  const { setExGoal, exGoalStatus: gst } = await import('../js/logic.js');
  const keepS = state.sessions, keepG = state.goals;
  const d0 = new Date(2026, 10, 9, 12); // segunda semana de novembro
  state.goals = { ex: {}, groups: {} };
  state.sessions = [sess(5, [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 10 }])];
  const base = planFor(ex, d0);
  eq([base.kind, base.w, base.reps], ['reps', 40, [11, 10, 10]], 'sem meta: progressão normal');
  setExGoal(ex, 45, 10, new Date(2026, 10, 2, 12));
  const wk = gst(ex, d0).weekSet;
  const p = planFor(ex, d0);
  eq([p.kind, p.w <= 42.5, p.goal], ['goal', true, wk], 'com meta: puxa para o degrau da semana, no máximo +1 degrau de carga');
  eq(e1rm(p.w, p.reps[0]) >= e1rm(wk.w, wk.r) - 1e-6 || p.reps[0] === ex.repMax + 2, true, 'a primeira série alcança a meta da semana');
  state.sessions = [sess(5, [{ w: 40, r: 10, t: 'fail' }, { w: 40, r: 8 }, { w: 40, r: 7 }], { flags: ['dor'] })];
  eq(planFor(ex, d0).kind === 'goal', false, 'com dor marcada não empurra para a meta');
  // prazo de 30 dias corridos (não o fim do mês): criada em 25/11, vale até 25/12, em ~5 degraus semanais
  state.sessions = [sess(5, [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 10 }])];
  setExGoal(ex, 45, 10, new Date(2026, 10, 25, 12));
  const a1 = gst(ex, new Date(2026, 11, 5, 12)), a2 = gst(ex, new Date(2026, 11, 26, 12));
  eq([a1.expired, a1.weeks >= 4, a1.until.getDate(), a1.until.getMonth(), a2.expired], [false, true, 25, 11, true], 'meta de 30 dias: continua valendo no mês seguinte e vence no 30º dia');
  const E = st => e1rm(st.weekSet.w, st.weekSet.r);
  const steps = [0, 7, 14, 21, 28].map(dd => gst(ex, new Date(2026, 10, 25 + dd, 12)));
  eq([E(steps[0]) < E(steps[2]), E(steps[2]) < E(steps[4]) + 1e-6, steps[4].weekSet.w === 45 && steps[4].weekSet.r === 10], [true, true, true], 'degraus semanais sobem até a meta na última semana');
  state.sessions = keepS; state.goals = keepG;
}

// ---- níveis de esforço da IA por modelo ----
{
  const { effortLevels } = await import('../js/ai.js');
  eq(effortLevels('claude', 'claude-opus-5-5'), ['low', 'medium', 'high', 'xhigh', 'max'], 'Opus 5.5: cinco níveis');
  eq(effortLevels('claude', 'claude-haiku-4-5'), [], 'Haiku 4.5: sem esforço (não manda o campo)');
  eq(effortLevels('openai', 'gpt-5-mini'), ['minimal', 'low', 'medium', 'high'], 'GPT-5: reasoning_effort');
  eq(effortLevels('openai', 'gpt-4o'), [], 'GPT-4o: sem esforço');
  eq(effortLevels('gemini', 'gemini-2.5-flash'), ['low', 'medium', 'high'], 'Gemini 2.5: orçamento de raciocínio');
  eq(effortLevels('gemini', 'gemini-4-hydrogen'), ['low', 'high'], 'Gemini 4: nível de raciocínio (pensa pouco no chat)');
  const { isExperimental } = await import('../js/ai.js');
  eq(['gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'].map(m => isExperimental('gemini', m)), [false, false, true, false], 'Gemini 4 (Hydrogen etc.) é modelo lançado; só prévias são experimentais');
}

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
eq(state.goals.groups.Peito, { week: 10, month: 43, auto: true }, 'sem objetivo: 10 séries por semana pela ciência (não a cópia da ficha)');
state.exercises.y = { id: 'y', name: 'Crucifixo', group: 'Peito', sets: 4, repMin: 10, repMax: 15, step: 5 };
state.exercises.z = { id: 'z', name: 'Remada', group: 'Costas', sets: 3, repMin: 8, repMax: 12, step: 2.5 };
state.routines[0].ex.push('y', 'z');
defaultGroupGoals(now);
eq([state.goals.groups.Peito.week, state.goals.groups.Costas.week], [10, 10], 'grupo novo na ficha ganha meta');
state.goals.groups.Costas = { week: 10, month: 40, auto: false };
state.routines[0].ex = ['x'];
defaultGroupGoals(now);
eq([state.goals.groups.Peito.week, state.goals.groups.Costas], [10, { week: 10, month: 40, auto: false }], 'meta editada fica; automática ajusta');
{
  const { isEffective, fillPlan } = await import('../js/logic.js');
  eq([isEffective({ w: 60, r: 10 }, 100), isEffective({ w: 50, r: 25 }, 100), isEffective({ w: 80, r: 8, rir: 6 }, 100), isEffective({ w: 0, r: 12 }, 0)],
    [true, false, false, true], 'série efetiva: carga >= 60% da força estimada e até 4 reps sobrando');
  state.routines = [{ id: 'r', name: 'A', ex: ['x', 'y'] }, { id: 'r2', name: 'B', ex: ['x'] }];
  const keepX = state.exercises.x.sets, keepY = state.exercises.y.sets;
  const fp = fillPlan('Peito', 12);
  eq([fp.have, fp.total, fp.plan.map(p => `${p.ex.id}:${p.from}>${p.to}`)], [10, 12, ['x:3>4']], 'completar a ficha: +1 série no exercício com menos séries (x está em 2 treinos: +2 na semana)');
  eq(fp.total >= 12 && fp.plan.every(p => p.to <= 6), true, 'completar a ficha: chega na meta sem passar de 6 séries por exercício');
  eq(fillPlan('Peito', 9), null, 'ficha já entrega: nada a completar');
  state.exercises.x.sets = keepX; state.exercises.y.sets = keepY;
  state.routines = [{ id: 'r', name: 'A', ex: ['x'] }];
}

// ---- metas pelo objetivo (séries e cardio) e metas de carga em 3 cenários ----
{
  const { saveIntent } = await import('../js/intent.js');
  const { intentWeekSets } = await import('../js/logic.js');
  const { scenarios, judgeGoal } = await import('../js/scenarios.js');
  const keepSessions = state.sessions, keepGoals = state.goals, keepCardio = state.cardioGoal;
  state.goals = { ex: {}, groups: { Costas: { week: 10, month: 40, auto: false } } };
  state.routines = [{ id: 'r', name: 'A', ex: ['x', 'y'] }];
  state.sessions = [sess(10, [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 10 }])];
  saveIntent({ goal: 'massa', focus: ['Glúteos', 'Braços'], days: 4 }, now);
  eq([state.goals.groups.Peito.week, state.goals.groups['Glúteos'].week, state.goals.groups['Bíceps'].week, state.goals.groups.Costas.week], [14, 18, 14, 10],
    'massa: 14 séries nos grupos dos treinos, 18 nos priorizados (braços 3/4) e a meta editada à mão fica');
  eq([state.cardioGoal, Object.keys(state.goals.ex).length], [90, 0], 'cardio pelo objetivo; metas de carga a pessoa escolhe');
  eq([intentWeekSets('Peito', { goal: 'forca', focus: [] }), intentWeekSets('Panturrilhas', { goal: 'emagrecer', focus: ['Panturrilhas'] })], [10, 11], 'força: 10 séries; panturrilha priorizada no emagrecer: 14 × 3/4');
  const sc = scenarios(ex, now);
  eq(sc.map(x => x.key), ['conservador', 'moderado', 'dificil'], 'três cenários');
  eq(sc.map(x => Math.round(x.growth * 1000) / 10), [2.5, 5, 8], 'iniciante (sem percentil, pouco histórico): +2,5%, +5% e +8% no mês');
  const e = (w, r) => w * (1 + r / 30);
  eq(sc.every((x, i) => i === 0 || e(x.set.w, x.set.r) > e(sc[i - 1].set.w, sc[i - 1].set.r)), true, 'cada cenário pede mais que o anterior');
  eq([judgeGoal(ex, 40, 9, now).level, judgeGoal(ex, 40, 11, now).level, judgeGoal(ex, 42.5, 10, now).level, judgeGoal(ex, 42.5, 11, now).level, judgeGoal(ex, 45, 11, now).level],
    ['facil', 'realista', 'ambiciosa', 'muito-dificil', 'ilusoria'], 'veredito da meta própria');
  state.intent = { goal: 'emagrecer', focus: [], days: 3 };
  eq(Math.round(scenarios(ex, now)[1].growth * 1000) / 10, 2.5, 'emagrecendo, o ritmo cai pela metade');
  state.intent = null;
  state.sessions = [];
  eq(scenarios(ex, now)?.[0].est ?? null, ex.lib && !ex.bw ? 'std' : (ex.startW > 0 ? 'start' : null), 'sem treino: estima (padrões de força ou carga inicial) quando dá');
  const withStart = { ...ex, id: 'zz', lib: undefined, bw: false, startW: 30, repMin: 8 };
  eq([scenarios(withStart, now)[0].est, scenarios(withStart, now)[1].set.w >= 30], ['start', true], 'sem treino e com carga inicial: estima por ela');
  const keepProfile = state.profile;
  state.profile = null;
  eq(scenarios({ ...withStart, startW: 0, group: 'Peito' }, now), null, 'sem treino, sem carga inicial e sem perfil: sem cenários');
  state.profile = { sex: 'm', birthYear: 2000, height: 180, weight: 80 };
  eq([scenarios({ ...withStart, startW: 0, group: 'Peito', step: 5 }, now)[0].est, scenarios({ ...withStart, startW: 0, group: 'Peito', step: 5 }, now)[0].set.w >= 25],
    ['bw', true], 'aparelho sem treino: parte da carga típica pelo peso corporal (80 kg × 0,35 = 28 → 30)');
  state.profile = keepProfile;
  state.sessions = keepSessions; state.goals = keepGoals; state.cardioGoal = keepCardio;
  state.routines = [{ id: 'r', name: 'A', ex: ['x'] }];
}

// ---- cenários de séries e de cardio ----
{
  const { groupScenarios, cardioScenarios } = await import('../js/logic.js');
  eq(groupScenarios('Peito', null).map(x => x.n), [8, 10, 14], 'séries sem objetivo: 8, 10 e 14');
  eq(groupScenarios('Bíceps', null).map(x => x.n), [6, 8, 11], 'grupo pequeno: 3/4');
  eq(groupScenarios('Peito', { goal: 'massa', focus: [] }).map(x => x.n), [10, 14, 20], 'hipertrofia: 10, 14 e 20 (faixa de 12 a 20 da literatura)');
  eq(groupScenarios('Peito', { goal: 'massa', focus: ['Peito'] }).map(x => x.n), [14, 18, 22], 'peito priorizado na hipertrofia: 14, 18 e 22');
  eq(cardioScenarios({ goal: 'emagrecer', focus: [] })[1].n, 225, 'cardio segue o objetivo (emagrecer: 225 min)');
  eq(cardioScenarios(null).map(x => x.n), [90, 150, 300], 'cardio: 90, 150 (OMS) e 300');
}

// ---- polia no nível de força ----
{
  const { quickLevel } = await import('../js/body.js');
  const p = { sex: 'm', age: 23, weight: 82, height: 181 };
  const pd = quickLevel('puxada-frente', 60, 10, p), rw = quickLevel('remada-baixa', 60, 10, p);
  eq([pd.pct > 35 && pd.pct < 75, rw.pct > 35 && rw.pct < 80], [true, true], 'puxada e remada na polia (60 kg × 10, 82 kg): perto do intermediário');
  // calibração pela Strength Level: o valor "intermediário" da tabela (80 kg, homem; 60 kg, mulher) = percentil 50
  const m80 = { sex: 'm', age: 30, weight: 80, height: 180 }, f60 = { sex: 'f', age: 30, weight: 60, height: 165 };
  const p50 = (id, w, r, who) => Math.round(quickLevel(id, w, r, who, 'sl').pct);
  eq([p50('supino-reto', 98, 1, m80), p50('agachamento-livre', 132, 1, m80), p50('levantamento-terra', 155, 1, m80), p50('puxada-frente', 85, 1, m80),
    p50('supino-reto-halteres', 80, 1, m80), p50('barra-fixa', 0, 13, m80), p50('flexao', 0, 38, m80), p50('supino-reto', 47, 1, f60), p50('leg-press', 140, 1, f60)],
    [50, 50, 50, 50, 50, 50, 50, 50, 50], 'valores intermediários da Strength Level dão o percentil 50 (barra, máquina, halteres e peso do corpo)');
  eq(Math.round(quickLevel('supino-reto', 151, 1, m80, 'sl').pct), 95, 'elite da tabela = percentil 95');
  // população geral (Cooper Institute / ACSM): supino 1,32 × o peso = percentil 80; 1,63 = 95
  eq([Math.round(quickLevel('supino-reto', 1.32 * 80, 1, m80).pct), Math.round(quickLevel('supino-reto', 1.63 * 80, 1, m80).pct), Math.round(quickLevel('supino-reto', 0.80 * 60, 1, f60).pct)],
    [80, 95, 80], 'nível de treino comparado com adultos em geral pelas normas do Cooper');
}

// ---- metas de carga: decisão por exercício ----
{
  const lg = await import('../js/goalchoice.js');
  const keepGoals = state.goals;
  state.goals = { ex: {}, groups: {} };
  const ids = lg.undecided().map(x => x.id);
  eq(ids.length > 0, true, 'exercícios das fichas sem meta: falta escolher');
  const first = state.exercises[ids[0]];
  state.goals.own = { [first.id]: true };
  eq([lg.decision(first), lg.undecided().length], ['own', ids.length - 1], 'seguir a própria progressão conta como decisão');
  state.goals = keepGoals;
}

// ---- memória do Treinador ----
{
  const cm = await import('../js/coachmem.js');
  const keepCoach = state.coach;
  state.coach = { chat: [], notes: [], summary: '', folded: 0, checkinAt: 0 };
  const c = state.coach;
  c.chat.push({ role: 'assistant', content: 'Oi! Como foi o treino?', at: 1, checkin: true }, { role: 'user', content: 'Doeu o ombro', at: 2 });
  eq(cm.apiMessages().map(m => m.role), ['user', 'assistant', 'user'], 'começa pela pessoa mesmo quando o treinador puxou assunto');
  c.chat.push({ role: 'user', content: 'e o joelho', at: 3, error: true });
  eq(cm.apiMessages().length, 3, 'mensagens com erro não vão para a IA');
  c.chat = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i), at: i }));
  eq(cm.foldRange(), [0, 18], 'acima de 24 mensagens, as mais antigas viram resumo (fica as 12 últimas)');
  c.folded = 18;
  eq([cm.foldRange(), cm.apiMessages().length, cm.apiMessages()[0].content], [null, 12, '18'], 'depois do resumo vão só as 12 recentes');
  cm.applyNotes({ add: ['Dor no ombro direito no supino', 'dor no ombro direito no supino', 'Treina em casa às terças'], update: [], remove: [] }, new Date('2026-11-21T12:00:00Z'));
  eq(c.notes.map(n => n.text), ['Dor no ombro direito no supino', 'Treina em casa às terças'], 'anota sem repetir');
  const id = c.notes[0].id;
  cm.applyNotes({ add: [], update: [{ id, text: 'Ombro direito melhorou' }], remove: [c.notes[1].id] });
  eq(c.notes.map(n => n.text), ['Ombro direito melhorou'], 'atualiza e apaga pelo id');
  c.checkinAt = 0; c.chat = [{ role: 'user', content: 'x', at: Date.now() }];
  eq(cm.shouldCheckin(), false, 'não puxa assunto logo depois de uma conversa');
  c.chat[0].at = Date.now() - 5 * 3600e3;
  eq(cm.shouldCheckin(), true, 'puxa assunto depois de algumas horas');
  c.checkinAt = Date.now() - 3600e3;
  eq(cm.shouldCheckin(), false, 'no máximo uma vez a cada 18 h');
  state.coach = keepCoach;
}

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
eq(importGoalsCSV(goalsCSV(now), now), { groups: 0, ex: 0, weeks: 0, unknown: [] }, 'exportar e importar sem mudar nada não altera metas');
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
eq(parseUtterance('it was hard'), []);
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
S().exercises['abdominal-maquina'] = { id: 'abdominal-maquina', lib: 'abdominal-maquina', name: 'x', group: 'Abdômen', sets: 3, repMin: 10, repMax: 15, step: 5 };
S().sessions.push({ id: 'bench', date: nowIso, entries: [{ exId: 'supino-reto', sets: [{ w: 120, r: 1 }] }] });
const lv = body.maxLevel(S().exercises['supino-reto']);
eq([lv.lift, lv.top >= 20 && lv.top <= 27], ['bench', true], 'supino de 120 kg com 80 kg (Strength Level: avançado = 124 kg): por volta do top 23%');
eq(body.strengthLevel(S().exercises['abdominal-maquina']).reason, 'notComparable', 'sem tabela na fonte: fica sem nível');
S().sessions.push({ id: 'bench2', date: nowIso, entries: [{ exId: 'supino-reto', sets: [{ w: 100, r: 5, rir: 3 }] }] });
eq(Math.round(body.maxLevel(S().exercises['supino-reto']).oneRM), Math.round(e1rm(100, 8)), 'RIR entra na estimativa do 1RM');
const lvR = body.maxLevel(S().exercises['supino-reto']);
eq([lvR.src.w, lvR.src.r, lvR.src.rir, lvR.src.test], [100, 5, 3, false], 'mostra a série que gerou o 1RM');
eq([body.inferredRir({ w: 75, r: 10 }, [{ w: 75, r: 10 }, { w: 75, r: 10 }, { w: 75, r: 10 }, { w: 75, r: 10 }]).rir,
  body.inferredRir({ w: 75, r: 10 }, [{ w: 75, r: 10 }, { w: 75, r: 8 }, { w: 75, r: 7 }]).rir,
  body.inferredRir({ w: 75, r: 10, rir: 1 }, [{ w: 75, r: 10 }, { w: 75, r: 10 }, { w: 75, r: 10 }, { w: 75, r: 10 }]).rir], [2, 0, 1],
  '4 séries iguais sem RIR anotado: ~2 de reserva; reps caindo: foi até a falha; RIR anotado vale mais');
S().exercises['supino-reto'].tests = [{ date: nowIso, w: 140, r: 1 }];
const lvT = body.maxLevel(S().exercises['supino-reto']);
eq([lvT.oneRM, lvT.src.test], [140, true], 'teste de 1 rep: o 1RM é a própria carga');
S().exercises['supino-reto'].tests = [{ date: new Date(Date.now() - 200 * 864e5).toISOString(), w: 200, r: 1 }];
eq(body.maxLevel(S().exercises['supino-reto']).src.test, false, 'teste com mais de 180 dias deixa de valer');
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

// ---- exercício parado ----
{
  const lg = await import('../js/logic.js');
  const keep = S().sessions;
  S().exercises.stall = { id: 'stall', name: 'Teste', group: 'Peito', sets: 2, repMin: 8, repMax: 12, step: 2.5 };
  const d = n => new Date(Date.now() - n * 864e5).toISOString();
  S().sessions = [[20, 60], [14, 60], [10, 57.5], [5, 60], [1, 55]].map(([n, w], i) => ({ id: 'st' + i, date: d(n), entries: [{ exId: 'stall', sets: [{ w, r: 8 }, { w, r: 8 }] }] }));
  eq(lg.stalledExercises().map(x => [x.ex.id, x.n]), [['stall', 4]], '4 treinos depois do melhor, sem superar = parado');
  S().sessions.push({ id: 'st9', date: d(0), entries: [{ exId: 'stall', sets: [{ w: 62.5, r: 8 }] }] });
  eq(lg.stalledExercises().length, 0, 'superou: sai da lista');
  S().sessions = keep;
  delete S().exercises.stall;
}

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
eq(body.quickLevel('abdominal-maquina', 50, 10), null, 'sem tabela na fonte: sem nível');
eq(body.quickLevel('barra-fixa', 0, 10).top > 0, true, 'peso corporal usa o peso do perfil');
S().profile = null;

// ---- voz: aquecimento ----
eq(parseUtterance('foi aquecimento'), [{ type: 'warm' }]);
eq(parseUtterance('isso foi aquecimento'), [{ type: 'warm' }]);
eq(parseUtterance('não foi aquecimento'), [{ type: 'unwarm' }]);
eq(parseUtterance('era série válida'), [{ type: 'unwarm' }]);
eq(parseUtterance('aquecimento vinte quilos quinze'), [{ type: 'set', w: 20, r: 15, warm: true }]);
eq(parseUtterance('it was a warm up', 'en'), [{ type: 'warm' }]);
eq(parseUtterance('no fue calentamiento', 'es'), [{ type: 'unwarm' }]);
eq(parseUtterance('40 quilos 12 repetições'), [set(40, 12)], 'série normal continua igual');

// ---- cargas de referência importadas viram o treino anterior ----
{
  const keep = S().sessions;
  S().sessions = [];
  S().exercises.rf = { id: 'rf', name: 'Ref', group: 'Peito', sets: 3, repMin: 8, repMax: 12, step: 2.5, ref: { date: new Date().toISOString(), sets: [{ w: 40, r: 10 }, { w: 40, r: 9 }, { w: 40, r: 9 }] } };
  const pf = planFor(S().exercises.rf);
  eq([pf.w, pf.first ?? false, pf.last?.w], [40, false, 40], 'sem treino feito, as cargas importadas viram a base');
  S().sessions = [{ id: 'rf1', date: new Date(Date.now() + 864e5).toISOString(), entries: [{ exId: 'rf', sets: [{ w: 45, r: 8 }, { w: 45, r: 8 }, { w: 45, r: 8 }] }] }];
  eq(planFor(S().exercises.rf).last.w, 45, 'treino mais novo passa na frente da referência');
  S().sessions = keep;
  delete S().exercises.rf;
}

// ---- treinos prontos só usam exercícios que existem ----
{
  const dm = await import('../js/data.js');
  const bad = dm.TEMPLATES.flatMap(tp => tp.routines.flatMap(([, ids]) => ids.filter(id => !dm.LIB_BY_ID[id]).map(id => `${tp.id}: ${id}`)));
  eq(bad, [], 'todo exercício dos treinos prontos existe na biblioteca');
}

// ---- substitutos e bi-sets ----
{
  const dm = await import('../js/data.js');
  const sb = dm.substitutes(dm.ensureExercise('supino-reto'), 100, 3);
  eq(sb.length, 3, 'três sugestões para o supino');
  eq(sb.find(x => x.id === 'supino-reto-halteres')?.w, 80, 'halteres ≈ 80% da barra');
  eq(sb.every(x => dm.LIB_BY_ID[x.id] && x.id !== 'supino-reto'), true);
  eq(dm.substitutes(dm.ensureExercise('cadeira-extensora'), 50, 3).length, 3, 'família pequena completa com o mesmo grupamento');
  const r = { ex: ['a', 'b', 'c', 'd', 'e'], link: { a: true, c: true, d: true } };
  eq(dm.supGroups(r), [['a', 'b'], ['c', 'd', 'e']], 'bi-set a+b e tri-set c+d+e');
  eq(dm.supGroups({ ex: ['a', 'b'], link: { b: true } }), [], 'ligação no último não forma grupo');
}

// ---- cardio ----
{
  const cd = await import('../js/cardio.js');
  const st = await import('../js/store.js');
  st.state.profile = null;
  eq(cd.cardioKcal('esteira', 60, 'moderado'), 490, 'esteira moderada 1 h, 70 kg ≈ 490 kcal');
  st.state.cardio = [{ id: 'c1', date: new Date().toISOString(), type: 'bike', min: 30 }, { id: 'c2', date: new Date(Date.now() - 20 * 864e5).toISOString(), type: 'bike', min: 40 }];
  const wk = cd.cardioWeeks(8);
  eq([wk.length, wk.at(-1).min], [8, 30], 'minutos da semana atual');
  st.state.cardio = [];
}

// ---- rotinas de cardio ----
{
  const cp = await import('../js/cardioplan.js');
  const st = await import('../js/store.js');
  const hiit = cp.CARDIO_TEMPLATES.find(x => x.id === 'hiit-30-30');
  eq(cp.planSeconds(hiit.blocks), 300 + 8 * 60 + 300, 'duração do HIIT 30/30');
  eq(cp.segmentsOf(hiit.blocks).length, 1 + 16 + 1, 'etapas: aquecer, 8 fortes, 8 descansos, desaquecer');
  eq(cp.hrMax(30), 187, 'FC máxima de Tanaka aos 30 anos');
  eq(cp.CARDIO_TEMPLATES.every(x => x.about && cp.planSeconds(x.blocks) > 0), true, 'todo modelo tem explicação e duração');
  eq(cp.planSeconds(cp.CARDIO_TEMPLATES.find(x => x.id === 'noruegues-4x4').blocks), 600 + 4 * 420 + 300, 'duração do 4×4');
  const r = { id: 'cr1', name: 'x', type: 'bike', blocks: JSON.parse(JSON.stringify(hiit.blocks)) };
  st.state.cardio = [{ id: 'k1', date: new Date().toISOString(), type: 'bike', min: 18, routineId: 'cr1', rpe: 5 }];
  const s1 = cp.nextStep(r);
  eq([s1.kind, s1.key, s1.n], ['up', 'round', 9], 'fácil: mais uma rodada');
  s1.apply(r.blocks);
  eq(r.blocks[1].rounds, 9);
  st.state.cardio[0].rpe = 9;
  eq(cp.nextStep(r).kind, 'down', 'pesado: não avança');
  const tm = { id: 'cr2', type: 'esteira', blocks: [{ kind: 'cont', sec: 1800, speed: 4.8, incline: 12 }] };
  st.state.cardio = [{ id: 'k2', date: new Date().toISOString(), type: 'esteira', min: 30, routineId: 'cr2', rpe: 4 }];
  eq([cp.nextStep(tm).key, cp.nextStep(tm).v], ['speed', 5.3], 'contínuo com velocidade: +0,5 km/h');
  st.state.cardio = [];
}

// ---- todos os arquivos carregam sem erro de sintaxe (inclusive telas que os testes não usam) ----
{
  const { readdirSync } = await import('node:fs');
  const bad = [];
  for (const dir of ['js', 'js/views', 'js/locales']) {
    for (const f of readdirSync(new URL(`../${dir}/`, import.meta.url)).filter(x => x.endsWith('.js'))) {
      try { await import(`../${dir}/${f}`); } catch (e) { if (e instanceof SyntaxError) bad.push(`${dir}/${f}: ${e.message}`); }
    }
  }
  eq(bad, [], 'sem erro de sintaxe');
}

console.log(`ok: ${n} verificações passaram`);
