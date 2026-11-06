import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { ROTA_POR_PAPEL } from "@/lib/rotaPorPapel";
import { caixaAltaNome } from "@/lib/textoNome";

// Centenas de linhas criam conta uma a uma no Auth: dá folga além do padrão.
export const maxDuration = 60;

const LABEL_PAPEL: Record<PapelLote, string> = {
  avaliador: "avaliador(a)",
  orientador: "orientador(a)",
  moderador: "moderador(a)",
};
type PapelLote = "avaliador" | "orientador" | "moderador";
const PAPEIS_LOTE: PapelLote[] = ["avaliador", "orientador", "moderador"];
const LIMITE_LINHAS = 200;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SituacaoLinha =
  | "criar" // conta nova
  | "atualizar" // já tem conta: ganha a função e o vínculo com o evento
  | "ja_estava" // já tem conta com essa função nesse evento — nada a fazer
  | "aluno" // conta de aluno: não dá pra combinar com avaliação, fica de fora
  | "sem_email"
  | "email_invalido"
  | "repetido"; // mesmo e-mail duas vezes na planilha

export type ResultadoLinha = {
  linha: number;
  nome: string;
  email: string;
  situacao: SituacaoLinha;
  senhaTemporaria?: string;
  erro?: string;
};

function senhaTemporaria(): string {
  return randomBytes(9).toString("base64url");
}

