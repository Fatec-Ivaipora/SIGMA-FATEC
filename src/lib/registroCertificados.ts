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

/** Só consulta se já existe, sem criar nem tocar no contador (2026-10-20,
 * achado real pós-deploy: "evento encerrado" não pode bloquear quem JÁ
 * tinha número atribuído antes de encerrar — numeração em lote na hora de
 * "Liberar certificados" já cobre todo mundo elegível naquele momento, e
 * reimprimir o PDF depois não consome número novo nenhum, não tem risco
 * de colidir com a sequência de outro evento. O bloqueio de
 * "evento.encerrado" em ../api/certificados/route.ts só deve valer pra
 * quem geraria um número NOVO — ou seja, quando essa função devolve
 * `null`. */
export async function numeroRegistroExistente(chave: string): Promise<number | null> {
  const snap = await getAdminDb().doc(`registrosCertificados/${chave}`).get();
  return (snap.data()?.numero as number | undefined) ?? null;
}

/** Mesma regra de `obterNumeroRegistro`, mas pra muitos de uma vez (2026-11-04,
 * achado real: a impressão dos 299 certificados da X MAC fazia 299 transações
 * seguidas e estourava o tempo da função — o PDF nunca voltava). Lê todos os
 * registros numa leitura só; quem já tem número mantém; os que faltam recebem
 * números em sequência, na ordem da lista, em transações de até 200 por vez
 * (limite de escrita da transação do Firestore). Devolve chave -> número. */
export async function obterNumerosRegistroEmLote(
  itens: { chave: string; nome: string }[],
  eventoId: string,
  numeroInicial: number,
): Promise<Map<string, number>> {
  const db = getAdminDb();
  const resultado = new Map<string, number>();
  if (itens.length === 0) return resultado;
  const existentes = await db.getAll(...itens.map((i) => db.doc(`registrosCertificados/${i.chave}`)));
  existentes.forEach((s, idx) => {
    const n = s.data()?.numero as number | undefined;
    if (n) resultado.set(itens[idx].chave, n);
  });
  const faltam = itens.filter((i) => !resultado.has(i.chave));
  const contadorRef = db.doc(`contadores/certificados_${eventoId}`);
  for (let ini = 0; ini < faltam.length; ini += 200) {
    const lote = faltam.slice(ini, ini + 200);
    await db.runTransaction(async (tx) => {
      const refs = lote.map((i) => db.doc(`registrosCertificados/${i.chave}`));
      const [contadorSnap, ...snaps] = await tx.getAll(contadorRef, ...refs);
      let proximo = (contadorSnap.data()?.proximo as number | undefined) ?? numeroInicial;
      snaps.forEach((s, idx) => {
        const ja = s.data()?.numero as number | undefined;
        if (ja) {
          resultado.set(lote[idx].chave, ja);
          return;
        }
        resultado.set(lote[idx].chave, proximo);
        tx.set(refs[idx], {
          numero: proximo,
          livro: "01",
          eventoId,
          nome: lote[idx].nome,
          criadoEm: FieldValue.serverTimestamp(),
        });
        proximo++;
      });
      tx.set(contadorRef, { proximo }, { merge: true });
    });
  }
  return resultado;
}
