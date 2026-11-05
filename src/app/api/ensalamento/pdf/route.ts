import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { GradeEnsalamentoPDF, type SalaParaPdf } from "@/lib/gradeEnsalamentoPdf";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function formatarHorario(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** PDF do ensalamento (2026-11-05, pedido explícito do usuário — "preciso
 * gerar para jogar nos grupos para os alunos saberem as salas deles") — 1
 * bloco por sala (nome, moderador, horário, modalidade) com a lista de
 * trabalhos daquela sala, logo da Fatec + logo da MAC em toda página. Mesmo
 * agrupamento de src/app/ensalamento/page.tsx (salasComSessoes), só que sem
 * modal — expõe tudo de uma vez, pensado pra impressão/compartilhamento. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("eventoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const [chamadorSnap, eventoSnap] = await Promise.all([
      db.doc(`usuarios/${uid}`).get(),
      db.doc(`eventos/${eventoId}`).get(),
    ]);
    const chamador = chamadorSnap.data();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId));
    if (!ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const [sessoesSnap, salasSnap, trabalhosSnap] = await Promise.all([
      db.collection("sessoes").where("eventoId", "==", eventoId).get(),
      db.collection("salas").get(),
      db.collection("trabalhos").where("eventoId", "==", eventoId).get(),
    ]);
    if (sessoesSnap.empty) {
      return NextResponse.json({ erro: "Nenhuma grade gerada ainda pra esse evento." }, { status: 404 });
    }

    const nomeSala = new Map(salasSnap.docs.map((d) => [d.id, d.data().nome as string]));
    // Autor(es) e moderador em CAIXA ALTA (2026-11-05, pedido explícito do
    // usuário) — só na exibição, igual tituloExibicao já faz com o título;
    // o que está gravado no Firestore continua como foi digitado.
    const infoPorTrabalho = new Map(
      trabalhosSnap.docs.map((d) => {
        const t = d.data();
        const autores = [t.alunoNome, ...((t.participantesNomes as string[] | undefined) ?? [])]
          .filter(Boolean)
          .join(", ")
          .toLocaleUpperCase("pt-BR");
        return [
          d.id,
          {
            titulo: tituloExibicao(t.titulo as string),
            autores,
            area: ((t.areaTematica as string) ?? "").toLocaleUpperCase("pt-BR"),
          },
        ];
      }),
    );
    const moderadoresPorSalaBruto: Record<string, { nome: string }> = evento.moderadoresPorSala ?? {};
    const moderadoresPorSala: Record<string, { nome: string }> = Object.fromEntries(
      Object.entries(moderadoresPorSalaBruto).map(([salaId, m]) => [
        salaId,
        { nome: m.nome.toLocaleUpperCase("pt-BR") },
      ]),
    );
    const duracaoMin = (evento.duracaoApresentacaoMinutos as number | undefined) ?? 0;

    const porSala = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const d of sessoesSnap.docs) {
      const salaId = d.data().salaId as string;
      const lista = porSala.get(salaId) ?? [];
      lista.push(d);
      porSala.set(salaId, lista);
    }

    const salas: SalaParaPdf[] = Array.from(porSala.entries())
      .map(([salaId, docs]) => {
        const ordenados = [...docs].sort(
          (a, b) => a.data().horarioInicio.toMillis() - b.data().horarioInicio.toMillis(),
        );
        const primeira = ordenados[0].data();
        const ultimaFim = Math.max(...ordenados.map((d) => d.data().horarioFim.toMillis()));
        const itens = ordenados.flatMap((d) => {
          const s = d.data();
          const inicio = s.horarioInicio.toDate();
          return (s.trabalhoIds as string[]).map((trabalhoId: string, i: number) => {
            const info = infoPorTrabalho.get(trabalhoId);
            return {
              titulo: info?.titulo ?? trabalhoId,
              autores: info?.autores ?? "",
              area: info?.area ?? "",
              horario:
                s.modalidade === "oral" && duracaoMin > 0
                  ? formatarHorario(new Date(inicio.getTime() + i * duracaoMin * 60000))
                  : undefined,
            };
          });
        });
        return {
          // Caixa alta também no nome da sala (2026-11-05, achado real do
          // usuário — "tem nomes em minúsculo ainda", salas com nome
          // próprio tipo "Morfo Pétalas"/"Semiologia" tinham ficado de
          // fora da passada anterior, que só cobriu autor/moderador).
          salaNome: (nomeSala.get(salaId) ?? salaId).toLocaleUpperCase("pt-BR"),
          moderadorNome: moderadoresPorSala[salaId]?.nome,
          modalidade: primeira.modalidade as "oral" | "roda_conversa",
          horarioInicio: formatarHorario(primeira.horarioInicio.toDate()),
          horarioFim: formatarHorario(new Date(ultimaFim)),
          itens,
        };
      })
      .sort((a, b) => a.salaNome.localeCompare(b.salaNome, "pt-BR", { numeric: true }));

    const geradoEm = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const buffer = await renderToBuffer(
      GradeEnsalamentoPDF({
        eventoNome: (evento.nome as string).toLocaleUpperCase("pt-BR"),
        geradoEm,
        salas,
      }),
    );
    const nomeArquivo = `ensalamento-${slug(evento.nome as string)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        // Sem cache (2026-11-05, achado real do usuário — "tem nomes em
        // minúsculo ainda", mesmo depois do fix já ter subido; suspeita de
        // PDF antigo guardado em cache do navegador com o mesmo nome de
        // arquivo). Esse PDF é sempre gerado na hora, nunca deve reaproveitar
        // uma resposta anterior.
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Erro ao gerar PDF do ensalamento:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o PDF." }, { status: 500 });
  }
}
