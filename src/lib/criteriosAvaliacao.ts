// Escala e critérios da Avaliação (resumo) — movidos de
// src/app/avaliador/trabalhos/page.tsx em 2026-11-06 pra comissão
// organizadora usar exatamente os mesmos critérios ao dar nota pelos
// trabalhos que estavam em revisão (ver aba Revisão em src/app/trabalhos).

// Escala de nota por critério — cada painel (Avaliação/Apresentação) tem a
// sua, não necessariamente igual (2026-11-05, pedido explícito do usuário:
// Apresentação virou 1 a 3 com rótulo, Avaliação continua 1 a 5 sem rótulo).
export type NotaOpcao = { valor: number; label?: string };
export const NOTAS_AVALIACAO: NotaOpcao[] = [1, 2, 3, 4, 5].map((valor) => ({ valor }));
export type CriterioDef = { key: string; label: string; descricao: string };

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
