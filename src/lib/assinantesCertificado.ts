/** Quem pode assinar um certificado (2026-10-05, substituiu o modelo antigo
 * de só 2 cargos fixos — "Diretor Acadêmico" e "Coordenador..." — que travou
 * de verdade quando precisou assinar um terceiro cargo, Coordenador de Curso
 * de Medicina, sem ter onde encaixar). Cada evento escolhe, na criação, quais
 * dessas pessoas assinam o certificado DELE (ver `assinantesCertificadoIds`
 * em src/lib/data/eventos.ts) — a lista aqui é só o catálogo de quem já tem
 * assinatura digitalizada cadastrada, não quem assina cada evento.
 *
 * Cadastro continua manual, de propósito (2026-10-05, pedido explícito do
 * usuário: ele passa nome+cargo+foto da assinatura no chat, o resto fica por
 * conta de quem mexe no código) — pra ver a lista cadastrada sem precisar
 * abrir esse arquivo, ver a tela /assinaturas.
 *
 * Pra adicionar alguém novo: (1) conseguir a assinatura digitalizada,
 * recortada (só o rabisco, sem linha/nome/cargo — os já cadastrados em
 * public/certificados/ servem de referência de recorte), de preferência já
 * em traço preto sobre fundo transparente (.png — fica melhor sobre o fundo
 * ilustrado do certificado de apresentação do que tinta colorida numa foto
 * de papel branco, que destaca como um "retângulo" por cima do fundo; ver
 * assinatura-bruno.png); (2) escolher um `id` novo (sem espaço, sem acento —
 * vira o nome do arquivo também); (3) salvar a imagem em
 * public/certificados/assinatura-{id}.png (ou .jpg, se não tiver como gerar
 * com fundo transparente); (4) acrescentar a entrada aqui; (5) cadastrar o
 * arquivo no mapa IMAGEM_POR_ASSINANTE em src/lib/certificadosPdf.tsx (único
 * lugar que ainda precisa saber onde está o arquivo — esse import usa
 * `fs`/`node:path`, só roda no servidor). */
export type AssinanteCertificado = {
  id: string;
  nome: string;
  cargo: string;
};

export const ASSINANTES_CERTIFICADO: AssinanteCertificado[] = [
  { id: "roni", nome: "Ronielison Barbosa Ferreira", cargo: "Diretor Acadêmico" },
  // Conferido contra o edital oficial da X MAC (2026-09-29) — o edital
  // assina só "Coordenador Comissão de Iniciação Científica" (sem "da"
  // entre as duas primeiras palavras, exatamente como está no documento).
  { id: "joao", nome: "João Felipe Marques da Silva", cargo: "Coordenador Comissão de Iniciação Científica" },
  { id: "bruno", nome: "Bruno Maschio Neto", cargo: "Coordenação de Medicina" },
];
