import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { obterNumerosRegistroEmLote } from "@/lib/registroCertificados";

/** Numeração em lote do certificado de PARTICIPAÇÃO individual, pra evento
 * "completo" (com trabalho) — mesmo espírito de /api/certificados/liberar
 * (evento "simples"), mas aqui é por PESSOA, não por trabalho (2026-11-13,
 * pedido explícito do usuário: "número por pessoa e não podemos fazer...
 * quando o cara baixa aí gera o número, porque igual o da medicina
 * precisamos gerar a ata e avisar qual foi o último número usado"). Chama
 * essa rota ANTES de qualquer um baixar — ver trabalhos/page.tsx,
 * "Emitir certificados individuais" chama essa rota junto com
 * `liberarTodosCertificados`. Depois disso, o autoatendimento
 * (GET /api/certificados?papel=aluno) só LÊ o número já atribuído — nunca
 * mais cria um novo na hora do download, pra sequência nunca depender da
 * boa vontade de ninguém clicar.
 *
 * Idempotente, igual obterNumeroRegistro: quem já tem número mantém o
 * mesmo; só gente nova (colega que aceitou convite depois, por exemplo)
 * ganha número agora. Seguro rodar de novo quantas vezes precisar. Quem
 * não pagou (se o evento tiver taxa) NÃO numera — "a regra de se não
 * pagou não gera o certificado individual" (2026-11-13, pedido explícito
 * do usuário) — mesma checagem de sempre do autoatendimento
 * (inscricoesEvento.status === "pago"), só que em lote, não por pessoa. */
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
      chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId);
    if (!souAdmin && !souOrganizacaoDoEvento) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const evento = (await db.doc(`eventos/${eventoId}`).get()).data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    if (evento.tipo === "simples") {
      return NextResponse.json(
        { erro: "Essa rota é pra evento com trabalho — evento \"simples\" usa /api/certificados/liberar." },
        { status: 400 },
      );
    }

    // Ordem de envio (2026-11-13) — estável e previsível, mesmo espírito do
    // "ordem de chegada" em /api/certificados/liberar.
    const trabalhosSnap = await db
      .collection("trabalhos")
      .where("eventoId", "==", eventoId)
      .where("status", "==", "aceito")
      .orderBy("enviadoEm", "asc")
      .get();

    // Quem não pagou não numera (2026-11-13, pedido explícito do usuário —
    // "a regra de se não pagou não gera o certificado individual"). Uma
    // leitura só de todas as inscrições do evento, igual
    // /api/certificados/liberar faz — nunca uma consulta por pessoa.
    const statusPagoPorUid = new Map<string, boolean>();
    if (evento.valorInscricao) {
      const inscricoesSnap = await db
        .collection("inscricoesEvento")
        .where("eventoId", "==", eventoId)
        .get();
      inscricoesSnap.docs.forEach((d) => {
        statusPagoPorUid.set(d.data().uid as string, d.data().status === "pago");
      });
    }
    const pagou = (uidPessoa: string) => !evento.valorInscricao || statusPagoPorUid.get(uidPessoa) === true;

    const itens: { chave: string; nome: string }[] = [];
    let naoPagos = 0;
    for (const doc of trabalhosSnap.docs) {
      const t = doc.data();
      if (pagou(t.alunoUid as string)) {
        itens.push({ chave: `${doc.id}_aluno_${t.alunoUid}`, nome: t.alunoNome as string });
      } else {
        naoPagos++;
      }
      const uids = (t.participantesUids ?? []) as string[];
      const nomes = (t.participantesNomes ?? []) as string[];
      uids.forEach((colegaUid, i) => {
        if (!nomes[i]) return;
        if (pagou(colegaUid)) {
          itens.push({ chave: `${doc.id}_aluno_${colegaUid}`, nome: nomes[i] });
        } else {
          naoPagos++;
        }
      });
    }

    const numeroInicial = (evento.numeroRegistroInicial as number | undefined) ?? 1;
    const resultado = await obterNumerosRegistroEmLote(itens, eventoId, numeroInicial);

    const numeros = Array.from(resultado.values());
    const primeiroNumero = numeros.length ? Math.min(...numeros) : null;
    const ultimoNumero = numeros.length ? Math.max(...numeros) : null;

    return NextResponse.json({
      ok: true,
      totalPessoas: itens.length,
      naoPagos,
      primeiroNumero,
      ultimoNumero,
    });
  } catch (e) {
    console.error("Erro ao numerar certificados individuais em lote:", e);
    return NextResponse.json({ erro: "Erro interno ao numerar certificados." }, { status: 500 });
  }
}
