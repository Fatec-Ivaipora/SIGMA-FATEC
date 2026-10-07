"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    // Rota própria (2026-10-07) — antes era sendPasswordResetEmail direto
    // do client, que manda o e-mail pelo próprio servidor do Firebase
    // (achado real: e-mail não chegava, provável filtro de spam/entrega).
    // Agora o servidor gera o link e manda pelo mesmo canal confiável de
    // todo outro e-mail do sistema (ver /api/auth/recuperar-senha). Essa
    // rota SEMPRE responde ok, mesmo pra e-mail que não existe — nunca
    // confirma pro visitante se uma conta existe (mesmo critério de
    // privacidade de antes).
    try {
      const res = await fetch("/api/auth/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao enviar.");
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar o e-mail agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthSplitLayout
      backHref="/login"
      headline="Vamos te ajudar a voltar pra sua conta."
    >
      {enviado ? (
        <div className="flex flex-col items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Confira seu e-mail
            </h1>
            <p className="mt-1.5 text-sm text-fatec-muted">
              Se <strong className="text-fatec-ink">{email}</strong> estiver
              cadastrado no SIGMA, você vai receber um link pra redefinir sua
              senha em alguns minutos. Não esqueça de olhar a caixa de spam.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Esqueci minha senha
          </h1>
          <p className="mt-1.5 text-sm text-fatec-muted">
            Sem problemas — digite seu e-mail e te ajudamos a voltar pra sua
            conta.
          </p>

          <form onSubmit={enviar} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                E-mail
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
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
              disabled={enviando}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Mail className="h-4 w-4" strokeWidth={2} />
              )}
              Enviar link de recuperação
            </button>
          </form>
        </>
      )}
    </AuthSplitLayout>
  );
}
