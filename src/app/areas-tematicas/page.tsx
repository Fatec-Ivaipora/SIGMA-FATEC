"use client";

import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";

export default function AreasTematicasPage() {
  const { perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const [novaArea, setNovaArea] = useState<Record<string, string>>({});

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

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/areas-tematicas"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
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
            {eventos.map((evento) => (
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
                  {(evento.areasTematicas ?? []).map((area) => (
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
                  {(evento.areasTematicas ?? []).length === 0 && (
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
              </div>
            ))}

            {eventos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                Nenhum evento cadastrado ainda.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
