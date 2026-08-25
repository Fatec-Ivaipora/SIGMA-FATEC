# Arquitetura Técnica — Sistema de Submissão de Trabalhos Acadêmicos

**Referências:** [`requisitos.md`](./requisitos.md) — este documento traduz os requisitos funcionais (RF) em decisões de arquitetura.

**Status:** Rascunho v11 — 2026-08-17. **Migração completa de protótipo mock para Firebase real.** O usuário pediu explicitamente "quero que zere o sistema, nada de informação fictícia". Todas as telas foram reescritas: nenhuma usa mais `useState` com array mock — tudo lê/escreve do Firestore de verdade (projeto real `fateclab-4cc74`), com login real via Firebase Auth. O `PersonaSwitcher` (mock de personas da v9) foi **removido**, junto com `src/lib/personas.ts`, `avaliadorAssignments.ts`, `organizacaoAssignments.ts` e `areasTematicas.ts` (arquivo do mock antigo de áreas temáticas — não confundir com o hook real `src/lib/data/eventos.ts`, que guarda `areasTematicas` como campo do documento real). Mudanças principais:
- **`src/lib/auth.tsx`** — `AuthProvider`/`useAuth()` reais: `onAuthStateChanged` + leitura ao vivo (`onSnapshot`) de `usuarios/{uid}` pra expor `user` (Firebase Auth) e `perfil` (`PerfilUsuario`: nome/email/papel/atribuicoesEventos/eventosPermitidos). `src/lib/useRequireAuth.ts` — hook de guarda de rota, redireciona pra `/login` se não autenticado, ou pra `ROTA_POR_PAPEL[papel]` se o papel não bate com os permitidos na página.
- **`src/lib/data/eventos.ts`, `trabalhos.ts`, `usuarios.ts`** — hooks `useEventos`/`useEventosPublicos`/`useTrabalhos`/`useUsuarios` que fazem `onSnapshot`/`query` reais na coleção correspondente, já aplicando o escopo por papel (RN-15) client-side (reforçado pelas Security Rules). `useEventosPublicos()` existe à parte de `useEventos()` porque aluno não é escopado por RN-15 — precisa ver todos os eventos pra poder se inscrever em qualquer um.
- **`/login`** (`signInWithEmailAndPassword`) e **`/cadastro/aluno`** (`createUserWithEmailAndPassword` + `setDoc` do próprio perfil, papel "aluno" fixo) são reais.
- **Criação de avaliador/organização/admin pela tela de Usuários exige privilégio elevado** (o Admin logado não pode criar a conta de outra pessoa só com o client SDK, sem derrubar a própria sessão) — resolvido com uma **rota de API no próprio Next.js** (`src/app/api/usuarios/route.ts`, `POST`/`DELETE`), usando `firebase-admin` (`src/lib/firebaseAdmin.ts`, credenciais de service account em `.env.local` como `FIREBASE_ADMIN_*`, nunca hardcoded). Sem serviço de e-mail configurado ainda (extensão Trigger Email não instalada), a rota gera uma senha temporária aleatória e devolve na resposta pra o Admin repassar manualmente — "Redefinir senha" de uma conta existente usa `sendPasswordResetEmail` (client SDK, não precisa de privilégio elevado).
- **`firestore.rules`** (novo arquivo na raiz do projeto) — implementa RN-15 de verdade: `souAdmin()`/`meusEventos()`/`meuPapel()` como funções auxiliares; `eventos` só admin cria (RF-48: só o Admin atribui evento a uma organização); `usuarios/{uid}` só admin escreve, exceto a criação do próprio doc por um aluno se autocadastrando; `trabalhos` escopado por `eventoId`/`avaliadorUid`/`alunoUid` conforme o papel. **O usuário precisa publicar esse arquivo no Console do Firebase** toda vez que ele mudar (não há deploy automático — sem Firebase CLI autenticado nesta sessão).
- Sem geração real de certificado (RF-21/RF-22) nem de PDF de relatório ainda — as telas mostram estado vazio honesto em vez de inventar um botão que não funciona.

