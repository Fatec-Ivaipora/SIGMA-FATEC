"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Evento } from "@/lib/data/eventos";

/** Seletor de evento com busca (2026-10-16, pedido explícito do usuário) —
 * substitui o `<select>` plano nos lugares onde a lista de eventos cresce
 * demais pra um dropdown nativo (ex.: Declarações, que precisa listar
 * ativos E encerrados juntos — daqui um ano isso pode passar de 20-30
 * eventos). Clica, abre com TODOS os eventos já visíveis (não precisa
 * digitar pra ver algo, diferente de um campo de busca comum); digita e
 * filtra por nome na hora. Mesmo padrão visual de clique-fora de
 * DeclaracoesMenu + resultado em lista de InscricaoManualModal. */
export function SeletorEventoBusca({
  eventos,
  value,
  onChange,
  placeholder = "Selecione o evento",
  renderBadge,
  className = "",
}: {
  eventos: Evento[];
  value: string;
  onChange: (eventoId: string) => void;
  placeholder?: string;
  // Selo opcional ao lado do nome de cada opção (ex.: "Encerrado") — usado
  // quando a lista mistura ativos e encerrados, pra não precisar abrir o
  // evento pra descobrir.
  renderBadge?: (evento: Evento) => React.ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selecionado = eventos.find((e) => e.id === value);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return eventos;
    return eventos.filter((e) => e.nome.toLowerCase().includes(termo));
  }, [eventos, busca]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  useEffect(() => {
    if (aberto) {
      setBusca("");
      setIndiceAtivo(0);
      // Foca só depois de montar o input (abrir já trocou o DOM nesse
      // mesmo render) — sem isso o foco "perde a mão" se o usuário clicou
      // o botão rápido demais.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [aberto]);

  function escolher(eventoId: string) {
    onChange(eventoId);
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAberto(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = filtrados[indiceAtivo];
      if (alvo) escolher(alvo.id);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-3 text-left text-sm font-medium text-fatec-navy-900 outline-none transition-colors focus:border-fatec-sky-600"
      >
        <span className={selecionado ? "" : "text-fatec-muted"}>
          {selecionado?.nome ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-fatec-muted transition-transform ${aberto ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-full min-w-[280px] overflow-hidden rounded-xl border border-fatec-line bg-white shadow-2xl ring-1 ring-black/5">
          <div className="relative border-b border-fatec-line p-2">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setIndiceAtivo(0);
              }}
              onKeyDown={aoTeclar}
              placeholder="Buscar evento por nome"
              className="w-full rounded-lg border border-transparent bg-fatec-navy-50 py-2 pl-8 pr-3 text-sm text-fatec-ink outline-none placeholder:text-fatec-muted/70 focus:border-fatec-sky-600"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtrados.length === 0 && (
              <p className="px-4 py-3 text-sm text-fatec-muted">Nenhum evento encontrado.</p>
            )}
            {filtrados.map((ev, i) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => escolher(ev.id)}
                onMouseEnter={() => setIndiceAtivo(i)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === indiceAtivo ? "bg-fatec-navy-50" : ""
                } ${ev.id === value ? "font-semibold text-fatec-navy-900" : "text-fatec-ink"}`}
              >
                <span className="truncate">{ev.nome}</span>
                {renderBadge?.(ev)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
