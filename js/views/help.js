// Ajuda: tutoriais de uso do app.
import { $, esc, icon } from '../ui.js';
import { route } from '../router.js';
import { t, helpPack } from '../i18n.js';

// Cada tópico: [título, resumo de uma linha, conteúdo em HTML]
const TOPICS = [
  ['Primeiros passos', 'Do primeiro acesso ao primeiro treino', `
    <ol class="steps">
      <li><b>Entre com sua conta Google</b> na primeira tela, para salvar tudo no seu Drive. Se preferir, toque em "Usar sem conta".</li>
      <li><b>Escolha um ponto de partida</b>: ABC, Push/Pull/Legs, Superior/Inferior, Arnold split, ABCDE, opções com foco em glúteos e pernas, Corpo inteiro ou do zero. Também dá para <b>importar do bloco de notas</b>.</li>
      <li><b>Seu corpo</b>: sexo, idade, altura e peso (já vêm com valores de exemplo: ajuste no − e no +). Eles destravam o nível de força, a composição corporal e metas certas para você.</li>
      <li><b>Seu objetivo</b>: ganhar massa, ficar mais forte, emagrecer ou saúde, os grupos que quer priorizar e quantos treinos por semana. O app monta as metas de séries e de cardio.</li>
      <li><b>Metas de carga</b>: para cada exercício, escolha Conservador, Moderado ou Difícil (calculados pelas suas cargas e pelo seu nível) ou <b>Seguir minha progressão</b>.</li>
      <li>Na aba <b>Hoje</b>, toque em <b>Começar treino</b>.</li>
    </ol>
    <p class="tip">Tudo pode ser mudado depois. Idioma (português, inglês ou espanhol) e unidades (métrico ou imperial: lb, pés e milhas) ficam em <b>Ajustes</b>.</p>`],

  ['Importar treinos de texto', 'Do bloco de notas ou do WhatsApp', `
    <p>Já anotava seus treinos em texto? Copie e cole tudo de uma vez: o app salva as cargas e já sugere a próxima.</p>
    <ol class="steps">
      <li>No primeiro acesso, toque em <b>Já anoto meus treinos</b>. Depois, use o botão laranja <b>Importar do bloco de notas</b> no topo da aba Treinos.</li>
      <li>Cole o texto e toque em <b>Ler texto</b>. Ele entende "15kg 10 rep", "40x12", "3x10 com 50kg", "50kg 12/10/8", descanso ("1:30 min"), datas ("12/11") e grupamentos ("• Tríceps").</li>
      <li>Confira: o app mostra o que você escreveu e o exercício que reconheceu. Se errou, troque na lista; se não existir, ele cria um exercício novo.</li>
      <li>Toque em <b>Salvar</b>. Cada treino vira uma <b>ficha</b>, e as cargas ficam como o seu treino anterior: ao começar a ficha, você já vê as cargas e ajusta. Se quiser, marque para registrar também como treino feito na data do texto.</li>
      <li>Dois exercícios diferentes caíram no mesmo (ex.: "cross supra" e "cross infra")? Marque <b>Usar com o meu nome</b> para criar um exercício próprio.</li>
    </ol>
    <p class="tip">Texto muito bagunçado? Com o treinador IA ligado, use <b>Organizar com a IA</b>.</p>`],

  ['Registrar um treino', 'Um toque por série', `
    <ol class="steps">
      <li>A tela mostra a <b>meta de hoje</b> de cada série, já calculada pelo app.</li>
      <li>Fez exatamente isso? Toque no botão laranja <b>Feito</b>. O descanso começa a contar sozinho.</li>
      <li>Foi diferente? Ajuste a carga e as repetições no − e no + (ou toque no número e digite) antes de tocar em <b>Feito</b>. O app percebe sozinho se ficou acima ou abaixo da meta.</li>
      <li>Fez todas as séries como planejado? <b>Todas como a meta</b> registra tudo de uma vez.</li>
      <li>Ao terminar o exercício, informe se quiser quantas <b>reps sobraram</b> (RIR) e marque se teve <b>dor</b> ou se <b>trocou de aparelho</b>. Isso muda a sugestão do próximo treino.</li>
      <li>Toque em <b>Próximo</b> e, no último exercício, em <b>Finalizar</b>.</li>
    </ol>
    <p class="tip">Errou um número? Toque na série já registrada para corrigir ou excluir. O ícone de lista no topo mostra todos os exercícios do treino.</p>`],

  ['Trocar, aquecer e RIR', 'Ajustes no meio do treino', `
    <ul class="errs">
      <li><b>Trocar exercício</b>: aparelho ocupado? Toque em <b>Trocar exercício</b>. No topo aparecem 2 ou 3 <b>sugestões equivalentes</b> com a carga já ajustada (a sua, se você já fez o exercício). Marque a caixinha para trocar também na ficha.</li>
      <li><b>Bi-set e tri-set</b>: em Treinos, toque no ícone de corrente ao lado de um exercício para juntá-lo ao próximo. No treino, depois de cada série o app vai direto para o próximo do grupo, sem descanso; no último, descansa e volta ao primeiro.</li>
      <li><b>Anotação</b>: toque em <b>Adicionar anotação</b> abaixo do nome ("banco na altura 4", "pegada fechada"). Ela aparece sempre que você abrir o exercício.</li>
      <li><b>Adicionar exercício</b>: inclui um exercício logo depois do atual, sem mexer na ficha (ou também nela, se marcar).</li>
      <li><b>Salvar meus treinos</b>: em Treinos, guarde suas fichas (criadas do zero ou adaptadas) com um nome. O botão aparece quando seus treinos têm ao menos um exercício diferente de todos os prontos e salvos. Elas ficam em <b>Treinos prontos e salvos &gt; Meus treinos salvos</b> e voltam com um toque. Cabem até 10. Ao escolher um treino pronto ou salvo, o app pergunta se é para <b>adicionar</b> aos seus treinos ou <b>substituir</b>; antes de substituir, salve os atuais se quiser voltar a eles.</li>
      <li><b>Treino livre</b>: na aba Hoje, começa um treino vazio e você adiciona os exercícios conforme treina.</li>
      <li><b>Esqueceu de anotar um dia?</b> Na tela Hoje, toque no dia da semana e registre o treino dele; ele fica salvo naquela data.</li>
      <li><b>Foi aquecimento</b>: registra a série como aquecimento. Ela fica guardada, mas não conta na progressão, nas metas, no volume nem nos recordes. Esqueceu de marcar? Se a 1ª série vier com menos de 70% da carga sugerida, o app já conta como aquecimento sozinho; e séries muito leves nunca entram nas métricas. Toque na série para excluir ou dizer que era válida. E se uma série válida era aquecimento, toque nela e escolha <b>Era aquecimento</b>. O <b>Desfazer</b> sempre desfaz o último registro, seja aquecimento ou série.</li>
      <li><b>RIR (reps que sobraram)</b>: depois de uma série, toque em 0, 1, 2, 3 ou 4+. É opcional. Com 3 ou mais sobrando em todas as séries, o app sugere +2 reps; com 0 na última, repete os números. O RIR também melhora a estimativa de força máxima.</li>
      <li><b>Descanso por exercício</b>: em Treinos, abra o exercício e defina o descanso dele (0 usa o padrão dos Ajustes).</li>
    </ul>`],

  ['Como anotar a carga', 'Sempre a carga total', `
    <p>Anote sempre a <b>carga total levantada</b>, e não só o que está de um lado. Cada exercício mostra a regra dele no treino e na tela do exercício.</p>
    <ul class="errs">
      <li><b>Barra</b> (supino, agachamento, remada, terra): barra + anilhas dos dois lados. Barra de 20 kg com 30 kg de cada lado = <b>80 kg</b>. Barras W e barras curtas costumam pesar 10 kg.</li>
      <li><b>Dois halteres</b> (supino com halteres, desenvolvimento, rosca alternada): some os dois. 20 kg em cada mão = <b>40 kg</b>.</li>
      <li><b>Um halter só</b> (serrote, tríceps francês): o peso desse halter. Halter de 20 kg = <b>20 kg</b>.</li>
      <li><b>Aparelho com pilha de placas</b> (cadeira extensora, mesa flexora, peck deck): o número marcado no aparelho.</li>
      <li><b>Polia</b>: o número da pilha. No crossover, que usa duas polias, some os dois lados: 15 kg de cada lado = <b>30 kg</b>.</li>
      <li><b>Leg press e hack</b>: as anilhas dos dois lados, sem o peso do aparelho. 2 anilhas de 20 kg de cada lado = <b>80 kg</b>.</li>
      <li><b>Peso corporal</b> (barra fixa, mergulho, flexão): deixe 0. Com cinto ou colete de carga, anote só o peso extra.</li>
    </ul>
    <p class="tip">O mais importante é anotar sempre do mesmo jeito: é assim que o app compara um treino com o outro e sugere a próxima carga.</p>`],

  ['Cardio', 'Registro, metas e rotinas com cronômetro', `
    <ol class="steps">
      <li>Na aba <b>Cardio</b>, toque em <b>Registrar cardio</b>: tipo, tempo e, se quiser, distância e intensidade. O app estima as calorias pelo seu peso.</li>
      <li>Fez cardio junto com a musculação? No treino, abra a lista de exercícios e toque em <b>Adicionar cardio</b>.</li>
      <li><b>Meta da semana</b>: toque no lápis e escolha uma de 3 opções (por exemplo 90, 150 ou 300 minutos; a OMS recomenda de 150 a 300) ou defina a sua.</li>
      <li><b>Rotinas com cronômetro</b>: monte blocos contínuos e intervalados ou use um <b>modelo pronto</b> com base científica: Zona 2, Caminhar e correr, Esteira 12-3-30, 4×4 norueguês, HIIT 30/30, Tiros, Sprints de 30 s e Tabata. Cada modelo explica para que serve.</li>
      <li>O <b>cronômetro</b> tem contagem 3-2-1, anel de progresso, linha do tempo das etapas, botão +30 s, bipes e vibração a cada troca e uma <b>voz</b> que anuncia a fase (desligue no ícone de som). Ele mostra também a <b>faixa de batimentos</b> pela sua idade e o teste da fala.</li>
      <li>No fim, dê uma <b>nota de esforço de 1 a 10</b>. Se ficou fácil, o app sugere o próximo avanço: toque em <b>Aplicar</b>.</li>
    </ol>
    <p class="tip">No iPhone, o som e a voz só tocam com o app aberto na tela: o iOS pausa apps da web em segundo plano.</p>`],

  ['Registrar por voz', 'Fale em vez de tocar', `
    <p>Toque no <b>microfone azul</b> embaixo e fale. Exemplos:</p>
    <ul class="errs">
      <li><b>"40 quilos, 12 repetições"</b>: registra uma série.</li>
      <li><b>"três séries de dez com cinquenta"</b>: registra três séries.</li>
      <li><b>"bati a meta"</b> ou <b>"fiz tudo"</b>: usa a meta como está.</li>
      <li><b>"mais uma"</b> ou <b>"menos duas"</b>: a meta com reps a mais ou a menos.</li>
      <li><b>"mais 5 quilos"</b>: ajusta a carga da próxima série.</li>
      <li><b>"foi aquecimento"</b>: a última série (ou a próxima) conta como aquecimento. <b>"aquecimento, 20 quilos, 15"</b>: registra direto como aquecimento. <b>"não foi aquecimento"</b>: volta a ser série válida.</li>
      <li><b>"desfazer"</b>, <b>"pular"</b>, <b>"próximo"</b>.</li>
    </ul>
    <p class="tip">Na primeira vez o navegador pede permissão do microfone. No Android, o reconhecimento de voz precisa de internet. Se a voz não funcionar, digite a mesma frase no campo que aparece embaixo.</p>`],

  ['Como a carga é sugerida', 'A lógica da progressão', `
    <p>O app usa a <b>dupla progressão</b>: cada exercício tem uma faixa de repetições (por exemplo, 8 a 12).</p>
    <p>A faixa segue o seu objetivo, sempre até 12 reps: para massa, entre 6 e 30 reps o músculo cresce parecido perto da falha, então passar de 12 só deixa a carga mais leve. Em <b>força</b>, os compostos ficam em 8 a 10; em massa, 6 a 10 nos com barra e 8 a 12 nos demais; para emagrecer e saúde, 8 a 12 e 10 a 12. Se você mudar a faixa de um exercício à mão, ela fica como você deixou.</p>
    <ol class="steps">
      <li>Com a mesma carga, você ganha <b>1 repetição por vez</b>, começando pela série mais fraca.</li>
      <li>Quando bate o <b>topo da faixa em todas as séries</b>, o app sobe a carga pelo valor de aumento do exercício e volta para o início da faixa.</li>
      <li>Se ficar <b>duas vezes abaixo da faixa</b>, ele sugere reduzir cerca de 10%.</li>
    </ol>
    <ul class="errs">
      <li><b>Meta de 30 dias ativa</b>: se a sugestão ficar abaixo do degrau desta semana, o app puxa em direção a ele, no máximo um aumento de carga por treino e o resto em repetições ("Rumo à meta da semana").</li>
      <li><b>Sobraram 3 ou mais reps</b> em todas as séries: +2 reps. <b>Nenhuma sobrando</b> na última: repete os números.</li>
      <li><b>Dor</b>: repete os mesmos números.</li>
      <li><b>Troquei o aparelho</b>: aquele treino não conta para a próxima carga.</li>
      <li><b>Pausa de 14 dias ou mais</b> no exercício (viagem, doença): o primeiro treino volta com cerca de 10% a menos (20% depois de 4 semanas, 30% depois de 8), e os próximos sobem metade do que falta por vez até a carga de antes. A força volta bem mais rápido do que levou para ser construída.</li>
      <li><b>Pouco tempo ou dia ruim</b>: no treino, toque em <b>Pouco tempo ou dia ruim?</b> no topo (ou na lista do treino). Pouco tempo deixa 2 séries em cada exercício que falta. Dia ruim baixa as cargas que faltam em cerca de 10%, e aquele treino não serve de base para as próximas cargas; as séries contam no volume normalmente.</li>
      <li><b>Tempo do treino</b>: o próximo treino mostra quanto deve levar (séries, reps, descanso e troca de aparelho). Depois de 3 treinos cronometrados, a conta se ajusta ao seu ritmo real. No treino, <b>Pouco tempo ou dia ruim?</b> mostra quanto falta, com e sem o pouco tempo.</li>
      <li><b>Duas academias</b>: em Ajustes, cadastre cada uma. Nas máquinas e polias o app guarda a carga de cada academia; no treino, toque no nome da academia para trocar. Barra, halteres e peso corporal valem em todas.</li>
    </ul>`],

  ['Metas', 'Objetivo, séries, cargas e cardio', `
    <p>Tudo começa pelo <b>objetivo</b>, no topo da aba Metas (toque nele para mudar). Ele define quantas séries por semana cada grupo precisa e a meta de cardio.</p>
    <ul class="errs">
      <li><b>Mapa muscular</b>: o corpo de frente e de costas, pintado pelas séries da semana (ou dos últimos 30 dias) em relação à meta. Toque num músculo para ver quantas faltam.</li>
      <li><b>Séries por grupo</b>: toque num grupo e escolha uma de 3 opções pela ciência do volume (conservador, moderado, difícil) ou defina a sua. As <b>séries efetivas</b> (carga de pelo menos 60% da sua força no exercício e até 4 reps sobrando) contam inteiras; aquecimento e séries leves contam uma parte, pela distância da falha (8 reps sobrando = meia série; 12 ou mais = nada). Nos compostos, os músculos auxiliares recebem a fração deles desse valor. Se a sua ficha não entrega a meta, toque em <b>Completar</b>.</li>
      <li><b>Cargas por exercício</b>: cada exercício mostra 3 opções para os próximos 30 dias (conservador, moderado, difícil), pelo seu melhor recente e pelo seu nível. Sem treino registrado, o app estima e avisa. Você também pode <b>seguir a sua progressão</b> ou definir a sua meta: o app diz se ela é realista, ambiciosa ou ilusória.</li>
      <li>Enquanto faltar escolher, um aviso aparece em Metas e em Treinos, e o treino pede a escolha quando entra um exercício novo.</li>
      <li>A meta de carga vale por 30 dias e é dividida em <b>degraus semanais</b>. Alterne entre <b>Semana</b> e <b>30 dias</b> no topo: as séries de 30 dias contam os últimos 30 dias, o mesmo prazo das metas de carga.</li>
    </ul>`],

  ['Seu corpo e nível de força', 'Composição corporal, radar e top de força', `
    <p>Na aba <b>Progresso</b>, o cartão <b>Seu corpo</b> usa sexo, idade, altura e peso (toque em <b>Atualizar</b> para mudar).</p>
    <ul class="errs">
      <li><b>Massa magra e massa gorda</b> são o foco. O <b>IMC</b> aparece só como número: ele não separa músculo de gordura.</li>
      <li><b>Gordura estimada</b>: com cintura e pescoço (e quadril, para mulheres), o app usa a fórmula da Marinha americana (erro de cerca de 3 a 4 pontos). Sem essas medidas, usa IMC, idade e sexo (cerca de 5 pontos) e desconta até 4 pontos se você for forte para o seu peso.</li>
      <li><b>Peso corporal</b>: o gráfico fica logo abaixo dos valores. Um registro por dia.</li>
      <li><b>Nível de força</b>: um <b>radar</b> com os 6 padrões de movimento (empurrar e puxar na horizontal e na vertical, agachar e dobradiça de quadril). À esquerda fica a frente do corpo e à direita a parte de trás: o formato mostra desequilíbrios. Toque num eixo para ver o exercício e o seu top. É o seu <b>nível de treino</b>: vem das suas séries dos últimos 60 dias (séries iguais contam como reserva) e compara você com adultos do mesmo sexo, idade e peso, pelas normas do Cooper Institute usadas pelo ACSM. Top 10% = mais forte que 90% dessas pessoas.</li>
      <li>Toque no cartão para ver cada exercício, agrupado por padrão de movimento, e em <b>Consultar qualquer exercício</b> para ver o top na hora, sem salvar. Entram os exercícios compostos de cada padrão, inclusive máquinas, polias e flexão, cada um comparado com a própria tabela da Strength Level (milhões de levantamentos registrados); isoladores (cadeiras, crucifixos, tríceps, panturrilha, abdômen) também têm nível, mas ficam fora do radar.</li>
      <li><b>Força máxima (1RM)</b>: fica na tela de cada exercício, separada. Vem da melhor série dos últimos 90 dias (ou de um <b>teste de força</b>) e é comparada só com quem registra treinos na Strength Level, um público dedicado: por isso o top dela é mais exigente.</li>
    </ul>
    <p class="tip">São estimativas. Para gordura corporal confiável, faça uma avaliação física (bioimpedância, dobras cutâneas ou DEXA).</p>`],

  ['Planilhas (Excel e Google Planilhas)', 'Exportar e importar', `
    <ul class="errs">
      <li><b>Treinos</b>: Ajustes &gt; Exportar treinos. Cada série vira uma linha.</li>
      <li><b>Metas</b>: Metas &gt; Exportar metas. Edite no Excel ou no Google Planilhas e use <b>Importar metas</b> para trazer de volta.</li>
    </ul>
    <p>Na planilha de metas, escreva séries nos grupamentos (<b>"12 séries"</b>) e carga e reps nos exercícios (<b>"42,5 kg x 10"</b>). As colunas "Feito" e "Situação" são ignoradas.</p>`],

  ['Seus dados, Google Drive e backup', 'Onde tudo fica salvo', `
    <p>Com a conta Google conectada, o app salva sozinho no seu Drive, numa pasta <b>Overload</b>, alguns segundos depois de cada alteração. Em outro aparelho, é só entrar com a mesma conta.</p>
    <ul class="errs">
      <li>Todo treino é salvo no Drive ao tocar em <b>Finalizar</b>; o resumo mostra "Salvo no seu Google Drive". Pode aparecer uma janela do Google abrindo e fechando sozinha: é o app renovando a autorização.</li>
      <li>No topo da tela, um selo mostra a situação: <b>vermelho (Sincronizar)</b> quando há alteração ainda não enviada e <b>verde (Sincronizado)</b> quando está tudo no Drive. Toque no selo vermelho para enviar na hora.</li>
      <li>Um treino em andamento fica só no aparelho e vai para o Drive ao tocar em <b>Finalizar</b>.</li>
      <li>Sem internet, o app funciona normal e envia depois.</li>
      <li>Sem conta Google, use <b>Ajustes &gt; Salvar backup completo</b> de vez em quando e guarde o arquivo fora do celular.</li>
      <li><b>Trocar de perfil</b>: Ajustes &gt; Conta &gt; <b>Sair da conta</b> e entre com outra conta Google. Cada conta tem os próprios treinos; voltando para a primeira, tudo reaparece.</li>
      <li><b>Começar do zero</b>: Ajustes &gt; <b>Apagar tudo e começar do zero</b>. O app mostra o que será apagado e pede confirmação. Com a conta conectada, apaga também no Drive.</li>
    </ul>`],

  ['Execução correta dos exercícios', 'Passo a passo de cada movimento', `
    <ul class="errs">
      <li>Durante o treino, toque no botão laranja <b>Tutorial</b> ao lado do nome do exercício: fotos do início e do fim do movimento, passo a passo, erros comuns e uma dica.</li>
      <li>Na aba <b>Treinos</b>, toque em um exercício para ver as fotos, a execução, os vídeos, o seu nível de força e a sua evolução.</li>
      <li>Exercício criado por você: com o treinador IA ligado, ele pode gerar as orientações.</li>
    </ul>`],

  ['Progresso e histórico', 'Gráficos e treinos antigos', `
    <ul class="errs">
      <li>A aba <b>Progresso</b> mostra o seu nível de força, o seu corpo, séries por semana e um gráfico para cada exercício: escolha <b>Força</b> ou <b>Volume</b>, <b>Por treino</b> ou <b>Por mês</b>. O cartão <b>Este mês</b> compara treinos, séries e volume com o mesmo período do mês passado.</li>
      <li>Na tela Hoje, o aviso <b>Exercícios parados</b> aparece quando um exercício passa 3 treinos sem superar seu melhor, com botões que já ajustam o próximo treino: recuar cerca de 10% e subir de novo, ou mudar a faixa de reps em 2 (a carga sai da força que você já mostrou). O aviso recomeça do zero depois da escolha.</li>
      <li>No <b>histórico</b>, toque em um treino e depois em um exercício para corrigir séries antigas, inclusive marcar ou desmarcar uma série como aquecimento (botão <b>Aquec.</b>).</li>
    </ul>`],

  ['Treinador IA (opcional)', 'Conversa com memória', `
    <p>Em <b>Ajustes &gt; Treinador IA</b>, escolha a sua IA (<b>Claude, ChatGPT, Gemini, Grok, DeepSeek ou Perplexity</b>) e cole uma chave de API dela: o botão <b>Criar chave de API</b> leva à página certa. Depois, toque no botão <b>Treinador</b> no canto da tela.</p>
    <ul class="errs">
      <li><b>Ele conhece seus dados</b>: treinos dos últimos 14 dias, evolução de 3 meses, metas, perfil, nível de força, peso, anotações, dores relatadas e cardio.</li>
      <li><b>Ele lembra de você</b>: anota no caderno o que você conta (dores, equipamento, horários, objetivos) e resume as conversas antigas. Veja e apague em <b>Memória</b>. A conversa e a memória sincronizam com o seu Drive.</li>
      <li>Ao abrir o chat, ele pode <b>puxar assunto</b> (no máximo uma vez por dia). As sugestões prontas ajudam a começar.</li>
      <li><b>Custo</b>: o Gemini tem uso gratuito com limites (no plano gratuito, o Google pode usar o que é enviado). As outras são cobradas por uso na sua conta; assinaturas como ChatGPT Plus não incluem a API.</li>
      <li>Com a IA ligada, o app também entende frases de voz mais livres, organiza textos importados e explica a execução de exercícios criados por você.</li>
    </ul>`],

  ['Instalar, avisos e atualizar', 'Na tela inicial do celular', `
    <p>Toque no <b>ícone laranja de download</b> no canto superior direito. Ele some quando o app já está instalado. Se o navegador não instalar direto, o app mostra os passos:</p>
    <ul class="errs">
      <li><b>Android (Chrome)</b>: menu de três pontos &gt; Instalar app.</li>
      <li><b>iPhone (Safari)</b>: botão Compartilhar &gt; Adicionar à Tela de Início.</li>
      <li><b>Aviso de fim do descanso</b>: no primeiro acesso o app pede permissão para notificações. Para o aviso aparecer no topo da tela no Android, deixe as notificações do app com prioridade alta (pop-up) nas configurações do sistema. Em Ajustes, use <b>Testar notificação</b>.</li>
      <li><b>Atualizar</b>: abra o app com internet, espere alguns segundos, feche completamente e abra de novo.</li>
    </ul>`],

  ['Problemas comuns', 'Quando algo não funciona', `
    <ul class="errs">
      <li><b>O Google diz que o app está em teste ou bloqueia o acesso</b>: peça ao dono do app para adicionar seu e-mail à lista de testadores.</li>
      <li><b>"O Google não verificou este app"</b>: é normal neste momento. Toque em Continuar.</li>
      <li><b>A janela do Google não abre</b>: permita pop-ups para este site no navegador.</li>
      <li><b>O microfone não funciona</b>: confira a permissão do microfone no navegador e a internet. Se continuar, digite a frase.</li>
      <li><b>Sem som do descanso no iPhone com o app fechado</b>: o iOS não deixa apps da web tocarem som em segundo plano. Com o app aberto o bipe toca, inclusive no silencioso.</li>
      <li><b>A IA diz que está sobrecarregada (Gemini)</b>: o app já tenta de novo sozinho; se continuar, espere um pouco ou escolha outro modelo em Ajustes.</li>
      <li><b>Não vejo a versão nova</b>: feche o app completamente e abra de novo, com internet.</li>
    </ul>`],
];

