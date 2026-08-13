import Link from "next/link";
import { GraduationCap, ClipboardCheck } from "lucide-react";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function LoginPage() {
  return (
    <AuthSplitLayout
      backHref="/"
      headline="Acompanhe cada etapa da submissão do seu trabalho acadêmico, do envio ao certificado."
    >
      <h1 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
        Entrar
      </h1>
      <p className="mt-1.5 text-sm text-fatec-muted">
        Use o e-mail e senha da sua conta no sistema.
      </p>

      <form className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            E-mail
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@email.com"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Senha
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <div className="flex justify-end">
          <a
            href="#"
            className="text-sm font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
          >
            Esqueci minha senha
          </a>
        </div>

        <button
          type="submit"
          className="mt-1 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
        >
          Entrar
        </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-fatec-line" />
        <span className="text-xs font-medium uppercase tracking-[-0.01em] text-fatec-muted">
          Ainda não tem conta?
        </span>
        <div className="h-px flex-1 bg-fatec-line" />
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/cadastro/aluno"
          className="flex items-center gap-3 rounded-xl border border-fatec-line px-4 py-3 text-sm font-semibold text-fatec-navy-900 transition-colors hover:border-fatec-sky-600 hover:bg-fatec-navy-50"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fatec-navy-50 text-fatec-navy-800">
            <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
          </span>
          Cadastrar-se como aluno
        </Link>
        <Link
          href="/cadastro/avaliador"
          className="flex items-center gap-3 rounded-xl border border-fatec-line px-4 py-3 text-sm font-semibold text-fatec-navy-900 transition-colors hover:border-fatec-sky-600 hover:bg-fatec-navy-50"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fatec-navy-50 text-fatec-navy-800">
            <ClipboardCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          Cadastrar-se como avaliador
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
