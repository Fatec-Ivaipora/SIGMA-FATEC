"use client";

import { Plus } from "lucide-react";

/** "Submeter outro trabalho" (2026-10-26, pedido explícito do usuário — o
 * aluno pode enviar mais de um trabalho no mesmo evento, mas as telas
 * trocavam o botão de envio por "Trabalho enviado" assim que existia o
 * primeiro). Secundário de propósito (contorno, não laranja cheio): o
 * principal já foi feito, esse é o "mais um". Quem decide se aparece é o
 * pai (dentro do prazo de envio, evento com trabalho) — o servidor ainda
 * barra o envio repetido do mesmo trabalho (/api/trabalhos/checar-duplicado). */
export function BotaoOutroTrabalho({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-fatec-orange-600 transition-colors hover:bg-fatec-orange-50 ${className}`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      Submeter outro trabalho
    </button>
  );
}
