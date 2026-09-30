/** Quantos dias o evento dura, a partir do intervalo de datas do
 * certificado (2026-09-30) — substitui o campo separado "Dias do evento"
 * (número digitado à parte, que podia ficar desincronizado da Data de
 * realização: um evento de 3 dias com "Data de realização" mostrando só o
 * primeiro dia saía estranho no certificado — "realizado em 08/10/2026"
 * junto de "carga horária de 16 horas" parecia um evento de 1 dia só de
 * 16h, achado pelo usuário testando a Semana de Medicina). Agora é só
 * "Data de realização" (início) + "Data de término" (fim, opcional) — o
 * certificado imprime o período certo (ver formatarPeriodoRealizacao em
 * src/lib/certificadosPdf.tsx) e as horas por dia saem daqui, sem duplicar
 * a mesma informação em dois campos que podiam discordar. Ausente/igual à
 * data de início = 1 dia (evento de 1 dia só, comportamento de sempre).
 *
 * Arquivo próprio, sem "use client" (2026-09-30) — importável tanto do
 * formulário de Eventos (client) quanto de rotas de API e da geração do PDF
 * (servidor), sem qualquer ambiguidade de bundler. */
export function diasDoEvento(evento: {
  dataRealizacao?: string;
  dataRealizacaoFim?: string;
}): number {
  if (!evento.dataRealizacao || !evento.dataRealizacaoFim) return 1;
  const ms =
    new Date(`${evento.dataRealizacaoFim}T00:00:00`).getTime() -
    new Date(`${evento.dataRealizacao}T00:00:00`).getTime();
  const dias = Math.round(ms / 86_400_000) + 1;
  return dias >= 1 ? dias : 1;
}
