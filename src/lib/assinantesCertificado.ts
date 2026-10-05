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
 * recortada (só o rabisco, sem linha/nome/cargo — os 3 já cadastrados em
 * public/certificados/ servem de referência de recorte); (2) escolher um
 * `id` novo (sem espaço, sem acento — vira o nome do arquivo também); (3)
 * salvar a imagem em public/certificados/assinatura-{id}.jpg; (4) acrescentar
 * a entrada aqui; (5) cadastrar o arquivo no mapa IMAGEM_POR_ASSINANTE em
 * src/lib/certificadosPdf.tsx (único lugar que ainda precisa saber onde está
 * o arquivo — esse import usa `fs`/`node:path`, só roda no servidor). */
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
];
