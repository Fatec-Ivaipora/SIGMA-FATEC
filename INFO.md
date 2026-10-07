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

**Authorized domains do Firebase Auth** (2026-10-07, achado real): e-mail
de redefinição de senha (`generatePasswordResetLink`/`sendPasswordResetEmail`
com `actionCodeSettings.url` apontando pra um domínio próprio) **falha em
silêncio** se esse domínio não estiver em Authentication → Settings →
Authorized domains no Console — erro é `auth/unauthorized-continue-uri`.
`localhost` vem autorizado por padrão (por isso nunca dava pra notar isso
testando local); domínio de produção (`sigma.fatecivaipora.com.br`) não
vinha — foi o que quebrava a recuperação de senha pro aluno (nunca
chegava nenhum e-mail) até ser adicionado manualmente no Console. Se um
dia trocar de domínio customizado, lembrar de autorizar ele aqui também.

**`generatePasswordResetLink` (Admin SDK) sempre passa pela página
hospedada do Firebase** (2026-10-07, achado real — 2ª camada do mesmo
problema acima, descoberta só depois de corrigir a 1ª): mesmo com o
domínio autorizado, o link gerado aponta pra
`https://{authDomain}/__/auth/action?...&continueUrl=...`, uma página
intermediária hospedada pelo PRÓPRIO Firebase que só depois redireciona
pra `continueUrl`. `handleCodeInApp: true` **não muda isso** (só afeta o
`sendPasswordResetEmail` do client, que esse projeto não usa mais pra
isso). Essa página intermediária chama a API do Google com referer
`fateclab-4cc74.firebaseapp.com`, e a chave de API do projeto (Google
Cloud Console → Credentials → restrição de HTTP referrer) só libera o
domínio de produção — a chamada tomava 403
(`API_KEY_HTTP_REFERRER_BLOCKED`), página em branco com o erro cru em
JSON. Solução usada em `/api/auth/recuperar-senha`: extrai só o `oobCode`
do link gerado e monta o link do e-mail apontando DIRETO pra
`/redefinir-senha?oobCode=...` — nunca passa pela intermediária do
Firebase, não depende de mexer em mais nada no Google Cloud Console.

**Valor em tempo de execução exportado de um arquivo `"use client"`, importado
por uma rota de servidor, vira `undefined` em silêncio** (2026-10-07,
achado real — e-mail de "você foi cadastrado como avaliador" saía com o
link `https://sigma.fatecivaipora.com.brundefined`): `src/lib/auth.tsx`
tem `"use client"` (por causa do hook `useAuth()`), e quando uma rota
`/api/*` importa um export dele, o Next.js substitui TODAS as exportações
por referências opacas — certo pra componente React, mas
`ROTA_POR_PAPEL[papel]` virava `undefined` sem nenhum erro no log. `type
Papel` (e qualquer outro `import type`) continua seguro de importar de um
módulo `"use client"` em qualquer lugar — só **valor** em tempo de
execução precisa morar num arquivo sem `"use client"` pra poder ser lido
de dentro de uma rota de servidor. Corrigido extraindo `ROTA_POR_PAPEL`
pra `src/lib/rotaPorPapel.ts` (sem `"use client"`); `auth.tsx` reexporta
pra manter os imports client-side de sempre funcionando. Varrido o resto
de `src/lib/` (todos os outros arquivos `"use client"`) — nenhum outro
caso desse igual, só esse.

## Convenções de código estabelecidas

- Nomes de variável/função/comentário em **português**, código
  (identificadores de biblioteca, tipos do React) em inglês normal.
- Constante/função que uma rota `/api/*` precisa usar em tempo de execução
  NUNCA deve morar num arquivo `"use client"` (ver pegadinha
  `ROTA_POR_PAPEL` acima) — só `import type` é seguro cruzando essa
  fronteira. Se um valor assim só existe hoje num arquivo client, extrai
  pra um arquivo `.ts` próprio sem `"use client"` antes de importar numa
  rota de servidor.
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

## Como preparar a imagem de uma assinatura nova (catálogo de certificados)

Receita usada pela 1ª vez em 2026-10-06, pra cadastrar o Bruno (ver
`src/lib/assinantesCertificado.ts`) — a pessoa manda uma FOTO CRUA da
assinatura (folha inteira, tinta colorida, com a textura/sombra do papel
em volta), e o resultado final precisa ser um traço limpo sobre fundo
transparente, do jeito que fica em `public/certificados/assinatura-*.png`.
Fazer isso à mão (recortar no editor de imagem, apagar fundo manualmente)
dá trabalho e sai torto; o jeito que funcionou bem foi um script
descartável em Node usando `sharp` (já está em `node_modules`, não
precisa instalar nada):

1. **Achar onde está a tinta**: ler a foto ORIGINAL (não uma cópia já
   recortada/comprimida — perde qualidade a cada recompressão) como RGB
   cru (`sharp(caminho).raw().toBuffer({resolveWithObject: true})`) e
   varrer pixel a pixel procurando `azul - vermelho > 25` — tinta de
   caneta (azul ou preta) tem o canal azul nitidamente mais alto que o
   vermelho; papel e sombra ficam neutros (R≈G≈B), então não entram.
   Guardar o menor/maior X e Y onde isso bateu = a caixa que envolve a
   assinatura inteira.
2. **Recortar** (`sharp().extract({left, top, width, height})`) nessa
   caixa + ~18px de margem — direto na foto original, não na já
   processada do passo 1.
3. **Trocar a cor da tinta pra preto E remover o fundo, na mesma
   passada**: ler esse recorte como RGBA cru de novo e, pra cada pixel,
   calcular `alpha = clamp((azul - vermelho - 10) / (45 - 10) × 255, 0, 255)`
   — isso dá uma transição suave entre "é fundo" (alpha 0) e "é tinta"
   (alpha 255) em vez de uma borda dura/serrilhada (anti-aliasing). A cor
   de cada pixel vira preto puro (0,0,0) sempre, não importa a cor
   original da tinta — só o alpha desenha o traço.
4. **Salvar como `.png`**, nunca `.jpg` — jpeg não tem canal alpha, não
   segura transparência nenhuma. Nome do arquivo:
   `public/certificados/assinatura-{id}.png`.
5. Cadastrar o `id`/nome/cargo em `ASSINANTES_CERTIFICADO`
   (`src/lib/assinantesCertificado.ts`) e o arquivo em
   `IMAGEM_POR_ASSINANTE` (`src/lib/certificadosPdf.tsx`, `format: "png"`).
   Apagar o script descartável depois de rodar, mesmo padrão de sempre.

