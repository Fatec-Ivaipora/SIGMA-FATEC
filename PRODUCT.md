# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router, TypeScript, Turbopack) + Tailwind v4. Backend: Firebase (Authentication, Firestore, Cloud Functions, Storage, "Trigger Email" extension). Hosted on Vercel. Decided with the user across prior planning (see `regras do app/requisitos.md` and `regras do app/arquitetura_tecnica.md`), not delegated.

## Users

- **Aluno (autor/apresentador):** cria conta, submete trabalho a um evento, acompanha aprovação do orientador e avaliação, reenvia em caso de correção solicitada.
- **Orientador:** conta própria; aprova ou reprova o trabalho do aluno antes que siga para avaliação.
- **Avaliador (professor):** avalia um trabalho designado, atribui nota e parecer (aceito / não aceito / aceito com correção).
- **Organização (equipe administrativa da Fatec Ivaiporã):** cadastra eventos, confirma aceite final, emite certificados, acompanha dashboard e relatórios (tudo escopado por evento); vê a lista de usuários mas não pode criar/excluir/redefinir senha.
- **Admin:** mesmas permissões da Organização, mais gestão exclusiva de usuários (criar, excluir, redefinir senha de qualquer conta). É o nível de acesso do usuário e do outro dev, para testes completos.

## Product Purpose

Gerenciar o ciclo completo de submissão de trabalhos acadêmicos em eventos institucionais da Fatec Ivaiporã (inicialmente MAC e MOPI, com suporte a novos eventos no futuro): cadastro → submissão → aprovação do orientador → avaliação → correção (com prazo) → aceite final → certificação → relatórios. Sucesso = reduzir o processo hoje manual (planilhas/e-mail) para um fluxo rastreável e com automações de prazo.

## Positioning

Diferente de uma submissão genérica de trabalho (como a ferramenta DOIT usada como referência), este sistema tem **aprovação em duas camadas** (orientador confirma antes do avaliador entrar) e é **multi-evento configurável desde o início**, não construído para um evento único.

## Operating Context

Usado internamente pela comunidade acadêmica da Fatec Ivaiporã: alunos e orientadores em qualquer dispositivo (inclusive celular, fora de sala de aula), avaliadores (professores) e equipe organizadora majoritariamente em desktop. Depende de e-mail (Firebase Auth + extensão Trigger Email) para notificações de cada etapa do fluxo.

## Capabilities and Constraints

Requisitos funcionais completos em `regras do app/requisitos.md` (RF-01 a RF-25). Resumo do essencial:
- Cadastro isolado (sem SSO institucional na v1) para os 4 perfis.
- Verificação de duplicidade de trabalho por título + participantes (texto livre) dentro do mesmo evento.
- Um único avaliador por trabalho; uma única rodada de correção por avaliação, com prazo configurável por evento.
- Reprovação do orientador permite reenvios ilimitados dentro do período de submissão do evento.
- Dois perfis administrativos: Admin (acesso total, inclusive gestão de usuários) e Organização (mesmo acesso operacional, sem gestão de usuários).
- Organização pode marcar um evento como destaque (com imagem) para aparecer na tela inicial pública; no máximo um por vez, sem fallback genérico quando nenhum está marcado.
- Certificados emitidos em PDF com template institucional (layout oficial ainda pendente — ver `regras do app/requisitos.md` item 8.1).
- Dashboard administrativo com contagem por status e exportação de relatórios em PDF.
- Volumetria esperada: 100 a 500 trabalhos por evento.

**Em aberto / não inventar:** template visual oficial do certificado ainda não recebido.

## Brand Commitments

- Nome do produto: **FatecLab** (decidido pelo usuário em 2026-08-13). Aparece como wordmark ao lado da logo institucional (lockup) na home e no login; no app autenticado (sidebar) só a logo institucional é usada.
- Instituição: **Fatec Ivaiporã** (Faculdade de Tecnologia, Vale do Ivaí, PR). Site institucional: https://fatecivaipora.com.br/.
- Logo oficial (versão branca, para fundo escuro): `../exemplos/logoFatec.png`.
- Paleta extraída do CSS do site oficial (não é a paleta genérica usada por outras skills de marketing deste usuário, que é só um placeholder de nicho): azul-marinho primário `#0e3a5e`, laranja de destaque `#ea741c`, azul claro de apoio `#2376b9`, branco `#fff`.
- Tipografia do site oficial: **Poppins** (pesos 100–900).
- Referência de layout para a tela interna (dashboard): screenshot de exemplo em `../exemplos/exemplo.png` (fintech genérico — sidebar + cards; usado como referência de estrutura/polimento, não de conteúdo ou cor).
- Estrutura de telas pedida pelo usuário: Home institucional com carrossel e botão "Entrar" → Login com opções de cadastro como Aluno ou Avaliador → tela interna do sistema (dashboard).

## Evidence on Hand

- `regras do app/regras_da_aplicação.md` — explicação original do fluxo (fonte: transcrição de reunião).
- `regras do app/requisitos.md` — especificação formal de requisitos (RF, RN, RNF, atores, casos de uso).
- `regras do app/arquitetura_tecnica.md` — decisões de stack e mapeamento RF → implementação.
- `../exemplos/exemplo.png` — referência visual de dashboard (estrutura, não marca).
- `../exemplos/logoFatec.png` — logo oficial (versão branca).
- Nenhum depoimento, dado de uso real ou case de cliente existe ainda — não fabricar.

## Product Principles

1. Nenhuma regra de negócio sensível confia só no cliente (duplicidade, permissões de aprovação/avaliação, geração de certificado sempre validadas no backend).
2. Prazos (correção, submissão) são automatizados, não dependem de ação manual da organização para expirar.
3. Organização e Admin têm o mesmo acesso operacional; a única hierarquia é a gestão de usuários, exclusiva do Admin.
4. Simplicidade de MVP: sem SSO, sem agregações pré-computadas, dado o volume esperado (100–500 trabalhos/evento).

## Accessibility & Inclusion

Nenhum requisito específico de acessibilidade foi levantado com o usuário ainda; seguir práticas padrão de acessibilidade web (contraste, navegação por teclado, leitura por screen reader) como piso, sem compromisso adicional confirmado.
