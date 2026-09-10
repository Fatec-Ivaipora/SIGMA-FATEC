"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
  type AuthError,
} from "firebase/auth";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

function mensagemErroSalvar(erro: AuthError): string {
  switch (erro.code) {
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "Esse link expirou ou já foi usado. Peça um novo.";
    default:
      return "Não foi possível salvar a nova senha. Tente novamente.";
  }
}

/** Lê ?mode=resetPassword&oobCode=... da URL que o Firebase gerou (ver
 * actionCodeSettings.url em /recuperar-senha) — precisa de useSearchParams,
 * por isso o Suspense no componente de baixo (exigência do Next.js). */
function RedefinirSenhaForm() {
  const router = useRouter();
  const oobCode = useSearchParams().get("oobCode");

  const [estado, setEstado] = useState<
    | { status: "verificando" }
    | { status: "invalido" }
    | { status: "pronto"; email: string }
    | { status: "sucesso" }
  >({ status: "verificando" });
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      Promise.resolve().then(() => setEstado({ status: "invalido" }));
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => setEstado({ status: "pronto", email }))
      .catch(() => setEstado({ status: "invalido" }));
  }, [oobCode]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!oobCode) return;

    setSalvando(true);
    try {
      await confirmPasswordReset(auth, oobCode, novaSenha);
      setEstado({ status: "sucesso" });
    } catch (e) {
      setErro(mensagemErroSalvar(e as AuthError));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AuthSplitLayout
      backHref="/login"
      headline="Quase lá — só falta criar uma senha nova."
    >
      {estado.status === "verificando" && (
        <div className="flex items-center gap-2 text-sm text-fatec-muted">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          Conferindo o link...
        </div>
      )}

      {estado.status === "invalido" && (
        <div className="flex flex-col items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <XCircle className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Link inválido ou expirado
            </h1>
            <p className="mt-1.5 text-sm text-fatec-muted">
              Esse link de recuperação não é mais válido — pode já ter sido
              usado, ou o prazo passou. Pede um novo abaixo.
            </p>
          </div>
          <Link
            href="/recuperar-senha"
            className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            Pedir novo link
          </Link>
        </div>
      )}

      {estado.status === "pronto" && (
        <>
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Criar senha nova
          </h1>
          <p className="mt-1.5 text-sm text-fatec-muted">
            Pra <strong className="text-fatec-ink">{estado.email}</strong>.
          </p>

          <form onSubmit={salvar} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Nova senha
              </span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                autoFocus
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Confirmar nova senha
              </span>
              <input
                type="password"
                name="passwordConfirm"
                autoComplete="new-password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>

            {erro && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
              Salvar nova senha
            </button>
          </form>
        </>
      )}

      {estado.status === "sucesso" && (
        <div className="flex flex-col items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Senha alterada
            </h1>
            <p className="mt-1.5 text-sm text-fatec-muted">
              Sua senha foi redefinida. Já pode entrar com ela.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            Ir pro login
          </button>
        </div>
      )}
    </AuthSplitLayout>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
