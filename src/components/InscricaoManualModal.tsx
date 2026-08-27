"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useAlunosParaBusca, type AlunoParaBusca } from "@/lib/data/usuarios";

/** Inscrição extra (2026-08-26) — organização/admin marcam manualmente um
 * aluno já cadastrado como pago, pra casos de pagamento fora do sistema
 * (dinheiro em mãos, etc). Busca só entre contas de aluno já existentes. */
export function InscricaoManualModal({
  open,
  eventoId,
  eventoNome,
  user,
  onClose,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  user: User | null | undefined;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<AlunoParaBusca | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const alunos = useAlunosParaBusca(user?.uid);
  const termo = busca.trim().toLowerCase();
  const sugestoes = termo
    ? alunos
        .filter((a) => a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo))
        .slice(0, 6)
    : [];

  function fechar() {
    setBusca("");
    setSelecionado(null);
    setErro(null);
    setSucesso(null);
    onClose();
  }

  async function confirmar() {
    if (!user || !selecionado) return;
    setErro(null);
    setEnviando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/asaas/manual", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, alunoUid: selecionado.uid }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.erro ?? "Não foi possível inscrever.");
      setSucesso(`${selecionado.nome} foi inscrito e marcado como pago.`);
      setSelecionado(null);
      setBusca("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={fechar} title={`Inscrição extra — ${eventoNome}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fatec-muted">
          Pra quem pagou por fora do sistema (dinheiro em mãos, etc). A pessoa
          precisa já ter conta cadastrada — busque por nome ou e-mail.
        </p>

        {sucesso && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-none" strokeWidth={2} />
            {sucesso}
          </p>
        )}
        {erro && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
        )}

        {selecionado ? (
          <div className="flex flex-col gap-3 rounded-xl border border-fatec-line bg-fatec-navy-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-fatec-navy-900">{selecionado.nome}</p>
              <p className="text-xs text-fatec-muted">{selecionado.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="flex items-center gap-2 rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                {enviando ? "Inscrevendo..." : "Confirmar inscrição extra"}
              </button>
              <button
                type="button"
                onClick={() => setSelecionado(null)}
                className="rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-white"
              >
                Trocar
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno por nome ou e-mail"
              className="w-full rounded-xl border border-fatec-line bg-white py-2.5 pl-10 pr-4 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            {sugestoes.length > 0 && (
              <div className="mt-1 overflow-hidden rounded-xl border border-fatec-line bg-white shadow-lg">
                {sugestoes.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    onClick={() => setSelecionado(a)}
                    className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50"
                  >
                    <span className="text-sm font-medium text-fatec-navy-900">{a.nome}</span>
                    <span className="text-xs text-fatec-muted">{a.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
