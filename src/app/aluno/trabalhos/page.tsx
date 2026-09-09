"use client";

import { useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import { Download, FileStack, Pencil, Eye } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, useIndicadorEventos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos, atualizarTrabalho, type Trabalho } from "@/lib/data/trabalhos";
import { notificarConviteColega } from "@/lib/notificarEmail";

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
  const [editando, setEditando] = useState<Trabalho | null>(null);

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
    await atualizarTrabalho(trabalho.id, {
      ...dados,
      convitesPendentes,
      // Editar durante "revisao" reenvia pra avaliação automaticamente,
      // igual o antigo fluxo de correção — fora disso (submissao,
      // aguardando_avaliacao, etc.) a edição não mexe no status.
      ...(trabalho.status === "revisao"
        ? { status: "aguardando_avaliacao" as const, comentarioRevisao: null }
        : {}),
      atualizadoEm: serverTimestamp(),
    });
    if (user) {
      novosConvites.forEach((colegaUid) => notificarConviteColega(user, trabalho.id, colegaUid));
    }
    setEditando(null);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente)}
        activeHref="/aluno/trabalhos"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
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
                Nenhum trabalho inscrito ainda
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trabalhos.map((t) => {
                const evento = eventos.find((e) => e.id === t.eventoId);
                const souDono = t.alunoUid === user?.uid;
                const podeEditar = souDono && dentroDoPrazoEdicao(evento);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium leading-snug text-fatec-navy-900">
                          {t.titulo}
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
                        <p className="mt-0.5 text-xs text-fatec-muted">
                          Autores: {t.participantesNomes!.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-none items-center gap-3">
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
                      <StatusBadge status={t.status} />
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
          meuUid={user?.uid}
          comentarioRevisao={editando.status === "revisao" ? editando.comentarioRevisao : null}
          valoresIniciais={{
            titulo: editando.titulo,
            resumo: editando.resumo,
            areaTematica: editando.areaTematica,
            modalidadeApresentacao: editando.modalidadeApresentacao,
            nomeOrientador: editando.nomeOrientador,
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
