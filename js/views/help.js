// Ajuda: tutoriais de uso do app.
import { $, esc, icon } from '../ui.js';
import { route } from '../router.js';
import { t, helpPack } from '../i18n.js';

// Cada tópico: [título, resumo de uma linha, conteúdo em HTML]
const TOPICS = [
  ['Primeiros passos', 'Do primeiro acesso ao primeiro treino', `
    <ol class="steps">
      <li><b>Entre com sua conta Google</b> na primeira tela. Assim seus treinos ficam salvos no seu Drive. Se preferir, toque em "Usar sem conta".</li>
      <li><b>Escolha um ponto de partida</b>: ABC, Push/Pull/Legs, Superior/Inferior, Arnold split, ABCDE, Corpo inteiro ou do zero. Depois dá para adicionar outros em <b>Treinos &gt; Adicionar treino pronto</b>.</li>
      <li><b>Informe as cargas que você já usa</b> na tela de cargas iniciais. É opcional: o que ficar em branco você escolhe no primeiro treino.</li>
      <li>Na aba <b>Hoje</b>, toque em <b>Começar treino</b>.</li>
    </ol>
    <p class="tip">Tudo pode ser mudado depois na aba Treinos: exercícios, ordem, séries e faixa de repetições. Para trocar o idioma (português, inglês ou espanhol), vá em <b>Ajustes &gt; Idioma</b>.</p>`],

  ['Importar treinos de texto', 'Do bloco de notas ou do WhatsApp', `
    <p>Já anotava seus treinos em texto? Copie e cole tudo de uma vez: o app salva as cargas e já sugere a próxima.</p>
    <ol class="steps">
      <li>No primeiro acesso, toque em <b>Já anoto meus treinos</b>. Depois, use <b>Ajustes &gt; Importar treinos de texto</b>.</li>
      <li>Cole o texto e toque em <b>Ler texto</b>. Ele entende "15kg 10 rep", "40x12", "3x10 com 50kg", "50kg 12/10/8", descanso ("1:30 min"), datas ("12/11") e grupamentos ("• Tríceps").</li>
      <li>Confira: o app mostra o que você escreveu e o exercício que reconheceu. Se errou, troque na lista; se não existir, ele cria um exercício novo.</li>
      <li>Toque em <b>Salvar</b>. Os treinos entram no histórico com a data informada (ou a de hoje).</li>
    </ol>
    <p class="tip">Texto muito bagunçado? Com o treinador IA ligado, use <b>Organizar com a IA</b>.</p>`],

  ['Registrar um treino', 'Um toque por série', `
    <ol class="steps">
      <li>A tela mostra a <b>meta de hoje</b> de cada série, já calculada pelo app.</li>
      <li>Fez exatamente isso? Toque no botão laranja <b>Feito</b>. O descanso começa a contar sozinho.</li>
      <li>Foi diferente? Use os botões <b>+1 rep</b>, <b>−1 rep</b>, <b>+2</b>, <b>−2</b> ou <b>Falhei nesta</b>. Para mudar a carga, use o − e o + ou toque no número e digite.</li>
      <li>Fez todas as séries como planejado? <b>Todas como a meta</b> registra tudo de uma vez.</li>
      <li>Ao terminar o exercício, diga <b>como foi</b> (fácil, na medida, pesado, até a falha) e marque se <b>aconteceu algo</b> (dor, troca de aparelho...). Isso muda a sugestão do próximo treino.</li>
      <li>Toque em <b>Próximo</b> e, no último exercício, em <b>Finalizar</b>.</li>
    </ol>
    <p class="tip">Errou um número? Toque na série já registrada para corrigir ou excluir. O ícone de lista no topo mostra todos os exercícios do treino.</p>`],

  ['Trocar, aquecer e RIR', 'Ajustes no meio do treino', `
    <ul class="errs">
      <li><b>Trocar exercício</b>: aparelho ocupado? Toque em <b>Trocar exercício</b> abaixo do nome e escolha outro. Marque a caixinha para trocar também na ficha.</li>
      <li><b>Adicionar exercício</b>: inclui um exercício logo depois do atual, sem mexer na ficha (ou também nela, se marcar).</li>
      <li><b>Treino livre</b>: na aba Hoje, começa um treino vazio e você adiciona os exercícios conforme treina.</li>
      <li><b>Foi aquecimento</b>: registra a série como aquecimento. Ela fica guardada, mas não conta na progressão, nas metas, no volume nem nos recordes. Toque nela para excluir.</li>
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

  ['Registrar por voz', 'Fale em vez de tocar', `
    <p>Toque no <b>microfone azul</b> embaixo e fale. Exemplos:</p>
    <ul class="errs">
      <li><b>"40 quilos, 12 repetições"</b>: registra uma série.</li>
      <li><b>"três séries de dez com cinquenta"</b>: registra três séries.</li>
      <li><b>"bati a meta"</b> ou <b>"fiz tudo"</b>: usa a meta como está.</li>
      <li><b>"mais uma"</b> ou <b>"menos duas"</b>: a meta com reps a mais ou a menos.</li>
      <li><b>"mais 5 quilos"</b>: ajusta a carga da próxima série.</li>
      <li><b>"estava pesado"</b>, <b>"desfazer"</b>, <b>"pular"</b>, <b>"próximo"</b>.</li>
    </ul>
    <p class="tip">Na primeira vez o navegador pede permissão do microfone. No Android, o reconhecimento de voz precisa de internet. Se a voz não funcionar, digite a mesma frase no campo que aparece embaixo.</p>`],

  ['Como a carga é sugerida', 'A lógica da progressão', `
    <p>O app usa a <b>dupla progressão</b>: cada exercício tem uma faixa de repetições (por exemplo, 8 a 12).</p>
    <ol class="steps">
      <li>Com a mesma carga, você ganha <b>1 repetição por vez</b>, começando pela série mais fraca.</li>
      <li>Quando bate o <b>topo da faixa em todas as séries</b>, o app sobe a carga pelo valor de aumento do exercício e volta para o início da faixa.</li>
      <li>Se ficar <b>duas vezes abaixo da faixa</b>, ele sugere reduzir cerca de 10%.</li>
    </ol>
    <ul class="errs">
      <li><b>Fácil</b>: +1 rep em todas as séries.</li>
      <li><b>Até a falha</b> ou <b>dor</b>: repete os mesmos números.</li>
      <li><b>Troquei o aparelho</b>: aquele treino não conta para a próxima carga.</li>
    </ul>`],

  ['Metas da semana e do mês', 'Grupamentos e exercícios', `
    <p><b>Grupamentos</b> (peito, costas...): número de séries por semana e por mês. Elas seguem sua rotina sozinhas: cumprir os treinos é bater a meta. Se você mudar o número à mão, ele fica fixo.</p>
    <p><b>Exercícios</b>: a melhor série que você quer conseguir até o fim do mês (por exemplo, 45 kg × 10). O app divide o caminho em <b>degraus semanais</b>.</p>
    <ol class="steps">
      <li>Na aba <b>Metas</b>, alterne entre <b>Semana</b> e <b>Mês</b>.</li>
      <li>Toque em qualquer linha para editar. A meta desta semana também pode ser trocada à mão.</li>
      <li><b>Sugerir metas</b> cria metas cerca de 5% acima do seu melhor recente.</li>
    </ol>`],

  ['Seu corpo e nível de força', 'IMC, gordura, massa magra e top de força', `
    <p>Na aba <b>Progresso</b>, preencha sexo, idade, altura e peso no cartão <b>Seu corpo</b>.</p>
    <ul class="errs">
      <li><b>Massa magra e massa gorda</b> são o foco. O <b>IMC</b> aparece só como número: ele não separa músculo de gordura, então quem treina costuma ter IMC alto sem estar acima do peso.</li>
      <li><b>Gordura estimada</b>: com cintura e pescoço (e quadril, para mulheres), o app usa a fórmula da Marinha americana, com erro de cerca de 3 a 4 pontos. Sem essas medidas, usa IMC, idade e sexo, com erro de cerca de 5 pontos, e desconta até 4 pontos se você for forte para o seu peso.</li>
      <li><b>Massa magra e gorda</b>: o peso dividido pelo percentual de gordura estimado.</li>
      <li><b>Top de força</b>: toque no cartão <b>Seu nível de força</b>, no Progresso, para ver o top % de cada exercício. Ele compara o seu 1RM estimado com padrões de quem treina musculação, ajustados por sexo, idade e peso, e é recalculado sempre que você atualiza o perfil ou registra o peso. Top 10% = mais forte que 90% dessas pessoas. Em <b>Consultar qualquer exercício</b>, escolha um exercício (tronco, braços ou pernas), informe carga e reps e veja o top na hora, sem salvar nada. Só vale para exercícios com barra, halteres ou peso corporal; aparelhos e polias variam demais entre academias.</li>
      <li><b>De onde vem o 1RM</b>: o cartão de força do exercício mostra a série usada no cálculo (a melhor dos últimos 90 dias) e a fórmula. Para um número mais confiável, toque em <b>Fazer teste de força</b>: depois de aquecer, faça uma série até não aguentar mais e informe carga e reps. O teste não mexe na progressão dos treinos.</li>
      <li><b>Peso corporal</b>: no cartão Seu corpo, toque em <b>Registrar peso</b> para acompanhar o gráfico. Um registro por dia.</li>
    </ul>
    <p class="tip">São estimativas. Para um número confiável de gordura corporal, faça uma avaliação física (bioimpedância, dobras cutâneas ou DEXA). Atualize o peso de vez em quando para manter os cálculos certos.</p>`],

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
      <li>A aba <b>Progresso</b> mostra o seu nível de força, o seu corpo, séries por semana e um gráfico para cada exercício, com um ponto por treino e quanto a força subiu desde o primeiro. Passe o dedo no gráfico para ver a série de cada dia.</li>
      <li>No <b>histórico</b>, toque em um treino e depois em um exercício para corrigir séries antigas.</li>
    </ul>`],

  ['Treinador IA (opcional)', 'Análises e dúvidas', `
    <p>Em <b>Ajustes &gt; Treinador IA</b>, escolha a sua IA favorita (<b>Claude</b>, <b>ChatGPT</b> ou <b>Gemini</b>) e cole uma chave de API dela. Com isso, o app analisa sua semana, responde dúvidas de execução e entende frases de voz mais livres. Sem chave, todo o resto funciona.</p>
    <ul class="errs">
      <li><b>Gemini</b>: tem uso gratuito com limites diários. No plano gratuito, o Google pode usar o que é enviado para melhorar os produtos dele.</li>
      <li><b>Claude</b> e <b>ChatGPT</b>: cobrados por uso na sua conta. A assinatura ChatGPT Plus não inclui a API: a chave é criada à parte.</li>
      <li>O botão <b>Criar chave de API</b>, em Ajustes, leva à página certa de cada empresa.</li>
      <li><b>O que a IA vê</b>: a cada pedido, o app monta um resumo na hora com seus treinos dos últimos 14 dias (cargas, reps, RIR, sensação), metas, próximas cargas sugeridas e seu perfil e nível de força. A IA não guarda memória entre um pedido e outro: quem guarda tudo é o app.</li>
    </ul>`],

  ['Instalar e atualizar o app', 'Na tela inicial do celular', `
    <p>Toque no <b>ícone laranja de download</b> no canto superior direito da tela. Ele some quando o app já está instalado. Se o navegador não instalar direto, o app mostra os passos:</p>
    <ul class="errs">
      <li><b>Android (Chrome)</b>: menu de três pontos &gt; Instalar app.</li>
      <li><b>iPhone (Safari)</b>: botão Compartilhar &gt; Adicionar à Tela de Início.</li>
      <li><b>Atualizar</b>: abra o app com internet, espere alguns segundos, feche completamente e abra de novo.</li>
    </ul>`],

  ['Problemas comuns', 'Quando algo não funciona', `
    <ul class="errs">
      <li><b>O Google diz que o app está em teste ou bloqueia o acesso</b>: peça ao dono do app para adicionar seu e-mail à lista de testadores.</li>
      <li><b>"O Google não verificou este app"</b>: é normal neste momento. Toque em Continuar.</li>
      <li><b>A janela do Google não abre</b>: permita pop-ups para este site no navegador.</li>
      <li><b>O microfone não funciona</b>: confira a permissão do microfone no navegador e a internet. Se continuar, digite a frase.</li>
      <li><b>Não vejo a versão nova</b>: feche o app completamente e abra de novo, com internet.</li>
    </ul>`],
];

function render() {
  $('#view').innerHTML = `
    <div class="head"><div class="grow"><h1>${t('Ajuda')}</h1><p class="sub">${t('Como usar o Overload')}</p></div></div>
    <div class="stack">
      ${(helpPack() || TOPICS).map(([title, sub, body], i) => `<details class="card help"${i === 0 ? ' open' : ''}>
        <summary><span class="grow"><b>${esc(title)}</b><br><span class="small muted">${esc(sub)}</span></span>${icon.down}</summary>
        <div class="help-body">${body}</div>
      </details>`).join('')}
    </div>`;
}

route('ajuda', render);