**Status:** v14 — 2026-08-24. **Curso obrigatório para aluno Fatec (RF-49/RN-19).** `usuarios/{uid}` ganhou `curso?: string` (só `vinculoFatec == true`), preenchido no cadastro por um `<select>` sobre a lista fechada `CURSOS_FATEC` em `src/lib/cursos.ts` (nova, 15 cursos reais da Fatec Ivaiporã, confirmados com o usuário — não inventar/editar essa lista sem confirmar). Validado no client antes de criar a conta (mesmo padrão do RA — falha aqui não gera conta Auth órfã). Puramente informativo por enquanto: nenhuma Security Rule ou regra de elegibilidade depende de `curso`; exibido em `/usuarios` ao lado do RA.

**Status:** v13 — 2026-08-24. **RF-08 (colegas/participantes) implementado.** `src/lib/data/usuarios.ts` ganhou `useAlunosParaBusca(meuUid)` — query `where("papel","==","aluno")`, usada pelo autocomplete de colegas em `SubmeterTrabalhoModal`. `Trabalho` (`src/lib/data/trabalhos.ts`) ganhou `participantesUids`/`participantesNomes`; a query de aluno em `useTrabalhos` virou `or(where("alunoUid","==",uid), where("participantesUids","array-contains",uid))` (Firestore JS SDK v10.8+/v12 suporta `or()` nativo, sem precisar de duas queries manuais). `firestore.rules`: `usuarios/{uid}` agora permite um aluno ler outro doc de aluno (nunca avaliador/organizacao/admin) — necessário para a busca funcionar como *query* de coleção, não só leitura pontual, então o client sempre filtra com `where("papel","==","aluno")` (a regra exige isso estruturalmente). `trabalhos/{trabalhoId}` (leitura) ganhou `request.auth.uid in resource.data.get("participantesUids", [])` — usa `.get(key, default)` em vez de acesso direto ao campo para não quebrar em trabalhos antigos sem essa lista. Colega só lê; `allow update` não mudou (continua exigindo `alunoUid == uid`), então só quem submeteu corrige/reenvia — decisão confirmada com o usuário.

**Status:** v12 — 2026-08-24. **Participante externo (RF-49/RF-50, RN-17/RN-18).** Decisão de arquitetura: em vez de uma coleção separada para quem não é aluno da Fatec, o campo `vinculoFatec: boolean` (+ `ra?: string`) foi adicionado ao mesmo documento `usuarios/{uid}` — papel continua `"aluno"` nos dois casos, já que o fluxo (submeter trabalho, acompanhar avaliação) é idêntico; evita duplicar `auth.tsx`, `useRequireAuth`, hooks de dados e `firestore.rules` para verificar duas coleções. `src/app/cadastro/aluno/page.tsx` pergunta o vínculo antes dos demais campos; RA só aparece e é exigido quando `vinculoFatec` é true, validado no client (formato + janela de anos, RN-17) antes de chamar `createUserWithEmailAndPassword` (evita criar conta Auth órfã se a validação falhar). `eventos/{eventoId}` ganhou `aceitaExternos?: boolean` (RF-50), editável em `/eventos` (checkbox na criação + botão de alternância por evento existente). A filtragem de elegibilidade (RN-18) acontece no client em `/aluno/page.tsx` e `/aluno/eventos/page.tsx` (`eventos.filter(e => e.aceitaExternos)` quando `perfil.vinculoFatec === false`) **e** é reforçada em `firestore.rules` — a regra de `create` em `trabalhos` agora exige `meuVinculoFatec() || eventoAceitaExternos(eventoId)`, com `get()` extra no documento do evento. Contas antigas (sem o campo `vinculoFatec`) são tratadas como aluno Fatec (`vinculoFatec` ausente ⇒ true) para não quebrar comportamento existente — mesmo default em `meuVinculoFatec()` nas regras e no client. Usuário precisa republicar `firestore.rules` no Console.

