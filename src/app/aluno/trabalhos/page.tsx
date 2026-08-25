"use client";

import { useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import { FileStack } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CorrigirTrabalhoModal,
  type DadosCorrecao,
} from "@/components/CorrigirTrabalhoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos } from "@/lib/data/eventos";
import { useTrabalhos, atualizarTrabalho, type Trabalho } from "@/lib/data/trabalhos";

export default function AlunoTrabalhosPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventosPublicos();
  const [corrigindo, setCorrigindo] = useState<Trabalho | null>(null);

  function reenviar(id: string, dados: DadosCorrecao) {
    atualizarTrabalho(id, {
      ...dados,
      status: "aguardando_avaliacao",
      comentarioRevisao: null,
      atualizadoEm: serverTimestamp(),
    });
    setCorrigindo(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec)}
        activeHref="/aluno/trabalhos"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            Seus trabalhos inscritos e o andamento de cada um.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {trabalhos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <FileStack className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum trabalho inscrito ainda
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trabalhos.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium leading-snug text-fatec-navy-900">
                        {t.titulo}
                      </p>
                      {t.alunoUid !== user?.uid &&
                        (t.convitesPendentes?.includes(user?.uid ?? "") ? (
                          <span className="flex-none rounded-full bg-fatec-orange-100 px-2 py-0.5 text-xs font-medium text-fatec-orange-600">
                            Convite pendente
                          </span>
                        ) : (
                          <span className="flex-none rounded-full bg-fatec-navy-50 px-2 py-0.5 text-xs font-medium text-fatec-muted">
                            Participante
                          </span>
                        ))}
                    </div>
                    <p className="mt-0.5 text-sm text-fatec-muted">
                      {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                      {" · "}
                      {t.areaTematica}
                    </p>
                    {(t.participantesNomes?.length ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs text-fatec-muted">
                        Colegas: {t.participantesNomes!.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-none items-center gap-3">
                    <StatusBadge status={t.status} />
                    {t.status === "revisao" && t.alunoUid === user?.uid && (
                      <button
                        type="button"
                        onClick={() => setCorrigindo(t)}
                        className="rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                      >
                        Corrigir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CorrigirTrabalhoModal
        open={!!corrigindo}
        trabalho={corrigindo}
        onClose={() => setCorrigindo(null)}
        onSubmit={(dados) => corrigindo && reenviar(corrigindo.id, dados)}
      />
    </main>
  );
}
