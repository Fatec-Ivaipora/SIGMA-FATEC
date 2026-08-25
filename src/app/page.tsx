"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LogoLockup } from "@/components/LogoLockup";
import { FlowCarousel } from "@/components/FlowCarousel";

const ENDERECO_FATEC =
  "FATEC IVAIPORÃ, 86870-000, AVENIDA BRASIL, CENTRO, Ivaiporã, Paraná";
const MAPA_EMBED_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(
  ENDERECO_FATEC,
)}&z=16&output=embed`;

type EventoDestaque = {
  id: string;
  nome: string;
  periodoSubmissao?: string;
  imagemDestaqueUrl?: string | null;
};

export default function HomePage() {
  const [eventoDestaque, setEventoDestaque] = useState<EventoDestaque | null>(
    null,
  );

  useEffect(() => {
    const q = query(
      collection(db, "eventos"),
      where("destaque", "==", true),
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      setEventoDestaque(
        snap.empty
          ? null
          : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as EventoDestaque),
      );
    });
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <LogoLockup
          logoClassName="h-12 w-auto md:h-16"
          wordmarkClassName="text-xl md:text-2xl"
        />
        <Link
          href="/login"
          className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Entrar
        </Link>
      </header>

      <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-20 pt-28 md:px-12 md:pb-24 md:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fatec-sky-600/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-6">
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white md:text-5xl">
            Cadastre seu trabalho acadêmico
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-fatec-navy-50/90 md:text-lg">
            Envie, acompanhe a avaliação e receba o certificado do seu
            trabalho na Fatec Ivaiporã.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-fatec-orange-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-fatec-orange-500/25 transition-transform hover:-translate-y-0.5 hover:bg-fatec-orange-600"
            >
              Entrar no sistema
              <ArrowRight
                className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
            <a
              href="#como-funciona"
              className="text-base font-semibold text-fatec-navy-50 underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
            >
              Ver como funciona
            </a>
          </div>
        </div>
      </section>

      {/* RF-29 / RN-11: evento em destaque, marcado manualmente pela organização.
          Some inteiramente da tela quando nenhum evento está marcado como destaque.
          Puxado para cima com margem negativa sobre o hero para ganhar evidência. */}
      {eventoDestaque && (
        <section className="relative bg-white px-6 pb-16 pt-0 md:px-12 md:pb-20">
          <div className="mx-auto -mt-10 max-w-4xl md:-mt-14">
            <div className="relative overflow-hidden rounded-3xl shadow-[0_30px_60px_-30px_rgba(14,58,94,0.4)]">
              {eventoDestaque.imagemDestaqueUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={eventoDestaque.imagemDestaqueUrl}
                  alt={eventoDestaque.nome}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-br from-fatec-navy-700 via-fatec-navy-900 to-fatec-sky-600"
                >
                  <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-fatec-orange-500/20 blur-3xl" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

              <div className="relative flex min-h-[280px] flex-col items-start justify-end gap-3 p-6 md:min-h-[340px] md:p-10">
                <h2 className="max-w-xl text-2xl font-bold leading-tight text-white md:text-3xl">
                  {eventoDestaque.nome} está com inscrições abertas
                </h2>
                {eventoDestaque.periodoSubmissao && (
                  <p className="max-w-xl text-sm text-white/85 md:text-base">
                    Inscrições: {eventoDestaque.periodoSubmissao}
                  </p>
                )}
                <Link
                  href="/login"
                  className="group mt-2 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-fatec-navy-900 transition-transform hover:-translate-y-0.5"
                >
                    Inscreva-se
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </Link>
                </div>
            </div>
          </div>
        </section>
      )}


      <section
        id="como-funciona"
        className="flex-1 bg-fatec-navy-50 px-6 py-20 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Como funciona
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-fatec-navy-900 md:text-4xl">
              Da inscrição à certificação, em quatro etapas.
            </h2>
          </div>

          <FlowCarousel />
        </div>
      </section>

      <section className="bg-white px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 md:grid-cols-2 md:divide-x md:divide-fatec-line md:gap-0">
          <div className="flex flex-col gap-3 md:pr-10">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Local
            </span>
            <h2 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Fatec Ivaiporã
            </h2>
            <p className="text-sm leading-relaxed text-fatec-muted">
              {ENDERECO_FATEC}
            </p>
          </div>

          <div className="md:pl-10">
            <iframe
              title="Mapa até a Fatec Ivaiporã"
              src={MAPA_EMBED_SRC}
              loading="lazy"
              className="h-64 w-full rounded-2xl border border-fatec-line md:h-full"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-fatec-line bg-white px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 text-sm text-fatec-muted md:flex-row">
          <p>© {new Date().getFullYear()} SIGMA Fatec · Fatec Ivaiporã</p>
          <a
            href="https://fatecivaipora.com.br/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-fatec-navy-800 hover:text-fatec-sky-600"
          >
            fatecivaipora.com.br
          </a>
        </div>
      </footer>
    </main>
  );
}
