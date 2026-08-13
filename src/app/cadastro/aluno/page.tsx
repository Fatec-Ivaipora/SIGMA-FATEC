import Link from "next/link";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function CadastroAlunoPage() {
  return (
    <AuthSplitLayout
      backHref="/login"
      headline="Envie seu trabalho, acompanhe a aprovação do orientador e a avaliação — tudo em um só lugar."
    >
      <h1 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
        Criar conta de aluno
      </h1>
      <p className="mt-1.5 text-sm text-fatec-muted">
        Use seu e-mail institucional para se cadastrar.
      </p>

      <form className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome completo
          </span>
          <input
            type="text"
            name="nome"
            autoComplete="name"
            placeholder="Seu nome completo"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            E-mail
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@aluno.fatecivaipora.com.br"
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
            autoComplete="new-password"
            placeholder="••••••••"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Confirmar senha
          </span>
          <input
            type="password"
            name="passwordConfirm"
            autoComplete="new-password"
            placeholder="••••••••"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <button
          type="submit"
          className="mt-1 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
        >
          Criar conta
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-fatec-muted">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
        >
          Entrar
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
