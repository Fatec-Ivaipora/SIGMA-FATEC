"use client";

import { useState } from "react";
import { sendPasswordResetEmail, type AuthError } from "firebase/auth";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { auth } from "@/lib/firebase";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

function mensagemErro(erro: AuthError): string {
  switch (erro.code) {
    case "auth/invalid-email":
      return "Digite um e-mail válido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível enviar o e-mail agora. Tente novamente.";
  }
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      // url aqui (2026-09-10) — sem isso, o link do e-mail levaria pra tela
      // genérica hospedada pelo próprio Firebase (sem a cara do SIGMA);
      // com isso, o Firebase já redireciona pra nossa página com
      // ?mode=resetPassword&oobCode=... na URL, sem precisar mexer em nada
      // no Console. window.location.origin (não uma URL fixa) pra funcionar
      // certinho tanto em produção quanto testando local.
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/redefinir-senha`,
      });
      setEnviado(true);
    } catch (e) {
      const erroAuth = e as AuthError;
      // auth/user-not-found vira a MESMA tela de sucesso (2026-09-10) — nunca
      // confirma pro visitante se um e-mail existe ou não na base (evita
      // alguém usar essa tela pra descobrir quem tem conta no sistema).
      // Só erros de verdade (e-mail mal formatado, rate limit) mostram algo
      // diferente.
      if (erroAuth.code === "auth/user-not-found") {
        setEnviado(true);
      } else {
        setErro(mensagemErro(erroAuth));
      }
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
