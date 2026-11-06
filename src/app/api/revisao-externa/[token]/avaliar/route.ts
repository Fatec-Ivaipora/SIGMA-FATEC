import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { caixaAltaNome } from "@/lib/textoNome";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";
import { tituloExibicao } from "@/lib/tituloTrabalho";

// ⚠ EXCEÇÃO TEMPORÁRIA — ver comentário em
// src/app/api/revisao-externa/convidar/route.ts. Remover junto com o
// resto da feature depois que os 46 legados da X MAC forem reavaliados.

// Mesmos 5 critérios/chaves de CRITERIOS_AVALIACAO em
// src/app/avaliador/trabalhos/page.tsx — duplicado aqui de propósito (não
// é client component, e essa feature inteira é temporária) em vez de
// extrair um módulo compartilhado só pra isso.
const CHAVES_CRITERIOS = [
  "suficiencia",
  "coerencia",
  "estruturaTexto",
  "clarezaPrecisao",
  "aplicabilidadeRelevancia",
] as const;

/** Grava a nota de um trabalho via reavaliação externa — rota PÚBLICA de
 * propósito (2026-11-06, ver convidar/route.ts). Sem Firebase Auth
 * nenhum: o token do convite é toda a autorização, confere trabalhoId
 * contra a lista gravada no convite (nunca aceita um id fora dela) e
 * nunca deixa avaliar o mesmo trabalho 2 vezes pelo mesmo convite. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const db = getAdminDb();
    const conviteRef = db.doc(`convitesRevisaoExterna/${token}`);
    const conviteSnap = await conviteRef.get();
    const convite = conviteSnap.data();
    if (!convite) {
      return NextResponse.json({ erro: "Link inválido ou expirado." }, { status: 404 });
    }

    const body = (await request.json()) as {
      trabalhoId?: string;
      notas?: Record<string, number>;
      nome?: string;
    };
    const trabalhoId = body.trabalhoId;
    const notas = body.notas ?? {};
    // Caixa alta padrão do sistema (2026-11-06, pedido explícito do
    // usuário) — nome de pessoa digitado livre sempre vira maiúsculo na
    // gravação.
    const nomeDigitado = (body.nome ?? convite.nome ?? "").trim();
    const nomeAvaliador = nomeDigitado ? caixaAltaNome(nomeDigitado) : "";

    const trabalhoIdsDoConvite = (convite.trabalhoIds as string[]) ?? [];
    if (!trabalhoId || !trabalhoIdsDoConvite.includes(trabalhoId)) {
      return NextResponse.json(
        { erro: "Esse trabalho não faz parte desse convite." },
        { status: 400 },
      );
    }
    const jaAvaliados = (convite.trabalhosAvaliados as string[]) ?? [];
    if (jaAvaliados.includes(trabalhoId)) {
      return NextResponse.json({ erro: "Esse trabalho já foi avaliado." }, { status: 400 });
    }
    if (!nomeAvaliador) {
      return NextResponse.json({ erro: "Informe seu nome antes de enviar." }, { status: 400 });
    }

    let soma = 0;
    for (const chave of CHAVES_CRITERIOS) {
      const valor = notas[chave];
      if (typeof valor !== "number" || valor < 1 || valor > 5 || !Number.isInteger(valor)) {
        return NextResponse.json(
          { erro: "Preencha todos os critérios (1 a 5 cada) antes de enviar." },
          { status: 400 },
        );
      }
      soma += valor;
    }

    const trabalhoRef = db.doc(`trabalhos/${trabalhoId}`);
    const trabalhoSnap = await trabalhoRef.get();
    // "aguardando_avaliacao" é o status normal aqui (convidar/route.ts já
    // move pra esse status assim que o convite é criado). "revisao" fica
    // como fallback só por segurança, caso reste algum convite criado
    // antes dessa mudança.
    const statusAtual = trabalhoSnap.data()?.status;
    if (!trabalhoSnap.exists || (statusAtual !== "aguardando_avaliacao" && statusAtual !== "revisao")) {
      return NextResponse.json(
        { erro: "Esse trabalho não está mais disponível pra avaliar (alguém já mexeu nele)." },
        { status: 409 },
      );
    }

    await trabalhoRef.update({
      status: "avaliado",
      notasCriterios: notas,
      notaAvaliador: soma,
      avaliadorNome: `${nomeAvaliador} (avaliador externo convidado)`,
      revisaoLegado: false,
      comentarioRevisao: null,
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    await conviteRef.update({
      trabalhosAvaliados: FieldValue.arrayUnion(trabalhoId),
      nome: convite.nome ?? nomeAvaliador,
    });

    // Avisa o aluno (2026-11-06, pedido explícito do usuário) — rota sem
    // Firebase Auth nenhum, não dá pra chamar /api/mail/trabalho-status
    // (exige token de quem está logado), então manda direto aqui mesmo,
    // melhor esforço (nunca derruba a gravação da nota, que já aconteceu
    // acima). Mesmo texto/destinatários de "reavaliado" em
    // /api/mail/trabalho-status.
    try {
      const trabalho = trabalhoSnap.data()!;
      const destinatariosUids = Array.from(
        new Set([trabalho.alunoUid as string, ...((trabalho.participantesUids as string[] | undefined) ?? [])]),
      );
      const titulo = tituloExibicao(trabalho.titulo as string);
      const texto = `Seu trabalho "${titulo}" foi reavaliado e está apto pra apresentação.`;
      const subject = `Trabalho reavaliado — ${titulo}`;
      const html = (nomeDestinatario: string | undefined) =>
        modeloEmail(
          `<p>Depois que seu trabalho <strong>"${titulo}"</strong> foi para revisão, a Comissão Científica reavaliou e confirmou: você está apto(a) pra apresentação. Parabéns!</p>
           <p>Entre no SIGMA pra acompanhar o resultado.</p>`,
          { texto: "Ver resultado", href: `${URL_SISTEMA}/aluno/trabalhos` },
          nomeDestinatario,
        );
      await Promise.all(
        destinatariosUids.map(async (uid) => {
          const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
          const usuario = usuarioSnap.data();
          if (!usuario) return;
          try {
            await registrarAtividade({
              uid,
              tipo: "reavaliado",
              texto,
              negritos: [`"${titulo}"`],
              trabalhoId,
              eventoId: trabalho.eventoId as string,
            });
          } catch {
            // melhor esforço
          }
          if (!usuario.email) return;
          await enviarEmail({ to: usuario.email as string, subject, html: html(usuario.nome as string) });
        }),
      );
    } catch (e) {
      console.error("Reavaliação externa: falha ao notificar o aluno (nota já foi gravada):", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro ao gravar nota da reavaliação externa:", e);
    return NextResponse.json({ erro: "Erro interno ao gravar a nota." }, { status: 500 });
  }
}
