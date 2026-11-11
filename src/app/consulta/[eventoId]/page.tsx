"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, MapPin, Search } from "lucide-react";

type Resultado = {
  titulo: string;
  autores: string;
  salaNome: string;
  horario: string;
};

/** Consulta pública do ensalamento (2026-11-11, pedido explícito do usuário
 * — "uma tela fora do SIGMA, sem acesso a nada dentro, pra deixar com os
 * moderadores e espalhar como QR code pela faculdade... pessoa perdida pode
 * procurar pelo nome dela ou o nome do trabalho"). Sem login, sem Sidebar —
 * só essa página solta, igual a /reavaliacao-externa. Liga/desliga em
 * /ensalamento (botão ao lado de "Gerar PDF"); desligada, essa tela mostra
 * "indisponível" pra qualquer busca (ver GET /api/ensalamento/consulta). */
export default function ConsultaEnsalamentoPage() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [busca, setBusca] = useState("");
  const [eventoNome, setEventoNome] = useState("");
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    let cancelado = false;
    // Sincroniza com a busca debounced no servidor (API externa) — não dá
    // pra virar useState lazy/useMemo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErro(null);
    setCarregando(true);
    const id = setTimeout(() => {
      fetch(
        `/api/ensalamento/consulta?eventoId=${encodeURIComponent(eventoId)}&busca=${encodeURIComponent(termo)}`,
      )
        .then((res) => res.json())
        .then((dados) => {
          if (cancelado) return;
          setAtivo(dados.ativo ?? false);
          setEventoNome(dados.eventoNome ?? "");
          setResultados(dados.resultados ?? []);
        })
        .catch(() => {
          if (!cancelado) setErro("Não foi possível buscar agora. Tente de novo.");
        })
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [eventoId, busca]);

  if (ativo === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fatec-navy-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-fatec-line bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-fatec-navy-900">Consulta indisponível</h1>
          <p className="mt-2 text-sm text-fatec-muted">
            Essa consulta não está disponível no momento.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-fatec-navy-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <p className="text-center text-xs font-bold uppercase tracking-[0.02em] text-fatec-sky-600">
          SIGMA · {eventoNome || "Ensalamento"}
        </p>
        <h1 className="mt-1 text-center text-xl font-bold text-fatec-navy-900">
          Onde é a minha apresentação?
        </h1>
        <p className="mt-2 text-center text-sm text-fatec-muted">
          Busque pelo seu nome ou pelo título do trabalho.
        </p>

        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
            strokeWidth={1.75}
          />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Seu nome ou o título do trabalho"
            className="w-full rounded-xl border border-fatec-line bg-white py-3 pl-10 pr-4 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </div>

        {erro && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {carregando && (
            <div className="flex items-center justify-center py-6 text-fatec-muted">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
            </div>
          )}

          {!carregando && busca.trim().length >= 2 && resultados.length === 0 && !erro && (
            <p className="rounded-xl border border-fatec-line bg-white px-4 py-6 text-center text-sm text-fatec-muted">
              Nenhum resultado pra &ldquo;{busca.trim()}&rdquo;. Confira a digitação ou fale com
              a secretaria.
            </p>
          )}

          {!carregando &&
            resultados.map((r, i) => (
              <div
                key={`${r.titulo}-${i}`}
                className="rounded-2xl border border-fatec-line bg-white p-5"
              >
                <p className="font-semibold text-fatec-navy-900">{r.titulo}</p>
                <p className="mt-1 text-sm text-fatec-muted">{r.autores}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fatec-navy-800">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-fatec-orange-500" strokeWidth={1.75} />
                    Sala {r.salaNome}
                  </span>
                  <span>{r.horario}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
