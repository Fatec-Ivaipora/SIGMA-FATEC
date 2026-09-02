"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type AuthError,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { KeyRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

function mensagemErro(erro: AuthError): string {
  switch (erro.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Senha temporária incorreta.";
    case "auth/weak-password":
      return "A nova senha precisa ter pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível trocar a senha. Tente novamente.";
  }
}

/** Bloqueia o app inteiro (sem botão de fechar, sem Esc) até a pessoa trocar
 * a senha temporária gerada pelo admin na criação da conta — sem isso, ela
 * loga uma vez com a senha que só o admin viu, nunca troca, e depois não
 * lembra mais como entrar (RF de contas criadas pelo admin, 2026-08-27). */
export function SenhaTemporariaGate() {
  const { user, perfil } = useAuth();

  const [senhaTemp, setSenhaTemp] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!user || !perfil?.senhaTemporaria) return null;

  async function trocarSenha() {
    setErro(null);
    if (!user!.email) return;

    if (novaSenha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (novaSenha === senhaTemp) {
      setErro("Escolha uma senha diferente da temporária.");
      return;
    }

    setEnviando(true);
    try {
      const credencial = EmailAuthProvider.credential(user!.email, senhaTemp);
      await reauthenticateWithCredential(user!, credencial);
      await updatePassword(user!, novaSenha);
      await updateDoc(doc(db, "usuarios", user!.uid), { senhaTemporaria: false });
    } catch (e) {
      setErro(mensagemErro(e as AuthError));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Defina sua senha" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-fatec-navy-950/70 backdrop-blur-sm" />

      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-fatec-line px-6 py-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
            <KeyRound className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Defina sua senha
            </h2>
            <p className="text-sm text-fatec-muted">
              Sua conta foi criada pela organização com uma senha temporária.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Senha temporária (a que você usou pra entrar)
            </span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={senhaTemp}
              onChange={(e) => setSenhaTemp(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nova senha
            </span>
            <input
              type="password"
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={confirmarNovaSenha}
              onChange={(e) => setConfirmarNovaSenha(e.target.value)}
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
            type="button"
            onClick={trocarSenha}
            disabled={
              enviando || !senhaTemp || !novaSenha || !confirmarNovaSenha
            }
            className="w-full rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {enviando ? "Salvando..." : "Definir senha e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
