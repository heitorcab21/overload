# Overload

Aplicativo web (PWA) de **progressão de carga** para musculação, com metas semanais e mensais por exercício e por grupamento muscular. Feito para registrar o treino em poucos toques ou por voz, sem a sensação de preencher planilha.

Funciona no navegador do celular, pode ser instalado na tela inicial e roda sem internet. Os dados ficam salvos só no aparelho.

## O que ele faz

- **Registro rápido de séries**: um botão grande confirma a série como planejada. Se foi diferente, há botões de cenário (+1 rep, −2 reps, falhei nesta, todas como a meta, pular exercício) e, no fim do exercício, como foi (fácil, na medida, pesado, até a falha) e o que aconteceu (dor, troca de aparelho, execução ruim, sem tempo).
- **Cargas iniciais e correções**: informe de uma vez a carga que você já usa em cada exercício, ou escolha em um toque no primeiro treino. Errou um número? Toque na série para corrigir, durante o treino ou depois, no histórico.
- **Voz**: toque no microfone e fale "40 quilos, 12 repetições", "três séries de dez com cinquenta", "bati a meta", "mais uma", "estava pesado", "desfazer", "próximo".
- **Progressão automática** (dupla progressão): o app sugere a carga e as reps de cada série do próximo treino. Primeiro você ganha repetições dentro da faixa; quando bate o topo em todas as séries, ele manda subir a carga. Duas sessões abaixo da faixa geram uma redução de cerca de 10%.
- **Metas em formato de planilha**: séries por semana e por mês para cada grupamento, e meta de carga do mês para cada exercício, com a meta de cada semana calculada em degraus até lá (e editável à mão). As metas de grupamento acompanham a rotina sozinhas até você editá-las. Exporte em CSV, edite no Excel ou no Google Planilhas e importe de volta.
- **Execução ideal** de cada movimento: passo a passo, erros comuns e uma dica para 41 exercícios, acessível durante o treino.
- **Progresso**: séries por semana, evolução da força estimada por exercício, recordes e histórico.
- **Planilhas**: exporta treinos e metas em CSV (abre no Excel e no Google Planilhas) e faz backup completo em JSON.
- **Treinador IA (opcional)**: com uma chave da API do Claude, entende frases de voz mais livres, analisa a semana, tira dúvidas de execução e gera orientações para exercícios personalizados.

## Instalar no celular

Abra o endereço do app no celular e:

- **Android (Chrome)**: menu de três pontos, depois "Instalar app" ou "Adicionar à tela inicial".
- **iPhone (Safari)**: botão Compartilhar, depois "Adicionar à Tela de Início".

## Publicar no GitHub Pages

O app é só HTML, CSS e JavaScript, sem etapa de build.

1. Crie um repositório no GitHub e envie esta pasta.
2. No repositório, abra **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em alguns minutos o app fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Ao publicar uma versão nova, aumente o número em `VERSION` no arquivo `sw.js` para que os aparelhos atualizem o cache.

## Treinador IA

Em **Ajustes > Treinador IA**, cole uma chave criada no Console da Anthropic (platform.claude.com).

- A chave fica salva apenas no aparelho e é enviada somente à Anthropic.
- O uso é cobrado na sua conta da API. Vale definir um limite de gastos no Console.
- Sem chave, todo o resto funciona normalmente, inclusive offline.

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
| `js/data.js` | Biblioteca de exercícios com a execução ideal e os modelos de rotina |
| `js/logic.js` | Progressão de carga, metas e estatísticas |
| `js/voice.js` | Reconhecimento de voz e interpretador de frases em português |
| `js/ai.js` | Chamadas opcionais à API do Claude |
| `js/views/` | Telas: hoje, treino, metas, progresso, treinos e ajustes |
| `js/charts.js` | Gráficos em SVG |
| `sw.js` | Cache para uso offline |

## Aviso

O Overload é uma ferramenta de registro e acompanhamento. As sugestões de carga e as orientações de execução não substituem um profissional de educação física. Em caso de dor persistente, procure um profissional de saúde.