Essa receita só funciona bem se a tinta tiver uma cor que se distinga do
papel (qualquer tinta colorida — preta pura já teria R≈G≈B igual ao
fundo, não dava pra separar pelo mesmo critério; nesse caso o limiar
precisaria ser por brilho/luminosidade, não por `azul - vermelho`, e o
script teria que mudar esse detalhe específico).

## Histórico de mudanças

Uma entrada por `git push`, mais recente no topo, curta (o commit em si já
tem o detalhe completo — isso aqui é só pra orientar rápido). Ver a regra
fixa lá em cima: toda mudança validada ganha uma linha aqui, no mesmo
commit que sobe pro git.

- **2026-10-07** — **Tela de introdução antes do prompt de câmera na
  confirmação de presença por QR** (pedido explícito do usuário — maior
  causa real de gente não conseguir confirmar presença é o navegador ter
  bloqueado a câmera, ou a pessoa negar sem entender o porquê do pedido).
  Não dá pra pular o prompt nativo do navegador, mas agora o modal mostra
  um cartão explicando "vamos pedir acesso à câmera... toque em Permitir"
  ANTES de chamar `scanner.start()` (só esse clique dispara o pedido de
  verdade). Se a câmera já estava bloqueada (navegador não repete o prompt
  nativo sozinho nesse caso), a mensagem de erro agora orienta a liberar
  pelo cadeado/ícone ao lado do endereço, com botão "Tentar de novo" que
  refaz a tentativa sem fechar o modal. `src/components/ConfirmarPresencaModal.tsx`.
- **2026-10-07** — **Edição de papéis de avaliação (`/usuarios`) não
  refletia na tabela sem F5** — achado real: a gravação no Firestore
  funcionava, mas `useUsuariosPaginado`/`useBuscaUsuarios` leem uma vez (sem
  tempo real, por desenho — ver comentário em `src/lib/data/usuarios.ts`),
  então o checkbox "Também atua como" não aparecia/sumia na tabela até
  recarregar a página. Corrigido com atualização otimista da lista local
  (as duas fontes — página normal e resultado de busca — ganharam
  `setUsuarios`/`setResultado` expostos pelo hook), desfeita sozinha se a
  gravação falhar. Também escondido **por hora** o papel "Orientador" de
  toda seleção nova (`<select>` de Criar usuário e os dois checklists
  "Também atua como") — contas que já são orientador continuam intactas
  (filtro, badge, dados).
- **2026-10-07** —
  **Feedback visual da confirmação de presença por QR** (pedido explícito
  do usuário: "tá muito seco") — o modal fechava na MESMA hora que
  confirmava (achado real: `onConfirmado` e `setStatus("sucesso")`
  disparavam juntos, React processa os dois na mesma renderização, a
  pessoa nunca via nada). Agora mostra um ícone de sucesso animado (círculo
  + check desenhando via stroke-dashoffset, keyframes novas em
  `globals.css`) e só fecha sozinho ~2s depois; `prefers-reduced-motion`
  mostra tudo já completo, sem perder o feedback. Botão "Confirmar
  presença" (evento de vários dias) ganhou um preenchimento tipo "líquido"
  (`scaleX`, não `width` — evita layout thrash) representando a fração de
  dias confirmados, em `/aluno` e `/aluno/eventos`.
- **2026-10-07** *(ainda não commitado — aguardando "pode subir")* —
  **Atividade recente nunca registrava confirmação de presença por QR** —
  achado real, único gatilho da lista que nunca tinha sido ligado (ver
  `TipoAtividade` em `src/lib/atividadesAdmin.ts`). Corrigido em
  `/api/inscricoes/confirmar-presenca`.
- **2026-10-07** *(ainda não commitado — aguardando "pode subir")* —
  **Curso obrigatório também ao criar aluno pelo admin** (`/usuarios`) —
  achado real: uma aluna (Maria Gabriela) ficou sem curso porque esse
  formulário nunca teve esse campo, só o autocadastro público já exigia.
  Validado nos dois lados (tela + servidor, nunca só no cliente).
- **2026-10-07** *(ainda não commitado — aguardando "pode subir")* —
  **Relatório do evento completo ganhou 2 abas** (pedido explícito do
  usuário) — "Perfil dos inscritos" (vínculo Fatec/fora, curso, modalidade
  de apresentação escolhida na submissão — informativo pro planejamento do
  PRÓXIMO evento, útil mesmo antes de qualquer avaliação) e "Avaliação dos
  trabalhos" (nota média por área + melhores trabalhos, sem mudança — só
  reorganizado). "Inscritos por curso" também passou a funcionar pro
  evento completo (antes só evento simples).
- **2026-10-07** *(ainda não commitado — aguardando "pode subir")* —
  **Link quebrado no e-mail de "você foi cadastrado como avaliador/
  moderador/orientador"** (achado real testando — link saía
  `https://sigma.fatecivaipora.com.brundefined`). Causa: `ROTA_POR_PAPEL`
  morava em `src/lib/auth.tsx`, um arquivo `"use client"` — importado por
  uma rota de servidor (`/api/usuarios`, `/api/mail/novo-papel`), vira
  `undefined` em silêncio (ver pegadinha nova acima). Corrigido extraindo
  `ROTA_POR_PAPEL` pra `src/lib/rotaPorPapel.ts` (sem `"use client"`),
  `auth.tsx` reexporta pra não quebrar os imports client-side existentes.
  Reproduzido e confirmado corrigido com um script de ponta a ponta
  (criar usuário real pela rota, conferir o link no e-mail gerado).

