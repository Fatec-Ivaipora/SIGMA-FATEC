"use client";

import { useMemo, useState } from "react";
import {
  Search,
  UserPlus,
  KeyRound,
  Pencil,
  IdCard,
  Trash2,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  useUsuariosPaginado,
  useBuscaUsuarios,
  atualizarAtribuicoesUsuario,
  atualizarPapeisAvaliacaoUsuario,
  type UsuarioRegistro,
} from "@/lib/data/usuarios";
import { notificarNovoPapel } from "@/lib/notificarEmail";
import { CURSOS_FATEC } from "@/lib/cursos";

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

// Orientador escondido por hora de toda seleção nova (2026-10-07, pedido
// explícito do usuário) — contas que já são orientador continuam
// funcionando normalmente (filtro "Orientador" na lista, badge, dados); só
// não aparece mais como opção pra criar nem pra adicionar como papel extra.
const PAPEIS_AVALIACAO_VISIVEIS = PAPEIS_AVALIACAO.filter((p) => p !== "orientador");

export default function UsuariosPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
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
  // Curso (2026-10-07, pedido explícito do usuário — achado real: aluno
  // criado pelo admin ficava sem curso, único jeito de "escapar" da
  // obrigatoriedade que já existia no autocadastro, ver cadastro/aluno).
  // Admin não coleta vinculoFatec aqui, sempre equivale a true (Fatec) —
  // por isso curso é obrigatório pra "aluno" sempre, sem condicional de
  // vínculo (diferente do autocadastro, que só exige quando marca Fatec).
  const [criarCurso, setCriarCurso] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  const [redefinindo, setRedefinindo] = useState<UsuarioRegistro | null>(null);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const [erroRedefinir, setErroRedefinir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<UsuarioRegistro | null>(null);

  const [editando, setEditando] = useState<UsuarioRegistro | null>(null);
  const [novoEvento, setNovoEvento] = useState("");
  const [novasAreas, setNovasAreas] = useState<string[]>([]);

  // Editar nome/e-mail (2026-10-01, pedido explícito do usuário) — resolve
  // sem violar a senha de ninguém; separado do "Editar eventos" acima (esse
  // Pencil já era de outra coisa, eventos/áreas temáticas de avaliador).
  const [editandoPerfil, setEditandoPerfil] = useState<UsuarioRegistro | null>(null);
  const [perfilNome, setPerfilNome] = useState("");
  const [perfilEmail, setPerfilEmail] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  // Filtros extras só fazem sentido dentro de "Aluno" (2026-10-01, pedido
  // explícito) — externo não tem curso, e os outros papéis não têm nenhum
  // dos dois campos.
  const [filtroVinculo, setFiltroVinculo] = useState<"todos" | "fatec" | "externo">("todos");
  const [filtroCurso, setFiltroCurso] = useState("");

  const souAdmin = perfil?.papel === "admin";
  // Organização ganha permissão de criar avaliador/orientador/moderador
  // (2026-10-05, pedido explícito do usuário) — nunca aluno/organização/
  // admin (escalonamento de privilégio), e só pros próprios eventos (já
  // garantido pelo resto da tela, que escopa eventos por RN-15). O server
  // (/api/usuarios) reforça essa mesma regra, nunca confia só na UI.
  const souOrganizacao = perfil?.papel === "organizacao";
  const possoCriarUsuario = souAdmin || souOrganizacao;

  // Paginação + busca (2026-10-05, pedido explícito do usuário: muita
  // requisição no banco pra carregar todo mundo de uma vez) — com busca
  // ativa, troca pra resultado da busca (que já vem filtrada pelo
  // Firestore, até 20 por nome + 20 por e-mail); sem busca, usa a página
  // atual (20 usuários, filtrados por papel no servidor). Os dois ainda
  // passam pelo filtro de vínculo/curso aqui embaixo — esses continuam só no
  // cliente, sobre o que já veio (ver comentário em useUsuariosPaginado).
  const temBusca = busca.trim().length > 0;
  const paginado = useUsuariosPaginado(filtro);
  const busca1 = useBuscaUsuarios(busca);
  const usuarios = temBusca ? busca1.resultado : paginado.usuarios;

  // Reflete uma alteração (papéis, hoje) direto na lista já carregada na tela
  // (2026-10-07 — achado real do usuário: a gravação no Firestore funcionava,
  // mas a tabela só refletia depois de atualizar a página, porque
  // useUsuariosPaginado/useBuscaUsuarios leem uma vez, sem tempo real — ver
  // comentário em useUsuariosPaginado). Atualiza as duas fontes possíveis
  // (paginação normal e resultado de busca), já que só uma está em uso por
  // vez mas não dá pra saber qual sem duplicar a lógica de `temBusca` aqui.
  function atualizarUsuarioLocal(uid: string, patch: Partial<UsuarioRegistro>) {
    const aplicar = (lista: UsuarioRegistro[]) =>
      lista.map((u) => (u.uid === uid ? { ...u, ...patch } : u));
    paginado.setUsuarios(aplicar);
    busca1.setResultado(aplicar);
  }
  const carregandoLista = temBusca ? busca1.carregando : paginado.carregando;
  const erroLista = temBusca ? busca1.erro : paginado.erro;

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const bateFiltro = !temBusca || filtro === "todos" || u.papel === filtro;
      const bateVinculo =
        filtro !== "aluno" ||
        filtroVinculo === "todos" ||
        (filtroVinculo === "externo" ? u.vinculoFatec === false : u.vinculoFatec !== false);
      const bateCurso =
        filtro !== "aluno" || !filtroCurso || u.curso === filtroCurso;
      return bateFiltro && bateVinculo && bateCurso;
    });
  }, [usuarios, temBusca, filtro, filtroVinculo, filtroCurso]);

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
    setErroRedefinir(null);
  }

  // Sem try/catch nenhum antes (2026-10-02, achado: um admin editou o
  // e-mail de um aluno e, na sequência, mandou a redefinição — relatou que
  // "não funcionou", sem erro nenhum na tela). Causa mais provável: clicar
  // rápido demais depois de editar manda pro e-mail ANTIGO (ainda guardado
  // em `redefinindo`, que não atualiza sozinho com a edição de outra
  // pessoa) — e-mail que já não existe mais no Auth depois da troca
  // (auth/user-not-found). Sem captura de erro, a promise rejeitava e a
  // tela ficava do jeito que estava, sem mensagem nenhuma — parecia que
  // "não fez nada", mas na real deu erro e ninguém viu.
  async function enviarRedefinicao() {
    if (!redefinindo || !user) return;
    setErroRedefinir(null);
    setEnviandoLink(true);
    try {
      // Rota própria, não mais sendPasswordResetEmail direto (2026-10-07,
      // achado real: o link que o admin mandava chegava "já expirado" —
      // o envio pelo próprio servidor de e-mail do Firebase é separado de
      // todo o resto do sistema e parece pouco confiável aqui; agora passa
      // pelo mesmo canal (`mail` + Trigger Email) de todo outro e-mail do
      // SIGMA. Authorization identifica o chamador como admin, então a
      // rota devolve o erro de verdade em vez de sempre "ok" — ver
      // /api/auth/recuperar-senha.
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/recuperar-senha", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: redefinindo.email }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        const codigo = corpo?.codigo as string | undefined;
        const mensagem =
          codigo === "auth/user-not-found"
            ? "Esse e-mail não existe mais no Authentication — se você editou o e-mail há pouco, feche e abra essa tela de novo pra pegar o e-mail atualizado."
            : (corpo?.erro ?? "Não foi possível enviar o link. Tente de novo.");
        setErroRedefinir(mensagem);
        return;
      }
      setLinkEnviado(true);
    } catch {
      setErroRedefinir("Falha de conexão — tente de novo.");
    } finally {
      setEnviandoLink(false);
    }
  }

  function fecharCriar() {
    setModalCriar(false);
    setCriarNome("");
    setCriarEmail("");
    setCriarPapel("aluno");
    setCriarPapeisExtras([]);
    setCriarEvento("");
    setCriarAreas([]);
    setCriarCurso("");
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
    setErroCriar(null);

    if (criarPapel === "aluno" && !criarCurso) {
      setErroCriar("Selecione o curso do aluno.");
      return;
    }

    setCriando(true);

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
          ...(criarPapel === "aluno" ? { curso: criarCurso } : {}),
        }),
      });
      // 2026-09-28: um 500 inesperado pode vir sem corpo (erro não tratado no
      // servidor) — .json() direto quebraria com "Unexpected end of JSON
      // input" e a pessoa não via mensagem nenhuma, só um erro no console.
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados) {
        setErroCriar(dados?.erro ?? "Não foi possível criar o usuário. Tente de novo.");
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

  function abrirEdicaoPerfil(u: UsuarioRegistro) {
    setEditandoPerfil(u);
    setPerfilNome(u.nome);
    setPerfilEmail(u.email);
    setErroPerfil(null);
  }

  function fecharEdicaoPerfil() {
    setEditandoPerfil(null);
    setErroPerfil(null);
  }

  async function salvarPerfil() {
    if (!editandoPerfil || !user) return;
    setSalvandoPerfil(true);
    setErroPerfil(null);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editandoPerfil.uid,
          nome: perfilNome,
          email: perfilEmail,
        }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados) {
        setErroPerfil(dados?.erro ?? "Não foi possível salvar. Tente de novo.");
        return;
      }
      setEditandoPerfil(null);
    } finally {
      setSalvandoPerfil(false);
    }
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

          {possoCriarUsuario && (
            <button
              type="button"
              onClick={() => {
                // Organização nunca pode criar aluno/organização/admin —
                // começa já no primeiro papel que ela tem permissão.
                if (souOrganizacao) setCriarPapel("avaliador");
                setModalCriar(true);
              }}
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

          {filtro === "aluno" && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1 rounded-xl bg-fatec-navy-50 p-1">
                {(
                  [
                    { label: "Todos", valor: "todos" },
                    { label: "Fatec", valor: "fatec" },
                    { label: "Externos", valor: "externo" },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.valor}
                    type="button"
                    onClick={() => setFiltroVinculo(v.valor)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      filtroVinculo === v.valor
                        ? "bg-white text-fatec-navy-900 shadow-sm"
                        : "text-fatec-muted hover:text-fatec-navy-900"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <select
                value={filtroCurso}
                onChange={(e) => setFiltroCurso(e.target.value)}
                disabled={filtroVinculo === "externo"}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
              >
                <option value="">Todos os cursos</option>
                {CURSOS_FATEC.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                              aria-label={`Editar nome e e-mail de ${u.nome}`}
                              onClick={() => abrirEdicaoPerfil(u)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
                            >
                              <IdCard className="h-4 w-4" strokeWidth={1.75} />
                            </button>
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
                      <td
                        colSpan={4}
                        className={`px-6 py-10 text-center text-sm ${erroLista ? "text-rose-600" : "text-fatec-muted"}`}
                      >
                        {erroLista ?? (carregandoLista ? "Carregando..." : "Nenhum usuário encontrado.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação (2026-10-05) — só faz sentido na listagem normal; a
              busca já devolve um resultado pronto (até 20 por nome + 20 por
              e-mail), sem próxima/anterior. */}
          {!temBusca && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-fatec-muted">
                Página {paginado.pagina + 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => paginado.setPagina((p) => Math.max(0, p - 1))}
                  disabled={paginado.pagina === 0 || paginado.carregando}
                  className="flex items-center gap-1 rounded-xl border border-fatec-line px-3 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => paginado.setPagina((p) => p + 1)}
                  disabled={!paginado.temProximaPagina || paginado.carregando}
                  className="flex items-center gap-1 rounded-xl border border-fatec-line px-3 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}
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
                  setCriarCurso("");
                }}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              >
                {!souOrganizacao && <option value="aluno">Aluno</option>}
                <option value="avaliador">Avaliador</option>
                <option value="moderador">Moderador</option>
                {!souOrganizacao && (
                  <>
                    <option value="organizacao">Organização</option>
                    <option value="admin">Admin</option>
                  </>
                )}
              </select>
              {souOrganizacao && (
                <span className="text-xs text-fatec-muted">
                  Organização só pode cadastrar avaliador ou moderador — pros
                  eventos que você mesmo tem acesso.
                </span>
              )}
            </label>

            {criarPapel === "aluno" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">Curso</span>
                <select
                  value={criarCurso}
                  onChange={(e) => setCriarCurso(e.target.value)}
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                >
                  <option value="">Selecione o curso</option>
                  {CURSOS_FATEC.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {PAPEIS_COM_AREA.includes(criarPapel) && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Também atua como
                </span>
                <div className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3">
                  {PAPEIS_AVALIACAO_VISIVEIS.filter((p) => p !== criarPapel).map((p) => (
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
              disabled={
                criando ||
                !criarNome.trim() ||
                !criarEmail.trim() ||
                (criarPapel === "aluno" && !criarCurso)
              }
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
            {erroRedefinir && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {erroRedefinir}
              </p>
            )}
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
                disabled={enviandoLink}
                className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
              >
                {enviandoLink ? "Enviando..." : "Enviar link"}
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

      {/* Editar nome/e-mail (2026-10-01) */}
      <Modal open={!!editandoPerfil} onClose={fecharEdicaoPerfil} title="Editar usuário">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Nome completo</span>
            <input
              type="text"
              value={perfilNome}
              onChange={(e) => setPerfilNome(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">E-mail</span>
            <input
              type="email"
              value={perfilEmail}
              onChange={(e) => setPerfilEmail(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
            <span className="text-xs text-fatec-muted">
              Troca o e-mail de login de verdade (não só o que aparece na
              tela) — a pessoa passa a entrar com esse e-mail novo, com a
              mesma senha de antes.
            </span>
          </label>

          {erroPerfil && (
            <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {erroPerfil}
            </p>
          )}

          <button
            type="button"
            onClick={salvarPerfil}
            disabled={salvandoPerfil || !perfilNome.trim() || !perfilEmail.trim()}
            className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            {salvandoPerfil ? "Salvando..." : "Salvar"}
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
              {PAPEIS_AVALIACAO_VISIVEIS.filter((p) => p !== editando.papel).map((p) => (
                <label key={p} className="flex items-center gap-2.5 text-sm text-fatec-ink">
                  <input
                    type="checkbox"
                    checked={!!editando.papeisAvaliacao?.includes(p)}
                    onChange={() => {
                      const uid = editando.uid;
                      const atuais = editando.papeisAvaliacao ?? [editando.papel as PapelAvaliacao];
                      const ganhando = !atuais.includes(p);
                      const novos = ganhando ? [...atuais, p] : atuais.filter((x) => x !== p);
                      // Otimista: já reflete no modal e na tabela por trás,
                      // sem esperar o Firestore confirmar — se a gravação
                      // falhar, desfaz os dois abaixo.
                      setEditando({ ...editando, papeisAvaliacao: novos });
                      atualizarUsuarioLocal(uid, { papeisAvaliacao: novos });
                      // Avisa por e-mail só ao GANHAR um papel (2026-09-11) —
                      // desmarcar não notifica ninguém.
                      if (ganhando && user) notificarNovoPapel(user, uid, p);
                      atualizarPapeisAvaliacaoUsuario(uid, editando.papel, novos).catch(() => {
                        setEditando((prev) =>
                          prev && prev.uid === uid ? { ...prev, papeisAvaliacao: atuais } : prev,
                        );
                        atualizarUsuarioLocal(uid, { papeisAvaliacao: atuais });
                      });
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
