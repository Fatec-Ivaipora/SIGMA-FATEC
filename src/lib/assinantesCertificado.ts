/** Quem pode assinar o certificado, por cargo (2026-09-30) — antes
 * "Diretor Acadêmico"/"Coordenador" no formulário de Eventos eram texto
 * livre, mas a imagem da assinatura digitalizada sempre foi fixa por cargo
 * (ver ASSINATURA_RONI/ASSINATURA_JOAO em src/lib/certificadosPdf.tsx): se
 * alguém digitasse um nome diferente do esperado, o PDF saía com a
 * assinatura de outra pessoa embaixo de um nome errado — ninguém tinha
 * reparado ainda porque só um nome de cada cargo foi usado até hoje. Agora
 * o formulário (src/app/eventos/page.tsx) só deixa escolher entre esses
 * nomes, então esse descompasso não tem mais como acontecer.
 *
 * Arquivo separado de certificadosPdf.tsx (2026-09-30) de propósito: aquele
 * usa `fs`/`node:path` pra ler os arquivos de imagem (só roda no servidor),
 * este é só as strings dos nomes, importável também pelo formulário de
 * Eventos, que é client component.
 *
 * Pra adicionar alguém novo: (1) conseguir a assinatura digitalizada,
 * recortada igual as existentes em public/certificados/; (2) cadastrar o
 * arquivo + a imagem em certificadosPdf.tsx (ASSINATURA_* e o mapa
 * IMAGEM_POR_DIRETOR/IMAGEM_POR_COORDENADOR); (3) acrescentar o nome aqui. */
export const ASSINANTES_DIRETOR = ["Ronielison Barbosa Ferreira"] as const;
export const ASSINANTES_COORDENADOR = ["João Felipe Marques da Silva"] as const;
