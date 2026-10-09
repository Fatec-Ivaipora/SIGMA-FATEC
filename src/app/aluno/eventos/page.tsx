"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, QrCode } from "lucide-react";
import { baixarCertificado } from "@/lib/baixarCertificado";
import { ConfirmarPresencaModal } from "@/components/ConfirmarPresencaModal";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { InscricaoEventoModal } from "@/components/InscricaoEventoModal";
import { DestaqueEventoBanner } from "@/components/DestaqueEventoBanner";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, eventosParaAluno, dentroDoPrazoEnvio, type Evento } from "@/lib/data/eventos";
import { periodosDoEvento } from "@/lib/periodosPresenca";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useMinhaInscricao, useMinhasInscricoes, diasConfirmadosCount } from "@/lib/data/inscricoes";
import { useMonitoriasSimplesDoAluno } from "@/lib/data/monitores";
import { notificarConviteColega, notificarStatusTrabalho } from "@/lib/notificarEmail";
import type { User } from "firebase/auth";

function CardEvento({
  evento,
  inscrito,
  user,
  onAbrirTrabalho,
  onAbrirInscricao,
}: {
  evento: Evento;
  inscrito: boolean;
  user: User | null | undefined;
  onAbrirTrabalho: (eventoId: string) => void;
  onAbrirInscricao: (eventoId: string) => void;
}) {
  const temTaxa = !!evento.valorInscricao;
  // Chamado pra TODO evento, não só os com taxa — é a existência desse
  // registro (mesmo que só "interesse") que decide se o card já mostra o
  // fluxo (inscrever trabalho) ou ainda só o botão Inscreva-se. Pagamento
  // não bloqueia mais nada aqui (2026-08-31, pedido da diretoria) — vira só
  // um lembrete separado quando pendente, ver abaixo.
  const { inscricao, carregando } = useMinhaInscricao(evento.id, user?.uid);
  const pago = inscricao?.status === "pago";
  // Evento multi-dia (2026-09-30) — ver diasDoEvento em
  // src/lib/certificadoDias.ts. Parcial (1 de 3 dias, por exemplo) continua
  // mostrando "Confirmar presença" pros dias que faltam; qualquer 1 dia já
  // basta pro certificado aparecer (regra AND com certificadosLiberados +
  // pagamento, corrigida aqui junto — antes esse card específico ainda
  // usava OR entre liberação e presença, desatualizado desde a correção de
  // 2026-09-30 nos outros 3 lugares).
  const diasEventoSimples = periodosDoEvento(evento);
  const diasConfirmados = diasConfirmadosCount(inscricao);
  const algumaPresenca = diasConfirmados > 0;
  const todosDiasConfirmados = diasConfirmados >= diasEventoSimples;
  // "períodos" em vez de "dias" quando o evento tem mais janelas de
  // presença que dias de calendário (2026-10-08, ver periodosDoEvento em
  // src/lib/periodosPresenca.ts).
  const rotuloDias = evento.periodosPresenca ? "períodos" : "dias";
  const [participando, setParticipando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixandoCertificado, setBaixandoCertificado] = useState(false);
  const [erroCertificado, setErroCertificado] = useState<string | null>(null);
  const [confirmandoPresenca, setConfirmandoPresenca] = useState(false);

  async function handleBaixarCertificado() {
    if (!user) return;
    setErroCertificado(null);
    setBaixandoCertificado(true);
    try {
      const resultado = await baixarCertificado(user, {
        papel: "participante",
        eventoId: evento.id,
      });
      if (!resultado.ok) setErroCertificado(resultado.erro);
    } finally {
      setBaixandoCertificado(false);
    }
  }

  // Inscrições e Submissão em linhas separadas, cores diferentes
  // (2026-09-09, pedido do usuário) — são prazos diferentes (inscrição/
  // pagamento vs. enviar o trabalho em si), juntar tudo numa linha só
  // dificultava notar a diferença.
  const linhaTaxa =
    temTaxa &&
    `Taxa R$ ${evento.valorInscricao!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const podeEnviar = dentroDoPrazoEnvio(evento);

  async function participar() {
    if (!user) return;
    setErro(null);
    setParticipando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/asaas/interesse", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId: evento.id }),
      });
      if (!resposta.ok) throw new Error();
    } catch {
      setErro("Não foi possível registrar. Tente de novo.");
    } finally {
      setParticipando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
          <CalendarDays className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-fatec-navy-900">{evento.nome}</p>
          {evento.periodoSubmissao && (
            <p className="text-sm text-fatec-muted">Inscrições: {evento.periodoSubmissao}</p>
          )}
          {evento.periodoEnvioTrabalho && (
            <p className="text-sm font-medium text-fatec-orange-600">
              Submissão: {evento.periodoEnvioTrabalho}
            </p>
          )}
          {linhaTaxa && <p className="text-sm text-fatec-muted">{linhaTaxa}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-fatec-line pt-4">
        {carregando ? null : !inscricao ? (
          <>
            <button
              type="button"
              onClick={participar}
              disabled={participando}
              className="w-fit rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
            >
              {participando ? "Registrando..." : "Inscreva-se"}
            </button>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
          </>
        ) : inscrito && temTaxa && !pago ? (
          // Trabalho já enviado, mas pagamento ainda pendente — vira o único
          // botão da linha (2026-08-31): mais importante que o "enviado"
          // estático, porque ainda tem uma ação pendente de verdade.
          <button
            type="button"
            onClick={() => onAbrirInscricao(evento.id)}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            Pagamento pendente — pagar agora
          </button>
        ) : (
          <>
            {evento.tipo === "simples" ? (
              // Evento simples (2026-09-22) não tem trabalho — chegou até
              // aqui significa que já está inscrito (e pago, se for o
              // caso, tratado no chip de baixo).
              <>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Inscrição confirmada
                </span>
                {todosDiasConfirmados ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {diasEventoSimples > 1
                      ? `Presença confirmada (${diasConfirmados}/${diasEventoSimples} ${rotuloDias})`
                      : "Presença confirmada"}
                  </span>
                ) : (
                  // "Líquido" subindo (2026-10-07, pedido explícito do
                  // usuário) — só faz sentido em evento de vários dias, onde
                  // existe uma fração real de progresso (1/3, 2/3...); em
                  // evento de 1 dia só é um botão binário (sem/com presença),
                  // não tem o que encher. overflow-hidden recorta a camada
                  // de preenchimento pro mesmo contorno arredondado do
                  // botão; o conteúdo (ícone+texto) fica numa camada acima
                  // (z-10), sempre legível por cima do nível de água.
                  <button
                    type="button"
                    onClick={() => setConfirmandoPresenca(true)}
                    className="relative inline-flex w-fit items-center gap-1.5 overflow-hidden rounded-full border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    {diasEventoSimples > 1 && diasConfirmados > 0 && (
                      <span
                        aria-hidden="true"
                        className="sigma-liquid-fill absolute inset-y-0 left-0 w-full border-r-2 border-fatec-sky-600 bg-fatec-sky-600/20"
                        style={{ transform: `scaleX(${diasConfirmados / diasEventoSimples})` }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
                      {diasEventoSimples > 1
                        ? `Confirmar presença (${diasConfirmados}/${diasEventoSimples} ${rotuloDias})`
                        : "Confirmar presença"}
                    </span>
                  </button>
                )}
                {/* Mesma regra de /api/certificados (papel "participante",
                    2026-09-30): liberado + pagamento (já garantido aqui,
                    senão teria caído no branch "pagamento pendente" acima) +
                    PELO MENOS 1 dia de presença confirmado, todos exigidos
                    juntos — antes esse card usava OR, desatualizado desde a
                    correção da regra nos outros lugares. */}
                {evento.certificadosLiberados && algumaPresenca && (
                  <button
                    type="button"
                    onClick={handleBaixarCertificado}
                    disabled={baixandoCertificado}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} />
                    {baixandoCertificado ? "Gerando..." : "Baixar certificado"}
                  </button>
                )}
                {erroCertificado && (
                  <p className="w-full text-xs text-rose-600">{erroCertificado}</p>
                )}
                <ConfirmarPresencaModal
                  open={confirmandoPresenca}
                  eventoId={evento.id}
                  user={user}
                  onClose={() => setConfirmandoPresenca(false)}
                />
              </>
            ) : inscrito ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Trabalho enviado
              </span>
            ) : podeEnviar ? (
              <button
                type="button"
                onClick={() => onAbrirTrabalho(evento.id)}
                className="w-fit rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
              >
                Inscrever trabalho
              </button>
            ) : (
              // Prazo de submissão encerrado (2026-09-09, pedido do
              // coordenador) — não dá mais pra enviar um trabalho novo.
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fatec-navy-50 px-3 py-1.5 text-xs font-semibold text-fatec-muted">
                Submissão encerrada
              </span>
            )}

            {temTaxa && !pago && (
              <button
                type="button"
                onClick={() => onAbrirInscricao(evento.id)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                Pagamento pendente — pagar agora
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AlunoEventosPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { eventos: todosEventos } = useEventosPublicos();
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { inscricoes: minhasInscricoes } = useMinhasInscricoes(user?.uid);
  const eventosMonitoradosSimples = useMonitoriasSimplesDoAluno(user?.uid);
  const [modalEventoId, setModalEventoId] = useState<string | null>(null);
  const [inscricaoEventoId, setInscricaoEventoId] = useState<string | null>(null);

  // Encerrado (2026-09-10) some inteiro dessa tela — nem destaque, nem
  // card comum na grade. "Submissões" é sobre descobrir/entrar num evento
  // NOVO; quem já tinha trabalho/inscrição nesse evento antes de encerrar
  // continua vendo ele normalmente em "Meus eventos" (tela inicial) e
  // "Trabalhos" — só a descoberta aqui é que trava.
  const eventos = useMemo(
    () => eventosParaAluno(todosEventos, perfil?.vinculoFatec).filter((e) => !e.encerrado),
    [todosEventos, perfil],
  );

  // Indicador do menu "Submissões" (2026-09-04) — ver eventos.ts/useIndicadorEventos:
  // some assim que o aluno tem inscricaoEvento pra todos os eventos visíveis.
  const temEventoPendente = useMemo(
    () => eventos.some((e) => !minhasInscricoes.has(e.id)),
    [eventos, minhasInscricoes],
  );

  // Banner de destaque (2026-09-04, movido da tela inicial do aluno pra cá —
  // antes ficava em /aluno, mas o CTA dele já leva pra essa mesma tela, então
  // faz mais sentido morar aqui e abrir os modais direto). `eventos` já vem
  // sem os encerrados (ver acima) — o fallback pro primeiro da lista nunca
  // pega um evento fechado.
  // Todos os destaques, não só o primeiro (2026-09-30 — antes só 1 evento
  // virava banner bonito e qualquer outro marcado como destaque caía na
  // grade genérica de baixo, sem banner, parecendo "desconfigurado" do lado
  // do que tem banner; a home já tinha sido corrigida pra isso, essa tela
  // não). Sem nenhum marcado, cai no fallback de sempre (só o primeiro
  // evento aberto vira destaque, não mostra a lista toda como banner).
  const destaques = useMemo(() => {
    const marcados = eventos.filter((e) => e.destaque);
    return marcados.length > 0 ? marcados : eventos.slice(0, 1);
  }, [eventos]);

  // Os cards dos destaques já aparecem nos banners acima — tira eles da
  // grade pra não duplicar (só quando sobra mais gente na grade).
  const eventosGrade = useMemo(() => {
    const idsDestaque = new Set(destaques.map((e) => e.id));
    return eventos.filter((e) => !idsDestaque.has(e.id));
  }, [eventos, destaques]);

  const eventoModal = eventos.find((e) => e.id === modalEventoId);
  const eventoInscricao = eventos.find((e) => e.id === inscricaoEventoId);

  async function enviarTrabalho(dados: DadosSubmissao) {
    if (!modalEventoId || !user || !perfil) return;
    const ref = await addDoc(collection(db, "trabalhos"), {
      ...dados,
      eventoId: modalEventoId,
      alunoUid: user.uid,
      alunoNome: perfil.nome,
      status: "submissao",
      convitesPendentes: dados.participantesUids,
      atualizadoEm: serverTimestamp(),
    });
    notificarStatusTrabalho(user, ref.id, "submetido");
    dados.participantesUids.forEach((colegaUid) => notificarConviteColega(user, ref.id, colegaUid));
    setModalEventoId(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente, eventosMonitoradosSimples.length > 0)}
        activeHref="/aluno/eventos"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Submissões
          </h1>
          <p className="text-sm text-fatec-muted">
            {perfil.vinculoFatec === false
              ? "Eventos abertos para inscrição de participantes externos."
              : "Eventos abertos para inscrição."}
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {/* mx-auto (2026-09-10, pedido do usuário) — centraliza em telas
              largas em vez de ficar grudado na esquerda. Banner extraído
              (2026-09-19) pra DestaqueEventoBanner.
              Com 2+ destaques (2026-09-30): grade de até 2 colunas, cada
              card estica pra mesma altura (grid já faz isso sozinho,
              DestaqueEventoBanner só precisa de flex-1 internamente pra
              acompanhar). Com 1 só, mantém o visual de sempre — card único,
              mais estreito (max-w-2xl), centralizado. */}
          {destaques.length > 0 && (
            <div
              className={
                destaques.length > 1
                  ? "mx-auto mb-8 grid max-w-4xl gap-4 sm:grid-cols-2"
                  : "mx-auto mb-8 grid max-w-2xl gap-4"
              }
            >
              {destaques.map((d) => (
                <DestaqueEventoBanner
                  key={d.id}
                  destaque={d}
                  user={user}
                  jaInscrito={trabalhos.some((t) => t.eventoId === d.id)}
                  onAbrirTrabalho={setModalEventoId}
                  onAbrirInscricao={setInscricaoEventoId}
                />
              ))}
            </div>
          )}

          {/* justify-center + auto-fit (2026-09-23, achado: com 1 só card na
              grade, o grid-cols-2 fixo deixava metade da largura vazia à
              direita, ficando torto embaixo do banner centralizado) — as
              colunas encolhem pro tamanho do conteúdo e se juntam no meio
              em vez de esticar em 2 colunas fixas quando sobra pouco
              card. */}
          <div className="mx-auto grid max-w-4xl grid-cols-1 justify-center gap-3 sm:grid-cols-[repeat(auto-fit,minmax(280px,340px))]">
            {eventosGrade.map((evento) => (
              <CardEvento
                key={evento.id}
                evento={evento}
                inscrito={trabalhos.some((t) => t.eventoId === evento.id)}
                user={user}
                onAbrirTrabalho={setModalEventoId}
                onAbrirInscricao={setInscricaoEventoId}
              />
            ))}

            {destaques.length === 0 && eventosGrade.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                {perfil.vinculoFatec === false && todosEventos.length > 0
                  ? "Nenhum evento aberto para participantes externos no momento."
                  : "Nenhum evento cadastrado ainda."}
              </p>
            )}
          </div>
        </div>
      </div>

      {eventoModal && (
        <SubmeterTrabalhoModal
          open={!!eventoModal}
          eventoId={eventoModal.id}
          temTaxa={!!eventoModal.valorInscricao}
          eventoNome={eventoModal.nome}
          areasDisponiveis={eventoModal.areasTematicas ?? []}
          areasComplexas={eventoModal.areasTematicasComplexas ?? []}
          modalidadesPermitidas={eventoModal.modalidadesApresentacao}
          resumoAcademico
          meuUid={user?.uid}
          onClose={() => setModalEventoId(null)}
          onSubmit={enviarTrabalho}
        />
      )}

      {eventoInscricao && (
        <InscricaoEventoModal
          open={!!eventoInscricao}
          eventoId={eventoInscricao.id}
          eventoNome={eventoInscricao.nome}
          valor={eventoInscricao.valorInscricao ?? 0}
          temCpf={!!perfil.cpf}
          user={user}
          onClose={() => setInscricaoEventoId(null)}
        />
      )}
    </main>
  );
}
