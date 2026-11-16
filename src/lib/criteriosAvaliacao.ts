// Escala e critérios da Avaliação (resumo) — movidos de
// src/app/avaliador/trabalhos/page.tsx em 2026-11-06 pra comissão
// organizadora usar exatamente os mesmos critérios ao dar nota pelos
// trabalhos que estavam em revisão (ver aba Revisão em src/app/trabalhos).

// Escala de nota por critério — cada painel (Avaliação/Apresentação) tem a
// sua, não necessariamente igual (2026-11-05, pedido explícito do usuário:
// Apresentação virou 1 a 3 com rótulo, Avaliação continua 1 a 5 sem rótulo).
export type NotaOpcao = { valor: number; label?: string };
export const NOTAS_AVALIACAO: NotaOpcao[] = [1, 2, 3, 4, 5].map((valor) => ({ valor }));
// `peso` (2026-11-16, pedido explícito do usuário — rubrica de banca de
// TCC) — os critérios de MAC acima ficam sem usar esse campo (continuam
// somados sem peso nenhum em PainelTrabalhos, inalterado); só
// CRITERIOS_BANCA_TCC abaixo usa, porque os 7 critérios da banca têm pesos
// diferentes (2, 2, 0.5, 1, 2, 0.5, 2) somando 10 — a tela de banca (não é
// PainelTrabalhos, é um componente novo, a rubrica aqui não tem nada em
// comum com o fluxo de revisão/prazo/comentário de MAC) pondera na mão.
export type CriterioDef = { key: string; label: string; descricao: string; peso?: number };

// Escala por critério da banca de TCC (2026-11-16) — cada um tem um peso
// (máximo) diferente, então não dá pra usar uma escala ÚNICA pra todos como
// NOTAS_AVALIACAO/NOTAS_APRESENTACAO fazem — essa função gera os passos de
// 0.5 em 0.5 até o peso do critério (peso 2 → 0/0.5/1/1.5/2).
export function escalaParaPeso(peso: number): NotaOpcao[] {
  const opcoes: NotaOpcao[] = [];
  for (let v = 0; v <= peso + 1e-9; v += 0.5) opcoes.push({ valor: Number(v.toFixed(1)) });
  return opcoes;
}

// Ficha de avaliação da apresentação oral de TCC (2026-11-16), item a item
// conferido contra "Formulário de avaliação Apresentação Oral.doc" (pasta
// de exemplos da Professora responsável) — 7 critérios somando 10 pontos.
// Preenchido por cada um dos 3 membros da banca (orientador + 2
// avaliadores) separadamente, ver notasBanca em src/lib/data/trabalhos.ts.
export const CRITERIOS_BANCA_TCC: CriterioDef[] = [
  {
    key: "clarezaIdeias",
    label: "Clareza de Ideias",
    descricao: "Expõe as ideias do trabalho de forma clara e compreensível.",
    peso: 2,
  },
  {
    key: "conteudo",
    label: "Conteúdo",
    descricao: "Domínio do conteúdo apresentado, sem insegurança nem lacunas visíveis.",
    peso: 2,
  },
  {
    key: "postura",
    label: "Postura",
    descricao: "Postura adequada durante a apresentação.",
    peso: 0.5,
  },
  {
    key: "tempoApresentacao",
    label: "Tempo de Apresentação",
    descricao: "Respeitou o tempo estabelecido (mínimo 15, máximo 20 minutos).",
    peso: 1,
  },
  {
    key: "producaoSlides",
    label: "Produção dos Slides",
    descricao: "Qualidade visual e organização dos slides.",
    peso: 2,
  },
  {
    key: "estruturaApresentacao",
    label: "Introdução, Desenvolvimento e Conclusão",
    descricao: "A apresentação segue essa estrutura, sem partes faltando.",
    peso: 0.5,
  },
  {
    key: "arguicao",
    label: "Arguição",
    descricao: "Respostas às perguntas da banca durante a arguição.",
    peso: 2,
  },
];

// Critérios do edital do evento (item 6.1) — cada um recebe nota de 1 a 5
// (item 6.2); a nota final somada é o que ranqueia os resumos mais bem
// pontuados. `descricao` (2026-11-03, pedido explícito do usuário —
// "colocar na frente de cada critério a sua descrição") — o edital só
// nomeia os critérios, sem explicar o que cada um significa; texto
// escrito por nós, pode ser ajustado se a comissão científica quiser
// outra redação.
export const CRITERIOS_AVALIACAO: CriterioDef[] = [
  {
    key: "suficiencia",
    label: "Suficiência",
    descricao:
      "O resumo traz informação suficiente (contexto, objetivo, método, resultados) pra dar pra entender do que se trata o trabalho.",
  },
  {
    key: "coerencia",
    label: "Coerência",
    descricao:
      "As partes do resumo se conectam sem contradição — o que foi proposto bate com o que foi apresentado como resultado.",
  },
  {
    key: "estruturaTexto",
    label: "Estrutura do texto",
    descricao:
      "Segue a estrutura esperada pelo edital: introdução, objetivos, materiais e métodos, resultados, considerações finais.",
  },
  {
    key: "clarezaPrecisao",
    label: "Clareza e precisão",
    descricao: "Escrita clara e direta, sem termos vagos, ambíguos ou informação confusa.",
  },
  {
    key: "aplicabilidadeRelevancia",
    label: "Aplicabilidade e relevância",
    descricao:
      "O trabalho tem relevância científica, acadêmica ou social, com contribuição ou aplicação prática reconhecível.",
  },
];
