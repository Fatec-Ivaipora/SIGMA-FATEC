"use client";

import { useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEditais, criarEdital, excluirEdital, type Edital } from "@/lib/data/editais";

export default function EditaisAdminPage() {
  const { perfil, carregando } = useRequireAuth(["admin"]);
  const { editais } = useEditais();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Edital | null>(null);

  async function enviar() {
    if (!titulo.trim() || !arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const caminho = `editais/${Date.now()}_${arquivo.name}`;
      const ref = storageRef(storage, caminho);
      await uploadBytes(ref, arquivo);
      const arquivoUrl = await getDownloadURL(ref);
      await criarEdital({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        arquivoUrl,
        arquivoNome: arquivo.name,
      });
      setTitulo("");
      setDescricao("");
      setArquivo(null);
    } catch {
      setErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    await excluirEdital(excluindo.id);
    setExcluindo(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/editais/gerenciar"
        userName={perfil.nome}
        userRoleLabel="Admin"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Editais
          </h1>
          <p className="text-sm text-fatec-muted">
            Cards de edital exibidos em /editais, na home pública, sem
            precisar de login.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="mb-6 flex max-w-xl flex-col gap-2 rounded-2xl border border-dashed border-fatec-line bg-fatec-navy-50/50 p-4">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do edital"
              className="rounded-lg border border-fatec-line bg-white px-3 py-2 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none focus:border-fatec-sky-600"
            />
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição curta (opcional)"
              className="rounded-lg border border-fatec-line bg-white px-3 py-2 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none focus:border-fatec-sky-600"
            />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="text-xs text-fatec-muted file:mr-2 file:rounded-lg file:border-0 file:bg-fatec-navy-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fatec-navy-900"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!titulo.trim() || !arquivo || enviando}
              className="flex w-fit items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Upload className="h-4 w-4" strokeWidth={2} />
              )}
              Adicionar edital
            </button>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editais.map((edital) => (
              <div
                key={edital.id}
                className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fatec-navy-50 text-fatec-navy-800">
                      <FileText className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fatec-navy-900">{edital.titulo}</p>
                      {edital.descricao && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-fatec-muted">{edital.descricao}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExcluindo(edital)}
                    aria-label={`Excluir ${edital.titulo}`}
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
                <a
                  href={edital.arquivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-1.5 text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  Abrir PDF
                </a>
              </div>
            ))}
            {editais.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted sm:col-span-2 lg:col-span-3">
                Nenhum edital cadastrado ainda.
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!excluindo} onClose={() => setExcluindo(null)} title="Excluir edital">
        <p className="text-sm text-fatec-ink">
          Excluir <span className="font-semibold">{excluindo?.titulo}</span>?
          Essa ação não pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setExcluindo(null)}
            className="rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarExclusao}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </Modal>
    </main>
  );
}
