# Documento de Requisitos — Sistema de Submissão de Trabalhos Acadêmicos

**Referências:** [`regras_da_aplicação.md`](./regras_da_aplicação.md) (fonte: transcrição da reunião inicial)

**Status:** Rascunho v10 — RF-01 explicitado em 2026-08-13: o papel da conta é definido pelo formulário de cadastro usado (aluno ou avaliador) e não muda depois; conta avaliador já carrega a capacidade de ser orientador. Fluxo completo fechado: aluno submete → orientador decide → avaliador designado dá nota (1 a 5, status "Avaliado") → organização confirma aceite final. Resta apenas a pendência de design visual do certificado (item 8.1).

---

## 1. Introdução

### 1.1 Objetivo
Especificar os requisitos funcionais e não funcionais de um sistema para gerenciar o ciclo completo de submissão, avaliação, aceite e certificação de trabalhos acadêmicos apresentados em eventos institucionais (inicialmente MAC e MOPI).

### 1.2 Escopo
O sistema deve suportar **múltiplos eventos configuráveis** (não apenas MAC e MOPI), cada um com seu próprio período de submissão, comissão avaliadora e regras de aceite. A ferramenta **DOIT** foi citada como referência de modelo de fluxo a seguir.

### 1.3 Fora de escopo (por ora)
- Definição de stack tecnológica (será tratada em etapa posterior, após validação destes requisitos).
- Integração/SSO com sistemas acadêmicos existentes da Fatec — decidido que a primeira versão terá **cadastro isolado** (ver seção 3).

---

## 2. Atores / Perfis de Usuário

| Ator | Descrição |
|---|---|
| **Aluno (autor/apresentador)** | Cria conta, submete trabalho, recebe notificações, pode reenviar em caso de correção solicitada. |
| **Orientador** | **Não é um perfil de conta separado.** É um papel atribuído por trabalho, escolhido pelo aluno dentre contas já existentes de Aluno ou Avaliador (não há cadastro "como orientador"). A pessoa escolhida precisa **aprovar** o trabalho, a partir da própria conta, antes que ele siga para avaliação. |
| **Avaliador (professor)** | Avalia um trabalho designado, atribui nota e decide: aceito / não aceito / aceito com correção. |
| **Organização (equipe administrativa do evento)** | Cadastra eventos, define períodos de submissão e prazo de correção, confirma aceite final, emite carta de aceite, gera certificados e acompanha o dashboard/relatórios. Pode visualizar a lista de usuários, mas **não pode criar, excluir ou redefinir senha** de nenhum usuário. |
| **Admin** | Tem exatamente as mesmas permissões da Organização, **mais** a gestão de usuários: criar, excluir e redefinir senha de qualquer conta (aluno, avaliador, organização ou outro admin). É o único perfil com acesso a essa gestão. |

---

## 3. Requisitos Funcionais (RF)

### Cadastro e autenticação
- **RF-01** — O sistema deve permitir que aluno e avaliador criem conta própria informando dados pessoais básicos, cada um pelo seu próprio formulário de cadastro (não existe cadastro "como orientador" — ver Atores, seção 2). **O papel da conta é definido pelo formulário usado no cadastro e não muda depois**: conta criada em "Cadastrar-se como aluno" recebe papel `aluno`; conta criada em "Cadastrar-se como avaliador" recebe papel `avaliador`. Uma conta `avaliador` já carrega a capacidade de ser escolhida como orientador (RF-08) — não é um papel ou cadastro à parte.
- **RF-02** — Ao concluir o cadastro, o sistema deve enviar um e-mail de confirmação de conta.
- **RF-03** — O sistema deve permitir redefinição de senha via e-mail.
- **RF-04** — A autenticação é isolada (login/senha próprios do sistema); não há integração com SSO institucional na primeira versão.

### Gestão de eventos (multi-evento)
- **RF-05** — A organização deve poder cadastrar novos eventos, cada um com nome, período de submissão, período de avaliação e **prazo padrão de correção** próprios.
- **RF-06** — Um trabalho submetido deve estar sempre vinculado a um evento específico.
- **RF-07** — Qualquer usuário da equipe organizadora pode administrar qualquer evento (mesmas permissões entre os membros da organização).
- **RF-29** — A organização deve poder marcar **um evento como destaque** e associar uma **imagem** a ele. Esse evento aparece em uma seção de destaque na tela inicial pública enquanto estiver marcado e com o período de submissão aberto.

### Submissão de trabalho
- **RF-08** — O aluno deve poder submeter um trabalho informando: título, palavras-chave, resumo (**máximo de 2.000 caracteres**), orientador (**obrigatório**, busca entre contas de aluno e avaliador) e demais participantes (opcional, busca apenas entre contas de aluno — o próprio aluno que submete já entra automaticamente como o primeiro participante). Sem orientador selecionado, a submissão não pode ser concluída.
- **RF-09** — Antes de aceitar a submissão, o sistema deve verificar se já existe um trabalho enviado com o **mesmo título e mesmos participantes** (texto livre) dentro do mesmo evento. Caso exista, a submissão deve ser bloqueada com mensagem informando que o trabalho já foi enviado por outro integrante.

