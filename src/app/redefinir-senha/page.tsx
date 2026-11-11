"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

/** Lê ?token=... da URL que /api/auth/recuperar-senha gerou — precisa de
 * useSearchParams, por isso o Suspense no componente de baixo (exigência
 * do Next.js). Token próprio nosso, não mais oobCode do Firebase (2026-11-
 * 11, ver comentário completo em
 * src/app/api/auth/recuperar-senha/route.ts — gerar um segundo link
 * invalidava o primeiro na hora, sem ter nada a ver com expiração por
 * tempo). */
function RedefinirSenhaForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [estado, setEstado] = useState<
    | { status: "verificando" }
    | { status: "invalido"; mensagem: string }
    | { status: "pronto"; email: string }
    | { status: "sucesso" }
  >({ status: "verificando" });
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      Promise.resolve().then(() =>
        setEstado({ status: "invalido", mensagem: "Link inválido." }),
      );
      return;
    }
    fetch(`/api/auth/redefinir-senha?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) {
          setEstado({ status: "invalido", mensagem: corpo.erro ?? "Link inválido." });
          return;
        }
        setEstado({ status: "pronto", email: corpo.email });
      })
      .catch(() =>
        setEstado({ status: "invalido", mensagem: "Falha de conexão — tente de novo." }),
      );
  }, [token]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!token) return;

    setSalvando(true);
    try {
      const r = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha }),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível salvar a nova senha. Tente novamente.");
        return;
      }
      setEstado({ status: "sucesso" });
    } catch {
      setErro("Falha de conexão — tente de novo.");
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
              {estado.mensagem} Pede um novo abaixo.
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
