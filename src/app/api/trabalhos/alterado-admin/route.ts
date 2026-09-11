import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { registrarAtividade } from "@/lib/atividadesAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

/** Avisa TODOS os autores (dono + colegas, inclusive quem acabou de ser
 * removido na própria edição) quando um admin corrige um trabalho por fora
 * do fluxo normal (2026-09-11, pedido explícito por segurança) — feed da
 * tela inicial + e-mail, sempre, sem exceção. Motivo: um admin com a conta
 * comprometida (ou agindo de má-fé) poderia alterar o trabalho de outra
 * pessoa pra favorecer alguém — com isso, o dono descobre na hora quem
 * mexeu, mesmo sem ter pedido nada. NUNCA chamado pelo próprio dono
 * editando (isso é o fluxo normal, sem aviso) — só quando quem editou não é
 * o alunoUid do trabalho. destinatariosUids vem pronto do client (união dos
 * autores de ANTES e DEPOIS da edição, pra quem foi removido também ficar
 * sabendo) — aqui só valida que quem chamou é admin de verdade. */
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

  const db = getAdminDb();
  const chamadorSnap = await db.doc(`usuarios/${chamadorUid}`).get();
  const chamador = chamadorSnap.data();
  if (chamador?.papel !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { trabalhoId, destinatariosUids } = (await request.json()) as {
    trabalhoId?: string;
    destinatariosUids?: string[];
  };
  if (!trabalhoId || !destinatariosUids || destinatariosUids.length === 0) {
    return NextResponse.json(
      { erro: "trabalhoId e destinatariosUids são obrigatórios." },
      { status: 400 },
    );
  }

  const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
  const trabalho = trabalhoSnap.data();
  if (!trabalho) {
    return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
  }

  const nomeAdmin = (chamador.nome as string | undefined) ?? "Um administrador";
  const destinatariosUnicos = Array.from(new Set(destinatariosUids));

  await Promise.all(
    destinatariosUnicos.map(async (uid) => {
      const snap = await db.doc(`usuarios/${uid}`).get();
      const pessoa = snap.data();
      if (!pessoa) return;

      const texto = `${nomeAdmin}, da coordenação, fez uma alteração no seu trabalho "${trabalho.titulo}".`;
      try {
        await registrarAtividade({
          uid,
          tipo: "trabalho_alterado_admin",
          texto,
          negritos: [nomeAdmin, `"${trabalho.titulo}"`],
          trabalhoId,
          eventoId: trabalho.eventoId,
        });
      } catch {
        // melhor esforço — não é crítico o feed falhar aqui.
      }

      if (!pessoa.email) return;
      try {
        await enviarEmail({
          to: pessoa.email,
          subject: `Alteração administrativa no seu trabalho`,
          html: modeloEmail(
            `<p><strong>${nomeAdmin}</strong>, da coordenação, fez uma alteração no seu trabalho <strong>"${trabalho.titulo}"</strong>.</p>
             <p>Se você não esperava essa mudança, entre em contato com a coordenação pra entender o motivo.</p>`,
            { texto: "Ver trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
            pessoa.nome,
          ),
        });
      } catch {
        // melhor esforço — idem.
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
