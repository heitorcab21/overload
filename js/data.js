// Biblioteca de exercícios (com execução ideal) e modelos de rotina.
// Os textos aqui estão em português; as traduções ficam em js/locales/.
import { t, exPack, allLangs } from './i18n.js';
import { state } from './store.js';

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
  // ---------- Novos (v17) ----------
  x("supino-inclinado-barra", "Supino inclinado com barra", "Peito", [3, 6, 10], 2.5,
    ["Banco entre 30° e 45°, olhos embaixo da barra, escápulas juntas e para baixo.", "Desça a barra até a parte de cima do peito, cotovelos a cerca de 45–60° do tronco.", "Empurre até estender os braços, sem tirar o quadril do banco."],
    ["Banco inclinado demais, virando um exercício de ombro.", "Descer a barra no meio do peito, como no supino reto."],
    "Barra na parte de cima do peito e punhos alinhados com os cotovelos."),
  x("supino-declinado", "Supino declinado com barra", "Peito", [3, 6, 10], 2.5,
    ["Prenda as pernas no apoio do banco declinado e deite com os olhos embaixo da barra.", "Desça a barra controlando até a parte de baixo do peito.", "Empurre até estender os braços, mantendo as escápulas firmes."],
    ["Soltar a barra sem alguém ajudando a tirar e devolver no suporte.", "Quicar a barra no peito."],
    "Peça ajuda para tirar a barra do suporte: na posição declinada é mais difícil."),
  x("supino-maquina", "Supino na máquina", "Peito", [3, 8, 12], 5,
    ["Ajuste o banco para que as pegadas fiquem na altura do meio do peito.", "Empurre até quase estender os braços, sem travar os cotovelos.", "Volte devagar até sentir o peito alongar, sem deixar as placas baterem."],
    ["Banco muito baixo ou alto, jogando o esforço para o ombro.", "Tirar as costas do encosto para empurrar."],
    "Bom para ir até perto da falha com segurança, sem precisar de ajudante."),
  x("crucifixo-halteres", "Crucifixo com halteres", "Peito", [3, 10, 15], 2,
    ["Deite no banco com os halteres acima do peito, palmas uma de frente para a outra e cotovelos levemente dobrados.", "Abra os braços em arco até sentir o peito alongar, sem mudar o ângulo dos cotovelos.", "Volte pelo mesmo arco, como se abraçasse uma árvore."],
    ["Descer demais e forçar o ombro.", "Dobrar e esticar os cotovelos, virando um supino."],
    "Use carga menor que no supino: o foco é o alongamento do peito."),
  x("puxada-supinada", "Puxada supinada", "Costas", [3, 8, 12], 5,
    ["Pegue a barra com as palmas para você, na largura dos ombros, e trave as coxas no apoio.", "Puxe a barra até a parte de cima do peito, levando os cotovelos para baixo e para trás.", "Volte controlando até estender os braços."],
    ["Jogar o tronco muito para trás.", "Puxar só com os braços, sem descer as escápulas."],
    "Trabalha mais o bíceps e a parte de baixo das costas do que a puxada aberta."),
  x("puxada-triangulo", "Puxada com triângulo", "Costas", [3, 8, 12], 5,
    ["Prenda o triângulo na polia alta e sente com as coxas travadas.", "Puxe o triângulo até o peito, inclinando o tronco só um pouco para trás.", "Volte devagar até estender os braços e sentir as costas alongarem."],
    ["Usar impulso do tronco.", "Encolher os ombros em direção às orelhas."],
    "Pense em levar os cotovelos até os bolsos."),
  x("remada-cavalinho", "Remada cavalinho", "Costas", [3, 8, 12], 5,
    ["Pés firmes, joelhos levemente dobrados e tronco inclinado a cerca de 45°, coluna neutra.", "Puxe a pegada em direção ao abdômen, levando os cotovelos para trás.", "Desça controlando até estender os braços, sem arredondar as costas."],
    ["Arredondar a lombar.", "Levantar o tronco a cada repetição para roubar."],
    "Anote só as anilhas colocadas, sem a barra."),
  x("remada-maquina", "Remada na máquina", "Costas", [3, 8, 12], 5,
    ["Ajuste o banco para que as pegadas fiquem na altura do meio do peito, peito apoiado.", "Puxe levando os cotovelos para trás e juntando as escápulas.", "Volte devagar até estender os braços."],
    ["Tirar o peito do apoio para puxar.", "Encolher os ombros."],
    "Segure 1 segundo com as escápulas juntas no fim de cada puxada."),
  x("encolhimento", "Encolhimento com halteres", "Costas", [3, 10, 15], 4,
    ["Em pé, um halter em cada mão ao lado do corpo, braços estendidos.", "Suba os ombros em direção às orelhas, sem dobrar os cotovelos.", "Segure 1 segundo e desça devagar."],
    ["Girar os ombros em círculo.", "Usar os braços ou as pernas para subir."],
    "Movimento curto e reto: sobe e desce."),
  x("hiperextensao", "Hiperextensão lombar", "Costas", [3, 10, 15], 2.5,
    ["Ajuste o apoio na altura do quadril e cruze os braços no peito.", "Desça o tronco dobrando no quadril, com a coluna neutra.", "Suba até o corpo ficar em linha reta, sem passar disso."],
    ["Subir além da linha do corpo, arqueando a lombar.", "Descer rápido demais."],
    "Sem peso, deixe 0. Segurando uma anilha, anote só o peso dela.", { bw: true }),
  x("desenvolvimento-barra", "Desenvolvimento com barra", "Ombros", [3, 6, 10], 2.5,
    ["Em pé, barra apoiada na frente dos ombros, pegada um pouco mais aberta que os ombros.", "Contraia abdômen e glúteos e empurre a barra para cima, passando a cabeça para frente quando ela passar do rosto.", "Desça controlando até a frente dos ombros."],
    ["Arquear muito a lombar.", "Empurrar a barra para frente em vez de reto para cima."],
    "Glúteos contraídos protegem a lombar."),
  x("desenvolvimento-maquina", "Desenvolvimento na máquina", "Ombros", [3, 8, 12], 5,
    ["Ajuste o banco para que as pegadas fiquem na altura dos ombros.", "Empurre para cima até quase estender os braços.", "Desça devagar até a altura dos ombros."],
    ["Banco baixo demais, descendo além da amplitude confortável.", "Tirar as costas do encosto."],
    "Bom para quem está começando ou para ir perto da falha com segurança."),
  x("elevacao-frontal", "Elevação frontal", "Ombros", [3, 10, 15], 2,
    ["Em pé, halteres na frente das coxas, cotovelos levemente dobrados.", "Eleve os braços à frente até a altura dos ombros.", "Desça devagar, sem balançar o corpo."],
    ["Subir acima da cabeça.", "Usar impulso do tronco."],
    "Pode alternar os braços ou subir os dois juntos."),
  x("remada-alta", "Remada alta", "Ombros", [3, 10, 15], 2.5,
    ["Em pé, barra na frente das coxas, pegada na largura dos ombros ou um pouco mais aberta.", "Puxe a barra rente ao corpo, levando os cotovelos para cima e para os lados.", "Pare com os cotovelos na altura dos ombros e desça devagar."],
    ["Pegada muito fechada, que aperta o ombro.", "Subir os cotovelos acima dos ombros."],
    "Se sentir o ombro pinçar, abra mais a pegada ou troque por elevação lateral."),
  x("elevacao-lateral-polia", "Elevação lateral na polia", "Ombros", [3, 12, 15], 2.5,
    ["Polia baixa, pegue o puxador com a mão do lado oposto, de lado para o aparelho.", "Eleve o braço para o lado até a altura do ombro, cotovelo levemente dobrado.", "Desça devagar, sem deixar a placa encostar."],
    ["Inclinar o tronco para longe para roubar.", "Subir acima do ombro."],
    "A polia mantém tensão no começo do movimento, onde o halter quase não pesa."),
  x("rosca-concentrada", "Rosca concentrada", "Bíceps", [3, 10, 12], 1,
    ["Sentado, apoie a parte de trás do braço na parte de dentro da coxa.", "Suba o halter até perto do ombro, sem mexer o braço.", "Desça devagar até quase estender."],
    ["Tirar o braço da coxa.", "Girar o tronco para ajudar."],
    "Anote o peso de um halter e faça os dois braços."),
  x("rosca-polia", "Rosca na polia", "Bíceps", [3, 10, 15], 2.5,
    ["Polia baixa com barra reta ou W, em pé de frente para o aparelho.", "Suba a barra dobrando os cotovelos, sem tirá-los do lado do corpo.", "Desça devagar até estender."],
    ["Levar os cotovelos para frente.", "Balançar o tronco."],
    "A polia mantém tensão no bíceps o movimento inteiro."),
  x("rosca-inclinada", "Rosca no banco inclinado", "Bíceps", [3, 8, 12], 2,
    ["Banco a cerca de 45°, costas apoiadas e braços pendurados ao lado do corpo.", "Suba os halteres sem levar os cotovelos para frente.", "Desça devagar até estender totalmente."],
    ["Tirar as costas do banco.", "Encurtar a descida."],
    "O braço atrás do corpo alonga o bíceps: use carga menor que na rosca em pé."),
  x("triceps-barra", "Tríceps na polia com barra", "Tríceps", [3, 10, 15], 2.5,
    ["Polia alta com barra reta ou V, cotovelos colados ao lado do corpo.", "Empurre a barra para baixo até estender os braços.", "Volte devagar até os antebraços passarem da horizontal, sem mexer os cotovelos."],
    ["Abrir os cotovelos ou levá-los para frente.", "Jogar o peso do corpo em cima da barra."],
    "Só o antebraço se mexe: o cotovelo é a dobradiça."),
  x("triceps-coice", "Tríceps coice", "Tríceps", [3, 10, 15], 1,
    ["Apoie um joelho e uma mão no banco, tronco paralelo ao chão.", "Com o braço colado ao corpo, estenda o cotovelo levando o halter para trás.", "Volte devagar até 90°, sem mexer o braço."],
    ["Balançar o braço inteiro.", "Usar carga pesada demais e encurtar o movimento."],
    "Segure 1 segundo com o braço estendido. Anote o peso de um halter."),
  x("supino-fechado", "Supino fechado", "Tríceps", [3, 6, 10], 2.5,
    ["Deite no banco e pegue a barra na largura dos ombros.", "Desça a barra até a parte de baixo do peito, cotovelos perto do corpo.", "Empurre até estender os braços."],
    ["Pegada fechada demais, que força os punhos.", "Abrir os cotovelos."],
    "Pegada na largura dos ombros já é suficiente para focar no tríceps."),
  x("triceps-banco", "Tríceps no banco", "Tríceps", [3, 8, 15], 2.5,
    ["Mãos na beira do banco atrás de você, pernas à frente.", "Desça dobrando os cotovelos até cerca de 90°, costas perto do banco.", "Empurre até estender os braços."],
    ["Descer demais e forçar o ombro.", "Abrir os cotovelos para os lados."],
    "Joelhos dobrados deixam mais fácil. Com anilha no colo, anote só o peso dela.", { bw: true }),
  x("afundo", "Afundo com halteres", "Quadríceps", [3, 8, 12], 2,
    ["Em pé, um halter em cada mão, dê um passo largo à frente.", "Desça até o joelho de trás quase tocar o chão, tronco reto.", "Empurre com a perna da frente para voltar e troque de lado."],
    ["Passo curto demais, com o joelho da frente muito à frente.", "Inclinar o tronco para frente."],
    "Conte as reps de cada perna. Também vale andando (passada)."),
  x("agachamento-smith", "Agachamento no Smith", "Quadríceps", [3, 8, 12], 5,
    ["Barra apoiada no trapézio, pés um pouco à frente da linha da barra, na largura dos ombros.", "Desça até as coxas ficarem pelo menos paralelas ao chão, joelhos na direção dos pés.", "Suba empurrando o chão, sem tirar os calcanhares."],
    ["Pés embaixo da barra, jogando os joelhos muito à frente.", "Esquecer de travar a barra no fim."],
    "Anote sempre do mesmo jeito: só as anilhas, ou anilhas + a barra do Smith."),
  x("agachamento-goblet", "Agachamento goblet", "Quadríceps", [3, 8, 15], 2,
    ["Segure um halter na vertical junto ao peito, pés um pouco mais abertos que os ombros.", "Desça entre as pernas mantendo o peito alto e os cotovelos por dentro dos joelhos.", "Suba empurrando o chão."],
    ["Deixar o tronco cair para frente.", "Joelhos entrando para dentro."],
    "Ótimo para aprender o agachamento antes da barra."),
  x("agachamento-sumo", "Agachamento sumô", "Glúteos", [3, 10, 15], 2,
    ["Pés bem afastados, pontas viradas para fora, halter segurado com as duas mãos entre as pernas.", "Desça mantendo o tronco reto e os joelhos abrindo na direção dos pés.", "Suba contraindo os glúteos."],
    ["Joelhos entrando para dentro.", "Arredondar as costas."],
    "A base aberta trabalha mais glúteos e parte interna da coxa."),
  x("terra-sumo", "Levantamento terra sumô", "Posteriores", [3, 3, 6], 5,
    ["Pés bem afastados, pontas para fora, mãos pegando a barra por dentro das pernas.", "Peito alto e coluna neutra; empurre o chão abrindo os joelhos.", "Termine em pé com o quadril estendido e desça a barra pelo mesmo caminho."],
    ["Arredondar as costas.", "Quadril subir antes da barra sair do chão."],
    "Barra encostada nas canelas do começo ao fim."),
  x("cadeira-adutora", "Cadeira adutora", "Glúteos", [3, 12, 20], 5,
    ["Sente com as costas apoiadas e as pernas abertas nos apoios.", "Feche as pernas até os apoios quase se encostarem.", "Abra devagar até sentir a parte interna da coxa alongar."],
    ["Deixar as placas baterem.", "Usar impulso."],
    "Trabalha a parte interna da coxa."),
  x("panturrilha-leg-press", "Panturrilha no leg press", "Panturrilhas", [3, 12, 20], 10,
    ["No leg press, apoie só a ponta dos pés na parte de baixo da plataforma, joelhos quase estendidos.", "Empurre com a ponta dos pés até subir o máximo.", "Desça devagar até alongar bem a panturrilha."],
    ["Dobrar os joelhos para ajudar.", "Movimento curto e rápido."],
    "Deixe as travas de segurança soltas só enquanto estiver no movimento."),
  x("abdominal-supra", "Abdominal supra", "Abdômen", [3, 12, 20], 2.5,
    ["Deite com os joelhos dobrados e os pés no chão, mãos atrás da cabeça ou no peito.", "Enrole o tronco tirando as escápulas do chão, levando as costelas em direção ao quadril.", "Desça devagar."],
    ["Puxar a cabeça com as mãos.", "Subir o tronco inteiro, virando um movimento de quadril."],
    "Sem peso, deixe 0. Segurando uma anilha, anote só o peso dela.", { bw: true }),
  x("abdominal-infra", "Abdominal infra", "Abdômen", [3, 10, 20], 0,
    ["Deite de costas com as mãos ao lado do corpo e os joelhos dobrados no alto.", "Enrole o quadril tirando a lombar do chão, levando os joelhos em direção ao peito.", "Desça devagar, sem deixar os pés baterem no chão."],
    ["Balançar as pernas para ganhar impulso.", "Só dobrar o quadril sem enrolar a pelve."],
    "Movimento curto: o que importa é enrolar o quadril.", { bw: true }),
  x("abdominal-obliquo", "Abdominal oblíquo (giro russo)", "Abdômen", [3, 10, 20], 2.5,
    ["Sente com os joelhos dobrados, tronco inclinado para trás e coluna reta.", "Gire o tronco para um lado levando as mãos ao lado do quadril.", "Gire para o outro lado; cada lado conta uma rep."],
    ["Arredondar as costas.", "Mexer só os braços sem girar o tronco."],
    "Pés no chão deixam mais fácil. Segurando peso, anote só o peso extra.", { bw: true }),
];