### Aprovação do orientador
- **RF-10** — Após a submissão, o sistema deve notificar o orientador vinculado para decisão sobre o trabalho. A tela deve mostrar ao orientador o **nome do projeto, as palavras-chave, o resumo completo e os nomes de todos os alunos participantes** — informação suficiente para julgar sem precisar consultar outra tela.
- **RF-11** — O orientador decide entre três opções: **Aceito** (o trabalho passa a aparecer para os avaliadores), **Correção** (volta para o aluno ajustar) ou **Recusado** (encerrado, não segue para avaliação). Um campo de comentário acompanha a decisão.
- **RF-12** — Se a decisão for "Correção", o trabalho retorna ao aluno para ajuste. O aluno pode reenviar para nova decisão do orientador **quantas vezes for necessário**, desde que dentro do período de submissão do evento (sem prazo específico para essa etapa).

### Avaliação
- **RF-30** — O avaliador deve poder se inscrever como avaliador em um evento específico, tornando-se elegível para receber trabalhos designados naquele evento.
- **RF-13** — Cada trabalho aceito pelo orientador (RF-11) deve ser designado a **um único avaliador** dentre os inscritos no evento correspondente.
- **RF-14** — Na aba "Todos os trabalhos", o avaliador vê **título e resumo** do trabalho e atribui apenas uma **nota de 1 a 5** — sem parecer e sem comentário (isso existe só na relação de orientador, RF-11). O avaliador designado (RF-13) é quem recebe a ação de avaliar; os demais trabalhos da lista aparecem só para contexto.
- **RF-15** — Ao receber a nota, o status do trabalho passa para **"Avaliado"**. A organização então confirma o aceite final (RF-19) a partir dos trabalhos avaliados, passando o status para **"Aceito"**.
- **RF-31** — Como qualquer avaliador pode também ser escolhido como orientador de outros trabalhos, a tela "Trabalhos" do avaliador deve ter duas visões separadas: **"Todos os trabalhos"** (trabalhos inscritos/aceitos nos eventos em que ele está inscrito como avaliador, com ação de avaliar somente nos designados a ele) e **"Sou orientador"** (trabalhos em que ele foi escolhido como orientador, com a decisão de três opções da RF-11).

### Correção
- **RF-16** — Se o parecer for "aceito com correção", o sistema deve notificar o aluno e abrir **uma única rodada de reenvio**, com prazo definido pelo **prazo padrão de correção configurado no evento** (RF-05).
- **RF-17** — Se o aluno não reenviar dentro do prazo, o trabalho deve ser automaticamente marcado como **não aceito**.
- **RF-18** — Após o reenvio dentro do prazo, o trabalho retorna ao mesmo avaliador para nova decisão (aceito ou não aceito — sem nova rodada de correção).

### Aceite final
- **RF-19** — A organização deve confirmar o aceite final dos trabalhos aprovados pelo avaliador.
- **RF-20** — Ao confirmar o aceite final, o sistema deve gerar/emitir a carta de aceite para o aluno.

### Certificação
- **RF-21** — O sistema deve emitir certificados em **PDF**, seguindo **template institucional da Fatec**, para alunos/apresentadores de trabalhos aceitos.
- **RF-22** — O sistema deve emitir certificados em **PDF**, seguindo o mesmo template institucional, para professores participantes como avaliadores.

### Dashboard e relatórios
- **RF-23** — A organização deve ter acesso a um **dashboard administrativo** com visão consolidada dos trabalhos **do evento selecionado** (quantidade por status: aguardando aprovação do orientador, aguardando avaliação, aceito com correção pendente, aceito, não aceito). Um seletor de evento no próprio painel troca o escopo dos dados exibidos.
- **RF-24** — O dashboard deve permitir visualizar relatórios de: participantes, envios, trabalhos aceitos e trabalhos não aceitos — sempre filtrados pelo evento selecionado.
- **RF-25** — Qualquer relatório visualizado no dashboard deve poder ser **exportado em PDF**.

### Gestão de usuários
- **RF-26** — Organização e Admin podem visualizar a lista de usuários cadastrados (todos os perfis).
- **RF-27** — Apenas Admin pode criar uma nova conta de usuário, excluir uma conta existente ou redefinir a senha de qualquer usuário.
- **RF-28** — A interface deve ocultar ou desabilitar as ações de criar/excluir/redefinir senha para usuários com perfil Organização (não é suficiente bloquear só no backend — a ação nem deve ser oferecida na tela).

---

## 4. Regras de Negócio (RN)

