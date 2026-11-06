import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import { caixaAltaNome } from "@/lib/textoNome";

// ⚠ EXCEÇÃO TEMPORÁRIA (2026-11-06, pedido explícito do usuário — "lembra
// que isso é uma exceção, deixe registrado para nos próximos dias
// excluirmos essa página"). Toda a feature de reavaliação externa — este
// arquivo, src/app/api/revisao-externa/[token]/route.ts,
// src/app/api/revisao-externa/[token]/avaliar/route.ts,
// src/app/reavaliacao-externa/[token]/page.tsx, a coleção
// convitesRevisaoExterna e a entrada dela em firestore.rules — existe só
// pra destravar os 46 trabalhos legados da X MAC com professores externos
// sem conta no SIGMA. Depois que esse lote acabar de ser reavaliado, tudo
// isso deve ser REMOVIDO (código + coleção + regra), não é parte
// permanente do sistema.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Token do link público — aleatório, sem relação nenhuma com o id do
 * documento nem com dado nenhum do trabalho, pra não dar pra adivinhar
 * (2026-11-06). 24 bytes = 192 bits, bem mais forte que a senha temporária
 * de 9 bytes usada em /api/usuarios/lote — ali é só a PRIMEIRA barreira
 * (login ainda pede e-mail+senha); aqui o token SOZINHO é toda a
 * autorização de quem acessa o link, então precisa ser mais forte. */
function gerarTokenConvite(): string {
  return randomBytes(24).toString("base64url");
}

/** Convite de reavaliação externa (2026-11-06, pedido explícito do usuário
 * — "muitos dos professores que se prontificaram a ajudar nessa segunda
 * revisão não são avaliadores e nem estão no SIGMA... uma tela de
 * avaliação externa que não precisa de login"). Só admin/organização do
 * evento. Cria um convite (coleção convitesRevisaoExterna, só Admin SDK —
 * ver firestore.rules) com os trabalhos escolhidos e manda e-mail com o
 * link pra /reavaliacao-externa/[token], que não exige conta nenhuma no
 * SIGMA — o token em si é a autorização (ver GET/POST em
 * /api/revisao-externa/[token]). */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const chamadorSnap = await db.doc(`usuarios/${uid}`).get();
    const chamador = chamadorSnap.data();

    const body = (await request.json()) as {
      eventoId?: string;
      trabalhoIds?: string[];
      email?: string;
      nome?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    // Caixa alta padrão do sistema (2026-11-06, pedido explícito do
    // usuário) — nome de pessoa digitado livre sempre vira maiúsculo na
    // gravação.
    const nome = (body.nome ?? "").trim() ? caixaAltaNome(body.nome ?? "") : "";
    const trabalhoIds = [...new Set(body.trabalhoIds ?? [])];
    const eventoId = body.eventoId;

    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }
    if (!EMAIL_VALIDO.test(email)) {
      return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
    }
    if (trabalhoIds.length === 0) {
      return NextResponse.json({ erro: "Selecione pelo menos 1 trabalho." }, { status: 400 });
    }

    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId));
    if (!ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    // Só os legados sem nota de verdade entram — mesma trava de escopo da
    // reatribuição manual interna (ver ETAPA_PARA_PAPEL_ALVO em
    // src/app/trabalhos/page.tsx). Confere no servidor, não confia só na
    // tela já ter filtrado.
    const trabalhosRefs = trabalhoIds.map((id) => db.doc(`trabalhos/${id}`));
    const trabalhosSnaps = await db.getAll(...trabalhosRefs);
    const validos: string[] = [];
    const titulos: string[] = [];
    for (const snap of trabalhosSnaps) {
      const t = snap.data();
      if (!t || t.eventoId !== eventoId || t.status !== "revisao" || t.revisaoLegado !== true) continue;
      validos.push(snap.id);
      titulos.push(tituloExibicao(t.titulo as string));
    }
    if (validos.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum dos trabalhos selecionados é um legado elegível (status revisão, sem nota)." },
        { status: 400 },
      );
    }

    const token = gerarTokenConvite();

    // Marca os trabalhos como enviados assim que o convite é criado — não
    // só quando a nota volta (2026-11-06, pedido explícito do usuário —
    // "preciso que eles mudem de status ou voltem para avaliação para
    // conseguirmos controlar qual foi enviado ou não"). Reaproveita o
    // status "aguardando_avaliacao" (sai da aba Revisão, aparece na aba
    // Avaliação com o nome do convidado na coluna avaliador) em vez de
    // criar um status novo só pra isso. `avaliadorUid` fica null de
    // propósito — não é uma conta real, então não pode "pertencer" a
    // ninguém do fluxo interno.
    const batch = db.batch();
    for (const id of validos) {
      batch.update(db.doc(`trabalhos/${id}`), {
        status: "aguardando_avaliacao",
        avaliadorUid: null,
        avaliadorNome: `${nome || email} (reavaliação externa — convite enviado)`,
        revisaoLegado: false,
        comentarioRevisao: null,
        atualizadoEm: new Date(),
      });
    }
    batch.set(db.doc(`convitesRevisaoExterna/${token}`), {
      eventoId,
      trabalhoIds: validos,
      trabalhosAvaliados: [],
      email,
      nome: nome || null,
      criadoPorUid: uid,
      criadoEm: new Date(),
    });
    await batch.commit();

    const eventoNome = (await db.doc(`eventos/${eventoId}`).get()).data()?.nome as
      | string
      | undefined;
    const link = `${URL_SISTEMA}/reavaliacao-externa/${token}`;
    await enviarEmail({
      to: email,
      subject: `Convite para avaliar ${validos.length} trabalho(s) — ${eventoNome ?? "SIGMA"}`,
      html: modeloEmail(
        `<p>Você foi convidado(a) a avaliar <strong>${validos.length} trabalho${validos.length === 1 ? "" : "s"}</strong>${eventoNome ? ` do evento <strong>${eventoNome}</strong>` : ""}.</p>
         <p>Não é preciso criar conta nem fazer login — clique no botão abaixo, dê a nota de cada trabalho e pronto.</p>`,
        { texto: "Avaliar trabalhos", href: link },
        nome || undefined,
      ),
    });

    return NextResponse.json({ ok: true, token, totalConvidado: validos.length });
  } catch (e) {
    console.error("Erro ao criar convite de reavaliação externa:", e);
    return NextResponse.json({ erro: "Erro interno ao criar o convite." }, { status: 500 });
  }
}
