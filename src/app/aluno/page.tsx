"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  FileStack,
  UserPlus,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos } from "@/lib/data/eventos";
import { useTrabalhos, responderConvite } from "@/lib/data/trabalhos";
import { useMinhaInscricao } from "@/lib/data/inscricoes";

export default function AlunoPainelPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { eventos: todosEventos } = useEventosPublicos();
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  // Participante externo (sem vínculo com a Fatec) só pode ver/inscrever nos
  // eventos marcados como aceitaExternos; aluno da Fatec vê todos.
  const eventos = useMemo(
    () =>
      perfil?.vinculoFatec === false
        ? todosEventos.filter((e) => e.aceitaExternos)
        : todosEventos,
    [todosEventos, perfil],
  );

  // Ainda não há um campo de status (aberto/encerrado) no schema de eventos —
  // por ora todo evento cadastrado é tratado como aberto para inscrição.
  const destaque = useMemo(
    () => eventos.find((e) => e.destaque) ?? eventos[0],
    [eventos],
  );

  const jaInscrito = !!(destaque && trabalhos.some((t) => t.eventoId === destaque.id));
  const temTaxaDestaque = !!destaque?.valorInscricao;
  const { inscricao: inscricaoDestaque } = useMinhaInscricao(
    temTaxaDestaque ? destaque?.id : undefined,
    user?.uid,
  );
  const pagamentoPendente = temTaxaDestaque && inscricaoDestaque?.status !== "pago";

  const trabalhosRecentes = useMemo(() => [...trabalhos].slice(0, 5), [trabalhos]);

  const convitesPendentes = useMemo(
    () => trabalhos.filter((t) => user && t.convitesPendentes?.includes(user.uid)),
    [trabalhos, user],
  );

  function responder(trabalho: (typeof trabalhos)[number], aceitar: boolean) {
    if (!user) return;
    responderConvite(trabalho, user.uid, aceitar);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec)}
        activeHref="/aluno"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Bem-vindo(a), {perfil.nome}
          </h1>
          <p className="text-sm text-fatec-muted">
            Acompanhe o evento aberto e o andamento dos seus trabalhos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {convitesPendentes.length > 0 && (
            <section className="mb-8 flex flex-col gap-3">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Convites pendentes
              </h2>
              {convitesPendentes.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl border border-fatec-orange-200 bg-fatec-orange-50 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-fatec-orange-600">
                      <UserPlus className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-fatec-navy-900">
                        {t.alunoNome} te adicionou como colega em{" "}
                        <span className="font-semibold">{t.titulo}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-fatec-muted">
                        {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                        {t.nomeOrientador && ` · Orientador: ${t.nomeOrientador}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      onClick={() => responder(t, false)}
                      className="flex items-center gap-1.5 rounded-lg border border-fatec-line bg-white px-3.5 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => responder(t, true)}
                      className="flex items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <FileStack className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {trabalhos.length}
              </p>
              <p className="text-sm text-fatec-muted">Trabalhos inscritos</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5 sm:col-span-2">
              <p className="text-sm font-semibold text-fatec-navy-900">
                Trabalhos recentes
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {trabalhosRecentes.map((t) => (
                  <p key={t.id} className="truncate text-sm text-fatec-ink">
                    {t.titulo}{" "}
                    <span className="text-fatec-muted">
                      · {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                    </span>
                  </p>
                ))}
                {trabalhosRecentes.length === 0 && (
                  <p className="text-sm text-fatec-muted">
                    Nenhum trabalho inscrito ainda.
                  </p>
                )}
              </div>
            </div>
          </div>

          {destaque && (
            <section className="mt-8">
              <h2 className="mb-4 text-base font-semibold text-fatec-navy-900">
                Evento aberto para inscrição
              </h2>

              <div className="group relative mx-auto max-w-2xl overflow-hidden rounded-3xl shadow-[0_20px_45px_-25px_rgba(14,58,94,0.45)] transition-transform duration-200 hover:-translate-y-1">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-br from-fatec-navy-700 via-fatec-navy-900 to-fatec-sky-600"
                >
                  <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
                  <div className="absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-fatec-orange-500/20 blur-3xl" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                <div className="relative flex min-h-[220px] flex-col items-start justify-end gap-3 p-6 md:min-h-[260px] md:p-8">
                  {destaque.periodoSubmissao && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                      Inscrições: {destaque.periodoSubmissao}
                    </span>
                  )}
                  <h3 className="text-2xl font-bold leading-tight text-white">
                    {destaque.nome}
                  </h3>

                  {pagamentoPendente ? (
                    // Pagamento pendente vira o CTA principal (2026-08-31) —
                    // mais urgente que "inscrição feita". Clicar sempre leva
                    // pra Eventos, que é onde a inscrição/pagamento de
                    // verdade acontece — esse banner é só uma vitrine.
                    <Link
                      href="/aluno/eventos"
                      className="group/btn mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-6 py-3 text-sm font-semibold text-amber-800 transition-transform hover:-translate-y-0.5"
                    >
                      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                      Pagamento pendente — pagar agora
                    </Link>
                  ) : jaInscrito ? (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      Inscrição feita
                    </span>
                  ) : (
                    <Link
                      href="/aluno/eventos"
                      className="group/btn mt-2 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-fatec-navy-900 transition-transform hover:-translate-y-0.5"
                    >
                      Inscrever trabalho
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5"
                        strokeWidth={2}
                      />
                    </Link>
                  )}
                </div>
              </div>

              {eventos.length > 1 && (
                <p className="mt-4 text-center text-sm text-fatec-muted">
                  Há outros eventos abertos —{" "}
                  <a
                    href="/aluno/eventos"
                    className="font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
                  >
                    veja todos em Eventos
                  </a>
                  .
                </p>
              )}
            </section>
          )}

          {!destaque && (
            <p className="mt-8 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Nenhum evento aberto para inscrição no momento.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
