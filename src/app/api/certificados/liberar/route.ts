import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { presencaMinimaDoEvento } from "@/lib/periodosPresenca";
import { obterNumeroRegistro } from "@/lib/registroCertificados";

/** Liberar certificados de evento "simples" (2026-10-19, pedido explícito
 * do usuário) — até aqui o número de registro só nascia quando CADA
 * pessoa baixava o próprio certificado, uma de cada vez, conforme ia
 * lembrando. Problema real descrito pelo usuário: não dá pra esperar a
 * boa vontade de 174 pessoas baixarem — se alguém deixar pra baixar daqui
 * 3 meses, o número que seria dela já foi pro próximo evento criado nesse
 * meio tempo, quebrando a sequência/ata de todo mundo pra frente.
 *
 * Esta rota faz as duas coisas JUNTAS, na hora que a organização clica
 * "Liberar certificados": liga `certificadosLiberados` E já numera, de
 * uma vez, todo mundo que JÁ está habilitado agora (mesmo critério do
 * autoatendimento em /api/certificados — presença + pagamento, se tiver
 * taxa). Assim a Ata pode ser gerada na sequência, com o primeiro e o
 * último número de quem está liberado AGORA, sem depender de ninguém
 * clicar em baixar.
 *
 * Idempotente e seguro pra rodar de novo (ex.: pausado e religado depois,
 * como aconteceu com a Semana de Medicina) — obterNumeroRegistro é
 * get-or-create: quem já tem número mantém o mesmo; só gente NOVA que
 * ficou elegível desde a última vez ganha número agora. Quem baixar
 * sozinho DEPOIS de ficar elegível (ex.: confirma presença só semana que
 * vem) ainda cai no caminho antigo (numerado na hora do download,
 * ../route.ts) — essa rota só adianta o caso comum, não substitui o
 * outro caminho. */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const chamador = (await db.doc(`usuarios/${uid}`).get()).data();

    const { eventoId } = (await request.json()) as { eventoId?: string };
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const souAdmin = chamador?.papel === "admin";
    const souOrganizacaoDoEvento =
      chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId);
    if (!souAdmin && !souOrganizacaoDoEvento) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const eventoRef = db.doc(`eventos/${eventoId}`);
    const evento = (await eventoRef.get()).data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    if (evento.tipo !== "simples") {
      return NextResponse.json(
        {
          erro:
            "Essa rota é só pra evento \"simples\" — evento completo libera certificado por trabalho, em /trabalhos.",
        },
        { status: 400 },
      );
    }
    // Só depois de encerrado (2026-10-19, pedido explícito do usuário) —
    // garante que ninguém mais confirma presença nova depois da numeração
    // em lote (ver bloqueio em /api/inscricoes/confirmar-presenca), então
    // a ata gerada logo em seguida bate com a realidade: do primeiro ao
    // último, sem ninguém "escapando" por ter confirmado depois.
    if (!evento.encerrado) {
      return NextResponse.json(
        {
          erro:
            "Só é possível liberar certificado depois que o evento for encerrado — assim ninguém confirma presença nova depois da numeração.",
        },
        { status: 400 },
      );
    }

    // `liberandoCertificados` (2026-10-19, pedido explícito do usuário,
    // achado real: ele gerou a Ata ENQUANTO esse loop ainda rodava —
    // 174 inscrições, uma transação de cada vez, uns 30s no total — e a
    // ata saiu com só 66 de 140, uma "ata oficial" incompleta registrada
    // com número de verdade. GET /api/certificados/ata recusa gerar
    // enquanto essa flag estiver true, pra nunca mais sair uma ata pela
    // metade. Sempre limpa no final, mesmo se der erro no meio (finally).
    await eventoRef.update({ certificadosLiberados: true, liberandoCertificados: true });

    let numerados = 0;
    let jaTinhamNumero = 0;
    let naoElegiveis = 0;

    try {
      const minimoExigido = presencaMinimaDoEvento(evento);
      const numeroInicial = (evento.numeroRegistroInicial as number | undefined) ?? 1;

      // Ordem de chegada (2026-10-19, pedido explícito do usuário — "em
      // ordem do próprio banco"; `criadoEm` é quando a pessoa clicou
      // "Participar", o pedido mais natural de "quem chegou primeiro").
      const inscricoesSnap = await db
        .collection("inscricoesEvento")
        .where("eventoId", "==", eventoId)
        .orderBy("criadoEm", "asc")
        .get();

      // Monitor é isento da taxa (2026-10-20) — numera junto com todo mundo
      // pra entrar na ata, mesma regra de /api/certificados (participante).
      const monitoresSnap = evento.valorInscricao
        ? await db.collection("monitoresEvento").where("eventoId", "==", eventoId).get()
        : null;
      const uidsMonitores = new Set(monitoresSnap?.docs.map((d) => d.data().uid as string));

      for (const doc of inscricoesSnap.docs) {
        const inscricao = doc.data();
        const pagamentoOk =
          !evento.valorInscricao ||
          inscricao.status === "pago" ||
          uidsMonitores.has(inscricao.uid as string);
        const diasConfirmados = Object.keys(inscricao.presencasConfirmadas ?? {}).length;
        const presencaOk = diasConfirmados >= minimoExigido;
        if (!pagamentoOk || !presencaOk) {
          naoElegiveis++;
          continue;
        }

        const chave = `${eventoId}_participante_${inscricao.uid}`;
        const jaExistia = (await db.doc(`registrosCertificados/${chave}`).get()).exists;
        await obterNumeroRegistro(chave, eventoId, numeroInicial, inscricao.nome as string);
        if (jaExistia) jaTinhamNumero++;
        else numerados++;
      }
    } finally {
      await eventoRef.update({ liberandoCertificados: false });
    }

    return NextResponse.json({ ok: true, numerados, jaTinhamNumero, naoElegiveis });
  } catch (e) {
    console.error("Erro ao liberar e numerar certificados:", e);
    return NextResponse.json({ erro: "Erro interno ao liberar certificados." }, { status: 500 });
  }
}
