"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Users } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { criarTurma, useTurmasDoOrientador } from "@/lib/data/turmas";

export default function ProjetoIntegradorOrientadorPage() {
  const { user, perfil, carregando } = useRequireAuth(["orientador"]);
  const { turmas } = useTurmasDoOrientador(user?.uid);

  const [modalCriar, setModalCriar] = useState(false);
  const [nome, setNome] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [criando, setCriando] = useState(false);

  function fecharCriar() {
    setModalCriar(false);
    setNome("");
    setDisciplina("");
  }

  async function confirmarCriarTurma() {
    if (!user || !perfil || !nome.trim()) return;
    setCriando(true);
    try {
      await criarTurma({
        nome: nome.trim(),
        disciplina: disciplina.trim() || undefined,
        orientadorUid: user.uid,
        orientadorNome: perfil.nome,
      });
      fecharCriar();
    } finally {
      setCriando(false);
    }
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/orientador/projeto-integrador"
        userName={perfil.nome}
        userRoleLabel="Orientador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Projeto Integrador
            </h1>
            <p className="text-sm text-fatec-muted">
              Suas turmas — crie uma nova ou abra uma existente para convidar
              alunos e acompanhar os trabalhos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalCriar(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Criar turma
          </button>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {turmas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <GraduationCap className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">Nenhuma turma criada ainda</p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Crie uma turma pra concentrar os trabalhos que você orienta e
                convidar os alunos da Fatec.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {turmas.map((t) => {
                const convites = t.convitesPendentesUids?.length ?? 0;
                const membros = (t.alunosUids?.length ?? 0) - convites;
                return (
                  <Link
                    key={t.id}
                    href={`/orientador/projeto-integrador/${t.id}`}
                    className="group flex flex-col justify-between rounded-2xl border border-fatec-line bg-white p-5 transition-colors hover:border-fatec-sky-600"
                  >
                    <div>
                      <h2 className="font-semibold leading-snug text-fatec-navy-900">
                        {t.nome}
                      </h2>
                      {t.disciplina && (
                        <p className="mt-1 text-sm text-fatec-muted">{t.disciplina}</p>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-fatec-line pt-4">
                      <p className="flex items-center gap-1.5 text-sm text-fatec-muted">
                        <Users className="h-4 w-4 flex-none text-fatec-navy-800" strokeWidth={1.75} />
                        {membros} aluno(s)
                        {convites > 0 && ` · ${convites} convite(s) pendente(s)`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalCriar} onClose={fecharCriar} title="Criar turma">
        <form className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nome da turma <span className="text-fatec-orange-600">*</span>
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Projeto Integrador III — Noite"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Disciplina</span>
            <input
              type="text"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              placeholder="Opcional — ex.: Projeto Integrador III"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <button
            type="button"
            onClick={confirmarCriarTurma}
            disabled={criando || !nome.trim()}
            className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {criando ? "Criando..." : "Criar turma"}
          </button>
        </form>
      </Modal>
    </main>
  );
}
