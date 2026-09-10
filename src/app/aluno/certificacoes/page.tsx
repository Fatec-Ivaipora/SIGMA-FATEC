"use client";

import { useState } from "react";
import { Award, AlertTriangle, Clock, Download, Loader2, UserCog } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos, useIndicadorEventos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos, type Trabalho } from "@/lib/data/trabalhos";
import { useMinhaInscricao } from "@/lib/data/inscricoes";
import { useMinhasMonitorias, type MonitorEvento } from "@/lib/data/monitores";
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

/** Declaração de monitor (2026-09-01) — sem pagamento envolvido, só depende
 * do "Emitir certificados" liberar. */
function LinhaCertificadoMonitor({
  monitoria,
  evento,
  baixando,
  erro,
  onBaixar,
}: {
  monitoria: MonitorEvento;
  evento: Evento | undefined;
  baixando: boolean;
  erro: string | undefined;
  onBaixar: () => void;
}) {
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
        {monitoria.certificadoLiberado ? (
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

export default function AlunoCertificacoesPage() {
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventosPublicos();
  const temEventoPendente = useIndicadorEventos(perfil, user?.uid);
  const monitorias = useMinhasMonitorias(user?.uid);

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

  const aceitos = trabalhos.filter((t) => t.status === "aceito");
  const nadaAinda = aceitos.length === 0 && monitorias.length === 0;

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec, temEventoPendente)}
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
                  baixando={baixandoId === `monitor_${m.eventoId}`}
                  erro={
                    erroId?.id === `monitor_${m.eventoId}` ? erroId.msg : undefined
                  }
                  onBaixar={() => baixarMonitor(m.eventoId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
