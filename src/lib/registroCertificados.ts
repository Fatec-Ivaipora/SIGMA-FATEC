import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

/** Get-or-create: reaproveita o número já atribuído a essa chave se já
 * existir; senão incrementa o contador desse evento numa transação e grava.
 * Contador escopado por evento (2026-09-04, não é mais um contador global
 * único) — cada evento tem seu próprio "livro" de registro, e a organização
 * define em que número ele começa (evento.numeroRegistroInicial, decidido
 * junto com a comissão fora do sistema); os certificados seguintes DESSE
 * evento saem em sequência a partir daí. Ausente = começa em 1.
 *
 * Extraído de /api/certificados/route.ts pra cá (2026-10-19) pra poder ser
 * chamado também de /api/certificados/liberar (numeração em lote na hora
 * de liberar, não só uma por uma quando cada pessoa baixa — ver comentário
 * lá). */
export async function obterNumeroRegistro(
  chave: string,
  eventoId: string,
  numeroInicial: number,
  // nome (2026-10-19, pedido explícito do usuário) — guardado junto do
  // registro pra alimentar a Ata (GET /api/certificados/ata, lista todo
  // mundo registrado num evento do primeiro ao último número, sem
  // precisar decifrar nome a partir da chave).
  nome: string,
): Promise<number> {
  const db = getAdminDb();
  const registroRef = db.doc(`registrosCertificados/${chave}`);
  const contadorRef = db.doc(`contadores/certificados_${eventoId}`);

  return db.runTransaction(async (tx) => {
    const registroSnap = await tx.get(registroRef);
    const existente = registroSnap.data()?.numero as number | undefined;
    if (existente) return existente;

    const contadorSnap = await tx.get(contadorRef);
    const numero = (contadorSnap.data()?.proximo as number | undefined) ?? numeroInicial;

    tx.set(contadorRef, { proximo: numero + 1 }, { merge: true });
    tx.set(registroRef, {
      numero,
      livro: "01",
      eventoId,
      nome,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return numero;
  });
}
