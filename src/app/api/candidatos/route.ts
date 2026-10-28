import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail } from "@/lib/mail";

const NOME_MAX = 120;
const AREA_MAX = 120;

function telefoneLimpo(valor: string): string {
  return valor.replace(/\D/g, "");
}

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

/** Autocadastro público de quem quer ser avaliador/moderador (2026-10-28,
 * pedido explícito do usuário — hoje isso é feito pergunta por pergunta no
 * WhatsApp, "às vezes não conhecemos a pessoa"). Rota 100% pública, sem
 * login — mesmo padrão de /api/cadastro/aluno: valida tudo nela mesma,
 * nunca confia no que já foi validado no client.
 *
 * Duas proteções contra bot/spam, pedidas explicitamente pelo usuário (o
 * projeto não tem reCAPTCHA configurado em lugar nenhum, então não dá pra
 * depender disso sem pedir uma chave nova):
 * - **Honeypot** (`empresa`, campo escondido no form — só um robô preenche
 *   um input que nenhum humano vê): se vier preenchido, finge sucesso sem
 *   gravar nada, pra não ensinar o robô a tentar de novo de outro jeito.
 * - **Upsert por e-mail** — reenviar o mesmo e-mail atualiza o cadastro em
 *   vez de criar um novo (evita acumular lixo se alguém reenviar várias
 *   vezes, de propósito ou não).
 * Validação de tamanho/formato nos campos cobre tentativa de injeção (nunca
 * gravamos HTML bruto, e tudo é renderizado como texto puro no admin). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    areaFormacao?: string;
    telefone?: string;
    email?: string;
    interesses?: string[];
    empresa?: string; // honeypot
  } | null;

  // Honeypot: resposta idêntica a um envio de verdade, só que não grava nada.
  if (body?.empresa) {
    return NextResponse.json({ ok: true });
  }

  const nome = body?.nome?.trim().slice(0, NOME_MAX);
  const areaFormacao = body?.areaFormacao?.trim().slice(0, AREA_MAX);
  const telefone = telefoneLimpo(body?.telefone ?? "");
  const email = body?.email?.trim().toLowerCase();
  const interesses = (body?.interesses ?? []).filter(
    (i): i is "avaliador" | "moderador" => i === "avaliador" || i === "moderador",
  );

  if (!nome || nome.length < 3) {
    return NextResponse.json({ erro: "Informe seu nome completo." }, { status: 400 });
  }
  if (!areaFormacao) {
    return NextResponse.json({ erro: "Informe sua área de formação." }, { status: 400 });
  }
  if (telefone.length < 10 || telefone.length > 11) {
    return NextResponse.json({ erro: "Digite um telefone válido, com DDD." }, { status: 400 });
  }
  if (!email || !emailValido(email)) {
    return NextResponse.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }
  if (interesses.length === 0) {
    return NextResponse.json(
      { erro: "Marque se você quer ser avaliador(a), moderador(a), ou os dois." },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  const existenteSnap = await db
    .collection("candidatosAvaliacao")
    .where("email", "==", email)
    .limit(1)
    .get();

  const dados = {
    nome,
    nomeBusca: nome.toLowerCase(),
    areaFormacao,
    telefone,
    email,
    interesses,
    atualizadoEm: FieldValue.serverTimestamp(),
  };

  if (existenteSnap.empty) {
    await db.collection("candidatosAvaliacao").add({ ...dados, criadoEm: FieldValue.serverTimestamp() });
  } else {
    await existenteSnap.docs[0].ref.update(dados);
  }

  try {
    await enviarEmail({
      to: email,
      subject: "Recebemos suas informações — SIGMA Fatec Ivaiporã",
      html: modeloEmail(
        `<p style="margin:0 0 16px;">Recebemos suas informações pra atuar como ${interesses
          .map((i) => (i === "avaliador" ? "avaliador(a)" : "moderador(a)"))
          .join(" e ")} nos eventos acadêmicos da Fatec Ivaiporã.</p>
         <p style="margin:0;">Nossa comissão científica vai entrar em contato quando precisar de alguém com o seu perfil. Não precisa fazer mais nada por enquanto.</p>`,
        undefined,
        nome,
      ),
    });
  } catch (e) {
    // Melhor esforço — mesmo padrão de /api/usuarios: o cadastro já foi
    // salvo, um e-mail que falhou não pode derrubar a resposta pra pessoa.
    console.error("Candidatos: falha ao enviar e-mail de confirmação", e);
  }

  return NextResponse.json({ ok: true });
}

/** Lista de candidatos pro admin (/candidatos) — só admin/organização,
 * mesmo padrão de autenticação das outras rotas GET protegidas (ex.:
 * /api/relatorios/participantes-curso): Authorization: Bearer <idToken>. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const chamadorSnap = await db.doc(`usuarios/${uid}`).get();
    const papelChamador = chamadorSnap.data()?.papel;
    if (papelChamador !== "admin" && papelChamador !== "organizacao") {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const snap = await db.collection("candidatosAvaliacao").orderBy("criadoEm", "desc").get();
    const candidatos = snap.docs.map((d) => {
      const dado = d.data();
      return {
        id: d.id,
        nome: dado.nome as string,
        areaFormacao: dado.areaFormacao as string,
        telefone: dado.telefone as string,
        email: dado.email as string,
        interesses: dado.interesses as string[],
        criadoEm: dado.criadoEm?.toDate?.().toISOString() ?? null,
      };
    });
    return NextResponse.json({ candidatos });
  } catch (e) {
    console.error("Candidatos: falha ao listar", e);
    return NextResponse.json({ erro: "Não foi possível carregar a lista agora." }, { status: 500 });
  }
}