- **2026-10-07** *(ainda não commitado — aguardando "pode subir")* —
  **Recuperação de senha reescrita** (pedido explícito do usuário — achado
  real: aluno relatou que o e-mail de "esqueci minha senha" nunca chegava;
  admin relatou que o link que ele mandava manualmente chegava "já
  expirado"). Causa raiz: `sigma.fatecivaipora.com.br` não estava em
  Authorized domains no Firebase Console (ver pegadinha acima) — o
  `sendPasswordResetEmail` do aluno sempre falhava em silêncio por causa
  disso; o do admin "funcionava" só porque não pedia um domínio próprio
  (caía no padrão do Firebase, sempre autorizado), mas aí o link não tinha
  a cara do SIGMA. Rota nova `/api/auth/recuperar-senha` (Authorization
  opcional — sem token é o autoatendimento, sempre responde `{ok:true}`
  mesmo pra e-mail que não existe; com token de Admin devolve o erro de
  verdade, ex. `auth/user-not-found`) gera o link pelo Admin SDK e manda
  pelo canal confiável de todo outro e-mail do sistema (`enviarEmail()` →
  `mail` → Trigger Email) em vez do envio próprio do Firebase Auth.
  `/recuperar-senha` (aluno) e o botão "Redefinir senha" em `/usuarios`
  (admin) chamam essa rota. **2ª volta** (achado real testando com um
  avaliador de verdade): o link ainda dava erro — 403
  `API_KEY_HTTP_REFERRER_BLOCKED`, página em branco. Causa: o link do
  Admin SDK sempre passa pela página hospedada do Firebase antes de
  redirecionar, e essa página tomava bloqueio de referer na chave de API
  (ver pegadinha acima). Corrigido extraindo só o `oobCode` e montando o
  link do e-mail direto pra `/redefinir-senha?oobCode=...`, sem passar
  pela intermediária do Firebase. Validado com uma chamada direta à API
  do Google simulando o referer de produção: 200 OK.

- **2026-10-06** *(ainda não commitado — aguardando "pode subir")* —
  **Logo por evento no cabeçalho da declaração** (pedido explícito do
  usuário, só pra Semana de Medicina — nunca global) — `evento.
  logoCertificadoId` (`src/lib/data/eventos.ts`) troca o texto "FATEC/IVP"
  do cabeçalho pela logo cadastrada em `LOGO_CABECALHO`
  (`certificadosPdf.tsx`), ausente/sem match cai no texto padrão (igual
  todo evento continua hoje). Cadastro manual, mesmo espírito dos
  assinantes — sem UI própria ainda, setado direto no Firestore.
  Primeira logo cadastrada: `medfatec` (fundo cinza-claro da imagem
  original removido, mesma técnica de recorte por distância de cor usada
  nas assinaturas — ver a receita de assinaturas acima, serve pra logo
  também). Também corrigido nessa leva: no certificado de **declaração**
  (`estiloDeclaracao`), o espaço entre as assinaturas e o rodapé (endereço)
  — com 3 assinantes (não cabem mais numa linha só numa página retrato)
  o bloco quebrava pra 2 linhas e colava no rodapé; `assinatura.width`
  passou de 260 pra 210 e `assinaturas` ganhou `marginBottom`.

- **2026-10-06** *(ainda não commitado — aguardando "pode subir")* —
  **Bruno Maschio Neto** (Coordenação de Medicina) cadastrado no catálogo
  de assinantes de certificado — primeiro uso da receita "assinatura
  preto sobre fundo transparente" documentada acima (a foto que ele mandou
  era tinta azul numa folha branca fotografada; antes a imagem só trocava
  de arquivo, sempre `.jpg` com o fundo da foto visível — a do Bruno
  destacava feio, tipo um retângulo, por cima do fundo ilustrado do
  certificado de apresentação). `IMAGEM_POR_ASSINANTE` em
  `certificadosPdf.tsx` passou a aceitar `.png` além de `.jpg` (Roni/João
  continuam `.jpg`, sem necessidade de reprocessar os dois); `/assinaturas`
  tenta `.png` primeiro e cai pra `.jpg` sozinho.

- **2026-10-05** *(ainda não commitado — aguardando "pode subir")* —
  **Catálogo de assinantes de certificado**, tela nova `/assinaturas`
  (pedido explícito do usuário) — antes o evento só podia escolher entre 2
  cargos fixos no código, "Diretor Acadêmico" e "Coordenador Comissão de
  Iniciação Científica" (`ASSINANTES_DIRETOR`/`ASSINANTES_COORDENADOR` em
  `src/lib/assinantesCertificado.ts`), e travou de verdade quando precisou
  assinar um 3° cargo (Coordenador de Curso de Medicina, Bruno). Agora é 1
  catálogo só (`ASSINANTES_CERTIFICADO: {id, nome, cargo}[]`, mesmo
  arquivo), e cada evento escolhe quem assina ELE (`evento.
  assinantesCertificadoIds: string[]`) por um seletor "+ Adicionar
  assinante" em Eventos (tanto no wizard de criação quanto no modal "Dados
  do certificado" de evento já existente) — `SeletorAssinantes`, componente
  compartilhado entre os dois. `/api/certificados` e os PDFs
  (`CertificadoApresentacaoPDF`/`DeclaracaoPDF` em `certificadosPdf.tsx`)
  agora recebem uma lista de assinantes, não mais 2 nomes fixos — o layout
  da linha de assinaturas ganhou `flexWrap` pra aguentar mais de 2 sem
  estourar a margem da página. Cadastro de gente nova continua MANUAL de
  propósito (pedido explícito do usuário: ele passa nome+cargo+foto da
  assinatura pelo chat, quem mantém o sistema cadastra no código) — a
  imagem da assinatura em si (`IMAGEM_POR_ASSINANTE` em
  `certificadosPdf.tsx`) não tem como vir de uma tela, só o catálogo de
  nome/cargo e a escolha por evento viraram self-service.
  Migração rodada (script descartável, já apagado): os 2 eventos existentes
  passaram de `nomeDiretorAcademico`/`nomeCoordenadorPesquisa` pros novos
  `assinantesCertificadoIds` (X MAC manteve Roni+João; Semana de Medicina
  não tinha nenhum dos dois preenchido, continua vazio até a organização
  decidir quem assina).

- **2026-10-05** *(ainda não commitado — aguardando "pode subir")* —
  **Paginação em `/usuarios` e `/ensalamento`** (pedido explícito do
  usuário: as duas carregavam tudo de uma vez, muita leitura no Firestore).
  `/usuarios` ganhou paginação de verdade — 20 por página, lida sob demanda
  (`useUsuariosPaginado`, `src/lib/data/usuarios.ts`), filtro por papel
  rodando no servidor (precisa do índice composto `papel`+`nome`, já criado
  no Firestore); busca por nome/e-mail virou uma consulta direta
  (`useBuscaUsuarios`), por PREFIXO — criou o campo `nomeBusca` (nome em
  minúsculo, migração já rodada pros 148 usuários existentes) gravado em
  toda criação/edição de conta. `/ensalamento` manteve a leitura ao vivo
  (a lista é só de 1 evento, não a base inteira, e essa tela precisa
  atualizar sozinha durante o check-in por QR) — só a EXIBIÇÃO da lista de
  presenças ficou paginada (20 por vez), os totais (confirmados/pagos)
  continuam somando todo mundo certo.

- **2026-10-05** *(ainda não commitado — aguardando "pode subir")* —
  Responsividade mobile de `/ensalamento` (pedido explícito do usuário,
  com prints do celular real) — menu sanduíche da `Sidebar` virou `fixed`
  (não `sticky`: o `overflow-x:hidden` global do `html`/`body` força
  `overflow-y:auto` nos dois, deixava ambíguo quem é o scroller de verdade
  e o `sticky` não grudava); card "Liberar certificados" e a linha de cada
  inscrito na lista de presença ganharam `flex-1`/empilhamento
  `flex-col`→`sm:flex-row` que faltava (texto/selos ficavam espremidos ou
  desalinhados à esquerda no celular); balão de "Dia X confirmado" da
  primeira linha da lista abre pra baixo em vez de pra cima (abrindo pra
  cima ficava cortado pelo `overflow-hidden` do topo arredondado do card).
  Texto do card de certificados também simplificado (ficava denso demais
  numa linha só com travessão).

