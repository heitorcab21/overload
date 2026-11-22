# Overload

Aplicativo web (PWA) de **progressão de carga** para musculação. Você escolhe um objetivo (ganhar massa, ficar mais forte, emagrecer ou saúde) e o app monta as metas de volume, de carga e de cardio com base em estudos, sugere a carga e as repetições de cada série e registra o treino em poucos toques ou por voz.

Funciona no navegador do celular, pode ser instalado na tela inicial e roda sem internet. Os dados ficam no aparelho e, se você entrar com o Google, numa pasta do seu próprio Drive.

## O que ele faz

**Objetivo e metas**
- **Objetivo**: massa, força, emagrecer ou saúde, com grupos priorizados e dias por semana. A partir dele o app monta as metas de séries, os cenários de carga, a faixa de repetições e a meta de cardio. Tudo pode ser editado à mão.
- **Séries por grupo pela ciência do volume** (Schoenfeld 2017, Baz-Valle 2022, Pelland 2024), em 3 cenários: conservador, moderado e difícil.
- **Séries efetivas**: conta inteira a série com carga de pelo menos 60% da sua força no exercício e até 4 reps sobrando. Aquecimento e séries leves contam uma parte, pela distância da falha (8 reps sobrando = meia série; 12 ou mais = nada).
- **Contagem fracionada por músculo**: nos compostos, os músculos auxiliares recebem uma fração da série (no supino: peito 1, tríceps 0,5, ombros 0,25), como em Pelland e cols. (2024).
- **Mapa muscular** (masculino e feminino) com o andamento da semana e botão para completar a ficha quando ela não entrega a meta.
- **Metas de 30 dias**: séries por grupo nos últimos 30 dias e meta de carga por exercício em 3 cenários pelo seu nível, com degraus semanais até o prazo e veredito para a meta que você digitar.
- **Planilhas**: metas e treinos em CSV, para editar no Excel ou no Google Planilhas e importar de volta.

**Treino**
- **Registro rápido**: um botão confirma a série como planejada; toque na série para corrigir. Bi-set e tri-set, série a mais a qualquer momento, troca de exercício com substituto sugerido, anotação fixa por exercício (regulagem, pegada) e treino livre.
- **Aquecimento reconhecido sozinho** quando a carga fica bem abaixo da meta, e corrigível no histórico. O **RIR** (reps que sobraram) é opcional e afina a sugestão.
- **Descanso** com alarme e notificação no fim. No iPhone o som toca com o app aberto.
- **Voz**: "40 quilos, 12 repetições", "três séries de dez com cinquenta", "foi aquecimento", "desfazer", "próximo".
- **Descartar o treino** em andamento e apagar treinos antigos, com confirmação de 5 segundos.

**Progressão automática**
- **Dupla progressão**: ganha 1 rep por vez dentro da faixa; ao bater o topo em todas as séries, sobe a carga.
- **Recomeço inteligente**: com a carga nova, as reps saem da força que você mostrou (80 kg × 10 → 82,5 kg × 8), em vez de voltar ao início da faixa.
- **Rumo à meta**: com meta de carga ativa, o treino puxa até o degrau da semana, no máximo um aumento de carga por treino.
- **Faixa de repetições pelo objetivo**, sempre até 12: em força, compostos em 8 a 10; em massa, 6 a 10 nos com barra e 8 a 12 nos demais.
- Dor segura a carga, duas sessões abaixo da faixa reduzem cerca de 10% e o fim do treino mostra o que já foi ajustado para a próxima vez.
- **Volta de pausa**: 14 dias ou mais sem o exercício recuam 10% (20% depois de 4 semanas, 30% depois de 8), e os treinos seguintes sobem metade do que falta até a carga de antes.
- **Exercício parado**: depois de 3 treinos sem superar o melhor, um toque recua 10% ou muda a faixa de reps, e o próximo treino já vem ajustado.
- **Pouco tempo e dia ruim**: no treino, deixa 2 séries por exercício ou baixa as cargas em 10% sem que aquele dia puxe as próximas cargas para baixo.
- **Duas academias**: máquinas e polias guardam a carga de cada academia; barra e halteres valem em todas.

