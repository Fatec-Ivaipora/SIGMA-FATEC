"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, ImageOff, Loader2, X } from "lucide-react";

type Foto = { nome: string; original: string; web: string; mini: string };

/** Galeria pública de fotos do evento (2026-11-12, pedido explícito do
 * usuário — fotos da X MAC que estão numa pasta do Google Drive). Sem login,
 * página solta igual a /consulta/{eventoId}. Grade de miniaturas; clicar abre
 * a foto grande (setas/teclado para navegar) com botão para baixar a
 * original. As fotos novas da pasta do Drive entram sozinhas (ver
 * GET /api/fotos/{eventoId}). */
export default function GaleriaFotosPage() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [eventoNome, setEventoNome] = useState("");
  const [logoEvento, setLogoEvento] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/fotos/${encodeURIComponent(eventoId)}`, { cache: "no-store" })
      .then(async (res) => {
        const corpo = (await res.json()) as {
          eventoNome?: string;
          logoEvento?: string | null;
          fotos?: Foto[];
          erro?: string;
        };
        if (cancelado) return;
        if (!res.ok) setErro(corpo.erro ?? "Não foi possível carregar as fotos.");
        setEventoNome(corpo.eventoNome ?? "");
        setLogoEvento(corpo.logoEvento ?? null);
        setFotos(corpo.fotos ?? []);
      })
      .catch(() => !cancelado && setErro("Não foi possível carregar as fotos."))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [eventoId]);

  const mover = useCallback(
    (passo: number) =>
      setAberta((i) => (i === null || fotos.length === 0 ? i : (i + passo + fotos.length) % fotos.length)),
    [fotos.length],
  );

  useEffect(() => {
    if (aberta === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberta, mover]);

  const atual = aberta !== null ? fotos[aberta] : null;

  return (
    <main className="min-h-screen bg-fatec-navy-50 px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        {/* Logos Fatec · evento · SIGMA (2026-11-12, pedido explícito do
            usuário — "tem que ter a logo do evento, do sistema SIGMA e da
            Fatec na página onde baixa as fotos"). */}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-5 shadow-sm sm:px-12 sm:py-7">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
          <img src="/certificados/logo-fatec-ivp.png" alt="Fatec Ivaiporã" className="h-12 w-auto sm:h-20" />
          {logoEvento && (
            // eslint-disable-next-line @next/next/no-img-element -- logo do evento (caminho/URL cadastrado)
            <img src={logoEvento} alt={eventoNome} className="h-16 w-auto sm:h-28" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
          <img src="/logo-sigma.png" alt="SIGMA" className="h-12 w-auto sm:h-20" />
        </div>
        <h1 className="mt-6 text-center text-xl font-bold text-fatec-navy-900 md:text-2xl">
          {eventoNome ? `Fotos — ${eventoNome}` : "Fotos do evento"}
        </h1>
        {fotos.length > 0 && (
          <p className="mt-2 text-center text-sm text-fatec-muted">
            {fotos.length} fotos · toque em uma foto para ampliar e baixar
          </p>
        )}

        {carregando && (
          <div className="flex items-center justify-center py-16 text-fatec-muted">
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} />
          </div>
        )}

        {!carregando && (erro || fotos.length === 0) && (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-12 text-center">
            <ImageOff className="h-8 w-8 text-fatec-muted" strokeWidth={1.5} />
            <p className="text-sm text-fatec-muted">{erro ?? "Ainda não há fotos deste evento."}</p>
          </div>
        )}

        {fotos.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {fotos.map((f, i) => (
              <button
                key={f.mini}
                type="button"
                onClick={() => setAberta(i)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-fatec-navy-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-fatec-orange-500"
                aria-label={`Ampliar foto ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada no Storage */}
                <img
                  src={f.mini}
                  alt={`Foto ${i + 1} — ${eventoNome}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {atual && aberta !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setAberta(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
            <span>
              {aberta + 1} / {fotos.length}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={atual.original}
                download={atual.nome}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Baixar original
              </a>
              <button
                type="button"
                onClick={() => setAberta(null)}
                className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2 pb-6">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(-1);
              }}
              className="absolute left-2 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 md:left-6"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- versão de tela já otimizada no Storage */}
            <img
              src={atual.web}
              alt={`Foto ${aberta + 1} — ${eventoNome}`}
              className="max-h-[82vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(1);
              }}
              className="absolute right-2 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 md:right-6"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
