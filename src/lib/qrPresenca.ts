import { createHmac, randomBytes } from "node:crypto";

/** Confirmação de presença por QR rotativo (2026-09-23, evento "simples") —
 * mesmo princípio do TOTP (código do Google Authenticator), mas sem
 * precisar de nenhum processo agendado: o código de cada "janela" de tempo
 * é calculado na hora, tanto pra desenhar o QR (organizador) quanto pra
 * validar o scan (aluno), a partir do timestamp atual + o segredo fixo
 * desse evento (gerado uma vez, nunca exposto ao client — ver
 * firestore.rules `eventosQr`). Um QR fotografado e mandado pra outra
 * pessoa para de funcionar assim que a janela passa (ver TOLERANCIA_JANELAS
 * abaixo). */

const DURACAO_JANELA_MS = 60_000;
// Quantas janelas pra trás ainda aceita (2026-09-23) — cobre o tempo entre
// a câmera capturar o QR e a confirmação chegar no servidor, sem deixar um
// print antigo valer por muito tempo.
const TOLERANCIA_JANELAS = 1;

export function janelaAtual(agora: number = Date.now()): number {
  return Math.floor(agora / DURACAO_JANELA_MS);
}

export function codigoParaJanela(segredo: string, eventoId: string, janela: number): string {
  return createHmac("sha256", segredo)
    .update(`${eventoId}:${janela}`)
    .digest("hex")
    .slice(0, 8);
}

export function gerarSegredo(): string {
  return randomBytes(24).toString("hex");
}

/** Texto codificado no QR — o organizador exibe isso, o aluno escaneia e
 * manda de volta pra rota de confirmação validar. */
export function montarTextoQr(eventoId: string, janela: number, codigo: string): string {
  return `${eventoId}|${janela}|${codigo}`;
}

export function interpretarTextoQr(
  texto: string,
): { eventoId: string; janela: number; codigo: string } | null {
  const partes = texto.split("|");
  if (partes.length !== 3) return null;
  const [eventoId, janelaStr, codigo] = partes;
  const janela = Number(janelaStr);
  if (!eventoId || !codigo || !Number.isFinite(janela)) return null;
  return { eventoId, janela, codigo };
}

/** true se `janela` ainda está dentro da tolerância aceita, a partir de
 * agora — usado tanto pra rejeitar QR velho quanto (com folga pequena) QR
 * de um relógio ligeiramente adiantado. */
export function janelaValida(janela: number, agora: number = Date.now()): boolean {
  const atual = janelaAtual(agora);
  return janela <= atual && atual - janela <= TOLERANCIA_JANELAS;
}