export const LIB_BY_ID = Object.fromEntries(LIB.map(e => [e.id, e]));

// ---------- Como anotar a carga ----------
// A carga anotada é sempre a CARGA TOTAL levantada. Cada exercício diz como somar.
const LOAD_OF = {
  bar: ['supino-reto', 'remada-curvada', 'rosca-direta', 'rosca-scott', 'triceps-testa', 'agachamento-livre', 'stiff', 'levantamento-terra', 'elevacao-pelvica', 'supino-inclinado-barra', 'supino-declinado', 'desenvolvimento-barra', 'remada-alta', 'supino-fechado', 'terra-sumo'],
  db2: ['supino-inclinado-halteres', 'supino-reto-halteres', 'desenvolvimento-halteres', 'elevacao-lateral', 'rosca-alternada', 'rosca-martelo', 'agachamento-bulgaro', 'crucifixo-halteres', 'encolhimento', 'elevacao-frontal', 'rosca-inclinada', 'afundo'],
  db1: ['remada-unilateral', 'triceps-frances', 'rosca-concentrada', 'triceps-coice', 'agachamento-goblet', 'agachamento-sumo'],
  cable: ['puxada-frente', 'remada-baixa', 'pulldown-braco-reto', 'face-pull', 'triceps-corda', 'gluteo-polia', 'abdominal-polia', 'puxada-supinada', 'puxada-triangulo', 'elevacao-lateral-polia', 'rosca-polia', 'triceps-barra'],
  cable2: ['crossover'],
  machine: ['peck-deck', 'cadeira-extensora', 'mesa-flexora', 'cadeira-flexora', 'cadeira-abdutora', 'panturrilha-em-pe', 'panturrilha-sentado', 'supino-maquina', 'remada-maquina', 'desenvolvimento-maquina', 'agachamento-smith', 'cadeira-adutora'],
  plate: ['leg-press', 'hack', 'remada-cavalinho', 'panturrilha-leg-press'],
  mixed: ['crucifixo-inverso'],
  bw: ['flexao', 'barra-fixa', 'mergulho', 'prancha', 'elevacao-pernas', 'hiperextensao', 'triceps-banco', 'abdominal-supra', 'abdominal-infra', 'abdominal-obliquo'],
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
    id: 'arnold', name: 'Arnold split', desc: '3 treinos (peito e costas, ombros e braços, pernas), repetidos 2 vezes na semana.',
    routines: [
      ['Arnold A · Peito e costas', ['supino-reto', 'supino-inclinado-barra', 'crucifixo-halteres', 'barra-fixa', 'remada-curvada', 'puxada-frente', 'abdominal-supra']],
      ['Arnold B · Ombros e braços', ['desenvolvimento-barra', 'elevacao-lateral', 'crucifixo-inverso', 'rosca-direta', 'rosca-alternada', 'supino-fechado', 'triceps-frances']],
      ['Arnold C · Pernas', ['agachamento-livre', 'leg-press', 'cadeira-extensora', 'stiff', 'mesa-flexora', 'panturrilha-em-pe', 'abdominal-infra']],
    ],
  },
  {
    id: 'abcde', name: 'ABCDE (um grupo por dia)', desc: '5 treinos, um grupamento por dia: peito, costas, ombros, pernas e braços.',
    routines: [
      ['Treino A · Peito', ['supino-reto', 'supino-inclinado-halteres', 'supino-declinado', 'crucifixo-halteres', 'crossover']],
      ['Treino B · Costas', ['barra-fixa', 'remada-curvada', 'puxada-frente', 'remada-baixa', 'pulldown-braco-reto', 'hiperextensao']],
      ['Treino C · Ombros', ['desenvolvimento-halteres', 'elevacao-lateral', 'elevacao-frontal', 'crucifixo-inverso', 'encolhimento']],
      ['Treino D · Pernas', ['agachamento-livre', 'leg-press', 'cadeira-extensora', 'stiff', 'mesa-flexora', 'panturrilha-em-pe']],
      ['Treino E · Braços', ['rosca-direta', 'rosca-martelo', 'rosca-concentrada', 'triceps-barra', 'triceps-testa', 'triceps-coice']],
    ],
  },
  {
    id: 'full', name: 'Corpo inteiro', desc: '1 treino completo para repetir 2 a 3 vezes por semana.',
    routines: [
      ['Corpo inteiro', ['agachamento-livre', 'supino-reto', 'remada-baixa', 'stiff', 'desenvolvimento-halteres', 'rosca-direta', 'triceps-corda']],
    ],
  },
];

