"use client";

import { useState } from "react";
import { Award, AlertTriangle, Clock, Download, Loader2, UserCog } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, useIndicadorEventos, type Evento } from "@/lib/data/eventos";
import { periodosDoEvento, presencaMinimaDoEvento } from "@/lib/periodosPresenca";
import { useTrabalhos, type Trabalho } from "@/lib/data/trabalhos";
import {
  useMinhaInscricao,
  useMinhasInscricoes,
  diasConfirmadosCount,
  type InscricaoEvento,
} from "@/lib/data/inscricoes";
import {
  useMinhasMonitorias,
  useMonitoriasSimplesDoAluno,
  type MonitorEvento,
} from "@/lib/data/monitores";
import { baixarCertificado } from "@/lib/baixarCertificado";

/** Estado do botão de download isolado num componente próprio (2026-08-31)
 * só pra poder chamar useMinhaInscricao por linha — precisa saber, por
 * trabalho, se o pagamento desse evento específico é que tá segurando o
 * certificado (em vez do genérico "aguardando liberação"). */
function LinhaCertificado({
  trabalho,
  evento,
  uid,
  baixando,
  erro,
  onBaixar,
}: {
  trabalho: Trabalho;
  evento: Evento | undefined;
  uid: string | undefined;
  baixando: boolean;
  erro: string | undefined;
  onBaixar: () => void;
}) {
  const temTaxa = !!evento?.valorInscricao;
  const { inscricao } = useMinhaInscricao(temTaxa ? trabalho.eventoId : undefined, uid);
  const pagamentoPendente = temTaxa && inscricao?.status !== "pago";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
          <Award className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fatec-navy-900">{trabalho.titulo}</p>
          <p className="text-sm text-fatec-muted">{evento?.nome ?? trabalho.eventoId}</p>
        </div>
        {trabalho.certificadoLiberado && !pagamentoPendente ? (
          <button
            type="button"
            onClick={onBaixar}
            disabled={baixando}
            className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.75} />
            )}
            Baixar certificado
          </button>
        ) : pagamentoPendente ? (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
            Pagamento pendente
          </span>
        ) : (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-fatec-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Aguardando liberação
          </span>
        )}
      </div>
      {erro && (
        <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>
      )}
    </div>
  );
}

/** Declaração de monitor (2026-09-01) — evento completo: sem pagamento
 * envolvido, só depende do "Emitir certificados" (em /trabalhos) liberar.
 * Evento "simples" (2026-10-01, achado: esse botão nem existe pra evento
 * simples, monitor.certificadoLiberado nunca tinha como virar true) — usa
 * a MESMA liberação do participante (evento.certificadosLiberados, o botão
 * "Liberar certificados" do Ensalamento) e exige presença confirmada pelo
 * QR (mesma fonte do papel "participante"), continua sem exigir pagamento.
 * Mesma regra de /api/certificados. */
function LinhaCertificadoMonitor({
  monitoria,
  evento,
  inscricao,
  baixando,
  erro,
  onBaixar,
}: {
  monitoria: MonitorEvento;
  evento: Evento | undefined;
  inscricao: InscricaoEvento | undefined;
  baixando: boolean;
  erro: string | undefined;
  onBaixar: () => void;
}) {
  const simples = evento?.tipo === "simples";
  const liberado = simples ? !!evento?.certificadosLiberados : !!monitoria.certificadoLiberado;
  const semPresenca = simples && diasConfirmadosCount(inscricao) === 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-sky-100 text-fatec-sky-600">
          <UserCog className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fatec-navy-900">
            Declaração de monitor
          </p>
          <p className="text-sm text-fatec-muted">{evento?.nome ?? monitoria.eventoId}</p>
        </div>
        {liberado && semPresenca ? (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-fatec-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sem presença confirmada
          </span>
        ) : liberado ? (
          <button
            type="button"
            onClick={onBaixar}
            disabled={baixando}
            className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.75} />
            )}
            Baixar certificado
          </button>
        ) : (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-fatec-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Aguardando liberação
          </span>
        )}
      </div>
      {erro && (
        <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>
      )}
    </div>
  );
}

/** Certificado de participação (2026-09-24) — evento "simples", sem
 * trabalho. Só é chamado depois que o pai já filtrou por
 * evento.certificadosLiberados (2026-09-30, pedido explícito do usuário —
 * o item nem aparece na aba antes disso), então aqui dentro "liberado" já
 * é garantido — falta só bater os outros dois critérios pra liberar o
 * BOTÃO de baixar: pagamento em dia (se tem taxa) e presença confirmada
 * pelo QR. Mesma regra de /api/certificados (papel "participante"). */
