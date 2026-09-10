"use client";

import Link from "next/link";
import { Check, GraduationCap, UserPlus, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { responderConviteTurma, useTurmasDoAluno } from "@/lib/data/turmas";
import { useIndicadorEventos } from "@/lib/data/eventos";

export default function ProjetoIntegradorAlunoPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { turmas } = useTurmasDoAluno(user?.uid);
  const temEventoPendente = useIndicadorEventos(perfil, user?.uid);

  const convites = turmas.filter((t) => t.convitesPendentesUids?.includes(user?.uid ?? ""));
  const turmasAceitas = turmas.filter((t) => !t.convitesPendentesUids?.includes(user?.uid ?? ""));

  function responder(turma: (typeof turmas)[number], aceitar: boolean) {
    if (!user) return;
    responderConviteTurma(turma, user.uid, aceitar);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente)}
        activeHref="/aluno/projeto-integrador"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Projeto Integrador
          </h1>
          <p className="text-sm text-fatec-muted">
            Suas turmas e o andamento dos trabalhos com o orientador.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {convites.length > 0 && (
            <section className="mb-8 flex flex-col gap-3">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Convites pendentes
              </h2>
              {convites.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl border border-fatec-orange-200 bg-fatec-orange-50 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-fatec-orange-600">
                      <UserPlus className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-fatec-navy-900">
                        {t.orientadorNome} te convidou pra turma{" "}
                        <span className="font-semibold">{t.nome}</span>
                      </p>
                      {t.disciplina && (
                        <p className="mt-0.5 text-sm text-fatec-muted">{t.disciplina}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      onClick={() => responder(t, false)}
                      className="flex items-center gap-1.5 rounded-lg border border-fatec-line bg-white px-3.5 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => responder(t, true)}
                      className="flex items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {turmasAceitas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <GraduationCap className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Você ainda não faz parte de nenhuma turma
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Peça pro seu orientador te convidar pra turma do Projeto
                Integrador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {turmasAceitas.map((t) => (
                <Link
                  key={t.id}
                  href={`/aluno/projeto-integrador/${t.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-fatec-line bg-white p-5 transition-colors hover:border-fatec-sky-600"
                >
                  <div>
                    <h2 className="font-semibold leading-snug text-fatec-navy-900">{t.nome}</h2>
                    {t.disciplina && (
                      <p className="mt-1 text-sm text-fatec-muted">{t.disciplina}</p>
                    )}
                  </div>
                  <p className="mt-5 border-t border-fatec-line pt-4 text-sm text-fatec-muted">
                    Orientador: {t.orientadorNome}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
