"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Info } from "lucide-react";
import { createUserWithEmailAndPassword, type AuthError } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { Modal } from "@/components/Modal";
import { CURSOS_FATEC } from "@/lib/cursos";
import { formatarCPF, validarCPF } from "@/lib/cpf";

const DURACAO_MAXIMA_CURSO_ANOS = 5;
const IDADE_MINIMA_ANOS = 12;

function mensagemErro(erro: AuthError): string {
  switch (erro.code) {
    case "auth/email-already-in-use":
      return "Já existe uma conta com esse e-mail.";
    case "auth/invalid-email":
      return "Digite um e-mail válido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    default:
      return "Não foi possível criar a conta. Tente novamente.";
  }
}

function erroDoRA(ra: string): string | null {
  if (!/^\d{10}$/.test(ra)) {
    return "O RA deve ter 10 dígitos: o ano de ingresso seguido de 6 números.";
  }
  const ano = parseInt(ra.slice(0, 4), 10);
  const anoAtual = new Date().getFullYear();
  const anoMinimo = anoAtual - DURACAO_MAXIMA_CURSO_ANOS;
  if (ano > anoAtual || ano < anoMinimo) {
    return `Os 4 primeiros dígitos devem ser um ano de ingresso válido, entre ${anoMinimo} e ${anoAtual}.`;
  }
  return null;
}

function erroDaDataNascimento(data: string): string | null {
  if (!data) return "Informe sua data de nascimento.";
  const nascimento = new Date(`${data}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return "Data inválida.";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aniversarioJaPassou =
    hoje.getMonth() > nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() >= nascimento.getDate());
  if (!aniversarioJaPassou) idade -= 1;
  if (nascimento > hoje) return "A data não pode ser no futuro.";
  if (idade < IDADE_MINIMA_ANOS) {
    return `Idade mínima de ${IDADE_MINIMA_ANOS} anos pra se cadastrar.`;
  }
  return null;
}

export default function CadastroAlunoPage() {
  const router = useRouter();
  const [vinculoFatec, setVinculoFatec] = useState(true);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [ra, setRa] = useState("");
  const [curso, setCurso] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ajudaRAAberta, setAjudaRAAberta] = useState(false);

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    if (!validarCPF(cpf)) {
      setErro("Digite um CPF válido.");
      return;
    }

    const erroNascimento = erroDaDataNascimento(dataNascimento);
    if (erroNascimento) {
      setErro(erroNascimento);
      return;
    }

    if (vinculoFatec) {
      const erroRA = erroDoRA(ra.trim());
      if (erroRA) {
        setErro(erroRA);
        return;
      }
      if (!curso) {
        setErro("Selecione o seu curso.");
        return;
      }
    }

    setEnviando(true);
    try {
      const credencial = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, "usuarios", credencial.user.uid), {
        nome: nome.trim(),
        email: email.trim(),
        papel: "aluno",
        vinculoFatec,
        cpf: cpf.replace(/\D/g, ""),
        dataNascimento,
        ...(vinculoFatec ? { ra: ra.trim(), curso } : {}),
      });
      router.push("/aluno");
    } catch (e) {
      setErro(mensagemErro(e as AuthError));
      setEnviando(false);
    }
  }

  return (
    <AuthSplitLayout
      backHref="/login"
      headline="Envie seu trabalho e acompanhe a avaliação — tudo em um só lugar."
    >
      <h1 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
        Criar conta
      </h1>
      <p className="mt-1.5 text-sm text-fatec-muted">
        Alunos da Fatec e participantes de fora também podem se inscrever nos
        eventos abertos ao público.
      </p>

      <form onSubmit={criarConta} className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Você é aluno(a) da Fatec Ivaiporã?
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVinculoFatec(true)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                vinculoFatec
                  ? "border-fatec-orange-500 bg-fatec-orange-50 text-fatec-orange-600"
                  : "border-fatec-line text-fatec-navy-900 hover:bg-fatec-navy-50"
              }`}
            >
              Sim, sou aluno(a)
            </button>
            <button
              type="button"
              onClick={() => setVinculoFatec(false)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                !vinculoFatec
                  ? "border-fatec-orange-500 bg-fatec-orange-50 text-fatec-orange-600"
                  : "border-fatec-line text-fatec-navy-900 hover:bg-fatec-navy-50"
              }`}
            >
              Não, sou de fora
            </button>
          </div>
          {!vinculoFatec && (
            <span className="text-xs text-fatec-muted">
              Sem vínculo com a Fatec, você só poderá se inscrever nos eventos
              abertos a participantes externos.
            </span>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome completo
          </span>
          <input
            type="text"
            name="nome"
            autoComplete="name"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">CPF</span>
            <input
              type="text"
              inputMode="numeric"
              name="cpf"
              required
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Data de nascimento
            </span>
            <input
              type="date"
              name="dataNascimento"
              required
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
        </div>
        <span className="-mt-3 text-xs text-fatec-muted">
          Exigidos pra emitir seu certificado de participação nos eventos.
        </span>

        {vinculoFatec && (
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-fatec-navy-900">
              RA (registro acadêmico)
              <button
                type="button"
                onClick={() => setAjudaRAAberta(true)}
                aria-label="Onde encontro meu RA?"
                className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
              >
                <Info className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </span>
            <input
              type="text"
              inputMode="numeric"
              name="ra"
              required
              maxLength={10}
              value={ra}
              onChange={(e) => setRa(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex.: 2023001234"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            <span className="text-xs text-fatec-muted">
              10 dígitos: o ano em que você ingressou seguido de 6 números.
            </span>
          </label>
        )}

        {vinculoFatec && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Curso
            </span>
            <select
              required
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            >
              <option value="" disabled>
                Selecione o seu curso
              </option>
              {CURSOS_FATEC.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

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
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
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
          disabled={enviando}
          className="mt-1 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
        >
          {enviando ? "Criando conta..." : "Criar conta"}
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

      <Modal
        open={ajudaRAAberta}
        onClose={() => setAjudaRAAberta(false)}
        title="Onde encontro meu RA?"
      >
        <p className="text-sm text-fatec-ink">
          Acesse{" "}
          <a
            href="https://fatecivaipora.com.br/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
          >
            fatecivaipora.com.br
          </a>
          , vá até a Área do Aluno e entre no seu Edubox — o RA aparece no
          mesmo local da imagem abaixo.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-fatec-line">
          <Image
            src="/images/ra-exemplo.png"
            alt="Exemplo de onde encontrar o RA no Edubox"
            width={1917}
            height={630}
            priority
            className="h-auto w-full"
          />
        </div>
      </Modal>
    </AuthSplitLayout>
  );
}
