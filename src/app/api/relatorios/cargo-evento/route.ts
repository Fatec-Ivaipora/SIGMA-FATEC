import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { RelatorioCargoPDF } from "@/lib/relatorioCargoPdf";

type Cargo = "avaliador" | "orientador" | "moderador" | "monitor";

const LABEL_CARGO: Record<Cargo, string> = {
  avaliador: "Avaliadores",
  orientador: "Orientadores",
  moderador: "Moderadores",
  monitor: "Monitores",
};

const CARGOS_VALIDOS = new Set<Cargo>(["avaliador", "orientador", "moderador", "monitor"]);

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Relatório de pessoas por cargo, pra anexar em prestação de contas ao MEC
 * (2026-11-25, pedido explícito do usuário — "precisamos gerar esse tipo de
 * relatório para anexar caso o MEC peça isso, será por evento"). Avaliador/
 * moderador sempre vêm do cadastro oficial (usuarios.papeisAvaliacao +
 * atribuicoesEventos — mesma fonte usada pra atribuir essas contas a um
 * evento em /usuarios, vale pra MAC e TCC igual). Orientador é diferente
 * por tipo de evento: TCC tem conta de verdade (mesmo cadastro); MAC/
 * demais só tem o nome em texto livre no trabalho (nomeOrientador/
 * nomesCoorientadores, sem conta — ver PRODUCT.md), por isso dedupe pelo
 * nome normalizado em vez de uid. Monitor sempre vem de `monitoresEvento`,
 * igual nos dois tipos de evento. */
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
    const cargoBruto = url.searchParams.get("cargo");
    if (!eventoId || !cargoBruto || !CARGOS_VALIDOS.has(cargoBruto as Cargo)) {
      return NextResponse.json({ erro: "eventoId e cargo (avaliador|orientador|moderador|monitor) são obrigatórios." }, { status: 400 });
    }
    const cargo = cargoBruto as Cargo;

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

    let nomes: string[] = [];

    if (cargo === "monitor") {
      const snap = await db.collection("monitoresEvento").where("eventoId", "==", eventoId).get();
      nomes = snap.docs.map((d) => d.data().nome as string);
    } else if (cargo === "orientador" && evento.tipo !== "tcc") {
      // MAC/outros: orientador é texto livre por trabalho, sem conta —
      // dedupe pelo nome normalizado (não existe uid pra dedupe de verdade).
      const trabSnap = await db.collection("trabalhos").where("eventoId", "==", eventoId).get();
      const porChave = new Map<string, string>();
      for (const d of trabSnap.docs) {
        const t = d.data();
        const candidatos = [t.nomeOrientador as string | undefined, ...((t.nomesCoorientadores as string[] | undefined) ?? [])];
        for (const nome of candidatos) {
          if (!nome?.trim()) continue;
          const chave = semAcento(nome);
          if (!porChave.has(chave)) porChave.set(chave, nome.trim());
        }
      }
      nomes = Array.from(porChave.values());
    } else {
      // avaliador/moderador (qualquer tipo de evento) e orientador de TCC:
      // cadastro oficial, mesma lógica de /api/orientadores — 2 queries
      // (papel primário e papeisAvaliacao são campos diferentes) + filtro
      // por atribuicoesEventos.
      const [porPapel, porPapeisAvaliacao] = await Promise.all([
        db.collection("usuarios").where("papel", "==", cargo).get(),
        db.collection("usuarios").where("papeisAvaliacao", "array-contains", cargo).get(),
      ]);
      const porUid = new Map<string, string>();
      for (const doc of [...porPapel.docs, ...porPapeisAvaliacao.docs]) {
        const dados = doc.data();
        const atribuido = ((dados.atribuicoesEventos ?? []) as { eventoId: string }[]).some(
          (a) => a.eventoId === eventoId,
        );
        if (atribuido) porUid.set(doc.id, dados.nome as string);
      }
      nomes = Array.from(porUid.values());
    }

    nomes.sort((a, b) => a.localeCompare(b, "pt-BR"));

    const geradoEm = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const buffer = await renderToBuffer(
      RelatorioCargoPDF({
        eventoNome: evento.nome as string,
        cargoLabel: LABEL_CARGO[cargo],
        geradoEm,
        nomes,
      }),
    );
    // Nome do arquivo inteiro em caixa alta (2026-11-25, pedido explícito
    // do usuário), incluindo a extensão.
    const nomeArquivo = `relatorio-${cargo}-${slug(evento.nome as string)}.pdf`.toUpperCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Erro ao gerar relatório de cargo do evento:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o relatório." }, { status: 500 });
  }
}
