const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Data do evento por extenso, com o ano sempre visível (2026-11-13,
 * pedido explícito do usuário — "X MAC ficou muito pequeno e colocar nome
 * do evento e a data do evento e o ano"). Extraído de src/app/page.tsx
 * (2026-11-16) pra reaproveitar em /certificados — mesmo espírito de
 * formatarPeriodoRealizacao (src/lib/certificadosPdf.tsx), mas client-safe:
 * aquele módulo puxa `@react-pdf/renderer` e `node:fs`, coisa de servidor,
 * não de página pública. */
export function formatarDataEvento(inicio?: string, fim?: string): string {
  if (!inicio) return "";
  const [anoI, mesI, diaI] = inicio.split("-").map(Number);
  if (!fim || fim === inicio) return `${diaI} de ${MESES_PT[mesI - 1]} de ${anoI}`;
  const [anoF, mesF, diaF] = fim.split("-").map(Number);
  if (anoF === anoI && mesF === mesI) {
    return `${diaI} e ${diaF} de ${MESES_PT[mesI - 1]} de ${anoI}`;
  }
  return `${diaI} de ${MESES_PT[mesI - 1]} a ${diaF} de ${MESES_PT[mesF - 1]} de ${anoF}`;
}