- **2026-10-05** *(ainda não commitado — aguardando "pode subir")* —
  Filtro por situação de pagamento (Pago/Não pago) em `/trabalhos`, na
  visão de evento "simples" (pedido explícito do usuário) — mesmo padrão
  de pílula já usado em `/usuarios`, só aparece em evento que cobra
  inscrição.

- **2026-10-05** *(ainda não commitado — aguardando "pode subir")* —
  **Organização ganha permissão de cadastrar avaliador/orientador/
  moderador** (pedido explícito do usuário) — antes `/api/usuarios` POST
  era 100% exclusivo do Admin (`"Só o Admin pode criar novos usuários."`).
  Agora organização também pode, mas só esses 3 papéis (nunca aluno/
  organização/admin — seria escalonamento de privilégio) e só atribuindo
  eventos aos quais ela mesma já tem acesso (reforçado no servidor, não só
  escondido na UI — mesmo escopo RN-15 do resto do app). Divisão de
  trabalhos entre avaliadores (`/trabalhos`) já era liberada pra
  organização antes, não precisou mudar nada ali. Edição de nome/e-mail,
  redefinir senha e excluir conta continuam exclusivos do Admin.
  Aplicado pra Abel Felipe Freitag (`abel_freitag@hotmail.com`) — virou
  organização, escopado só pra X MAC (`OdZNgwxjhGkSYyrwLyyM`); como ele
  deixou de ser "aluno", o espelho `usuariosPublicos` dele (busca de
  colega/convite de turma) foi removido.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* —
  Checagem de **CPF duplicado** (pedido explícito do usuário, mesma linha
  do e-mail normalizado acima: CPF é obrigatório e único por pessoa, mas
  nada impedia duas contas com o mesmo). Nova rota pública
  `/api/cadastro/checar-cpf` (sem Authorization — quem está se cadastrando
  ainda não tem conta nenhuma, não tem token; só devolve um booleano, nunca
  de quem é o CPF), chamada em dois lugares: **autocadastro**
  (`cadastro/aluno/page.tsx`) — checa ANTES de criar a conta no Auth, pra
  nunca deixar uma conta órfã se o CPF já estiver em uso (mesmo cuidado do
  e-mail); e **Configurações** (`ConfiguracoesModal.tsx`) — quando alguém
  de conta antiga preenche o CPF pela primeira vez, com `excluirUid` pro
  próprio uid pra não acusar a pessoa resalvando o CPF que já é dela.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* — Bug
  real achado ao tentar enviar a Semana de Medicina pro Edubox ("1 sem
  CPF/nascimento"): não era ninguém sem CPF (nenhum dos 109 alunos
  cadastrados está — por regra, não dá). Era uma inscrição **órfã** —
  "Luciano rosa guimaraes" tinha 2 registros nesse evento: um pago, com
  conta funcionando (`drlucianorosaguimaraes@...`), e outro "pendente" cuja
  conta **não existia mais no Auth nem no Firestore** (só a
  `inscricaoEvento` tinha ficado pra trás) —
  `Drlucianorosaguimaraes@gmail.com`, com **D maiúsculo**: as duas contas
  nunca foram tratadas como o mesmo e-mail. Inscrição órfã apagada.
  **Corrigido pra não acontecer de novo**: e-mail sempre normalizado pra
  minúsculo antes de criar/editar conta no Firebase Auth — não só ao
  gravar no Firestore (que já tinha `.trim()`, mas nunca `.toLowerCase()`).
  Alterado em `cadastro/aluno/page.tsx` (autocadastro) e
  `/api/usuarios/route.ts` (POST criar conta pelo admin + PATCH editar
  e-mail). Login/recuperação de senha não precisaram de mudança — o
  Firebase já trata esses dois como case-insensitive por conta própria; só
  a CRIAÇÃO/EDIÇÃO de conta não normalizava.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* —
  `/relatorios` de evento "simples" ganhou conteúdo próprio (pedido
  explícito do usuário: era uma cópia do relatório de evento completo, só
  sem submissão/área temática, não fazia sentido). Pra esse tipo de evento,
  o 2º KPI vira **"Presença confirmada"** (em vez de "Submissões", sempre
  0) e as seções de nota/trabalho por área são trocadas por: **Perfil dos
  inscritos** (Fatec vs externo), **Inscritos por curso** (ranking, curso
  vem de `usuarios/{uid}`, buscado à parte já que não mora em
  `InscricaoEvento`) e, só quando o evento tem mais de 1 dia, **Presença
  por dia** (queda de comparecimento dia a dia). Evento completo e "Todos
  os eventos" continuam exatamente como sempre.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* — Card
  de evento no `/dashboard` ganhou uma tag sempre visível **"Simples" /
  "Completo"** (sky / navy, ao lado de "Destaque" quando tiver) — pedido
  explícito do usuário, pra quem abre o Painel já entender de cara que os
  dois tipos têm proposta diferente, sem precisar clicar em nada.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* — Card
  de evento no `/dashboard` (Painel) mostrava sempre "N submissões" — pra
  evento "simples" isso é sempre 0 (não tem trabalho nenhum), não dizia
  nada de útil. Agora mostra "N inscritos" nesse caso (métrica que faz
  sentido pra esse tipo, já que a proposta é diferente da do evento
  completo); evento completo não muda, continua "submissões".

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* —
  Primeira leva de responsividade (usuário pediu uma passada geral; Fase 1
  combinada foram os 3 fluxos que ele disse abrir pelo celular de verdade:
  lista de eventos, contagem de inscritos, Relatórios — resto do painel
  fica pra uma Fase 2, se topar). `/eventos` (lista de cards) e o modal de
  Inscritos **já estavam bem construídos** pra celular (grid com
  `sm:contents` virando lista empilhada, badges com `flex-wrap`) — nenhuma
  mudança precisou. Achado real em `/relatorios`: a barra de "nota média
  por área temática" tinha uma coluna de nome fixa em `w-44` (176px) sem
  nenhum breakpoint — em tela de celular (<380px aprox.) ficava espremida
  ou cortada pelo `overflow-x-hidden` do layout. Corrigido com o mesmo
  truque `sm:contents` do modal de Inscritos: empilha (nome em cima, barra
  + contagem embaixo) abaixo de `sm:`, vira linha horizontal de `sm:` pra
  cima, igual sempre foi. De quebra, 3 cards dessa mesma página usavam
  `bg-gradient-to-br` — proibido pelo `DESIGN.md` ("Don't use gradients
  anywhere") — trocados por preenchimento sólido (`bg-fatec-orange-50`).
  **Achado à parte, não corrigido ainda**: o botão "Exportar (PDF)" em
  Relatórios não tem nenhum `onClick` — não faz nada ao clicar. Não é bug
  de responsividade, é feature que nunca foi implementada; avisar o
  usuário antes de decidir se entra no escopo.

- **2026-10-02** *(ainda não commitado — aguardando "pode subir")* — Achado
  real relatado por um admin: editou o e-mail de um aluno em `/usuarios` e,
  em seguida, mandou a redefinição de senha — "não funcionou", sem erro
  nenhum na tela. Causa: `enviarRedefinicao()` chamava
  `sendPasswordResetEmail` **sem try/catch nenhum** — qualquer falha
  (suspeita principal: clicar "Redefinir senha" rápido demais depois de
  editar manda pro e-mail ANTIGO, que já não existe mais no Auth depois da
  troca — `auth/user-not-found`) rejeitava a promise em silêncio, a tela
  ficava do jeito que estava, sem sucesso nem erro. Corrigido: try/catch
  com mensagem clara por código de erro (`auth/user-not-found`,
  `auth/too-many-requests`, `auth/invalid-email`), botão mostra
  "Enviando..." enquanto processa.

- **2026-10-01** *(ainda não commitado — aguardando "pode subir")* —
  `/declaracoes` → "Emitir certificado" ganhou um **checklist por pessoa**
  (achado real testando: evento simples mostrava o botão "Baixar PDF"
  ATIVO pra todo mundo que já tinha pago, mesmo sem nenhuma presença
  confirmada — o backend barrava certo, mas a tela não dava nenhuma pista
  visual de que ia falhar). Cada candidato agora mostra selos (✓ verde /
  relógio cinza) dos requisitos que faltam — pagamento, liberação,
  presença — espelhando as MESMAS regras não-staff de `/api/certificados`
  (de propósito sem usar o bypass que o próprio admin tem lá: essa tela é
  pensada como verificação de quem está apto de verdade, não um atalho pra
  forçar sem os requisitos). "Baixar PDF" só fica clicável quando todos os
  selos da pessoa estiverem verdes. Checklist por papel: aluno/participante
  — pagamento (se tiver taxa) + liberação + presença (só evento simples);
  avaliador/moderador — liberação (algum trabalho dela já liberado);
  monitor — liberação (mais presença, só em evento simples, ele nunca
  paga); orientador — sem check nenhum (nada bloqueia além do trabalho já
  estar na lista). Ganhou também um filtro **Alunos / Outros cargos**
  embaixo da busca, já que só alunos/participantes pagam e se inscrevem —
  o resto (avaliador, moderador, monitor, orientador) é só atribuído por
  fora pelo admin.
- **2026-10-01** *(ainda não commitado — aguardando "pode subir")* —
  `/declaracoes` → "Emitir certificado" (a "rede de proteção" pra quando o
  autoatendimento falha) **nunca mostrava participante de evento "simples"
  na busca** — achado durante a conversa: a lista inteira vinha de
  `trabalhos`, que nem existe pra esse tipo de evento; só monitor aparecia.
  Agora aparece assim que "apto" (mesmo critério do pagamento em
  `/api/certificados` — com taxa, só quem já pagou; sem taxa, todo mundo
  que demonstrou interesse) — igual ao evento completo, onde o critério de
  aparecer é o trabalho estar "aceito". Gerar o PDF continua podendo falhar
  por falta de presença/liberação (o erro aparece ali na hora, a pessoa não
  some da lista). De quebra, achado faltando: a rota de participante nunca
  aceitava `uidAlvo` — só dava pra gerar o PRÓPRIO certificado por ali,
  nunca o de quem foi buscado na tela (mesmo mecanismo que avaliador/
  moderador/monitor já tinham, só faltava nesse papel).
- **2026-10-01** *(ainda não commitado — aguardando "pode subir")* — Duas
  melhorias em `/usuarios` (pedido explícito do usuário, por falhas
  observadas nos últimos dias — resolver sem precisar violar a senha de
  ninguém): **editar nome/e-mail** (novo botão `IdCard`, PATCH
  `/api/usuarios`) — troca o e-mail de LOGIN de verdade no Firebase Auth
  (`auth.updateUser`), não só o campo espelho do Firestore, e sincroniza
  `usuarios` + `usuariosPublicos` junto (mesma lição da correção do
  Matheus Fukuda, 2026-09-30: editar só o Firestore deixa a pessoa sem
  conseguir entrar com o e-mail "corrigido"). O botão "Redefinir senha"
  (`KeyRound`) já existia antes, mandando o link de recuperação padrão do
  Firebase — não precisou de nada novo. Dentro do filtro "Aluno", dois
  sub-filtros novos: **Fatec/Externos** (pills) e **curso** (select, lista
  de `src/lib/cursos.ts`) — só aparecem com "Aluno" selecionado, já que
  vínculo/curso não fazem sentido pros outros papéis.

- **2026-10-01** *(ainda não commitado — aguardando "pode subir")* —
  **Certificado de monitor em evento "simples" nunca tinha como ser
  liberado** — achado durante a conversa: a tela que liga
  `monitor.certificadoLiberado` (botão "Emitir certificados") só existe na
  aba de trabalhos de evento completo, que nem renderiza pra evento
  simples (`InscritosSimplesView` toma o lugar inteiro). `/api/certificados`
  ganhou um caminho próprio pra `papel === "monitor"` quando
  `evento.tipo === "simples"`: libera junto com o **mesmo botão "Liberar
  certificados" do Ensalamento** que já libera o participante
  (`evento.certificadosLiberados`, em vez do campo separado
  `monitor.certificadoLiberado`), continua **sem exigir pagamento** (mesma
  regra de sempre do monitor em evento completo), mas passa a **exigir
  presença confirmada pelo QR** (mesma fonte do papel "participante" —
  pressupõe que o monitor também clica "Participar" como inscrito comum,
  sem precisar pagar, só pra poder escanear o mesmo QR que todo mundo).
  Evento completo não muda em nada. `/aluno/certificacoes` atualizado pra
  bater com essa regra (senão o botão de baixar nunca aparecia pro
  monitor de evento simples, mesmo liberado).
- **2026-10-01** *(ainda não commitado — aguardando "pode subir")* —
  **Presença manual** em `/ensalamento`, pedido explícito do usuário: às
  vezes a pessoa não consegue escanear o QR (câmera com problema, sem
  internet no local, etc). Clicar no selo do dia (D1/D2/D3, ou o badge
  único de evento de 1 dia) marca/desmarca a presença direto, sem QR — só
  admin/organização, DE PROPÓSITO sem o monitor (ver
  `/api/inscricoes/confirmar-presenca-manual`, nova rota Admin SDK): dar
  esse poder pro monitor anularia a auditoria por dia que existe bem pra
  desconfiar de um monitor marcando presença falsa pra um amigo. No modo
  monitor, clicar no selo continua só abrindo/fechando a dica de
  data/hora (não editável); no modo admin, clicar alterna a presença de
  verdade — o hover continua mostrando a dica de data/hora pra quem já
  está confirmado, independente do clique.
- **2026-09-30** — Bug real achado pelo usuário: **Edubox mandava a carga
  horária CHEIA do evento pra todo mundo**, mesmo sem presença confirmada
  nenhuma — `/api/edubox/lancar` calculava `chpins` uma vez só a partir de
  `evento.cargaHoraria` e aplicava igual pra todo participante, sem olhar
  presença individual (campo só existe de verdade desde a feature de
  evento multi-dia desse mesmo dia). Aconteceu com a Semana de Medicina: os
  60 inscritos foram lançados com 16h cada antes do evento nem ter
  começado. Corrigido: pra `evento.tipo === "simples"`, cada pessoa agora
  recebe a MESMA conta proporcional do certificado (`round(dias
  confirmados ÷ dias do evento × carga horária total)`, 0 se ainda não
  confirmou nenhum dia) — reenviar agora corrige todo mundo pra 0h, e cada
  reenvio seguinte atualiza sozinho conforme a presença for sendo
  confirmada dia a dia no Ensalamento. Evento comum (trabalho/avaliação)
  não muda — carga horária continua igual pra todo mundo, nunca teve
  presença por dia mesmo.
- **2026-09-30** — Duas sobras menores dessa leva de mudanças, sem entrada
  própria até agora: (1) **"Liberar certificados" mudou de aba** — morava
  em `/trabalhos` (`InscritosSimplesView`), foi pra `/ensalamento`
  (`ConfirmacaoPresencaView`), porque é lá que dá pra ver a presença de
  verdade antes de decidir liberar (o pagamento mostrado em `/trabalhos` é
  só informativo, quem trava de verdade é `/api/certificados`); (2) erro de
  cadastro agora fica logado — achado real: uma aluna relatou falha no
  cadastro sem nenhuma pista pra investigar (conta do Auth já tinha sido
  criada, só a gravação em `usuarios`/`usuariosPublicos` falhou); agora
  `console.error` registra o erro e a mensagem pro usuário ficou mais clara
  ("Confira sua conexão com a internet e tente de novo").
- **2026-09-30** — Correção de conta duplicada (Matheus Augusto Cézar
  Fukuda, evento Semana de Medicina) — ele criou 2 contas porque errou o
  e-mail na primeira (`.comm` em vez de `.com`) e acabou pagando na conta
  errada. Apagada a conta certa-mas-não-paga pelo Console; a conta
  paga-mas-com-e-mail-errado teve só o campo `usuarios.email` corrigido
  pelo Console, o que NÃO muda o e-mail de login de verdade (Firebase
  Auth é separado do Firestore) nem limpa o lixo que a exclusão pelo
  Console deixa em `usuariosPublicos`/`inscricoesEvento` do uid apagado —
  por isso o evento continuava mostrando "2 Matheus" na lista de
  inscritos. Corrigido via script descartável (Admin SDK): e-mail de login
  trocado de verdade (`auth.updateUser`), `usuariosPublicos` e a inscrição
  da conta certa sincronizados, inscrição + `usuariosPublicos` órfãos da
  conta apagada removidos. **Lição pra próxima vez que alguém precisar
  mesclar/corrigir contas duplicadas pelo Console**: apagar a conta pelo
  Console só remove o registro do Firebase Auth — sempre checar também
  `usuarios`, `usuariosPublicos` e qualquer coleção com doc-id baseado no
  uid (`inscricoesEvento`, `monitoresEvento`, etc.), e lembrar que o campo
  `email` do Firestore é só espelho, nunca o e-mail de login de verdade.
- **2026-09-30** — Evento "simples" multi-dia (pedido da coordenação, caso
  real: Semana Acadêmica de Medicina). Em Eventos → Dados do certificado,
  "Data de realização" virou "Data de início" + novo campo opcional **"Data
  de término"** pra evento tipo "simples" — o número de dias é sempre
  CALCULADO a partir do intervalo entre as duas datas (`diasDoEvento` em
  `src/lib/certificadoDias.ts`, arquivo sem `"use client"` pra ser
  importável tanto do formulário quanto das rotas de API e da geração do
  PDF), nunca um número digitado à parte — a primeira versão dessa feature
  tinha um campo "Dias do evento" separado, que discordou da data de
  realização assim que testado de verdade (evento real de 2 dias com o
  campo ainda em 3, de um teste anterior — o certificado saía com
  "realizado em 08/10... carga horária de 16h", parecendo 1 dia só de 16h),
  corrigido ainda na mesma sessão. Carga horária continua sendo sempre o
  TOTAL do evento, nunca muda de significado — evento de 1 dia (a imensa
  maioria, incluindo a X MAC) continua exatamente igual a antes, nenhuma
  migração precisou rodar.

  Cada inscrito começa com 0h e ganha proporcionalmente conforme confirma
  presença dia a dia (`/api/certificados` calcula `round(dias confirmados
  ÷ dias do evento × carga horária total)`, arredondando só no final pra
  não acumular erro quando não divide exato — ex.: 16h/3 dias, confirmou
  2, recebe 11h). O certificado imprime o período certo ("realizado de
  08/10/2026 a 09/10/2026") em vez de só a data de início, em todas as
  declarações desse evento (participante, monitor, avaliador/moderador/
  orientador) via `formatarPeriodoRealizacao` em `certificadosPdf.tsx`.

  Em `/ensalamento`, a tela do QR ganhou um seletor manual "Dia 1 / Dia 2 /
  Dia 3..." (o admin escolhe qual dia está projetando antes de abrir pro
  público); a lista de presenças mostra um selo por dia (D1/D2/D3) em vez
  de um badge único, cada pessoa mostra quantas horas já tem garantidas
  (calculado ao vivo), e clicar/passar o mouse num selo já confirmado
  mostra a data/hora exata daquela confirmação — auditoria pensada pra
  pegar alguém girando os dias sozinho pra um amigo em vez de presença
  real em dias diferentes (ver entrada do monitor abaixo). Em Eventos →
  Dados do certificado, "Data de término" ganhou uma etiqueta ao lado
  mostrando a conta ao vivo ("16h ÷ 3 dias ≈ 5,3h/dia") pra quem está
  montando o evento conferir — só apoio visual, o certificado em si sempre
  arredonda pro inteiro. `InscricaoEvento.presencaConfirmada` (boolean)
  virou `presencasConfirmadas` (mapa `{"1": timestamp, "2": timestamp,
  ...}`) — o texto do QR também ganhou o dia embutido e assinado (HMAC
  inclui `eventoId:dia:janela`, não só `eventoId:janela`, pra um QR do dia
  1 não validar presença no dia 2 mesmo dentro da mesma janela de 1
  minuto).

  **Liberar certificados** continua exigindo os mesmos três critérios de
  sempre (liberação + pagamento + presença), mas agora "presença" quer
  dizer **pelo menos 1 dos N dias confirmado** (não todos) — quem faltou
  um dia ainda recebe certificado, só que com menos horas. Os 4 lugares
  que mostram esse estado pro aluno (`DestaqueEventoBanner`, `/aluno`,
  `/aluno/eventos`, `/aluno/certificacoes`) mostram o progresso "(X/N
  dias)" quando o evento tem mais de 1 dia — de quebra, `/aluno/eventos`
  tinha ficado pra trás numa correção anterior (ainda usava OR entre
  liberação/presença em vez do AND dos três critérios), corrigido junto.