---

## 1. Stack escolhida

| Camada | Tecnologia | Papel |
|---|---|---|
| Frontend | **Next.js** (React), hospedado na **Vercel** | Interface do aluno, avaliador e organização (dashboard). |
| Autenticação | **Firebase Authentication** | Login isolado (e-mail/senha) para os perfis `aluno`, `avaliador`, `organizacao`, `admin` (RF-01 a RF-04). Só `aluno` tem cadastro público; os demais são criados pela organização/admin. E-mail de confirmação de conta e redefinição de senha nativos do Firebase Auth. |
| Banco de dados | **Firestore** | Armazena eventos, trabalhos, usuários (perfis), notas e histórico. |
| Backend / regras de negócio | **Firebase Cloud Functions** | Tudo que exige validação confiável, transação atômica ou notificação disparada por escrita (ver seção 3). |
| E-mails transacionais de negócio | **Firebase Extension "Trigger Email"** | Notificações de envio para avaliação e de resultado — disparadas ao escrever um documento na coleção `mail`. |
| Armazenamento de arquivos | **Firebase Storage** | PDFs gerados: carta de aceite, certificados, relatórios exportados; imagem de destaque do evento. |
| Regras de acesso | **Firestore Security Rules** | Garantem que cada perfil só leia/escreva o que lhe é permitido (ex: só o `avaliadorUid` designado pode gravar a nota de um trabalho). |

**Por que Cloud Functions em vez de funções na Vercel para a lógica de negócio:** o Firebase permite Functions coladas ao Firestore — disparadas por escrita (triggers) —, o que cobre RF-33 (notificar o avaliador ao receber um envio em lote) e RF-35 (notificar a organização ao receber a nota). A Vercel/Next.js fica responsável apenas pela interface e por eventuais rotas leves que não dependem de gatilho de banco.

---

## 2. Modelo de dados inicial (coleções Firestore)

