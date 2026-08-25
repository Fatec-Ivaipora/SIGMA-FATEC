# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router, TypeScript, Turbopack) + Tailwind v4. Backend: Firebase (Authentication, Firestore, "Trigger Email" extension not yet installed). Hosted on Vercel (not yet deployed). Decided with the user across prior planning (see `regras do app/requisitos.md` and `regras do app/arquitetura_tecnica.md`), not delegated. **Fully migrated off mock data as of 2026-08-17**: project `fateclab-4cc74` (Firebase project ID kept as-is after the 2026-08-25 rename to SIGMA Fatec — renaming a live Firebase project isn't supported by Firebase itself), client SDK in `src/lib/firebase.ts`, Admin SDK in `src/lib/firebaseAdmin.ts` (used only by `src/app/api/usuarios/route.ts`, the one flow — creating a new user account — that needs elevated privilege). Every screen reads/writes real Firestore now; collections start empty, so screens show honest empty states until real data exists.

## Users

- **Aluno (autor/apresentador):** cria conta, submete trabalho a um evento informando área temática e o nome do orientador (texto livre), acompanha o trabalho passar por Submissão → Avaliação → (Revisão, se pedida) → Resultado. Painel destaca o evento aberto em um banner; menu próprio "Eventos" lista abertos e encerrados. No cadastro, informa se é aluno(a) da Fatec (com RA, validado — ano de ingresso entre hoje-5 e hoje) ou **participante externo** (sem RA, só vê/inscreve eventos marcados como abertos a externos).
- **Avaliador (professor):** não tem cadastro público — conta criada pela organização/admin, que já define em qual evento e área(s) temática(s) ele atua (podendo acumular mais eventos e áreas depois, editando a conta). **Só enxerga os eventos em que foi cadastrado** — seletor de evento no Painel/Trabalhos, mais uma página "Eventos" somente leitura com suas áreas por evento. Recebe no próprio menu os trabalhos que a organização selecionou e enviou para ele; para cada um, vê título e resumo e decide entre pontuar os 5 critérios do edital, 1 a 5 cada (nota final é a soma, 5 a 25 — segue direto para Resultado) ou solicitar revisão com comentário (volta para o aluno).
- **Orientador (professor, novo em 2026-08-25):** também sem cadastro público — conta criada pelo Admin, mesmo fluxo do avaliador. Tem um menu próprio, **Projeto Integrador**: cria turmas, convida alunos da Fatec (nunca externo) por nome/e-mail (convite in-app, aceitar/recusar), publica avisos num mural (só ele posta) e avalia os trabalhos que a turma envia — pipeline próprio (Aguardando avaliação → Revisão → Aprovados, com comentário quando pede revisão), separado do pipeline de evento. Um trabalho aprovado fica disponível pro aluno inscrever num evento de sua escolha. Pode opcionalmente também receber atribuição de evento+área como um avaliador (mesma tela/mecanismo), mas ainda não tem interface própria pra agir nesse papel — ver "Em aberto".
- **Organização (equipe administrativa da Fatec Ivaiporã):** cadastra eventos e suas áreas temáticas, confirma aceite final, emite certificados, acompanha dashboard e relatórios com gráficos. **Escopada por evento** — só vê trabalhos/eventos/relatórios/áreas temáticas dos eventos em que foi cadastrada (definido na criação da conta, editável depois); vê a lista de usuários mas não pode criar/excluir/redefinir senha.
- **Admin:** mesmo tipo de permissão da Organização, mais gestão exclusiva de usuários (criar, excluir, redefinir senha de qualquer conta, incluindo orientador). **Única exceção ao escopo por evento** — sempre vê todos os eventos, sem restrição (confirmado com o usuário para preservar contas de teste completas). É o nível de acesso do usuário e do outro dev.

## Product Purpose

Gerenciar o ciclo completo de submissão de trabalhos acadêmicos em eventos institucionais da Fatec Ivaiporã (inicialmente MAC e MOPI, com suporte a novos eventos no futuro): cadastro → submissão → **Submissão → Avaliação → Resultado** → aceite final → certificação → relatórios. Sucesso = reduzir o processo hoje manual (planilhas/e-mail) para um fluxo rastreável, com a organização no controle de quem avalia o quê.

## Positioning

Segue de perto o modelo da ferramenta **DOIT** (citada como referência pela comissão de eventos): a organização vê todos os trabalhos submetidos, seleciona em lote e designa manualmente o avaliador (sem inscrição prévia do avaliador em eventos). É **multi-evento configurável desde o início**, não construído para um evento único. Diferente da v1 anterior deste documento, **não há mais aprovação do orientador dentro do sistema** — essa interação acontece fora dele, entre professor e aluno.

## Operating Context