function LinhaCertificadoParticipacao({
  inscricao,
  evento,
  baixando,
  erro,
  onBaixar,
}: {
  inscricao: InscricaoEvento;
  evento: Evento;
  baixando: boolean;
  erro: string | undefined;
  onBaixar: () => void;
}) {
  const pagamentoPendente = !!evento.valorInscricao && inscricao.status !== "pago";
  // Evento multi-dia (2026-09-30) — qualquer 1 dia já basta aqui (horas
  // saem proporcionais na hora de gerar o PDF, ver /api/certificados). Ver
  // diasDoEvento em src/lib/certificadoDias.ts.
  const diasConfirmados = diasConfirmadosCount(inscricao);
  const diasEvento = periodosDoEvento(evento);
  // Mínimo configurável (2026-10-08, pedido explícito do usuário — Semana
  // de Medicina exige 4 dos 5 períodos, não só 1 — ver presencaMinimaDoEvento
  // em src/lib/periodosPresenca.ts). O botão só libera quando bate o
  // mínimo; o servidor (/api/certificados) é quem garante de verdade, isso
  // aqui é só pra não mostrar um botão que vai dar erro ao clicar.
  const minimoExigido = presencaMinimaDoEvento(evento);
  const presencaInsuficiente = diasConfirmados < minimoExigido;
  const rotuloDias = evento.periodosPresenca ? "períodos" : "dias";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
          <Award className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fatec-navy-900">
            Certificado de participação
          </p>
          <p className="text-sm text-fatec-muted">{evento.nome}</p>
        </div>
        {pagamentoPendente ? (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
            Pagamento pendente
          </span>
        ) : presencaInsuficiente ? (
          <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-fatec-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {diasConfirmados === 0
              ? "Sem presença confirmada"
              : `Presença insuficiente (${diasConfirmados}/${minimoExigido} ${rotuloDias})`}
          </span>
        ) : (
          <button
            type="button"
            onClick={onBaixar}
            disabled={baixando}
            className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.75} />
            )}
            Baixar certificado
          </button>
        )}
      </div>
      {diasEvento > 1 && !pagamentoPendente && (
        <p className="pl-[60px] text-xs text-fatec-muted">
          Presença confirmada em {diasConfirmados}/{diasEvento} {rotuloDias}
          {minimoExigido > 1 && ` (mínimo de ${minimoExigido} pro certificado)`} — horas
          do certificado saem proporcionais.
        </p>
      )}
      {erro && (
        <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>
      )}
    </div>
  );
}

export default function AlunoCertificacoesPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventosPublicos();
  const temEventoPendente = useIndicadorEventos(perfil, user?.uid);
  const monitorias = useMinhasMonitorias(user?.uid);
  const eventosMonitoradosSimples = useMonitoriasSimplesDoAluno(user?.uid);
  const { inscricoes } = useMinhasInscricoes(user?.uid);

  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [erroId, setErroId] = useState<{ id: string; msg: string } | null>(null);

  async function baixar(trabalhoId: string) {
    if (!user) return;
    setErroId(null);
    setBaixandoId(trabalhoId);
    const resultado = await baixarCertificado(user, { papel: "aluno", trabalhoId });
    if (!resultado.ok) setErroId({ id: trabalhoId, msg: resultado.erro });
    setBaixandoId(null);
  }

  async function baixarMonitor(eventoId: string) {
    if (!user) return;
    const chaveErro = `monitor_${eventoId}`;
    setErroId(null);
    setBaixandoId(chaveErro);
    const resultado = await baixarCertificado(user, { papel: "monitor", eventoId });
    if (!resultado.ok) setErroId({ id: chaveErro, msg: resultado.erro });
    setBaixandoId(null);
  }

  async function baixarParticipacao(eventoId: string) {
    if (!user) return;
    const chaveErro = `participante_${eventoId}`;
    setErroId(null);
    setBaixandoId(chaveErro);
    const resultado = await baixarCertificado(user, { papel: "participante", eventoId });
    if (!resultado.ok) setErroId({ id: chaveErro, msg: resultado.erro });
    setBaixandoId(null);
  }

  const aceitos = trabalhos.filter((t) => t.status === "aceito");
  // certificadosLiberados filtra aqui (2026-09-30, pedido explícito do
  // usuário) — o item nem aparece na aba até a organização liberar; antes
  // aparecia sempre, só o botão de baixar é que ficava escondido.
  const participacoes = eventos.flatMap((evento) => {
    if (evento.tipo !== "simples" || !evento.certificadosLiberados) return [];
    const inscricao = inscricoes.get(evento.id);
    return inscricao ? [{ evento, inscricao }] : [];
  });
  const nadaAinda =
    aceitos.length === 0 && monitorias.length === 0 && participacoes.length === 0;

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente, eventosMonitoradosSimples.length > 0)}
        activeHref="/aluno/certificacoes"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Certificados emitidos para trabalhos aceitos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {nadaAinda ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Award className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum certificado ainda
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Certificados aparecem aqui assim que um trabalho seu for
                aceito no resultado final — o download libera depois que a
                organização confirmar o evento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {aceitos.map((t) => (
                <LinhaCertificado
                  key={t.id}
                  trabalho={t}
                  evento={eventos.find((e) => e.id === t.eventoId)}
                  uid={user?.uid}
                  baixando={baixandoId === t.id}
                  erro={erroId?.id === t.id ? erroId.msg : undefined}
                  onBaixar={() => baixar(t.id)}
                />
              ))}
              {monitorias.map((m) => (
                <LinhaCertificadoMonitor
                  key={m.id}
                  monitoria={m}
                  evento={eventos.find((e) => e.id === m.eventoId)}
                  inscricao={inscricoes.get(m.eventoId)}
                  baixando={baixandoId === `monitor_${m.eventoId}`}
                  erro={
                    erroId?.id === `monitor_${m.eventoId}` ? erroId.msg : undefined
                  }
                  onBaixar={() => baixarMonitor(m.eventoId)}
                />
              ))}
              {participacoes.map(({ evento, inscricao }) => (
                <LinhaCertificadoParticipacao
                  key={inscricao.id}
                  inscricao={inscricao}
                  evento={evento}
                  baixando={baixandoId === `participante_${evento.id}`}
                  erro={
                    erroId?.id === `participante_${evento.id}` ? erroId.msg : undefined
                  }
                  onBaixar={() => baixarParticipacao(evento.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
