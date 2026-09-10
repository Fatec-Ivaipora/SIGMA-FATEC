"use client";

import { useState } from "react";
import { Plus, X, Tag, Layers, Pencil } from "lucide-react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { AreaComplexaModal } from "@/components/AreaComplexaModal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type AreaTematicaComplexa, type Evento } from "@/lib/data/eventos";
import { recalcularAreasTematicas } from "@/lib/areasTematicas";

export default function AreasTematicasPage() {
  const { perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const [novaArea, setNovaArea] = useState<Record<string, string>>({});
  const [modalAreaComplexa, setModalAreaComplexa] = useState<{
    eventoId: string;
    grupo: AreaTematicaComplexa | null;
  } | null>(null);

  function adicionarArea(eventoId: string) {
    const nome = (novaArea[eventoId] ?? "").trim();
    if (!nome) return;
    updateDoc(doc(db, "eventos", eventoId), {
      areasTematicas: arrayUnion(nome),
    });
    setNovaArea((prev) => ({ ...prev, [eventoId]: "" }));
  }

  function removerArea(eventoId: string, area: string) {
    updateDoc(doc(db, "eventos", eventoId), {
      areasTematicas: arrayRemove(area),
    });
  }

  async function salvarAreaComplexa(evento: Evento, grupo: AreaTematicaComplexa) {
    const grupos = evento.areasTematicasComplexas ?? [];
    const grupoAntigo = grupos.find((g) => g.id === grupo.id) ?? null;
    const novasAreas = recalcularAreasTematicas(evento.areasTematicas ?? [], grupoAntigo, grupo);
    const novosGrupos = grupoAntigo
      ? grupos.map((g) => (g.id === grupo.id ? grupo : g))
      : [...grupos, grupo];
    await updateDoc(doc(db, "eventos", evento.id), {
      areasTematicas: novasAreas,
      areasTematicasComplexas: novosGrupos,
    });
    setModalAreaComplexa(null);
  }

  async function removerAreaComplexa(evento: Evento, grupoId: string) {
    const grupos = evento.areasTematicasComplexas ?? [];
    const grupo = grupos.find((g) => g.id === grupoId) ?? null;
    const novasAreas = recalcularAreasTematicas(evento.areasTematicas ?? [], grupo, null);
    await updateDoc(doc(db, "eventos", evento.id), {
      areasTematicas: novasAreas,
      areasTematicasComplexas: grupos.filter((g) => g.id !== grupoId),
    });
    setModalAreaComplexa(null);
  }

  if (carregando || !perfil) return null;

  const eventoDoModal = eventos.find((e) => e.id === modalAreaComplexa?.eventoId);

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/areas-tematicas"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Áreas temáticas
          </h1>
          <p className="text-sm text-fatec-muted">
            Defina as áreas temáticas de cada evento. Elas são exigidas na
            submissão do trabalho e usadas como filtro em Trabalhos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-4">
            {eventos.map((evento) => {
              const grupos = evento.areasTematicasComplexas ?? [];
              const areasSimples = (evento.areasTematicas ?? []).filter(
                (area) => !grupos.some((g) => area.startsWith(`${g.nomeGrupo} – `)),
              );
              return (
              <div
                key={evento.id}
                className="rounded-2xl border border-fatec-line bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                    <Tag className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </span>
                  <p className="font-semibold text-fatec-navy-900">
                    {evento.nome}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {areasSimples.map((area) => (
                    <span
                      key={area}
                      className="flex items-center gap-1.5 rounded-full bg-fatec-navy-50 py-1.5 pl-3.5 pr-2 text-sm font-medium text-fatec-navy-900"
                    >
                      {area}
                      <button
                        type="button"
                        aria-label={`Remover ${area}`}
                        onClick={() => removerArea(evento.id, area)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-100 hover:text-fatec-navy-900"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                  {areasSimples.length === 0 && grupos.length === 0 && (
                    <p className="text-sm text-fatec-muted">
                      Nenhuma área temática cadastrada ainda.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={novaArea[evento.id] ?? ""}
                    onChange={(e) =>
                      setNovaArea((prev) => ({
                        ...prev,
                        [evento.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarArea(evento.id);
                      }
                    }}
                    placeholder="Ex.: Ciências Exatas e da Terra"
                    className="min-w-0 flex-1 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 sm:max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => adicionarArea(evento.id)}
                    className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    Adicionar
                  </button>
                </div>

                <div className="mt-5 flex flex-col gap-2 border-t border-fatec-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-fatec-muted">
                    Áreas com sub-áreas dentro
                  </p>
                  {grupos.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {grupos.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setModalAreaComplexa({ eventoId: evento.id, grupo: g })}
                          className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-fatec-navy-900">
                            <Layers className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
                            {g.nomeGrupo}
                            <span className="text-xs font-normal text-fatec-muted">
                              ({g.subAreas.length} sub-área{g.subAreas.length === 1 ? "" : "s"})
                            </span>
                          </span>
                          <Pencil className="h-3.5 w-3.5 flex-none text-fatec-muted" strokeWidth={1.75} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalAreaComplexa({ eventoId: evento.id, grupo: null })}
                    className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-fatec-line px-3 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Adicionar área com sub-áreas
                  </button>
                </div>
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

      <AreaComplexaModal
        open={!!modalAreaComplexa}
        grupoInicial={modalAreaComplexa?.grupo ?? null}
        onClose={() => setModalAreaComplexa(null)}
        onSalvar={(grupo) => eventoDoModal && salvarAreaComplexa(eventoDoModal, grupo)}
        onRemover={
          modalAreaComplexa?.grupo && eventoDoModal
            ? () => removerAreaComplexa(eventoDoModal, modalAreaComplexa.grupo!.id)
            : undefined
        }
      />
    </main>
  );
}
