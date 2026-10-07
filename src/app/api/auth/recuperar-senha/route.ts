import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

async function gerarEEnviar(emailNormalizado: string) {
  const usuario = await getAdminAuth().getUserByEmail(emailNormalizado);
  // generatePasswordResetLink sempre devolve um link que passa primeiro
  // pela página intermediária hospedada pelo próprio Firebase
  // (`{authDomain}/__/auth/action`, que só depois redireciona pra `url`)
  // — `handleCodeInApp` NÃO muda isso (só afeta o sendPasswordResetEmail
  // do client, que já não usamos mais). Achado real (2026-10-07): essa
  // página intermediária chama a API do Google com referer
  // `fateclab-4cc74.firebaseapp.com`, e a chave de API do projeto só
  // libera o domínio de produção como referer permitido — a chamada
  // tomava 403 (API_KEY_HTTP_REFERRER_BLOCKED), página em branco com erro
  // cru em JSON. Solução: extrai só o oobCode do link gerado e monta o
  // link do e-mail apontando DIRETO pra nosso /redefinir-senha (que já lê
  // oobCode da URL sozinho, ver redefinir-senha/page.tsx) — nunca passa
  // pela intermediária do Firebase, não depende de mais nenhuma
  // configuração no Google Cloud Console.
  const linkGerado = await getAdminAuth().generatePasswordResetLink(emailNormalizado, {
    url: `${URL_SISTEMA}/redefinir-senha`,
  });
  const oobCode = new URL(linkGerado).searchParams.get("oobCode");
  const link = `${URL_SISTEMA}/redefinir-senha?oobCode=${encodeURIComponent(oobCode ?? "")}`;
  await enviarEmail({
    to: emailNormalizado,
    subject: "Redefinição de senha — SIGMA",
    html: modeloEmail(
      `<p>Recebemos um pedido pra redefinir a senha da sua conta no SIGMA.</p>
       <p>Se não foi você quem pediu, pode ignorar esse e-mail — sua senha continua a mesma.</p>`,
      { texto: "Criar senha nova", href: link },
      usuario.displayName,
    ),
  });
}

/** Pedido de redefinição de senha (2026-10-07) — substitui o
 * `sendPasswordResetEmail` direto do client (Firebase Auth manda o
 * e-mail pelo próprio servidor dele, `noreply@<projeto>.firebaseapp.com`,
 * separado de todo o resto do sistema) por esse caminho: gera o link pelo
 * Admin SDK e manda pelo mesmo canal confiável de todo outro e-mail do
 * SIGMA (`enviarEmail()` → coleção `mail` → extensão Trigger Email).
 * Achado real: aluno relatou que o e-mail de autoatendimento nunca
 * chegava, e o admin relatou que o link que ele mandava manualmente
 * chegava "já expirado" — a suspeita é filtro de spam/entrega do servidor
 * de e-mail próprio do Firebase, que esse canal evita.
 *
 * Authorization OPCIONAL (2026-10-07) — sem token: é o "esqueci minha
 * senha" do autoatendimento (/recuperar-senha), SEMPRE responde
 * {ok:true} mesmo se o e-mail não existir, nunca confirma pra um
 * visitante anônimo se uma conta existe. Com token de Admin: é o botão
 * "Redefinir senha" de /usuarios — aí sim devolve o erro de verdade
 * (ex.: `auth/user-not-found`, achado real quando o e-mail tinha acabado
 * de ser editado) porque o admin já escolheu esse e-mail na própria tela
 * de gestão, não tem o que esconder dele. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email) {
    return NextResponse.json({ erro: "E-mail é obrigatório." }, { status: 400 });
  }
  const emailNormalizado = email.toLowerCase();

  // Papel mora no Firestore, não no token (ver src/lib/auth.tsx — mesmo
  // critério de toda outra rota /api/* desse projeto).
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let souAdmin = false;
  if (idToken) {
    try {
      const chamadorUid = (await getAdminAuth().verifyIdToken(idToken)).uid;
      const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
      souAdmin = chamadorDoc.data()?.papel === "admin";
    } catch {
      // token inválido/expirado — trata como chamada pública (sem detalhe
      // de erro), nunca derruba o pedido de redefinição por causa disso.
    }
  }

  if (souAdmin) {
    try {
      await gerarEEnviar(emailNormalizado);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      const mensagem =
        codigo === "auth/user-not-found"
          ? "Esse e-mail não existe no Authentication."
          : "Não foi possível enviar o link. Tente de novo.";
      return NextResponse.json({ erro: mensagem, codigo }, { status: 400 });
    }
  }

  // Caminho público — nunca revela se o e-mail existe.
  try {
    await gerarEEnviar(emailNormalizado);
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo !== "auth/user-not-found") {
      console.error("Erro ao gerar/enviar link de redefinição de senha:", e);
    }
  }
  return NextResponse.json({ ok: true });
}
