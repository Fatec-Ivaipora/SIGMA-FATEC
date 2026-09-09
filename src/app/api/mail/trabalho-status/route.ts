import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";

type Tipo = "submetido" | "revisao" | "avaliado" | "aceito" | "nao_aceito";

// Texto do feed da tela inicial do aluno (2026-09-09) — frase pronta por
// tipo, mesma ideia do CONTEUDO abaixo (mas pro feed, não pro e-mail).
// eventoNome pode faltar (evento apagado, campo ausente) — sempre com um
// fallback, nunca quebra a frase. `negritos` são as substrings exatas (com
// as mesmas aspas/pontuação usadas em `texto`) que o client destaca em
// negrito — precisa bater caractere a caractere com o que está em `texto`.
const TEXTO_ATIVIDADE: Record<
  Tipo,
  (trabalho: FirebaseFirestore.DocumentData, eventoNome: string) => { texto: string; negritos: string[] }
> = {
  submetido: (t, eventoNome) => ({
    texto: `Você enviou o trabalho "${t.titulo}" para o evento ${eventoNome}.`,
    negritos: [`"${t.titulo}"`, eventoNome],
  }),
  revisao: (t) => ({
    texto: `O avaliador pediu ajustes no seu trabalho "${t.titulo}".`,
    negritos: [`"${t.titulo}"`],
  }),
  avaliado: (t) => ({
    texto: `Seu trabalho "${t.titulo}" foi avaliado.`,
    negritos: [`"${t.titulo}"`],
  }),
  aceito: (t) => ({
    texto: `Seu trabalho "${t.titulo}" foi aceito no resultado final.`,
    negritos: [`"${t.titulo}"`],
  }),
  nao_aceito: (t) => ({
    texto: `O resultado final do seu trabalho "${t.titulo}" já está disponível.`,
    negritos: [`"${t.titulo}"`],
  }),
};

// Assunto não depende do destinatário (só de tipo+título) — separado do
// CONTEUDO abaixo pra não precisar montar um e-mail inteiro só pra pegar o
// assunto (ver loop de destinatários no POST).
const ASSUNTO: Record<Tipo, (trabalho: FirebaseFirestore.DocumentData) => string> = {
  submetido: (t) => `Trabalho enviado — ${t.titulo}`,
  revisao: (t) => `Revisão solicitada — ${t.titulo}`,
  avaliado: (t) => `Trabalho avaliado — ${t.titulo}`,
  aceito: (t) => `Resultado final — ${t.titulo}`,
  nao_aceito: (t) => `Resultado final — ${t.titulo}`,
};

const CONTEUDO: Record<
  Tipo,
  (trabalho: FirebaseFirestore.DocumentData, nome: string | undefined) => string
> = {
  submetido: (t, nome) =>
    modeloEmail(
      `<p>Recebemos o seu trabalho <strong>"${t.titulo}"</strong>. Ele já está na fila de avaliação.</p>
       <p>Você pode acompanhar o andamento a qualquer momento no SIGMA.</p>`,
      { texto: "Acompanhar trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
      nome,
    ),
  revisao: (t, nome) =>
    modeloEmail(
      `<p>O avaliador pediu ajustes no seu trabalho <strong>"${t.titulo}"</strong>.</p>
       ${t.comentarioRevisao ? `<p style="background:#FFF7ED;border-radius:8px;padding:12px 16px;margin:12px 0;"><strong>Comentário:</strong> ${t.comentarioRevisao}</p>` : ""}
       <p>Entre no SIGMA pra corrigir e reenviar.</p>`,
      { texto: "Corrigir trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
      nome,
    ),
  avaliado: (t, nome) =>
    modeloEmail(
      `<p>Seu trabalho <strong>"${t.titulo}"</strong> já foi avaliado.</p>
       <p>Entre no SIGMA pra acompanhar o resultado.</p>`,
      { texto: "Ver resultado", href: `${URL_SISTEMA}/aluno/trabalhos` },
      nome,
    ),
  aceito: (t, nome) =>
    modeloEmail(
      `<p>Boas notícias! Seu trabalho <strong>"${t.titulo}"</strong> foi <strong>aceito</strong>.</p>`,
      { texto: "Ver detalhes", href: `${URL_SISTEMA}/aluno/trabalhos` },
      nome,
    ),
  nao_aceito: (t, nome) =>
    modeloEmail(
      `<p>O resultado final do seu trabalho <strong>"${t.titulo}"</strong> já está disponível no SIGMA.</p>`,
      { texto: "Ver detalhes", href: `${URL_SISTEMA}/aluno/trabalhos` },
      nome,
    ),
};

/** E-mail + atividade da tela inicial de mudança de status do trabalho — um
 * endpoint só pros 5 tipos (mesmo formato: busca o trabalho, checa quem
 * pode disparar cada tipo, notifica o dono E os colegas/autores convidados,
 * exceto em "submetido" — ver comentário mais abaixo). Chamado pelo client
 * logo depois do updateDoc que muda o status de verdade — nunca cria/edita
 * nada aqui, só notifica. */
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

  // Colegas/autores convidados recebem as mesmas notificações do dono
  // (2026-09-09, pedido explícito do usuário: "eles só acompanham... tem as
  // mesmas notificações que o autor que escreveu consegue ver") — exceto em
  // "submetido", onde eles já recebem um e-mail próprio de convite na hora
  // que são adicionados (notificarConviteColega); mandar de novo aqui seria
  // duplicar aviso no mesmo instante.
  const destinatariosUids =
    tipo === "submetido"
      ? [trabalho.alunoUid as string]
      : Array.from(
          new Set([trabalho.alunoUid as string, ...((trabalho.participantesUids as string[] | undefined) ?? [])]),
        );

  const eventoSnap = await db.doc(`eventos/${trabalho.eventoId}`).get();
  const eventoNome = (eventoSnap.data()?.nome as string | undefined) ?? "seu evento";
  const { texto, negritos } = TEXTO_ATIVIDADE[tipo](trabalho, eventoNome);
  const subject = ASSUNTO[tipo](trabalho);

  await Promise.all(
    destinatariosUids.map(async (uid) => {
      const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
      const usuario = usuarioSnap.data();
      if (!usuario) return;

      // Feed da tela inicial (2026-09-09) — melhor esforço, nunca derruba o
      // e-mail abaixo se falhar.
      try {
        await registrarAtividade({
          uid,
          tipo,
          texto,
          negritos,
          trabalhoId,
          eventoId: trabalho.eventoId,
        });
      } catch {
        // idem
      }

      if (!usuario.email) return;
      const html = CONTEUDO[tipo](trabalho, usuario.nome);
      await enviarEmail({ to: usuario.email, subject, html });
    }),
  );

  return NextResponse.json({ ok: true });
}
