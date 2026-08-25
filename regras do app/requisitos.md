# Documento de Requisitos — Sistema de Submissão de Trabalhos Acadêmicos

**Referências:** [`regras_da_aplicação.md`](./regras_da_aplicação.md) (fonte: transcrição da reunião inicial)

**Status:** Rascunho v20 — 2026-08-25. **Nova vertente: Projeto Integrador, com o papel Orientador.** Ver seção 2 (novo ator Orientador) e RF-54 a RF-59 abaixo. Resumo: professor com conta própria (papel "orientador", criada pelo Admin como avaliador/organização) cria **turmas**, convida alunos da Fatec por nome/e-mail (convite in-app, aceitar/recusar), publica avisos num mural da turma (só o orientador posta) e avalia os trabalhos que os alunos enviam ali — pipeline próprio (Aguardando avaliação → Revisão → Aprovados), independente do pipeline de evento. Um trabalho aprovado pelo orientador fica disponível pro aluno inscrever manualmente num evento (MAC/MOPI) de sua escolha, pré-preenchendo título/resumo na submissão normal. Orientador também pode ser alocado como avaliador de um evento (reaproveita o mecanismo de evento+área do RF-46) — nesse caso específico ainda não tem tela própria de avaliação, usa o mesmo mecanismo de dados do avaliador enquanto isso não é construído (ver pendência 8.10).

**Status:** Rascunho v19 — 2026-08-24. **Curso obrigatório para aluno da Fatec (RF-49 ampliado).** Além do RA, o cadastro agora exige selecionar o **curso** de uma lista fechada (`src/lib/cursos.ts` — Agronomia, Agronegócio, Arquitetura e Urbanismo, Biomedicina, Ciências Contábeis, Direito, Engenharia Civil, Enfermagem, Gestão Financeira, Gestão Comercial, Gestão de Recursos Humanos, Medicina Veterinária, Pedagogia, Psicologia, Fisioterapia — confirmada com o usuário). Só para `vinculoFatec == true`; participante externo não tem curso. Por ora é só um dado de identificação (aparece no cadastro e na lista de Usuários) — não influencia elegibilidade de evento nem nenhuma outra regra.

**Status:** Rascunho v18 — 2026-08-24. **RF-08 (colegas/participantes na submissão) implementado para valer.** Esse pedaço do RF-08 (busca de colegas entre contas de aluno) tinha ficado de fora da migração de mock pra Firebase real — a tela de submissão só tinha título/área/resumo/orientador. Agora tem um campo "Colegas (participantes)" que busca entre contas de aluno reais (Fatec ou externo) e adiciona à submissão; quem é adicionado passa a ver o trabalho na própria tela "Meus trabalhos" (só leitura — corrigir/reenviar continua exclusivo de quem submeteu). **RF-09 (verificação de duplicidade por título+participantes) continua NÃO implementado** — não foi pedido ainda, sinalizado como pendência 8.9 abaixo para não passar despercebido.

**Status:** Rascunho v17 — 2026-08-24. **Novo: participante externo (não-aluno da Fatec), com RA obrigatório para aluno Fatec e elegibilidade por evento.** No cadastro público, a pessoa informa se é aluno(a) da Fatec Ivaiporã; se sim, precisa informar o **RA** (validado — RN-17); se não, é registrada como participante externo, sem RA, só podendo se inscrever em eventos que a organização marcou como abertos a externos (RF-49/RN-18). Ambos os casos continuam sendo papel "aluno" na mesma coleção `usuarios`, distinguidos pelo campo `vinculoFatec` — decisão tomada para não duplicar auth/regras/telas entre dois tipos de conta que têm o mesmo fluxo (submeter trabalho, acompanhar avaliação). Ver `arquitetura_tecnica.md` v12 para os detalhes técnicos. Seguem válidas todas as regras de negócio anteriores (RF-01 a RF-48, RN-01 a RN-16) e o status v16 (sistema roda sobre Firebase real, sem dados fictícios).

---

## 1. Introdução

### 1.1 Objetivo
Especificar os requisitos funcionais e não funcionais de um sistema para gerenciar o ciclo completo de submissão, avaliação, aceite e certificação de trabalhos acadêmicos apresentados em eventos institucionais (inicialmente MAC e MOPI).

### 1.2 Escopo
O sistema deve suportar **múltiplos eventos configuráveis** (não apenas MAC e MOPI), cada um com seu próprio período de submissão e regras de aceite. A ferramenta **DOIT** foi citada como referência de modelo de fluxo a seguir — em especial a visão de processo em etapas (Submissão → Avaliação → Resultado) e a tela da organização com seleção em lote de trabalhos para envio a avaliadores.

### 1.3 Fora de escopo (por ora)
- Definição de stack tecnológica (já definida, ver `arquitetura_tecnica.md`).
- Integração/SSO com sistemas acadêmicos existentes da Fatec — decidido que a primeira versão terá **cadastro isolado** (ver seção 3).
- Aprovação do trabalho pelo orientador dentro do sistema — **removida em 2026-08-14**, acontece fora do sistema (ver seção 2 e RF-08).
- Etapas de Apresentação e Publicação do modelo DOIT — não fazem parte do escopo deste sistema. O sistema usa Submissão, Avaliação, **Revisão** e Resultado (a Revisão foi reincorporada na segunda rodada de 2026-08-14 — ver RF-14/RF-36).

---

## 2. Atores / Perfis de Usuário

