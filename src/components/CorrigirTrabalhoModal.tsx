"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import type { Trabalho } from "@/lib/data/trabalhos";

const RESUMO_MAX = 2000;

export type DadosCorrecao = {
  titulo: string;
  resumo: string;
};

function CorrigirTrabalhoForm({
  trabalho,
  onSubmit,
}: {
  trabalho: Trabalho;
  onSubmit: (dados: DadosCorrecao) => void;
}) {
  const [titulo, setTitulo] = useState(trabalho.titulo);
  const [resumo, setResumo] = useState(trabalho.resumo ?? "");

  const valido = titulo.trim().length > 0;

  function enviar() {
    if (!valido) return;
    onSubmit({ titulo: titulo.trim(), resumo: resumo.trim() });
  }

  return (
    <div className="flex flex-col gap-5">
      {trabalho.comentarioRevisao && (
        <div className="rounded-xl bg-fatec-orange-50 px-4 py-3">
          <p className="text-sm font-medium text-fatec-orange-700">
            O que o avaliador pediu pra ajustar
          </p>
          <p className="mt-1 text-sm text-fatec-ink">
            {trabalho.comentarioRevisao}
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fatec-navy-900">
          Título do trabalho <span className="text-fatec-orange-600">*</span>
        </span>
        <input
          type="text"
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-fatec-navy-900">
            Resumo
          </span>
          <span
            className={`text-xs ${
              resumo.length >= RESUMO_MAX
                ? "font-medium text-fatec-orange-600"
                : "text-fatec-muted"
            }`}
          >
            {resumo.length}/{RESUMO_MAX}
          </span>
        </div>
        <textarea
          rows={6}
          maxLength={RESUMO_MAX}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          placeholder="Descreva brevemente o trabalho (até 2000 caracteres)"
          className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
        />
      </label>

      <p className="text-xs text-fatec-muted">
        Área temática, orientador e colegas continuam os mesmos da submissão
        original — só título e resumo podem ser corrigidos aqui.
      </p>

      <button
        type="button"
        onClick={enviar}
        disabled={!valido}
        className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
      >
        Reenviar para avaliação
      </button>
    </div>
  );
}

export function CorrigirTrabalhoModal({
  open,
  trabalho,
  onClose,
  onSubmit,
}: {
  open: boolean;
  trabalho: Trabalho | null;
  onClose: () => void;
  onSubmit: (dados: DadosCorrecao) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Corrigir trabalho">
      {trabalho && (
        <CorrigirTrabalhoForm
          key={trabalho.id}
          trabalho={trabalho}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}
