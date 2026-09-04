"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useDeclaracoesAgrupadas } from "@/lib/data/declaracoes";

/** Dropdown "Declarações" da home pública (2026-09-04) — categoria (ex.: um
 * ano) expande em acordeão mostrando as declarações dentro, cada uma abre o
 * PDF numa aba nova.
 *
 * `variant="desktop"` (padrão) é um link com flyout que fecha ao clicar
 * fora — usado dentro do <nav> normal do cabeçalho. `variant="mobile"` é a
 * mesma árvore de categorias/itens, só que sem posicionamento absoluto —
 * feita pra ficar embutida direto no painel mobile empilhado do
 * SiteHeader, que já cuida do próprio scroll/fechamento. */
export function DeclaracoesMenu({
  variant = "desktop",
  onNavegar,
}: {
  variant?: "desktop" | "mobile";
  onNavegar?: () => void;
}) {
  const categorias = useDeclaracoesAgrupadas();
  const [aberto, setAberto] = useState(false);
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "desktop" || !aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [variant, aberto]);

  function listaCategorias(comFundo: boolean) {
    return (
      <>
        {categorias.length === 0 && (
          <p className="px-4 py-3 text-sm text-fatec-muted">
            Nenhuma declaração publicada ainda.
          </p>
        )}
        {categorias.map((categoria) => (
          <div key={categoria.id}>
            <button
              type="button"
              onClick={() =>
                setCategoriaAberta((atual) => (atual === categoria.id ? null : categoria.id))
              }
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors ${
                comFundo
                  ? "text-fatec-navy-900 hover:bg-fatec-navy-50"
                  : "rounded-lg text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              {categoria.nome}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${comFundo ? "text-fatec-muted" : "text-white/60"} ${
                  categoriaAberta === categoria.id ? "rotate-180" : ""
                }`}
                strokeWidth={2}
              />
            </button>
            {categoriaAberta === categoria.id && (
              <div className={`flex flex-col pb-1 ${comFundo ? "bg-fatec-navy-50/50" : ""}`}>
                {categoria.itens.map((item) => (
                  <a
                    key={item.id}
                    href={item.arquivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onNavegar}
                    className={`flex items-center gap-1.5 px-6 py-2 text-sm transition-colors ${
                      comFundo
                        ? "text-fatec-ink hover:text-fatec-sky-600"
                        : "text-white/75 hover:text-white"
                    }`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-none" strokeWidth={2} />
                    {item.nome}
                  </a>
                ))}
                {categoria.itens.length === 0 && (
                  <p className={`px-6 py-2 text-xs ${comFundo ? "text-fatec-muted" : "text-white/50"}`}>
                    Nada aqui ainda.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  if (variant === "mobile") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
        >
          Declarações
          <ChevronDown
            className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>
        {aberto && <div className="pl-2">{listaCategorias(false)}</div>}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex items-center gap-1 text-base font-semibold text-white/85 transition-colors hover:text-white md:text-lg"
      >
        Declarações
        <ChevronDown
          className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-20 mt-3 w-72 overflow-hidden rounded-2xl border border-fatec-line bg-white py-2 shadow-2xl ring-1 ring-black/5">
          {listaCategorias(true)}
        </div>
      )}
    </div>
  );
}