| Ator | Descrição |
|---|---|
| **Aluno (autor/apresentador)** | Cria conta, submete trabalho informando o nome do orientador (texto livre). Acompanha o trabalho passar por Submissão → Avaliação → Resultado. No cadastro, informa se tem vínculo com a Fatec Ivaiporã (RF-49): se sim, precisa informar o **RA** (validado — RN-17) e não tem restrição de evento; se não (**participante externo**), só pode se inscrever em eventos marcados como abertos a externos (RN-18). |
| **Avaliador (professor)** | **Não se cadastra publicamente.** A conta é criada pela organização/admin (RF-27), que já define em qual **evento** e **área temática** ele atua (RF-46) — atribuições que podem crescer ao longo do tempo (mais eventos, editável). Só enxerga os eventos em que foi cadastrado (RN-15), com seletor de evento no Painel/Trabalhos (RF-47) e uma página "Eventos" somente leitura (RF-45). Recebe, no próprio menu, os trabalhos que a organização selecionou e enviou para ele; para cada um, vê título e resumo e decide entre atribuir uma **nota de 1 a 5** (segue direto para Resultado) ou **solicitar revisão** com um comentário (volta para o aluno). |
| **Organização (equipe administrativa do evento)** | Cadastra eventos e suas **áreas temáticas**, acompanha a tela de Trabalhos em quatro etapas (Submissão/Avaliação/Revisão/Resultado), seleciona trabalhos na Submissão e os envia para um avaliador escolhido (podendo filtrar por área temática), confirma aceite final, emite carta de aceite, gera certificados, cria contas de avaliador, acompanha dashboard/relatórios com gráficos. **Só enxerga os eventos em que foi explicitamente cadastrada** (RF-48/RN-15) — nunca os demais. Pode visualizar a lista de usuários, mas **não pode criar, excluir ou redefinir senha** de nenhum usuário. |
| **Admin** | Tem o mesmo tipo de permissão operacional da Organização, **mais** a gestão de usuários: criar, excluir e redefinir senha de qualquer conta (aluno, avaliador, organização, orientador ou outro admin). É o único perfil com acesso a essa gestão, e a única exceção ao escopo por evento — **vê e administra todos os eventos**, sem restrição (RN-15). |
| **Orientador** *(novo em 2026-08-25, RF-54)* | **Não se cadastra publicamente** — conta criada pelo Admin, igual avaliador/organização. Cria e administra **turmas** do Projeto Integrador: convida alunos da Fatec (nunca participante externo), publica avisos no mural da turma, e avalia os trabalhos que os alunos enviam ali (nota é aprovar ou pedir revisão com comentário — não usa os 5 critérios do edital do evento, RF-49 antigo/RF-14, porque não é o mesmo pipeline). Pode opcionalmente também receber atribuições de evento+área temática (mesmo mecanismo do avaliador, RF-46) pra ser escalado como avaliador de um evento. |

**Sobre o "orientador" como texto livre na submissão de evento (RF-08):** continua sendo só um campo de texto no formulário de submissão de um trabalho a um evento — não referencia nenhuma conta, nem a conta Orientador acima. São dois conceitos diferentes que só coincidem na vida real (o mesmo professor pode ser o "nome do orientador" digitado por um aluno E também ter uma conta Orientador administrando a turma dele) — o sistema não faz essa ligação automaticamente. A interação de aprovação/correção do trabalho de evento entre orientador (texto) e aluno continua acontecendo **fora do sistema**.

**Notas de interface (2026-08-14, terceira rodada):**
- A navegação de **Aluno** e **Avaliador** (poucos itens de menu) usa um **menu superior (TopNav)**, não o menu lateral usado por Organização/Admin — evita espaço vazio no menu lateral quando há poucas opções.
- A tela inicial pública foi reformulada: o texto de destaque (hero) foi encurtado — o objetivo da página é o aluno entrar e cadastrar o trabalho dele, não "vender" o sistema — e o banner de evento em destaque ganhou mais evidência (posicionado mais próximo do topo). Uma nova seção "Local" (endereço da Fatec Ivaiporã + mapa incorporado) foi adicionada após "Como funciona".

**Notas de interface (2026-08-14, quarta rodada):** ver RF-44 a RF-48 — Painel do aluno com banner de evento em destaque, novo item de menu "Eventos" para Aluno e Avaliador, seletor de evento escopado no Painel/Trabalhos do Avaliador.

~~**Notas de interface (2026-08-14, quinta rodada):** alternador "Ver como".~~ **Removido em 2026-08-17** junto com a migração para Firebase real — ver pendência 8.6 (encerrada) e status v16 no topo do documento.

---

## 3. Requisitos Funcionais (RF)

### Cadastro e autenticação
- **RF-01** — O sistema deve permitir que o aluno crie conta própria informando dados pessoais básicos. **Não existe cadastro público de avaliador** — contas de avaliador são criadas exclusivamente pela organização/admin, pela tela de Usuários (RF-27).
- **RF-02** — Ao concluir o cadastro, o sistema deve enviar um e-mail de confirmação de conta.
- **RF-03** — O sistema deve permitir redefinição de senha via e-mail.
- **RF-04** — A autenticação é isolada (login/senha próprios do sistema); não há integração com SSO institucional na primeira versão.
- **RF-49** — *(Novo em 2026-08-24, ampliado no mesmo dia.)* O cadastro público de aluno deve perguntar se a pessoa é aluno(a) da Fatec Ivaiporã. Se sim, o formulário exige o **RA** (validado conforme RN-17) e o **curso**, selecionado de uma lista fechada (RN-19). Se não, a conta é registrada como **participante externo** (sem RA nem curso), com a inscrição em eventos restrita conforme RN-18.

