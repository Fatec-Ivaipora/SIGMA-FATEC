"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useInscritosDoEvento, type InscricaoEvento } from "@/lib/data/inscricoes";

type FiltroVinculo = "todos" | "fatec" | "externo";

const OPCOES_VINCULO: { key: FiltroVinculo; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "fatec", label: "Alunos" },
  { key: "externo", label: "De fora" },
];

function formatarData(valor?: InscricaoEvento["criadoEm"]): string {
  if (!valor) return "—";
  return valor.toDate().toLocaleDateString("pt-BR");
}

const COLUNAS_GRID = "sm:grid-cols-[2rem_minmax(0,1fr)_6rem_6rem_6rem]";

function Pessoa({ pessoa }: { pessoa: InscricaoEvento }) {
  const pago = pessoa.status === "pago";
  return (
    <div className={`flex flex-col gap-3 px-4 py-3 sm:grid sm:items-center sm:gap-4 ${COLUNAS_GRID}`}>
      <div className="flex items-center gap-3 sm:contents">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-xs font-semibold text-white">
          {(pessoa.nome || "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-fatec-navy-900">
            {pessoa.nome}
            {pessoa.vinculoFatec === false && (
              <span className="rounded-full border border-fatec-line px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-fatec-muted">
                Externo
              </span>
            )}
          </p>
          <p className="truncate text-xs text-fatec-muted">{pessoa.email}</p>
        </div>
      </div>
      <div className="pl-11 text-xs text-fatec-muted sm:pl-0">
        <p className="sm:hidden">Inscrito em</p>
        <p className="font-medium text-fatec-navy-900">{formatarData(pessoa.criadoEm)}</p>
      </div>
      <div className="pl-11 text-xs text-fatec-muted sm:pl-0">
        <p className="sm:hidden">Pago em</p>
        <p className="font-medium text-fatec-navy-900">{formatarData(pessoa.pagoEm)}</p>
      </div>
      <span
        className={`ml-11 w-fit rounded-full px-2.5 py-1 text-center text-xs font-semibold sm:ml-0 sm:w-full ${
          pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {pago ? "Pago" : "Não pago"}
      </span>
    </div>
  );
}

export function InscritosEventoModal({
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
  const { inscritos } = useInscritosDoEvento(eventoId);
  const [busca, setBusca] = useState("");
  const [filtroVinculo, setFiltroVinculo] = useState<FiltroVinculo>("todos");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscritos
      .filter((i) => {
        if (filtroVinculo === "fatec") return i.vinculoFatec !== false;
        if (filtroVinculo === "externo") return i.vinculoFatec === false;
        return true;
      })
      .filter(
        (i) => !termo || i.nome.toLowerCase().includes(termo) || i.email.toLowerCase().includes(termo),
      )
      .sort((a, b) => (b.criadoEm?.toMillis() ?? 0) - (a.criadoEm?.toMillis() ?? 0));
  }, [inscritos, busca, filtroVinculo]);

  const pagos = inscritos.filter((i) => i.status === "pago").length;

  return (
    <Modal open={open} onClose={onClose} title={`Inscritos — ${eventoNome}`} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl bg-fatec-navy-50 px-4 py-3 text-sm text-fatec-muted">
            <span className="font-semibold text-fatec-navy-900">{inscritos.length}</span>{" "}
            {inscritos.length === 1 ? "inscrito" : "inscritos"} —{" "}
            <span className="font-semibold text-emerald-700">{pagos} pagos</span>,{" "}
            <span className="font-semibold text-amber-700">
              {inscritos.length - pagos} pendentes
            </span>
            .
          </div>

          <div className="relative sm:w-72">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full rounded-xl border border-fatec-line bg-white py-2.5 pl-10 pr-4 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {OPCOES_VINCULO.map((opcao) => (
            <button
              key={opcao.key}
              type="button"
              onClick={() => setFiltroVinculo(opcao.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filtroVinculo === opcao.key
                  ? "border-fatec-navy-900 bg-fatec-navy-900 text-white"
                  : "border-fatec-line bg-fatec-navy-50 text-fatec-muted hover:border-fatec-orange-400"
              }`}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-fatec-line">
          <div
            className={`hidden border-b border-fatec-line bg-fatec-navy-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fatec-muted sm:grid sm:items-center sm:gap-4 ${COLUNAS_GRID}`}
          >
            <span />
            <span>Nome</span>
            <span>Inscrito em</span>
            <span>Pago em</span>
            <span className="text-center">Status</span>
          </div>
          <div className="flex flex-col divide-y divide-fatec-line">
            {filtrados.map((p) => (
              <Pessoa key={p.uid} pessoa={p} />
            ))}
            {filtrados.length === 0 && (
              <p className="px-4 py-3 text-sm text-fatec-muted">Ninguém encontrado.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
