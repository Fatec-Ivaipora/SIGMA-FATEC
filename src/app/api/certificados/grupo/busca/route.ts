import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { analisarEmpatesPorArea, STATUS_JA_AVALIADO } from "@/lib/analiseEmpate";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import { idFirestoreValido } from "@/lib/idPublico";
import type { Trabalho } from "@/lib/data/trabalhos";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const POR_PAGINA = 20;

/** Busca pública do mural de certificados de apresentação/premiação
 * (2026-11-13, pedido explícito do usuário — decisão com o chefe da
 * comissão: "ter um lugar pra postar igual do edital... a pessoa busca
 * pelo nome ou pelo título"). Mesmo padrão de
 * /api/ensalamento/consulta — sem autenticação de propósito, só funciona
 * com `eventos/{id}.certificadosGrupoPublicosAtivo === true` (liga/desliga
 * em Trabalhos → Resultado Final → "Certificados públicos"). Devolve só o
 * necessário pra montar a lista; os PDFs em si vêm de
 * GET .../apresentacao e .../premiacao, chamados só quando a pessoa clica
 * em baixar.
 *
 * Listagem padrão + paginação de 20 (2026-11-16, pedido explícito do
 * usuário — "acho justo quando a pessoa entrar já apareça uns 20
 * trabalhos ali pra não ficar a tela vazia... 20 por 20, cada página").
 * Sem termo de busca, devolve os trabalhos do evento em ordem alfabética
 * de título, paginados; com termo (≥2 letras), filtra por nome/título/
 * orientador e pagina o resultado filtrado do mesmo jeito. `?pagina=` é
 * 1-based; a página pedida nunca passa do total (evita página vazia por
 * engano se o total encolher entre uma busca e outra). */
export async function GET(request: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("eventoId");
    // Corta em 100 caracteres (2026-11-16, pedido explícito do usuário —
    // "se precavenha de injeção... fica exposta e vai no banco de
    // dados") — nenhum nome/título de verdade chega perto disso; é só
    // defesa contra string gigante sendo normalizada e comparada contra
    // todo trabalho do evento à toa.
    const busca = (url.searchParams.get("busca") ?? "").trim().slice(0, 100);
    const paginaPedida = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
    if (!idFirestoreValido(eventoId)) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento || evento.certificadosGrupoPublicosAtivo !== true) {
      return NextResponse.json({ ativo: false });
    }

    const eventoNome = evento.nome as string;
    const termo = busca.length >= 2 ? normalizar(busca) : null;

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

    const todos: {
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

      if (termo) {
        const bate =
          normalizar(t.titulo ?? "").includes(termo) ||
          autoresLista.some((nome) => normalizar(nome).includes(termo)) ||
          orientacaoLista.some((nome) => normalizar(nome).includes(termo));
        if (!bate) continue;
      }

      todos.push({
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

    todos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));

    const total = todos.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(paginaPedida, totalPaginas);
    const inicio = (pagina - 1) * POR_PAGINA;
    const resultados = todos.slice(inicio, inicio + POR_PAGINA);

    return NextResponse.json({ ativo: true, eventoNome, resultados, pagina, totalPaginas, total });
  } catch (e) {
    console.error("Erro na busca pública de certificados:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
