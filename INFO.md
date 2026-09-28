# INFO — guia pra continuar o SIGMA Fatec com o Claude Code

Este arquivo existe pra qualquer pessoa da equipe (ou o próprio Mateus, de outra
conta) conseguir abrir um chat novo com o Claude Code neste repositório e
continuar o trabalho sem precisar reconstruir contexto do zero. Não substitui
`PRODUCT.md` (requisitos e regras de produto) nem `DESIGN.md` (sistema visual)
— é o complemento operacional: como rodar, como testar, o que já foi feito e
os detalhes que já causaram dor de cabeça uma vez.

## O que é o projeto

SIGMA Fatec — sistema de submissão, avaliação e certificação de trabalhos
acadêmicos da Fatec Ivaiporã (ex-FatecLab). Substitui um processo manual em
planilha/e-mail. Detalhes completos de produto em `PRODUCT.md`.

**Quem arquitetou o produto: Mateus** (equipe AVA da Fatec Ivaiporã) — toda
decisão de fluxo, regra de negócio, prioridade e design deste sistema foi
dele. O Claude implementa e sugere ajustes técnicos, mas a visão e as
decisões finais do produto são do Mateus.

**Stack:** Next.js 16 (App Router, TypeScript, Turbopack) + Tailwind v4.
Firebase (Auth, Firestore, Storage, Admin SDK) como backend. Hospedado na
Vercel, deploy automático a cada push em `main`
(`https://github.com/Fatec-Ivaipora/SIGMA-FATEC`). Projeto Firebase:
`fateclab-4cc74` (nome do projeto ficou assim por não dar pra renomear um
projeto Firebase já criado — o produto se chama SIGMA, não o projeto).
Domínio de produção: `https://sigma.fatecivaipora.com.br`.

## Comece por aqui (ordem de leitura pra quem chega agora)

1. **Este arquivo inteiro** — é o único doc mantido em dia a cada push.
2. `git status` + a seção "Em andamento (não commitado)" abaixo — pode ter
   trabalho pela metade no working tree que ainda não entrou no histórico.
3. `PRODUCT.md` e `regras do app/requisitos.md` só pra entender o *porquê*
   das regras de negócio (RF/RN). **Estão defasados em vários pontos** —
   quando baterem de frente com este arquivo ou com o código, o código
   manda. Defasagens já conhecidas:
   - Dizem Next.js 15 → é Next.js **16** (ver `AGENTS.md`: APIs mudaram,
     ler `node_modules/next/dist/docs/` antes de escrever código de Next).
   - Falam em **Cloud Functions** pra submissão/aceite/certificado → nunca
     foram criadas. Tudo que precisa de privilégio é **rota `/api/*` do
     próprio Next com Admin SDK** (ver "Mapa das rotas de API").
   - Dizem que e-mail/Storage não funcionam (plano Spark) → **já funcionam**
     (Blaze ativo, extensão Trigger Email instalada, banner no Storage).
   - Pedem RA no cadastro → **RA foi removido** em 2026-09-10, só CPF.
   - Pendências 8.1/8.2/8.4/8.10 (template de certificado, aceite final,
     classificação dos vencedores, orientador-avaliador) → **resolvidas**
     (ver "O processo de ponta a ponta").
4. `regras do app/arquitetura_tecnica.md` — modelo de dados original; útil
   pra `usuarios`/`trabalhos`/`turmas`, mas não tem nada depois de 2026-08-25.
5. `regras do app/regras_da_aplicação.md` — a transcrição da primeira
   reunião (a ideia original, em 44 linhas). Bom pra ter o "espírito" do
   sistema, não os detalhes.
6. `DESIGN.md` — sistema visual (navy/laranja/sky, Poppins, sem sombra em
   card, um botão laranja por tela). Seguir em qualquer tela nova.

## O processo de ponta a ponta

É um sistema de **mostra acadêmica** (tipo congresso científico) da Fatec:
a comissão abre um evento (MAC, MOPI...), alunos se inscrevem/pagam e
submetem trabalhos, professores avaliam, os melhores de cada área são
premiados, todo mundo recebe certificado/declaração. Em ordem:

1. **Evento** (Admin, `/eventos`) — nome, descrição, banner, períodos de
   inscrição/submissão/avaliação, taxa, áreas temáticas (`/areas-tematicas`),
   se aceita participante externo, modalidades de apresentação (oral e/ou
   roda de conversa, ou nenhuma), destaque na home. Pode ser **encerrado**
   (reversível) sem apagar nada. Existe também o **evento "simples"**
   (`tipo: "simples"` — palestra/curso/workshop, sem trabalho): só
   inscrição + presença + certificado de participação (ver passo 9).
2. **Participar** — o aluno clica "Participar" (`/api/asaas/interesse`),
   o que cria a `inscricoesEvento/{eventoId}::{uid}` em estado de interesse.
3. **Pagamento** (se o evento tem taxa) — `/api/asaas/cobranca` cria a
   cobrança no Asaas (Pix/boleto/cartão), `externalReference` =
   `{eventoId}::{uid}`. Confirmação chega por **3 caminhos**, qualquer um
   basta: webhook do Asaas (`/api/asaas/webhook` — o único que manda
   e-mail + feed), sincronização quando o aluno abre a tela
   (`/api/asaas/status`), ou o admin marca na mão (`/api/asaas/manual`,
   "Inscrição manual" — pagamento em dinheiro etc.).
4. **Submissão** — aluno envia o trabalho (título, área, resumo, orientador
   como texto livre, modalidade, colegas). Colega entra como **convite
   pendente** até aceitar. Trabalho aprovado no **Projeto Integrador**
   (turmas do orientador, `/aluno/projeto-integrador`) pode ser inscrito
   num evento com título/resumo pré-preenchidos.
5. **Avaliação** — organização/admin, em `/trabalhos`, seleciona em lote e
   manda pra avaliador(es) da área (com divisão automática). Avaliador dá
   5 notas de 1-5 (soma 5-25) ou pede **revisão** (volta pro aluno, que
   corrige título/resumo e reenvia pro mesmo avaliador).
6. **Resultado por área** (edital 6.6, top 3 por área) — "Aceitar sem
   empate" resolve em lote; só quem empata na fronteira do pódio vai pra
   apresentação desempatar. Campo `premiado` separa premiado (certificado)
   de só aceito (declaração).
7. **Ensalamento** (`/ensalamento`) — catálogo único de salas (reaproveitado
   entre eventos, cada evento escolhe seu subconjunto) + grade automática de
   sessões (sala × horário × área × modalidade), cada trabalho ganha
   `sessaoId`. Oral é fatiada por minuto; roda de conversa (banner/pôster)
   usa vagas simultâneas por sala, bloco único — os dois nunca dividem sala.
8. **Apresentação / Resultado Final** — moderador pontua a apresentação
   (5 critérios, 5-25); Resultado Final mostra as duas notas em colunas.
9. **Certificados e declarações** — PDF gerado na hora
   (`/api/certificados` + `src/lib/certificadosPdf.tsx`), com assinatura
   real do Diretor e do Coordenador e número de registro sequencial **por
   evento** (começa em `evento.numeroRegistroInicial`). Tipos: aluno
   premiado, aluno aceito (declaração), avaliador, orientador, moderador,
   monitor (`monitoresEvento`), participante de evento simples (liberado
   por `certificadosLiberados` no evento **ou** por presença confirmada via
   QR rotativo — `src/lib/qrPresenca.ts`). Admin/organização emitem em nome
   de qualquer um em `/declaracoes` → "Emitir certificado".
10. **Edubox** (`/api/edubox/lancar`) — manda todo mundo elegível do evento
    (inscrito ou com trabalho) pro sistema acadêmico externo via relay, pra
    evitar cadastro duplicado lá. Reprocessa tudo a cada chamada.
11. **Relatórios** (`/relatorios`) — inscrições, submissões, pagantes,
    receita, ranking e nota média por área.

Páginas públicas (sem login): home com evento em destaque + mapa,
`/editais` (PDFs dos editais), declarações antigas por categoria/ano.