### Gestão de eventos (multi-evento)
- **RF-05** — A organização deve poder cadastrar novos eventos, cada um com nome, período de submissão e período de avaliação próprios. *(Detalhado em 2026-08-25: o formulário de criação também pede descrição do evento e o banner (imagem de destaque, RF-29) já na criação, não só depois; período de avaliação agora tem início E fim, como o de submissão — antes só tinha fim.)*
- **RF-06** — Um trabalho submetido deve estar sempre vinculado a um evento específico.
- **RF-07** — *(Corrigido em 2026-08-14, quarta rodada.)* Um usuário Organização só administra os eventos em que foi explicitamente cadastrado (RF-48) — **não** existe mais acesso automático a todos os eventos entre membros da organização. Admin continua vendo/administrando todos os eventos, sem essa restrição (RN-15).
- **RF-29** — A organização deve poder marcar **um evento como destaque** e associar uma **imagem** a ele. Esse evento aparece em uma seção de destaque na tela inicial pública enquanto estiver marcado e com o período de submissão aberto.
- **RF-50** — *(Novo em 2026-08-24.)* A organização/admin deve poder marcar, por evento, se ele **aceita participantes externos** (não-alunos da Fatec). Só eventos marcados assim aparecem para inscrição de participantes externos (RN-18); alunos da Fatec continuam vendo todos os eventos, sem essa restrição.

