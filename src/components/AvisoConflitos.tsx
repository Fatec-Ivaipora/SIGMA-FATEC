"use client";

import { AlertTriangle, Ban } from "lucide-react";
import type { Conflito } from "@/lib/conflitoInteresse";
import { tituloExibicao } from "@/lib/tituloTrabalho";

/** Aviso de conflito de interesse na modal "Enviar para avaliação/desempate"
 * (2026-10-27, pedido explícito do usuário). Dois blocos:
 * - `conflitos` ("possivel", nome incompleto no trabalho) — não bloqueia,
 *   só avisa; quem dispara decide.
 * - `naoAtribuidos` (2026-10-28, pedido explícito do usuário — "trava de
 *   verdade") — conflito "certo" (autor, ou nome completo batendo com
 *   orientador/coorientador) nunca é atribuído a essa pessoa; se não
 *   sobrava outra opção na seleção, o trabalho simplesmente não é enviado
 *   pra ninguém, listado aqui pra resolver manualmente depois. */
export function AvisoConflitos({
  conflitos,
  naoAtribuidos = [],
  automatico,
}: {
  conflitos: { trabalho: { id: string; titulo: string }; pessoa: { nome: string }; conflito: Conflito }[];
  naoAtribuidos?: { trabalho: { id: string; titulo: string }; conflito: Conflito }[];
  automatico: boolean;
}) {
  if (conflitos.length === 0 && naoAtribuidos.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {naoAtribuidos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
            <Ban className="h-4 w-4 flex-none" strokeWidth={2} />
            Não serão enviados — só sobrava o(a) próprio(a) orientador(a)
          </p>
          <ul className="flex flex-col gap-1 text-sm text-rose-900">
            {naoAtribuidos.map(({ trabalho, conflito }) => (
              <li key={trabalho.id}>
                “{tituloExibicao(trabalho.titulo)}” — ninguém disponível na seleção além do(a)
                próprio(a) {conflito.papel}.
              </li>
            ))}
          </ul>
          <p className="text-xs text-rose-800">
            Marque mais gente nessa seleção, ou envie esses trabalhos depois, manualmente, pra
            outra pessoa.
          </p>
        </div>
      )}
      {conflitos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
            Atenção: possível conflito de interesse
          </p>
          <ul className="flex flex-col gap-1 text-sm text-amber-900">
            {conflitos.map(({ trabalho, pessoa, conflito }) => (
              <li key={`${trabalho.id}-${pessoa.nome}`}>
                <strong>{pessoa.nome}</strong> pode ser {conflito.papel} de “
                {tituloExibicao(trabalho.titulo)}” (o nome no trabalho está incompleto).
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800">
            {automatico
              ? "A divisão já evitou isso onde deu; aqui o nome só bateu parcialmente, então não travamos — confira se é a mesma pessoa."
              : "Confira se é a mesma pessoa antes de enviar."}
          </p>
        </div>
      )}
    </div>
  );
}
