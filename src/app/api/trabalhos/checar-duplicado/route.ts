import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ehMesmoTrabalho, type TrabalhoExistente } from "@/lib/duplicidadeTrabalho";

/** Validação de duplicidade (2026-10-21, pedido explícito do usuário — regra
 * 2 de "regras do app/regras_da_aplicação.md", que nunca tinha sido
 * implementada). Achado real: colega A envia o trabalho e adiciona B como
 * autor; B, sem saber, envia o MESMO trabalho de novo adicionando A — e o
 * sistema aceitava, ficando dois trabalhos iguais no evento.
 *
 * Roda no servidor porque o aluno só enxerga os próprios trabalhos (regra
 * do Firestore) — daqui dá pra olhar o evento inteiro. Chamado pelo client
 * antes do addDoc da submissão (ver checarTrabalhoDuplicado em
 * src/lib/checarDuplicado.ts). O que conta como "mesmo trabalho" (título
 * ou grupo + resumo + orientador) está em ehMesmoTrabalho
 * (src/lib/duplicidadeTrabalho.ts). A mensagem sempre diz quem já enviou.
 * Participar de trabalhos DIFERENTES no mesmo evento continua liberado. */
export async function POST(request: Request) {
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

  const { eventoId, titulo, resumo, nomeOrientador, participantesUids } =
    (await request.json()) as {
      eventoId?: string;
      titulo?: string;
      resumo?: string;
      nomeOrientador?: string;
      participantesUids?: string[];
    };
  if (!eventoId || !titulo) {
    return NextResponse.json({ erro: "eventoId e titulo são obrigatórios." }, { status: 400 });
  }

  const novo = {
    uid,
    titulo,
    resumo: resumo ?? "",
    nomeOrientador: nomeOrientador ?? "",
    participantesUids: participantesUids ?? [],
  };

  const trabalhosSnap = await getAdminDb()
    .collection("trabalhos")
    .where("eventoId", "==", eventoId)
    .get();

  for (const doc of trabalhosSnap.docs) {
    const t = doc.data() as TrabalhoExistente & { alunoNome?: string };
    if (!ehMesmoTrabalho(novo, t)) continue;

    const souAutor =
      t.alunoUid === uid ||
      (t.participantesUids ?? []).includes(uid) ||
      (t.convitesPendentes ?? []).includes(uid);
    return NextResponse.json({
      duplicado: true,
      mensagem: souAutor
        ? `Esse trabalho já foi enviado por ${t.alunoNome} ("${t.titulo}") e você já está nele como autor — não precisa enviar de novo. Veja em "Meus trabalhos" (se tiver convite pendente, é só aceitar).`
        : `Esse trabalho já foi enviado por ${t.alunoNome} ("${t.titulo}"), com o mesmo resumo e orientador. Se você faz parte dele, peça pra ${t.alunoNome} te adicionar como autor em vez de enviar de novo.`,
    });
  }

  return NextResponse.json({ duplicado: false });
}
