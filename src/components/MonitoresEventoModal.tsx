"use client";

import { useMemo, useState } from "react";
import { UserCog, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useAlunosParaBusca, type AlunoParaBusca } from "@/lib/data/usuarios";
import { useInscritosUids } from "@/lib/data/inscricoes";
import {
  useMonitoresDoEvento,
  adicionarMonitor,
  removerMonitor,
} from "@/lib/data/monitores";

/** Gestão do cargo de monitor de um evento (2026-09-01) — aluno que ajuda na
 * operação, sem submeter trabalho nem avaliar nada. Quem atribui é a
 * organização/admin por aqui; o aluno não precisa fazer nada além de já ter
 * conta. O certificado dele sai junto com o botão "Emitir certificados" da
 * aba Resultado Final. */
export function MonitoresEventoModal({
  open,
  eventoId,
  eventoNome,
  onClose,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  onClose: () => void;
}) {
  const { monitores } = useMonitoresDoEvento(eventoId);
  // Só entre quem já demonstrou interesse no evento (2026-09-01) — quem só
  // vai ajudar como monitor, sem submeter trabalho, também clica em
  // "Inscreva-se" no evento; não faz sentido vasculhar todo o cadastro de
  // alunos da Fatec pra achar alguém aqui.
  const inscritosNoEvento = useInscritosUids(eventoId);
  const alunos = useAlunosParaBusca(undefined, { restringirA: inscritosNoEvento });
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState<string | null>(null);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    const jaMonitores = new Set(monitores.map((m) => m.uid));
    return alunos
      .filter(
        (a) =>
          !jaMonitores.has(a.uid) &&
          (a.nome.toLowerCase().includes(termo) ||
            a.email.toLowerCase().includes(termo)),
      )
      .slice(0, 5);
  }, [alunos, busca, monitores]);

  async function adicionar(aluno: AlunoParaBusca) {
    setAdicionando(aluno.uid);
    try {
      await adicionarMonitor(eventoId, aluno);
      setBusca("");
    } finally {
      setAdicionando(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Monitores — ${eventoNome}`}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-fatec-muted">
          Alunos que ajudam na operação do evento — não precisam submeter
          trabalho, só se inscrever no evento (botão &quot;Inscreva-se&quot;,
          na tela Eventos do aluno) pra aparecer aqui. Recebem declaração de
          monitor junto com a liberação dos certificados. Também pode marcar
          como monitor quem já submeteu um trabalho.
        </p>

        <div className="relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno por nome ou e-mail"
            className="w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
          {sugestoes.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-fatec-line bg-white shadow-lg">
              {sugestoes.map((a) => (
                <button
                  key={a.uid}
                  type="button"
                  disabled={adicionando === a.uid}
                  onClick={() => adicionar(a)}
                  className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-fatec-navy-900">
                    {a.nome}
                  </span>
                  <span className="text-xs text-fatec-muted">{a.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fatec-navy-900">
            Monitores ({monitores.length})
          </p>
          {monitores.length === 0 ? (
            <p className="rounded-xl border border-dashed border-fatec-line px-4 py-6 text-center text-sm text-fatec-muted">
              Nenhum monitor ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line">
              {monitores.map((m) => (
                <div key={m.uid} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-white">
                    <UserCog className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fatec-navy-900">
                      {m.nome}
                    </p>
                    <p className="truncate text-xs text-fatec-muted">{m.email}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover ${m.nome}`}
                    onClick={() => removerMonitor(eventoId, m.uid)}
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
