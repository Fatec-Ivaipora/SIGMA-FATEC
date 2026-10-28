"use client";

import { AlertTriangle } from "lucide-react";
import type { Conflito } from "@/lib/conflitoInteresse";
import { tituloExibicao } from "@/lib/tituloTrabalho";

/** Aviso de conflito de interesse na modal "Enviar para avaliação/desempate"
 * (2026-10-27, pedido explícito do usuário) — lista os trabalhos em que quem
 * vai receber é autor(a), orientador(a) ou coorientador(a). Não bloqueia o
 * envio: quem dispara decide (pode não haver outro avaliador na área). Na
 * divisão automática só aparece o que não deu pra desviar. */
export function AvisoConflitos({
  conflitos,
  automatico,
}: {
  conflitos: { trabalho: { id: string; titulo: string }; pessoa: { nome: string }; conflito: Conflito }[];
  automatico: boolean;
}) {
  if (conflitos.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
        Atenção: possível conflito de interesse
      </p>
      <ul className="flex flex-col gap-1 text-sm text-amber-900">
        {conflitos.map(({ trabalho, pessoa, conflito }) => (
          <li key={`${trabalho.id}-${pessoa.nome}`}>
            <strong>{pessoa.nome}</strong> {conflito.nivel === "possivel" ? "pode ser" : "é"}{" "}
            {conflito.papel} de “{tituloExibicao(trabalho.titulo)}”
            {conflito.nivel === "possivel" && " (o nome no trabalho está incompleto)"}.
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-800">
        {automatico
          ? "A divisão já desviou os outros trabalhos; esses não tinham outra pessoa disponível. Ajuste os números ou escolha manualmente para enviar a outra pessoa."
          : "Escolha outra pessoa para esses trabalhos, ou envie mesmo assim se for o caso."}
      </p>
    </div>
  );
}
