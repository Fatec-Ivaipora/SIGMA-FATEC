import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Declarações de avaliador/moderador da PRÓPRIA pessoa logada (2026-11-27,
 * pedido explícito do usuário — "precisa corrigir para os perfis que foram
 * moderadores e avaliadores conseguirem baixar", "sem mudar o que o Mateus
 * subiu hoje").
 *
 * Por que pelo servidor: desde f07030b, quem era só avaliador/moderador de
 * um evento encerrado volta pro cargo neutro "professor" (sem
 * papeisAvaliacao). As regras do Firestore só deixam ler trabalhos por
 * avaliadorUid/moderadorUid quem TEM esse papel, então a tela de
 * Certificações lida direto do client ficava vazia pra essas contas, mesmo
 * com a declaração liberada. Aqui o Admin SDK lê só os trabalhos em que o
 * próprio uid do token é avaliador/moderador — nunca de outra pessoa — e
 * devolve só o resumo (evento, papel, aceito, liberado), sem nenhum dado
 * dos trabalhos. O download em si continua em GET /api/certificados, que
 * já confere pelo uid (não pelo cargo).
 *
 * Mesma regra de agrupamento da tela: uma declaração por (evento, papel);
 * aparece com pelo menos 1 trabalho aceito; libera o download se algum
 * desses aceitos tiver certificadoLiberado. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const [comoAvaliador, comoModerador] = await Promise.all([
      db.collection("trabalhos").where("avaliadorUid", "==", uid).where("status", "==", "aceito").get(),
      db.collection("trabalhos").where("moderadorUid", "==", uid).where("status", "==", "aceito").get(),
    ]);

    type Grupo = { eventoId: string; papel: "avaliador" | "moderador"; liberado: boolean };
    const grupos = new Map<string, Grupo>();
    const registrar = (eventoId: string, papel: Grupo["papel"], liberado: boolean) => {
      const chave = `${eventoId}_${papel}`;
      const atual = grupos.get(chave) ?? { eventoId, papel, liberado: false };
      atual.liberado = atual.liberado || liberado;
      grupos.set(chave, atual);
    };
    for (const d of comoAvaliador.docs) registrar(d.data().eventoId as string, "avaliador", d.data().certificadoLiberado === true);
    for (const d of comoModerador.docs) registrar(d.data().eventoId as string, "moderador", d.data().certificadoLiberado === true);

    const eventoIds = [...new Set([...grupos.values()].map((g) => g.eventoId))];
    const eventos = eventoIds.length ? await db.getAll(...eventoIds.map((id) => db.doc(`eventos/${id}`))) : [];
    const nomeEvento = new Map(eventos.map((e) => [e.id, (e.data()?.nome as string | undefined) ?? e.id]));

    return NextResponse.json({
      declaracoes: [...grupos.values()].map((g) => ({ ...g, eventoNome: nomeEvento.get(g.eventoId) ?? g.eventoId })),
    });
  } catch (e) {
    console.error("Erro ao listar declarações:", e);
    return NextResponse.json({ erro: "Erro interno ao listar as declarações." }, { status: 500 });
  }
}
