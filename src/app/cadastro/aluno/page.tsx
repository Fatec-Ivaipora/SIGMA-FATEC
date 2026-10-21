"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { CURSOS_FATEC } from "@/lib/cursos";
import { formatarCPF, validarCPF } from "@/lib/cpf";

const IDADE_MINIMA_ANOS = 12;

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
  const [curso, setCurso] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

    if (vinculoFatec && !curso) {
      setErro("Selecione o seu curso.");
      return;
    }

    // E-mail sempre minúsculo (2026-10-02, achado real: Luciano conseguiu
    // duas contas porque "Drlucianorosaguimaraes@..." e
    // "drlucianorosaguimaraes@..." não bateram como o mesmo e-mail — uma
    // delas ficou órfã, sem conta, com inscrição e pagamento pendente que
    // nunca ia dar certo). Normaliza ANTES de criar a conta no Auth, não só
    // ao gravar no Firestore — é a criação em si que precisa tratar as duas
    // grafias como a mesma pessoa.
    const emailNormalizado = email.trim().toLowerCase();
    const cpfLimpo = cpf.replace(/\D/g, "");

    setEnviando(true);
    try {
      // Conta inteira (Auth + Firestore) criada numa chamada só de servidor
      // (2026-10-21, achado real: duas pessoas ficaram com conta "órfã" no
      // Auth sem o cadastro completo, porque antes isso era feito em duas
      // etapas separadas do navegador — se a conexão caísse ou a aba
      // fechasse entre as duas, a conta do Auth ficava pra sempre sem
      // perfil, e a própria tentativa de desfazer isso também rodava no
      // navegador e podia falhar do mesmo jeito. Ver
      // /api/cadastro/aluno/route.ts pro porquê completo).
      const resposta = await fetch("/api/cadastro/aluno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          cpf: cpfLimpo,
          dataNascimento,
          curso: vinculoFatec ? curso : undefined,
          vinculoFatec,
          email: emailNormalizado,
          senha,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.erro ?? "Não foi possível criar a conta. Tente novamente.");
        setEnviando(false);
        return;
      }

      // Conta já existe de verdade no Auth nesse ponto — só autentica no
      // navegador com a mesma senha, igual a um login normal, pra ganhar a
      // sessão local.
      try {
        await signInWithEmailAndPassword(auth, emailNormalizado, senha);
        router.push("/aluno");
      } catch (e) {
        console.error("Cadastro: conta criada, mas falhou o login automático", e);
        setErro(
          "Sua conta foi criada! Não conseguimos entrar automaticamente — faça login na tela seguinte.",
        );
        setEnviando(false);
      }
    } catch (e) {
      console.error("Cadastro: falha de rede ao chamar /api/cadastro/aluno", e);
      setErro("Não foi possível criar a conta. Confira sua conexão com a internet e tente de novo.");
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
    </AuthSplitLayout>
  );
}
