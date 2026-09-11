"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileCheck,
  Loader2,
  Plus,
  ScrollText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useMonitoresDoEvento } from "@/lib/data/monitores";
import { baixarCertificado } from "@/lib/baixarCertificado";
import {
  useDeclaracoesAgrupadas,
  criarCategoriaDeclaracao,
  excluirCategoriaDeclaracao,
  criarDeclaracao,
  excluirDeclaracao,
  type CategoriaComDeclaracoes,
  type Declaracao,
} from "@/lib/data/declaracoes";

// Buscar pessoa + emitir certificado/declaração (2026-09-11) — a coordenação
// não tinha como emitir o documento de ninguém além de si mesma: a rota
// pegava sempre o uid de quem chamava a API, então avaliador/moderador/
// monitor só conseguiam gerar o PRÓPRIO, e orientador (sem conta nenhuma no
// sistema, só texto livre no trabalho) não tinha rota nenhuma. Corrigido em
// /api/certificados (uidAlvo pra staff mirar outra pessoa; rota nova pra
// orientador usando o nome já salvo no trabalho, sem precisar de CPF).
type CandidatoDocumento = {
  chaveLista: string;
  nome: string;
  rotuloTipo: string;
  contexto?: string;
  textoBusca: string;
  gerar: () => Promise<{ ok: true } | { ok: false; erro: string }>;
};