- **2026-09-30** — Nome de quem assina o certificado (Diretor
  Acadêmico/Coordenador) virou **select** em vez de texto livre — achado
  durante a conversa: a imagem da assinatura digitalizada sempre foi FIXA
  por cargo (Roni pro Diretor, João pro Coordenador, ver
  `ASSINATURA_RONI`/`ASSINATURA_JOAO` em `certificadosPdf.tsx`), nunca
  conferida contra o nome digitado — se algum dia alguém tivesse digitado
  um nome diferente, o PDF saía com a assinatura de outra pessoa embaixo
  do nome errado. Lista de quem pode ser escolhido agora mora em
  `src/lib/assinantesCertificado.ts` (só client-safe, string dos nomes —
  as imagens continuam só em `certificadosPdf.tsx`, que lê arquivo do
  disco e só roda no servidor); pra cadastrar alguém novo precisa mexer
  nos dois lugares (documentado lá). Dado antigo não quebrou: "Ronielison
  Barbosa Ferreira"/"João Felipe Marques da Silva" (já gravados na X MAC)
  batem exatamente com as opções do select.
- **2026-09-30** — Monitor ganha função de verdade em evento "simples"
  (diferente de evento completo, onde monitor continua sendo só um cargo
  pro certificado, sem acesso nenhum): quem é monitor de um evento tipo
  "simples" agora vê o item **"Ensalamento"** no próprio menu do aluno,
  com uma versão enxuta da tela (`EnsalamentoMonitorView`) — só o QR + a
  lista de presença, **sem** a seção "Liberar certificados" nem o selo de
  horas por pessoa (isso é decisão/informação de admin/organização, não do
  monitor). A lista chega por uma rota própria
  (`/api/inscricoes/lista-presenca`, Admin SDK) porque firestore.rules só
  libera listar `inscricoesEvento` inteiro pra admin/organização — mesmo
  problema que `/api/inscricoes/uids` já resolvia pro mesmo motivo.
  `/api/eventos/qr-atual` também passou a aceitar monitor do evento (antes
  só admin/organização). A auditoria por dia (hover/clique num selo
  D1/D2/D3 mostrando a data/hora exata) continua valendo pro monitor — é
  justamente a segurança contra um monitor mal-intencionado girando os
  dias sozinho pra confirmar presença de um amigo que não veio nos outros
  dias. Nenhuma regra do `firestore.rules` precisou mudar.
