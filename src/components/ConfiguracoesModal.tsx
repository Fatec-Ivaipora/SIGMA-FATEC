"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type AuthError,
} from "firebase/auth";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { ChevronDown, Pencil } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/Modal";
import { formatarCPF, validarCPF } from "@/lib/cpf";

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
  email,
  papel,
  vinculoFatec,
  ra,
  curso,
  cpfAtual,
  dataNascimentoAtual,
}: {
  uid: string | undefined;
  nomeAtual: string;
  email: string;
  papel: string | undefined;
  vinculoFatec: boolean | undefined;
  ra: string | undefined;
  curso: string | undefined;
  cpfAtual: string | undefined;
  dataNascimentoAtual: string | undefined;
}) {
  const ehAlunoFatec = papel === "aluno" && vinculoFatec !== false;
  const ehAluno = papel === "aluno";

  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState(nomeAtual);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);

  // CPF/data de nascimento (2026-09-03) — exigidos pelo lançamento no
  // Edubox (MEC); contas criadas antes disso não têm preenchido, esse
  // bloco existe justamente pra deixar completar depois. Sempre editável
  // (sem toggle como o nome), já que é um dado que só falta uma vez.
  const [cpf, setCpf] = useState(cpfAtual ? formatarCPF(cpfAtual) : "");
  const [dataNascimento, setDataNascimento] = useState(dataNascimentoAtual ?? "");
  const [salvandoDadosEdubox, setSalvandoDadosEdubox] = useState(false);
  const [erroDadosEdubox, setErroDadosEdubox] = useState<string | null>(null);
  const [dadosEduboxSalvos, setDadosEduboxSalvos] = useState(false);

  async function salvarDadosEdubox() {
    setErroDadosEdubox(null);
    setDadosEduboxSalvos(false);
    if (!uid) return;
    if (!validarCPF(cpf)) {
      setErroDadosEdubox("Digite um CPF válido.");
      return;
    }
    if (!dataNascimento) {
      setErroDadosEdubox("Informe sua data de nascimento.");
      return;
    }
    setSalvandoDadosEdubox(true);
    try {
      await updateDoc(doc(db, "usuarios", uid), {
        cpf: cpf.replace(/\D/g, ""),
        dataNascimento,
      });
      setDadosEduboxSalvos(true);
    } catch {
      setErroDadosEdubox("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvandoDadosEdubox(false);
    }
  }

  const [senhaExpandida, setSenhaExpandida] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [enviandoSenha, setEnviandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaAlterada, setSenhaAlterada] = useState(false);

  function abrirEdicaoNome() {
    setNovoNome(nomeAtual);
    setErroNome(null);
    setEditandoNome(true);
  }

  async function salvarNome() {
    setErroNome(null);
    const nome = novoNome.trim();
    if (!uid || !nome) return;

    setSalvandoNome(true);
    try {
      // Espelho público (2026-09-08, ver firestore.rules) — só existe pra
      // "aluno" (ver cadastro/aluno e /api/usuarios), por isso só entra no
      // batch quando ehAluno; escrever nele pra quem não tem doc lá criaria
      // um doc órfão sem os outros campos (email/vinculoFatec).
      if (ehAluno) {
        const batch = writeBatch(db);
        batch.update(doc(db, "usuarios", uid), { nome });
        batch.update(doc(db, "usuariosPublicos", uid), { nome });
        await batch.commit();
      } else {
        await updateDoc(doc(db, "usuarios", uid), { nome });
      }
      setEditandoNome(false);
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
        <h3 className="text-sm font-semibold text-fatec-navy-900">Seus dados</h3>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
            Nome
          </span>
          {editandoNome ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Seu nome"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
              {erroNome && (
                <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {erroNome}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={salvarNome}
                  disabled={salvandoNome || !novoNome.trim()}
                  className="rounded-xl bg-fatec-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                >
                  {salvandoNome ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoNome(false)}
                  disabled={salvandoNome}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-fatec-muted transition-colors hover:bg-fatec-navy-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-fatec-navy-900">
                {nomeAtual}
              </span>
              <button
                type="button"
                onClick={abrirEdicaoNome}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-fatec-sky-600 transition-colors hover:bg-fatec-sky-100"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                Alterar
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-fatec-line pt-4">
          <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
            E-mail
          </span>
          <span className="text-sm font-medium text-fatec-navy-900">
            {email}
          </span>
        </div>

        {ehAlunoFatec && (
          <div className="grid grid-cols-2 gap-4 border-t border-fatec-line pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
                RA
              </span>
              <span className="text-sm font-medium text-fatec-navy-900">
                {ra || "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
                Curso
              </span>
              <span className="text-sm font-medium text-fatec-navy-900">
                {curso || "—"}
              </span>
            </div>
          </div>
        )}
      </section>

      {ehAluno && (
        <section className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-fatec-navy-900">
              CPF e data de nascimento
            </h3>
            <p className="mt-0.5 text-xs text-fatec-muted">
              Exigidos pra emitir seu certificado de participação nos eventos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
                CPF
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatarCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-fatec-muted">
                Data de nascimento
              </span>
              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>

          {erroDadosEdubox && (
            <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {erroDadosEdubox}
            </p>
          )}
          {dadosEduboxSalvos && (
            <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
              Salvo com sucesso.
            </p>
          )}

          <button
            type="button"
            onClick={salvarDadosEdubox}
            disabled={salvandoDadosEdubox}
            className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {salvandoDadosEdubox ? "Salvando..." : "Salvar"}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-fatec-line bg-white">
        <button
          type="button"
          onClick={() => setSenhaExpandida((v) => !v)}
          aria-expanded={senhaExpandida}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-fatec-navy-900">
            Alterar senha
          </span>
          <ChevronDown
            className={`h-4 w-4 text-fatec-muted transition-transform ${senhaExpandida ? "rotate-180" : ""}`}
            strokeWidth={1.75}
          />
        </button>

        {senhaExpandida && (
          <div className="flex flex-col gap-4 border-t border-fatec-line px-5 py-5">
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
          </div>
        )}
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
      <ConfiguracoesForm
        uid={user?.uid}
        nomeAtual={perfil?.nome ?? ""}
        email={perfil?.email ?? ""}
        papel={perfil?.papel}
        vinculoFatec={perfil?.vinculoFatec}
        ra={perfil?.ra}
        curso={perfil?.curso}
        cpfAtual={perfil?.cpf}
        dataNascimentoAtual={perfil?.dataNascimento}
      />
    </Modal>
  );
}
