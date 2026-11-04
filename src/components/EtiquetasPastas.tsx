"use client";

import { useState } from "react";
import { Loader2, Tags } from "lucide-react";
import type { User } from "firebase/auth";
import { baixarEtiquetasPastas } from "@/lib/baixarCertificado";

/** Aba "Etiquetas das pastas" de Relatórios (2026-11-04, pedido explícito do
 * usuário — a secretaria tira daqui, sem precisar ir em Trabalhos). Uma
 * etiqueta por trabalho já enviado pra avaliação: autor principal, título e
 * área; na folha de etiquetas adesivas Carta, 20 por folha (Pimaco 6181,
 * mesmo modelo que a secretaria já usa), ordem alfabética do autor. */
export function EtiquetasPastas({
  user,
  eventoId,
  quantidade,
}: {
  user: User | null | undefined;
  eventoId: string;
  quantidade: number;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    if (!user) return;
    setErro(null);
    setGerando(true);
    const r = await baixarEtiquetasPastas(user, eventoId);
    if (!r.ok) setErro(r.erro);
    setGerando(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-fatec-navy-900">Etiquetas das pastas</h2>
        <p className="text-sm text-fatec-muted">
          Uma etiqueta por trabalho, com o <strong>autor principal</strong>, o título e a área temática, para
          identificar as pastas. Sai no formato da folha de etiquetas adesivas tamanho Carta, 20 por folha (2
          colunas × 10 linhas, padrão Pimaco 6181), em ordem alfabética do autor. Entram todos os trabalhos já
          enviados para avaliação. Dica: imprima a 1ª folha em papel comum e confira contra a folha de etiquetas.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={baixar}
          disabled={gerando || quantidade === 0}
          className="flex items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
          Baixar etiquetas (PDF)
        </button>
        <span className="text-sm text-fatec-muted">
          {quantidade} etiqueta{quantidade === 1 ? "" : "s"} · {Math.ceil(quantidade / 20)} folha
          {Math.ceil(quantidade / 20) === 1 ? "" : "s"}
        </span>
      </div>
      {erro && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>}
    </section>
  );
}
