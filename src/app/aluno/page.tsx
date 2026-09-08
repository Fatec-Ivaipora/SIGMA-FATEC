"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  FileStack,
  UserPlus,
  Check,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { InscricaoEventoModal } from "@/components/InscricaoEventoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, eventosParaAluno } from "@/lib/data/eventos";
import { useTrabalhos, responderConvite } from "@/lib/data/trabalhos";
import { useMinhasInscricoes } from "@/lib/data/inscricoes";
import { notificarConviteColega, notificarStatusTrabalho } from "@/lib/notificarEmail";

export default function AlunoPainelPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { eventos: todosEventos } = useEventosPublicos();
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { inscricoes: minhasInscricoes } = useMinhasInscricoes(user?.uid);
  const [modalEventoId, setModalEventoId] = useState<string | null>(null);
  const [inscricaoEventoId, setInscricaoEventoId] = useState<string | null>(null);

  const eventos = useMemo(
    () => eventosParaAluno(todosEventos, perfil?.vinculoFatec),
    [todosEventos, perfil],
  );

  // Indicador do menu "Eventos" (2026-09-04) — só acende se tem algum evento
  // em que o aluno ainda NÃO se inscreveu (nenhuma inscricaoEvento). Assim
  // que ele se inscreve, o indicador some pra esse evento — pedido explícito.
  const temEventoPendente = useMemo(
    () => eventos.some((e) => !minhasInscricoes.has(e.id)),
    [eventos, minhasInscricoes],
  );

  // Eventos inscritos (2026-09-04): antes o painel só mostrava o banner de
  // UM evento em destaque, sem dar pra acompanhar o andamento sem entrar em
  // Eventos. "Inscrito" aqui é qualquer evento com trabalho meu (dono ou
  // colega) OU com inscricaoEvento minha (mesmo só "interesse") — a mesma
  // união usada em outros lugares do app (ex.: lançamento pro Edubox).
  const eventosInscritos = useMemo(() => {
    const idsRelacionados = new Set<string>();
    trabalhos.forEach((t) => idsRelacionados.add(t.eventoId));
    minhasInscricoes.forEach((_insc, eventoId) => idsRelacionados.add(eventoId));
    return eventos
      .filter((e) => idsRelacionados.has(e.id))
      .map((evento) => ({
        evento,
        trabalho: trabalhos.find((t) => t.eventoId === evento.id) ?? null,
        inscricao: minhasInscricoes.get(evento.id) ?? null,
      }));
  }, [eventos, trabalhos, minhasInscricoes]);

  const trabalhosRecentes = useMemo(() => [...trabalhos].slice(0, 5), [trabalhos]);

  const convitesPendentes = useMemo(
    () => trabalhos.filter((t) => user && t.convitesPendentes?.includes(user.uid)),
    [trabalhos, user],
  );

  function responder(trabalho: (typeof trabalhos)[number], aceitar: boolean) {
    if (!user) return;
    responderConvite(trabalho, user.uid, aceitar);
  }

  // Enviar trabalho direto da tela inicial (2026-09-04) — antes o botão só
  // linkava pra /aluno/eventos; o pedido foi poder fazer tudo sem sair
  // daqui. Mesma lógica de src/app/aluno/eventos/page.tsx.
  async function enviarTrabalho(dados: DadosSubmissao) {
    if (!modalEventoId || !user || !perfil) return;
    const ref = await addDoc(collection(db, "trabalhos"), {
      ...dados,
      eventoId: modalEventoId,
      alunoUid: user.uid,
      alunoNome: perfil.nome,
      status: "submissao",
      convitesPendentes: dados.participantesUids,
      atualizadoEm: serverTimestamp(),
    });
    notificarStatusTrabalho(user, ref.id, "submetido");
    dados.participantesUids.forEach((colegaUid) => notificarConviteColega(user, ref.id, colegaUid));
    setModalEventoId(null);
  }

  const eventoModal = eventos.find((e) => e.id === modalEventoId);
  const eventoInscricao = eventos.find((e) => e.id === inscricaoEventoId);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente)}
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
            Acompanhe seus eventos inscritos e o andamento dos seus trabalhos.
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
                        {t.alunoNome} te adicionou como autor em{" "}
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

          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-fatec-navy-900">
              Eventos inscritos
            </h2>

            {eventosInscritos.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                Você ainda não está inscrito em nenhum evento.{" "}
                <Link
                  href="/aluno/eventos"
                  className="font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
                >
                  Veja os eventos abertos
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {eventosInscritos.map(({ evento, trabalho, inscricao }) => {
                  const temTaxa = !!evento.valorInscricao;
                  const pago = inscricao?.status === "pago";
                  return (
                    <div
                      key={evento.id}
                      className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-fatec-navy-900">{evento.nome}</p>
                        <p className="mt-0.5 text-sm text-fatec-muted">
                          {trabalho ? trabalho.titulo : "Nenhum trabalho enviado ainda"}
                        </p>
                      </div>
                      <div className="flex flex-none flex-wrap items-center gap-2">
                        {trabalho && (
                          <Link href="/aluno/trabalhos" className="transition-opacity hover:opacity-80">
                            <StatusBadge status={trabalho.status} />
                          </Link>
                        )}
                        {temTaxa &&
                          (pago ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                              Pago
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInscricaoEventoId(evento.id)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                              Pagamento pendente
                            </button>
                          ))}
                        {!trabalho && (
                          <button
                            type="button"
                            onClick={() => setModalEventoId(evento.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                          >
                            Enviar trabalho
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {eventoModal && (
        <SubmeterTrabalhoModal
          open={!!eventoModal}
          eventoId={eventoModal.id}
          temTaxa={!!eventoModal.valorInscricao}
          eventoNome={eventoModal.nome}
          areasDisponiveis={eventoModal.areasTematicas ?? []}
          areasComplexas={eventoModal.areasTematicasComplexas ?? []}
          meuUid={user?.uid}
          onClose={() => setModalEventoId(null)}
          onSubmit={enviarTrabalho}
        />
      )}

      {eventoInscricao && (
        <InscricaoEventoModal
          open={!!eventoInscricao}
          eventoId={eventoInscricao.id}
          eventoNome={eventoInscricao.nome}
          valor={eventoInscricao.valorInscricao ?? 0}
          temCpf={!!perfil.cpf}
          user={user}
          onClose={() => setInscricaoEventoId(null)}
        />
      )}
    </main>
  );
}