**Força e corpo**
- **Nível de força** por exercício com as tabelas da Strength Level (89 exercícios), e **radar** com 6 padrões de movimento. O nível de treino compara com adultos em geral (normas do Cooper Institute, referência do ACSM) e a força máxima (1RM) com quem treina.
- Toque numa fatia do radar para ver a carga que leva ao top % que você quiser.
- **Composição corporal** (fórmula da Marinha americana ou pelo IMC, ajustada pela força) e gráfico do peso.

**Treinos e biblioteca**
- **98 exercícios** com fotos do início e do fim do movimento, passo a passo, erros comuns e uma dica.
- **9 treinos prontos** (ABC, Push/Pull/Legs, Superior/Inferior, Arnold, ABCDE, três com foco em glúteos e corpo inteiro), montar do zero e até 10 treinos salvos.
- **Importar de texto**: cole o que você anotava no bloco de notas ou no WhatsApp ("15kg 10 rep", "3x10 com 50kg"); o app monta a ficha e usa as cargas como último treino.

**Cardio**
- Registro, metas semanais em 3 cenários e rotinas com cronômetro (anel, linha do tempo, contagem 3-2-1, voz, +30 s), faixa de batimentos e progressão pelo esforço.

**Treinador IA (opcional)**
- Chat com os dados do app usando a sua chave de Claude, ChatGPT, Gemini, Grok, DeepSeek ou Perplexity.
- **Memória**: conversa contínua sincronizada, caderno de fatos (como limitações físicas), resumo das conversas e contexto de meses.
- Tenta de novo quando a conexão cai, tem limite de 60 s com cancelar e troca para um modelo reserva quando o escolhido falha.

**Geral**
- **Português, inglês e espanhol**, inclusive exercícios, Ajuda, planilhas e voz. **Quilos ou libras** (com pés e polegadas e milhas).
- **Carga total**: toda carga anotada é a total levantada; cada exercício mostra como somar.
- Atualiza sozinho e mostra a versão em Ajustes. A Ajuda fica dentro de Ajustes.

## Instalar no celular

Abra o endereço do app no celular e:

- **Android (Chrome)**: menu de três pontos, depois "Instalar app" ou "Adicionar à tela inicial".
- **iPhone (Safari)**: botão Compartilhar, depois "Adicionar à Tela de Início".

## Publicar no GitHub Pages

O app é só HTML, CSS e JavaScript, sem etapa de build.

1. Crie um repositório no GitHub e envie esta pasta.
2. No repositório, abra **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em alguns minutos o app fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Ao publicar uma versão nova, aumente o número em `VERSION` no arquivo `sw.js` para que os aparelhos atualizem o cache. Arquivos JavaScript novos precisam entrar na lista de arquivos do mesmo `sw.js`.

## Treinador IA

Em **Ajustes > Treinador IA**, escolha a IA e cole uma chave criada no site dela (o app mostra o link de cada uma). O Gemini tem uso gratuito.

- A chave fica salva apenas no aparelho e é enviada somente à empresa da IA escolhida. Ela não vai para o Drive nem para o backup.
- O uso é cobrado na sua conta da API. Vale definir um limite de gastos no painel da IA.
- Sem chave, todo o resto funciona normalmente, inclusive offline.

## Google Drive (opcional)

Com o Drive configurado, cada pessoa entra com a própria conta Google e o app guarda sozinho uma cópia dos dados no Drive dela, num arquivo `overload-dados.json` dentro da pasta "Overload". Em outro celular ou no computador, basta entrar com a mesma conta para recuperar tudo. O app só tem acesso aos arquivos que ele mesmo cria (permissão `drive.file`).