function EmitirCertificado({
  perfil,
  user,
}: {
  perfil: import("@/lib/auth").PerfilUsuario;
  user: import("firebase/auth").User | null | undefined;
}) {
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const [eventoId, setEventoId] = useState("");
  const [busca, setBusca] = useState("");
  const [baixandoChave, setBaixandoChave] = useState<string | null>(null);
  const [erro, setErro] = useState<{ chave: string; msg: string } | null>(null);

  const { monitores } = useMonitoresDoEvento(eventoId || undefined);

  const candidatos = useMemo<CandidatoDocumento[]>(() => {
    if (!eventoId || !user) return [];
    const lista: CandidatoDocumento[] = [];

    const trabalhosDoEvento = trabalhos.filter(
      (t) => t.eventoId === eventoId && t.status === "aceito",
    );

    for (const t of trabalhosDoEvento) {
      const nomes = [t.alunoNome, ...(t.participantesNomes ?? [])];
      if (t.nomeOrientador) nomes.push(t.nomeOrientador);
      lista.push({
        chaveLista: `certificado_${t.id}`,
        nome: nomes.join(", "),
        rotuloTipo: "Certificado de apresentação",
        contexto: t.titulo,
        textoBusca: nomes.join(" ").toLowerCase(),
        gerar: () => baixarCertificado(user, { papel: "aluno", trabalhoId: t.id }),
      });

      if (t.nomeOrientador) {
        lista.push({
          chaveLista: `orientador_${t.id}`,
          nome: t.nomeOrientador,
          rotuloTipo: "Declaração de orientador(a)",
          contexto: t.titulo,
          textoBusca: t.nomeOrientador.toLowerCase(),
          gerar: () => baixarCertificado(user, { papel: "orientador", trabalhoId: t.id }),
        });
      }
    }

    const avaliadores = new Map<string, string>();
    const moderadores = new Map<string, string>();
    for (const t of trabalhosDoEvento) {
      if (t.avaliadorUid && t.avaliadorNome) avaliadores.set(t.avaliadorUid, t.avaliadorNome);
      if (t.moderadorUid && t.moderadorNome) moderadores.set(t.moderadorUid, t.moderadorNome);
    }
    for (const [uid, nome] of avaliadores) {
      lista.push({
        chaveLista: `avaliador_${uid}`,
        nome,
        rotuloTipo: "Declaração de avaliador(a)",
        textoBusca: nome.toLowerCase(),
        gerar: () =>
          baixarCertificado(user, { papel: "avaliador", eventoId, uidAlvo: uid }),
      });
    }
    for (const [uid, nome] of moderadores) {
      lista.push({
        chaveLista: `moderador_${uid}`,
        nome,
        rotuloTipo: "Declaração de moderador(a)",
        textoBusca: nome.toLowerCase(),
        gerar: () =>
          baixarCertificado(user, { papel: "moderador", eventoId, uidAlvo: uid }),
      });
    }
    for (const m of monitores) {
      lista.push({
        chaveLista: `monitor_${m.uid}`,
        nome: m.nome,
        rotuloTipo: "Declaração de monitor(a)",
        textoBusca: m.nome.toLowerCase(),
        gerar: () =>
          baixarCertificado(user, { papel: "monitor", eventoId, uidAlvo: m.uid }),
      });
    }

    return lista;
  }, [eventoId, trabalhos, monitores, user]);

  const termo = busca.trim().toLowerCase();
  const resultados = termo
    ? candidatos.filter((c) => c.textoBusca.includes(termo))
    : candidatos;

  async function gerar(candidato: CandidatoDocumento) {
    setErro(null);
    setBaixandoChave(candidato.chaveLista);
    const resultado = await candidato.gerar();
    if (!resultado.ok) setErro({ chave: candidato.chaveLista, msg: resultado.erro });
    setBaixandoChave(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-fatec-muted">
        Emite na hora o certificado/declaração de qualquer pessoa do evento —
        pra reenviar quando alguém perde o próprio, ou pra entregar pro
        orientador (que não tem conta no sistema, então nunca recebe
        automaticamente).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="w-full min-w-[240px] appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600"
          >
            <option value="">Selecione o evento</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
            strokeWidth={1.75}
          />
        </div>

        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            disabled={!eventoId}
            placeholder="Buscar por nome — aluno, avaliador, moderador, monitor ou orientador"
            className="w-full rounded-xl border border-fatec-line bg-white py-2.5 pl-10 pr-4 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50"
          />
        </div>
      </div>

      {!eventoId && (
        <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
          Selecione um evento pra começar a buscar.
        </p>
      )}

      {eventoId && (
        <div className="flex flex-col gap-2">
          {resultados.map((c) => (
            <div
              key={c.chaveLista}
              className="flex flex-col gap-2 rounded-xl border border-fatec-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fatec-orange-600">
                  <FileCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {c.rotuloTipo}
                </p>
                <p className="truncate text-sm font-medium text-fatec-navy-900">{c.nome}</p>
                {c.contexto && (
                  <p className="truncate text-xs text-fatec-muted">{c.contexto}</p>
                )}
                {erro?.chave === c.chaveLista && (
                  <p className="mt-1 text-xs text-red-600">{erro.msg}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => gerar(c)}
                disabled={baixandoChave === c.chaveLista}
                className="flex flex-none items-center gap-1.5 rounded-lg border border-fatec-line px-3 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
              >
                {baixandoChave === c.chaveLista ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                Baixar PDF
              </button>
            </div>
          ))}
          {resultados.length === 0 && (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              {candidatos.length === 0
                ? "Nenhum trabalho aceito, monitor ou avaliador/moderador designado nesse evento ainda."
                : "Nenhum resultado pra essa busca."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FormNovaDeclaracao({ categoriaId }: { categoriaId: string }) {
  const [nome, setNome] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!nome.trim() || !arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const caminho = `declaracoes/${categoriaId}/${Date.now()}_${arquivo.name}`;
      const ref = storageRef(storage, caminho);
      await uploadBytes(ref, arquivo);
      const arquivoUrl = await getDownloadURL(ref);
      await criarDeclaracao({ categoriaId, nome: nome.trim(), arquivoUrl, arquivoNome: arquivo.name });
      setNome("");
      setArquivo(null);
    } catch {
      setErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-fatec-line bg-fatec-navy-50/50 p-3 sm:flex-row sm:items-center">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Moderadores - Avaliadores"
        className="flex-1 rounded-lg border border-fatec-line bg-white px-3 py-2 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none focus:border-fatec-sky-600"
      />
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        className="flex-1 text-xs text-fatec-muted file:mr-2 file:rounded-lg file:border-0 file:bg-fatec-navy-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fatec-navy-900"
      />
      <button
        type="button"
        onClick={enviar}
        disabled={!nome.trim() || !arquivo || enviando}
        className="flex flex-none items-center justify-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
      >
        {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Upload className="h-3.5 w-3.5" strokeWidth={2} />}
        Adicionar
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

function CardCategoria({
  categoria,
  onExcluirCategoria,
  onExcluirDeclaracao,
}: {
  categoria: CategoriaComDeclaracoes;
  onExcluirCategoria: (categoria: CategoriaComDeclaracoes) => void;
  onExcluirDeclaracao: (declaracao: Declaracao) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fatec-navy-50 text-fatec-navy-800">
            <ScrollText className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <p className="font-semibold text-fatec-navy-900">{categoria.nome}</p>
        </div>
        <button
          type="button"
          onClick={() => onExcluirCategoria(categoria)}
          aria-label={`Excluir categoria ${categoria.nome}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-fatec-line pt-3">
        {categoria.itens.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-fatec-navy-50/50 px-3 py-2"
          >
            <a
              href={item.arquivoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-fatec-navy-900 hover:text-fatec-sky-600"
            >
              <ExternalLink className="h-3.5 w-3.5 flex-none" strokeWidth={2} />
              <span className="truncate">{item.nome}</span>
            </a>
            <button
              type="button"
              onClick={() => onExcluirDeclaracao(item)}
              aria-label={`Excluir ${item.nome}`}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        ))}
        {categoria.itens.length === 0 && (
          <p className="text-xs text-fatec-muted">Nenhuma declaração nessa categoria ainda.</p>
        )}
      </div>

      <FormNovaDeclaracao categoriaId={categoria.id} />
    </div>
  );
}

export default function DeclaracoesAdminPage() {
  // Organização ganhou acesso aqui em 2026-09-11 (antes era só admin) — a
  // aba nova "Emitir certificado" faz sentido pra ela também (mesmo escopo
  // por evento que já tem no resto do app); a biblioteca de upload manual
  // (aba antiga) passa a ficar visível pra organização também, sem problema
  // nenhum — é só um repositório de PDF, não expõe nada sensível.
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const [aba, setAba] = useState<"biblioteca" | "emitir">("biblioteca");
  const categorias = useDeclaracoesAgrupadas();
  const [novaCategoria, setNovaCategoria] = useState("");
  const [criando, setCriando] = useState(false);
  const [excluindoCategoria, setExcluindoCategoria] = useState<CategoriaComDeclaracoes | null>(null);
  const [excluindoDeclaracao, setExcluindoDeclaracao] = useState<Declaracao | null>(null);

  async function criarCategoria() {
    if (!novaCategoria.trim()) return;
    setCriando(true);
    try {
      await criarCategoriaDeclaracao(novaCategoria.trim());
      setNovaCategoria("");
    } finally {
      setCriando(false);
    }
  }

  async function confirmarExclusaoCategoria() {
    if (!excluindoCategoria) return;
    await excluirCategoriaDeclaracao(
      excluindoCategoria.id,
      excluindoCategoria.itens.map((i) => i.id),
    );
    setExcluindoCategoria(null);
  }

  async function confirmarExclusaoDeclaracao() {
    if (!excluindoDeclaracao) return;
    await excluirDeclaracao(excluindoDeclaracao.id);
    setExcluindoDeclaracao(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/declaracoes"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Declarações
          </h1>
          <p className="text-sm text-fatec-muted">
            {aba === "biblioteca"
              ? "Biblioteca de declarações antigas, organizada por categoria (ex.: um ano) — aparece como menu na home pública, sem precisar de login."
              : "Emite na hora o certificado/declaração de qualquer pessoa do evento, em nome dela."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAba("biblioteca")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                aba === "biblioteca"
                  ? "bg-fatec-navy-900 text-white"
                  : "bg-fatec-navy-50 text-fatec-muted hover:text-fatec-navy-900"
              }`}
            >
              Biblioteca
            </button>
            <button
              type="button"
              onClick={() => setAba("emitir")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                aba === "emitir"
                  ? "bg-fatec-navy-900 text-white"
                  : "bg-fatec-navy-50 text-fatec-muted hover:text-fatec-navy-900"
              }`}
            >
              Emitir certificado
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {aba === "biblioteca" ? (
            <>
              <div className="mb-6 flex max-w-md gap-2">
                <input
                  type="text"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nova categoria — ex.: 2025"
                  className="flex-1 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none focus:border-fatec-sky-600"
                />
                <button
                  type="button"
                  onClick={criarCategoria}
                  disabled={!novaCategoria.trim() || criando}
                  className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Categoria
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {categorias.map((categoria) => (
                  <CardCategoria
                    key={categoria.id}
                    categoria={categoria}
                    onExcluirCategoria={setExcluindoCategoria}
                    onExcluirDeclaracao={setExcluindoDeclaracao}
                  />
                ))}
                {categorias.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted lg:col-span-2">
                    Nenhuma categoria criada ainda.
                  </p>
                )}
              </div>
            </>
          ) : (
            <EmitirCertificado perfil={perfil} user={user} />
          )}
        </div>
      </div>

      <Modal
        open={!!excluindoCategoria}
        onClose={() => setExcluindoCategoria(null)}
        title="Excluir categoria"
      >
        <p className="text-sm text-fatec-ink">
          Excluir a categoria{" "}
          <span className="font-semibold">{excluindoCategoria?.nome}</span>?
          {(excluindoCategoria?.itens.length ?? 0) > 0 && (
            <>
              {" "}
              As {excluindoCategoria?.itens.length} declarações dentro dela
              também serão removidas.
            </>
          )}{" "}
          Essa ação não pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setExcluindoCategoria(null)}
            className="rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarExclusaoCategoria}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </Modal>

      <Modal
        open={!!excluindoDeclaracao}
        onClose={() => setExcluindoDeclaracao(null)}
        title="Excluir declaração"
      >
        <p className="text-sm text-fatec-ink">
          Excluir <span className="font-semibold">{excluindoDeclaracao?.nome}</span>?
          Essa ação não pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setExcluindoDeclaracao(null)}
            className="rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarExclusaoDeclaracao}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </Modal>
    </main>
  );
}
