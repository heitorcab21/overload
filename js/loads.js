// Como cada exercício da biblioteca é carregado: barra, halteres, polia, aparelho, peso corporal...
// A carga anotada é sempre a CARGA TOTAL levantada (data.js explica como somar em cada tipo).
export const LOAD_OF = {
  bar: ['supino-reto', 'remada-curvada', 'rosca-direta', 'rosca-scott', 'triceps-testa', 'agachamento-livre', 'stiff', 'levantamento-terra', 'elevacao-pelvica', 'supino-inclinado-barra', 'supino-declinado', 'desenvolvimento-barra', 'remada-alta', 'supino-fechado', 'terra-sumo', 'encolhimento-barra', 'bom-dia', 'ponte-gluteo'],
  db2: ['supino-inclinado-halteres', 'supino-reto-halteres', 'desenvolvimento-halteres', 'elevacao-lateral', 'rosca-alternada', 'rosca-martelo', 'agachamento-bulgaro', 'crucifixo-halteres', 'encolhimento', 'elevacao-frontal', 'rosca-inclinada', 'afundo', 'crucifixo-inclinado', 'remada-halteres', 'desenvolvimento-arnold', 'afundo-caminhando', 'subida-banco'],
  db1: ['remada-unilateral', 'triceps-frances', 'rosca-concentrada', 'triceps-coice', 'agachamento-goblet', 'agachamento-sumo', 'pullover', 'triceps-unilateral'],
  cable: ['puxada-frente', 'remada-baixa', 'pulldown-braco-reto', 'face-pull', 'triceps-corda', 'gluteo-polia', 'abdominal-polia', 'puxada-supinada', 'puxada-triangulo', 'elevacao-lateral-polia', 'rosca-polia', 'triceps-barra', 'triceps-frances-polia', 'aducao-polia'],
  cable2: ['crossover', 'crossover-baixo'],
  machine: ['peck-deck', 'cadeira-extensora', 'mesa-flexora', 'cadeira-flexora', 'cadeira-abdutora', 'panturrilha-em-pe', 'panturrilha-sentado', 'supino-maquina', 'remada-maquina', 'desenvolvimento-maquina', 'agachamento-smith', 'cadeira-adutora', 'triceps-maquina', 'paralelas-maquina', 'leg-press-horizontal', 'supino-smith', 'crucifixo-inverso-maquina', 'rosca-scott-maquina', 'flexora-em-pe', 'gluteo-maquina', 'panturrilha-smith', 'abdominal-maquina'],
  plate: ['leg-press', 'hack', 'remada-cavalinho', 'panturrilha-leg-press'],
  mixed: ['crucifixo-inverso'],
  bw: ['flexao', 'barra-fixa', 'mergulho', 'prancha', 'elevacao-pernas', 'hiperextensao', 'triceps-banco', 'abdominal-supra', 'abdominal-infra', 'abdominal-obliquo', 'prancha-lateral', 'rodinha'],
};
export const LOAD_TYPE = Object.fromEntries(Object.entries(LOAD_OF).flatMap(([k, ids]) => ids.map(id => [id, k])));

/**
 * Tipos em que a carga depende do aparelho: polias, máquinas e aparelhos de anilha (leg press, hack) mudam de uma
 * academia para outra (polia, alavanca, atrito). Barra, halteres e peso corporal valem em qualquer lugar.
 */
export const GYM_BOUND = new Set(['cable', 'cable2', 'machine', 'plate']);
