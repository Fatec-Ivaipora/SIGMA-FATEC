"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Plus, ScrollText, Trash2, Upload } from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  useDeclaracoesAgrupadas,
  criarCategoriaDeclaracao,
  excluirCategoriaDeclaracao,
  criarDeclaracao,
  excluirDeclaracao,
  type CategoriaComDeclaracoes,
  type Declaracao,
} from "@/lib/data/declaracoes";

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
  const { perfil, carregando } = useRequireAuth(["admin"]);
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
        userRoleLabel="Admin"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Declarações
          </h1>
          <p className="text-sm text-fatec-muted">
            Biblioteca de declarações antigas, organizada por categoria (ex.:
            um ano) — aparece como menu na home pública, sem precisar de login.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
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
