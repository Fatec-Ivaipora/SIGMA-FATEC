"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Check } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import {
  diasDoIntervalo,
  salvarMinhaDisponibilidade,
  useMinhaDisponibilidade,
} from "@/lib/data/bancas";

const CAPACIDADE_PADRAO = 2;

/** Autoatendimento de disponibilidade pra banca de TCC (2026-11-16, pedido
 * explícito do usuário) — cada avaliador/orientador/moderador vinculado a
 * um evento de TCC marca em que dias, dentro da janela do evento
 * (dataRealizacao..dataRealizacaoFim), pode fazer parte de uma banca, e
 * quantas no máximo nesse dia. Sem precedente de UI no app pra isso (não
 * existe nenhum "calendário de disponibilidade" hoje) — modelado no mesmo
 * padrão de chip-toggle já usado pras salas/dias de presença em
 * /ensalamento, só que por pessoa, não por evento inteiro. */
export default function BancaDisponibilidadePage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador", "orientador"]);
  const { eventos } = useEventos(perfil);

  const eventosTCC = useMemo(() => eventos.filter((e) => e.tipo === "tcc"), [eventos]);
  const [eventoId, setEventoId] = useState("");
  // Ajuste de estado durante a renderização (padrão já usado em
  // eventos/page.tsx) em vez de useEffect — auto-seleciona o único/primeiro
  // evento de TCC assim que a lista chega, sem precisar sincronizar com
  // nada externo.
  if (!eventoId && eventosTCC.length > 0) {
    setEventoId(eventosTCC[0].id);
  }

  const evento = eventosTCC.find((e) => e.id === eventoId);
  const dias = useMemo(
    () => (evento ? diasDoIntervalo(evento.dataRealizacao ?? "", evento.dataRealizacaoFim ?? "") : []),
    [evento],
  );

  const { disponibilidade } = useMinhaDisponibilidade(eventoId || undefined, user?.uid);
  const [capacidadePorDia, setCapacidadePorDia] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Prefill a partir do que já foi salvo, uma vez só por evento (mesmo
  // padrão de ajuste durante a renderização acima) — dispara assim que o
  // snapshot do Firestore chega com dado de verdade pra esse eventoId, sem
  // sobrescrever o que a pessoa já está editando depois disso.
  const [eventoIdCarregado, setEventoIdCarregado] = useState<string | null>(null);
  if (disponibilidade && eventoId !== eventoIdCarregado) {
    setEventoIdCarregado(eventoId);
    setCapacidadePorDia(disponibilidade.dias);
  }

  function alternarDia(dia: string) {
    setSalvo(false);
    setCapacidadePorDia((prev) => {
      const novo = { ...prev };
      if (dia in novo) delete novo[dia];
      else novo[dia] = CAPACIDADE_PADRAO;
      return novo;
    });
  }

  function mudarCapacidade(dia: string, valor: string) {
    setSalvo(false);
    const numero = Math.max(0, Math.floor(Number(valor) || 0));
    setCapacidadePorDia((prev) => ({ ...prev, [dia]: numero }));
  }

  async function salvar() {
    if (!user || !perfil || !eventoId) return;
    setSalvando(true);
    try {
      await salvarMinhaDisponibilidade({
        eventoId,
        uid: user.uid,
        nome: perfil.nome,
        dias: capacidadePorDia,
      });
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/banca"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Banca de TCC
            </h1>
            <p className="text-sm text-fatec-muted">
              Marque os dias em que você pode fazer parte de uma banca de
              defesa.
            </p>
          </div>

          {eventosTCC.length > 1 && (
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 md:w-64"
            >
              {eventosTCC.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome}
                </option>
              ))}
            </select>
          )}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {eventosTCC.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Você ainda não foi vinculado a nenhum evento de TCC.
            </p>
          ) : !evento?.dataRealizacao ? (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              A organização ainda não definiu a janela de dias das bancas
              desse evento.
            </p>
          ) : (
            <div className="flex max-w-2xl flex-col gap-5">
              <p className="text-sm text-fatec-muted">
                Pra cada dia marcado, diga quantas bancas no máximo você
                topa participar naquele dia (o orientador também entra
                nessa conta — ele sempre faz parte da banca do próprio
                orientando).
              </p>

              <div className="flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line bg-white">
                {dias.map((dia) => {
                  const marcado = dia in capacidadePorDia;
                  return (
                    <div key={dia} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => alternarDia(dia)}
                        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border transition-colors ${
                          marcado
                            ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                            : "border-fatec-line bg-white"
                        }`}
                        aria-pressed={marcado}
                      >
                        {marcado && <Check className="h-4 w-4" strokeWidth={2.5} />}
                      </button>
                      <span className="flex-1 text-sm font-medium text-fatec-navy-900">
                        {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                      </span>
                      {marcado && (
                        <label className="flex items-center gap-2 text-xs text-fatec-muted">
                          Máx. de bancas
                          <input
                            type="number"
                            min={0}
                            value={capacidadePorDia[dia]}
                            onChange={(e) => mudarCapacidade(dia, e.target.value)}
                            className="w-16 rounded-lg border border-fatec-line bg-white px-2 py-1 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvando}
                  className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                >
                  <CalendarCheck className="h-4 w-4" strokeWidth={1.75} />
                  {salvando ? "Salvando..." : "Salvar disponibilidade"}
                </button>
                {salvo && (
                  <span className="text-sm font-medium text-emerald-700">Salvo.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