- **RN-01** — Um trabalho pertence a exatamente um evento.
- **RN-02** — Um trabalho não pode ser submetido duas vezes com o mesmo título e mesmos participantes dentro do mesmo evento.
- **RN-03** — Um trabalho só segue para avaliação após decisão "Aceito" do orientador vinculado (RF-11). Pedidos de correção não têm limite de reenvio, respeitando apenas o período de submissão do evento.
- **RN-03a** — Todo trabalho deve ter um orientador vinculado no momento da submissão; o campo é obrigatório e não pode ficar vazio.
- **RN-04** — Um trabalho tem no máximo uma rodada de correção por decisão do orientador.
- **RN-05** — O prazo de correção de um trabalho é herdado do prazo padrão configurado no evento.
- **RN-06** — Um trabalho só recebe carta de aceite após confirmação da organização, mesmo que o avaliador já tenha dado a nota (status "Avaliado").
- **RN-07** — Certificados só são emitidos para trabalhos com aceite final confirmado pela organização.
- **RN-08** — Organização e Admin têm as mesmas permissões operacionais (eventos, trabalhos, aceite, certificados, relatórios); a única diferença entre os dois perfis é a gestão de usuários.
- **RN-09** — Criar, excluir ou redefinir senha de qualquer usuário é uma ação exclusiva do perfil Admin.
- **RN-10** — No máximo um evento é exibido em destaque na tela inicial por vez — o marcado manualmente pela organização, nunca escolhido automaticamente pelo sistema.
- **RN-11** — Se nenhum evento estiver marcado como destaque, ou o marcado não tiver imagem, ou seu período de submissão não estiver aberto, a seção de destaque não aparece na tela inicial (nenhum placeholder genérico é exibido).
- **RN-12** — Um avaliador só pode ser designado a trabalhos de eventos nos quais ele se inscreveu (RF-30).

---

## 5. Requisitos Não Funcionais (RNF)

- **RNF-01** — O sistema deve tratar dados pessoais de alunos e professores em conformidade com a LGPD (política de retenção e acesso a detalhar em etapa de design).
- **RNF-02** — Comunicações por e-mail (confirmação de cadastro, redefinição de senha, notificação de aprovação do orientador, notificação de correção e prazo) devem ser confiáveis e rastreáveis.
- **RNF-03** — Certificados e relatórios exportados devem ser gerados em **PDF**.
- **RNF-04** — O sistema deve suportar de forma performática o volume esperado de **100 a 500 trabalhos por evento**, considerando múltiplos eventos simultâneos.
- **RNF-05** — O dashboard administrativo deve refletir o status dos trabalhos de forma próxima ao tempo real (sem necessidade de geração manual de relatório para visualização básica).

---

## 6. Casos de Uso Principais (resumo)

1. **Submeter trabalho** (Aluno) → validação de duplicidade → aguardando aprovação do orientador.
2. **Aprovar trabalho** (Orientador) → aprova ou reprova → se aprovado, segue para avaliação.
3. **Avaliar trabalho** (Avaliador) → decide aceito / não aceito / correção.
4. **Corrigir e reenviar** (Aluno) → dentro do prazo do evento → volta para avaliação; fora do prazo → não aceito automaticamente.
5. **Confirmar aceite final** (Organização) → gera carta de aceite.
6. **Emitir certificados** (Organização) → PDF com template institucional, após encerramento do evento.
7. **Acompanhar dashboard e exportar relatórios** (Organização/Admin) → a qualquer momento durante/após o evento, exportação em PDF, sempre filtrado pelo evento selecionado.
8. **Gerenciar usuários** (Admin) → criar, excluir ou redefinir senha de qualquer conta; Organização só visualiza a lista, sem essas ações disponíveis na tela.

---

## 7. Glossário

- **MAC / MOPI** — Eventos/mostras acadêmicas da Fatec (primeiros eventos a usar o sistema).
- **DOIT** — Ferramenta citada como referência de fluxo similar.
- **Carta de aceite** — Documento formal confirmando que o trabalho foi aceito no evento.
- **Organização** — Perfil administrativo do evento (eventos, trabalhos, aceite, certificados, relatórios), sem acesso à gestão de usuários.
- **Admin** — Mesmas permissões da Organização, mais gestão exclusiva de usuários (criar, excluir, redefinir senha).

---

## 8. Pendências / Questões em aberto

1. **8.1 — Template do certificado.** Precisa do layout oficial (logo, cores, textos institucionais) da Fatec para o PDF do certificado de aluno e do certificado de avaliador. Pendência de design/conteúdo visual, não bloqueia a definição de stack.

2. ~~**8.2 — Gatilho do aceite final.**~~ **Resolvida em 2026-08-13.** O parecer de aceite/correção/recusa passou a ser uma decisão do **orientador** (RF-11, três opções), não mais do avaliador. O avaliador só dá uma nota (1 a 5), que muda o status para "Avaliado"; a partir daí a organização confirma o aceite final (RF-15/RF-19), mudando o status para "Aceito". Fluxo completo: aluno submete → orientador decide (Aceito/Correção/Recusado) → se aceito, avaliador designado dá nota → organização confirma aceite final.

---

## 9. Aprovação

- [x] Revisado pelo solicitante
- [x] Pendências de negócio e de fluxo resolvidas
- [ ] Pendência de design visual (certificado — item 8.1) resolvida
- [x] Pronto para definição de stack técnica (já definida, ver `arquitetura_tecnica.md`)
