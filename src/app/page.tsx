"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Logo } from "@/components/Logo";
import { FlowCarousel } from "@/components/FlowCarousel";
import { SiteHeader } from "@/components/SiteHeader";

const CONTATOS = {
  instagram: "https://www.instagram.com/fatec.ivaipora/",
  instagramLabel: "@fatec.ivaipora",
  email: "secretariageral@fatecivaipora.com.br",
  telefoneSecretaria: { label: "(43) 99848-0053", href: "tel:+5543998480053", nota: "Secretaria" },
  telefoneVestibular: { label: "(43) 99660-0220", href: "tel:+5543996600220", nota: "Vestibular" },
};

const ENDERECO_FATEC =
  "FATEC IVAIPORÃ, 86870-000, AVENIDA BRASIL, CENTRO, Ivaiporã, Paraná";
const MAPA_EMBED_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(
  ENDERECO_FATEC,
)}&z=16&output=embed`;

type EventoDestaque = {
  id: string;
  nome: string;
  descricao?: string;
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
      <SiteHeader mostrarEvento={!!eventoDestaque} />

      <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-20 pt-16 md:px-12 md:pb-24 md:pt-20">
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
          Full-bleed (2026-09-03, antes era um card com margem/rounded) — a
          foto ocupa a seção inteira, de ponta a ponta; a descrição sai de
          cima da imagem e vira uma seção de texto própria logo abaixo. */}
      {eventoDestaque && (
        <>
          <section id="evento-destaque" className="relative scroll-mt-20">
            <div className="group relative w-full overflow-hidden">
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
                  className="absolute inset-0 bg-gradient-to-br from-fatec-navy-700 via-fatec-navy-900 to-fatec-sky-700"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, white 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl transition-opacity duration-300 group-hover:opacity-90" />
                  <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-fatec-orange-500/20 blur-3xl transition-opacity duration-300 group-hover:opacity-90" />
                </div>
              )}

              {/* Banner full-bleed puramente visual (2026-09-03) — sem nenhum
                  texto/botão em cima da foto; nome/período/descrição/CTA
                  ficam todos na seção "Sobre o evento" logo abaixo. Essa div
                  só existe pra dar altura ao container (a imagem é
                  absolute inset-0 por cima dela). aspect-[12/5] (2026-09-09,
                  achado: banner cortando embaixo/pixelado) — antes era altura
                  fixa (min-h) independente da largura da tela; como a seção é
                  full-bleed (w-full), em tela larga a proporção real ficava
                  bem mais "achatada" que os 12:5 do BannerCropModal, cortando
                  mais imagem do que o admin viu ao enquadrar. Agora a altura
                  sempre acompanha a mesma proporção do recorte — min-h só
                  como piso pra celular estreito não ficar baixo demais. */}
              <div className="aspect-[12/5] min-h-[220px]" />
            </div>
          </section>

          <section className="bg-white px-6 py-16 md:px-12 md:py-20">
            <div className="mx-auto max-w-6xl">
              <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
                Sobre o evento
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900 md:text-3xl">
                {eventoDestaque.nome}
              </h3>
              {eventoDestaque.periodoSubmissao && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-fatec-muted">
                  <CalendarDays className="h-4 w-4 flex-none" strokeWidth={2} />
                  Inscrições: {eventoDestaque.periodoSubmissao}
                </p>
              )}
              {eventoDestaque.descricao && (
                <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-fatec-muted">
                  {eventoDestaque.descricao}
                </p>
              )}
              <Link
                href="/login"
                className="group/btn mt-8 inline-flex items-center gap-2 rounded-full bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-transform hover:-translate-y-0.5 hover:bg-fatec-orange-600"
              >
                Inscreva-se
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
            </div>
          </section>
        </>
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
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-0 md:divide-x md:divide-fatec-line">
          <div className="flex flex-col gap-3 md:pr-10">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Local
            </span>
            <h2 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Fatec Ivaiporã
            </h2>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-fatec-muted">
              <MapPin className="mt-0.5 h-4 w-4 flex-none text-fatec-navy-800" strokeWidth={1.75} />
              {ENDERECO_FATEC}
            </p>
          </div>

          <div className="md:pl-10">
            <iframe
              title="Mapa até a Fatec Ivaiporã"
              src={MAPA_EMBED_SRC}
              loading="lazy"
              className="h-80 w-full rounded-2xl border border-fatec-line md:h-[420px]"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-fatec-line bg-fatec-navy-900 px-6 py-14 md:px-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Logo className="h-10 w-auto" />
              <p className="max-w-xs text-sm leading-relaxed text-fatec-navy-50/70">
                Faculdade de Tecnologia do Vale do Ivaí — cursos superiores de
                tecnologia gratuitos e presenciais em Ivaiporã.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[-0.01em] text-fatec-navy-50/50">
                Contato
              </h3>
              <a
                href={`mailto:${CONTATOS.email}`}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.email}
              </a>
              <a
                href={CONTATOS.telefoneSecretaria.href}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.telefoneSecretaria.label}
                <span className="text-fatec-navy-50/50">
                  · {CONTATOS.telefoneSecretaria.nota}
                </span>
              </a>
              <a
                href={CONTATOS.telefoneVestibular.href}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.telefoneVestibular.label}
                <span className="text-fatec-navy-50/50">
                  · {CONTATOS.telefoneVestibular.nota}
                </span>
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[-0.01em] text-fatec-navy-50/50">
                Acompanhe
              </h3>
              <a
                href={CONTATOS.instagram}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <InstagramIcon className="h-4 w-4 flex-none" />
                {CONTATOS.instagramLabel}
              </a>
              <a
                href="https://fatecivaipora.com.br/"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                fatecivaipora.com.br
              </a>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/desenvolvido-por-fatec.jpg"
              alt="Desenvolvido por Fatec Ivaiporã"
              className="h-12 w-fit rounded-lg bg-white px-4 py-2.5"
            />
            <p className="text-xs text-fatec-navy-50/50">
              © {new Date().getFullYear()} SIGMA Fatec · Fatec Ivaiporã
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
