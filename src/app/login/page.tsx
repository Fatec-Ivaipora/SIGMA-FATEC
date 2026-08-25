"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ROTA_POR_PAPEL, type PerfilUsuario } from "@/lib/auth";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

function mensagemErro(erro: AuthError): string {
  switch (erro.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/invalid-email":
      return "Digite um e-mail válido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const credencial = await signInWithEmailAndPassword(auth, email, senha);
      const snap = await getDoc(doc(db, "usuarios", credencial.user.uid));

      if (!snap.exists()) {
        setErro(
          "Sua conta ainda não tem cadastro completo no sistema. Fale com a organização.",
        );
        setEnviando(false);
        return;
      }

      const perfil = snap.data() as PerfilUsuario;
      router.push(ROTA_POR_PAPEL[perfil.papel]);
    } catch (e) {
      setErro(mensagemErro(e as AuthError));
      setEnviando(false);
    }
  }

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

      <form onSubmit={entrar} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            E-mail
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        {erro && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {erro}
          </p>
        )}

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
          disabled={enviando}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
        >
          {enviando && (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          )}
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

      <Link
        href="/cadastro/aluno"
        className="flex items-center gap-3 rounded-xl border border-fatec-line px-4 py-3 text-sm font-semibold text-fatec-navy-900 transition-colors hover:border-fatec-sky-600 hover:bg-fatec-navy-50"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-fatec-navy-50 text-fatec-navy-800">
          <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
        </span>
        Cadastrar-se
      </Link>
      <p className="mt-3 text-center text-xs text-fatec-muted">
        Contas de avaliador são criadas pela organização.
      </p>
    </AuthSplitLayout>
  );
}