/** Cadastro em lote de avaliador/orientador/moderador (2026-11-05, pedido
 * explícito do usuário — os 21 moderadores da X MAC um por um em "Criar
 * usuário" era trabalho demais). Só Admin. Mesma regra do POST de
 * /api/usuarios pra cada conta nova (senha temporária com troca obrigatória
 * no 1º login, e-mail de aviso, vínculo com o evento); quem já tem conta pelo
 * e-mail NÃO é duplicado — só ganha a função (papeisAvaliacao) e o vínculo
 * com o evento. Conta de aluno fica de fora (papel de aluno não combina com
 * os de avaliação). `simular: true` só devolve a prévia, sem gravar nada. */
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

  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    if ((await db.doc(`usuarios/${chamadorUid}`).get()).data()?.papel !== "admin") {
      return NextResponse.json({ erro: "Só o Admin pode fazer cadastro em lote." }, { status: 403 });
    }

    const body = (await request.json()) as {
      eventoId?: string;
      papel?: string;
      linhas?: { nome?: string; email?: string }[];
      simular?: boolean;
    };
    const papel = body.papel as PapelLote;
    if (!PAPEIS_LOTE.includes(papel)) {
      return NextResponse.json({ erro: "Escolha o papel: avaliador, orientador ou moderador." }, { status: 400 });
    }
    if (!body.eventoId || !(await db.doc(`eventos/${body.eventoId}`).get()).exists) {
      return NextResponse.json({ erro: "Escolha o evento." }, { status: 400 });
    }
    const eventoId = body.eventoId;
    const linhas = (body.linhas ?? []).slice(0, LIMITE_LINHAS + 1);
    if (linhas.length === 0) {
      return NextResponse.json({ erro: "Nenhuma linha na planilha." }, { status: 400 });
    }
    if (linhas.length > LIMITE_LINHAS) {
      return NextResponse.json({ erro: `No máximo ${LIMITE_LINHAS} pessoas por vez.` }, { status: 400 });
    }

    const vistos = new Set<string>();
    const resultados: ResultadoLinha[] = [];
    for (const [i, l] of linhas.entries()) {
      // Caixa alta padrão do sistema (2026-11-06, pedido explícito do
      // usuário) — nome de pessoa digitado livre sempre vira maiúsculo na
      // gravação.
      const nome = caixaAltaNome(String(l.nome ?? ""));
      const email = String(l.email ?? "").trim().toLowerCase();
      const base = { linha: i + 1, nome, email };
      if (!email) { resultados.push({ ...base, situacao: "sem_email" }); continue; }
      if (!EMAIL_VALIDO.test(email) || !nome) { resultados.push({ ...base, situacao: "email_invalido" }); continue; }
      if (vistos.has(email)) { resultados.push({ ...base, situacao: "repetido" }); continue; }
      vistos.add(email);

      let uidExistente: string | null = null;
      try {
        uidExistente = (await auth.getUserByEmail(email)).uid;
      } catch {
        uidExistente = null;
      }

      if (!uidExistente) {
        if (body.simular) { resultados.push({ ...base, situacao: "criar" }); continue; }
        const senha = senhaTemporaria();
        try {
          const conta = await auth.createUser({ email, password: senha, displayName: nome });
          await db.doc(`usuarios/${conta.uid}`).set({
            nome,
            nomeBusca: nome.toLowerCase(),
            email,
            papel,
            atribuicoesEventos: [{ eventoId }],
            eventosPermitidos: [eventoId],
            senhaTemporaria: true,
          });
          resultados.push({ ...base, situacao: "criar", senhaTemporaria: senha });
        } catch (e) {
          resultados.push({ ...base, situacao: "criar", erro: (e as Error).message || "falha ao criar a conta" });
        }
        continue;
      }

      const ref = db.doc(`usuarios/${uidExistente}`);
      const u = (await ref.get()).data() ?? {};
      if (u.papel === "aluno") { resultados.push({ ...base, nome: u.nome ?? nome, situacao: "aluno" }); continue; }
      const papeis = Array.from(
        new Set([u.papel, ...((u.papeisAvaliacao ?? []) as string[]), papel].filter((p) => PAPEIS_LOTE.includes(p))),
      );
      const atrib = [...((u.atribuicoesEventos ?? []) as { eventoId: string; areasTematicas?: string[] }[])];
      const temFuncao = u.papel === papel || ((u.papeisAvaliacao ?? []) as string[]).includes(papel) || u.papel === "admin";
      const temEvento = u.papel === "admin" || atrib.some((a) => a.eventoId === eventoId);
      if (temFuncao && temEvento) { resultados.push({ ...base, nome: u.nome ?? nome, situacao: "ja_estava" }); continue; }
      if (!body.simular) {
        if (!temEvento) atrib.push({ eventoId });
        await ref.update({
          papeisAvaliacao: papeis,
          atribuicoesEventos: atrib,
          eventosPermitidos: Array.from(new Set([...((u.eventosPermitidos ?? []) as string[]), eventoId])),
        });
      }
      resultados.push({ ...base, nome: u.nome ?? nome, situacao: "atualizar" });
    }

    // Aviso por e-mail pra quem ganhou conta nova — melhor esforço, mesmo texto do "Criar usuário".
    if (!body.simular) {
      for (const r of resultados.filter((x) => x.situacao === "criar" && x.senhaTemporaria)) {
        try {
          await enviarEmail({
            to: r.email,
            subject: `Você foi cadastrado(a) como ${LABEL_PAPEL[papel]} no SIGMA`,
            html: modeloEmail(
              `<p>Você foi cadastrado(a) como <strong>${LABEL_PAPEL[papel]}</strong> no SIGMA, o sistema de submissão e avaliação de trabalhos acadêmicos da Fatec Ivaiporã.</p>
               <p>A coordenação vai te passar a senha temporária de acesso — no primeiro login, o sistema pede pra você trocar por uma senha sua.</p>`,
              { texto: "Entrar no SIGMA", href: `${URL_SISTEMA}${ROTA_POR_PAPEL[papel]}` },
              r.nome,
            ),
          });
        } catch {
          // melhor esforço — não desfaz a conta já criada.
        }
      }
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    console.error("Erro inesperado no cadastro em lote:", e);
    return NextResponse.json({ erro: "Erro interno no cadastro em lote. Tente de novo em instantes." }, { status: 500 });
  }
}