- **2026-09-30** — Regra do certificado de participação (evento "simples")
  mudou de vez, pedido explícito do usuário — **três critérios
  obrigatórios juntos, não alternativas entre si**: a organização precisa
  ter apertado "Liberar certificados" no evento, o pagamento (se tiver
  taxa) precisa estar em dia, e a presença precisa ter sido confirmada
  pelo QR. Antes presença sozinha já liberava o certificado mesmo sem a
  organização liberar — não é mais assim. Em `/aluno/certificacoes`
  especificamente, o item **nem aparece na aba** até `certificadosLiberados`
  ser true (antes aparecia sempre, só escondia o botão); ali dentro, falta
  pagamento mostra "Pagamento pendente" e falta presença mostra "Sem
  presença confirmada". `DestaqueEventoBanner` e "Meus eventos" (`/aluno`)
  só mostram o botão "Baixar certificado" com os três critérios batendo.
  Corrigido também no backend (`/api/certificados`), que é quem de fato
  bloqueia a geração do PDF. **Consertado achado durante o teste**: a
  versão anterior (do mesmo dia) tinha corrigido só a metade — tirou a
  presença como "atalho" pra liberar, mas não exigia ela junto com o
  pagamento, então dava pra baixar só com liberação + pagamento, sem
  presença nenhuma.
