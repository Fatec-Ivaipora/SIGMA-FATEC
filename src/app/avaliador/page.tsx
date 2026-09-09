"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  FileClock,
  BadgeCheck,
  ArrowRight,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useAtividades } from "@/lib/data/atividades";
import type { TipoAtividade } from "@/lib/atividadesAdmin";

const TODOS_MEUS_EVENTOS = "Todos os meus eventos";

// Só "atribuicao" acontece pro avaliador/moderador por enquanto — os
// outros tipos (submetido, revisao etc.) são do feed do aluno; um fallback
// genérico cobre qualquer tipo futuro sem quebrar a tela.
const ATIVIDADE_META: Partial<Record<TipoAtividade, { icone: LucideIcon; cor: string; fundo: string }>> = {
  atribuicao: { icone: Send, cor: "bg-fatec-sky-100 text-fatec-sky-600", fundo: "bg-fatec-sky-50" },
};

function formatarQuando(criadoEm: { toDate: () => Date } | undefined): string {
  if (!criadoEm) return "agora";
  const data = criadoEm.toDate();
  const dataFmt = data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const horaFmt = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataFmt}, ${horaFmt}`;
}

/** Mesma função de src/app/aluno/page.tsx — nunca HTML, só quebra a string
 * em pedaços de texto puro e envolve os trechos batidos num <strong>. */
function renderTextoComNegrito(texto: string, negritos: string[] | undefined): ReactNode {
  if (!negritos || negritos.length === 0) return texto;
  const partes: ReactNode[] = [];
  let cursor = 0;
  negritos.forEach((termo, i) => {
    if (!termo) return;
    const indice = texto.indexOf(termo, cursor);
    if (indice === -1) return;
    if (indice > cursor) partes.push(texto.slice(cursor, indice));
    partes.push(<strong key={i}>{termo}</strong>);
    cursor = indice + termo.length;
  });
  if (cursor < texto.length) partes.push(texto.slice(cursor));
  return partes;
}

export default function AvaliadorPainelPage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { atividades } = useAtividades(user?.uid);
  const [eventoId, setEventoId] = useState(TODOS_MEUS_EVENTOS);

  const resumo = useMemo(() => {
    const escopo =
      eventoId === TODOS_MEUS_EVENTOS
        ? trabalhos
        : trabalhos.filter((t) => t.eventoId === eventoId);

    return escopo.reduce(
      (acc, t) => {
        if (t.status === "aguardando_avaliacao") acc.aguardando += 1;
        if (t.status === "avaliado" || t.status === "aceito" || t.status === "nao_aceito") {
          acc.avaliados += 1;
        }
        return acc;
      },
      { aguardando: 0, avaliados: 0 },
    );
  }, [trabalhos, eventoId]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Bem-vindo(a), {perfil.nome}
            </h1>
            <p className="text-sm text-fatec-muted">
              Trabalhos que a organização enviou para você avaliar.
            </p>
          </div>

          <div className="relative">
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
            >
              <option value={TODOS_MEUS_EVENTOS}>{TODOS_MEUS_EVENTOS}</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {/* full-width (2026-09-09, mesmo padrão da tela do aluno) — antes
              tinha sm:max-w-xl sobrando espaço em branco na direita. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-100 text-fatec-navy-800">
                <FileClock className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {resumo.aguardando}
              </p>
              <p className="text-sm text-fatec-muted">Aguardando sua nota</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {resumo.avaliados}
              </p>
              <p className="text-sm text-fatec-muted">Avaliados por você</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/avaliador/trabalhos"
              className="inline-flex items-center gap-2 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              Ver trabalhos para avaliar
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/avaliador/eventos"
              className="text-sm font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
            >
              Ver meus eventos e área temática
            </Link>
          </div>

          {/* Atividade recente (2026-09-09, mesmo padrão da tela do aluno) —
              por enquanto só "atribuicao" acontece pro avaliador/moderador
              (quando a organização manda trabalhos novos). */}
          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-fatec-navy-900">
              Atividade recente
            </h2>
            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-fatec-line bg-white p-5">
              <div className="flex flex-col gap-2">
                {atividades.map((a) => {
                  const meta = ATIVIDADE_META[a.tipo];
                  const Icone = meta?.icone ?? FileClock;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 rounded-xl p-2.5 ${meta?.fundo ?? "bg-fatec-navy-50"}`}
                    >
                      <span
                        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${meta?.cor ?? "bg-fatec-navy-100 text-fatec-navy-800"}`}
                      >
                        <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-fatec-ink">
                          {renderTextoComNegrito(a.texto, a.negritos)}
                        </p>
                        <p className="text-xs text-fatec-muted">{formatarQuando(a.criadoEm)}</p>
                      </div>
                    </div>
                  );
                })}
                {atividades.length === 0 && (
                  <p className="text-sm text-fatec-muted">
                    Nada por aqui ainda — assim que a organização te enviar
                    trabalhos novos, aparece nesta lista.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