### Submissão de trabalho
- **RF-08** — O aluno deve poder submeter um trabalho informando: título, **área temática** (obrigatória, selecionada de uma lista definida pela organização para aquele evento — RF-37), palavras-chave, resumo (**máximo de 2.000 caracteres**), **nome do orientador** (texto livre, obrigatório — não é uma conta do sistema, ver RN-03a) e demais participantes (opcional, busca apenas entre contas de aluno — o próprio aluno que submete já entra automaticamente como o primeiro participante).
- **RF-09** — Antes de aceitar a submissão, o sistema deve verificar se já existe um trabalho enviado com o **mesmo título e mesmos participantes** (texto livre) dentro do mesmo evento. Caso exista, a submissão deve ser bloqueada com mensagem informando que o trabalho já foi enviado por outro integrante.
- **RF-52** — *(Novo em 2026-08-25.)* Um colega adicionado numa submissão (RF-08) entra como **convite pendente**, não direto como participante confirmado. No Início dele aparece um card do convite (quem chamou, título do trabalho, orientador) com botões **Aceitar**/**Recusar**: aceitar só confirma a participação; recusar remove o colega da lista de participantes do trabalho (deixa de aparecer pra ele e pro autor). Antes ou depois de responder, o colega só **vê** o trabalho (título, resumo, orientador, status) — nunca edita, corrige nem reenvia; isso continua exclusivo de quem fez a submissão original (RF-36).
- **RF-37** — A organização deve poder criar, listar e remover **áreas temáticas** para cada evento (ex.: "Engenharias", "Ciências Sociais Aplicadas"). Só essas áreas ficam disponíveis para o aluno escolher na submissão daquele evento (RF-08).
- **RF-43** — A gestão de áreas temáticas deve ter uma **página própria com item de menu dedicado** ("Áreas temáticas", visível para Organização/Admin), listando todos os eventos e suas áreas com opção de adicionar/remover — não apenas um modal auxiliar dentro da tela de Eventos.

### ~~Aprovação do orientador~~ — Removida em 2026-08-14
~~RF-10, RF-11, RF-12~~ existiam para a aprovação/correção do orientador dentro do sistema. **Removidos por decisão da comissão de eventos**: essa interação acontece fora do sistema, diretamente entre orientador e aluno. O sistema só registra o nome do orientador (RF-08).

### Fluxo Submissão → Avaliação → Revisão → Resultado
- **RF-32** — Todo trabalho recém-submetido aparece na aba **Submissão** da tela de Trabalhos da organização, com uma caixa de seleção (checkbox) por trabalho.
- **RF-33** — A organização deve poder selecionar um ou mais trabalhos na aba Submissão e enviá-los para avaliação de uma vez, escolhendo o(s) avaliador(es) responsável(is) em uma janela (modal). A lista de trabalhos (e o próprio envio) pode ser filtrada por **área temática** (RF-38), além do evento e de busca por título/aluno. *(Ampliado em 2026-08-25 — ver RF-51: quando a seleção é de uma única área com mais de um avaliador cadastrado pra ela, o envio pode dividir os trabalhos entre eles em vez de mandar tudo pra um só.)*
- **RF-51** — *(Novo em 2026-08-25.)* Quando todos os trabalhos selecionados pra envio são do mesmo evento e da mesma área temática, e existe mais de um avaliador cadastrado pra essa área nesse evento (RF-46), o modal de envio sugere uma **divisão automática** — trabalhos repartidos o mais igual possível entre os avaliadores dessa área (ex.: 10 trabalhos / 3 avaliadores → 4/3/3). A organização pode **ajustar manualmente** quantos cada avaliador recebe (inclusive escolher quem fica com a sobra, em vez de deixar no padrão) antes de confirmar; o envio só é liberado quando a soma bate com o total selecionado. Fora desse caso (áreas/eventos misturados, ou nenhum avaliador cadastrado pra área), o envio cai no modo manual anterior — escolher **um único avaliador** pra todos os trabalhos selecionados.
- **RF-38** — A tela de Trabalhos da organização deve ter um filtro por área temática (dependente do evento selecionado), disponível em todas as etapas.
- **RF-13** — Cada envio para avaliação (RF-33) designa avaliador(es) dentre as contas já cadastradas (RF-01/RF-27) — um único avaliador pra todos os trabalhos do envio no modo manual, ou vários (um por trabalho) quando a divisão automática por área é usada (RF-51).
- **RF-34** — Ao serem enviados, os trabalhos passam para a aba **Avaliação** — tanto na tela da organização (acompanhamento) quanto no menu do avaliador designado (ação pendente).
- **RF-14** — No menu do avaliador, cada trabalho mostra **título e resumo**; o avaliador decide entre duas ações: atribuir uma nota (o trabalho segue direto para a aba **Resultado**, status "Avaliado") ou **solicitar revisão**, com um comentário obrigatório explicando o que precisa ser ajustado (o trabalho vai para a aba **Revisão**). Não há parecer de aceite/recusa nem prazo de correção nesta etapa — só nota ou revisão. *(Critério de nota detalhado em 2026-08-25 — ver RF-53.)*
- **RF-36** — Um trabalho em Revisão deve poder ser corrigido e reenviado pelo aluno; ao reenviar, o trabalho volta para a aba **Avaliação**, designado ao mesmo avaliador, para uma nova decisão (nota ou nova revisão). *(Detalhado em 2026-08-25: antes o reenvio só trocava o status, sem deixar o aluno editar nada — agora abre um formulário mostrando o comentário do avaliador e permite corrigir **título** e **resumo**; área temática, orientador e colegas permanecem os da submissão original, não são editáveis nessa tela.)*
- **RF-53** — *(Novo em 2026-08-25. Renumerado de "RF-49" no mesmo dia — colidia com o RF-49 de curso/RA obrigatório, seção Cadastro.)* A nota do avaliador segue os critérios do edital do evento (item 6.1): **suficiência, coerência, estrutura do texto, clareza e precisão, aplicabilidade e relevância**. Cada critério recebe uma nota de 1 a 5 (item 6.2); a nota final do trabalho (usada pra ranquear os mais bem pontuados, RF-25/relatórios) é a **soma dos cinco critérios** (5 a 25) — não uma nota única.
- **RF-35** — Ao receber a nota, o trabalho passa para a aba **Resultado**, tanto na tela da organização (que lista a nota de cada trabalho) quanto no status do trabalho, que passa a ser **"Avaliado"**.
- **RF-41** — *(Corrigido em 2026-08-14, terceira rodada.)* A aba Resultado deve exibir uma **lista simples de todos os trabalhos avaliados**, com a mesma tabela usada nas demais etapas mais uma coluna de **Nota** — **sem agrupar por área temática, sem ordenar por nota e sem destacar/ranquear** nenhum trabalho. Ainda há etapas futuras entre "ver os avaliados" e "decidir quem venceu"; essa decisão de classificação **não está especificada nem implementada** (ver pendência 8.4). A versão anterior desta regra (agrupamento por área + destaque do maior nota) estava **incorreta** e foi revertida.

### Projeto Integrador *(nova vertente, 2026-08-25)*
Foco nas disciplinas de Projeto Integrador cujos trabalhos costumam participar dos eventos (MAC/MOPI). Um professor concentra os trabalhos que orienta numa **turma**, dentro do próprio sistema, com um pipeline de acompanhamento próprio — separado do pipeline de evento (Submissão/Avaliação/Revisão/Resultado da seção anterior).

- **RF-54** — O Admin deve poder criar uma conta com o novo papel **Orientador** (mesma tela de Usuários, mesmo fluxo de senha temporária dos demais papéis não-autocadastráveis). Opcionalmente, na criação ou depois editando, pode também atribuir evento(s) e área(s) temática(s) a essa conta — mesmo mecanismo do avaliador (RF-46) — o que a torna elegível a ser escolhida como avaliador de um evento (RF-58).
- **RF-55** — Como Orientador, a pessoa deve poder criar **turmas** (nome + disciplina opcional) e, dentro de cada turma, convidar **alunos da Fatec** (nunca participante externo — RN-20) buscando por nome ou e-mail. O convite aparece pro aluno como um card com **Aceitar**/**Recusar** — mesmo padrão do convite de colega em um trabalho (RF-52). Recusar remove o aluno da turma; aceitar confirma a participação.
- **RF-56** — Dentro de uma turma, o Orientador deve poder publicar avisos/lembretes num **mural** — só ele posta, os alunos só leem.
- **RF-57** — Dentro de uma turma, o aluno membro envia um trabalho (título + resumo) diretamente ao Orientador — não passa por uma etapa de "Submissão" com envio manual em lote como no fluxo de evento (RF-33), já que a turma tem um único responsável por avaliar. O Orientador abre o trabalho, vê o resumo, e decide: **Aprovado** (vai para a etapa final Aprovados) ou **pedir revisão** com um comentário obrigatório (volta pro aluno, que corrige título/resumo e reenvia — mesmo padrão do RF-36). O ciclo Avaliação ↔ Revisão se repete até o Orientador aprovar.
- **RF-58** — Um trabalho de turma **Aprovado** fica disponível pro aluno **inscrever manualmente num evento** de sua escolha (RF-08) — a inscrição usa a tela normal de submissão, com **título e resumo pré-preenchidos** a partir do trabalho aprovado; área temática, orientador (texto) e colegas continuam sendo preenchidos na hora, como em qualquer submissão. O Projeto Integrador não inscreve automaticamente em evento nenhum — a decisão de qual evento (e se algum) é sempre do aluno.
- **RF-59** — *(Reaproveita RF-46.)* Um Orientador pode ser alocado como avaliador de um evento — mesmo mecanismo de atribuição de evento+área do avaliador (RF-54). *(Pendência 8.10: ainda não existe uma tela própria no Painel do Orientador pra ele efetivamente avaliar esses trabalhos — os dados já suportam, falta a interface.)*

