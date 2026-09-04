"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LogOut,
  HelpCircle,
  Menu,
  Settings,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ConfiguracoesModal } from "@/components/ConfiguracoesModal";
import { sair } from "@/lib/auth";

const CHAVE_COLAPSADO = "sigma-sidebar-colapsado";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Bolinha de destaque no item (2026-09-04) — ex.: avisa o aluno que tem
  // evento em andamento sem precisar entrar na tela de Eventos.
  indicador?: boolean;
};

export function Sidebar({
  navItems,
  activeHref,
  userName,
  userRoleLabel,
  userInitials,
  showAjuda = false,
}: {
  navItems: NavItem[];
  activeHref: string;
  userName: string;
  userRoleLabel: string;
  userInitials: string;
  /** Preenche o espaço sobrando em menus curtos (aluno/avaliador) com um card de suporte. */
  showAjuda?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [configModalAberto, setConfigModalAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  // Retrátil (2026-08-31) — só afeta a versão fixa de desktop; o menu mobile
  // (drawer por cima da tela) sempre mostra tudo por extenso. Persiste entre
  // páginas/recarregamentos porque cada página monta uma instância nova
  // desse componente — sem isso, colapsar "esqueceria" a cada navegação.
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        setColapsado(localStorage.getItem(CHAVE_COLAPSADO) === "1");
      } catch {
        // localStorage indisponível (modo privado etc.) — mantém expandido.
      }
    });
  }, []);

  function alternarColapso() {
    setColapsado((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_COLAPSADO, novo ? "1" : "0");
      } catch {
        // idem — só não persiste, continua funcionando na sessão.
      }
      return novo;
    });
  }

  async function sairAgora() {
    await sair();
    router.push("/");
  }

  function renderConteudo(mini: boolean) {
    return (
      <>
        <nav className="mt-10 flex flex-col gap-1">
          {navItems.map(({ label, href, icon: Icon, indicador }) => {
            const active = href === activeHref;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setAberto(false)}
                title={mini ? label : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  mini ? "justify-center" : ""
                } ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-fatec-navy-50/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="relative flex-none">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  {indicador && mini && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-fatec-orange-500 ring-2 ring-fatec-navy-900" />
                  )}
                </span>
                {!mini && (
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {label}
                    {indicador && (
                      <span className="h-2 w-2 flex-none rounded-full bg-fatec-orange-500" />
                    )}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              setConfigModalAberto(true);
            }}
            title={mini ? "Configurações" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-fatec-navy-50/70 transition-colors hover:bg-white/5 hover:text-white ${
              mini ? "justify-center" : ""
            }`}
          >
            <Settings className="h-4.5 w-4.5 flex-none" strokeWidth={1.75} />
            {!mini && "Configurações"}
          </button>
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-1 border-t border-white/10 pt-5">
          <div className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${mini ? "flex-col" : ""}`}>
            <span
              title={mini ? userName : undefined}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-orange-500 text-xs font-semibold text-white"
            >
              {userInitials}
            </span>
            {!mini && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {userName}
                </p>
                <p className="truncate text-xs text-fatec-navy-50/60">
                  {userRoleLabel}
                </p>
                {showAjuda && (
                  <div className="relative mt-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setAjudaAberta((v) => !v)}
                      aria-label="Precisa de ajuda?"
                      aria-expanded={ajudaAberta}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-fatec-navy-50/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    {ajudaAberta && (
                      <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-xl border border-white/10 bg-fatec-navy-800 p-4 shadow-lg">
                        <p className="text-sm font-medium text-white">
                          Precisa de ajuda?
                        </p>
                        <p className="mt-1 text-xs text-fatec-navy-50/70">
                          Fale com a organização do evento.
                        </p>
                        <a
                          href="mailto:suporte@fatecivaipora.com.br"
                          className="mt-1 block text-xs font-semibold text-fatec-orange-400 hover:text-fatec-orange-300"
                        >
                          suporte@fatecivaipora.com.br
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={sairAgora}
              aria-label="Sair"
              title={mini ? "Sair" : undefined}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fatec-navy-50/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-none items-center justify-between bg-fatec-navy-900 px-4 py-3 md:hidden">
        <Logo className="h-8 w-auto" />
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAberto(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto bg-fatec-navy-900 px-5 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <Logo className="h-10 w-auto pl-1" />
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            {renderConteudo(false)}
          </aside>
        </div>
      )}

      <aside
        className={`relative hidden flex-none flex-col bg-fatec-navy-900 pt-7 pb-4 transition-[width] duration-150 md:flex ${
          colapsado ? "w-[76px] px-3" : "w-64 px-5"
        }`}
      >
        <div className={`flex items-center ${colapsado ? "justify-center" : "justify-between pl-1"}`}>
          {!colapsado && <Logo className="h-12 w-auto" />}
          <button
            type="button"
            onClick={alternarColapso}
            aria-label={colapsado ? "Expandir menu" : "Retrair menu"}
            title={colapsado ? "Expandir menu" : "Retrair menu"}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 text-fatec-navy-50/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {colapsado ? (
              <ChevronsRight className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
        {renderConteudo(colapsado)}
      </aside>

      <ConfiguracoesModal
        open={configModalAberto}
        onClose={() => setConfigModalAberto(false)}
      />
    </>
  );
}
