// Biblioteca de exercícios (com execução ideal) e modelos de rotina.
// Os textos aqui estão em português; as traduções ficam em js/locales/.
import { t, exPack } from './i18n.js';

export const GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps',
  'Quadríceps', 'Posteriores', 'Glúteos', 'Panturrilhas', 'Abdômen',
];

// x(id, nome, grupo, [séries, repMin, repMax], passo de carga em kg, execução, erros, dica, opções)
const x = (id, name, group, [sets, repMin, repMax], step, how, errs, tip, opt = {}) =>
  ({ id, name, group, sets, repMin, repMax, step, how, errs, tip, ...opt });

export const LIB = [
  // ---------- Peito ----------
  x('supino-reto', 'Supino reto com barra', 'Peito', [3, 6, 10], 2.5,
    ['Deite com os olhos embaixo da barra, pés firmes no chão e escápulas juntas e para baixo.',
     'Desça a barra controlando até tocar de leve o meio do peito, cotovelos a cerca de 45–60° do tronco.',
     'Empurre a barra para cima e levemente para trás até estender os braços, sem perder a posição das escápulas.'],
    ['Quicar a barra no peito ou tirar o quadril do banco.', 'Abrir os cotovelos a 90°, sobrecarregando o ombro.'],
    'Pense em "dobrar a barra" para ativar as costas e estabilizar os ombros.'),
  x('supino-inclinado-halteres', 'Supino inclinado com halteres', 'Peito', [3, 8, 12], 4,
    ['Banco entre 30° e 45°. Halteres na linha do peito superior, punhos neutros sobre os cotovelos.',
     'Desça até sentir o peito alongar, com os antebraços sempre verticais.',
     'Suba aproximando os halteres sem batê-los, mantendo o peito aberto.'],
    ['Inclinar demais o banco e transformar em exercício de ombro.', 'Encurtar a descida para usar mais carga.'],
    'Mantenha as escápulas "no bolso de trás" durante toda a série.'),
  x('supino-reto-halteres', 'Supino reto com halteres', 'Peito', [3, 8, 12], 4,
    ['Deitado, halteres ao lado do peito, pés firmes e escápulas retraídas.',
     'Desça em arco até os halteres ficarem na altura do peito, com alongamento confortável.',
     'Empurre para cima convergindo levemente, sem travar com força os cotovelos.'],
    ['Deixar os punhos dobrarem para trás.', 'Perder o controle na descida.'],
    'A descida deve durar cerca de 2 segundos.'),
  x('peck-deck', 'Crucifixo na máquina (peck deck)', 'Peito', [3, 10, 15], 5,
    ['Ajuste o banco para as mãos ficarem na altura do peito. Costas apoiadas e peito aberto.',
     'Feche os braços em arco, como se abraçasse um barril, até as mãos quase se tocarem.',
     'Segure 1 segundo na contração e volte devagar até sentir o peito alongar.'],
    ['Projetar os ombros para a frente no final.', 'Voltar rápido demais e deixar a carga "bater".'],
    'Cotovelos levemente flexionados e fixos: o movimento vem do ombro, não do cotovelo.'),
  x('crossover', 'Crossover na polia', 'Peito', [3, 10, 15], 2.5,
    ['Polias altas, um passo à frente, tronco levemente inclinado e peito aberto.',
     'Traga as mãos para baixo e para a frente em arco até se encontrarem na linha do umbigo.',
     'Volte controlando até os cotovelos passarem um pouco da linha dos ombros.'],
    ['Transformar em empurrada dobrando muito os cotovelos.', 'Balançar o tronco para ajudar.'],
    'Cruze levemente as mãos no final para uma contração maior.'),
  x('flexao', 'Flexão de braços', 'Peito', [3, 8, 20], 0,
    ['Mãos um pouco mais abertas que os ombros, corpo em linha reta da cabeça ao calcanhar.',
     'Desça o peito até quase tocar o chão, cotovelos a cerca de 45° do tronco.',
     'Empurre o chão até estender os braços, mantendo abdômen e glúteos contraídos.'],
    ['Deixar o quadril cair ou subir.', 'Fazer meia amplitude.'],
    'Ficou fácil? Eleve os pés ou use uma mochila com carga.', { bw: true }),

  // ---------- Costas ----------
  x('puxada-frente', 'Puxada na frente (pulldown)', 'Costas', [3, 8, 12], 5,
    ['Pegada um pouco mais aberta que os ombros, coxas travadas e tronco levemente inclinado para trás.',
     'Comece abaixando as escápulas e puxe a barra até a parte alta do peito, cotovelos apontando para baixo.',
     'Volte controlando até os braços estenderem e as costas alongarem.'],
    ['Jogar o tronco para trás para usar impulso.', 'Puxar a barra atrás da nuca.'],
    'Pense em levar os cotovelos ao bolso de trás, não em puxar com as mãos.'),
  x('barra-fixa', 'Barra fixa', 'Costas', [3, 5, 12], 2.5,
    ['Pendure-se com a pegada pouco mais aberta que os ombros, abdômen firme e pernas paradas.',
     'Puxe levando o peito em direção à barra até o queixo passar dela.',
     'Desça controlando até estender totalmente os braços.'],
    ['Usar balanço das pernas (kipping) sem querer.', 'Não estender os braços embaixo.'],
    'Sem peso extra, anote 0. Com cinto de carga, anote só o peso extra.', { bw: true }),
  x('remada-curvada', 'Remada curvada com barra', 'Costas', [3, 6, 10], 2.5,
    ['Pés na largura do quadril, joelhos levemente flexionados e tronco inclinado a ~45°, coluna neutra.',
     'Puxe a barra em direção ao umbigo, cotovelos próximos do corpo.',
     'Aperte as escápulas no topo e desça controlando sem arredondar a lombar.'],
    ['Subir o tronco a cada repetição para ajudar.', 'Arredondar a coluna.'],
    'Se a lombar cansar antes das costas, reduza a carga ou use apoio no peito.'),
  x('remada-baixa', 'Remada baixa na polia', 'Costas', [3, 8, 12], 5,
    ['Sentado, pés apoiados, joelhos levemente flexionados e coluna ereta.',
     'Puxe o triângulo até o abdômen, abrindo o peito e juntando as escápulas.',
     'Volte devagar deixando as escápulas abrirem, sem curvar a lombar.'],
    ['Balançar o tronco para frente e para trás.', 'Encolher os ombros em direção às orelhas.'],
    'Segure 1 segundo com o triângulo no abdômen.'),
  x('remada-unilateral', 'Remada unilateral (serrote)', 'Costas', [3, 8, 12], 2,
    ['Um joelho e a mão do mesmo lado apoiados no banco, coluna paralela ao chão.',
     'Puxe o halter em direção ao quadril, cotovelo rente ao corpo.',
     'Desça até o braço estender e a escápula alongar, sem girar o tronco.'],
    ['Girar o tronco para subir o halter.', 'Puxar em direção ao ombro em vez do quadril.'],
    'Anote o peso do halter usado e faça as reps de cada lado.'),
  x('pulldown-braco-reto', 'Pulldown com braços estendidos', 'Costas', [3, 10, 15], 2.5,
    ['Em pé de frente para a polia alta, tronco levemente inclinado, braços quase estendidos.',
     'Leve a barra em arco até as coxas usando só os ombros.',
     'Volte devagar até as mãos passarem a altura da cabeça.'],
    ['Dobrar os cotovelos e virar um tríceps.', 'Usar o peso do corpo para empurrar.'],
    'Ótimo para sentir o dorsal antes das puxadas.'),

  // ---------- Ombros ----------
  x('desenvolvimento-halteres', 'Desenvolvimento com halteres', 'Ombros', [3, 8, 12], 4,
    ['Sentado com encosto quase vertical, halteres na altura das orelhas, cotovelos sob os punhos.',
     'Empurre para cima até quase estender os braços, sem bater os halteres.',
     'Desça controlando até os cotovelos ficarem pouco abaixo da linha dos ombros.'],
    ['Arquear demais a lombar.', 'Descer pouco para usar mais carga.'],
    'Cotovelos levemente à frente do corpo protegem o ombro.'),
  x('elevacao-lateral', 'Elevação lateral', 'Ombros', [3, 10, 15], 2,
    ['Em pé, halteres ao lado do corpo, tronco levemente inclinado à frente.',
     'Eleve os braços para os lados até a altura dos ombros, cotovelos levemente flexionados.',
     'Desça devagar, sem deixar os halteres encostarem no corpo.'],
    ['Encolher os ombros e usar o trapézio.', 'Dar impulso com o tronco.'],
    'Pense em afastar os halteres para longe, não em levantá-los.'),
  x('crucifixo-inverso', 'Crucifixo inverso', 'Ombros', [3, 10, 15], 2,
    ['Na máquina ou inclinado com halteres, peito apoiado e braços à frente.',
     'Abra os braços para os lados até a linha dos ombros.',
     'Volte devagar sem deixar a carga encostar.'],
    ['Juntar demais as escápulas e tirar o trabalho do ombro posterior.', 'Usar carga que exige impulso.'],
    'Cargas leves e controle total: é um músculo pequeno.'),
  x('face-pull', 'Face pull', 'Ombros', [3, 12, 15], 2.5,
    ['Polia na altura do rosto, corda com pegada neutra, um passo para trás.',
     'Puxe a corda em direção ao rosto abrindo as mãos, cotovelos altos.',
     'Finalize girando os punhos para trás e volte controlando.'],
    ['Puxar para o peito, virando remada.', 'Inclinar o corpo para trás.'],
    'Excelente para a saúde dos ombros: priorize a execução.'),

  // ---------- Bíceps ----------
  x('rosca-direta', 'Rosca direta com barra', 'Bíceps', [3, 8, 12], 2.5,
    ['Em pé, pegada supinada na largura dos ombros, cotovelos ao lado do tronco.',
     'Flexione os cotovelos levando a barra até a altura dos ombros.',
     'Desça devagar até estender quase totalmente.'],
    ['Balançar o tronco.', 'Levar os cotovelos para a frente.'],
    'Encoste as costas na parede para tirar o impulso.'),
  x('rosca-alternada', 'Rosca alternada com halteres', 'Bíceps', [3, 8, 12], 4,
    ['Em pé ou sentado, halteres ao lado do corpo com as palmas voltadas para dentro.',
     'Suba um halter girando a palma para cima durante o movimento.',
     'Desça controlando e só então comece o outro lado.'],
    ['Subir os dois com pressa e perder o controle.', 'Deixar o cotovelo ir para trás.'],
    'Anote os dois halteres somados (ex.: 12 kg em cada mão = 24 kg).'),
  x('rosca-martelo', 'Rosca martelo', 'Bíceps', [3, 8, 12], 4,
    ['Halteres com pegada neutra (palmas voltadas para o corpo).',
     'Flexione os cotovelos mantendo a pegada neutra até o halter chegar perto do ombro.',
     'Desça devagar com os cotovelos parados.'],
    ['Usar impulso do tronco.', 'Abrir os cotovelos.'],
    'Trabalha braquial e antebraço: dá "largura" ao braço.'),
  x('rosca-scott', 'Rosca Scott', 'Bíceps', [3, 8, 12], 2.5,
    ['Axilas encaixadas no topo do apoio, braços totalmente apoiados.',
     'Flexione até a barra chegar perto dos ombros, sem tirar os braços do apoio.',
     'Desça devagar até quase estender os cotovelos.'],
    ['Tirar os cotovelos do apoio.', 'Soltar a carga no final da descida.'],
    'A parte de baixo é a mais difícil: controle ali.'),

  // ---------- Tríceps ----------
  x('triceps-corda', 'Tríceps na polia com corda', 'Tríceps', [3, 10, 15], 2.5,
    ['Polia alta, cotovelos colados ao tronco e tronco levemente inclinado.',
     'Estenda os cotovelos e abra a corda no final.',
     'Volte até os antebraços passarem um pouco da horizontal, sem mexer os cotovelos.'],
    ['Deixar os cotovelos abrirem ou subirem.', 'Usar o peso do corpo sobre a corda.'],
    'Segure 1 segundo com os braços estendidos.'),
  x('triceps-testa', 'Tríceps testa', 'Tríceps', [3, 8, 12], 2.5,
    ['Deitado, barra W acima do peito, braços levemente inclinados para trás.',
     'Flexione os cotovelos levando a barra em direção à testa ou atrás da cabeça.',
     'Estenda sem abrir os cotovelos.'],
    ['Abrir os cotovelos.', 'Mover os ombros e virar um pullover.'],
    'Descer atrás da cabeça alonga mais a cabeça longa.'),
  x('triceps-frances', 'Tríceps francês', 'Tríceps', [3, 10, 15], 2,
    ['Sentado, halter seguro com as duas mãos acima da cabeça.',
     'Desça o halter atrás da cabeça flexionando os cotovelos, braços próximos das orelhas.',
     'Estenda até quase travar.'],
    ['Abrir muito os cotovelos.', 'Arquear a lombar.'],
    'Também funciona muito bem na polia baixa com corda.'),
  x('mergulho', 'Mergulho nas paralelas', 'Tríceps', [3, 6, 12], 2.5,
    ['Suba nas paralelas com os braços estendidos e os ombros para baixo.',
     'Desça flexionando os cotovelos até os ombros ficarem na altura deles.',
     'Empurre até estender. Tronco mais ereto foca o tríceps; inclinado foca o peito.'],
    ['Descer demais sem mobilidade de ombro.', 'Encolher os ombros.'],
    'Sem peso extra, anote 0. Com cinto de carga, anote só o peso extra.', { bw: true }),

  // ---------- Quadríceps ----------
  x('agachamento-livre', 'Agachamento livre', 'Quadríceps', [3, 5, 10], 5,
    ['Barra apoiada no trapézio, pés na largura dos ombros, pontas levemente para fora.',
     'Respire fundo, trave o abdômen e desça empurrando os joelhos na direção dos pés.',
     'Desça pelo menos até as coxas ficarem paralelas ao chão e suba empurrando o chão.'],
    ['Joelhos caindo para dentro.', 'Calcanhares saindo do chão ou lombar arredondando no fundo.'],
    'Filme de lado de vez em quando para conferir a profundidade.'),
  x('leg-press', 'Leg press 45°', 'Quadríceps', [3, 8, 12], 10,
    ['Costas e quadril bem apoiados, pés na largura dos ombros no meio da plataforma.',
     'Desça até os joelhos chegarem perto do peito, sem tirar o quadril do banco.',
     'Empurre sem travar com força os joelhos no final.'],
    ['Descer pouco com carga excessiva.', 'Deixar o quadril descolar e arredondar a lombar.'],
    'Pés mais baixos na plataforma dão mais ênfase ao quadríceps.'),
  x('cadeira-extensora', 'Cadeira extensora', 'Quadríceps', [3, 10, 15], 5,
    ['Joelho alinhado ao eixo da máquina, apoio logo acima do tornozelo.',
     'Estenda os joelhos até o fim e segure 1 segundo.',
     'Desça devagar, sem deixar a carga bater.'],
    ['Tirar o quadril do banco.', 'Usar impulso no início.'],
    'Segure nas alças para manter o quadril fixo.'),
  x('agachamento-bulgaro', 'Agachamento búlgaro', 'Quadríceps', [3, 8, 12], 4,
    ['Peito do pé de trás apoiado no banco, pé da frente um passo largo adiante.',
     'Desça verticalmente até a coxa da frente ficar paralela ao chão.',
     'Suba empurrando o chão com o pé da frente.'],
    ['Pé da frente perto demais do banco.', 'Joelho caindo para dentro.'],
    'Anote os dois halteres somados e as reps de cada perna.'),
  x('hack', 'Agachamento hack', 'Quadríceps', [3, 8, 12], 10,
    ['Costas apoiadas, pés na largura dos ombros no meio ou na parte baixa da plataforma.',
     'Desça controlando o mais fundo que conseguir mantendo os calcanhares apoiados.',
     'Empurre até quase estender os joelhos.'],
    ['Meia amplitude.', 'Joelhos colapsando para dentro.'],
    'Uma pausa de 1 segundo no fundo deixa cargas menores muito mais eficientes.'),

  // ---------- Posteriores ----------
  x('stiff', 'Stiff', 'Posteriores', [3, 8, 12], 5,
    ['Em pé, barra junto às coxas, joelhos levemente flexionados e fixos.',
     'Empurre o quadril para trás descendo a barra rente às pernas, coluna neutra.',
     'Desça até sentir os posteriores alongarem e suba contraindo os glúteos.'],
    ['Arredondar a lombar.', 'Dobrar os joelhos e virar um agachamento.'],
    'A barra deve "raspar" as pernas o tempo todo.'),
  x('mesa-flexora', 'Mesa flexora', 'Posteriores', [3, 10, 15], 5,
    ['Deitado, joelhos alinhados ao eixo da máquina e apoio acima do calcanhar.',
     'Flexione os joelhos levando o apoio em direção aos glúteos.',
     'Desça devagar até quase estender.'],
    ['Levantar o quadril do banco.', 'Soltar a carga na descida.'],
    'Aponte os pés para a canela para envolver menos a panturrilha.'),
  x('cadeira-flexora', 'Cadeira flexora', 'Posteriores', [3, 10, 15], 5,
    ['Sentado, joelhos alinhados ao eixo e trava firme sobre as coxas.',
     'Flexione os joelhos até o fim do movimento.',
     'Volte devagar até quase estender.'],
    ['Usar impulso.', 'Tirar as costas do encosto.'],
    'Inclinar levemente o tronco à frente aumenta o alongamento.'),
  x('levantamento-terra', 'Levantamento terra', 'Posteriores', [3, 3, 6], 5,
    ['Pés na largura do quadril, barra sobre o meio do pé, canelas próximas da barra.',
     'Coluna neutra, peito alto, trave o abdômen e "tire a folga" da barra antes de puxar.',
     'Empurre o chão e estenda quadril e joelhos juntos; desça com a barra rente ao corpo.'],
    ['Arredondar a lombar.', 'Deixar o quadril subir antes do peito.'],
    'Cada repetição começa do chão, parada. Qualidade antes de carga.'),

  // ---------- Glúteos ----------
  x('elevacao-pelvica', 'Elevação pélvica (hip thrust)', 'Glúteos', [3, 8, 12], 5,
    ['Escápulas apoiadas no banco, barra sobre o quadril com proteção, pés na largura do quadril.',
     'Suba o quadril até o tronco ficar paralelo ao chão, queixo levemente para baixo.',
     'Segure 1 segundo contraindo os glúteos e desça controlando.'],
    ['Hiperestender a lombar no topo.', 'Pés longe ou perto demais (canela deve ficar vertical no topo).'],
    'Olhe para a frente, não para o teto, para manter as costelas baixas.'),
  x('cadeira-abdutora', 'Cadeira abdutora', 'Glúteos', [3, 12, 20], 5,
    ['Sentado com as costas apoiadas, apoios na lateral dos joelhos.',
     'Abra as pernas até o limite confortável.',
     'Volte devagar, sem deixar a carga bater.'],
    ['Usar impulso.', 'Amplitude curta com carga alta.'],
    'Inclinar o tronco à frente muda a ênfase para o glúteo máximo.'),
  x('gluteo-polia', 'Coice na polia', 'Glúteos', [3, 10, 15], 2.5,
    ['Tornozeleira presa na polia baixa, tronco inclinado e mãos apoiadas.',
     'Leve a perna para trás e para cima sem arquear a lombar.',
     'Volte devagar até o joelho passar à frente do quadril.'],
    ['Arquear a lombar para ganhar amplitude.', 'Girar o quadril.'],
    'Registre as reps de cada perna.'),

  // ---------- Panturrilhas ----------
  x('panturrilha-em-pe', 'Panturrilha em pé', 'Panturrilhas', [3, 10, 15], 5,
    ['Pontas dos pés no apoio, joelhos estendidos.',
     'Desça os calcanhares até alongar bem e segure 1 segundo.',
     'Suba o máximo possível e segure 1 segundo no topo.'],
    ['Fazer repetições curtas e quicadas.', 'Dobrar os joelhos para ajudar.'],
    'A pausa no alongamento é o que mais faz diferença.'),
  x('panturrilha-sentado', 'Panturrilha sentado', 'Panturrilhas', [3, 12, 20], 5,
    ['Sentado, apoio sobre os joelhos e pontas dos pés na plataforma.',
     'Desça os calcanhares até o alongamento máximo.',
     'Suba até a contração máxima, com pausa.'],
    ['Quicar no fundo.', 'Amplitude curta.'],
    'Com o joelho dobrado o foco vai para o sóleo.'),

  // ---------- Abdômen ----------
  x('abdominal-polia', 'Abdominal na polia', 'Abdômen', [3, 10, 15], 2.5,
    ['Ajoelhado de frente para a polia alta, corda ao lado da cabeça.',
     'Enrole a coluna levando os cotovelos em direção às coxas.',
     'Volte devagar até a coluna estender, sem sentar nos calcanhares.'],
    ['Puxar com os braços.', 'Dobrar o quadril em vez de enrolar a coluna.'],
    'O quadril fica parado: só a coluna se move.'),
  x('prancha', 'Prancha (segundos)', 'Abdômen', [3, 30, 60], 0,
    ['Antebraços no chão, cotovelos sob os ombros, corpo em linha reta.',
     'Contraia abdômen e glúteos e "puxe" os cotovelos em direção aos pés.',
     'Respire normalmente e mantenha a posição pelo tempo da meta.'],
    ['Deixar o quadril cair.', 'Subir demais o quadril.'],
    'Registre os segundos no lugar das repetições.', { bw: true }),
  x('elevacao-pernas', 'Elevação de pernas', 'Abdômen', [3, 8, 15], 0,
    ['Pendurado na barra ou apoiado na cadeira romana, lombar apoiada se houver encosto.',
     'Eleve as pernas enrolando o quadril para cima, não só dobrando o quadril.',
     'Desça devagar, sem balançar.'],
    ['Usar balanço.', 'Subir só as pernas sem enrolar a pelve.'],
    'Joelhos dobrados deixam mais fácil; pernas estendidas, mais difícil.', { bw: true }),
];

