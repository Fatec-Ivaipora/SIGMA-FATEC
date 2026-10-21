import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  CertificadoApresentacaoPDF,
  DeclaracaoPDF,
} from "@/lib/certificadosPdf";
import { periodosDoEvento, presencaMinimaDoEvento } from "@/lib/periodosPresenca";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { obterNumeroRegistro, numeroRegistroExistente } from "@/lib/registroCertificados";
import { tituloExibicao } from "@/lib/tituloTrabalho";

type Papel = "aluno" | "avaliador" | "moderador" | "orientador" | "monitor" | "participante";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

// papel não entra mais nessa checagem (2026-09-29) — mesma regra pra
// qualquer papel, só precisa ter pelo menos 1 assinante escolhido. Ver
// CertificadoApresentacaoPDF/DeclaracaoPDF em src/lib/certificadosPdf.tsx,
// que já sabem renderizar com qualquer quantidade de assinaturas.
function faltandoDadosEvento(evento: FirebaseFirestore.DocumentData): string[] {
  const faltando: string[] = [];
  if (!evento.dataRealizacao) faltando.push("data de realização");
  if (!evento.cargaHoraria) faltando.push("carga horária");
  if (!(evento.assinantesCertificadoIds as string[] | undefined)?.length) {
    faltando.push("quem assina o certificado");
  }
  return faltando;
}

/** ids gravados no evento -> dados completos do catálogo (2026-10-05) — um
 * id gravado que não bate com ninguém no catálogo (não deveria acontecer, a
 * tela de Eventos só deixa escolher os cadastrados) é ignorado em silêncio
 * em vez de quebrar a geração do PDF; `faltandoDadosEvento` já garante que
 * sobra pelo menos 1 id antes de chegar aqui. */
