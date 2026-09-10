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

        {/* Logo clicável (2026-09-10) — em vez de um cabeçalho de navegação
            cheio de links (que competia com o formulário e não fazia
            sentido numa tela de login, ex.: um botão "Acessar" na própria
            tela de acesso), a marca em si já é o caminho de volta — padrão
            comum em telas de login bem desenhadas (Stripe, Linear, etc.):
            discreto, sem disputar atenção com o formulário. */}
        <Link href="/" className="relative w-fit transition-opacity hover:opacity-90">
          <LogoLockup className="ml-1 h-24 w-auto" variant="branco" />
        </Link>

        <div className="relative flex flex-col gap-6">
          <p className="max-w-sm text-2xl font-semibold leading-snug text-white">
            {headline}
          </p>
          <div className="h-1 w-14 rounded-full bg-fatec-orange-500" />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/desenvolvido-por-fatec.jpg"
          alt="Desenvolvido por Fatec Ivaiporã"
          className="relative h-9 w-fit rounded-lg bg-white px-3 py-2"
        />
      </section>

      <section className="flex flex-1 flex-col justify-center bg-white px-6 py-16 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* No celular a logo do painel escuro fica escondida (md:hidden
              acima) — por isso aqui, além do "Voltar" contextual (volta um
              passo: no cadastro, pro login; no login, pra home), tem
              também uma logo pequena e clicável, mesmo padrão do painel
              desktop. Os dois agora aparecem em qualquer tamanho de tela
              (antes só existiam no celular). */}
          <div className="mb-8 flex items-center justify-between">
            {/* Virou "botão" de verdade (2026-09-10, "tá apagado, principalmente
                no PC") — antes era só texto cinza sem contorno, quase
                invisível num fundo branco. */}
            <Link
              href={backHref}
              className="flex w-fit items-center gap-1.5 rounded-full border border-fatec-line px-3.5 py-1.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:border-fatec-navy-200 hover:bg-fatec-navy-50"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Voltar
            </Link>
            <Link href="/" className="md:hidden">
              <LogoLockup className="h-9 w-auto" />
            </Link>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
