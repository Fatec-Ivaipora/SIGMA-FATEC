"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { OrientadorPicker, type OrientadorEscolhido } from "@/components/OrientadorPicker";

export type DadosSubmissaoTCC = {
  titulo: string;
  orientadorUid: string;
  orientadorNome: string;
};

/** Inscrição de TCC (2026-11-16, pedido explícito do usuário) — bem mais
 * enxuta que `SubmeterTrabalhoModal` (MAC): só título + orientador, sem área
 * temática, modalidade, resumo ou coautores. Modal próprio em vez de
 * reaproveitar o de MAC — quase nenhum campo daquele se aplica aqui, e a
 * diferença mais importante é estrutural: orientador vem de
 * `OrientadorPicker` (usuário real, com uid), não texto livre. */
export function SubmeterTCCModal({
  open,
  eventoId,
  eventoNome,
  onClose,
  onSubmit,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  onClose: () => void;
  onSubmit: (dados: DadosSubmissaoTCC) => Promise<string | void> | void;
}) {
  const [titulo, setTitulo] = useState("");
  const [orientador, setOrientador] = useState<OrientadorEscolhido | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = titulo.trim().length > 0 && !!orientador && !enviando;

  async function enviar() {
    if (!podeEnviar || !orientador) return;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await onSubmit({
        titulo: titulo.trim(),
        orientadorUid: orientador.uid,
        orientadorNome: orientador.nome,
      });
      if (resultado) {
        setErro(resultado);
        return;
      }
      setTitulo("");
      setOrientador(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Inscrever TCC — ${eventoNome}`}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Título do TCC</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do Trabalho de Conclusão de Curso"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Orientador(a)</span>
          <OrientadorPicker eventoId={eventoId} value={orientador} onChange={setOrientador} />
        </label>

        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        <div className="flex items-center justify-end gap-3 border-t border-fatec-line pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={!podeEnviar}
            className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {enviando ? "Enviando..." : "Inscrever TCC"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
