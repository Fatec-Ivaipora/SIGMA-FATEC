import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { analisarEmpatesPorArea, STATUS_JA_AVALIADO } from "@/lib/analiseEmpate";
import type { Trabalho } from "@/lib/data/trabalhos";

type Colocado = {
  posicao: number;
  titulo: string;
  autores: string;
  orientacao: string;
};

type AreaPremiada = {
  areaTematica: string;
  colocados: Colocado[];
};

/** Premiados por área exibidos na home pública (2026-11-13, pedido
 * explícito da comissão, específico de eventos com premiação como a MAC —
 * "no final quando o evento acaba eu possa clicar em mostrar os
 * premiados... pra eles poderem ver e prestigiar"). Sem autenticação de
 * propósito, mesmo espírito de /api/ensalamento/consulta e
 * /api/certificados/grupo/busca — só devolve dado de evento com
 * `eventos/{id}.premiadosPublicosAtivo === true` (liga em Eventos → ⋮ Mais
 * opções → "Mostrar premiados na home"). Reaproveita `analisarEmpatesPorArea`
 * (a MESMA regra de posição do pódio/Resultado Final, nunca recalculada
 * diferente aqui) — igual a GET /api/trabalhos/podio, mas sem exigir login
 * e devolvendo JSON em vez de PDF. */
export async function GET() {
  try {
    const db = getAdminDb();
    const eventosSnap = await db
      .collection("eventos")
      .where("premiadosPublicosAtivo", "==", true)
      .get();

    const eventos: {
      eventoId: string;
      eventoNome: string;
      dataRealizacao?: string;
      dataRealizacaoFim?: string;
      areas: AreaPremiada[];
    }[] = [];

    for (const eventoDoc of eventosSnap.docs) {
      const evento = eventoDoc.data();
      const trabalhosSnap = await db
        .collection("trabalhos")
        .where("eventoId", "==", eventoDoc.id)
        .get();
      const trabalhos = trabalhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho);

      const pool = trabalhos.filter(
        (t) =>
          STATUS_JA_AVALIADO.includes(t.status) &&
          typeof t.notaAvaliador === "number" &&
          t.compareceuApresentacao !== false,
      );
      const analise = analisarEmpatesPorArea(pool);
      const porId = new Map(trabalhos.map((t) => [t.id, t]));

      const areas: AreaPremiada[] = [];
      for (const [, info] of analise) {
        const colocados: (Colocado & { areaTematica: string })[] = Object.entries(info.posicoes)
          .map(([id, posicao]) => {
            const t = porId.get(id);
            if (!t) return null;
            const autores = [t.alunoNome, ...(t.participantesNomes ?? [])]
              .filter(Boolean)
              .join(", ")
              .toLocaleUpperCase("pt-BR");
            const orientacao = [t.nomeOrientador, ...(t.nomesCoorientadores ?? [])]
              .filter(Boolean)
              .join(", ")
              .toLocaleUpperCase("pt-BR");
            return { posicao, titulo: t.titulo as string, autores, orientacao, areaTematica: t.areaTematica as string };
          })
          .filter((c): c is Colocado & { areaTematica: string } => c !== null)
          .sort((a, b) => a.posicao - b.posicao);
        if (colocados.length === 0) continue;
        areas.push({ areaTematica: colocados[0].areaTematica, colocados });
      }
      areas.sort((a, b) => a.areaTematica.localeCompare(b.areaTematica, "pt-BR"));

      if (areas.length > 0) {
        eventos.push({
          eventoId: eventoDoc.id,
          eventoNome: evento.nome as string,
          dataRealizacao: evento.dataRealizacao as string | undefined,
          dataRealizacaoFim: evento.dataRealizacaoFim as string | undefined,
          areas,
        });
      }
    }

    return NextResponse.json({ eventos });
  } catch (e) {
    console.error("Erro ao buscar premiados públicos:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
