"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, KeyRound, Trash2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { PapelBadge, type Papel } from "@/components/PapelBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";

const FILTROS: { label: string; papel: Papel | "todos" }[] = [
  { label: "Todos", papel: "todos" },
  { label: "Aluno", papel: "aluno" },
  { label: "Avaliador", papel: "avaliador" },
  { label: "Organização", papel: "organizacao" },
  { label: "Admin", papel: "admin" },
];

type Usuario = { id: string; nome: string; email: string; papel: Papel };

const USUARIOS_INICIAL: Usuario[] = [
  { id: "u1", nome: "Beatriz Nogueira", email: "beatriz.nogueira@aluno.fatecivaipora.com.br", papel: "aluno" },
  { id: "u2", nome: "João Pedro Salles", email: "joao.salles@aluno.fatecivaipora.com.br", papel: "aluno" },
  { id: "u3", nome: "Prof. Renato Alves", email: "renato.alves@fatecivaipora.com.br", papel: "avaliador" },
  { id: "u4", nome: "Profa. Camila Duarte", email: "camila.duarte@fatecivaipora.com.br", papel: "avaliador" },
  { id: "u5", nome: "Ana Carolina", email: "ana.carolina@fatecivaipora.com.br", papel: "organizacao" },
  { id: "u6", nome: "Mateus Andrade", email: "mateus.andrade@fatecivaipora.com.br", papel: "admin" },
];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState(USUARIOS_INICIAL);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Papel | "todos">("todos");

  const [modalCriar, setModalCriar] = useState(false);
  const [redefinindo, setRedefinindo] = useState<Usuario | null>(null);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      const bateFiltro = filtro === "todos" || u.papel === filtro;
      const bateBusca =
        !termo ||
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo);
      return bateFiltro && bateBusca;
    });
  }, [usuarios, busca, filtro]);

  function confirmarExclusao() {
    if (!excluindo) return;
    setUsuarios((prev) => prev.filter((u) => u.id !== excluindo.id));
    setExcluindo(null);
  }

  function fecharRedefinicao() {
    setRedefinindo(null);
    setLinkEnviado(false);
  }

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/usuarios"
        userName="Mateus Andrade"
        userRoleLabel="Admin"
        userInitials="MA"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Usuários
            </h1>
            <p className="text-sm text-fatec-muted">
              Gerencie quem tem acesso ao sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalCriar(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            Criar usuário
          </button>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
              <Search
                className="h-4 w-4 flex-none text-fatec-muted"
                strokeWidth={1.75}
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl bg-fatec-navy-50 p-1">
              {FILTROS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFiltro(f.papel)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    filtro === f.papel
                      ? "bg-white text-fatec-navy-900 shadow-sm"
                      : "text-fatec-muted hover:text-fatec-navy-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    <th className="px-6 py-3 font-semibold">Nome</th>
                    <th className="px-6 py-3 font-semibold">E-mail</th>
                    <th className="px-6 py-3 font-semibold">Papel</th>
                    <th className="px-6 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      <td className="px-6 py-4 font-medium text-fatec-navy-900">
                        {u.nome}
                      </td>
                      <td className="px-6 py-4 text-fatec-muted">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <PapelBadge papel={u.papel} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Redefinir senha de ${u.nome}`}
                            onClick={() => setRedefinindo(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
                          >
                            <KeyRound className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${u.nome}`}
                            onClick={() => setExcluindo(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-fatec-muted"
                      >
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Criar usuário */}
      <Modal
        open={modalCriar}
        onClose={() => setModalCriar(false)}
        title="Criar usuário"
      >
        <form className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nome completo
            </span>
            <input
              type="text"
              placeholder="Nome completo"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              E-mail
            </span>
            <input
              type="email"
              placeholder="nome@fatecivaipora.com.br"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Papel
            </span>
            <select className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600">
              <option value="aluno">Aluno</option>
              <option value="avaliador">Avaliador</option>
              <option value="organizacao">Organização</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <p className="text-xs text-fatec-muted">
            Uma senha temporária será enviada por e-mail para o novo usuário
            definir a própria senha.
          </p>

          <button
            type="button"
            onClick={() => setModalCriar(false)}
            className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            Criar usuário
          </button>
        </form>
      </Modal>

      {/* Redefinir senha */}
      <Modal
        open={!!redefinindo}
        onClose={fecharRedefinicao}
        title="Redefinir senha"
      >
        {linkEnviado ? (
          <p className="text-sm text-fatec-ink">
            Link de redefinição enviado para{" "}
            <span className="font-semibold">{redefinindo?.email}</span>.
          </p>
        ) : (
          <>
            <p className="text-sm text-fatec-ink">
              Enviar um link de redefinição de senha para{" "}
              <span className="font-semibold">{redefinindo?.nome}</span> (
              {redefinindo?.email})?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={fecharRedefinicao}
                className="rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setLinkEnviado(true)}
                className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
              >
                Enviar link
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Excluir usuário */}
      <Modal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir usuário"
      >
        <p className="text-sm text-fatec-ink">
          Excluir a conta de{" "}
          <span className="font-semibold">{excluindo?.nome}</span>? Essa ação
          não pode ser desfeita.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setExcluindo(null)}
            className="rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarExclusao}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition-colors hover:bg-rose-700"
          >
            Excluir
          </button>
        </div>
      </Modal>
    </main>
  );
}
