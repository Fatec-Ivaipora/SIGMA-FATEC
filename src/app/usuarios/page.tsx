"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, KeyRound, Pencil, Trash2, X, Plus } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { PapelBadge } from "@/components/PapelBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { AtribuicaoEvento, Papel, PapelAvaliacao } from "@/lib/auth";
import { PAPEIS_AVALIACAO } from "@/lib/auth";
import { PAPEL_META } from "@/components/PapelBadge";
import { useEventos } from "@/lib/data/eventos";
import {
  useUsuarios,
  atualizarAtribuicoesUsuario,
  atualizarPapeisAvaliacaoUsuario,
  type UsuarioRegistro,
} from "@/lib/data/usuarios";
import { notificarNovoPapel } from "@/lib/notificarEmail";

const FILTROS: { label: string; papel: Papel | "todos" }[] = [
  { label: "Todos", papel: "todos" },
  { label: "Aluno", papel: "aluno" },
  { label: "Avaliador", papel: "avaliador" },
  { label: "Orientador", papel: "orientador" },
  { label: "Moderador", papel: "moderador" },
  { label: "Organização", papel: "organizacao" },
  { label: "Admin", papel: "admin" },
];

// Avaliador, Orientador e Moderador têm o mesmo formulário de evento+áreas
// temáticas, e são os três papéis que se combinam entre si (2026-08-26) — um
// orientador pode ser alocado como avaliador ou moderador de um evento.
const PAPEIS_COM_AREA: Papel[] = [...PAPEIS_AVALIACAO];

