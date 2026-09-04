"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { LogoLockup } from "@/components/LogoLockup";
import { DeclaracoesMenu } from "@/components/DeclaracoesMenu";

/** Cabeçalho compartilhado das páginas públicas (2026-09-04 — baseado num
 * print de referência que o usuário mandou: barra escura chapada, itens em
 * texto puro sem fundo arredondado, só um traço colorido embaixo do item em
 * destaque). Evento ganha um traço laranja por baixo quando existe evento
 * marcado como destaque — chama atenção sem virar uma caixa colorida.
 * "Acessar" é um botão azul com texto + seta (não pill, cantos só levemente
 * arredondados).
 *
 * Reaproveitado fora da home (ex.: /editais) — por isso o link de Evento
 * sempre aponta pra "/#evento-destaque" (funciona de qualquer página, não só
 * de dentro da própria home) e "Início" sempre aparece, mesmo página, é o
 * mesmo cabeçalho igual em todo canto (pedido explícito, 2026-09-04). */
export function SiteHeader({ mostrarEvento }: { mostrarEvento: boolean }) {
  const [aberto, setAberto] = useState(false);

  const itemNav = "text-base font-semibold text-white/85 transition-colors hover:text-white md:text-lg";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-fatec-navy-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12 md:py-6">
        <Link href="/" className="flex-none" onClick={() => setAberto(false)}>
          <LogoLockup logoClassName="h-10 w-auto md:h-12" wordmarkClassName="text-xl md:text-2xl" />
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          <Link href="/" className={itemNav}>
            Início
          </Link>
          {mostrarEvento && (
            <Link
              href="/#evento-destaque"
              className={`${itemNav} border-b-2 border-fatec-orange-500 pb-1`}
            >
              Evento
            </Link>
          )}
          <Link href="/editais" className={itemNav}>
            Editais
          </Link>
          <DeclaracoesMenu variant="desktop" />
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-fatec-sky-600 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-fatec-sky-600/85"
          >
            Acessar
            <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 md:hidden"
        >
          {aberto ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
        </button>
      </div>

      {aberto && (
        <div className="border-t border-white/10 bg-fatec-navy-900 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-3 text-base font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              Início
            </Link>
            {mostrarEvento && (
              <Link
                href="/#evento-destaque"
                onClick={() => setAberto(false)}
                className="flex items-center justify-between rounded-lg border-l-4 border-fatec-orange-500 px-3 py-3 text-base font-semibold text-white"
              >
                Evento em destaque
              </Link>
            )}
            <Link
              href="/editais"
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-3 text-base font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              Editais
            </Link>
            <DeclaracoesMenu variant="mobile" onNavegar={() => setAberto(false)} />
            <Link
              href="/login"
              onClick={() => setAberto(false)}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-fatec-sky-600 px-3 py-3 text-base font-semibold text-white"
            >
              Acessar
              <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