// ---------- Nomes das fichas pré-moldadas ----------
// O nome de uma ficha criada a partir de um modelo fica guardado em português (a chave da tradução)
// com tpl: true, e é traduzido na hora de mostrar. Ao renomear, vira um nome próprio (tpl: false).
export const TEMPLATE_NAMES = TEMPLATES.flatMap(tp => tp.routines.map(([name]) => name));

/** Nome de uma rotina, treino em andamento ou treino salvo, no idioma atual. */
export const routineName = r => (r?.tpl ? t(r.name) : r?.name ?? '');

/** Reconhece um nome de modelo escrito em qualquer idioma e devolve a chave em português. */
export function templateKey(name) {
  return TEMPLATE_NAMES.find(k => allLangs(k).includes(name)) ?? null;
}

/** Garante que um exercício da biblioteca exista nos exercícios da pessoa e o devolve. */
export function ensureExercise(libId) {
  if (state.exercises[libId]) return state.exercises[libId];
  const l = LIB_BY_ID[libId];
  if (!l) return null;
  state.exercises[libId] = {
    id: libId, lib: libId, name: l.name, group: l.group,
    sets: l.sets, repMin: l.repMin, repMax: l.repMax, step: l.step, bw: !!l.bw,
  };
  return state.exercises[libId];
}

