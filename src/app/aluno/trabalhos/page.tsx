"use client";

import { useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import { Check, Download, FileStack, Pencil, Eye, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  useEventosPublicos,
  useIndicadorEventos,
  dentroDoPrazoAvaliacao,
  type Evento,
} from "@/lib/data/eventos";
import {
  useTrabalhos,
  atualizarTrabalho,
  responderConvite,
  type Trabalho,
} from "@/lib/data/trabalhos";
import { useMonitoriasSimplesDoAluno } from "@/lib/data/monitores";
import {
  notificarConviteAceito,
  notificarConviteColega,
  notificarStatusTrabalho,
} from "@/lib/notificarEmail";
import { tituloExibicao } from "@/lib/tituloTrabalho";

// Prazo de edição (2026-09-04): 23:55 do dia de fim das inscrições, gravado
// em eventos/{id}.prazoEdicaoTrabalho na criação do evento (ver
// src/app/eventos/page.tsx). Evento sem esse campo (criado antes da feature,
// ou sem data de fim de inscrição preenchida) nunca trava — mesmo padrão de
// "campo ausente = sem restrição" usado no resto do app.
function dentroDoPrazoEdicao(evento: Evento | undefined): boolean {
  if (!evento?.prazoEdicaoTrabalho) return true;
  return evento.prazoEdicaoTrabalho.toDate().getTime() > Date.now();
}

export default function AlunoTrabalhosPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventosPublicos();
  const temEventoPendente = useIndicadorEventos(perfil, user?.uid);
  const eventosMonitoradosSimples = useMonitoriasSimplesDoAluno(user?.uid);
  const [editando, setEditando] = useState<Trabalho | null>(null);
  // Qual tag de autor está com o aviso aberto (2026-10-27, pedido explícito
  // do usuário) — chave única "trabalhoId:uid". Clique em vez de hover
  // (mesmo padrão do botão "Precisa de ajuda?" em Sidebar.tsx) porque
  // celular não tem hover — ninguém no toque veria um `title` nativo.
  const [avisoAutorAberto, setAvisoAutorAberto] = useState<string | null>(null);

  async function salvarEdicao(trabalho: Trabalho, dados: DadosSubmissao) {
    // Convite pendente só é criado pra colega novo — quem já tinha aceitado
    // (não está mais em convitesPendentes) continua aceito; quem foi
    // removido da lista simplesmente sai dos dois campos.
    const uidsAntigos = new Set(trabalho.participantesUids ?? []);
    const novosConvites = dados.participantesUids.filter((uid) => !uidsAntigos.has(uid));
    const convitesPendentes = Array.from(
      new Set([
        ...(trabalho.convitesPendentes ?? []).filter((uid) =>
          dados.participantesUids.includes(uid),
        ),
        ...novosConvites,
      ]),
    );
    const evento = eventos.find((e) => e.id === trabalho.eventoId);
    // Nota já travada ANTES de mandar pra revisão (2026-11-05, pedido
    // explícito do usuário — corrige o fluxo que dava "segunda chance" de
    // melhorar a nota: antes o avaliador podia mandar pra revisão sem nota
    // nenhuma, só dar nota depois de ver a versão já corrigida). Se a nota
    // já existe, o reenvio fecha sozinho em "avaliado" — reaproveita a nota
    // travada, sem reabrir avaliação pro avaliador mexer de novo (por isso
    // nem olha prazo aqui: não tem mais nenhuma ação humana pendente depois
    // disso). Só os trabalhos que já estavam em "revisao" sem nota ANTES
    // desse fix (`revisaoLegado`, ver src/lib/data/trabalhos.ts) continuam
    // no fluxo antigo abaixo.
    const notaJaTravada =
      trabalho.status === "revisao" && typeof trabalho.notaAvaliador === "number";
    // Corrigir depois que o prazo de avaliação já encerrou (2026-11-04,
    // pedido explícito do usuário — "ele vai ficar entregue, pro avaliador
    // vai chegar uma mensagem... e ele pode avaliar"). O aluno consegue
    // devolver normalmente; o trabalho vai pra "entregue_com_atraso" em vez
    // de "aguardando_avaliacao" só pra ficar registrado na aba Revisão do
    // admin — o avaliador ganha uma exceção em firestore.rules e continua
    // conseguindo avaliar esse trabalho específico mesmo com o prazo geral
    // vencido (ver dentroDoPrazoAvaliacao || status == "entregue_com_atraso"
    // nas regras).
    const entregueComAtraso =
      trabalho.status === "revisao" && !notaJaTravada && !dentroDoPrazoAvaliacao(evento);

    await atualizarTrabalho(trabalho.id, {
      ...dados,
      convitesPendentes,
      // Editar durante "revisao" reenvia automaticamente — pra avaliação de
      // novo (fluxo legado, sem nota) ou direto pra "avaliado" (nota já
      // travada). Fora de "revisao" (submissao, aguardando_avaliacao, etc.)
      // a edição não mexe no status.
      ...(trabalho.status === "revisao"
        ? notaJaTravada
          ? { status: "avaliado" as const, comentarioRevisao: null }
          : {
              status: entregueComAtraso
                ? ("entregue_com_atraso" as const)
                : ("aguardando_avaliacao" as const),
              comentarioRevisao: null,
            }
        : {}),
      atualizadoEm: serverTimestamp(),
    });
    if (user) {
      novosConvites.forEach((colegaUid) => notificarConviteColega(user, trabalho.id, colegaUid));
      if (notaJaTravada) {
        notificarStatusTrabalho(user, trabalho.id, "avaliado");
      } else if (entregueComAtraso) {
        // Duas notificações separadas (2026-11-04): confirma pro aluno que
        // a entrega foi registrada, e avisa o avaliador que esse trabalho
        // específico ainda pode ser avaliado mesmo fora do prazo geral.
        notificarStatusTrabalho(user, trabalho.id, "entregue_fora_prazo");
        notificarStatusTrabalho(user, trabalho.id, "aviso_entrega_atrasada");
      }
    }
    setEditando(null);
  }

  // Mesma ação do painel inicial (aluno/page.tsx): aceitar avisa o dono.
  function responder(trabalho: Trabalho, aceitar: boolean) {
    if (!user) return;
    responderConvite(trabalho, user.uid, aceitar);
    if (aceitar) notificarConviteAceito(user, trabalho.id);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente, eventosMonitoradosSimples.length > 0)}
        activeHref="/aluno/trabalhos"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            Seus trabalhos inscritos e o andamento de cada um.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {trabalhos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <FileStack className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum trabalho submetido ainda
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trabalhos.map((t) => {
                const evento = eventos.find((e) => e.id === t.eventoId);
                const souDono = t.alunoUid === user?.uid;
                // Em "revisão" (avaliador pediu ajuste) edita mesmo fora do
                // prazo (2026-11-04, corrigido — achado real: firestore.rules
                // já permitia isso, mas o botão "Corrigir" ficava escondido
                // se o prazo de edição já tivesse passado, travando o aluno
                // sem como corrigir o que o avaliador pediu).
                // Em revisão o aluno NÃO corrige mais (2026-11-06, pedido explícito
                // do usuário): a comissão organizadora reavalia a versão que
                // está lá e dá a nota. Só edita dentro do prazo de edição.
                const podeEditar = souDono && t.status !== "revisao" && dentroDoPrazoEdicao(evento);
                const convitePendente = !souDono && !!user && !!t.convitesPendentes?.includes(user.uid);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium leading-snug text-fatec-navy-900">
                          {tituloExibicao(t.titulo)}
                        </p>
                        {!souDono &&
                          (t.convitesPendentes?.includes(user?.uid ?? "") ? (
                            <span className="flex-none rounded-full bg-fatec-orange-100 px-2 py-0.5 text-xs font-medium text-fatec-orange-600">
                              Convite pendente
                            </span>
                          ) : (
                            <span className="flex-none rounded-full bg-fatec-navy-50 px-2 py-0.5 text-xs font-medium text-fatec-muted">
                              Participante
                            </span>
                          ))}
                      </div>
                      <p className="mt-0.5 text-sm text-fatec-muted">
                        {evento?.nome ?? t.eventoId}
                        {" · "}
                        {t.areaTematica}
                      </p>
                      {(t.participantesNomes?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-xs text-fatec-muted">Autores:</span>
                          {t.participantesNomes!.map((nome, i) => {
                            // Verde = já aceitou o convite; vermelho = ainda
                            // não aceitou (pedido explícito do usuário,
                            // 2026-10-27 — antes os nomes apareciam todos
                            // iguais, sem jeito de saber quem já confirmou
                            // ser autor sem abrir cada trabalho). Cruza pelo
                            // índice porque participantesUids/Nomes andam em
                            // pares (mesmo padrão já usado na edição, ver
                            // SubmeterTrabalhoModal).
                            const uid = t.participantesUids?.[i];
                            const pendente = !!uid && t.convitesPendentes?.includes(uid);
                            const chave = `${t.id}:${uid ?? nome}`;
                            const aberto = avisoAutorAberto === chave;
                            return (
                              <div key={chave} className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAvisoAutorAberto((atual) => (atual === chave ? null : chave))
                                  }
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                    pendente
                                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {nome}
                                </button>
                                {aberto && (
                                  <>
                                    <div
                                      aria-hidden
                                      onClick={() => setAvisoAutorAberto(null)}
                                      className="fixed inset-0 z-10"
                                    />
                                    <div className="absolute left-0 top-full z-20 mt-1 w-max max-w-[220px] rounded-lg bg-fatec-navy-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
                                      {pendente
                                        ? `${nome} ainda não aceitou o convite`
                                        : `${nome} já aceitou o convite`}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-none flex-wrap items-center gap-3">
                      {t.modalidadeApresentacao === "roda_conversa" && (
                        <a
                          href="/materiais/modelo-banner-mac.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Modelo do banner
                        </a>
                      )}
                      {t.modalidadeApresentacao === "oral" && (
                        <a
                          href="/materiais/modelo-apresentacao-mac.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Modelo da apresentação
                        </a>
                      )}
                      <StatusBadge status={t.status} />
                      {/* Aceitar/Recusar aqui também (2026-11-04, pedido explícito do
                          usuário — achado real: o aluno via o próprio nome como
                          "Convite pendente" nesta tela e não achava onde aceitar;
                          os botões só existiam no painel inicial). Mesma ação de lá. */}
                      {convitePendente && (
                        <>
                          <button
                            type="button"
                            onClick={() => responder(t, false)}
                            className="flex items-center gap-1.5 rounded-lg border border-fatec-line bg-white px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2} />
                            Recusar
                          </button>
                          <button
                            type="button"
                            onClick={() => responder(t, true)}
                            className="flex items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            Aceitar
                          </button>
                        </>
                      )}
                      {podeEditar ? (
                        <button
                          type="button"
                          onClick={() => setEditando(t)}
                          className="flex items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {t.status === "revisao" ? "Corrigir" : "Editar"}
                        </button>
                      ) : (
                        // Colega convidado (2026-09-09) — acompanha tudo
                        // (inclusive o comentário de revisão), mas não
                        // edita; só o dono corrige. Mesmo botão aparece pro
                        // dono fora do prazo de edição.
                        <button
                          type="button"
                          onClick={() => setEditando(t)}
                          className="flex items-center gap-1.5 rounded-lg border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editando && (
        <SubmeterTrabalhoModal
          open={!!editando}
          modoEdicao
          somenteLeitura={editando.alunoUid !== user?.uid}
          eventoId={editando.eventoId}
          temTaxa={!!eventos.find((e) => e.id === editando.eventoId)?.valorInscricao}
          eventoNome={eventos.find((e) => e.id === editando.eventoId)?.nome ?? ""}
          areasDisponiveis={eventos.find((e) => e.id === editando.eventoId)?.areasTematicas ?? []}
          areasComplexas={
            eventos.find((e) => e.id === editando.eventoId)?.areasTematicasComplexas ?? []
          }
          modalidadesPermitidas={
            eventos.find((e) => e.id === editando.eventoId)?.modalidadesApresentacao
          }
          resumoAcademico
          meuUid={user?.uid}
          autorPrincipal={{ nome: editando.alunoNome, souEu: editando.alunoUid === user?.uid }}
          comentarioRevisao={editando.status === "revisao" ? editando.comentarioRevisao : null}
          valoresIniciais={{
            titulo: editando.titulo,
            resumo: editando.resumo,
            palavrasChave: editando.palavrasChave,
            areaTematica: editando.areaTematica,
            modalidadeApresentacao: editando.modalidadeApresentacao,
            nomeOrientador: editando.nomeOrientador,
            nomesCoorientadores: editando.nomesCoorientadores,
            participantes: (editando.participantesUids ?? []).map((uid, i) => ({
              uid,
              nome: editando.participantesNomes?.[i] ?? uid,
            })),
          }}
          onClose={() => setEditando(null)}
          onSubmit={(dados) => salvarEdicao(editando, dados)}
        />
      )}
    </main>
  );
}
