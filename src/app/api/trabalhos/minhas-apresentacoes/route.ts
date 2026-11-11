import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Sala e horário de apresentação dos trabalhos do PRÓPRIO aluno (dono ou
 * coautor) — 2026-11-11, pedido explícito do usuário: "vamos colocar para
 * eles verem". O aluno não lê /sessoes nem /salas pelas regras do Firestore
 * (só admin/organização/moderador), então a consulta roda aqui com o admin
 * SDK e devolve só o que é dele. Horário individual = mesmo cálculo do PDF
 * do ensalamento (src/app/api/ensalamento/pdf/route.ts): início da sessão +
 * posição × duracaoApresentacaoMinutos, só na modalidade oral. */

export type ApresentacaoAluno = {
  sala: string;
  horario: string | null;
  bloco: string;
  dia: string;
  modalidade: "oral" | "roda_conversa";
};

const fuso = { timeZone: "America/Sao_Paulo" } as const;
const hora = (d: Date) => d.toLocaleString("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit" });
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit" });

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const db = getAdminDb();
  const [comoDono, comoCoautor] = await Promise.all([
    db.collection("trabalhos").where("alunoUid", "==", uid).get(),
    db.collection("trabalhos").where("participantesUids", "array-contains", uid).get(),
  ]);
  const meus = new Set([...comoDono.docs, ...comoCoautor.docs].map((d) => d.id));
  const eventoIds = [
    ...new Set([...comoDono.docs, ...comoCoautor.docs].map((d) => d.data().eventoId as string)),
  ];
  if (meus.size === 0 || eventoIds.length === 0) return NextResponse.json({ apresentacoes: {} });

  const apresentacoes: Record<string, ApresentacaoAluno> = {};
  const nomesSala = new Map<string, string>();

  for (const eventoId of eventoIds) {
    const [eventoSnap, sessoesSnap] = await Promise.all([
      db.doc(`eventos/${eventoId}`).get(),
      db.collection("sessoes").where("eventoId", "==", eventoId).get(),
    ]);
    const duracaoMin = (eventoSnap.data()?.duracaoApresentacaoMinutos as number | undefined) ?? 0;
    for (const sd of sessoesSnap.docs) {
      const s = sd.data();
      const ids = (s.trabalhoIds as string[] | undefined) ?? [];
      const inicio = s.horarioInicio.toDate() as Date;
      const fim = s.horarioFim.toDate() as Date;
      for (let i = 0; i < ids.length; i++) {
        if (!meus.has(ids[i])) continue;
        const salaId = s.salaId as string;
        if (!nomesSala.has(salaId)) {
          const salaSnap = await db.doc(`salas/${salaId}`).get();
          nomesSala.set(salaId, String(salaSnap.data()?.nome ?? salaId).toLocaleUpperCase("pt-BR"));
        }
        const oral = s.modalidade === "oral";
        apresentacoes[ids[i]] = {
          sala: nomesSala.get(salaId)!,
          horario:
            oral && duracaoMin > 0
              ? hora(new Date(inicio.getTime() + i * duracaoMin * 60000))
              : null,
          bloco: `${hora(inicio)} às ${hora(fim)}`,
          dia: dia(inicio),
          modalidade: oral ? "oral" : "roda_conversa",
        };
      }
    }
  }

  return NextResponse.json({ apresentacoes });
}
