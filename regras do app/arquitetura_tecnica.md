# Arquitetura Técnica — Sistema de Submissão de Trabalhos Acadêmicos

**Referências:** [`requisitos.md`](./requisitos.md) — este documento traduz os requisitos funcionais (RF) em decisões de arquitetura.

**Status:** Rascunho v4 — decisão de aceite/correção/recusa movida do avaliador para o orientador (três opções + comentário) em 2026-08-13; avaliador passou a só dar nota (1 a 5). Pendências técnicas na seção 6.

---

## 1. Stack escolhida

| Camada | Tecnologia | Papel |
|---|---|---|
| Frontend | **Next.js** (React), hospedado na **Vercel** | Interface do aluno, orientador, avaliador e organização (dashboard). |
| Autenticação | **Firebase Authentication** | Login isolado (e-mail/senha) para os 4 perfis (RF-01 a RF-04). E-mail de confirmação de conta e redefinição de senha nativos do Firebase Auth. |
| Banco de dados | **Firestore** | Armazena eventos, trabalhos, usuários (perfis), avaliações, status e histórico. |
| Backend / regras de negócio | **Firebase Cloud Functions** | Tudo que exige validação confiável, transação atômica, gatilho automático ou agendamento (ver seção 3). |
| E-mails transacionais de negócio | **Firebase Extension "Trigger Email"** | Notificações de aprovação do orientador, prazo de correção, aceite final — disparadas ao escrever um documento na coleção `mail`. |
| Armazenamento de arquivos | **Firebase Storage** | PDFs gerados: carta de aceite, certificados, relatórios exportados. |
| Regras de acesso | **Firestore Security Rules** | Garantem que cada perfil só leia/escreva o que lhe é permitido (ex: só o orientador vinculado pode aprovar seu trabalho). |

**Por que Cloud Functions em vez de funções na Vercel para a lógica de negócio:** o Firebase permite Functions coladas ao Firestore — disparadas por escrita/leitura (triggers) e por agendamento (scheduled functions), o que é exatamente o que RF-17 (expirar prazo de correção automaticamente) e RF-10 (notificar orientador ao submeter) exigem. A Vercel/Next.js fica responsável apenas pela interface e por eventuais rotas leves que não dependem de gatilho de banco.

---

## 2. Modelo de dados inicial (coleções Firestore)

```
usuarios/{uid}
  - nome, email, papel: "aluno" | "avaliador" | "organizacao" | "admin"
    (não existe papel "orientador" — qualquer aluno ou avaliador pode ser
    escolhido como orientador de um trabalho, ver trabalhos.orientadorUid)

eventos/{eventoId}
  - nome, periodoSubmissaoInicio, periodoSubmissaoFim, periodoAvaliacaoFim
  - prazoPadraoCorrecaoDias   (RF-05)
  - destaque: boolean, imagemDestaqueUrl (Storage)   (RF-29 — no máximo um evento com destaque=true por vez, validado na Cloud Function que atualiza o evento)
  - avaliadoresInscritosUids: [uid]   (RF-30 — avaliadores que se inscreveram para avaliar neste evento)

trabalhos/{trabalhoId}
  - eventoId, titulo, palavrasChave: [string], resumo (máx. 2000 caracteres)
  - alunoUid (autor que submeteu), participantesUids: [uid] (alunos adicionais)
  - orientadorUid (referência a um usuário com papel "aluno" OU "avaliador" — não existe papel "orientador" próprio, ver Atores em requisitos.md)
  - avaliadorUid (designado, sempre papel "avaliador")
  - status: "aguardando_orientador" | "aceito_com_correcao" (correção pedida
            pelo orientador, RF-11) | "nao_aceito" (recusado pelo orientador
            OU prazo de correção vencido) | "aguardando_avaliacao" (orientador
            aceitou) | "avaliado" (avaliador deu a nota, RF-15) | "aceito"
            (aceite final confirmado pela organização, RF-19)
  - comentarioOrientador (texto livre, acompanha a decisão do orientador — RF-11)
  - prazoCorrecaoEm (timestamp, calculado a partir de eventos.prazoPadraoCorrecaoDias)
  - notaAvaliador (1 a 5, sem parecer — RF-14)
  - cartaAceiteUrl, certificadoAlunoUrl, certificadoAvaliadorUrl (Storage)

mail/{autoId}
  - to, template, dados   (consumido pela extensão Trigger Email)
```

*(Modelo preliminar — será refinado durante o design detalhado, não é definitivo.)*

---

## 3. Onde cada requisito funcional é implementado