export default function UsuariosPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { usuarios } = useUsuarios();
  const { eventos } = useEventos(perfil);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Papel | "todos">("todos");

  const [modalCriar, setModalCriar] = useState(false);
  const [criarNome, setCriarNome] = useState("");
  const [criarEmail, setCriarEmail] = useState("");
  const [criarPapel, setCriarPapel] = useState<Papel>("aluno");
  const [criarPapeisExtras, setCriarPapeisExtras] = useState<PapelAvaliacao[]>([]);
  const [criarEvento, setCriarEvento] = useState("");
  const [criarAreas, setCriarAreas] = useState<string[]>([]);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  const [redefinindo, setRedefinindo] = useState<UsuarioRegistro | null>(null);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [excluindo, setExcluindo] = useState<UsuarioRegistro | null>(null);

  const [editando, setEditando] = useState<UsuarioRegistro | null>(null);
  const [novoEvento, setNovoEvento] = useState("");
  const [novasAreas, setNovasAreas] = useState<string[]>([]);

  const souAdmin = perfil?.papel === "admin";

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

  function areasDoEvento(eventoId: string): string[] {
    return eventos.find((e) => e.id === eventoId)?.areasTematicas ?? [];
  }

  async function confirmarExclusao() {
    if (!excluindo || !user) return;
    const idToken = await user.getIdToken();
    await fetch("/api/usuarios", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uid: excluindo.uid }),
    });
    setExcluindo(null);
  }

  function fecharRedefinicao() {
    setRedefinindo(null);
    setLinkEnviado(false);
  }

  async function enviarRedefinicao() {
    if (!redefinindo) return;
    await sendPasswordResetEmail(auth, redefinindo.email);
    setLinkEnviado(true);
  }

  function fecharCriar() {
    setModalCriar(false);
    setCriarNome("");
    setCriarEmail("");
    setCriarPapel("aluno");
    setCriarPapeisExtras([]);
    setCriarEvento("");
    setCriarAreas([]);
    setErroCriar(null);
    setSenhaGerada(null);
  }

  function alternarCriarArea(area: string) {
    setCriarAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  function alternarCriarPapelExtra(papel: PapelAvaliacao) {
    setCriarPapeisExtras((prev) =>
      prev.includes(papel) ? prev.filter((p) => p !== papel) : [...prev, papel],
    );
  }

  async function criarUsuario() {
    if (!user) return;
    setCriando(true);
    setErroCriar(null);

    const atribuicoesEventos: AtribuicaoEvento[] =
      PAPEIS_COM_AREA.includes(criarPapel) && criarEvento && criarAreas.length > 0
        ? [{ eventoId: criarEvento, areasTematicas: criarAreas }]
        : criarPapel === "organizacao" && criarEvento
          ? [{ eventoId: criarEvento }]
          : [];

    // Papéis combináveis (2026-08-26) — só faz sentido quando o papel
    // primário já é um dos três (avaliador/orientador/moderador).
    const papeisAvaliacao = PAPEIS_COM_AREA.includes(criarPapel)
      ? Array.from(new Set([criarPapel as PapelAvaliacao, ...criarPapeisExtras]))
      : undefined;

    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/usuarios", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: criarNome,
          email: criarEmail,
          papel: criarPapel,
          atribuicoesEventos,
          papeisAvaliacao,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroCriar(dados.erro ?? "Não foi possível criar o usuário.");
        return;
      }
      setSenhaGerada(dados.senhaTemporaria);
    } finally {
      setCriando(false);
    }
  }

  function abrirEdicao(u: UsuarioRegistro) {
    setEditando(u);
    setNovoEvento("");
    setNovasAreas([]);
  }

  function alternarNovaArea(area: string) {
    setNovasAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  function adicionarAtribuicao() {
    if (!editando || !novoEvento) return;
    if (PAPEIS_COM_AREA.includes(editando.papel) && novasAreas.length === 0) return;

    const atuais = editando.atribuicoesEventos ?? [];
    if (atuais.some((a) => a.eventoId === novoEvento)) return;

    const novaLista: AtribuicaoEvento[] = [
      ...atuais,
      PAPEIS_COM_AREA.includes(editando.papel)
        ? { eventoId: novoEvento, areasTematicas: novasAreas }
        : { eventoId: novoEvento },
    ];

    atualizarAtribuicoesUsuario(editando.uid, novaLista);
    setEditando({ ...editando, atribuicoesEventos: novaLista });
    setNovoEvento("");
    setNovasAreas([]);
  }

  function removerAtribuicao(eventoId: string) {
    if (!editando) return;
    const novaLista = (editando.atribuicoesEventos ?? []).filter(
      (a) => a.eventoId !== eventoId,
    );
    atualizarAtribuicoesUsuario(editando.uid, novaLista);
    setEditando({ ...editando, atribuicoesEventos: novaLista });
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/usuarios"
        userName={perfil.nome}
        userRoleLabel={souAdmin ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Usuários
            </h1>
            <p className="text-sm text-fatec-muted">
              Gerencie quem tem acesso ao sistema.
            </p>
          </div>

          {souAdmin && (
            <button
              type="button"
              onClick={() => setModalCriar(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              <UserPlus className="h-4 w-4" strokeWidth={1.75} />
              Criar usuário
            </button>
          )}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
              <Search className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
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
                    {souAdmin && <th className="px-6 py-3 font-semibold" />}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <tr
                      key={u.uid}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      <td className="px-6 py-4 font-medium text-fatec-navy-900">{u.nome}</td>
                      <td className="px-6 py-4 text-fatec-muted">{u.email}</td>
                      <td className="px-6 py-4">
                        <PapelBadge papel={u.papel} papeisAvaliacao={u.papeisAvaliacao} />
                        {u.papel === "aluno" && (
                          <p className="mt-1 text-xs text-fatec-muted">
                            {u.vinculoFatec === false
                              ? "Externo"
                              : [u.ra ? `RA ${u.ra}` : null, u.curso]
                                  .filter(Boolean)
                                  .join(" · ") || null}
                          </p>
                        )}
                      </td>
                      {souAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {(PAPEIS_COM_AREA.includes(u.papel) || u.papel === "organizacao") && (
                              <button
                                type="button"
                                aria-label={`Editar eventos de ${u.nome}`}
                                onClick={() => abrirEdicao(u)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
                              >
                                <Pencil className="h-4 w-4" strokeWidth={1.75} />
                              </button>
                            )}
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
                      )}
                    </tr>
                  ))}

                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-fatec-muted">
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
      <Modal open={modalCriar} onClose={fecharCriar} title="Criar usuário">
        {senhaGerada ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fatec-ink">
              Conta criada. Repasse essa senha temporária para{" "}
              <span className="font-semibold">{criarNome}</span> — ela pode
              trocá-la depois pelo próprio login:
            </p>
            <p className="rounded-xl bg-fatec-navy-50 px-4 py-2.5 text-center font-mono text-sm font-semibold text-fatec-navy-900">
              {senhaGerada}
            </p>
            <button
              type="button"
              onClick={fecharCriar}
              className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">Nome completo</span>
              <input
                type="text"
                value={criarNome}
                onChange={(e) => setCriarNome(e.target.value)}
                placeholder="Nome completo"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">E-mail</span>
              <input
                type="email"
                value={criarEmail}
                onChange={(e) => setCriarEmail(e.target.value)}
                placeholder="nome@fatecivaipora.com.br"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">Papel</span>
              <select
                value={criarPapel}
                onChange={(e) => {
                  setCriarPapel(e.target.value as Papel);
                  setCriarPapeisExtras([]);
                  setCriarEvento("");
                  setCriarAreas([]);
                }}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              >
                <option value="aluno">Aluno</option>
                <option value="avaliador">Avaliador</option>
                <option value="orientador">Orientador</option>
                <option value="moderador">Moderador</option>
                <option value="organizacao">Organização</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            {PAPEIS_COM_AREA.includes(criarPapel) && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Também atua como
                </span>
                <div className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3">
                  {PAPEIS_AVALIACAO.filter((p) => p !== criarPapel).map((p) => (
                    <label key={p} className="flex items-center gap-2.5 text-sm text-fatec-ink">
                      <input
                        type="checkbox"
                        checked={criarPapeisExtras.includes(p)}
                        onChange={() => alternarCriarPapelExtra(p)}
                        className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                      />
                      {PAPEL_META[p].label}
                    </label>
                  ))}
                </div>
                <span className="text-xs text-fatec-muted">
                  Opcional — combina papéis de avaliação num usuário só (ex.:
                  orientador que também modera apresentações).
                </span>
              </div>
            )}

            {(PAPEIS_COM_AREA.includes(criarPapel) || criarPapel === "organizacao") && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Evento <span className="text-fatec-orange-600">*</span>
                </span>
                <select
                  value={criarEvento}
                  onChange={(e) => {
                    setCriarEvento(e.target.value);
                    setCriarAreas([]);
                  }}
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                >
                  <option value="" disabled>
                    Selecione o evento
                  </option>
                  {eventos.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.nome}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-fatec-muted">
                  Mais eventos podem ser adicionados depois, editando o usuário.
                </span>
              </label>
            )}

            {PAPEIS_COM_AREA.includes(criarPapel) && criarEvento && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Áreas temáticas <span className="text-fatec-orange-600">*</span>
                </span>
                <div className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3">
                  {areasDoEvento(criarEvento).length === 0 && (
                    <span className="text-sm text-fatec-muted">
                      Este evento ainda não tem áreas temáticas cadastradas.
                    </span>
                  )}
                  {areasDoEvento(criarEvento).map((area) => (
                    <label
                      key={area}
                      className="flex items-center gap-2.5 text-sm text-fatec-ink"
                    >
                      <input
                        type="checkbox"
                        checked={criarAreas.includes(area)}
                        onChange={() => alternarCriarArea(area)}
                        className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                      />
                      {area}
                    </label>
                  ))}
                </div>
                <span className="text-xs text-fatec-muted">
                  {criarPapel === "orientador"
                    ? "Pode marcar mais de uma — só preencha se esse orientador também vai avaliar trabalhos desse evento."
                    : "Pode marcar mais de uma — esse avaliador recebe trabalhos de qualquer área marcada."}
                </span>
              </div>
            )}

            {erroCriar && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {erroCriar}
              </p>
            )}

            <p className="text-xs text-fatec-muted">
              Uma senha temporária é gerada na hora — repasse para a pessoa
              definir a própria senha no primeiro login.
            </p>

            <button
              type="button"
              onClick={criarUsuario}
              disabled={criando || !criarNome.trim() || !criarEmail.trim()}
              className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
            >
              {criando ? "Criando..." : "Criar usuário"}
            </button>
          </form>
        )}
      </Modal>

      {/* Redefinir senha */}
      <Modal open={!!redefinindo} onClose={fecharRedefinicao} title="Redefinir senha">
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
                onClick={enviarRedefinicao}
                className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
              >
                Enviar link
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Excluir usuário */}
      <Modal open={!!excluindo} onClose={() => setExcluindo(null)} title="Excluir usuário">
        <p className="text-sm text-fatec-ink">
          Excluir a conta de <span className="font-semibold">{excluindo?.nome}</span>? Essa
          ação não pode ser desfeita.
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

      {/* Editar eventos/área temática (avaliador ou organização) */}
      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={`Eventos de ${editando?.nome ?? ""}`}
      >
        <p className="-mt-2 mb-5 text-sm text-fatec-muted">
          {editando && PAPEIS_COM_AREA.includes(editando.papel)
            ? "Eventos em que esta pessoa avalia trabalhos, e as áreas temáticas designadas em cada um."
            : "Eventos que esta organização enxerga — trabalhos, relatórios e áreas temáticas de outros eventos ficam ocultos para ela."}
        </p>

        {editando && PAPEIS_COM_AREA.includes(editando.papel) && (
          <div className="mb-5 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Também atua como</span>
            <div className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3">
              {PAPEIS_AVALIACAO.filter((p) => p !== editando.papel).map((p) => (
                <label key={p} className="flex items-center gap-2.5 text-sm text-fatec-ink">
                  <input
                    type="checkbox"
                    checked={!!editando.papeisAvaliacao?.includes(p)}
                    onChange={() => {
                      const atuais = editando.papeisAvaliacao ?? [editando.papel as PapelAvaliacao];
                      const ganhando = !atuais.includes(p);
                      const novos = ganhando ? [...atuais, p] : atuais.filter((x) => x !== p);
                      atualizarPapeisAvaliacaoUsuario(editando.uid, editando.papel, novos);
                      // Avisa por e-mail só ao GANHAR um papel (2026-09-11) —
                      // desmarcar não notifica ninguém.
                      if (ganhando && user) notificarNovoPapel(user, editando.uid, p);
                      setEditando({ ...editando, papeisAvaliacao: novos });
                    }}
                    className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                  />
                  {PAPEL_META[p].label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {(editando?.atribuicoesEventos ?? []).map((a) => (
            <div
              key={a.eventoId}
              className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fatec-navy-900">
                  {eventos.find((e) => e.id === a.eventoId)?.nome ?? a.eventoId}
                </p>
                {(a.areasTematicas?.length ?? 0) > 0 && (
                  <p className="truncate text-xs text-fatec-muted">
                    {a.areasTematicas!.join(", ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Remover"
                onClick={() => removerAtribuicao(a.eventoId)}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {(editando?.atribuicoesEventos ?? []).length === 0 && (
            <p className="text-sm text-fatec-muted">Nenhum evento atribuído ainda.</p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <select
            value={novoEvento}
            onChange={(e) => {
              setNovoEvento(e.target.value);
              setNovasAreas([]);
            }}
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
          >
            <option value="" disabled>
              Selecione o evento
            </option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </select>

          {editando && PAPEIS_COM_AREA.includes(editando.papel) && novoEvento && (
            <div className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3">
              {areasDoEvento(novoEvento).length === 0 && (
                <span className="text-sm text-fatec-muted">
                  Este evento ainda não tem áreas temáticas cadastradas.
                </span>
              )}
              {areasDoEvento(novoEvento).map((area) => (
                <label
                  key={area}
                  className="flex items-center gap-2.5 text-sm text-fatec-ink"
                >
                  <input
                    type="checkbox"
                    checked={novasAreas.includes(area)}
                    onChange={() => alternarNovaArea(area)}
                    className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                  />
                  {area}
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={adicionarAtribuicao}
            disabled={
              !novoEvento ||
              (!!editando &&
                PAPEIS_COM_AREA.includes(editando.papel) &&
                novasAreas.length === 0)
            }
            className="flex w-fit flex-none items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Adicionar
          </button>
        </div>
      </Modal>
    </main>
  );
}
