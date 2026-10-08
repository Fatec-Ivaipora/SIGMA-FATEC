import { diasDoEvento } from "./certificadoDias";

/** Quantas "janelas" de presença (QR/confirmação manual) esse evento tem —
 * por padrão, 1 por dia de calendário (diasDoEvento). Eventos com mais de
 * 1 sessão por dia (2026-10-08, pedido explícito do usuário — Semana de
 * Medicina: ontem à noite, hoje manhã+tarde, amanhã manhã+tarde = 5
 * períodos em só 3 dias de calendário) sobrescrevem com `periodosPresenca`
 * direto no Firestore (mesmo padrão de `logoCertificadoId` em
 * src/lib/data/eventos.ts — sem UI própria ainda, é configuração pontual).
 * O número do "dia" gravado em presencasConfirmadas continua sendo só um
 * índice 1..N (ver /api/inscricoes/confirmar-presenca) — nada muda na
 * gravação em si, só quantas janelas existem pra escolher/validar.
 * Ausente = exatamente diasDoEvento(evento), comportamento de sempre. */
export function periodosDoEvento(evento: {
  dataRealizacao?: string;
  dataRealizacaoFim?: string;
  periodosPresenca?: number;
}): number {
  return evento.periodosPresenca && evento.periodosPresenca >= 1
    ? evento.periodosPresenca
    : diasDoEvento(evento);
}

/** Mínimo de períodos confirmados pra liberar o certificado (2026-10-08) —
 * ausente = continua "pelo menos 1", igual a sempre. Setado junto com
 * `periodosPresenca` pra regras tipo "4 dos 5 períodos" (ver
 * /api/certificados). */
export function presencaMinimaDoEvento(evento: { presencaMinimaPeriodos?: number }): number {
  return evento.presencaMinimaPeriodos && evento.presencaMinimaPeriodos >= 1
    ? evento.presencaMinimaPeriodos
    : 1;
}