- **2026-09-30** — Dois achados testando a Semana de Medicina (2º evento
  em destaque de verdade, além da X MAC):
  1. **`/aluno/eventos` ("Submissões") só destacava 1 evento por vez** —
     qualquer outro marcado como destaque caía num card genérico sem
     banner (mesma lacuna que a home já tinha corrigido, essa tela tinha
     ficado pra trás). `DestaqueEventoBanner` perdeu a centralização/
     largura própria (quem decide isso agora é a página) e ganhou
     `flex-1` interno pra esticar parelho; `/aluno/eventos/page.tsx`
     mostra todos os destaques numa grade de até 2 colunas (1 no
     celular).
  2. **Evento "simples" com taxa nunca checava pagamento antes de mostrar
     "Inscrição confirmada"** — `jaInscrito` (usado pra decidir isso)
     significa "tem trabalho enviado", que nunca acontece em evento
     simples, então o branch de pagamento pendente nunca disparava pra
     esse caso. Corrigido nos dois lugares que mostram isso
     (`DestaqueEventoBanner` e "Meus eventos" em `/aluno`, que nem tinha
     os botões de presença/certificado pra evento simples ainda) —
     confirmar presença fica **junto** com o aviso de pagamento pendente
     (são independentes, dá pra escanear o QR no dia mesmo sem o
     pagamento online confirmado), só "Baixar certificado" espera o
     pagamento, porque a API já recusa mesmo.