| RF | Implementação |
|---|---|
| RF-01 a RF-04 (cadastro/login) | Firebase Authentication (client SDK no Next.js). Ao criar a conta, a Cloud Function de cadastro grava `papel` em `usuarios/{uid}` de acordo com o formulário usado (`/cadastro/aluno` → `"aluno"`, `/cadastro/avaliador` → `"avaliador"`) — o papel não é escolhido pelo usuário nem muda depois de criado. |
| RF-08/RF-09 (submissão + verificação de duplicidade) | **Cloud Function callable** `submeterTrabalho` — faz a checagem de duplicidade e a escrita em uma transação atômica (não confia em checagem feita só no cliente). |
| RF-10/RF-11/RF-12 (decisão do orientador: Aceito/Correção/Recusado) | Escrita no Firestore restrita por **Security Rules** (só o `orientadorUid` vinculado pode alterar `status` e `comentarioOrientador`) + **trigger** que escreve em `mail` para notificar o aluno (e o avaliador, quando aceito). |
| RF-30 (inscrição de avaliador por evento) | Escrita do próprio uid em `eventos.avaliadoresInscritosUids` via Security Rules (usuário só adiciona/remove o próprio uid). |
| RF-13/RF-14/RF-15 (avaliação: só nota, 1 a 5) | Security Rules restringem a escrita de `notaAvaliador` ao `avaliadorUid` designado; Cloud Function de designação só aceita um uid presente em `avaliadoresInscritosUids` do evento (RN-12). Ao gravar a nota, trigger muda `status` para `"avaliado"` e notifica a organização. |
| RF-16/RF-17/RF-18 (correção e prazo) | Trigger calcula `prazoCorrecaoEm` ao mudar status para "aceito_com_correcao". **Scheduled Function** roda periodicamente e marca como "nao_aceito" os trabalhos com prazo vencido sem reenvio. |
| RF-19/RF-20 (aceite final + carta de aceite) | Cloud Function callable, acionada pela organização, gera o PDF e salva no Storage. |
| RF-21/RF-22 (certificados) | Cloud Function gera PDF com template institucional (pendente — ver 6.1) e salva no Storage. |
| RF-23/RF-24 (dashboard escopado por evento) | Next.js consulta Firestore diretamente (via client SDK, respeitando Security Rules dos perfis "organizacao"/"admin"), filtrando sempre por `eventoId` selecionado. Volume esperado (100–500 trabalhos/evento) não exige agregações pré-computadas nesta fase. |
| RF-25 (exportar relatório em PDF) | Cloud Function callable gera o PDF do relatório sob demanda a partir da mesma consulta usada no dashboard. |
| RF-26 (visualizar usuários) | Security Rules permitem leitura da coleção `usuarios` para perfis "organizacao" e "admin". |
| RF-29 (evento em destaque na home) | Tela inicial (rota pública, sem autenticação) consulta o evento com `destaque == true` e submissão aberta; se não houver, a seção não renderiza (RN-11). Upload da imagem via Firebase Storage, restrito a "organizacao"/"admin" nas Storage Rules. |
| RF-27/RF-28 (gestão de usuários exclusiva do Admin) | Criação/exclusão de conta e redefinição de senha passam por **Cloud Function callable**, que verifica `papel == "admin"` do chamador antes de usar o Firebase Admin SDK; Security Rules bloqueiam escrita direta em `usuarios` para "organizacao". A UI (Next.js) oculta os botões de criar/excluir/redefinir senha quando o perfil logado não é "admin" (RF-28). |

---

## 4. Segurança

- Nenhuma regra de negócio sensível (duplicidade, permissões de aprovação/avaliação, geração de certificado) depende apenas de validação no cliente — tudo reforçado por Security Rules e/ou Cloud Functions.
- Firestore Security Rules por perfil (`papel` do usuário) e por vínculo (`orientadorUid`, `avaliadorUid`, `alunoUid` do próprio documento).
- Gestão de usuários (criar, excluir, redefinir senha) é verificada tanto na UI (oculta a ação) quanto no backend (`papel == "admin"` checado na Cloud Function) — nunca só uma das duas camadas.
- Cloud Functions usam Firebase Admin SDK (privilégios elevados) apenas para as operações que exigem ignorar as Security Rules (ex: mudar status após validações internas).

---

## 5. Ambientes

- **Firebase**: projeto separado para desenvolvimento e produção (ex: `sistema-submissao-dev`, `sistema-submissao-prod`).
- **Vercel**: deploy do Next.js com variáveis de ambiente apontando para o projeto Firebase correspondente (preview = dev, produção = prod).

---

## 6. Pendências técnicas

1. **6.1 — Template do certificado (PDF).** Depende do item 8.1 de `requisitos.md` (layout oficial da Fatec). Só então se escolhe a biblioteca de geração (ex: `@react-pdf/renderer`, Puppeteer/HTML-to-PDF ou `pdf-lib`) dentro da Cloud Function.
2. **6.2 — Modelo de dados** listado na seção 2 é preliminar; será revisado ao iniciar a modelagem detalhada/protótipo.

---

## 7. Aprovação

- [ ] Revisado pelo solicitante
- [ ] Pronto para iniciar o design detalhado / protótipo
