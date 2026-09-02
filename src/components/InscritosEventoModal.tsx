"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Search, Users } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useInscritosDoEvento, type InscricaoEvento } from "@/lib/data/inscricoes";

function Pessoa({ nome, email, status }: { nome: string; email: string; status: InscricaoEvento["status"] }) {
  const pago = status === "pago";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-xs font-semibold text-white">
        {(nome || "?").slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fatec-navy-900">{nome}</p>
        <p className="truncate text-xs text-fatec-muted">{email}</p>
      </div>
      <span
        className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
          pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {pago ? "Pago" : "Não pago"}
      </span>
    </div>
  );
}

function Secao({
  titulo,
  icone,
  pessoas,
}: {
  titulo: string;
  icone: React.ReactNode;
  pessoas: { uid: string; nome: string; email: string; status: InscricaoEvento["status"] }[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fatec-navy-900">
        {icone}
        {titulo}
        <span className="font-normal text-fatec-muted">({pessoas.length})</span>
      </h3>
      <div className="mt-2 flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line">
        {pessoas.map((p) => (
          <Pessoa key={p.uid} nome={p.nome} email={p.email} status={p.status} />
        ))}
        {pessoas.length === 0 && (
          <p className="px-4 py-3 text-sm text-fatec-muted">Ninguém encontrado.</p>
        )}
      </div>
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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return inscritos;
    return inscritos.filter(
      (i) => i.nome.toLowerCase().includes(termo) || i.email.toLowerCase().includes(termo),
    );
  }, [inscritos, busca]);

  const daFatec = filtrados.filter((i) => i.vinculoFatec !== false);
  const externos = filtrados.filter((i) => i.vinculoFatec === false);
  const pagos = inscritos.filter((i) => i.status === "pago").length;

  return (
    <Modal open={open} onClose={onClose} title={`Inscritos — ${eventoNome}`} size="lg">
      <div className="flex flex-col gap-6">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Secao
            titulo="Alunos da Fatec"
            icone={<GraduationCap className="h-4 w-4" strokeWidth={1.75} />}
            pessoas={daFatec}
          />
          <Secao
            titulo="Externos"
            icone={<Users className="h-4 w-4" strokeWidth={1.75} />}
            pessoas={externos}
          />
        </div>
      </div>
    </Modal>
  );
}