```
usuarios/{uid}
  - nome, email, papel: "aluno" | "avaliador" | "organizacao" | "admin" | "orientador"
    ("orientador" novo em 2026-08-25, RF-54 — conta pro Projeto Integrador,
    ver turmas/{turmaId} abaixo. Continua sem relação com o campo de texto
    livre trabalhos.nomeOrientador, ver RF-08 — são dois conceitos diferentes)
  - atribuicoesEventos: [{ eventoId, areasTematicas }]
    (existe pra papel "avaliador" e "orientador" — areasTematicas: string[], uma ou mais por
    atribuição desde 2026-08-25 (antes areaTematica: string, uma só) — RF-46/RN-16 —
    e "organizacao" — areasTematicas ausente/null, só eventoId — RF-48; "admin" não usa este
    campo pois não é escopado por evento, RN-15; múltiplas entradas ao longo do tempo.
    Pra "orientador" é opcional — só preenchido se essa pessoa também for
    alocada como avaliador de algum evento, RF-59/pendência 8.10)
  - eventosPermitidos: [eventoId, ...] (lista simples de string, sem area temática)
    (espelha atribuicoesEventos — existe só porque a linguagem de Firestore
    Security Rules não tem .map()/.filter() para extrair eventoId de dentro de
    uma lista de mapas; o app mantém os dois campos em sincronia sempre que
    atribuicoesEventos é editado. "admin" não usa nenhum dos dois campos.)
  - vinculoFatec: boolean, ra?: string, curso?: string
    (só relevante para papel "aluno" — RF-49/RN-17/RN-19. true (ou campo ausente,
    para contas anteriores a essa feature) = aluno matriculado na Fatec, com
    RA e curso (lista fechada, src/lib/cursos.ts); false = participante
    externo, sem RA/curso, restrito por RN-18.)

eventos/{eventoId}
  - nome, descricao   (descricao adicionada em 2026-08-25, texto livre opcional)
  - periodoSubmissao, periodoAvaliacao (strings já formatadas "dd de mês de aaaa — dd de mês de aaaa",
    montadas no client a partir dos campos de data do formulário — não há campos de data brutos salvos)
  - destaque: boolean, imagemDestaqueUrl (Storage)   (RF-29 — no máximo um evento com destaque=true por vez, validado na Cloud Function que atualiza o evento. Upload do banner feito na própria criação do evento desde 2026-08-25, em `eventos/{eventoId}/banner` no Storage — ver `storage.rules`)
  - areasTematicas: [string]   (RF-37 — geridas pela organização; lista fechada que o aluno escolhe na submissão)
  - aceitaExternos?: boolean   (RF-50 — se true, participante externo pode se inscrever; ausente/false = só aluno Fatec, RN-18)

trabalhos/{trabalhoId}
  - eventoId, titulo, areaTematica: string (obrigatória, deve existir em eventos.areasTematicas — RF-08/RF-37)
  - palavrasChave: [string], resumo (máx. 2000 caracteres)
  - alunoUid (autor que submeteu)
  - participantesUids: [uid], participantesNomes: [string]   (colegas adicionados na submissão, RF-08 — segunda lista denormalizada só pra exibição, sem precisar de N leituras extras em usuarios/{uid}; colega só LÊ o conteúdo do trabalho, nunca edita/corrige/reenvia)
  - convitesPendentes: [uid]   (RF-52, 2026-08-25 — subconjunto de participantesUids que ainda não respondeu ao convite; colega pode escrever esses 3 campos — só esses — pra aceitar (some de convitesPendentes) ou recusar (some dos 3), ver firestore.rules)
  - nomeOrientador: string (texto livre, obrigatório — RF-08/RN-03a; não referencia usuarios/{uid})
  - avaliadorUid (designado no envio em lote, RF-33 — sempre papel "avaliador")
  - enviadoParaAvaliacaoEm (timestamp, preenchido no envio em lote — RF-33/RF-34)
  - status: "submissao" (recém-submetido, ainda na aba Submissão) |
            "aguardando_avaliacao" (enviado ao avaliador, aba Avaliação) |
            "revisao" (avaliador pediu revisão, aba Revisão — RF-14/RF-36) |
            "avaliado" (avaliador deu a nota, aba Resultado — RF-35) |
            "aceito" (aceite final confirmado pela organização — RF-19) |
            "nao_aceito" (organização optou por não aceitar, ver pendência 8.2)
  - notaAvaliador (soma dos 5 critérios do edital, 5 a 25, sem parecer — RF-14/RF-53, detalhado em 2026-08-25)
  - notasCriterios (objeto com as 5 notas individuais — suficiencia, coerencia, estruturaTexto, clarezaPrecisao, aplicabilidadeRelevancia, cada uma 1 a 5, RF-53)
  - comentarioRevisao (texto livre, obrigatório quando o avaliador solicita revisão — RF-14)
  - cartaAceiteUrl, certificadoAlunoUrl, certificadoAvaliadorUrl (Storage)

turmas/{turmaId}   (Projeto Integrador, RF-54/RF-55/RF-56, 2026-08-25)
  - nome, disciplina?: string
  - orientadorUid, orientadorNome
  - alunosUids: [uid], alunosNomes: [string]
    (aluno entra aqui já no convite — mesmo padrão de participantesUids/convitesPendentes
    de trabalhos/{trabalhoId} acima; convitesPendentesUids é subconjunto ainda sem resposta)
  - convitesPendentesUids: [uid], convitesPendentesNomes: [string]
    (aluno convidado só pode escrever essas 4 listas — aceitar tira só daqui,
    recusar tira também de alunosUids/Nomes, ver firestore.rules)
  - mensagens: [{ texto: string, criadoEm: number }]
    (mural — RF-56, só o orientadorUid posta; guardado como array no próprio
    doc, sem subcoleção, dado o volume esperado baixo — Product Principle 4)

turmaTrabalhos/{id}   (RF-57, 2026-08-25)
  - turmaId, titulo, resumo?, alunoUid, alunoNome
  - status: "aguardando_avaliacao" | "revisao" | "aprovado"
    (sem etapa "submissao" separada como em trabalhos/{trabalhoId} — não há
    envio manual em lote aqui, só um orientador por turma; envio do aluno já
    entra direto em "aguardando_avaliacao")
  - comentarioOrientador?: string | null   (obrigatório ao pedir revisão)
  Pipeline independente do trabalhos/{trabalhoId} de evento — vira uma
  submissão de evento de verdade só quando o aluno decide inscrever um
  trabalho "aprovado" (RF-58), criando um trabalhos/{id} novo e normal
  (mesma Cloud Function/regras de sempre), com título/resumo pré-preenchidos
  a partir do turmaTrabalhos — sem vínculo salvo entre os dois documentos.

mail/{autoId}
  - to, template, dados   (consumido pela extensão Trigger Email)
```

