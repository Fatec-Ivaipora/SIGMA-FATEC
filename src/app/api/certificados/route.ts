import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  CertificadoApresentacaoPDF,
  DeclaracaoPDF,
} from "@/lib/certificadosPdf";

type Papel = "aluno" | "avaliador" | "moderador" | "orientador" | "monitor";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Get-or-create: reaproveita o número já atribuído a essa chave se já
 * existir; senão incrementa o contador desse evento numa transação e grava.
 * Contador escopado por evento (2026-09-04, não é mais um contador global
 * único) — cada evento tem seu próprio "livro" de registro, e a organização
 * define em que número ele começa (evento.numeroRegistroInicial, decidido
 * junto com a comissão fora do sistema); os certificados seguintes DESSE
 * evento saem em sequência a partir daí. Ausente = começa em 1. */
async function obterNumeroRegistro(
  chave: string,
  eventoId: string,
  numeroInicial: number,
): Promise<number> {
  const db = getAdminDb();
  const registroRef = db.doc(`registrosCertificados/${chave}`);
  const contadorRef = db.doc(`contadores/certificados_${eventoId}`);

  return db.runTransaction(async (tx) => {
    const registroSnap = await tx.get(registroRef);
    const existente = registroSnap.data()?.numero as number | undefined;
    if (existente) return existente;

    const contadorSnap = await tx.get(contadorRef);
    const numero = (contadorSnap.data()?.proximo as number | undefined) ?? numeroInicial;

    tx.set(contadorRef, { proximo: numero + 1 }, { merge: true });
    tx.set(registroRef, {
      numero,
      livro: "01",
      criadoEm: FieldValue.serverTimestamp(),
    });

    return numero;
  });
}

