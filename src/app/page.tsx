import Link from "next/link";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { LogoLockup } from "@/components/LogoLockup";
import { FlowCarousel } from "@/components/FlowCarousel";

const EVENTO_DESTAQUE = {
  nome: "MAC 2026",
  titulo: "MAC 2026 está com inscrições abertas",
  descricao:
    "Envie seu trabalho até 20 de outubro e participe da Mostra Acadêmica Científica da Fatec Ivaiporã.",
  imagemUrl: null as string | null,
};

export default function HomePage() {
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

      <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-24 pt-32 md:px-12 md:pb-32 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fatec-sky-600/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-start gap-8">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-6xl">
            Submeta, avalie e certifique trabalhos acadêmicos em um só lugar.
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-fatec-navy-50/90 md:text-xl">
            O sistema oficial da Fatec Ivaiporã para submissão de trabalhos:
            cadastro, aprovação do orientador, avaliação, correção com prazo e
            certificação — tudo rastreável, do início ao fim.
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

          <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CalendarDays
                className="mt-0.5 h-5 w-5 flex-none text-fatec-orange-400"
                strokeWidth={1.75}
              />
              <div>
                <dt className="text-sm font-semibold text-white">
                  Múltiplos eventos
                </dt>
                <dd className="text-sm text-fatec-navy-50/80">
                  Cada evento com seu próprio período de submissão e prazos.
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 flex-none text-fatec-orange-400"
                strokeWidth={1.75}
              />
              <div>
                <dt className="text-sm font-semibold text-white">
                  Fluxo com dois níveis de aprovação
                </dt>
                <dd className="text-sm text-fatec-navy-50/80">
                  Orientador e avaliador validam antes do aceite final.
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      {/* RF-29 / RN-11: evento em destaque, marcado manualmente pela organização.
          Some inteiramente da tela quando nenhum evento está marcado como destaque. */}
      {EVENTO_DESTAQUE && (
        <section className="bg-white px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl shadow-[0_30px_60px_-30px_rgba(14,58,94,0.4)]">
              {EVENTO_DESTAQUE.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={EVENTO_DESTAQUE.imagemUrl}
                  alt={EVENTO_DESTAQUE.nome}
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
                  {EVENTO_DESTAQUE.titulo}
                </h2>
                <p className="max-w-xl text-sm text-white/85 md:text-base">
                  {EVENTO_DESTAQUE.descricao}
                </p>
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
              Da inscrição à certificação, em cinco etapas.
            </h2>
          </div>

          <FlowCarousel />
        </div>
      </section>

      <footer className="border-t border-fatec-line bg-white px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 text-sm text-fatec-muted md:flex-row">
          <p>© {new Date().getFullYear()} FatecLab · Fatec Ivaiporã</p>
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
