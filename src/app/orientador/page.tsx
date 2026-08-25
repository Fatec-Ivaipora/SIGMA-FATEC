"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, FileClock, GraduationCap, Users } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ORIENTADOR } from "@/lib/navOrientador";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useTurmasDoOrientador, useTurmaTrabalhosDasTurmas } from "@/lib/data/turmas";

export default function OrientadorPainelPage() {
  const { user, perfil, carregando } = useRequireAuth(["orientador"]);
  const { turmas } = useTurmasDoOrientador(user?.uid);
  const { trabalhos } = useTurmaTrabalhosDasTurmas(turmas.map((t) => t.id));

  const totalAlunos = useMemo(() => {
    const uids = new Set<string>();
    for (const t of turmas) for (const uid of t.alunosUids ?? []) uids.add(uid);
    return uids.size;
  }, [turmas]);

  const aguardandoAvaliacao = trabalhos.filter((t) => t.status === "aguardando_avaliacao").length;

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ORIENTADOR}
        activeHref="/orientador"
        userName={perfil.nome}
        userRoleLabel="Orientador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Bem-vindo(a), {perfil.nome}
          </h1>
          <p className="text-sm text-fatec-muted">
            Suas turmas do Projeto Integrador e o andamento dos trabalhos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">{turmas.length}</p>
              <p className="text-sm text-fatec-muted">Turmas</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Users className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">{totalAlunos}</p>
              <p className="text-sm text-fatec-muted">Alunos (todas as turmas)</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-100 text-fatec-navy-800">
                <FileClock className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">{aguardandoAvaliacao}</p>
              <p className="text-sm text-fatec-muted">Trabalhos aguardando avaliação</p>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/orientador/projeto-integrador"
              className="inline-flex items-center gap-2 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              Ver Projeto Integrador
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
