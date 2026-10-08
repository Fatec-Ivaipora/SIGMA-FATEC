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

// dia (2026-09-30, evento multi-dia — ver Evento.diasEvento) entra no HMAC
// junto com eventoId, não só concatenado no texto do QR: sem isso, o código
// de 8 hex do dia 1 também validaria pro dia 2 na mesma janela de tempo (o
// server só ia ignorar o "dia" declarado no texto, nunca provar que bate
// com o segredo). Evento de 1 dia sempre usa dia=1.
export function codigoParaJanela(
  segredo: string,
  eventoId: string,
  dia: number,
  janela: number,
): string {
  return createHmac("sha256", segredo)
    .update(`${eventoId}:${dia}:${janela}`)
    .digest("hex")
    .slice(0, 8);
}

export function gerarSegredo(): string {
  return randomBytes(24).toString("hex");
}

/** Texto codificado no QR — o organizador exibe isso, o aluno escaneia e
 * manda de volta pra rota de confirmação validar. `operadorUid` (2026-10-08,
 * pedido explícito do usuário — achado real: monitor deixou o QR de um
 * período errado/futuro projetado, e ninguém conseguia saber depois de
 * qual tela aquele scan tinha vindo) é só metadado de auditoria, de quem
 * estava logado gerando esse QR especificamente — NÃO entra no HMAC de
 * `codigoParaJanela` (não precisa: validade do scan continua garantida só
 * por eventoId+dia+janela+codigo; adulterar esse campo não permite forjar
 * presença nenhuma, só faria a atribuição ficar errada, e só quem já
 * controla o que o QR mostra — o próprio operador logado — poderia mudar
 * esse texto antes de exibir). */
export function montarTextoQr(
  eventoId: string,
  dia: number,
  janela: number,
  codigo: string,
  operadorUid: string,
): string {
  return `${eventoId}|${dia}|${janela}|${codigo}|${operadorUid}`;
}

export function interpretarTextoQr(
  texto: string,
): { eventoId: string; dia: number; janela: number; codigo: string; operadorUid: string } | null {
  const partes = texto.split("|");
  if (partes.length !== 5) return null;
  const [eventoId, diaStr, janelaStr, codigo, operadorUid] = partes;
  const dia = Number(diaStr);
  const janela = Number(janelaStr);
  if (!eventoId || !codigo || !operadorUid || !Number.isFinite(dia) || !Number.isFinite(janela)) {
    return null;
  }
  return { eventoId, dia, janela, codigo, operadorUid };
}

/** true se `janela` ainda está dentro da tolerância aceita, a partir de
 * agora — usado tanto pra rejeitar QR velho quanto (com folga pequena) QR
 * de um relógio ligeiramente adiantado. */
export function janelaValida(janela: number, agora: number = Date.now()): boolean {
  const atual = janelaAtual(agora);
  return janela <= atual && atual - janela <= TOLERANCIA_JANELAS;
}