Usado internamente pela comunidade acadêmica da Fatec Ivaiporã: alunos e orientadores em qualquer dispositivo (inclusive celular, fora de sala de aula), avaliadores (professores) e equipe organizadora majoritariamente em desktop. Depende de e-mail (Firebase Auth + extensão Trigger Email) para notificações de cada etapa do fluxo.

## Capabilities and Constraints

Requisitos funcionais completos em `regras do app/requisitos.md` (RF-01 a RF-50). Resumo do essencial:
- Cadastro público só para aluno; contas de avaliador, organização e admin são criadas pelo admin pela tela de Usuários (sem cadastro público de avaliador). "Organização" é uma opção normal nesse formulário.
- **Aluno Fatec vs. participante externo (novo em 2026-08-24):** no cadastro, a pessoa informa se é aluno(a) da Fatec Ivaiporã. Se sim, precisa informar o **RA** (10 dígitos: ano de ingresso + 6 números; ano validado entre hoje−5 e hoje). Se não, vira **participante externo** — mesma conta "aluno" por trás, mas sem RA e só pode se inscrever em eventos marcados como "aceita externos" (RF-50), configurável pela organização em Eventos. Restrição validada nas Security Rules, não só na UI.
- Ao criar avaliador ou organização, o admin já define o(s) evento(s) — e, para avaliador, a(s) área(s) temática(s) por evento (multi-seleção desde 2026-08-25, antes era uma só); editável depois (adicionar/remover evento) para contas que passam a atuar em eventos futuros.
- Envio para avaliação com divisão automática por área (2026-08-25): se os trabalhos selecionados são todos do mesmo evento+área e há mais de um avaliador cadastrado pra ela, o modal de "Enviar para avaliação" sugere repartir igualmente entre eles (com ajuste manual de quantos cada um recebe, inclusive pra decidir quem fica com a sobra em número ímpar) em vez de mandar tudo pra um avaliador só. Fora desse caso, continua o modo manual (escolher 1 avaliador pra tudo).
- **Escopo por evento (RN-15):** Organização e Avaliador só enxergam trabalhos/eventos/relatórios/áreas temáticas dos eventos em que foram cadastrados — nunca os demais. **Admin não tem essa restrição**, sempre vê todos os eventos (decisão confirmada com o usuário, para manter contas de teste completas).
- Verificação de duplicidade de trabalho por título + participantes (texto livre) dentro do mesmo evento.
- Orientador é só um campo de texto obrigatório no formulário de submissão (nome do professor) — não é uma conta, não tem aprovação dentro do sistema.
- Área temática é obrigatória na submissão, escolhida de uma lista que a organização mantém por evento numa página dedicada ("Áreas temáticas", RF-43); funciona como filtro na tela de Trabalhos. **Não** classifica nem ranqueia trabalhos em Resultado — isso é etapa futura, ainda não especificada (ver 8.4).
- Fluxo em quatro etapas na tela de Trabalhos da organização: Submissão (seleção em lote com checkbox, filtrável por área temática) → Avaliação (organização designa o avaliador em um modal) → Revisão (avaliador pediu ajuste; aluno abre um formulário próprio, vê o comentário do avaliador e corrige só título e resumo — área temática/orientador/colegas continuam os da submissão original — e reenvia, 2026-08-25) → Resultado (**lista simples** de trabalhos avaliados com sua nota — sem agrupamento nem ranking).
- Critérios de avaliação (novo em 2026-08-25, seguindo o edital do evento): o avaliador não dá mais uma nota única — pontua 5 critérios fixos (suficiência, coerência, estrutura do texto, clareza e precisão, aplicabilidade e relevância), 1 a 5 cada; a nota final exibida em Resultado/Relatórios é a **soma dos 5** (5 a 25), não mais uma escala de 1 a 5.
- Dois perfis administrativos: Admin (acesso total, todos os eventos, gestão de usuários) e Organização (mesmo tipo de acesso operacional, mas só nos seus eventos, sem gestão de usuários).
- Painel do aluno destaca o evento aberto em um banner (estilo home, efeito hover); menu "Eventos" lista todos (abertos + encerrados) com inscrição. Painel/Trabalhos do avaliador têm seletor de evento (só os seus, + "Todos os meus eventos"); menu "Eventos" do avaliador é somente leitura (evento + área temática).
- Convite de colega (novo em 2026-08-25): colega adicionado numa submissão não entra direto como participante confirmado — fica pendente até responder um card no Início ("Fulano te adicionou como colega em [trabalho]", botões Aceitar/Recusar). Recusar remove ele da lista de participantes; antes ou depois de aceitar, colega só visualiza o trabalho (nunca edita/corrige/reenvia — isso é exclusivo de quem submeteu).
- Notificações por e-mail (mapa confirmado em 2026-08-25, implementação represada até o plano Blaze — ver "Em aberto"): avaliador é avisado ao receber trabalho(s) pra avaliar; aluno é avisado quando pedem revisão, quando sai a nota e quando a organização confirma o aceite final; colega é avisado do convite de participação.
- **Projeto Integrador (nova vertente, 2026-08-25):** professor com conta Orientador (RF-54) cria turmas e convida alunos da Fatec por nome/e-mail — convite in-app, mesmo padrão de aceitar/recusar do convite de colega; recusar sai da turma. Dentro da turma tem um mural (só o orientador posta avisos/lembretes) e um pipeline de trabalho próprio, separado do fluxo de evento: aluno envia título+resumo, cai direto em "Aguardando avaliação" (não passa por seleção em lote — só tem um orientador por turma), o orientador aprova ou pede revisão com comentário (aluno corrige e reenvia, ciclo se repete até aprovar). Trabalho "Aprovado" fica disponível pro aluno inscrever manualmente num evento de sua escolha, com título/resumo pré-preenchidos na submissão normal — a decisão de qual evento (e se algum) é sempre do aluno, nada é automático.
- Organização pode marcar um evento como destaque (com imagem) para aparecer na tela inicial pública; no máximo um por vez, sem fallback genérico quando nenhum está marcado.
- Criação de evento (Admin, "Eventos"): nome, descrição, banner (upload de imagem, vira o `imagemDestaqueUrl` usado no destaque da home quando o evento é marcado assim), início/fim das inscrições e início/fim das avaliações — ampliado em 2026-08-25 (antes só tinha nome, período de submissão e fim da avaliação; banner só era prometido, não funcionava). Upload vai pro Firebase Storage (`storage.rules`, não publicado ainda — ver nota abaixo).
- Certificados emitidos em PDF com template institucional (layout oficial ainda pendente — ver `regras do app/requisitos.md` item 8.1).
- Relatórios viraram um dashboard analítico (gráficos de trabalhos por etapa e nota média por área temática, ver Evidence on Hand) com exportação em PDF — escopado por evento como as demais telas da organização.
- Navegação: todos os papéis (Aluno, Avaliador, Orientador, Organização, Admin) usam menu lateral (Sidebar) — unificado em 2026-08-25, antes Aluno/Avaliador usavam menu superior (TopNav, removido), mas esses papéis vão ganhar mais itens de menu com o tempo. Ordem do menu de Aluno: Início, **Projeto Integrador** (só aluno da Fatec — participante externo não vê), Eventos, Trabalhos, Certificações. Avaliador segue Início, Eventos, Trabalhos, Certificações. Orientador (novo) é enxuto: Início, Projeto Integrador.
- "Configurações" (modal aberto pela Sidebar) deixou de ser só troca de senha (2026-08-25): qualquer usuário logado também pode alterar o próprio nome de exibição — validado nas Security Rules pra só liberar o campo `nome`, nunca `papel`/`atribuicoesEventos`/`eventosPermitidos` (ver `firestore.rules`).
- Home pública: hero curto e direto ("Cadastre seu trabalho acadêmico"), sem tom de venda — a home existe para o aluno entrar e cadastrar o trabalho. Banner de evento em destaque com mais evidência (mais próximo do topo). Seção "Local" (endereço + mapa incorporado) após "Como funciona".
- Volumetria esperada: 100 a 500 trabalhos por evento.