*(Modelo preliminar — será refinado durante o design detalhado, não é definitivo. Os campos `orientadorUid`, `avaliadoresInscritosUids`, `prazoPadraoCorrecaoDias`, `prazoCorrecaoEm` e `comentarioOrientador` de versões anteriores deste documento foram removidos junto com o fluxo de aprovação do orientador.)*

---

## 3. Onde cada requisito funcional é implementado

| RF | Implementação |
|---|---|
| RF-01 a RF-04 (cadastro/login) | Firebase Authentication (client SDK no Next.js). Só existe formulário público em `/cadastro/aluno` (grava `papel: "aluno"`). Contas `avaliador`, `organizacao` e `admin` só são criadas via Cloud Function callable acionada pela tela de Usuários, restrita a `papel == "admin"` (RF-27/RN-14 — o formulário oferece os quatro papéis). |
| RF-08/RF-09 (submissão + verificação de duplicidade) | **Cloud Function callable** `submeterTrabalho` — valida que `areaTematica` está em `eventos.areasTematicas` (RF-37), grava `nomeOrientador` como texto livre (sem validação contra `usuarios`), faz a checagem de duplicidade e a escrita em uma transação atômica (não confia em checagem feita só no cliente). Status inicial: `"submissao"`. |
| RF-37/RF-43 (organização gerencia áreas temáticas, página dedicada) | Security Rules restringem escrita em `eventos.areasTematicas` aos perfis "organizacao"/"admin". Rota própria (`/areas-tematicas` no protótipo) com item de menu dedicado, lendo/escrevendo todos os `eventos` de uma vez — não é mais só um modal dentro da tela de Eventos. |
| RF-32 (aba Submissão) | Next.js consulta `trabalhos` com `status == "submissao"` do evento selecionado; cada linha tem checkbox controlado no client. |
| RF-33/RF-13/RF-38/RF-51 (filtro por área temática + seleção em lote + envio para avaliação, com divisão automática) | Filtro por `areaTematica` aplicado na query do client antes da seleção. Envio feito direto via client SDK (`writeBatch`), sem Cloud Function: grava `avaliadorUid`/`avaliadorNome` e muda `status` para `"aguardando_avaliacao"` em todos os trabalhos selecionados. Quando a seleção é de um único evento+área com mais de um avaliador cadastrado pra ela (`atribuicoesEventos[].areasTematicas`), a tela (`src/app/trabalhos/page.tsx`) sugere uma divisão igualitária (`Math.floor` + resto pros primeiros avaliadores da lista) e deixa a organização ajustar a quantidade de cada um antes de confirmar — daí o `writeBatch` grava avaliadores diferentes por fatia da seleção, na ordem em que aparecem na tabela. |
| RF-34 (aba Avaliação) | Next.js consulta `trabalhos` com `status == "aguardando_avaliacao"`, tanto na tela da organização (todos) quanto no menu do avaliador (filtrado por `avaliadorUid == uid` logado). |
| RF-14/RF-53 (nota ou revisão do avaliador) | Tela do avaliador (`avaliador/trabalhos`) grava `notasCriterios` (as 5 notas individuais) e `notaAvaliador` (a soma) direto via client SDK, mudando `status` para `"avaliado"`; gravar `comentarioRevisao` muda `status` para `"revisao"`. Segurança é por papel nas Security Rules (avaliador só escreve trabalhos com `avaliadorUid == seu uid`), sem restrição de campo. |
| RF-36 (reenvio após revisão) | **Cloud Function callable** `reenviarAposRevisao`, acionável só pelo `alunoUid` do trabalho quando `status == "revisao"`; muda `status` de volta para `"aguardando_avaliacao"`, mantendo o mesmo `avaliadorUid`. |
| RF-35/RF-41 (aba Resultado) | Next.js consulta `trabalhos` com `status == "avaliado"` (ou já decididos) do evento selecionado e renderiza a mesma tabela usada nas demais etapas, com uma coluna `notaAvaliador` adicional — **sem** agrupar por `areaTematica` nem ordenar por nota (corrigido na v7; a classificação dos melhores é trabalho futuro, ver pendência 8.4 em `requisitos.md`). |
| RF-19/RF-20 (aceite final + carta de aceite) | Cloud Function callable, acionada pela organização a partir da aba Resultado (mecânica exata pendente — ver 8.2 em `requisitos.md`), gera o PDF e salva no Storage, mudando `status` para `"aceito"`. |
| RF-21/RF-22 (certificados) | Cloud Function gera PDF com template institucional (pendente — ver 6.1) e salva no Storage. |
| RF-07/RF-23 (painel/administração escopados por evento) | Next.js consulta Firestore diretamente (via client SDK). Para "organizacao", toda query de `trabalhos`/`eventos` inclui `eventoId in usuarios/{uid}.atribuicoesEventos[].eventoId` — reforçado por Security Rules, não só no client (RN-15). Para "admin", nenhum filtro por evento é aplicado. Volume esperado (100–500 trabalhos/evento) não exige agregações pré-computadas nesta fase. |
| RF-25/RF-42 (relatórios com gráficos + exportar PDF) | Agregações (contagem por status, nota média por `areaTematica`) calculadas no client a partir da mesma consulta escopada do painel (RF-07/RF-23) — "organizacao" só agrega os eventos das suas `atribuicoesEventos`, "admin" agrega todos. Paleta e forma dos gráficos seguem a skill `dataviz` do repositório de design (rampa ordinal validada para as etapas, par categórico validado para aceito/recusado — ver PRODUCT.md). Cloud Function callable gera o PDF do relatório sob demanda a partir da mesma agregação. |
| RF-26 (visualizar usuários) | Security Rules permitem leitura da coleção `usuarios` para perfis "organizacao" e "admin". |
| RF-29 (evento em destaque na home) | Tela inicial (rota pública, sem autenticação) consulta o evento com `destaque == true` e submissão aberta; se não houver, a seção não renderiza (RN-11). Upload da imagem via Firebase Storage, restrito a "organizacao"/"admin" nas Storage Rules. |
| RF-27/RF-28/RF-46/RF-48/RF-54 (gestão de usuários exclusiva do Admin, incl. atribuições evento/área) | Criação/exclusão de conta, redefinição de senha e edição de `atribuicoesEventos` passam por **Cloud Function callable**, que verifica `papel == "admin"` do chamador antes de usar o Firebase Admin SDK; Security Rules bloqueiam escrita direta em `usuarios` para "organizacao". A UI (Next.js) oculta os botões de criar/excluir/redefinir senha quando o perfil logado não é "admin" (RF-28); o formulário de criação lista os cinco papéis, incluindo `"organizacao"` (RN-14) e `"orientador"` (novo em 2026-08-25), e pede evento (+ área temática se avaliador **ou orientador**, `PAPEIS_COM_AREA` em `usuarios/page.tsx`) quando o papel exige (RF-46/RF-48/RF-54). Uma tela de edição por usuário permite adicionar/remover entradas de `atribuicoesEventos` depois da criação. |
| RF-44/RF-45 (Painel do aluno com banner + página Eventos) | Client-side: `eventoDestaque()` seleciona o evento aberto com descrição de destaque para o banner do Painel; a página Eventos lista todos (`eventos` com `periodoSubmissaoFim` no passado renderiza como encerrado, sem ação). Sem Cloud Function nova — reaproveita a mesma leitura de `eventos` já usada na home. |
| RF-45/RF-47 (página Eventos e seletor do avaliador) | Client consulta `usuarios/{uid}.atribuicoesEventos` do avaliador logado para popular o seletor de evento (Painel/Trabalhos) e a lista somente-leitura da página Eventos — nunca a coleção `eventos` completa. |
| RF-54 a RF-59 (Projeto Integrador — turmas, convite, mural, avaliação, inscrição em evento) | Coleções `turmas`/`turmaTrabalhos` (ver seção 2 acima), tudo via client SDK, sem Cloud Function. Convite de turma reaproveita o padrão de `convitesPendentes` de `trabalhos.participantesUids` (RF-52). Busca de aluno pro convite usa `useAlunosParaBusca(uid, { apenasFatec: true })`, que filtra `vinculoFatec !== false` no client — igual à busca de colega (RF-08), mas com esse filtro a mais (RN-20). "Inscrever em evento" (RF-58) grava um `trabalhos/{id}` novo e normal pelo mesmo caminho de qualquer submissão (`SubmeterTrabalhoModal`, agora com prop `valoresIniciais` opcional pra pré-preencher título/resumo) — sem Cloud Function e sem vínculo salvo de volta pro `turmaTrabalhos` de origem. |

