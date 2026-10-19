import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { AtaRegistroPDF } from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO } from "@/lib/assinantesCertificado";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Ata de Registro (2026-10-19, pedido explícito do usuário) — só depois
 * que o evento encerra E certificados já foram emitidos (ver botão em
 * /eventos, que já checa isso antes de deixar clicar, mas o servidor nunca
 * confia só na UI — princípio #1 do projeto). Número da ata/livro/ano vêm
 * do formulário (digitado por quem gera, de propósito — ver comentário em
 * AtaRegistroPDF). `registrosCertificados` é a fonte de verdade de quem foi
 * registrado — não refaz o cálculo, só lê o que `obterNumeroRegistro` (em
 * ../route.ts) já gravou ao longo do evento. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const chamador = (await db.doc(`usuarios/${uid}`).get()).data();

    const { searchParams } = new URL(request.url);
    const eventoId = searchParams.get("eventoId");
    const numeroAta = searchParams.get("numeroAta");
    const ano = searchParams.get("ano");
    const livro = searchParams.get("livro");
    if (!eventoId || !numeroAta || !ano || !livro) {
      return NextResponse.json(
        { erro: "eventoId, numeroAta, ano e livro são obrigatórios." },
        { status: 400 },
      );
    }

    const souAdmin = chamador?.papel === "admin";
    const souOrganizacaoDoEvento =
      chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId);
    if (!souAdmin && !souOrganizacaoDoEvento) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    if (!evento.encerrado) {
      return NextResponse.json(
        { erro: "Só é possível gerar a ata depois que o evento for encerrado." },
        { status: 400 },
      );
    }
    // Ainda numerando (2026-10-19, pedido explícito do usuário, achado
    // real: ele gerou a ata enquanto "Liberar" ainda rodava em segundo
    // plano — 174 inscrições, uma de cada vez, uns 30s no total — e
    // saiu uma ata OFICIAL, já com número registrado, faltando mais da
    // metade de quem devia estar nela. Ver flag em ../liberar/route.ts.
    if (evento.liberandoCertificados) {
      return NextResponse.json(
        {
          erro:
            "Ainda está numerando os certificados — espera terminar (pode levar um tempo com muitos inscritos) antes de gerar a ata.",
        },
        { status: 400 },
      );
    }

    // Não checa `certificadosLiberados` aqui (2026-10-19, removido depois
    // de pedido explícito do usuário — achado real: o interruptor
    // "Liberar certificados" só liga/desliga o AUTOATENDIMENTO; staff já
    // gera/vê o certificado de qualquer pessoa elegível em Declarações
    // mesmo com o interruptor desligado (ex.: reenviar pra quem perdeu o
    // original), e isso é legítimo — não é "preview". O interruptor pode
    // até ter sido religado/desligado de novo (ex.: pausado por causa de
    // um erro, como aconteceu na Semana de Medicina) sem que isso desfaça
    // certificados já emitidos de verdade. O único sinal que realmente
    // importa é existir registro (`registrosCertificados`, checado
    // abaixo) — se existe, o número já foi atribuído de verdade a alguém,
    // não tem como "desacontecer".

    const registrosSnap = await db
      .collection("registrosCertificados")
      .where("eventoId", "==", eventoId)
      .orderBy("numero", "asc")
      .get();
    if (registrosSnap.empty) {
      return NextResponse.json(
        { erro: "Nenhum certificado foi emitido ainda nesse evento." },
        { status: 400 },
      );
    }
    const registros = registrosSnap.docs.map((d) => ({
      numero: d.data().numero as number,
      nome: d.data().nome as string,
    }));

    const diretor = ASSINANTES_CERTIFICADO.find((a) => a.id === "roni");

    const buffer = await renderToBuffer(
      AtaRegistroPDF({
        numeroAta: Number(numeroAta),
        ano: Number(ano),
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
        diretorNome: diretor?.nome ?? "Ronielison Barbosa Ferreira",
        registros,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ata-${numeroAta}-${ano}-livro-${livro}-${slug(evento.nome as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar ata:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar a ata." }, { status: 500 });
  }
}
