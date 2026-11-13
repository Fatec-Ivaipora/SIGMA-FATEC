import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

/** Lista os eventos com mural de certificados ativo (2026-11-13, pedido
 * explícito do usuário — "essa consulta... tem que estar em um lugar
 * fácil, acho melhor na tela de login em algum menu"). Pública de
 * propósito, igual as outras rotas de .../grupo/* — `eventos` não tem
 * leitura pública nas regras (só `destaque`/logado), por isso precisa
 * dessa rota via Admin SDK em vez de o client ler a coleção direto. */
export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("eventos").where("certificadosGrupoPublicosAtivo", "==", true).get();
    const eventos = snap.docs.map((d) => ({ id: d.id, nome: d.data().nome as string }));
    return NextResponse.json({ eventos });
  } catch (e) {
    console.error("Erro ao listar eventos com mural de certificados:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
