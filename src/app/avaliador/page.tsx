"use client";

import { useState } from "react";
import { LayoutGrid, ClipboardCheck, Award, CalendarDays, Check } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

const NAV_AVALIADOR = [
  { label: "Painel", href: "/avaliador", icon: LayoutGrid },
  { label: "Trabalhos", href: "/avaliador/trabalhos", icon: ClipboardCheck },
  { label: "Certificações", href: "/avaliador/certificacoes", icon: Award },
];

const EVENTOS_ATIVOS = [
  { id: "mac-2026", nome: "MAC 2026", periodo: "Avaliações até 15 de novembro" },
  { id: "mopi-2026", nome: "MOPI 2026", periodo: "Avaliações até 30 de novembro" },
];

export default function AvaliadorPainelPage() {
  const [inscritos, setInscritos] = useState<Record<string, boolean>>({
    "mac-2026": true,
  });

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_AVALIADOR}
        activeHref="/avaliador"
        userName="Prof. Renato Alves"
        userRoleLabel="Avaliador"
        userInitials="RA"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Bem-vindo, Renato
          </h1>
          <p className="text-sm text-fatec-muted">
            Inscreva-se para avaliar trabalhos nos eventos abertos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EVENTOS_ATIVOS.map((evento) => {
              const inscrito = !!inscritos[evento.id];
              return (
                <div
                  key={evento.id}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-fatec-line bg-white p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                    <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="font-semibold text-fatec-navy-900">
                      {evento.nome}
                    </p>
                    <p className="text-sm text-fatec-muted">{evento.periodo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setInscritos((prev) => ({
                        ...prev,
                        [evento.id]: !prev[evento.id],
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      inscrito
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-fatec-orange-500 text-white hover:bg-fatec-orange-600"
                    }`}
                  >
                    {inscrito && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                    {inscrito ? "Inscrito como avaliador" : "Inscrever-se como avaliador"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