/** Descanso entre séries deste exercício (segundos): o dele ou o padrão dos Ajustes. */
export const restOf = ex => (ex?.rest > 0 ? ex.rest : state.settings.rest);

// Fotos de execução (free-exercise-db, domínio público): duas posições, início e fim.
export const IMG = {"supino-reto": "Barbell_Bench_Press_-_Medium_Grip", "supino-inclinado-halteres": "Incline_Dumbbell_Press", "supino-reto-halteres": "Dumbbell_Bench_Press", "peck-deck": "Butterfly", "crossover": "Cable_Crossover", "flexao": "Pushups", "puxada-frente": "Wide-Grip_Lat_Pulldown", "barra-fixa": "Pullups", "remada-curvada": "Bent_Over_Barbell_Row", "remada-baixa": "Seated_Cable_Rows", "remada-unilateral": "One-Arm_Dumbbell_Row", "pulldown-braco-reto": "Straight-Arm_Pulldown", "desenvolvimento-halteres": "Dumbbell_Shoulder_Press", "elevacao-lateral": "Side_Lateral_Raise", "crucifixo-inverso": "Reverse_Flyes", "face-pull": "Face_Pull", "rosca-direta": "Barbell_Curl", "rosca-alternada": "Dumbbell_Alternate_Bicep_Curl", "rosca-martelo": "Hammer_Curls", "rosca-scott": "Preacher_Curl", "triceps-corda": "Triceps_Pushdown_-_Rope_Attachment", "triceps-testa": "EZ-Bar_Skullcrusher", "triceps-frances": "Standing_Dumbbell_Triceps_Extension", "mergulho": "Dips_-_Triceps_Version", "agachamento-livre": "Barbell_Squat", "leg-press": "Leg_Press", "cadeira-extensora": "Leg_Extensions", "agachamento-bulgaro": "Split_Squat_with_Dumbbells", "hack": "Hack_Squat", "stiff": "Stiff-Legged_Barbell_Deadlift", "mesa-flexora": "Lying_Leg_Curls", "cadeira-flexora": "Seated_Leg_Curl", "levantamento-terra": "Barbell_Deadlift", "elevacao-pelvica": "Barbell_Hip_Thrust", "cadeira-abdutora": "Thigh_Abductor", "gluteo-polia": "One-Legged_Cable_Kickback", "panturrilha-em-pe": "Standing_Calf_Raises", "panturrilha-sentado": "Seated_Calf_Raise", "abdominal-polia": "Cable_Crunch", "prancha": "Plank", "elevacao-pernas": "Hanging_Leg_Raise", "supino-inclinado-barra": "Barbell_Incline_Bench_Press_-_Medium_Grip", "supino-declinado": "Decline_Barbell_Bench_Press", "supino-maquina": "Machine_Bench_Press", "crucifixo-halteres": "Dumbbell_Flyes", "puxada-supinada": "Underhand_Cable_Pulldowns", "puxada-triangulo": "V-Bar_Pulldown", "remada-cavalinho": "T-Bar_Row_with_Handle", "remada-maquina": "Leverage_Iso_Row", "encolhimento": "Dumbbell_Shrug", "hiperextensao": "Hyperextensions_Back_Extensions", "desenvolvimento-barra": "Standing_Military_Press", "desenvolvimento-maquina": "Machine_Shoulder_Military_Press", "elevacao-frontal": "Front_Dumbbell_Raise", "remada-alta": "Upright_Barbell_Row", "elevacao-lateral-polia": "Cable_Seated_Lateral_Raise", "rosca-concentrada": "Concentration_Curls", "rosca-polia": "Standing_Biceps_Cable_Curl", "rosca-inclinada": "Incline_Dumbbell_Curl", "triceps-barra": "Triceps_Pushdown", "triceps-coice": "Tricep_Dumbbell_Kickback", "supino-fechado": "Close-Grip_Barbell_Bench_Press", "triceps-banco": "Bench_Dips", "afundo": "Dumbbell_Lunges", "agachamento-smith": "Smith_Machine_Squat", "agachamento-goblet": "Goblet_Squat", "agachamento-sumo": "Plie_Dumbbell_Squat", "terra-sumo": "Sumo_Deadlift", "cadeira-adutora": "Thigh_Adductor", "panturrilha-leg-press": "Calf_Press_On_The_Leg_Press_Machine", "abdominal-supra": "Crunches", "abdominal-infra": "Reverse_Crunch", "abdominal-obliquo": "Russian_Twist"};
/** Caminhos das fotos de um exercício da biblioteca, ou [] se não houver. */
export function exPhotos(ex) {
  const imgs = exImages(ex);
  if (!imgs.length) return '';
  const alt = [t('Posição inicial'), t('Posição final')];
  return `<figure class="ex-photos">${imgs.map((src, i) => `<img src="${src}" alt="${alt[i]}" loading="lazy" width="480" height="320">`).join('')}
    <figcaption>${t('Início e fim do movimento')}</figcaption></figure>`;
}
export const exImages = ex => (ex?.lib && IMG[ex.lib] ? [0, 1].map(n => `img/ex/${ex.lib}-${n}.jpg`) : []);
