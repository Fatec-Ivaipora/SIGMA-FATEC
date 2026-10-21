import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { validarCPF } from "@/lib/cpf";

const IDADE_MINIMA_ANOS = 12;

// Mesma regra de src/app/cadastro/aluno/page.tsx — duplicada de propósito
// (não dá pra importar o arquivo da página aqui, ele puxa firebase/auth e
// next/navigation, só de browser). O cliente valida pra UX instantânea; o
// servidor valida de novo porque é quem decide de verdade.
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

function mensagemErroAuth(codigo: string): string {
  switch (codigo) {
    case "auth/email-already-exists":
      return "Já existe uma conta com esse e-mail.";
    case "auth/invalid-email":
      return "Digite um e-mail válido.";
    case "auth/invalid-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    default:
      return "Não foi possível criar a conta. Tente novamente.";
  }
}

/** Cadastro de aluno/participante inteiro numa chamada de servidor só
 * (2026-10-21, pedido explícito do usuário — achado real, dois casos:
 * mayllamacetko13@gmail.com e osni.ben.hur@gmail.com ficaram com conta
 * "órfã" no Firebase Auth, sem perfil nenhum no Firestore). Antes isso era
 * feito em duas etapas separadas DO NAVEGADOR
 * (createUserWithEmailAndPassword, depois um writeBatch) — se a aba
 * fechasse ou a conexão caísse bem entre as duas (achado comum em celular
 * com sinal fraco), a conta do Auth ficava criada pra sempre sem o
 * cadastro terminar: a pessoa nunca mais conseguia logar (perfil não
 * existe, ver /login) nem recriar a conta (e-mail já em uso). O código
 * antigo já tentava desfazer isso sozinho (credencial.user.delete() no
 * catch), mas essa tentativa TAMBÉM rodava no navegador — se a conexão já
 * tivesse caído, o próprio delete falhava, silenciosamente (estava num
 * `.catch(() => {})`), e ninguém ficava sabendo.
 *
 * Agora as duas etapas (criar no Auth, gravar no Firestore) rodam aqui,
 * no servidor, dentro da mesma requisição — nunca fica pela metade por
 * causa da conexão da pessoa cair ou ela fechar a aba no meio (o
 * navegador só espera uma resposta; o processamento continua no servidor
 * de qualquer forma). Se o Firestore falhar por outro motivo, o rollback
 * (apagar o usuário do Auth) roda no mesmo processo do servidor — não
 * depende de mais nada do lado da pessoa. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    cpf?: string;
    dataNascimento?: string;
    curso?: string;
    vinculoFatec?: boolean;
    email?: string;
    senha?: string;
  } | null;

  const nome = body?.nome?.trim();
  const cpf = body?.cpf?.replace(/\D/g, "");
  const dataNascimento = body?.dataNascimento ?? "";
  const vinculoFatec = body?.vinculoFatec !== false;
  const curso = body?.curso?.trim();
  const email = body?.email?.trim().toLowerCase();
  const senha = body?.senha ?? "";

  if (!nome) {
    return NextResponse.json({ erro: "Informe seu nome completo." }, { status: 400 });
  }
  if (!cpf || !validarCPF(cpf)) {
    return NextResponse.json({ erro: "Digite um CPF válido." }, { status: 400 });
  }
  const erroNascimento = erroDaDataNascimento(dataNascimento);
  if (erroNascimento) {
    return NextResponse.json({ erro: erroNascimento }, { status: 400 });
  }
  if (vinculoFatec && !curso) {
    return NextResponse.json({ erro: "Selecione o seu curso." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }
  if (!senha || senha.length < 6) {
    return NextResponse.json(
      { erro: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  const auth = getAdminAuth();

  // CPF único — mesma checagem de /api/cadastro/checar-cpf, inline aqui
  // (mesma requisição, sem round-trip separado que deixaria uma janela de
  // corrida entre checar e criar).
  const cpfEmUsoSnap = await db.collection("usuarios").where("cpf", "==", cpf).get();
  if (!cpfEmUsoSnap.empty) {
    return NextResponse.json(
      { erro: "Já existe uma conta cadastrada com esse CPF." },
      { status: 400 },
    );
  }

  let uid: string;
  try {
    const userRecord = await auth.createUser({ email, password: senha, displayName: nome });
    uid = userRecord.uid;
  } catch (e) {
    const codigo = (e as { code?: string }).code ?? "";
    return NextResponse.json({ erro: mensagemErroAuth(codigo) }, { status: 400 });
  }

  try {
    const batch = db.batch();
    batch.set(db.doc(`usuarios/${uid}`), {
      nome,
      // nomeBusca (2026-10-05) — nome em minúsculo só pra busca por
      // prefixo em /usuarios (ver useBuscaUsuarios).
      nomeBusca: nome.toLowerCase(),
      email,
      papel: "aluno",
      vinculoFatec,
      cpf,
      dataNascimento,
      ...(vinculoFatec ? { curso } : {}),
    });
    // Espelho público (2026-09-08, ver firestore.rules) — só nome/email/
    // vinculoFatec, pra busca de autor/convite de turma nunca precisar ler
    // o doc usuarios/{uid} inteiro (que tem cpf/dataNascimento).
    batch.set(db.doc(`usuariosPublicos/${uid}`), {
      nome,
      email,
      vinculoFatec,
    });
    await batch.commit();
  } catch (e) {
    console.error(
      "Cadastro: falha ao gravar usuarios/usuariosPublicos, desfazendo conta do Auth",
      e,
    );
    await auth.deleteUser(uid).catch((erroRollback) => {
      console.error(
        "Cadastro: falha AO DESFAZER também — conta ficou órfã, uid:",
        uid,
        erroRollback,
      );
    });
    return NextResponse.json(
      { erro: "Não foi possível salvar seus dados. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