**Em aberto / não inventar:** template visual oficial do certificado ainda não recebido (item 8.1/8.7 — bloqueia RF-21/RF-22 de verdade agora); mecânica exata do botão/ação de aceite final na aba Resultado ainda não definida (item 8.2); como/quando os melhores trabalhos são classificados/decididos depois da aba Resultado (item 8.4); sem serviço de e-mail configurado, senha de conta nova é mostrada na tela em vez de enviada por e-mail (item 8.8); **upload de banner de evento e notificações por e-mail não funcionam ainda (item 8.8/8.9, novo em 2026-08-25)** — projeto Firebase `fateclab-4cc74` está no plano Spark (gratuito); Cloud Storage for Firebase (banner) e a extensão "Trigger Email" (notificações, RNF-02) exigem o plano Blaze. `storage.rules` já está escrito no repo mas não publicado, e nenhum código grava em `mail/` ainda — o mapa de gatilhos já está confirmado (ver Capabilities and Constraints), só falta implementar. Usuário sabe e vai fazer o upgrade depois — não é bug a investigar se upload/e-mail falharem por enquanto; **Orientador alocado como avaliador de evento ainda não tem tela pra agir (item 8.10, novo em 2026-08-25)** — os dados/regras já suportam (mesmo mecanismo do avaliador), mas o Painel do Orientador só tem Início e Projeto Integrador, sem um `/orientador/trabalhos` equivalente ao do avaliador; evitar atribuir na prática até essa tela existir; **anexo/link no trabalho do Projeto Integrador (item 8.11) é pedido do usuário pro futuro, não implementado** — aluno vai poder anexar arquivo ou link, orientador vai poder baixar/abrir; formato exato (upload vs. link, tipos aceitos) não definido, não inventar sem confirmar.

