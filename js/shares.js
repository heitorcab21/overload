// Sem dependências: usado pela lógica (contagem de séries) e pelas telas.
// ---------- Quanto cada série conta para cada músculo (contagem fracionada) ----------
// O músculo principal do exercício conta 1 série. Nos multiarticulares, os músculos que também trabalham contam uma
// fração, como na meta-análise de Pelland e cols. (2024), em que contar o trabalho indireto como 0,5 previu melhor a
// hipertrofia. Critérios: 0,5 = auxiliar importante (padrão); 0,75 = auxiliar que faz quase tanto quanto o principal
// (bíceps na puxada supinada, glúteos no agachamento, no afundo e no búlgaro, quadríceps na subida no banco); 0,25 =
// estabilizador ou participação pequena. Fica 0 (fora da lista) quando estudos mostram que o músculo quase não cresce
// com o exercício: posteriores de coxa no agachamento e no leg press (Kubo e cols., 2019) e na elevação pélvica.
// Isoladores contam só para o músculo principal.
// "Ombros" junta as três cabeças do deltoide: nos supinos retos só a anterior trabalha, por isso 0,25 (no inclinado, 0,5).
export const MUSCLE_SHARE = {
  // peito: tríceps estende o cotovelo e o deltoide anterior flexiona o ombro em todos os supinos
  'supino-reto': { 'Tríceps': 0.5, Ombros: 0.25 },
  'supino-reto-halteres': { 'Tríceps': 0.5, Ombros: 0.25 },
  'supino-inclinado-barra': { Ombros: 0.5, 'Tríceps': 0.5 },
  'supino-inclinado-halteres': { Ombros: 0.5, 'Tríceps': 0.5 },
  'supino-declinado': { 'Tríceps': 0.5, Ombros: 0.25 }, // declinado usa menos o deltoide anterior
  'supino-maquina': { 'Tríceps': 0.5, Ombros: 0.25 },
  'supino-smith': { 'Tríceps': 0.5, Ombros: 0.25 },
  'flexao': { 'Tríceps': 0.5, Ombros: 0.25 },
  'pullover': { Costas: 0.5 }, // o grande dorsal estende o ombro junto com o peito
  // costas: o bíceps flexiona o cotovelo em puxadas e remadas; nas remadas, o deltoide posterior ajuda um pouco
  'puxada-frente': { 'Bíceps': 0.5 },
  'barra-fixa': { 'Bíceps': 0.5 },
  'puxada-triangulo': { 'Bíceps': 0.5 },
  'puxada-supinada': { 'Bíceps': 0.75 }, // pegada supinada põe o bíceps em posição mais forte
  'remada-curvada': { 'Bíceps': 0.5, Ombros: 0.25 },
  'remada-baixa': { 'Bíceps': 0.5, Ombros: 0.25 },
  'remada-unilateral': { 'Bíceps': 0.5, Ombros: 0.25 },
  'remada-halteres': { 'Bíceps': 0.5, Ombros: 0.25 },
  'remada-cavalinho': { 'Bíceps': 0.5, Ombros: 0.25 },
  'remada-maquina': { 'Bíceps': 0.5, Ombros: 0.25 },
  'hiperextensao': { 'Glúteos': 0.5, Posteriores: 0.5 }, // extensão de quadril com a lombar
  // ombros: o tríceps estende o cotovelo nos desenvolvimentos
  'desenvolvimento-halteres': { 'Tríceps': 0.5 },
  'desenvolvimento-barra': { 'Tríceps': 0.5 },
  'desenvolvimento-maquina': { 'Tríceps': 0.5 },
  'desenvolvimento-arnold': { 'Tríceps': 0.5 },
  'remada-alta': { Costas: 0.25, 'Bíceps': 0.25 }, // trapézio e flexão de cotovelo
  'face-pull': { Costas: 0.25 }, // trapézio médio e romboides
  // tríceps: nos mergulhos e no supino fechado, peito e deltoide anterior trabalham junto
  'mergulho': { Peito: 0.5, Ombros: 0.25 },
  'paralelas-maquina': { Peito: 0.5, Ombros: 0.25 },
  'supino-fechado': { Peito: 0.5, Ombros: 0.5 }, // pegada fechada usa menos peito que o supino normal
  'triceps-banco': { Ombros: 0.25, Peito: 0.25 },
  // quadríceps: no agachamento profundo o glúteo cresce tanto quanto o quadríceps (Kubo e cols., 2019) e tanto quanto
  // na elevação pélvica (Plotkin e cols., 2023); posteriores quase não crescem
  'agachamento-livre': { 'Glúteos': 0.75 },
  'agachamento-smith': { 'Glúteos': 0.75 },
  'agachamento-goblet': { 'Glúteos': 0.75 },
  'leg-press': { 'Glúteos': 0.5 },
  'leg-press-horizontal': { 'Glúteos': 0.5 },
  'hack': { 'Glúteos': 0.5 }, // flexão de quadril parecida com a do leg press
  'agachamento-bulgaro': { 'Glúteos': 0.75 }, // passada e búlgaro exigem muito do glúteo
  'afundo': { 'Glúteos': 0.75 },
  'afundo-caminhando': { 'Glúteos': 0.75 },
  // glúteos
  'agachamento-sumo': { 'Quadríceps': 0.5 },
  'subida-banco': { 'Quadríceps': 0.75 }, // o quadríceps é motor principal ao subir
  'elevacao-pelvica': {}, // posteriores ativam pouco e não crescem: conta só glúteos
  'ponte-gluteo': {},
  // posteriores: extensão de quadril com glúteos; no terra, lombar/trapézio e algo de quadríceps
  'stiff': { 'Glúteos': 0.5 },
  'bom-dia': { 'Glúteos': 0.5, Costas: 0.25 },
  'levantamento-terra': { 'Glúteos': 0.5, Costas: 0.25, 'Quadríceps': 0.25 },
  'terra-sumo': { 'Glúteos': 0.5, 'Quadríceps': 0.5, Costas: 0.25 }, // sumô: mais joelho
};
/** Músculos e quanto cada série do exercício conta para cada um: [[grupo, fração]], o principal primeiro. */
export function muscleShares(ex) {
  const extra = Object.entries(MUSCLE_SHARE[ex?.lib || ex?.base] || {}).filter(([g]) => g !== ex.group);
  return [[ex.group, 1], ...extra];
}
