// Ajuda: tutoriais de uso do app.
import { $, esc, icon } from '../ui.js';
import { route } from '../router.js';

// Cada tópico: [título, resumo de uma linha, conteúdo em HTML]
const TOPICS = [
  ['Primeiros passos', 'Do primeiro acesso ao primeiro treino', `
    <ol class="steps">
      <li><b>Entre com sua conta Google</b> na primeira tela. Assim seus treinos ficam salvos no seu Drive. Se preferir, toque em "Usar sem conta".</li>
      <li><b>Escolha um ponto de partida</b>: ABC, Push/Pull/Legs, Superior/Inferior, Corpo inteiro ou do zero.</li>
      <li><b>Informe as cargas que você já usa</b> na tela de cargas iniciais. É opcional: o que ficar em branco você escolhe no primeiro treino.</li>
      <li>Na aba <b>Hoje</b>, toque em <b>Começar treino</b>.</li>
    </ol>
    <p class="tip">Tudo pode ser mudado depois na aba Treinos: exercícios, ordem, séries e faixa de repetições.</p>`],

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

  ['Planilhas (Excel e Google Planilhas)', 'Exportar e importar', `
    <ul class="errs">
      <li><b>Treinos</b>: Ajustes &gt; Exportar treinos. Cada série vira uma linha.</li>
      <li><b>Metas</b>: Metas &gt; Exportar metas. Edite no Excel ou no Google Planilhas e use <b>Importar metas</b> para trazer de volta.</li>
    </ul>
    <p>Na planilha de metas, escreva séries nos grupamentos (<b>"12 séries"</b>) e carga e reps nos exercícios (<b>"42,5 kg x 10"</b>). As colunas "Feito" e "Situação" são ignoradas.</p>`],

  ['Seus dados, Google Drive e backup', 'Onde tudo fica salvo', `
    <p>Com a conta Google conectada, o app salva sozinho no seu Drive, numa pasta <b>Overload</b>, alguns segundos depois de cada alteração. Em outro aparelho, é só entrar com a mesma conta.</p>
    <ul class="errs">
      <li>A autorização do Google dura cerca de 1 hora. Depois disso, se houver algo para enviar, aparece um botão <b>Sincronizar</b> na tela Hoje: um toque resolve.</li>
      <li>Sem internet, o app funciona normal e envia depois.</li>
      <li>Sem conta Google, use <b>Ajustes &gt; Salvar backup completo</b> de vez em quando e guarde o arquivo fora do celular.</li>
    </ul>`],

  ['Execução correta dos exercícios', 'Passo a passo de cada movimento', `
    <ul class="errs">
      <li>Durante o treino, toque no <b>ícone (i)</b> ao lado do nome do exercício.</li>
      <li>Na aba <b>Treinos</b>, toque em um exercício para ver execução, erros comuns, dica, vídeos e a sua evolução.</li>
      <li>Exercício criado por você: com o treinador IA ligado, ele pode gerar as orientações.</li>
    </ul>`],

  ['Progresso e histórico', 'Gráficos e treinos antigos', `
    <ul class="errs">
      <li>A aba <b>Progresso</b> mostra séries por semana, recordes e a evolução de força de cada exercício. Passe o dedo no gráfico para ver cada treino.</li>
      <li>No <b>histórico</b>, toque em um treino e depois em um exercício para corrigir séries antigas.</li>
    </ul>`],

  ['Treinador IA (opcional)', 'Análises e dúvidas', `
    <p>Com uma chave da API do Claude em <b>Ajustes</b>, o app analisa sua semana, responde dúvidas de execução e entende frases de voz mais livres. O uso é cobrado na sua conta da API. Sem chave, todo o resto funciona.</p>`],

  ['Instalar e atualizar o app', 'Na tela inicial do celular', `
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
    <div class="head"><div class="grow"><h1>Ajuda</h1><p class="sub">Como usar o Overload</p></div></div>
    <div class="stack">
      ${TOPICS.map(([title, sub, body], i) => `<details class="card help"${i === 0 ? ' open' : ''}>
        <summary><span class="grow"><b>${esc(title)}</b><br><span class="small muted">${esc(sub)}</span></span>${icon.down}</summary>
        <div class="help-body">${body}</div>
      </details>`).join('')}
    </div>`;
}

route('ajuda', render);