function resolverAssinantes(evento: FirebaseFirestore.DocumentData): AssinanteCertificado[] {
  const ids = (evento.assinantesCertificadoIds as string[] | undefined) ?? [];
  return ids
    .map((id) => ASSINANTES_CERTIFICADO.find((a) => a.id === id))
    .filter((a): a is AssinanteCertificado => !!a);
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
    papel !== "orientador" &&
    papel !== "participante"
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
    const faltando = faltandoDadosEvento(evento);
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
        dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
        cargaHoraria: evento.cargaHoraria as number,
        assinantes: resolverAssinantes(evento),
        dataAssinatura: hoje,
        logoCabecalhoId: evento.logoCertificadoId as string | undefined,
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

    // Evento encerrado só trava quem AINDA NÃO tinha número (2026-10-20,
    // corrigido — achado real: Ana Clara já tinha pago e confirmado os 5
    // dias antes de encerrar, mas o botão de baixar sumia/dava erro mesmo
    // assim). A proteção de ata (não deixar emitir número NOVO depois de
    // encerrado, que poderia colidir com a sequência de outro evento
    // criado nesse meio tempo) só precisa valer pra quem geraria um número
    // novo — reimprimir um certificado já numerado (numeração em lote na
    // hora de "Liberar", ver /api/certificados/liberar) não tem esse
    // risco. Staff continua podendo gerar de qualquer forma.
    if (evento.encerrado && !ehStaff) {
      const jaTinhaNumero = await numeroRegistroExistente(`${trabalhoId}_aluno`);
      if (jaTinhaNumero === null) {
        return NextResponse.json(
          { erro: "Esse evento está encerrado — não é mais possível emitir certificado." },
          { status: 400 },
        );
      }
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

    const faltando = faltandoDadosEvento(evento);
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
      trabalho.alunoNome as string,
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
        tituloTrabalho: tituloExibicao(trabalho.titulo as string),
        registroNumero: numero,
        assinantes: resolverAssinantes(evento),
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

  // Certificado de participação (2026-09-22) — evento "simples", sem
  // trabalho/avaliação nenhuma por trás, só a própria inscrição da pessoa.
  // Mesmo espírito do branch "monitor" abaixo (declaração sem trabalho),
  // só que a fonte é inscricoesEvento em vez de monitoresEvento.
  if (papel === "participante") {
    const eventoId = url.searchParams.get("eventoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    if (evento.tipo !== "simples") {
      return NextResponse.json(
        { erro: "Esse evento não emite certificado de participação." },
        { status: 400 },
      );
    }

    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        (chamador?.eventosPermitidos ?? []).includes(eventoId));
    // uidAlvo (2026-10-01) — mesmo mecanismo já usado em avaliador/
    // moderador/monitor: admin/organização emitindo em nome de outra
    // pessoa (tela Declarações → "Emitir certificado"), achado faltando
    // nesse papel — antes só dava pra gerar o PRÓPRIO certificado de
    // participante por essa rota, nunca o de quem foi buscado na tela.
    const uidAlvo = ehStaff ? (url.searchParams.get("uidAlvo") ?? uid) : uid;

    const inscricaoSnap = await db.doc(`inscricoesEvento/${eventoId}::${uidAlvo}`).get();
    const inscricao = inscricaoSnap.data();
    if (!inscricao) {
      return NextResponse.json(
        { erro: "Você não está inscrito nesse evento." },
        { status: 400 },
      );
    }
    // Só exige pagamento se o evento tiver valor de inscrição — mesma regra
    // já usada pro certificado de aluno (linha ~220 acima). Monitor do
    // evento é isento (2026-10-20, pedido explícito do usuário — Semana
    // Acadêmica de Medicina: monitor também é aluno e participou, recebe a
    // declaração de monitor E o certificado de participação, sem pagar).
    // Presença e liberação continuam exigidas igual pra todo mundo.
    const ehMonitorDoEvento =
      !!evento.valorInscricao &&
      (await db.doc(`monitoresEvento/${eventoId}::${uidAlvo}`).get()).exists;
    if (
      evento.valorInscricao &&
      inscricao.status !== "pago" &&
      !ehMonitorDoEvento &&
      !ehStaff
    ) {
      return NextResponse.json(
        {
          erro:
            "Sua inscrição nesse evento ainda está com pagamento pendente — o certificado só é liberado depois da confirmação do pagamento.",
        },
        { status: 400 },
      );
    }
    // Três critérios independentes, todos exigidos (2026-09-30, regra
    // confirmada com o usuário): a organização precisa ter liberado os
    // certificados do evento, o pagamento (se tiver taxa) precisa estar em
    // dia, e PELO MENOS 1 dia de presença precisa ter sido confirmado pelo
    // QR (evento multi-dia — ver comentário abaixo — não exige TODOS os
    // dias, só 1; as horas saem proporcionais). Antes a presença sozinha já
    // liberava o certificado mesmo sem a organização apertar "Liberar" — não
    // é mais assim, os três agora são obrigatórios juntos, não alternativas
    // entre si.
    if (!evento.certificadosLiberados && !ehStaff) {
      return NextResponse.json(
        {
          erro: "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
        },
        { status: 400 },
      );
    }
    // Evento encerrado só trava quem AINDA NÃO tinha número (2026-10-20,
    // corrigido — mesmo achado real do branch "aluno" acima: numeração em
    // lote na hora de "Liberar" já cobre todo mundo elegível naquele
    // momento, reimprimir depois de encerrado não consome número novo,
    // não tem risco de colidir com a sequência de outro evento. Staff
    // (Declarações/preview) continua podendo gerar de qualquer forma.
    if (evento.encerrado && !ehStaff) {
      const jaTinhaNumero = await numeroRegistroExistente(
        `${eventoId}_participante_${uidAlvo}`,
      );
      if (jaTinhaNumero === null) {
        return NextResponse.json(
          { erro: "Esse evento está encerrado — não é mais possível emitir certificado." },
          { status: 400 },
        );
      }
    }
    const diasConfirmados = Object.keys(inscricao.presencasConfirmadas ?? {}).length;
    // Mínimo configurável (2026-10-08, pedido explícito do usuário — Semana
    // de Medicina exige 4 dos 5 períodos, não só 1) — ver
    // presencaMinimaDoEvento em src/lib/periodosPresenca.ts, ausente = "pelo
    // menos 1", comportamento de sempre.
    const minimoExigido = presencaMinimaDoEvento(evento);
    if (diasConfirmados < minimoExigido && !ehStaff) {
      return NextResponse.json(
        {
          erro:
            minimoExigido > 1
              ? `Sua presença confirmada (${diasConfirmados}/${periodosDoEvento(evento)}) não atinge o mínimo exigido (${minimoExigido}) pra emitir o certificado.`
              : "Sua presença nesse evento ainda não foi confirmada — escaneie o QR no local do evento.",
        },
        { status: 400 },
      );
    }

    const faltando = faltandoDadosEvento(evento);
    if (faltando.length > 0) {
      return NextResponse.json(
        {
          erro: `O evento "${evento.nome}" ainda não tem os seguintes dados de certificado configurados: ${faltando.join(", ")}. Peça pro admin preencher em Eventos → Certificado.`,
        },
        { status: 400 },
      );
    }

    // Horas proporcionais (2026-09-30, evento multi-dia) — cargaHoraria
    // continua sendo SEMPRE o total do evento (ver comentário em
    // src/lib/data/eventos.ts), dividido igualmente pelos dias do evento
    // (derivados do intervalo dataRealizacao–dataRealizacaoFim, ver
    // diasDoEvento) e multiplicado pelos dias que essa pessoa efetivamente
    // confirmou. Arredonda só no final (não por dia) pra não acumular erro
    // quando não divide exato — 16h em 3 dias é 5,33.../dia, 2 dias
    // confirmados dá round(2/3 × 16) = 11h, não round(5,33)×2 = 10h. O
    // guard acima já garante diasConfirmados > 0 OU ehStaff; se for staff
    // emitindo sem nenhuma presença gravada, conta como 1 dia (nunca 0).
    // Evento de 1 dia sempre cai em round(1/1 × cargaHoraria) = o total de
    // sempre.
    const diasEvento = periodosDoEvento(evento);
    const diasParaCalculo = diasConfirmados > 0 ? diasConfirmados : 1;
    const cargaHorariaTotal = evento.cargaHoraria as number;
    const horasConcedidas = Math.min(
      Math.round((diasParaCalculo / diasEvento) * cargaHorariaTotal),
      cargaHorariaTotal,
    );

    // Registro (2026-10-19, pedido explícito do usuário — achado real:
    // participante usa esse certificado pra comprovar hora complementar, e
    // o número não aparecia. Avaliador/moderador/orientador/monitor
    // continuam sem, ver comentário no branch deles mais abaixo).
    const numeroParticipante = await obterNumeroRegistro(
      `${eventoId}_participante_${uidAlvo}`,
      eventoId,
      (evento.numeroRegistroInicial as number | undefined) ?? 1,
      inscricao.nome as string,
    );

    const hoje = new Date().toISOString().slice(0, 10);
    const buffer = await renderToBuffer(
      DeclaracaoPDF({
        nome: inscricao.nome as string,
        papel: "participante",
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
        cargaHoraria: horasConcedidas,
        assinantes: resolverAssinantes(evento),
        dataAssinatura: hoje,
        logoCabecalhoId: evento.logoCertificadoId as string | undefined,
        registroNumero: numeroParticipante,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificado-participacao-${slug(inscricao.nome as string)}.pdf"`,
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

    const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }

    // Evento "simples" (2026-10-01) — monitor nunca precisa pagar (mesma
    // regra de sempre pro evento completo, ver comentário acima), mas
    // precisa ter COMPARECIDO de verdade — só dá pra provar isso pelo QR,
    // já que não tem trabalho nenhum pra avaliar. Por isso usa a mesma
    // inscricaoEvento/presencasConfirmadas do papel "participante" (o
    // monitor também se inscreve normalmente, só sem precisar pagar) em
    // vez de monitor.certificadoLiberado — esse campo nem tem como ser
    // ligado pra evento simples, já que o botão "Emitir certificados" que
    // o liga só existe na tela de trabalhos (evento completo). A liberação
    // aqui é a mesma de evento.certificadosLiberados, o mesmo botão
    // "Liberar certificados" do Ensalamento que já libera o participante.
    if (evento.tipo === "simples") {
      if (!evento.certificadosLiberados && !ehStaff) {
        return NextResponse.json(
          {
            erro:
              "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
          },
          { status: 400 },
        );
      }
      const inscricaoMonitor = (
        await db.doc(`inscricoesEvento/${eventoId}::${uidAlvo}`).get()
      ).data();
      const diasConfirmadosMonitor = Object.keys(
        inscricaoMonitor?.presencasConfirmadas ?? {},
      ).length;
      if (diasConfirmadosMonitor === 0 && !ehStaff) {
        return NextResponse.json(
          {
            erro:
              "Sua presença nesse evento ainda não foi confirmada — escaneie o QR no local do evento.",
          },
          { status: 400 },
        );
      }
    } else if (!monitor.certificadoLiberado && !ehStaff) {
      return NextResponse.json(
        {
          erro:
            "A organização ainda não liberou os certificados desse evento — aguarde a liberação.",
        },
        { status: 400 },
      );
    }

    const faltando = faltandoDadosEvento(evento);
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
        dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
        cargaHoraria: evento.cargaHoraria as number,
        assinantes: resolverAssinantes(evento),
        dataAssinatura: hoje,
        logoCabecalhoId: evento.logoCertificadoId as string | undefined,
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
  const faltando = faltandoDadosEvento(evento);
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
      dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
      cargaHoraria: evento.cargaHoraria as number,
      assinantes: resolverAssinantes(evento),
      dataAssinatura: hoje,
      logoCabecalhoId: evento.logoCertificadoId as string | undefined,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="declaracao-${papel}-${slug(nome)}.pdf"`,
    },
  });
}