function faltandoDadosEvento(
  evento: FirebaseFirestore.DocumentData,
  papel: Papel,
): string[] {
  const faltando: string[] = [];
  if (!evento.dataRealizacao) faltando.push("data de realização");
  if (!evento.cargaHoraria) faltando.push("carga horária");
  if (!evento.nomeDiretorAcademico) faltando.push("nome do Diretor Acadêmico");
  if (papel === "aluno" && !evento.nomeCoordenadorPesquisa) {
    faltando.push("nome do Coordenador(a) da Pesquisa e Formação Científica");
  }
  return faltando;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const papel = url.searchParams.get("papel") as Papel | null;

  if (
    papel !== "aluno" &&
    papel !== "avaliador" &&
    papel !== "moderador" &&
    papel !== "monitor" &&
    papel !== "orientador"
  ) {
    return NextResponse.json({ erro: "Papel inválido." }, { status: 400 });
  }

  const db = getAdminDb();
  const chamadorSnap = await db.doc(`usuarios/${uid}`).get();
  const chamador = chamadorSnap.data();

  // Orientador nunca é auto-atendimento (2026-09-11) — é só texto livre no
  // trabalho, sem conta vinculada, então só admin/organização emite, sempre
  // a partir de um trabalho de verdade (nunca aceita o nome vindo solto do
  // client, sempre lê trabalho.nomeOrientador do Firestore).
  if (papel === "orientador") {
    const trabalhoId = url.searchParams.get("trabalhoId");
    if (!trabalhoId) {
      return NextResponse.json({ erro: "trabalhoId é obrigatório." }, { status: 400 });
    }
    const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
    const trabalho = trabalhoSnap.data();
    if (!trabalho) {
      return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
    }
    const ehStaffDoEvento =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        (chamador?.eventosPermitidos ?? []).includes(trabalho.eventoId));
    if (!ehStaffDoEvento) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }
    if (!trabalho.nomeOrientador) {
      return NextResponse.json(
        { erro: "Esse trabalho não tem orientador cadastrado." },
        { status: 400 },
      );
    }
    if (trabalho.status !== "aceito") {
      return NextResponse.json(
        { erro: "Esse trabalho ainda não teve o resultado final aceito." },
        { status: 400 },
      );
    }

    const eventoSnap = await db.doc(`eventos/${trabalho.eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const faltando = faltandoDadosEvento(evento, papel);
    if (faltando.length > 0) {
      return NextResponse.json(
        {
          erro: `O evento "${evento.nome}" ainda não tem os seguintes dados de certificado configurados: ${faltando.join(", ")}. Peça pro admin preencher em Eventos → Certificado.`,
        },
        { status: 400 },
      );
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const buffer = await renderToBuffer(
      DeclaracaoPDF({
        nome: trabalho.nomeOrientador as string,
        papel: "orientador",
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        cargaHoraria: evento.cargaHoraria as number,
        diretorNome: evento.nomeDiretorAcademico as string,
        dataAssinatura: hoje,
      }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="declaracao-orientador-${slug(trabalho.nomeOrientador as string)}.pdf"`,
      },
    });
  }

  // Certificado de apresentação (aluno) — específico de um trabalho.
  if (papel === "aluno") {
    const trabalhoId = url.searchParams.get("trabalhoId");
    if (!trabalhoId) {
      return NextResponse.json({ erro: "trabalhoId é obrigatório." }, { status: 400 });
    }

    const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
    const trabalho = trabalhoSnap.data();
    if (!trabalho) {
      return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
    }

    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        (chamador?.eventosPermitidos ?? []).includes(trabalho.eventoId));

    const pertence =
      uid === trabalho.alunoUid || (trabalho.participantesUids ?? []).includes(uid);
    if (!pertence && !ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }
    if (trabalho.status !== "aceito") {
      return NextResponse.json(
        { erro: "Esse trabalho ainda não teve o resultado final aceito." },
        { status: 400 },
      );
    }
    if (!trabalho.certificadoLiberado && !ehStaff) {
      return NextResponse.json(
        {
          erro:
            "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
        },
        { status: 400 },
      );
    }

    const eventoSnap = await db.doc(`eventos/${trabalho.eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }

    // Pagamento não bloqueia mais submissão/convites (2026-08-31), mas
    // continua bloqueando o certificado: quem ficou com a inscrição desse
    // evento como "não pago" não recebe, mesmo com o trabalho aceito e os
    // certificados liberados. Checado por pessoa (uid de quem está baixando),
    // não pelo dono do trabalho — cada participante tem sua própria inscrição.
    if (!ehStaff && evento.valorInscricao) {
      const inscricaoSnap = await db
        .doc(`inscricoesEvento/${trabalho.eventoId}::${uid}`)
        .get();
      if (inscricaoSnap.data()?.status !== "pago") {
        return NextResponse.json(
          {
            erro:
              "Sua inscrição nesse evento ainda está com pagamento pendente — o certificado só é liberado depois da confirmação do pagamento.",
          },
          { status: 400 },
        );
      }
    }

    const faltando = faltandoDadosEvento(evento, papel);
    if (faltando.length > 0) {
      return NextResponse.json(
        {
          erro: `O evento "${evento.nome}" ainda não tem os seguintes dados de certificado configurados: ${faltando.join(", ")}. Peça pro admin preencher em Eventos → Certificado.`,
        },
        { status: 400 },
      );
    }

    const numero = await obterNumeroRegistro(
      `${trabalhoId}_aluno`,
      trabalho.eventoId as string,
      (evento.numeroRegistroInicial as number | undefined) ?? 1,
    );

    const nomes = [
      trabalho.alunoNome as string,
      ...((trabalho.participantesNomes ?? []) as string[]),
    ];
    if (trabalho.nomeOrientador) nomes.push(trabalho.nomeOrientador as string);

    const premiado = trabalho.premiado === true;
    const buffer = await renderToBuffer(
      CertificadoApresentacaoPDF({
        nomes,
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        tituloTrabalho: trabalho.titulo as string,
        registroNumero: numero,
        diretorNome: evento.nomeDiretorAcademico as string,
        coordenadorNome: evento.nomeCoordenadorPesquisa as string,
        premiado,
      }),
    );

    const prefixoArquivo = premiado ? "certificado" : "declaracao";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${prefixoArquivo}-${slug(trabalho.alunoNome as string)}.pdf"`,
      },
    });
  }

  // Declaração de monitor — não vem de trabalho nenhum, só do cargo
  // atribuído em monitoresEvento pela organização/admin (2026-09-01).
  if (papel === "monitor") {
    const eventoId = url.searchParams.get("eventoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        (chamador?.eventosPermitidos ?? []).includes(eventoId));
    // uidAlvo (2026-09-11) — admin/organização emitindo em nome de outra
    // pessoa (tela de Declarações → "Emitir certificado"), não pra si
    // mesmo. Só staff pode mirar outro uid; qualquer um continua vendo só
    // o próprio.
    const uidAlvo = ehStaff ? (url.searchParams.get("uidAlvo") ?? uid) : uid;

    const monitorSnap = await db.doc(`monitoresEvento/${eventoId}::${uidAlvo}`).get();
    const monitor = monitorSnap.data();
    if (!monitor) {
      return NextResponse.json(
        { erro: "Você não está marcado como monitor nesse evento." },
        { status: 400 },
      );
    }
    if (!monitor.certificadoLiberado && !ehStaff) {
      return NextResponse.json(
        {
          erro:
            "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
        },
        { status: 400 },
      );
    }

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const faltando = faltandoDadosEvento(evento, papel);
    if (faltando.length > 0) {
      return NextResponse.json(
        {
          erro: `O evento "${evento.nome}" ainda não tem os seguintes dados de certificado configurados: ${faltando.join(", ")}. Peça pro admin preencher em Eventos → Certificado.`,
        },
        { status: 400 },
      );
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const buffer = await renderToBuffer(
      DeclaracaoPDF({
        nome: monitor.nome as string,
        papel: "monitor",
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        cargaHoraria: evento.cargaHoraria as number,
        diretorNome: evento.nomeDiretorAcademico as string,
        dataAssinatura: hoje,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="declaracao-monitor-${slug(monitor.nome as string)}.pdf"`,
      },
    });
  }

  // Declaração de avaliador/moderador — uma por (pessoa, papel, evento), não
  // uma por trabalho: a mesma pessoa avalia/modera vários trabalhos do mesmo
  // evento, mas só recebe uma declaração (2026-08-28).
  const eventoId = url.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const ehStaff =
    chamador?.papel === "admin" ||
    (chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId));
  // uidAlvo (2026-09-11) — mesmo mecanismo do monitor acima, ver comentário lá.
  const uidAlvo = ehStaff ? (url.searchParams.get("uidAlvo") ?? uid) : uid;

  const campoUid = papel === "avaliador" ? "avaliadorUid" : "moderadorUid";
  const campoNome = papel === "avaliador" ? "avaliadorNome" : "moderadorNome";

  const trabalhosSnap = await db
    .collection("trabalhos")
    .where("eventoId", "==", eventoId)
    .where(campoUid, "==", uidAlvo)
    .where("status", "==", "aceito")
    .get();

  if (trabalhosSnap.empty) {
    return NextResponse.json(
      {
        erro: `Você ainda não tem nenhum trabalho aceito nesse evento como ${papel}.`,
      },
      { status: 400 },
    );
  }

  const liberado = trabalhosSnap.docs.some((d) => d.data().certificadoLiberado === true);
  if (!liberado && !ehStaff) {
    return NextResponse.json(
      {
        erro:
          "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
      },
      { status: 400 },
    );
  }

  const nome = trabalhosSnap.docs[0].data()[campoNome] as string;

  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }
  const faltando = faltandoDadosEvento(evento, papel);
  if (faltando.length > 0) {
    return NextResponse.json(
      {
        erro: `O evento "${evento.nome}" ainda não tem os seguintes dados de certificado configurados: ${faltando.join(", ")}. Peça pro admin preencher em Eventos → Certificado.`,
      },
      { status: 400 },
    );
  }

  // Sem "Registro sob o N°" na declaração (não aparece nos exemplos reais),
  // então não precisa do contador aqui — só no certificado do aluno.
  const hoje = new Date().toISOString().slice(0, 10);

  const buffer = await renderToBuffer(
    DeclaracaoPDF({
      nome,
      papel,
      eventoNome: evento.nome as string,
      dataRealizacao: evento.dataRealizacao as string,
      cargaHoraria: evento.cargaHoraria as number,
      diretorNome: evento.nomeDiretorAcademico as string,
      dataAssinatura: hoje,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="declaracao-${papel}-${slug(nome)}.pdf"`,
    },
  });
}
