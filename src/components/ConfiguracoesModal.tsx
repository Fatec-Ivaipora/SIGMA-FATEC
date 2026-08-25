"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type AuthError,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/Modal";

function mensagemErroSenha(erro: AuthError): string {
  switch (erro.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Senha atual incorreta.";
    case "auth/weak-password":
      return "A nova senha precisa ter pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível alterar a senha. Tente novamente.";
  }
}

function ConfiguracoesForm({
  uid,
  nomeAtual,
}: {
  uid: string | undefined;
  nomeAtual: string;
}) {
  const [novoNome, setNovoNome] = useState(nomeAtual);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [nomeSalvo, setNomeSalvo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [enviandoSenha, setEnviandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaAlterada, setSenhaAlterada] = useState(false);

  async function salvarNome() {
    setErroNome(null);
    setNomeSalvo(false);
    const nome = novoNome.trim();
    if (!uid || !nome) return;

    setSalvandoNome(true);
    try {
      await updateDoc(doc(db, "usuarios", uid), { nome });
      setNomeSalvo(true);
    } catch {
      setErroNome("Não foi possível salvar o nome. Tente novamente.");
    } finally {
      setSalvandoNome(false);
    }
  }

  async function salvarSenha() {
    setErroSenha(null);
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (novaSenha !== confirmarNovaSenha) {
      setErroSenha("As senhas não coincidem.");
      return;
    }

    setEnviandoSenha(true);
    try {
      const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, credencial);
      await updatePassword(user, novaSenha);
      setSenhaAlterada(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
    } catch (e) {
      setErroSenha(mensagemErroSenha(e as AuthError));
    } finally {
      setEnviandoSenha(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-fatec-navy-900">Nome</h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome de exibição
          </span>
          <input
            type="text"
            value={novoNome}
            onChange={(e) => {
              setNovoNome(e.target.value);
              setNomeSalvo(false);
            }}
            placeholder="Seu nome"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        {erroNome && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {erroNome}
          </p>
        )}
        {nomeSalvo && (
          <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            Nome atualizado com sucesso.
          </p>
        )}

        <button
          type="button"
          onClick={salvarNome}
          disabled={
            salvandoNome || !novoNome.trim() || novoNome.trim() === nomeAtual
          }
          className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
        >
          {salvandoNome ? "Salvando..." : "Salvar nome"}
        </button>
      </section>

      <section className="flex flex-col gap-4 border-t border-fatec-line pt-6">
        <h3 className="text-sm font-semibold text-fatec-navy-900">Senha</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Senha atual
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
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

        {erroSenha && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {erroSenha}
          </p>
        )}
        {senhaAlterada && (
          <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            Senha alterada com sucesso.
          </p>
        )}

        <button
          type="button"
          onClick={salvarSenha}
          disabled={
            enviandoSenha || !senhaAtual || !novaSenha || !confirmarNovaSenha
          }
          className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
        >
          {enviandoSenha ? "Salvando..." : "Salvar nova senha"}
        </button>
      </section>
    </div>
  );
}

export function ConfiguracoesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, perfil } = useAuth();

  return (
    <Modal open={open} onClose={onClose} title="Configurações">
      <ConfiguracoesForm uid={user?.uid} nomeAtual={perfil?.nome ?? ""} />
    </Modal>
  );
}