---

## 4. Segurança

- Nenhuma regra de negócio sensível (duplicidade, designação de avaliador, geração de certificado) depende apenas de validação no cliente — tudo reforçado por Security Rules e/ou Cloud Functions.
- Firestore Security Rules por perfil (`papel` do usuário) e por vínculo (`avaliadorUid`, `alunoUid` do próprio documento). `nomeOrientador` é texto livre e não concede nenhuma permissão — não existe verificação de vínculo para ele.
- Escopo por evento (RN-15) é reforçado nas Security Rules, não só filtrado no client: para "organizacao"/"avaliador", leitura de `trabalhos`/`eventos` exige que o `eventoId` do documento esteja em `usuarios/{uid}.atribuicoesEventos[].eventoId`; "admin" não tem essa exigência.
- Gestão de usuários (criar, excluir, redefinir senha, inclusive contas de avaliador) é verificada tanto na UI (oculta a ação) quanto no backend (`papel == "admin"` checado na Cloud Function) — nunca só uma das duas camadas.
- Cloud Functions usam Firebase Admin SDK (privilégios elevados) apenas para as operações que exigem ignorar as Security Rules (ex: mudar status após validações internas, criar conta de avaliador).

---

## 5. Ambientes

- **Firebase**: projeto real criado em 2026-08-14 — `fateclab-4cc74` (único projeto por enquanto; a separação dev/prod da v1 deste documento ainda não foi feita, ver pendência 6.8). Client SDK inicializado em `src/lib/firebase.ts` (`app`/`auth`/`db`/`storage`), lendo a config das variáveis `NEXT_PUBLIC_FIREBASE_*` em `.env.local` (gitignored, nunca hardcoded em código fonte). Analytics (`getAnalytics`) não foi inicializado ainda — não é usado por nenhuma tela.
- **Vercel**: deploy do Next.js com variáveis de ambiente apontando para o projeto Firebase correspondente (preview = dev, produção = prod).

