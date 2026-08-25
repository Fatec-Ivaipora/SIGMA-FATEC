"use client";

import { Award } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";

export default function AlunoCertificacoesPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventosPublicos();

  const aceitos = trabalhos.filter((t) => t.status === "aceito");

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec)}
        activeHref="/aluno/certificacoes"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Certificados emitidos para trabalhos aceitos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {aceitos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Award className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum certificado ainda
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Certificados aparecem aqui assim que um trabalho seu for
                aceito e a organização confirmar o evento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {aceitos.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 rounded-2xl border border-fatec-line bg-white p-5"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                    <Award className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fatec-navy-900">
                      {t.titulo}
                    </p>
                    <p className="text-sm text-fatec-muted">
                      {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                    </p>
                  </div>
                  <span className="flex-none text-xs font-medium text-fatec-muted">
                    Certificado em preparação
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
