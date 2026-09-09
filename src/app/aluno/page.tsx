"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  FileStack,
  UserPlus,
  Check,
  X,
  Send,
  Pencil,
  XCircle,
  Wallet,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import type { TipoAtividade } from "@/lib/atividadesAdmin";
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
import { useAtividades } from "@/lib/data/atividades";
import {
  notificarConviteAceito,
  notificarConviteColega,
  notificarStatusTrabalho,
} from "@/lib/notificarEmail";

// Ícone/cor/fundo por tipo de atividade do feed (2026-09-09) — mesma
// paleta de cores já usada no StatusBadge (laranja=revisão, verde=avaliado/
// aceito/pago, vermelho=recusado), pra não inventar uma linguagem visual
// nova. `fundo` é bem sutil de propósito (pedido do usuário: "nada muito
// chamativo, mas que dê pra diferenciar no olho").
const ATIVIDADE_META: Partial<Record<TipoAtividade, { icone: LucideIcon; cor: string; fundo: string }>> = {
  submetido: { icone: Send, cor: "bg-fatec-sky-100 text-fatec-sky-600", fundo: "bg-fatec-sky-50" },
  revisao: {
    icone: Pencil,
    cor: "bg-fatec-orange-100 text-fatec-orange-600",
    fundo: "bg-fatec-orange-50",
  },
  avaliado: { icone: CheckCircle2, cor: "bg-emerald-50 text-emerald-700", fundo: "bg-emerald-50/60" },
  aceito: { icone: CheckCircle2, cor: "bg-emerald-50 text-emerald-700", fundo: "bg-emerald-50/60" },
  nao_aceito: { icone: XCircle, cor: "bg-rose-50 text-rose-600", fundo: "bg-rose-50/60" },
  convite_aceito: {
    icone: UserPlus,
    cor: "bg-fatec-navy-100 text-fatec-navy-800",
    fundo: "bg-fatec-navy-50",
  },
  pagamento: { icone: Wallet, cor: "bg-emerald-50 text-emerald-700", fundo: "bg-emerald-50/60" },
};

/** "9 de set., 14:32" — formato compacto pro feed (Timestamp do Firestore,
 * pode faltar por um instante logo após o write, enquanto o serverTimestamp
 * ainda não resolveu no listener local). */
function formatarQuando(criadoEm: { toDate: () => Date } | undefined): string {
  if (!criadoEm) return "agora";
  const data = criadoEm.toDate();
  const dataFmt = data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const horaFmt = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataFmt}, ${horaFmt}`;
}

/** Deixa em negrito só os trechos marcados em `negritos` (nome de trabalho,
 * evento, autor — pedido do usuário) sem usar dangerouslySetInnerHTML: o
 * texto vem de campos que o próprio aluno digita (título do trabalho, por
 * exemplo), então nunca tratamos isso como HTML — só quebramos a string em
 * pedaços de texto puro e envolvemos os trechos batidos num <strong>. Um
 * termo que não aparecer em `texto` (nunca deveria acontecer, mas por
 * segurança) é simplesmente ignorado, sem quebrar o resto da frase. */
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

  const { atividades } = useAtividades(user?.uid);

  const convitesPendentes = useMemo(
    () => trabalhos.filter((t) => user && t.convitesPendentes?.includes(user.uid)),
    [trabalhos, user],
  );

  function responder(trabalho: (typeof trabalhos)[number], aceitar: boolean) {
    if (!user) return;
    responderConvite(trabalho, user.uid, aceitar);
    // Feed da tela inicial do DONO do trabalho (2026-09-09) — só faz
    // sentido no aceite; recusar não vira atividade nenhuma pra ninguém.
    if (aceitar) notificarConviteAceito(user, trabalho.id);
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

          {/* Dois números lado a lado (2026-09-09, pedido do usuário) —
              "Meus eventos" e "Atividade recente" viraram seções próprias
              de largura cheia logo abaixo, em vez de espremer tudo numa
              grade de 3 colunas e empurrar o resto da tela pra baixo. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <CalendarRange className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {eventosInscritos.length}
              </p>
              <p className="text-sm text-fatec-muted">Eventos inscritos</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <FileStack className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {trabalhos.length}
              </p>
              <p className="text-sm text-fatec-muted">Submissões feitas</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-fatec-navy-900">
              Meus eventos
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

          {/* Feed de atividades (2026-09-09, substituiu "Trabalhos
              recentes" — antes só repetia título+evento, que já aparece
              acima em Eventos inscritos). Só mostra o que aconteceu a
              partir de quando isso foi implantado, sem histórico
              retroativo (ver src/lib/data/atividades.ts). max-h + overflow
              pra não crescer sem limite conforme o semestre passa. */}
          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-fatec-navy-900">
              Atividade recente
            </h2>
            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-fatec-line bg-white p-5">
              <div className="flex flex-col gap-2">
                {atividades.map((a) => {
                  const meta = ATIVIDADE_META[a.tipo];
                  const Icone = meta?.icone ?? FileStack;
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
                    Nada por aqui ainda — assim que algo acontecer com seus
                    trabalhos, aparece nesta lista.
                  </p>
                )}
              </div>
            </div>
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
