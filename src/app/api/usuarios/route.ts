import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { ROTA_POR_PAPEL } from "@/lib/auth";

const LABEL_PAPEL: Record<string, string> = {
  avaliador: "avaliador(a)",
  orientador: "orientador(a)",
  moderador: "moderador(a)",
};

function listarLabels(papeis: string[]): string {
  const labels = papeis.map((p) => LABEL_PAPEL[p]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

type AtribuicaoEvento = { eventoId: string; areasTematicas?: string[] };

type CriarUsuarioBody = {
  nome: string;
  email: string;
  papel: "aluno" | "avaliador" | "organizacao" | "admin" | "orientador" | "moderador";
  atribuicoesEventos?: AtribuicaoEvento[];
  // Papéis combináveis (2026-08-26) — ver PAPEIS_AVALIACAO em src/lib/auth.tsx.
  papeisAvaliacao?: ("avaliador" | "orientador" | "moderador")[];
};

function senhaTemporaria(): string {
  return randomBytes(9).toString("base64url");
}

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

  const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
  if (chamadorDoc.data()?.papel !== "admin") {
    return NextResponse.json(
      { erro: "Só o Admin pode criar novos usuários." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as CriarUsuarioBody;
  if (!body.nome?.trim() || !body.email?.trim() || !body.papel) {
    return NextResponse.json({ erro: "Nome, e-mail e papel são obrigatórios." }, {
      status: 400,
    });
  }

  const senha = senhaTemporaria();

  let uid: string;
  try {
    const contaCriada = await getAdminAuth().createUser({
      email: body.email.trim(),
      password: senha,
      displayName: body.nome.trim(),
    });
    uid = contaCriada.uid;
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    const mensagem =
      codigo === "auth/email-already-exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta no Authentication.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  const db = getAdminDb();
  await db
    .doc(`usuarios/${uid}`)
    .set({
      nome: body.nome.trim(),
      email: body.email.trim(),
      papel: body.papel,
      ...(body.atribuicoesEventos && body.atribuicoesEventos.length > 0
        ? {
            atribuicoesEventos: body.atribuicoesEventos,
            eventosPermitidos: body.atribuicoesEventos.map((a) => a.eventoId),
          }
        : {}),
      ...(body.papeisAvaliacao && body.papeisAvaliacao.length > 0
        ? { papeisAvaliacao: body.papeisAvaliacao }
        : {}),
      // Conta criada pelo admin com senha gerada na hora (nunca escolhida pela
      // pessoa) — força trocar no primeiro login via SenhaTemporariaGate,
      // senão a pessoa loga uma vez, nunca troca, e esquece a senha depois
      // (nunca foi dela pra começo de conversa).
      senhaTemporaria: true,
    });

  // Espelho público (2026-09-08, ver firestore.rules) — só pra "aluno",
  // mesmo padrão do autocadastro (src/app/cadastro/aluno/page.tsx). Admin
  // não coleta vinculoFatec nesse form — ausente equivale a true (aluno da
  // Fatec), mesmo default já usado no resto do app.
  if (body.papel === "aluno") {
    await db.doc(`usuariosPublicos/${uid}`).set({
      nome: body.nome.trim(),
      email: body.email.trim(),
    });
  }

  // Avisa quem foi cadastrado como avaliador/orientador/moderador
  // (2026-09-11, pedido explícito) — junta o papel primário com os extras
  // de papeisAvaliacao num Set, pra não mandar dois e-mails se alguém for
  // criado já com "também atua como" marcado. Melhor esforço — falha de
  // e-mail nunca deve derrubar a criação da conta, que já aconteceu acima.
  const papeisDeAvaliacao = new Set<string>();
  if (body.papel in LABEL_PAPEL) papeisDeAvaliacao.add(body.papel);
  for (const p of body.papeisAvaliacao ?? []) papeisDeAvaliacao.add(p);
  if (papeisDeAvaliacao.size > 0) {
    try {
      const labels = listarLabels(Array.from(papeisDeAvaliacao));
      const rota = ROTA_POR_PAPEL[body.papel];
      await enviarEmail({
        to: body.email.trim(),
        subject: `Você foi cadastrado(a) como ${labels} no SIGMA`,
        html: modeloEmail(
          `<p>Você foi cadastrado(a) como <strong>${labels}</strong> no SIGMA, o sistema de submissão e avaliação de trabalhos acadêmicos da Fatec Ivaiporã.</p>
           <p>A coordenação vai te passar a senha temporária de acesso — no primeiro login, o sistema pede pra você trocar por uma senha sua.</p>`,
          { texto: "Entrar no SIGMA", href: `${URL_SISTEMA}${rota}` },
          body.nome.trim(),
        ),
      });
    } catch {
      // melhor esforço — não derruba a criação da conta.
    }
  }

  return NextResponse.json({ uid, senhaTemporaria: senha });
}

export async function DELETE(request: Request) {
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

  const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
  if (chamadorDoc.data()?.papel !== "admin") {
    return NextResponse.json(
      { erro: "Só o Admin pode excluir usuários." },
      { status: 403 },
    );
  }

  const { uid } = (await request.json()) as { uid: string };
  if (!uid) {
    return NextResponse.json({ erro: "uid é obrigatório." }, { status: 400 });
  }

  await getAdminAuth().deleteUser(uid);
  await getAdminDb().doc(`usuarios/${uid}`).delete();
  // Best-effort — só existe pra "aluno" (ver POST acima), mas apagar um doc
  // inexistente não dá erro no Admin SDK.
  await getAdminDb().doc(`usuariosPublicos/${uid}`).delete();

  return NextResponse.json({ ok: true });
}