## Brand Commitments

- Nome do produto: **SIGMA Fatec** — SIGMA de "Sistema de Gestão de Mostras Acadêmicas" (renomeado de FatecLab em 2026-08-25, decisão do usuário). Aparece como wordmark ao lado da logo institucional (lockup) na home e no login; no app autenticado (sidebar) só a logo institucional é usada.
- Instituição: **Fatec Ivaiporã** (Faculdade de Tecnologia, Vale do Ivaí, PR). Site institucional: https://fatecivaipora.com.br/.
- Logo oficial (versão branca, para fundo escuro): `../exemplos/logoFatec.png`.
- Paleta extraída do CSS do site oficial (não é a paleta genérica usada por outras skills de marketing deste usuário, que é só um placeholder de nicho): azul-marinho primário `#0e3a5e`, laranja de destaque `#ea741c`, azul claro de apoio `#2376b9`, branco `#fff`.
- Tipografia do site oficial: **Poppins** (pesos 100–900).
- Referência de layout para a tela interna (dashboard): screenshot de exemplo em `../exemplos/exemplo.png` (fintech genérico — sidebar + cards; usado como referência de estrutura/polimento, não de conteúdo ou cor).
- Estrutura de telas pedida pelo usuário: Home institucional com carrossel e botão "Entrar" → Login com opções de cadastro como Aluno ou Avaliador → tela interna do sistema (dashboard).
- **Paleta de gráficos (skill `dataviz`, validada em 2026-08-14 com `scripts/validate_palette.js`):** rampa ordinal azul (uma só cor, clara→escura) para as etapas do funil — `#7ab6e8` Em submissão, `#4a9bd4` Aguardando avaliação, `#2376b9` Revisão solicitada, `#164a72` Avaliado; par categórico validado para os desfechos — `#008300` Aceito, `#e34948` Recusado (CVD ΔE 7.2, aceitável só com rótulo direto sempre visível, que já usamos). Para "nota média por área temática": uma cor só (`#2376b9`), com a melhor área destacada em `#ea741c` (padrão de ênfase, não paleta categórica nova). Reutilizar esses hex exatos em qualquer gráfico novo em vez de re-derivar.

## Evidence on Hand

- `regras do app/regras_da_aplicação.md` — explicação original do fluxo (fonte: transcrição de reunião).
- `regras do app/requisitos.md` — especificação formal de requisitos (RF, RN, RNF, atores, casos de uso).
- `regras do app/arquitetura_tecnica.md` — decisões de stack e mapeamento RF → implementação.
- `../exemplos/exemplo.png` — referência visual de dashboard (estrutura, não marca).
- `../exemplos/logoFatec.png` — logo oficial (versão branca).
- `../exemplos/tela organizacao.png` — screenshot da tela da organização no DOIT: stepper Submissão → Avaliação → Revisão → Resultado → Apresentação → Publicação (usamos só Submissão/Avaliação/Resultado), filtros, checkbox de seleção em lote, dropdown "Selecione o avaliador" + botão "Enviar para avaliação".
- `../exemplos/exemplo de artigo.png` — screenshot da tela de detalhe de um artigo no DOIT (Nome, Área temática, Modalidade, Palavras-chave, Resumo, Orientador como texto, Materiais necessários, tabela de Autores) — referência de estrutura. Área temática já foi implementada (RF-08/RF-37); Modalidade e Materiais necessários ainda não foram pedidos pelo usuário — não inventar/adicionar sem confirmar.
- Nenhum depoimento, dado de uso real ou case de cliente existe ainda — não fabricar.

## Product Principles

1. Nenhuma regra de negócio sensível confia só no cliente (duplicidade, designação de avaliador, geração de certificado, escopo por evento sempre validados no backend).
2. A organização está no controle manual de quem avalia o quê (sem inscrição prévia do avaliador, sem designação automática) — reflete como a comissão de eventos realmente trabalha.
3. Organização e Admin têm o mesmo tipo de acesso operacional; a diferença é dupla: gestão de usuários (exclusiva do Admin) e escopo por evento (Organização só vê os seus eventos, Admin vê todos).
4. Simplicidade de MVP: sem SSO, sem agregações pré-computadas, dado o volume esperado (100–500 trabalhos/evento).

## Accessibility & Inclusion

Nenhum requisito específico de acessibilidade foi levantado com o usuário ainda; seguir práticas padrão de acessibilidade web (contraste, navegação por teclado, leitura por screen reader) como piso, sem compromisso adicional confirmado.
