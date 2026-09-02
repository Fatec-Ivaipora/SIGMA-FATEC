"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { InscricaoEventoModal } from "@/components/InscricaoEventoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useMinhaInscricao } from "@/lib/data/inscricoes";
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
  const [participando, setParticipando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const subtitulo = [
    evento.periodoSubmissao && `Inscrições: ${evento.periodoSubmissao}`,
    temTaxa &&
      `Taxa R$ ${evento.valorInscricao!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
          {subtitulo && <p className="text-sm text-fatec-muted">{subtitulo}</p>}
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
            {inscrito ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Trabalho enviado
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onAbrirTrabalho(evento.id)}
                className="w-fit rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
              >
                Inscrever trabalho
              </button>
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
  const [modalEventoId, setModalEventoId] = useState<string | null>(null);
  const [inscricaoEventoId, setInscricaoEventoId] = useState<string | null>(null);

  // Participante externo (sem vínculo com a Fatec) só vê eventos abertos a
  // externos; aluno da Fatec vê todos.
  const eventos = useMemo(
    () =>
      perfil?.vinculoFatec === false
        ? todosEventos.filter((e) => e.aceitaExternos)
        : todosEventos,
    [todosEventos, perfil],
  );

  const eventoModal = eventos.find((e) => e.id === modalEventoId);
  const eventoInscricao = eventos.find((e) => e.id === inscricaoEventoId);

  async function enviarTrabalho(dados: DadosSubmissao) {
    if (!modalEventoId || !user || !perfil) return;
    await addDoc(collection(db, "trabalhos"), {
      ...dados,
      eventoId: modalEventoId,
      alunoUid: user.uid,
      alunoNome: perfil.nome,
      status: "submissao",
      convitesPendentes: dados.participantesUids,
      atualizadoEm: serverTimestamp(),
    });
    setModalEventoId(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec)}
        activeHref="/aluno/eventos"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Eventos
          </h1>
          <p className="text-sm text-fatec-muted">
            {perfil.vinculoFatec === false
              ? "Eventos abertos para inscrição de participantes externos."
              : "Eventos abertos para inscrição."}
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
            {eventos.map((evento) => (
              <CardEvento
                key={evento.id}
                evento={evento}
                inscrito={trabalhos.some((t) => t.eventoId === evento.id)}
                user={user}
                onAbrirTrabalho={setModalEventoId}
                onAbrirInscricao={setInscricaoEventoId}
              />
            ))}

            {eventos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                Nenhum evento cadastrado ainda.
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
          permiteSimulacao={!!eventoInscricao.permiteSimulacaoPagamento}
          user={user}
          onClose={() => setInscricaoEventoId(null)}
        />
      )}
    </main>
  );
}