Como não existe servidor, a autorização do Google vale cerca de 1 hora. O app a renova sozinho nos toques de **Começar treino** e **Finalizar** (a janela do Google abre e fecha sem perguntar nada), então todo treino é salvo no Drive ao terminar. Para alterações fora do treino, se a autorização tiver vencido, aparece um botão "Sincronizar" na tela Hoje. Se dois aparelhos mudarem os dados sem internet, os treinos dos dois são somados e, no resto, vale a versão mais recente.

### Configurar (uma vez, pelo dono do app)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto.
2. Em **APIs e serviços > Biblioteca**, ative a **Google Drive API**.
3. Em **Google Auth Platform**, configure o app com público **Externo**.
4. Em **Público > Usuários de teste**, adicione o e-mail Gmail de cada pessoa que vai usar (até 100).
5. Em **Acesso a dados**, adicione o escopo `https://www.googleapis.com/auth/drive.file`.
6. Em **Clientes**, crie um cliente do tipo **Aplicativo da Web** com as origens JavaScript `https://SEU-USUARIO.github.io` e `http://localhost:5173`.
7. Copie o **ID do cliente** para `GOOGLE_CLIENT_ID` em `js/config.js` e publique. O ID não é segredo; a chave secreta do cliente não é usada.

Enquanto o app estiver em modo de teste, só os e-mails da lista conseguem entrar, e o Google mostra um aviso de "app não verificado" (toque em **Continuar**).

## Seus dados

Tudo fica no armazenamento do navegador do aparelho. Limpar os dados do navegador ou desinstalar o app apaga o histórico. Por isso o app lembra de fazer backup a cada 7 dias na tela Hoje; o botão abre o menu de compartilhar do celular quando possível (Google Drive, WhatsApp, e-mail) ou baixa o arquivo. Para restaurar, use **Ajustes > Seus dados > Restaurar backup**.

## Desenvolvimento

Requer apenas Node.js para o servidor local e os testes.

```bash
node tools/serve.mjs
```

```bash
node tools/test.mjs
```

O servidor abre em `http://localhost:5173`. Em localhost o service worker fica desligado; para testar o modo offline, acrescente `?sw=1` ao endereço.

| Arquivo | Conteúdo |
|---|---|
| `js/data.js` | Biblioteca de exercícios, execução ideal, treinos prontos e faixa de reps por objetivo |
| `js/logic.js` | Progressão de carga, séries efetivas, metas e estatísticas |
| `js/shares.js` | Quanto cada série conta para cada músculo nos compostos |
| `js/loads.js` | Tipo de carga de cada exercício (barra, halteres, polia, máquina...) |
| `js/scenarios.js` | Cenários das metas de carga e veredito da meta própria |
| `js/body.js` | Nível de força (tabelas da Strength Level e normas do Cooper Institute) e composição corporal |
| `js/intent.js` | Objetivo da pessoa e metas automáticas |
| `js/cardio.js`, `js/cardioplan.js` | Cardio: registro, metas e rotinas |
| `js/voice.js` | Reconhecimento de voz e interpretador de frases (PT, EN, ES) |
| `js/textimport.js` | Leitura de treinos colados do bloco de notas |
| `js/ai.js`, `js/coachmem.js` | Chamadas às IAs e memória do treinador |
| `js/views/` | Telas: hoje, treino, metas, progresso, treinos, cardio, treinador, ajuda e ajustes |
| `js/i18n.js`, `js/locales/` | Tradução: o texto em português no código é a chave; `en.js` e `es.js` trazem as traduções, os tutoriais e os exercícios |
| `js/charts.js` | Gráficos em SVG |
| `sw.js` | Cache para uso offline |

## Créditos

As fotos dos exercícios vêm do [free-exercise-db](https://github.com/yuhonas/free-exercise-db), em domínio público (Unlicense).

## Aviso

O Overload é uma ferramenta de registro e acompanhamento. As sugestões de carga e as orientações de execução não substituem um profissional de educação física. Em caso de dor persistente, procure um profissional de saúde.
