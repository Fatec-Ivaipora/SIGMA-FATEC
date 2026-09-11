"use client";

import { Mic, Pencil, Presentation, User } from "lucide-react";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import type { Trabalho } from "@/lib/data/trabalhos";
import type { Evento } from "@/lib/data/eventos";

const LABEL_MODALIDADE: Record<string, { texto: string; icone: typeof Mic }> = {
  oral: { texto: "Apresentação Oral", icone: Mic },
  roda_conversa: { texto: "Roda de Conversa", icone: Presentation },
};

function formatarData(valor: unknown): string {
  if (!valor || typeof valor !== "object" || !("toDate" in valor)) return "—";
  return (valor as { toDate(): Date }).toDate().toLocaleString("pt-BR");
}

/** Visão geral de um trabalho pra quem administra o evento (2026-09-11) —
 * hoje a tabela de /trabalhos só mostra título + autor principal; clicar no
 * título abre isto, com tudo que falta ali: todos os autores, resumo,
 * orientador. Só leitura — "Editar" (se passado) fecha isto e abre o mesmo
 * wizard de submissão em modo edição (ver trabalhos/page.tsx), reaproveitado
 * porque já sabe lidar com todos os campos. */
export function DetalheTrabalhoModal({
  trabalho,
  evento,
  onClose,
  onEditar,
}: {
  trabalho: Trabalho | null;
  evento: Evento | undefined;
  onClose: () => void;
  // Ausente = sem botão de editar (2026-09-11) — só a coordenação (admin)
  // tem essa opção de exceção, ver o gate em trabalhos/page.tsx.
  onEditar?: () => void;
}) {
  if (!trabalho) return null;

  const modalidade = trabalho.modalidadeApresentacao
    ? LABEL_MODALIDADE[trabalho.modalidadeApresentacao]
    : undefined;
  const IconeModalidade = modalidade?.icone;

  return (
    <Modal open={!!trabalho} onClose={onClose} title="Detalhes do trabalho" size="lg">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold leading-snug text-fatec-navy-900">
            {trabalho.titulo}
          </h2>
          <p className="mt-1 text-sm text-fatec-muted">
            {evento?.nome ?? trabalho.eventoId}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={trabalho.status} />
          <span className="inline-flex items-center rounded-full bg-fatec-navy-50 px-2.5 py-1 text-xs font-medium text-fatec-navy-900">
            {trabalho.areaTematica}
          </span>
          {modalidade && IconeModalidade && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fatec-navy-50 px-2.5 py-1 text-xs font-medium text-fatec-navy-900">
              <IconeModalidade className="h-3.5 w-3.5" strokeWidth={1.75} />
              {modalidade.texto}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Autores</span>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm text-fatec-ink">
                <User className="h-3.5 w-3.5 flex-none text-fatec-muted" strokeWidth={1.75} />
                {trabalho.alunoNome}
                <span className="text-xs text-fatec-muted">(autor principal)</span>
              </span>
              {(trabalho.participantesNomes ?? []).map((nome) => (
                <span key={nome} className="flex items-center gap-1.5 text-sm text-fatec-ink">
                  <User className="h-3.5 w-3.5 flex-none text-fatec-muted" strokeWidth={1.75} />
                  {nome}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Orientador</span>
            <p className="text-sm text-fatec-ink">{trabalho.nomeOrientador || "—"}</p>
          </div>

          {trabalho.avaliadorNome && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">Avaliador</span>
              <p className="text-sm text-fatec-ink">
                {trabalho.avaliadorNome}
                {typeof trabalho.notaAvaliador === "number" && (
                  <span className="text-fatec-muted"> · nota {trabalho.notaAvaliador}/25</span>
                )}
              </p>
            </div>
          )}

          {trabalho.moderadorNome && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">Moderador</span>
              <p className="text-sm text-fatec-ink">
                {trabalho.moderadorNome}
                {typeof trabalho.notaModerador === "number" && (
                  <span className="text-fatec-muted"> · nota {trabalho.notaModerador}/25</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Resumo</span>
          <p className="whitespace-pre-wrap rounded-xl bg-fatec-navy-50 px-4 py-3 text-sm leading-relaxed text-fatec-ink">
            {trabalho.resumo?.trim() || "Sem resumo cadastrado."}
          </p>
        </div>

        {trabalho.comentarioRevisao && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Último pedido de ajuste do avaliador
            </span>
            <p className="rounded-xl bg-fatec-orange-50 px-4 py-3 text-sm text-fatec-ink">
              {trabalho.comentarioRevisao}
            </p>
          </div>
        )}

        <p className="text-xs text-fatec-muted">
          Atualizado em {formatarData(trabalho.atualizadoEm)}
        </p>

        <div className="flex items-center justify-between border-t border-fatec-line pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Fechar
          </button>
          {onEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="flex items-center gap-2 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Editar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