export const LIB_BY_ID = Object.fromEntries(LIB.map(e => [e.id, e]));

// ---------- Como anotar a carga ----------
// A carga anotada é sempre a CARGA TOTAL levantada. Cada exercício diz como somar.
const LOAD_OF = {
  bar: ['supino-reto', 'remada-curvada', 'rosca-direta', 'rosca-scott', 'triceps-testa', 'agachamento-livre', 'stiff', 'levantamento-terra', 'elevacao-pelvica'],
  db2: ['supino-inclinado-halteres', 'supino-reto-halteres', 'desenvolvimento-halteres', 'elevacao-lateral', 'rosca-alternada', 'rosca-martelo', 'agachamento-bulgaro'],
  db1: ['remada-unilateral', 'triceps-frances'],
  cable: ['puxada-frente', 'remada-baixa', 'pulldown-braco-reto', 'face-pull', 'triceps-corda', 'gluteo-polia', 'abdominal-polia'],
  cable2: ['crossover'],
  machine: ['peck-deck', 'cadeira-extensora', 'mesa-flexora', 'cadeira-flexora', 'cadeira-abdutora', 'panturrilha-em-pe', 'panturrilha-sentado'],
  plate: ['leg-press', 'hack'],
  mixed: ['crucifixo-inverso'],
  bw: ['flexao', 'barra-fixa', 'mergulho', 'prancha', 'elevacao-pernas'],
};
export const LOAD_TYPE = Object.fromEntries(Object.entries(LOAD_OF).flatMap(([k, ids]) => ids.map(id => [id, k])));