### ~~Avaliação por inscrição do avaliador~~ / ~~Papel duplo orientador~~ — Removidos em 2026-08-14
~~RF-30~~ (avaliador se inscrever por evento) e ~~RF-31~~ (aba "Sou orientador" na tela do avaliador) deixaram de existir: como o orientador não era uma conta do sistema (seção 2, **até a reintrodução do papel Orientador em 2026-08-25 pro Projeto Integrador acima — conceito diferente, não é o mesmo "papel duplo" removido aqui**), e a organização agora designa o avaliador diretamente por envio (RF-33), não há mais inscrição prévia nem visão dupla no menu do avaliador.

### ~~Correção~~ — Removida em 2026-08-14
~~RF-16, RF-17, RF-18~~ existiam para a rodada de correção com prazo após o parecer do avaliador. **Removidos**: não há mais opção de correção nem prazo de correção no sistema — qualquer ajuste é feito fora dele.

### Aceite final
- **RF-19** — A organização deve confirmar o aceite final dos trabalhos avaliados (aba Resultado). *(Ver pendência 8.2 sobre como essa confirmação é acionada na tela.)*
- **RF-20** — Ao confirmar o aceite final, o sistema deve gerar/emitir a carta de aceite para o aluno.

### Certificação
- **RF-21** — O sistema deve emitir certificados em **PDF**, seguindo **template institucional da Fatec**, para alunos/apresentadores de trabalhos aceitos.
- **RF-22** — O sistema deve emitir certificados em **PDF**, seguindo o mesmo template institucional, para professores participantes como avaliadores.

### Dashboard e relatórios
- **RF-23** — A organização deve ter acesso a um **dashboard administrativo** (Painel) com visão consolidada dos trabalhos **do evento selecionado** (quantidade por etapa: submissão, aguardando avaliação, avaliado, aceito, recusado). Um seletor de evento no próprio painel troca o escopo dos dados exibidos.
- **RF-24** — Removida a listagem por abas de texto (Participantes/Envios/Aceitos/Recusados); ver RF-42.
- **RF-25** — Qualquer relatório visualizado deve poder ser **exportado em PDF**.
- **RF-42** — A tela de Relatórios deve ser um **dashboard com gráficos**, com seletor de evento no topo — para Organização, o seletor lista só os eventos em que ela foi cadastrada mais uma opção agregada "Todos os meus eventos" (RN-15); para Admin, lista todos os eventos do sistema — mostrando no mínimo: total de submissões, total de aceitos, total de recusados, taxa de aceite, um gráfico de trabalhos por etapa (Submissão/Avaliação/Revisão/Avaliado/Aceito/Recusado) e um gráfico de **nota média por área temática**, com a melhor área em destaque.

### Painéis de Aluno e Avaliador, e menu Eventos (novo em 2026-08-14, quarta rodada)
- **RF-44** — O Painel do aluno deve destacar o evento aberto para inscrição em um **banner** (mesmo estilo do banner de destaque da home, com efeito visual ao passar o mouse), em vez da grade genérica de cards da versão anterior. Se houver mais de um evento aberto, o Painel mostra só o principal e aponta para a página Eventos para ver os demais.
- **RF-45** — Aluno e Avaliador devem ter um item de menu **"Eventos"**: para o aluno, lista todos os eventos (abertos, com botão de inscrever trabalho, e encerrados, com selo "Encerrado", sem ação); para o avaliador, lista somente os eventos em que ele foi cadastrado (RF-46), mostrando a área temática atribuída em cada um — tela **somente leitura**, já que o avaliador não se autocadastra em eventos.
- **RF-46** — Ao criar uma conta de Avaliador (RF-27), a organização/admin deve definir o **evento** e a(s) **área(s) temática(s)** em que esse avaliador vai atuar. Um avaliador pode acumular atribuições de **múltiplos eventos ao longo do tempo** (cada uma com seu próprio conjunto de áreas, não necessariamente o mesmo) — a tela de Usuários deve permitir **editar** um avaliador existente para adicionar um novo evento (com suas áreas) ou remover uma atribuição existente. *(Detalhado em 2026-08-25: uma atribuição evento+avaliador agora aceita **mais de uma área temática marcada** — antes era só uma; usado pelo envio em lote, RF-33, pra achar todos os avaliadores aptos pra uma área.)*
- **RF-47** — O Painel e a tela de Trabalhos do avaliador devem ter um seletor de evento, listando só os eventos em que ele foi cadastrado (RF-46) mais uma opção agregada "Todos os meus eventos"; os indicadores (aguardando nota / avaliados) e a lista de trabalhos respeitam o evento selecionado.

### Gestão de usuários
- **RF-26** — Organização e Admin podem visualizar a lista de usuários cadastrados (todos os perfis).
- **RF-27** — Apenas Admin pode criar uma nova conta de usuário (aluno, avaliador, **organização** ou admin — RN-14), excluir uma conta existente ou redefinir a senha de qualquer usuário.
- **RF-28** — A interface deve ocultar ou desabilitar as ações de criar/excluir/redefinir senha para usuários com perfil Organização (não é suficiente bloquear só no backend — a ação nem deve ser oferecida na tela).
- **RF-48** — *(Novo em 2026-08-14, quarta rodada.)* Ao criar uma conta de Organização (RF-27), o Admin deve definir em qual **evento** ela atua. Assim como o avaliador (RF-46), uma organização pode acumular atribuições de **múltiplos eventos ao longo do tempo**, editáveis depois da criação (adicionar/remover evento). Essa conta só enxerga trabalhos, relatórios e áreas temáticas dos eventos em que está cadastrada (RN-15).

