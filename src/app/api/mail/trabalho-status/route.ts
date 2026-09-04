import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

type Tipo = "submetido" | "revisao" | "avaliado" | "aceito" | "nao_aceito";

const CONTEUDO: Record<Tipo, (trabalho: FirebaseFirestore.DocumentData) => { subject: string; html: string }> = {
  submetido: (t) => ({
    subject: `Trabalho enviado — ${t.titulo}`,
    html: modeloEmail(
      `<p>Recebemos o seu trabalho <strong>"${t.titulo}"</strong>. Ele já está na fila de avaliação.</p>
       <p>Você pode acompanhar o andamento a qualquer momento no SIGMA.</p>`,
      { texto: "Acompanhar trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
    ),
  }),
  revisao: (t) => ({
    subject: `Revisão solicitada — ${t.titulo}`,
    html: modeloEmail(
      `<p>O avaliador pediu ajustes no seu trabalho <strong>"${t.titulo}"</strong>.</p>
       ${t.comentarioRevisao ? `<p style="background:#FFF7ED;border-radius:8px;padding:12px 16px;margin:12px 0;"><strong>Comentário:</strong> ${t.comentarioRevisao}</p>` : ""}
       <p>Entre no SIGMA pra corrigir e reenviar.</p>`,
      { texto: "Corrigir trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
    ),
  }),
  avaliado: (t) => ({
    subject: `Trabalho avaliado — ${t.titulo}`,
    html: modeloEmail(
      `<p>Seu trabalho <strong>"${t.titulo}"</strong> já foi avaliado.</p>
       <p>Entre no SIGMA pra acompanhar o resultado.</p>`,
      { texto: "Ver resultado", href: `${URL_SISTEMA}/aluno/trabalhos` },
    ),
  }),
  aceito: (t) => ({
    subject: `Resultado final — ${t.titulo}`,
    html: modeloEmail(
      `<p>Boas notícias! Seu trabalho <strong>"${t.titulo}"</strong> foi <strong>aceito</strong>.</p>`,
      { texto: "Ver detalhes", href: `${URL_SISTEMA}/aluno/trabalhos` },
    ),
  }),
  nao_aceito: (t) => ({
    subject: `Resultado final — ${t.titulo}`,
    html: modeloEmail(
      `<p>O resultado final do seu trabalho <strong>"${t.titulo}"</strong> já está disponível no SIGMA.</p>`,
      { texto: "Ver detalhes", href: `${URL_SISTEMA}/aluno/trabalhos` },
    ),
  }),
};

/** E-mail de mudança de status do trabalho — um endpoint só pros 5 tipos
 * (mesmo formato: busca o trabalho, checa quem pode disparar cada tipo,
 * monta o e-mail, notifica o dono do trabalho). Chamado pelo client logo
 * depois do updateDoc que muda o status de verdade — nunca cria/edita nada
 * aqui, só notifica. */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let chamadorUid: string;
  try {
    chamadorUid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const { trabalhoId, tipo } = (await request.json()) as { trabalhoId?: string; tipo?: Tipo };
  if (!trabalhoId || !tipo || !(tipo in CONTEUDO)) {
    return NextResponse.json({ erro: "trabalhoId e tipo (válido) são obrigatórios." }, { status: 400 });
  }

  const db = getAdminDb();
  const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
  const trabalho = trabalhoSnap.data();
  if (!trabalho) {
    return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
  }

  let autorizado = false;
  if (tipo === "submetido") {
    autorizado = trabalho.alunoUid === chamadorUid;
  } else if (tipo === "revisao" || tipo === "avaliado") {
    autorizado = trabalho.avaliadorUid === chamadorUid;
  } else {
    const chamadorSnap = await db.doc(`usuarios/${chamadorUid}`).get();
    const chamador = chamadorSnap.data();
    autorizado =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        !!(chamador?.eventosPermitidos as string[] | undefined)?.includes(trabalho.eventoId));
  }
  if (!autorizado) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const alunoSnap = await db.doc(`usuarios/${trabalho.alunoUid}`).get();
  const aluno = alunoSnap.data();
  if (!aluno?.email) {
    return NextResponse.json({ ok: true });
  }

  const { subject, html } = CONTEUDO[tipo](trabalho);
  await enviarEmail({ to: aluno.email, subject, html });

  return NextResponse.json({ ok: true });
}
