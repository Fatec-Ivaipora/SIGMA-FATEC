import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function formatarHorario(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LIMITE_RESULTADOS = 30;

/** Consulta pública do ensalamento (2026-11-11, pedido explícito do usuário
 * — "uma tela de consulta... pra deixar com os moderadores e espalhar como
 * QR code pela faculdade, pra pessoa perdida procurar pelo nome dela ou o
 * nome do trabalho"). Sem autenticação nenhuma de propósito — é pra
 * qualquer um com o QR code. Só funciona com
 * `eventos/{id}.consultaPublicaAtiva === true` (liga/desliga na tela de
 * Ensalamento, ao lado de "Gerar PDF") — sem isso, a rota nunca devolve
 * nome/sala/horário de ninguém, só avisa que está indisponível ("se
 * desativar, a url morre", pedido explícito). Busca exige pelo menos 2
 * caracteres (evita listar o evento inteiro de uma vez só, sem motivo) e
 * devolve só o essencial pra achar a sala (nunca e-mail, nota, status,
 * CPF etc. — nada que não esteja já no PDF impresso espalhado pela
 * faculdade). */
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
    if (!evento || evento.consultaPublicaAtiva !== true) {
      return NextResponse.json({ ativo: false });
    }

    const eventoNome = evento.nome as string;
    if (busca.length < 2) {
      return NextResponse.json({ ativo: true, eventoNome, resultados: [] });
    }

    const termo = normalizar(busca);

    const [sessoesSnap, salasSnap, trabalhosSnap] = await Promise.all([
      db.collection("sessoes").where("eventoId", "==", eventoId).get(),
      db.collection("salas").get(),
      db.collection("trabalhos").where("eventoId", "==", eventoId).get(),
    ]);

    const nomeSala = new Map(salasSnap.docs.map((d) => [d.id, d.data().nome as string]));
    const duracaoMin = (evento.duracaoApresentacaoMinutos as number | undefined) ?? 0;

    // sessaoId -> { salaId, salaNome, modalidade, horarioInicio (Date), trabalhoIds }
    const sessaoPorId = new Map(
      sessoesSnap.docs.map((d) => {
        const s = d.data();
        return [
          d.id,
          {
            salaId: s.salaId as string,
            salaNome: nomeSala.get(s.salaId as string) ?? "",
            modalidade: s.modalidade as "oral" | "roda_conversa",
            horarioInicio: (s.horarioInicio as FirebaseFirestore.Timestamp).toDate(),
            horarioFim: (s.horarioFim as FirebaseFirestore.Timestamp).toDate(),
            trabalhoIds: (s.trabalhoIds as string[]) ?? [],
          },
        ];
      }),
    );

    const resultados: {
      titulo: string;
      autores: string;
      salaNome: string;
      horario: string;
    }[] = [];

    for (const d of trabalhosSnap.docs) {
      if (resultados.length >= LIMITE_RESULTADOS) break;
      const t = d.data();
      const autoresLista = [t.alunoNome, ...((t.participantesNomes as string[] | undefined) ?? [])].filter(
        Boolean,
      ) as string[];
      const bate =
        normalizar((t.titulo as string) ?? "").includes(termo) ||
        autoresLista.some((nome) => normalizar(nome).includes(termo));
      if (!bate) continue;

      const sessao = t.sessaoId ? sessaoPorId.get(t.sessaoId as string) : undefined;
      if (!sessao) continue; // ainda não ensalado — nada pra mostrar

      let horario: string;
      if (sessao.modalidade === "oral" && duracaoMin > 0) {
        const indice = sessao.trabalhoIds.indexOf(d.id);
        const inicio = new Date(sessao.horarioInicio.getTime() + Math.max(indice, 0) * duracaoMin * 60000);
        horario = formatarHorario(inicio);
      } else {
        horario = `${formatarHorario(sessao.horarioInicio)} – ${formatarHorario(sessao.horarioFim)}`;
      }

      resultados.push({
        titulo: tituloExibicao(t.titulo as string),
        autores: autoresLista.join(", "),
        salaNome: sessao.salaNome,
        horario,
      });
    }

    return NextResponse.json({ ativo: true, eventoNome, resultados });
  } catch (e) {
    console.error("Erro na consulta pública do ensalamento:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