---

## 4. Regras de Negócio (RN)

- **RN-01** — Um trabalho pertence a exatamente um evento.
- **RN-02** — Um trabalho não pode ser submetido duas vezes com o mesmo título e mesmos participantes dentro do mesmo evento.
- **RN-03a** — Todo trabalho deve ter o **nome do orientador** preenchido no momento da submissão; é um campo de texto obrigatório, não uma conta do sistema (RF-08).
- **RN-06** — Um trabalho só recebe carta de aceite após confirmação da organização, mesmo que o avaliador já tenha dado a nota (status "Avaliado").
- **RN-07** — Certificados só são emitidos para trabalhos com aceite final confirmado pela organização.
- **RN-08** — *(Ajustado em 2026-08-14, quarta rodada.)* Organização e Admin têm o mesmo tipo de permissão operacional (eventos, trabalhos, aceite, certificados, relatórios), mas **não o mesmo alcance**: Organização só opera dentro dos eventos em que foi cadastrada (RN-15), enquanto Admin opera em todos os eventos, sem escopo. A gestão de usuários continua exclusiva do Admin (RN-09).
- **RN-09** — Criar, excluir ou redefinir senha de qualquer usuário é uma ação exclusiva do perfil Admin — isso inclui criar contas de avaliador, já que não há cadastro público para esse perfil (RN-13).
- **RN-10** — No máximo um evento é exibido em destaque na tela inicial por vez — o marcado manualmente pela organização, nunca escolhido automaticamente pelo sistema.
- **RN-11** — Se nenhum evento estiver marcado como destaque, ou o marcado não tiver imagem, ou seu período de submissão não estiver aberto, a seção de destaque não aparece na tela inicial (nenhum placeholder genérico é exibido).
- **RN-13** — Um avaliador só recebe um trabalho quando a organização o seleciona explicitamente em um envio (RF-33); não existe inscrição prévia do avaliador em eventos, nem designação automática.
- **RN-14** — *(Revertido em 2026-08-14, terceira rodada.)* A tela de criação de usuário (RF-27) oferece os perfis aluno, avaliador, **organização** e admin. A remoção do perfil "Organização" dessa tela, feita na rodada anterior do mesmo dia, foi um engano de escopo e foi desfeita — não havia pendência real que justificasse a remoção (ver antiga pendência 8.3).
- **RN-15** — *(Novo em 2026-08-14, quarta rodada.)* Contas Organização e Avaliador são **escopadas por evento**: o sistema nunca exibe trabalhos, eventos, áreas temáticas ou relatórios de um evento ao qual a conta não está associada (RF-46/RF-47/RF-48). **Admin é a única exceção** — sempre vê e administra todos os eventos do sistema, sem escopo, confirmado explicitamente com o usuário para preservar o uso de contas Admin em testes completos.
- **RN-16** — *(Novo em 2026-08-14, quarta rodada; ampliado em 2026-08-25.)* Um avaliador pode estar associado a múltiplos eventos ao longo do tempo, cada atribuição com seu próprio conjunto de áreas temáticas (uma ou mais) — não existe uma única "área temática do avaliador" global, é sempre por par evento+áreas (RF-46).
- **RN-17** — *(Novo em 2026-08-24.)* O RA informado no cadastro (RF-49) deve ter exatamente 10 dígitos: os 4 primeiros são o **ano de ingresso**, seguidos de 6 números. O ano de ingresso não pode ser maior que o ano atual, nem anterior a **(ano atual − 5)** — os cursos de duração mais longa da Fatec Ivaiporã têm 5 anos, então um RA mais antigo que isso é inválido. Exemplo: em 2026, só são aceitos RAs com ano entre 2021 e 2026.
- **RN-18** — *(Novo em 2026-08-24.)* Um participante externo (RF-49, `vinculoFatec == false`) só pode submeter trabalho em eventos marcados com `aceitaExternos == true` (RF-50). Essa restrição é validada no servidor (Firestore Security Rules), não só escondendo a opção na interface — segue o Princípio de Produto 1 (nenhuma regra sensível confia só no cliente). Aluno com vínculo Fatec não tem essa restrição.
- **RN-19** — *(Novo em 2026-08-24.)* Aluno com vínculo Fatec (`vinculoFatec == true`) deve selecionar o **curso** no cadastro, de uma lista fechada mantida em `src/lib/cursos.ts` (não é texto livre). Participante externo não preenche esse campo. Por ora é só um dado de identificação — não restringe nada (ex.: não filtra evento por curso).
- **RN-20** — *(Novo em 2026-08-25.)* Só aluno com vínculo Fatec (`vinculoFatec != false`) participa do Projeto Integrador: vê o item de menu, recebe convite de turma, envia trabalho. Participante externo não tem essa vertente — validado nas Security Rules (busca de aluno pro convite já filtra por `vinculoFatec`) e escondido da UI (item de menu não aparece).

~~RN-03~~, ~~RN-04~~, ~~RN-05~~ e ~~RN-12~~ existiam para o gate de aprovação do orientador e para a rodada de correção com prazo — **removidas em 2026-08-14** junto com as etapas correspondentes (ver seção 3).

---

## 5. Requisitos Não Funcionais (RNF)