/** Passos de aumento antigos (antes da carga total), para atualizar quem já tinha o exercício. */
export const OLD_STEP = {
  'supino-inclinado-halteres': 2, 'supino-reto-halteres': 2, 'desenvolvimento-halteres': 2, 'elevacao-lateral': 1,
  'crucifixo-inverso': 1, 'rosca-alternada': 1, 'rosca-martelo': 1, 'agachamento-bulgaro': 2,
};


// ---------- Textos no idioma escolhido ----------

/** Nome do grupamento no idioma atual (o código guarda sempre em português). */
export const tg = g => t(g);

/** Nome do exercício no idioma atual. Se a pessoa renomeou, vale o nome dela. */
export function exName(ex) {
  if (!ex) return '';
  const l = ex.lib && LIB_BY_ID[ex.lib];
  if (l && ex.name === l.name) return exPack(ex.lib)?.name ?? ex.name;
  return ex.name;
}

/** Tipo de carga: barra, halteres, polia, aparelho, peso corporal... (null em exercício próprio). */
export const loadType = ex => (ex?.lib && LOAD_TYPE[ex.lib]) || (ex?.bw ? 'bw' : null);

/** Como somar a carga total deste exercício, com exemplo. */
export function loadHint(ex) {
  const k = loadType(ex);
  const H = {
    bar: t('Carga total = barra + anilhas dos dois lados. Ex.: barra de 20 kg com 30 kg de cada lado = 80 kg. Barras W e barras curtas costumam pesar 10 kg.'),
    db2: t('Carga total = os dois halteres somados. Ex.: 20 kg em cada mão = 40 kg.'),
    db1: t('Um halter só: anote o peso dele. Ex.: halter de 20 kg = 20 kg.'),
    cable: t('Anote o número marcado na pilha de placas da polia.'),
    cable2: t('Some as duas polias. Ex.: 15 kg de cada lado = 30 kg.'),
    machine: t('Anote o valor marcado no aparelho. Se ele usa anilhas, some as anilhas dos dois lados.'),
    plate: t('Some as anilhas dos dois lados, sem contar o peso do aparelho. Ex.: 2 anilhas de 20 kg de cada lado = 80 kg.'),
    mixed: t('Na máquina: o valor marcado no aparelho. Com halteres: os dois somados (ex.: 5 kg em cada mão = 10 kg).'),
    bw: t('Sem peso extra, deixe 0. Com cinto ou colete de carga, anote só o peso extra.'),
  };
  return H[k] ?? t('Anote sempre a carga total levantada: barra + anilhas dos dois lados, os dois halteres somados ou o valor do aparelho.');
}

