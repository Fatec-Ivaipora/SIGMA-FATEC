"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";

export default function AlunoEventosPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { eventos: todosEventos } = useEventosPublicos();
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const [modalEventoId, setModalEventoId] = useState<string | null>(null);

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
          <div className="flex flex-col gap-4">
            {eventos.map((evento) => {
              const inscrito = trabalhos.some((t) => t.eventoId === evento.id);
              return (
                <div
                  key={evento.id}
                  className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                      <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="font-semibold text-fatec-navy-900">
                        {evento.nome}
                      </p>
                      {evento.periodoSubmissao && (
                        <p className="text-sm text-fatec-muted">
                          Inscrições: {evento.periodoSubmissao}
                        </p>
                      )}
                    </div>
                  </div>

                  {inscrito ? (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Inscrição feita
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalEventoId(evento.id)}
                      className="w-fit rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                    >
                      Inscrever trabalho
                    </button>
                  )}
                </div>
              );
            })}

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
          eventoNome={eventoModal.nome}
          areasDisponiveis={eventoModal.areasTematicas ?? []}
          meuUid={user?.uid}
          onClose={() => setModalEventoId(null)}
          onSubmit={enviarTrabalho}
        />
      )}
    </main>
  );
}