/** A Ajuda inteira em texto simples, para a IA usar como manual do app. */
export function helpText(onlyCore = false) {
  const plain = html => html.replace(/<li>/g, '\n- ').replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  // tópicos que explicam os diferenciais: primeiros passos, cardio, progressão, metas, nível de força, progresso e Treinador
  const CORE = [0, 5, 7, 8, 9, 13, 14];
  return (helpPack() || TOPICS).filter((_, i) => !onlyCore || CORE.includes(i))
    .map(([title, sub, body]) => `## ${title} (${sub})\n${plain(body)}`).join('\n\n');
}

function render() {
  $('#view').innerHTML = `
    <div class="head"><a class="icon-btn" href="#/ajustes" aria-label="${t('Voltar')}">${icon.back}</a><div class="grow"><h1>${t('Ajuda')}</h1><p class="sub">${t('Como usar o Overload')}</p></div></div>
    <div class="stack">
      ${(helpPack() || TOPICS).map(([title, sub, body], i) => `<details class="card help"${i === 0 ? ' open' : ''}>
        <summary><span class="grow"><b>${esc(title)}</b><br><span class="small muted">${esc(sub)}</span></span>${icon.down}</summary>
        <div class="help-body">${body}</div>
      </details>`).join('')}
    </div>`;
}

route('ajuda', render, { tab: 'ajustes' });