/** Versão curta, para listas. */
export function loadShort(ex) {
  const S = {
    bar: t('barra + anilhas'), db2: t('2 halteres somados'), db1: t('1 halter'), cable: t('número da polia'),
    cable2: t('2 polias somadas'), machine: t('valor do aparelho'), plate: t('anilhas, sem o aparelho'),
    mixed: t('aparelho ou 2 halteres'), bw: t('só o peso extra'),
  };
  return S[loadType(ex)] ?? t('carga total');
}

/** Rótulo do campo de carga. */
export const loadLabel = ex => (ex?.bw ? t('Carga extra (kg)') : t('Carga total (kg)'));

/** Execução ideal do exercício no idioma atual (biblioteca) ou a gerada para exercício próprio. */
export function exCues(ex) {
  if (!ex) return null;
  const l = ex.lib && LIB_BY_ID[ex.lib];
  if (l) return exPack(ex.lib) ?? l;
  return ex.cues ?? null;
}

export const TEMPLATES = [
  {
    id: 'abc', name: 'ABC', desc: '3 treinos: peito e tríceps, costas e bíceps, pernas e ombros.',
    routines: [
      ['Treino A · Peito e tríceps', ['supino-reto', 'supino-inclinado-halteres', 'peck-deck', 'triceps-corda', 'triceps-testa', 'abdominal-polia']],
      ['Treino B · Costas e bíceps', ['puxada-frente', 'remada-curvada', 'remada-baixa', 'face-pull', 'rosca-direta', 'rosca-martelo']],
      ['Treino C · Pernas e ombros', ['agachamento-livre', 'leg-press', 'stiff', 'mesa-flexora', 'desenvolvimento-halteres', 'elevacao-lateral', 'panturrilha-em-pe']],
    ],
  },
  {
    id: 'ppl', name: 'Push / Pull / Legs', desc: '3 treinos: empurrar, puxar e pernas.',
    routines: [
      ['Push · Empurrar', ['supino-reto', 'desenvolvimento-halteres', 'supino-inclinado-halteres', 'elevacao-lateral', 'triceps-corda', 'triceps-frances']],
      ['Pull · Puxar', ['barra-fixa', 'remada-curvada', 'puxada-frente', 'face-pull', 'rosca-direta', 'rosca-martelo']],
      ['Legs · Pernas', ['agachamento-livre', 'stiff', 'leg-press', 'mesa-flexora', 'elevacao-pelvica', 'panturrilha-em-pe']],
    ],
  },
  {
    id: 'ul', name: 'Superior / Inferior', desc: '2 treinos alternados, ideal para 4 dias por semana.',
    routines: [
      ['Superior', ['supino-reto', 'remada-curvada', 'desenvolvimento-halteres', 'puxada-frente', 'elevacao-lateral', 'rosca-direta', 'triceps-corda']],
      ['Inferior', ['agachamento-livre', 'stiff', 'leg-press', 'mesa-flexora', 'elevacao-pelvica', 'panturrilha-em-pe', 'abdominal-polia']],
    ],
  },
  {
    id: 'full', name: 'Corpo inteiro', desc: '1 treino completo para repetir 2 a 3 vezes por semana.',
    routines: [
      ['Corpo inteiro', ['agachamento-livre', 'supino-reto', 'remada-baixa', 'stiff', 'desenvolvimento-halteres', 'rosca-direta', 'triceps-corda']],
    ],
  },
];
