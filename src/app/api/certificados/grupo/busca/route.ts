import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { analisarEmpatesPorArea, STATUS_JA_AVALIADO } from "@/lib/analiseEmpate";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import type { Trabalho } from "@/lib/data/trabalhos";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const LIMITE_RESULTADOS = 30;

/** Busca pública do mural de certificados de apresentação/premiação
 * (2026-11-13, pedido explícito do usuário — decisão com o chefe da
 * comissão: "ter um lugar pra postar igual do edital... a pessoa busca
 * pelo nome ou pelo título"). Mesmo padrão de
 * /api/ensalamento/consulta — sem autenticação de propósito, só funciona
 * com `eventos/{id}.certificadosGrupoPublicosAtivo === true` (liga/desliga
 * em Trabalhos → Resultado Final → "Certificados públicos"). Devolve só o
 * necessário pra montar a lista; os PDFs em si vêm de
 * GET .../apresentacao e .../premiacao, chamados só quando a pessoa clica
 * em baixar. */
export async function GET(request: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("eventoId");
    const busca = (url.searchParams.get("busca") ?? "").trim();
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento || evento.certificadosGrupoPublicosAtivo !== true) {
      return NextResponse.json({ ativo: false });
    }

    const eventoNome = evento.nome as string;
    if (busca.length < 2) {
      return NextResponse.json({ ativo: true, eventoNome, resultados: [] });
    }

    const termo = normalizar(busca);
    const trabalhosSnap = await db.collection("trabalhos").where("eventoId", "==", eventoId).get();
    const trabalhos = trabalhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho);

    // Mesma posição de sempre (1º/2º/3º), vem de analisarEmpatesPorArea — a
    // MESMA fonte usada no pódio/Resultado Final, nunca recalculada
    // diferente aqui.
    const pool = trabalhos.filter(
      (t) =>
        STATUS_JA_AVALIADO.includes(t.status) &&
        typeof t.notaAvaliador === "number" &&
        t.compareceuApresentacao !== false,
    );
    const posicaoPorId = new Map<string, number>();
    for (const [, info] of analisarEmpatesPorArea(pool)) {
      for (const [id, posicao] of Object.entries(info.posicoes)) posicaoPorId.set(id, posicao);
    }

    const resultados: {
      id: string;
      titulo: string;
      autores: string;
      orientador: string;
      areaTematica: string;
      temApresentacao: boolean;
      temPremiacao: boolean;
      posicao: number | null;
    }[] = [];

    for (const t of trabalhos) {
      if (resultados.length >= LIMITE_RESULTADOS) break;
      if (!STATUS_JA_AVALIADO.includes(t.status)) continue;

      const autoresLista = [t.alunoNome, ...(t.participantesNomes ?? [])].filter(Boolean) as string[];
      // Orientador/coorientadores também entram na busca (2026-11-13,
      // pedido explícito do usuário — "muitos [orientadores] não têm conta
      // no sigma, eles poderiam procurar lá também") — texto livre no
      // trabalho, sem conta nenhuma, esse mural é o único jeito deles
      // acharem o próprio certificado.
      const orientacaoLista = [t.nomeOrientador, ...(t.nomesCoorientadores ?? [])].filter(
        Boolean,
      ) as string[];
      const bate =
        normalizar(t.titulo ?? "").includes(termo) ||
        autoresLista.some((nome) => normalizar(nome).includes(termo)) ||
        orientacaoLista.some((nome) => normalizar(nome).includes(termo));
      if (!bate) continue;

      resultados.push({
        id: t.id,
        titulo: tituloExibicao(t.titulo),
        autores: autoresLista.join(", ").toLocaleUpperCase("pt-BR"),
        orientador: orientacaoLista.join(", ").toLocaleUpperCase("pt-BR"),
        areaTematica: t.areaTematica ?? "",
        temApresentacao: t.status === "aceito",
        temPremiacao: t.premiado === true,
        posicao: t.premiado === true ? (posicaoPorId.get(t.id) ?? null) : null,
      });
    }

    return NextResponse.json({ ativo: true, eventoNome, resultados });
  } catch (e) {
    console.error("Erro na busca pública de certificados:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