## Como rodar local

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`, com hot-reload (Turbopack). Precisa do
`.env.local` (não versionado — pedir pro Mateus ou puxar de onde a equipe
guarda os secrets) com, no mínimo:

- Firebase client SDK (`NEXT_PUBLIC_FIREBASE_*`)
- Firebase Admin SDK (`FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY`)
- Asaas (`ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`) — ver
  "Integração com a Asaas" abaixo
- Edubox (`EDUBOX_RELAY_URL`, `EDUBOX_RELAY_TOKEN`)

Verificação antes de qualquer coisa: `npx tsc --noEmit` e
`npx eslint <arquivos alterados>` (nunca lint no projeto inteiro sem pedir —
é lento e não é o hábito daqui).

## Como o Claude deve trabalhar aqui (combinado com o Mateus)

- **Nunca commitar/dar `git push` sem o usuário pedir explicitamente** —
  mesmo depois de terminar uma feature, espera o "pode subir pro git".
- **Nunca publicar `firestore.rules` sozinho** — não tem acesso ao Firebase
  CLI desse projeto; o Mateus sempre publica manualmente pelo Console do
  Firebase depois que o Claude avisa que mudou o arquivo.
- Testar de verdade antes de dizer que terminou: rodar o servidor local,
  ou escrever um script descartável com o Admin SDK pra bater na API/Firestore
  reais e conferir o resultado — nunca só "deveria funcionar". Dado de teste
  criado (usuário, trabalho, pagamento) sempre é apagado depois, exceto
  quando o próprio Mateus pedir pra manter (ex.: o trabalho de teste da
  Thalia, "TESTE TI FATEC", ficou de propósito — vai virar edição real depois).
- Scripts de diagnóstico/seed usam `require("@next/env").loadEnvConfig(...)`
  (ou o import equivalente) pra carregar o `.env.local` do jeito que o Next
  carrega de verdade — um parser caseiro do arquivo lê a `ASAAS_API_KEY`
  errada, porque ela tem um `$` escapado (`\$`) que só o loader de verdade
  desfaz.
- Scripts temporários de teste ficam na raiz do repo só enquanto rodam —
  sempre apagados no fim (não sobem pro git, mas também não ficam
  espalhados no working tree).
- **Regra fixa: todo `git push` vem acompanhado de uma entrada nova em
  "Histórico de mudanças" (embaixo neste arquivo), no mesmo commit.** É
  esse versionamento manual que permite um agente novo nunca precisar ler o
  projeto inteiro do zero pra saber o que já existe — ele lê o histórico de
  cima pra baixo e já sabe. Antes de rodar `git commit` numa mudança
  validada, escrever a entrada; `git add INFO.md` junto com o resto.

## Onde as coisas ficam (Firestore)

Coleções principais: `usuarios`, `usuariosPublicos` (espelho mínimo pra
busca de autor sem expor CPF/nascimento), `eventos`, `trabalhos`,
`inscricoesEvento` (pagamento da inscrição), `atividades` (feed "Atividade
recente" da tela inicial), `turmas` (Projeto Integrador),
`eduboxLancamentos` (cache de quem já foi mandado pro Edubox), `mail`
(fila consumida pela extensão Trigger Email do Firebase — escrever aqui via
`enviarEmail()` em `src/lib/mail.ts`, nunca direto), `turmaTrabalhos`
(trabalhos do Projeto Integrador), `monitoresEvento` (`{eventoId}::{uid}`),
`webhookEventsProcessados` (idempotência do webhook Asaas, id = id do
evento Asaas), `salas` e `sessoes` (ensalamento), `eventosQr` (segredo do
QR de presença — **nunca** legível por client, só pelas rotas via Admin SDK).
Editais e declarações públicas: ver `src/lib/data/editais.ts` e
`src/lib/data/declaracoes.ts`.

Todo hook de leitura fica em `src/lib/data/*.ts` (um arquivo por
coleção/domínio) — procurar lá antes de escrever query nova.

## Mapa das rotas de API (`src/app/api/`)

Todas com Admin SDK, autenticadas por `Authorization: Bearer <idToken>`
(exceto o webhook, que usa o header `asaas-access-token`).

- `asaas/` — `interesse` (Participar), `cobranca` (cria cobrança),
  `status` (sincroniza pagamento), `manual` (admin marca pago), `webhook`.
- `certificados` — gera o PDF de qualquer tipo de certificado/declaração.
- `edubox/` — `lancar`, `testar-conexao`.
- `eventos/qr-atual` — código atual do QR de presença (admin/organização).
- `inscricoes/` — `confirmar-presenca` (aluno escaneia o QR), `uids`.
- `mail/` — `atribuicao`, `convite-colega`, `convite-turma`, `novo-papel`,
  `trabalho-status`.
- `trabalhos/` — `alterado-admin` (avisa autores de edição do admin),
  `convite-aceito`.
- `usuarios` — criar/excluir conta (só Admin).

Regras de segurança em `firestore.rules` — sempre publicar manualmente
depois de mudar (ver acima). Padrão geral: Admin vê/edita tudo; Organização é
escopada por evento (`eventosPermitidos`); Avaliador/Orientador/Moderador só
veem o que foi atribuído a eles; Aluno só o próprio.

## Papéis (ver `src/lib/auth.tsx`)

`aluno`, `avaliador`, `organizacao`, `admin`, `orientador`, `moderador`.
Avaliador/Orientador/Moderador são **combináveis** entre si num mesmo
usuário (`papeisAvaliacao: PapelAvaliacao[]`, gerenciado pelo Admin em
`/usuarios`) — Aluno/Organização/Admin continuam com papel único. Use
`temPapel(perfil, papel)` pra checar, nunca comparar `perfil.papel`
diretamente quando o papel pode vir de `papeisAvaliacao`.

## O que já foi construído (visão rápida, não exaustiva)

- Fluxo completo de submissão → avaliação → resultado → apresentação →
  resultado final, com papéis combináveis avaliador/orientador/moderador.
- Pagamento de inscrição via Asaas (Pix/boleto/cartão), com confirmação por
  webhook + fallback manual (`/api/asaas/status`) + fallback do admin
  ("Inscrição manual" em `/eventos`).
- Feed "Atividade recente" na tela inicial do aluno/avaliador (coleção
  `atividades`, só escrita via Admin SDK — ver `src/lib/atividadesAdmin.ts`).
  Notificações por e-mail (mesmo padrão "melhor esforço", nunca bloqueia o
  fluxo principal) pra: status de trabalho, convite de colega/turma,
  atribuição de trabalho pra avaliar/apresentar, pagamento confirmado,
  recuperação de senha, novo papel de avaliação concedido, e um alerta de
  segurança quando o admin edita o trabalho de alguém por fora do fluxo
  normal (ver abaixo).
- Recuperação de senha com páginas próprias (`/recuperar-senha`,
  `/redefinir-senha`) — não usa a tela genérica do Firebase.
- Painel de Relatórios (`/relatorios`): inscrições/submissões/pagantes/
  receita, ranking dos melhores trabalhos por área temática (com dropdown
  pra áreas com sub-área, tipo "Projetos Integradores"), nota média por
  área.
- Tela de Trabalhos do admin/organização (`/trabalhos`): clicar no título
  abre um modal com todos os autores + resumo + orientador; botão "Editar"
  (só Admin) permite corrigir um trabalho em casos excepcionais mesmo
  depois do prazo (esqueceu colega, errou orientador, etc.) — toda edição
  assim **avisa automaticamente todos os autores** (feed + e-mail, "fulano
  da coordenação alterou seu trabalho"), de propósito, por segurança: evita
  que alguém com acesso de admin mexa no trabalho de outra pessoa sem
  ninguém perceber.
- "Encerrar evento": botão reversível do admin que desliga banner,
  inscrição nova e envio de trabalho de um evento, sem apagar nada.
- Cadastro só pede CPF (não pede mais RA — removido em 2026-09-10, não
  servia pra nada na integração real com o Edubox, só criava atrito).
- Resultado por área temática (edital 6.6, top 3 por área): campo
  `premiado` no trabalho separa "aceito" (participou, passou no avaliador)
  de "premiado" (ficou entre os 3 melhores da área) — decide se o aluno
  baixa Certificado (premiado) ou Declaração (só aceito, sem prêmio). Botão
  "Aceitar sem empate" resolve em lote quem não disputa a fronteira do
  pódio de uma vez; só quem empata de verdade na 3ª vaga precisa ir pra
  apresentação, pro moderador desempatar (nota av + nota apr = placar final
  desse caso — ver `analiseResultadoPorArea` em `src/app/trabalhos/page.tsx`,
  o cálculo considera todo mundo já avaliado na área, não só quem ainda está
  pendente, senão o corte do pódio recalcula errado à medida que a
  organização vai aceitando em lotes).
- Certificados/declarações com assinatura real de Diretor e Coordenador
  (`src/lib/certificadosPdf.tsx`). Aba "Emitir certificado" em
  `/declaracoes` busca qualquer aluno/colega/orientador/avaliador/
  moderador/monitor e gera o PDF certo na hora (admin ou organização) —
  inclui orientador, que não tem conta própria no sistema.

## Integrações externas — pegadinhas já conhecidas

**Asaas (pagamento):** `src/lib/asaas.ts`. **Se um pagamento cair como
"pago" na Asaas mas não confirmar sozinho aqui**, a causa mais provável é o
webhook deles apontando pra URL errada ou estando desativado — checar no
painel da Asaas em Integrações → Webhooks (aconteceu de verdade em
2026-09-10, depois de trocar de domínio pra `sigma.fatecivaipora.com.br`: o
webhook ficou dias apontando pro domínio antigo da Vercel, ninguém percebeu
porque não tinha pagamento nenhum pra "denunciar"). Testar o endpoint direto
é seguro: `POST /api/asaas/webhook` com um evento inofensivo tipo
`PAYMENT_CREATED` (não em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`) não grava
nada, só confirma se a rota está no ar e o token bate.

**Fila do webhook interrompida (o problema que mais volta).** A conta
Asaas é compartilhada com o Edubox (tem 2 webhooks cadastrados: "Fatec -
Sigma" e o "Webhook para cobranças" do Edubox — não mexer no do Edubox).
Depois de várias entregas falhando, o Asaas **interrompe a fila** do nosso
webhook e para de mandar qualquer coisa; os pagamentos continuam entrando
pelo `/api/asaas/status` (então ninguém percebe), mas o aluno **não recebe
o e-mail de confirmação** nem o aviso no feed. Sinal no Firestore: nenhuma
`atividades` com `tipo: "pagamento"` recente e `webhookEventsProcessados`
parada. Diagnóstico/reativação pela API (script descartável com
`loadEnvConfig`, ver regras acima):
- `GET {ASAAS_BASE_URL}/webhooks` → no item com a URL do SIGMA, olhar
  `interrupted` e `penalizedRequestsCount`.
- Reativar: `PUT {ASAAS_BASE_URL}/webhooks/{id}` com `{"interrupted": false}`
  — mudança na conta de produção, só com o Mateus pedindo.
- Um teste de ponta a ponta seguro: `POST` no webhook com
  `PAYMENT_CONFIRMED` + `externalReference` fictício (ID sem `__` —
  Firestore reserva `__x__`) e `id` fictício, conferir que gravou, apagar
  os dois docs. Sem `uid`/`email` na inscrição fictícia, não sai e-mail.

**Causa real (confirmada em 2026-09-24 pelo log do painel Asaas):** o
**token salvo no cadastro do webhook no Asaas não batia com o
`ASAAS_WEBHOOK_TOKEN` da Vercel** — toda entrega voltava
`401 {"erro":"Token inválido."}`. A fila é `SEQUENTIALLY`, então travou no
primeiro evento que falhou (um `PAYMENT_CREATED` de 2026-09-10 15:30, logo
depois da troca de domínio) e nada depois dele foi entregue — na prática o
webhook nunca funcionou no domínio novo. Os avisos de pagamento de
2026-09-10 no feed vieram de `/api/asaas/manual` (que também grava
`tipo: "pagamento"`), não do webhook. A suspeita de 2026-09-18 (timeout do
e-mail, que motivou o `dbf4fbd`) estava errada — a mudança continua útil,
mas não era a causa. **Lição: ao trocar URL ou token do webhook, trocar
dos dois lados (painel Asaas e Vercel) e testar com o log do painel.**
O teste de ponta a ponta acima usa o token do `.env.local`, então só prova
que a Vercel está certa — não prova que o Asaas manda o mesmo token.
**Status confirmado em 2026-09-28: o webhook voltou a funcionar.** O
token colado pelo financeiro em 2026-09-24 ficou certo do lado da Asaas —
a fila entregou 6 eventos ainda no fim daquele mesmo dia (2026-09-24
~20:16 UTC, `webhookEventsProcessados` foi de 0 pra 6:
`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, todos do mesmo `externalReference`
base `OdZNgwxjhGkSYyrwLyyM`), com `atividades` de pagamento correspondentes
no mesmo horário (feed + e-mail saíram). Fila hoje: `interrupted: false`,
`penalizedRequestsCount: 0` (zerou desde o 1 penalizado do dia 24 — a
Asaas reseta o contador quando a entrega volta a funcionar). 7 inscrições
com `status: "pago"` no total (2 mais antigas, de 2026-09-10, vieram de
`/api/asaas/manual`, de antes do conserto). Não é preciso continuar
verificando isso a cada sessão — só reabrir se algum pagamento futuro não
gerar e-mail/feed de novo (sinal: `webhookEventsProcessados` parado com
`inscricoesEvento` pagas subindo).

**Efeito colateral desse reprocessamento (achado em 2026-09-28, corrigido):**
esse mesmo reenvio do backlog reescreveu `pagoEm` de quem já tinha sido
confirmado antes pelo `/api/asaas/status` (ex.: Guilherme Henrique Camargo
Dos Santos, pago de verdade em 10/09, `pagoEm` virou 24/09 — a data da
reativação da fila, não a do pagamento). Causa: o webhook sempre gravava
`pagoEm: serverTimestamp()` de novo, sem checar se já existia um. Cada
evento reenviado do backlog tem um `id` novo, então passa batido pela
idempotência de `webhookEventsProcessados` (que só barra o mesmo `id`
chegando duas vezes). Corrigido em `src/app/api/asaas/webhook/route.ts`:
só grava `pagoEm` se o doc ainda não tiver um. O registro do Guilherme foi
corrigido na mão (data real puxada de `GET /payments?externalReference=...`
na Asaas: `confirmedDate`/`paymentDate` 2026-09-10) — os outros 5 do
reprocessamento de 24/09 não foram conferidos, só reabrir se alguém
notar outra data de pagamento estranha no modal de Inscritos.

**Edubox:** `src/app/api/edubox/lancar/route.ts` — manda CPF + nome + data
de nascimento + pagamento + carga horária pro relay deles. **Não usa RA**
(por isso o RA saiu do cadastro). O relay pode remover uma inscrição de
teste por fora do SIGMA a qualquer momento — não é bug daqui se sumir de lá.

**Trigger Email (Firebase):** qualquer e-mail do sistema é um `add()` na
coleção `mail` (via `enviarEmail()`) — a extensão observa essa coleção e
manda de verdade. Sem a extensão instalada, o doc só fica parado ali sem
erro nenhum (não é falha silenciosa nossa, é a extensão que precisa estar
ativa no projeto Firebase).

## Convenções de código estabelecidas

- Nomes de variável/função/comentário em **português**, código
  (identificadores de biblioteca, tipos do React) em inglês normal.
- `react-hooks/set-state-in-effect`: nunca chamar `setState` síncrono direto
  no corpo de um `useEffect` — sempre `Promise.resolve().then(() => setX(...))`.
- Escrita client-side direta (`updateDoc`) quando quem escreve já é dono do
  recurso (aluno editando o próprio trabalho) ou tem uma regra de Firestore
  liberando; rota `/api/*` com Admin SDK quando precisa de privilégio maior
  ou de validar algo que o client não pode ver sozinho.
- Notificação (e-mail e/ou atividade do feed) é sempre "melhor esforço":
  chamada disparada depois que a ação principal já teve sucesso, nunca
  `await`-ada de um jeito que travaria a ação se o e-mail falhar — ver
  `src/lib/notificarEmail.ts` e o padrão `try { await registrarAtividade(...) } catch {}`
  usado em toda rota de e-mail.
- Sidebar/layout: cada página usa
  `<div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">`
  como wrapper do conteúdo (ao lado do menu) — o `md:h-screen` +
  `md:overflow-y-auto` é o que faz o menu lateral nunca se mover com o
  scroll em telas de PC (2026-09-11) — não tirar essas classes achando que
  são sobra.

## Em andamento

- Na tela **Eventos do aluno** (`/aluno/eventos`), só o primeiro destaque
  aparece — a home (`/`) já mostra todos os destaques num carrossel
  (ver "Vários eventos em destaque" no histórico), mas essa tela não foi
  atualizada junto.

## Histórico de mudanças

Uma entrada por `git push`, mais recente no topo, curta (o commit em si já
tem o detalhe completo — isso aqui é só pra orientar rápido). Ver a regra
fixa lá em cima: toda mudança validada ganha uma linha aqui, no mesmo
commit que sobe pro git.

- **2026-09-28** — `/api/usuarios` (criar conta) ganhou `try/catch` geral:
  sem isso, qualquer falha inesperada (rede, cold start) virava um 500 sem
  corpo, e a tela de `/usuarios` travava tentando ler isso como JSON
  ("Unexpected end of JSON input" no console, sem mensagem nenhuma pro
  admin). Agora loga a causa real no log da Vercel e devolve erro em JSON;
  o client também não quebra mais se a resposta não vier em JSON. Não era
  um bug determinístico de "criar Admin" — as mesmas operações (Auth +
  Firestore) reproduzidas direto contra a produção funcionaram sem erro,
  então a causa raiz provável era transitória (ver esse `try/catch` como
  rede de segurança + melhor diagnóstico se voltar a acontecer).
- **2026-09-28** — Ensalamento vai pro ar: catálogo único de salas
  (`salas`, antes preso a `eventoId`, agora cadastrado uma vez e
  reaproveitado por qualquer evento via `evento.salasIds`; catálogo já
  populado com as 30 salas do campus), grade automática por sala × horário
  × área × modalidade (`sessoes`, algoritmo first-fit decreasing), modal
  "Inscritos" redesenhado (lista única com filtro Todos/Alunos/De fora em
  vez de duas colunas fixas, datas de inscrição/pagamento alinhadas em
  grid), evento "simples" (sem trabalho, só inscrição/presença/certificado)
  com presença por QR rotativo (HMAC por janela de 60s), banner de evento
  em destaque extraído (`DestaqueEventoBanner`) e página inicial mostrando
  todos os destaques num carrossel (antes só 1 por vez, RN-10). Testado com
  carga de 300 trabalhos de teste (apagados depois). Dois ajustes vieram
  desse teste: lista de trabalhos por sessão vem recolhida por padrão (com
  16-17 trabalhos por sessão virava parede de texto, difícil de ler) e roda
  de conversa
  (banner/pôster) ganhou modelo de capacidade próprio — vagas simultâneas
  por sala, bloco único pro período inteiro, nunca fatiado por minuto como
  a oral, e nunca dividindo sala com ela (pesquisado o formato padrão desse
  tipo de sessão antes de implementar). Corrigido de quebra um bug real no
  webhook Asaas: reprocessar a fila reescrevia `pagoEm` pra data da
  reativação em vez de manter a data real do pagamento (webhook não
  checava se já existia um `pagoEm` antes de gravar de novo). `firestore.rules`
  publicado manualmente no Console pelo Mateus (`salas`, `sessoes`,
  `eventosQr`).
- **2026-09-24** *(sem commit de código)* — Diagnóstico da fila do webhook
  Asaas interrompida — causa: token do webhook no painel Asaas diferente do
  da Vercel, toda entrega dava 401 desde 2026-09-10 (ver "Fila do webhook
  interrompida"). Token corrigido no painel pelo financeiro; aguardando a
  próxima entrega pra confirmar. Este `INFO.md` ganhou "Comece por aqui",
  "O processo de ponta a ponta", mapa de rotas de API, coleções novas e
  "Em andamento".
- **2026-09-18** `2fcec9c` — Home institucional redesenhada: banner do
  evento em destaque como hero (antes do herói padrão), mapa pelo Google
  Maps Embed API oficial (CSP libera `google.com` em `frame-src`), logo da
  Fatec no cabeçalho público.
- **2026-09-18** `dbf4fbd` — Webhook Asaas: e-mail de confirmação em
  melhor esforço (não derruba mais a resposta 200) + idempotência por id
  do evento (`webhookEventsProcessados`).
- **2026-09-11** `0728dde` — Modal de detalhes do trabalho em `/trabalhos` (clicar no
  título mostra todos os autores + resumo + orientador); botão "Editar"
  (só Admin) corrige trabalho fora do prazo em casos excepcionais, avisando
  automaticamente todos os autores (feed + e-mail) por segurança. E-mail ao
  ganhar papel de avaliador/orientador/moderador (conta nova ou já
  existente). Limpeza de dados de teste nas coleções `atividades` e
  `rasCadastrados`. Criado este `INFO.md`. Assinatura real do Diretor e do
  Coordenador nos certificados/declarações em PDF. Aba "Emitir certificado"
  em `/declaracoes` (busca e gera pra qualquer papel, incluindo orientador,
  que não tem conta própria) — corrige de quebra um bug real onde admin
  nunca conseguia gerar a declaração de outra pessoa. Redesenho completo do
  resultado por área temática (campo `premiado`, edital 6.6): "Aceitar sem
  empate" resolve em lote quem não disputa o pódio, só quem empata de
  verdade na 3ª vaga vai pra apresentação desempatar com o moderador —
  inclui um bug real corrigido (o cálculo do corte do pódio recalculava
  errado depois de aceitar em lotes, porque só olhava quem ainda estava
  pendente). Nota da avaliação e da apresentação em colunas separadas na
  tabela de Resultado Final (não soma mais escondido), ordenação por nota
  clicando no cabeçalho, tabela mais compacta.
- **2026-09-10** `06a381b` — Recuperação de senha (`/recuperar-senha`,
  `/redefinir-senha`), dashboard de Relatórios reconstruído do zero
  (inscrições/submissões/pagantes/receita, ranking por área temática, nota
  média por área), RA removido do cadastro (não servia pra nada na
  integração real com o Edubox), menu lateral fixo em telas de PC, modal de
  pagamento avisando "pode levar 1-2 min" com verificação automática em
  segundo plano, e-mail de "colega aceitou o convite de autor".
- **2026-09-10** `d985812` — "Encerrar evento" (botão reversível do admin
  que desliga banner/inscrição/envio de trabalho), banner de destaque
  redesenhado (corrige botão cortado no celular), link/botão "Voltar" no
  login/cadastro em qualquer tamanho de tela.
- **2026-09-09** `ac8b2db` — Período de submissão de trabalho separado do
  período de inscrições (eram confundidos antes); favicon corrigido.
- **2026-09-09** `d446feb` — Feed "Atividade recente" (coleção `atividades`,
  só escrita via Admin SDK), tela do aluno/avaliador redesenhada,
  correções de UX mobile (menu, VLibras só em telas ≥768px).
- **2026-09-09** `7e44173` — Edição de nome/datas do evento, corrige banner
  pixelado, reduz botões do card de evento.
- **2026-09-09** `45996bb` — Libera `blob:` no CSP `img-src`, corrige
  preview de troca de banner.
- **2026-09-09** `4975aa7` — E-mails personalizados com saudação ("Olá,
  {nome}") e assinatura fixa "Comissão Científica — Fatec Ivaiporã".
- **2026-09-08** `07bfafb` — Headers de segurança (CSP, X-Frame-Options
  etc.) + corrige exposição de CPF/data de nascimento entre alunos (achado
  de pentest em produção).
- **2026-09-08** `c515764` — Filtro de empate em Trabalhos, critérios reais
  da etapa de Apresentação (moderador), aba/menu "Submissões".
- **2026-09-08** `972cff4` — Identidade visual: logo oficial do SIGMA,
  favicon, crédito "Desenvolvido por Fatec", ajustes de mobile.
- *(histórico anterior a 2026-09-08 não retroagido aqui — ver `git log`
  pra commits mais antigos; a partir desta data pra frente, toda mudança
  validada passa a entrar nesta lista.)*

## Onde saber mais

- `PRODUCT.md` — requisitos, papéis, regras de negócio (pode estar um
  pouco desatualizado em detalhes pontuais; quando bater de frente com o
  código real, o código manda).
- `DESIGN.md` — sistema visual, paleta, tipografia.
- `firestore.rules` — cada bloco tem comentário explicando o motivo da
  regra, não só o "o quê".
- Sessões anteriores do Claude Code neste projeto ficam registradas em
  `claude.ai/code` — se o link de uma sessão específica for citado num
  commit (`Claude-Session: ...`), dá pra abrir e ver a conversa inteira que
  gerou aquela mudança.