- **2026-09-29** — Certificados: Diretor Acadêmico e Coordenador não são
  mais obrigatórios os dois juntos — evento escolhe 1 ou os 2 (aplica a
  todo tipo de certificado/declaração, antes só o do aluno exigia os
  dois). `CertificadoApresentacaoPDF`/`DeclaracaoPDF` (`certificadosPdf.tsx`)
  só desenham o bloco de quem tiver nome preenchido, num componente
  `BlocoAssinatura` compartilhado entre os dois. De quebra, **corrigido o
  título do cargo do Coordenador**: conferido contra o edital oficial da
  X MAC (alguém questionou o texto), que assina só "Coordenador Comissão
  de Iniciação Científica" — o sistema tinha "Coordenador(a) da Pesquisa e
  Formação Científica", que não batia com nenhum documento oficial
  encontrado (o comentário que justificava essa troca em 04/09 citava a
  fonte errada — um certificado real antigo que na verdade diz "Presidente
  da Comissão Organizadora"). `nomeCoordenadorPesquisa` continua sendo o
  nome do campo no Firestore (só guarda o nome da pessoa, não o cargo),
  não precisou migrar dado nenhum.
- **2026-09-29** — Teto de largura do banner de destaque na home subiu de
  `max-w-[1008px]` pra `max-w-[1600px]` (achado ao testar a correção do
  corte, entrada logo abaixo: 1008px é menor que praticamente qualquer
  notebook/monitor comum, então a barra navy nas laterais aparecia quase
  sempre, não só em tela muito larga como planejado). Consultado o
  `DESIGN.md` do projeto pra decidir como preencher a lateral quando ainda
  aparece (monitor ≥1920px/ultrawide): nada de gradiente/blur decorativo
  ali, contrariaria o sistema visual ("navy ocupa região estrutural em
  força total", gradiente/blur banidos exceto no scrim do modal) — só
  navy sólido mesmo, e o teto mais alto (banner até ~667px de altura) faz
  isso ser raro na prática.
- **2026-09-29** — **Correção de verdade do corte de banner** (a entrada
  logo abaixo, de mais cedo hoje, tinha um efeito colateral ruim — deixa
  aqui documentado pra não repetir). Trocar a proporção do recorte pra
  18:5 só empurrou o corte pra dentro da própria ferramenta: 18:5 é
  panorâmico demais pra foto normal de pessoa/evento, então no zoom
  mínimo já faltava altura e cortava o mesmo jeito. A causa raiz era
  outra: a caixa do banner (home em `src/app/page.tsx` e o card menor em
  `DestaqueEventoBanner.tsx`) tinha **altura fixa em pixel + largura 100%
  fluida** — nenhuma proporção fixa, então a proporção real mudava com o
  tamanho da tela e nunca batia com o que a ferramenta de recorte
  prometia. Corrigido nas duas: `aspect-[12/5]` (mesma proporção do
  `BannerCropModal`, que voltou pra 12:5 original) garante que a
  proporção nunca muda, em nenhuma largura de tela — zero corte de
  surpresa. Na home, `max-w-[1008px]` (= 420px de altura máxima × 12/5)
  segura o "nunca fica gigante" em monitor muito largo: acima disso a
  foto para de esticar e fica centralizada, com o navy de fundo sobrando
  nas laterais em vez de crescer ou cortar. **Banners já cadastrados
  continuam com o corte antigo** até reabrir o evento e recortar de novo.
- **2026-09-29** — `BannerCropModal` mudou a proporção de recorte de 12:5
  (2,4:1) pra 18:5 (3,6:1). Achado ao cadastrar a Semana Acadêmica de
  Medicina: o banner saiu cortado (título sumindo) na home. Causa: a caixa
  do banner em destaque (`src/app/page.tsx`) tem altura fixa em pixel
  (300/360/420 conforme a tela) mas largura 100% fluida (full-bleed, de
  propósito, pra nunca ficar gigante em monitor largo) — a proporção real
  da caixa varia com o tamanho da tela, e em notebook/monitor comum (ex.
  1512×420) já passa de 3,6:1, bem mais largo que os 2,4:1 que a
  ferramenta de recorte prometia. 3,6:1 bate melhor com esse caso comum;
  ainda corta um pouco em monitor ultrawide (>1920px, não dá pra zerar sem
  abrir mão do "nunca gigante"). **Só vale daqui pra frente** — banners já
  cadastrados (como o da Semana de Medicina) continuam cortados até
  alguém reabrir o evento e recortar de novo com a ferramenta atualizada.

- **2026-09-28** *(incidente em produção, corrigido no mesmo dia)* —
  **Toda rota `/api/*` caiu** depois do push do ensalamento (ninguém
  detectou na hora porque ensalamento só usa Firestore direto do client,
  nunca passa por API). Causa raiz, pelo log de runtime da Vercel:
  `package.json` tinha `firebase-admin` pinado em `14.4.0` — que depende
  de `jwks-rsa@^4`, que depende de `jose@^6` (ESM puro, sem suporte a
  `require()`). Todo `require()` de `firebase-admin/auth` quebrava com
  `ERR_REQUIRE_ESM`, sempre com corpo vazio (por isso só aparecia
  "Unexpected end of JSON input" no console, nenhuma mensagem de erro).
  **Isso já tinha acontecido e sido corrigido antes** (commit `cb499e6`,
  25/08: "Downgrade firebase-admin to 13.x to fix ERR_REQUIRE_ESM in
  production") — o push do ensalamento subiu `firebase-admin` de volta pra
  14.x sem querer (provável `npm install` pegando a versão mais nova) e
  reintroduziu o mesmo bug. **Marcar `jwks-rsa`/`jose` em
  `serverExternalPackages` (tentativa inicial) não resolveu** — o
  `Context.externalImport` do Turbopack quebra igual nesses pacotes ESM
  independente de estarem marcados como externos; o bug é do mecanismo em
  si, não de empacotamento. A correção de verdade é a mesma de antes:
  `firebase-admin` fixado em `^13.10.0` (resolve `jwks-rsa@3` →
  `jose@4`, CJS-compatível). **Se algum dia atualizar o `firebase-admin`
  de novo, testar assim antes de subir** (não dá pra confiar só no
  `npm run dev`, que não reproduz isso — só o bundle de produção):
  `npm run build && npm run start`, depois `curl` numa rota que usa
  `getAdminAuth()`/`getAdminDb()` com um token qualquer (não precisa ser
  válido, só precisa entrar no código que importa o Admin SDK) e conferir
  que volta JSON em vez de 500 vazio.
- **2026-09-28** — `/api/usuarios` (criar conta) ganhou `try/catch` geral:
  sem isso, qualquer falha inesperada virava um 500 sem corpo, e a tela de
  `/usuarios` travava tentando ler isso como JSON ("Unexpected end of JSON
  input" no console, sem mensagem nenhuma pro admin) — foi o sintoma que
  levou a achar o incidente acima. Agora loga a causa real no log da
  Vercel e devolve erro em JSON; o client também não quebra mais se a
  resposta não vier em JSON. Fica como rede de segurança geral, não só
  pra esse incidente específico.
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