- **RNF-01** — O sistema deve tratar dados pessoais de alunos e professores em conformidade com a LGPD (política de retenção e acesso a detalhar em etapa de design).
- **RNF-02** — Comunicações por e-mail devem ser confiáveis e rastreáveis. *(Mapa de gatilhos confirmado em 2026-08-25 — nenhum implementado ainda, ver item 8.8):* confirmação de cadastro (RF-02); redefinição de senha (RF-03); **avaliador** notificado quando a organização envia trabalho(s) pra ele avaliar (RF-33/RF-51); **aluno** notificado quando o avaliador pede revisão (RF-14, com o comentário), quando o avaliador dá a nota (status "avaliado") e quando a organização confirma o aceite final (RF-19) — esse último é o resultado que conta de verdade pro aluno; **colega** notificado quando é adicionado como participante de um trabalho, com convite pra aceitar ou recusar (RF-52).
- **RNF-03** — Certificados e relatórios exportados devem ser gerados em **PDF**.
- **RNF-04** — O sistema deve suportar de forma performática o volume esperado de **100 a 500 trabalhos por evento**, considerando múltiplos eventos simultâneos.
- **RNF-05** — O dashboard administrativo deve refletir o status dos trabalhos de forma próxima ao tempo real (sem necessidade de geração manual de relatório para visualização básica).

---

## 6. Casos de Uso Principais (resumo)

1. **Cadastrar áreas temáticas do evento** (Organização) → antes do período de submissão, define as áreas disponíveis para aquele evento.
2. **Submeter trabalho** (Aluno) → escolhe a área temática → validação de duplicidade → aparece na aba **Submissão** da organização.
3. **Selecionar e enviar para avaliação** (Organização) → filtra por evento/área temática na aba Submissão → marca um ou mais trabalhos → escolhe o avaliador em um modal → trabalhos passam para a aba **Avaliação**.
4. **Avaliar trabalho** (Avaliador) → vê título e resumo do trabalho designado → atribui nota nos 5 critérios do edital, 1 a 5 cada (RF-53; trabalho vai para **Resultado** com a soma) ou solicita revisão com comentário (trabalho vai para **Revisão**).
5. **Corrigir e reenviar** (Aluno) → trabalho em Revisão → edita título e resumo (vê o comentário do avaliador) → reenvia → volta para a aba **Avaliação**, mesmo avaliador.
6. **Ver todos os trabalhos avaliados** (Organização) → na aba Resultado, lista simples de trabalhos com nota (sem agrupamento nem ranking — ver pendência 8.4).
7. **Confirmar aceite final** (Organização) → a partir da aba Resultado → gera carta de aceite.
8. **Emitir certificados** (Organização) → PDF com template institucional, após encerramento do evento.
9. **Acompanhar dashboard de relatórios** (Organização/Admin) → seleciona o evento (Organização só entre os seus, Admin entre todos), vê gráficos (submissões, aceitos, recusados, nota média por área temática) e exporta em PDF.
10. **Gerenciar usuários** (Admin) → criar (aluno, avaliador, organização ou admin) já definindo evento/área temática quando aplicável (RF-46/RF-48), excluir ou redefinir senha de qualquer conta; Organização só visualiza a lista, sem essas ações disponíveis na tela.
11. **Editar atribuições de evento** (Admin, novo em 2026-08-14) → em Usuários, edita um Avaliador ou Organização existente para adicionar um novo evento (com área temática, se avaliador) ou remover uma atribuição — cobre o caso de alguém que passa a participar de um evento novo mais tarde.
12. **Ver evento em destaque e inscrever-se** (Aluno, novo em 2026-08-14) → no Painel, vê o evento aberto em um banner destacado; na página Eventos, vê todos os eventos (abertos e encerrados) e se inscreve nos abertos.
13. **Consultar meus eventos** (Avaliador, novo em 2026-08-14) → seleciona o evento no Painel/Trabalhos (só entre os seus) ou consulta a página Eventos para ver sua área temática em cada um.

---

## 7. Glossário

- **MAC / MOPI** — Eventos/mostras acadêmicas da Fatec (primeiros eventos a usar o sistema).
- **DOIT** — Ferramenta citada como referência de fluxo similar; inspirou o modelo de etapas Submissão → Avaliação → Resultado e a tela de seleção em lote da organização.
- **Orientador** — Não é uma conta do sistema. É o nome (texto livre) do professor orientador do trabalho, informado pelo aluno na submissão (RF-08). A aprovação entre orientador e aluno acontece fora do sistema.
- **Carta de aceite** — Documento formal confirmando que o trabalho foi aceito no evento.
- **Organização** — Perfil administrativo do evento (eventos, trabalhos, aceite, certificados, relatórios), sem acesso à gestão de usuários. **Escopado por evento** (RN-15): só vê os eventos em que foi cadastrada (RF-48).
- **Admin** — Mesmo tipo de permissão da Organização, mais gestão exclusiva de usuários (criar, excluir, redefinir senha) — incluindo contas de avaliador e organização. **Não é escopado por evento** — vê todos (RN-15).
- **Área temática** — Categoria de um trabalho (ex.: "Engenharias"), definida pela organização por evento numa página dedicada (RF-37/RF-43), obrigatória na submissão (RF-08) e usada como filtro (RF-38). **Não** classifica nem ranqueia trabalhos em Resultado — isso é uma etapa futura (RF-41, pendência 8.4).
- **RA (Registro Acadêmico)** — Identificador do aluno matriculado na Fatec, informado no cadastro (RF-49). Formato: ano de ingresso (4 dígitos) + 6 números, validado conforme RN-17.
- **Participante externo** — Pessoa sem vínculo com a Fatec Ivaiporã que se cadastra no sistema (RF-49). Mesmo papel "aluno", sem RA, restrito a eventos que aceitam externos (RN-18).

---

