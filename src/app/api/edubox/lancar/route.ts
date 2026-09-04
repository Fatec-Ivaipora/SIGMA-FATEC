import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type ParticipanteEnvio = {
  uid: string;
  nome: string;
  cpf: string;
  nascimento: string;
  pago: boolean | null;
  chpins: number | null;
};

/** Lança no Edubox todo mundo elegível de um evento — sem depender do
 * resultado do trabalho (2026-09-04): a lista vem da união de
 * inscricoesEvento (qualquer status) com trabalhos (qualquer status), já
 * que o objetivo do módulo é evitar cadastro duplicado durante todo o
 * período de inscrição.
 *
 * SEMPRE reprocessa todo mundo que está "pronto", inclusive quem já foi
 * enviado antes (2026-09-04, pedido explícito) — o relay não duplica a
 * inscrição em si (dedupe real é a existência da linha em tat_inscricao,
 * não o eduboxLancamentos), mas revisa o status de pagamento a cada
 * chamada: alguém que se inscreveu sem ter pago ainda pode pagar dias
 * depois, e o admin roda esse envio repetidamente durante todo o período —
 * sem reprocessar quem já foi, o pagamento ficaria congelado no valor do
 * primeiro envio. eduboxLancamentos continua existindo só como cache pra
 * popular os contadores da tela sem chamar o relay (rota com
 * apenasStatus). */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let chamadorUid: string;
  try {
    chamadorUid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const db = getAdminDb();
  const chamadorDoc = await db.doc(`usuarios/${chamadorUid}`).get();
  const chamador = chamadorDoc.data();
  const ehStaff =
    chamador?.papel === "admin" ||
    (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).length > 0);
  if (!ehStaff) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { eventoId, apenasStatus } = (await request.json()) as {
    eventoId?: string;
    apenasStatus?: boolean;
  };
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }
  if (
    chamador?.papel === "organizacao" &&
    !(chamador?.eventosPermitidos ?? []).includes(eventoId)
  ) {
    return NextResponse.json({ erro: "Sem permissão nesse evento." }, { status: 403 });
  }
  const eveins = Number(evento.codigoEdubox);
  if (!Number.isInteger(eveins)) {
    return NextResponse.json(
      { erro: "Esse evento ainda não tem o código do Edubox configurado." },
      { status: 400 },
    );
  }

  const relayUrl = process.env.EDUBOX_RELAY_URL;
  const relayToken = process.env.EDUBOX_RELAY_TOKEN;
  if (!relayUrl || !relayToken) {
    return NextResponse.json(
      { erro: "EDUBOX_RELAY_URL / EDUBOX_RELAY_TOKEN ausentes em .env.local / Vercel." },
      { status: 500 },
    );
  }

  // Une inscricoesEvento (qualquer status) com trabalhos (qualquer status) —
  // mesma lógica da tela, replicada aqui pra não confiar em nada vindo do
  // client além do eventoId.
  const mapa = new Map<string, string>();
  // uid -> status da Etapa 1 (pagamento) — só existe pra quem tem
  // inscricoesEvento própria; colega de trabalho sem inscrição própria fica
  // sem entrada aqui (pago fica null, "não sabemos" != "não pagou").
  const statusPagoPorUid = new Map<string, boolean>();
  const [inscricoesSnap, trabalhosSnap] = await Promise.all([
    db.collection("inscricoesEvento").where("eventoId", "==", eventoId).get(),
    db.collection("trabalhos").where("eventoId", "==", eventoId).get(),
  ]);
  inscricoesSnap.forEach((d) => {
    const dados = d.data();
    mapa.set(dados.uid as string, dados.nome as string);
    statusPagoPorUid.set(dados.uid as string, dados.status === "pago");
  });
  trabalhosSnap.forEach((d) => {
    const t = d.data();
    mapa.set(t.alunoUid as string, t.alunoNome as string);
    ((t.participantesUids ?? []) as string[]).forEach((uid, i) => {
      mapa.set(uid, (t.participantesNomes ?? [])[i] ?? uid);
    });
  });
  const todos = Array.from(mapa, ([uid, nome]) => ({ uid, nome }));

  if (todos.length === 0) {
    return NextResponse.json({
      total: 0,
      prontos: 0,
      pendentesDados: 0,
      jaEnviados: 0,
      enviadosAgora: 0,
      pagamentosAtualizados: 0,
      falharam: 0,
    });
  }

  // Busca cpf/dataNascimento de cada um (blocos de 30, limite do "in").
  const uids = todos.map((p) => p.uid);
  const blocos: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) blocos.push(uids.slice(i, i + 30));
  const usuariosSnaps = await Promise.all(
    blocos.map((bloco) =>
      db.collection("usuarios").where("__name__", "in", bloco).get(),
    ),
  );
  const dadosPorUid = new Map<string, { cpf?: string; dataNascimento?: string }>();
  usuariosSnaps.forEach((snap) =>
    snap.forEach((d) => dadosPorUid.set(d.id, { cpf: d.data().cpf, dataNascimento: d.data().dataNascimento })),
  );

  // Carga horária é do evento, igual em todos os certificados — não varia
  // por participante (mesmo campo já usado em /api/certificados).
  const chpins = typeof evento.cargaHoraria === "number" ? evento.cargaHoraria : null;

  const prontos: ParticipanteEnvio[] = [];
  let pendentesDados = 0;
  for (const p of todos) {
    const dados = dadosPorUid.get(p.uid);
    if (dados?.cpf && dados?.dataNascimento) {
      prontos.push({
        uid: p.uid,
        nome: p.nome,
        cpf: dados.cpf,
        nascimento: dados.dataNascimento,
        pago: statusPagoPorUid.has(p.uid) ? (statusPagoPorUid.get(p.uid) as boolean) : null,
        chpins,
      });
    } else {
      pendentesDados++;
    }
  }

  // Só pra popular os contadores "já enviados" da tela — não filtra mais
  // quem vai pro relay (ver comentário no topo do arquivo: todo mundo
  // pronto é sempre reprocessado, pra revisar pagamento).
  const lancamentosSnap = await db
    .collection("eduboxLancamentos")
    .where("eventoId", "==", eventoId)
    .get();
  const jaEnviadosUids = new Set(
    lancamentosSnap.docs.filter((d) => d.data().sucesso === true).map((d) => d.data().uid as string),
  );

  // "apenasStatus" é usado pra popular os contadores da tela sem chamar o
  // relay nem escrever nada — o modal usa isso ao abrir e após cada envio.
  if (apenasStatus || prontos.length === 0) {
    return NextResponse.json({
      total: todos.length,
      prontos: prontos.length,
      pendentesDados,
      jaEnviados: jaEnviadosUids.size,
      enviadosAgora: 0,
      pagamentosAtualizados: 0,
      falharam: 0,
    });
  }

  // Pra enriquecer o log (nome + o que tentamos mandar de pagamento/carga
  // horária) sem precisar reconsultar o Postgres do Edubox depois — aquele
  // banco pode ter a linha removida a qualquer momento por fora do SIGMA
  // (2026-09-04, confirmado: um teste nosso já sumiu de lá logo depois de
  // criado), então o que sabemos no momento do envio é a única fonte
  // confiável pro log.
  const prontosPorUid = new Map(prontos.map((p) => [p.uid, p]));

  const resposta = await fetch(`${relayUrl}/lancar-lote`, {
    method: "POST",
    headers: { Authorization: `Bearer ${relayToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ eveins, participantes: prontos }),
    signal: AbortSignal.timeout(300000),
  });
  if (!resposta.body) {
    return NextResponse.json({ erro: "Falha ao chamar o relay." }, { status: 502 });
  }

  // A partir daqui a resposta é NDJSON (uma linha JSON por participante,
  // 2026-09-04) — repassada pro navegador conforme chega, pra tela mostrar
  // uma barra de progresso real em vez de ficar sem feedback até acabar
  // (listas de 200+ pessoas podem demorar). enviadosAgora = inscrições NOVAS
  // no Edubox nesse envio. pagamentosAtualizados = quem já estava lá mas
  // mudou de não-pago pra pago desde o último envio (ver comentário no topo
  // do arquivo) — os dois são contados e reportados separados, a pedido do
  // usuário, pra não confundir "gente nova" com "gente que só teve o
  // pagamento atualizado".
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const escrever = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const reader = resposta.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let enviadosAgora = 0;
      let pagamentosAtualizados = 0;
      let falharam = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let quebra: number;
          while ((quebra = buffer.indexOf("\n")) !== -1) {
            const linha = buffer.slice(0, quebra).trim();
            buffer = buffer.slice(quebra + 1);
            if (!linha) continue;
            const evento = JSON.parse(linha) as {
              tipo: "progresso" | "erro" | "fim";
              uid?: string;
              processados?: number;
              total?: number;
              ok?: boolean;
              codcli?: number;
              codins?: number;
              jaExistiaCliente?: boolean;
              jaExistiaInscricao?: boolean;
              pagamentoAtualizado?: boolean;
              erro?: string;
            };

            if (evento.tipo === "erro") {
              escrever({ tipo: "erro", erro: evento.erro ?? "Falha ao chamar o relay." });
              controller.close();
              return;
            }
            if (evento.tipo === "fim") continue;

            const ref = db.doc(`eduboxLancamentos/${eventoId}::${evento.uid}`);
            const nome = prontosPorUid.get(evento.uid ?? "")?.nome ?? null;
            if (evento.ok) {
              if (evento.jaExistiaInscricao) {
                if (evento.pagamentoAtualizado) pagamentosAtualizados++;
              } else {
                enviadosAgora++;
              }
              await ref.set({
                eventoId,
                uid: evento.uid,
                nome,
                sucesso: true,
                codclEdubox: evento.codcli ?? null,
                codinsEdubox: evento.codins ?? null,
                jaExistiaCliente: evento.jaExistiaCliente ?? false,
                jaExistiaInscricao: evento.jaExistiaInscricao ?? false,
                pagoEnviado: prontosPorUid.get(evento.uid ?? "")?.pago ?? null,
                chpinsEnviado: prontosPorUid.get(evento.uid ?? "")?.chpins ?? null,
                enviadoEm: FieldValue.serverTimestamp(),
              });
            } else {
              falharam++;
              await ref.set({
                eventoId,
                uid: evento.uid,
                nome,
                sucesso: false,
                mensagem: evento.erro ?? "Falha desconhecida.",
                enviadoEm: FieldValue.serverTimestamp(),
              });
            }
            escrever({ tipo: "progresso", processados: evento.processados, total: evento.total });
          }
        }

        escrever({
          tipo: "fim",
          total: todos.length,
          prontos: prontos.length,
          pendentesDados,
          jaEnviados: jaEnviadosUids.size,
          enviadosAgora,
          pagamentosAtualizados,
          falharam,
        });
        controller.close();
      } catch (erro) {
        escrever({ tipo: "erro", erro: erro instanceof Error ? erro.message : "Falha desconhecida." });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
