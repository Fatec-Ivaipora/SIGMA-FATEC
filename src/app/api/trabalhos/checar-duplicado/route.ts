import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Validação de duplicidade (2026-10-21, pedido explícito do usuário — regra
 * 2 de "regras do app/regras_da_aplicação.md", que nunca tinha sido
 * implementada). Achado real: colega A envia o trabalho e adiciona B como
 * autor; B, sem saber, envia o MESMO trabalho de novo adicionando A — e o
 * sistema aceitava, ficando dois trabalhos iguais no evento.
 *
 * Roda no servidor porque o aluno só enxerga os próprios trabalhos (regra
 * do Firestore) — daqui dá pra olhar o evento inteiro. Chamado pelo client
 * antes do addDoc da submissão (ver checarTrabalhoDuplicado em
 * src/lib/checarDuplicado.ts). Só bloqueia quando é o MESMO GRUPO enviando
 * de novo (2026-10-21, decisão do usuário — "só a validação se já existe o
 * trabalho e quem enviou"), e a mensagem sempre diz quem já enviou:
 *  1. mesmo título no mesmo evento (ignorando maiúscula, acento e espaços)
 *     E pelo menos uma pessoa em comum entre os autores dos dois envios;
 *  2. já existe trabalho no evento em que EU já estou como autor (aceito ou
 *     convite pendente) e cujo dono está entre os autores que eu adicionei —
 *     mesmo que o título tenha mudado.
 * Título igual entre pessoas SEM ligação nenhuma passa (ex.: dois alunos
 * que escolheram o mesmo tema), e participar de trabalhos DIFERENTES no
 * mesmo evento continua liberado. */

function normalizarTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

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

  const { eventoId, titulo, participantesUids } = (await request.json()) as {
    eventoId?: string;
    titulo?: string;
    participantesUids?: string[];
  };
  if (!eventoId || !titulo) {
    return NextResponse.json({ erro: "eventoId e titulo são obrigatórios." }, { status: 400 });
  }

  const tituloNormalizado = normalizarTitulo(titulo);
  const meusAutores = new Set(participantesUids ?? []);

  const trabalhosSnap = await getAdminDb()
    .collection("trabalhos")
    .where("eventoId", "==", eventoId)
    .get();

  for (const doc of trabalhosSnap.docs) {
    const t = doc.data();
    const autoresDele = [
      ...((t.participantesUids as string[] | undefined) ?? []),
      ...((t.convitesPendentes as string[] | undefined) ?? []),
    ];

    const pessoasDele = [t.alunoUid as string, ...autoresDele];
    const temPessoaEmComum = pessoasDele.some((p) => p === uid || meusAutores.has(p));
    if (
      temPessoaEmComum &&
      normalizarTitulo((t.titulo as string | undefined) ?? "") === tituloNormalizado
    ) {
      const souAutor = t.alunoUid === uid || autoresDele.includes(uid);
      return NextResponse.json({
        duplicado: true,
        mensagem: souAutor
          ? `Esse trabalho já foi enviado por ${t.alunoNome} e você já está nele como autor — não precisa enviar de novo. Veja em "Meus trabalhos" (se tiver convite pendente, é só aceitar).`
          : `Esse trabalho já foi enviado por ${t.alunoNome}, com autores do seu grupo. Se você faz parte dele, peça pra ${t.alunoNome} te adicionar como autor em vez de enviar de novo.`,
      });
    }

    if (autoresDele.includes(uid) && meusAutores.has(t.alunoUid as string)) {
      return NextResponse.json({
        duplicado: true,
        mensagem: `${t.alunoNome} já enviou o trabalho "${t.titulo}" com você como autor — não precisa enviar de novo. Veja em "Meus trabalhos" (se tiver convite pendente, é só aceitar).`,
      });
    }
  }

  return NextResponse.json({ duplicado: false });
}
