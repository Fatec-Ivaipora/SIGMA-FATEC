"use client";

import { Award } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";

export default function AvaliadorCertificacoesPage() {
  const { perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/certificacoes"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Certificados emitidos por sua participação como avaliador.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
              <Award className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="font-medium text-fatec-navy-900">
              Nenhum certificado ainda
            </p>
            <p className="max-w-sm text-sm text-fatec-muted">
              A emissão de certificados de avaliador ainda não foi
              implementada no sistema.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