---

## 6. Pendências técnicas

1. **6.1 — Template do certificado (PDF).** Depende do item 8.1 de `requisitos.md` (layout oficial da Fatec). Só então se escolhe a biblioteca de geração (ex: `@react-pdf/renderer`, Puppeteer/HTML-to-PDF ou `pdf-lib`) dentro da Cloud Function.
2. **6.2 — Modelo de dados** listado na seção 2 é preliminar; será revisado ao iniciar a modelagem detalhada/protótipo.
3. **6.3 — Mecânica exata do aceite final (RF-19).** Depende da pendência 8.2 de `requisitos.md`: botão por trabalho, ação em lote, ou automático.
4. ~~**6.4 — Criação de conta Organização (RN-14).**~~ **Encerrada na v7** — o perfil voltou ao formulário de criação de usuário, usa o mesmo caminho técnico de avaliador/admin (Cloud Function callable restrita a `papel == "admin"`).
5. **6.5 — Classificação/decisão dos vencedores em Resultado, nova na v7.** Depende da pendência 8.4 de `requisitos.md`: ainda não há especificação de como/quando os melhores trabalhos são decididos após a etapa Resultado (lista simples). Não modelar dados nem UI para isso sem definição prévia.
6. **6.6 — Atribuições evento/área do protótipo são ilustrativas, nova na v8.** Ver pendência 8.5 de `requisitos.md`: os pares evento/área usados no protótipo (Ana Carolina, Prof. Renato Alves) são só para demonstrar a Security Rule de escopo por evento funcionando visualmente, não atribuições reais confirmadas.
7. ~~**6.7 — `PersonaSwitcher` é descartável.**~~ **Encerrada em 2026-08-17** — removido junto com `personas.ts`/`avaliadorAssignments.ts`/`organizacaoAssignments.ts`; toda persona agora vem da sessão real (`useAuth()`).
8. ~~**6.8 — Migração de dados mock para Firestore real.**~~ **Encerrada em 2026-08-17** — todas as telas migradas, ver status v11 acima.
9. **6.9 — Sem serviço de e-mail configurado, nova em 2026-08-17.** A extensão Firebase "Trigger Email" (prevista na seção 1) não foi instalada ainda. Efeitos práticos: a senha temporária de uma conta criada pela tela de Usuários é devolvida na tela para o Admin repassar manualmente (não enviada por e-mail); "Redefinir senha" usa `sendPasswordResetEmail`, que o próprio Firebase Auth já envia sem precisar da extensão — esse caso não é afetado.
10. **6.10 — Sem separação de ambiente dev/prod, nova em 2026-08-17.** Só existe o projeto `fateclab-4cc74` — a separação `-dev`/`-prod` da seção 5 (v1 deste documento) não foi feita. Aceitável enquanto o sistema não estiver em uso real pela comunidade acadêmica.
11. **6.11 — Sem índices compostos avaliados, nova em 2026-08-17.** As queries atuais (`where` simples ou `in`) não deveriam precisar de índice composto no Firestore, mas isso só se confirma rodando contra dados reais — se o console acusar "query requires an index", criar o índice sugerido pelo próprio link de erro do Firestore.
12. **6.12 — Conta de aluno criada pelo Admin não passa pela validação de RA/vínculo, nova em 2026-08-24.** A tela de Usuários já permite ao Admin criar uma conta com papel "aluno" (via `/api/usuarios`), mas esse formulário não foi alterado para pedir `vinculoFatec`/`ra` — uma conta criada por ali fica sem o campo `vinculoFatec` (tratada como aluno Fatec pelo default, ver Status v12). Não é um problema de segurança (RN-18 é reforçada nas Security Rules independente disso), só uma inconsistência de dados a resolver se o Admin passar a criar contas de aluno manualmente com frequência.

---

## 7. Aprovação

- [ ] Revisado pelo solicitante
- [ ] Pronto para iniciar o design detalhado / protótipo
