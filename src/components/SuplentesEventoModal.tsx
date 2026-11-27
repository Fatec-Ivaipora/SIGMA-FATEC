"use client";

import { useMemo, useState } from "react";
import { UserCog, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  useSuplentesDoEvento,
  useProfessoresParaBusca,
  adicionarSuplente,
  removerSuplente,
  type ProfessorParaBusca,
} from "@/lib/data/suplentes";

/** Gestão de suplentes de um evento de TCC (2026-11-27, pedido explícito do
 * usuário — "em vez de monitores... podemos ter suplentes que são
 * professores que ficam ali esperando caso precise no dia"). Quem atribui
 * é a organização/admin por aqui, igual Monitores — só que buscando entre
 * professores (avaliador/orientador/moderador), não alunos, e sem exigir
 * inscrição prévia no evento (o ponto é justamente ter gente de reserva
 * fora da banca). */
export function SuplentesEventoModal({
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
  const { suplentes } = useSuplentesDoEvento(eventoId);
  const professores = useProfessoresParaBusca();
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState<string | null>(null);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    const jaSuplentes = new Set(suplentes.map((s) => s.uid));
    return professores
      .filter(
        (p) =>
          !jaSuplentes.has(p.uid) &&
          (p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo)),
      )
      .slice(0, 5);
  }, [professores, busca, suplentes]);

  async function adicionar(professor: ProfessorParaBusca) {
    setAdicionando(professor.uid);
    try {
      await adicionarSuplente(eventoId, professor);
      setBusca("");
    } finally {
      setAdicionando(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Suplentes — ${eventoNome}`}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-fatec-muted">
          Professores (avaliador, orientador ou moderador) de sobreaviso pra
          essa banca — não entram em nenhuma automaticamente, ficam
          disponíveis caso precise substituir alguém no dia. Aparecem com a
          tag &quot;Suplente&quot; na frente do nome.
        </p>

        <div className="relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar professor por nome ou e-mail"
            className="w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
          {sugestoes.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-fatec-line bg-white shadow-lg">
              {sugestoes.map((p) => (
                <button
                  key={p.uid}
                  type="button"
                  disabled={adicionando === p.uid}
                  onClick={() => adicionar(p)}
                  className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-fatec-navy-900">{p.nome}</span>
                  <span className="text-xs text-fatec-muted">{p.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fatec-navy-900">Suplentes ({suplentes.length})</p>
          {suplentes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-fatec-line px-4 py-6 text-center text-sm text-fatec-muted">
              Nenhum suplente ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line">
              {suplentes.map((s) => (
                <div key={s.uid} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-white">
                    <UserCog className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-fatec-navy-900">{s.nome}</p>
                      {/* Tag "Suplente" na frente do nome (2026-11-27,
                          pedido explícito do usuário). */}
                      <span className="flex-none rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Suplente
                      </span>
                    </div>
                    <p className="truncate text-xs text-fatec-muted">{s.email}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover ${s.nome}`}
                    onClick={() => removerSuplente(eventoId, s.uid)}
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
