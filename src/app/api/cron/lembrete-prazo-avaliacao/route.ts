import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";
import { tituloExibicao } from "@/lib/tituloTrabalho";

/** "AAAA-MM-DD" no fuso de Brasília — não dá pra usar toISOString() (é UTC,
 * vira o dia errado perto da meia-noite). Usado só pra comparar "amanhã" com
 * o dia do prazo, nunca pra gravar/exibir (isso continua vindo de toDate()
 * direto, como em todo o resto do app). */
function dataLocalBR(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Lembrete de prazo de avaliação (2026-11-04, pedido explícito do usuário
 * — "seria interessante que um dia antes do prazo se encerrar fosse mandada
 * uma mensagem" pros alunos com trabalho em "revisao"). Rota batida 1x/dia
 * pelo Vercel Cron (ver vercel.json) — primeira automação por data deste
 * projeto, tudo antes disso era disparado por ação do usuário. Protegida
 * por CRON_SECRET (variável de ambiente só na Vercel, cadastrada manual no
 * painel — não tem como eu cadastrar por aqui) pra ninguém de fora
 * conseguir chamar e disparar e-mail em massa.
 *
 * Idempotente por trabalho: grava `lembretePrazoEnviadoEm` depois de
 * mandar, nunca manda duas vezes pro mesmo trabalho — importante porque o
 * Vercel Cron do plano grátis não garante o minuto exato, só o dia, então
 * um retry ou uma segunda chamada no mesmo dia não duplica aviso. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const db = getAdminDb();
  const amanhaBR = dataLocalBR(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const eventosSnap = await db.collection("eventos").get();
  const eventosComPrazoAmanha = eventosSnap.docs.filter((d) => {
    const prazo = d.data().prazoAvaliacao as FirebaseFirestore.Timestamp | undefined;
    return !!prazo && dataLocalBR(prazo.toDate()) === amanhaBR;
  });

  let avisados = 0;
  for (const eventoDoc of eventosComPrazoAmanha) {
    const eventoNome = (eventoDoc.data().nome as string | undefined) ?? "seu evento";

    const trabalhosSnap = await db
      .collection("trabalhos")
      .where("eventoId", "==", eventoDoc.id)
      .where("status", "==", "revisao")
      .get();

    for (const trabalhoDoc of trabalhosSnap.docs) {
      const trabalho = trabalhoDoc.data();
      if (trabalho.lembretePrazoEnviadoEm) continue; // já avisado, não repete

      const destinatariosUids = Array.from(
        new Set([
          trabalho.alunoUid as string,
          ...((trabalho.participantesUids as string[] | undefined) ?? []),
        ]),
      );

      const texto = `O prazo de avaliação do evento ${eventoNome} termina amanhã — revise e reenvie o trabalho "${tituloExibicao(trabalho.titulo)}" o quanto antes.`;
      const negritos = [eventoNome, `"${tituloExibicao(trabalho.titulo)}"`];
      const subject = `Prazo terminando amanhã — ${tituloExibicao(trabalho.titulo)}`;

      await Promise.all(
        destinatariosUids.map(async (uid) => {
          const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
          const usuario = usuarioSnap.data();
          if (!usuario) return;

          try {
            await registrarAtividade({
              uid,
              tipo: "lembrete_prazo_avaliacao",
              texto,
              negritos,
              trabalhoId: trabalhoDoc.id,
              eventoId: eventoDoc.id,
            });
          } catch {
            // melhor esforço — não derruba o e-mail abaixo se o feed falhar.
          }

          if (!usuario.email) return;
          const html = modeloEmail(
            `<p>O prazo de avaliação do evento <strong>${eventoNome}</strong> termina <strong>amanhã</strong>.</p>
             <p>Seu trabalho <strong>"${tituloExibicao(trabalho.titulo)}"</strong> ainda está com revisão pendente — se o avaliador pediu ajustes, revise e reenvie o quanto antes. Depois do prazo, não é mais possível avaliar o trabalho.</p>`,
            { texto: "Revisar trabalho", href: `${URL_SISTEMA}/aluno/trabalhos` },
            usuario.nome as string | undefined,
          );
          await enviarEmail({ to: usuario.email, subject, html });
        }),
      );

      await trabalhoDoc.ref.update({ lembretePrazoEnviadoEm: new Date() });
      avisados++;
    }
  }

  return NextResponse.json({ ok: true, eventos: eventosComPrazoAmanha.length, trabalhosAvisados: avisados });
}
