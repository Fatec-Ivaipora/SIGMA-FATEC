import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoLockup } from "@/components/LogoLockup";

export function AuthSplitLayout({
  headline,
  backHref,
  children,
}: {
  headline: string;
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-fatec-navy-900 p-12 md:flex md:w-[42%] lg:w-[38%]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fatec-sky-600/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
        />

        <LogoLockup
          logoClassName="relative h-14 w-auto"
          wordmarkClassName="relative text-2xl"
        />

        <div className="relative flex flex-col gap-6">
          <p className="max-w-sm text-2xl font-semibold leading-snug text-white">
            {headline}
          </p>
          <div className="h-1 w-14 rounded-full bg-fatec-orange-500" />
        </div>

        <p className="relative text-sm text-fatec-navy-50/70">
          SIGMA Fatec · Sistema oficial de submissão da Fatec Ivaiporã
        </p>
      </section>

      <section className="flex flex-1 flex-col justify-center bg-white px-6 py-16 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href={backHref}
            className="mb-10 flex w-fit items-center gap-2 text-sm font-medium text-fatec-muted transition-colors hover:text-fatec-navy-800 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar
          </Link>

          <div className="mb-8 flex w-fit rounded-xl bg-fatec-navy-900 px-5 py-3.5 md:hidden">
            <LogoLockup
              logoClassName="h-9 w-auto"
              wordmarkClassName="text-base"
            />
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