## 8. Pendências / Questões em aberto

1. **8.1 — Template do certificado.** Precisa do layout oficial (logo, cores, textos institucionais) da Fatec para o PDF do certificado de aluno e do certificado de avaliador. Pendência de design/conteúdo visual, não bloqueia a definição de stack.

2. **8.2 — Confirmação de aceite final (RF-19), em aberto desde 2026-08-14.** Com o fluxo agora terminando na aba Resultado (lista de trabalhos com nota), falta definir a ação exata de aceite final: é um botão "Confirmar aceite" por trabalho na aba Resultado? Uma ação em lote (como o envio para avaliação)? Ou automática acima de uma nota mínima? Enquanto isso, a aba Resultado do protótipo só exibe a nota de cada trabalho, sem ação de aceite ainda.

4. ~~**8.3 — Criação de conta Organização.**~~ **Resolvida/revertida em 2026-08-14 (terceira rodada):** "Organização" voltou a ser uma opção normal no formulário de criação de usuário (RF-27/RN-14) — a remoção na rodada anterior foi um engano, não havia necessidade real de escondê-la.

5. **8.4 — Classificação/decisão dos vencedores em Resultado, nova em 2026-08-14 (terceira rodada).** A aba Resultado hoje só lista trabalhos avaliados com sua nota (RF-41, corrigido). O usuário confirmou que existem **mais etapas depois** disso até decidir os vencedores, mas ainda não descreveu quais são nem como a UI deve funcionar. Não inventar — perguntar antes de implementar qualquer forma de ranking/premiação.

3. ~~**8.2 — Gatilho do aceite final (versão anterior).**~~ Superada pela mudança de fluxo de 2026-08-14 — ver novo item 8.2 acima.

6. **8.5 — Atribuições evento/área do protótipo são ilustrativas, nova em 2026-08-14 (quarta rodada).** No protótipo (sem backend real), Ana Carolina (Organização) foi atribuída a MAC 2026 + MOPI 2026 (não MAC 2025) e Prof. Renato Alves (Avaliador) a MAC 2026 + MAC 2025, só para demonstrar visualmente a restrição por evento (RN-15) funcionando. Não são atribuições reais confirmadas pelo usuário — ajustar quando o cadastro de contas passar a ser real.

7. ~~**8.6 — Alternador "Ver como" é um recurso só do protótipo.**~~ **Encerrada em 2026-08-17** — removido; a persona vem da sessão real do Firebase Auth em todas as telas.
8. **8.7 — Template do certificado ainda não recebido (reforço da 8.1), atualizado em 2026-08-17.** Com o sistema já rodando sobre dados reais, esta pendência passa a bloquear de fato a emissão de certificados (RF-21/RF-22) — antes era só teórica.
9. **8.8 — Sem serviço de e-mail configurado, nova em 2026-08-17.** A extensão Firebase "Trigger Email" não foi instalada — depende do plano Blaze (Cloud Storage for Firebase também depende, mesma barreira — ver PRODUCT.md), que o projeto ainda não tem. Contas criadas pela tela de Usuários recebem uma senha temporária exibida na tela (não por e-mail) — o Admin precisa repassar manualmente por enquanto. O mapa completo de notificações por e-mail (RNF-02) está confirmado desde 2026-08-25, só falta implementar quando o Blaze estiver ativo: gravar em `mail/{autoId}` a cada gatilho, a extensão cuida do envio.
10. **8.9 — Verificação de duplicidade (RF-09) não implementada, nova em 2026-08-24.** A submissão não bloqueia um trabalho com mesmo título + mesmos participantes já existente no mesmo evento — RF-09 nunca foi codificado desde a migração para dados reais. Notado ao implementar a busca de colegas (RF-08); implementar se/quando pedido.
11. **8.10 — Orientador-como-avaliador sem tela própria, nova em 2026-08-25.** RF-59: um Orientador pode receber atribuição de evento+área e ser escolhido no envio em lote (RF-33/RF-51) igual a um avaliador — os dados e as Security Rules já suportam isso. Mas o Painel do Orientador (`/orientador`) só tem os itens Início e Projeto Integrador; não existe ainda uma tela tipo `/avaliador/trabalhos` pro Orientador efetivamente ver e avaliar os trabalhos que lhe foram designados num evento. Enquanto isso não é construído, evitar atribuir um Orientador como avaliador de evento na prática (ele não teria como agir), mesmo que a organização consiga selecioná-lo na tela de envio.
12. **8.11 — Anexo/link no trabalho do Projeto Integrador, sinalizado pelo usuário em 2026-08-25 para o futuro.** Hoje `turmaTrabalhos` só tem título e resumo (texto). O usuário quer que o aluno possa futuramente anexar um arquivo ou colar um link no trabalho enviado à turma, e que o orientador consiga baixar o arquivo ou abrir o link na tela de avaliação. **Não implementado ainda** — não inventar mecanismo (upload direto vs. só link, tipos de arquivo aceitos, tamanho máximo) sem confirmar com o usuário quando for a hora de construir. Upload de arquivo, se for esse o caminho, esbarra na mesma pendência do Storage (plano Blaze, ver item 8.9 do `PRODUCT.md`).

---

## 9. Aprovação

- [x] Revisado pelo solicitante
- [x] Mudança de fluxo (Submissão → Avaliação → Resultado) validada com a comissão de eventos em 2026-08-14
- [ ] Pendência de design visual (certificado — item 8.1) resolvida
- [ ] Pendência de UI do aceite final (item 8.2) resolvida
- [x] Pronto para definição de stack técnica (já definida, ver `arquitetura_tecnica.md`)
