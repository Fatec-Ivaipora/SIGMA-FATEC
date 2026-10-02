import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

/** Checa se um CPF já tem conta cadastrada (2026-10-02, pedido explícito do
 * usuário) — CPF é obrigatório e único por pessoa (ninguém tem igual), mas
 * até agora nada impedia duas contas com o mesmo. Usado em dois lugares:
 * (1) ANTES de criar a conta no Auth no autocadastro (ver
 * src/app/cadastro/aluno/page.tsx) — pra nunca deixar criar a conta e só
 * depois descobrir o CPF duplicado, o que deixaria uma conta órfã no Auth
 * sem conseguir salvar no Firestore (mesmo problema já visto com e-mail
 * duplicado, achado em 2026-10-02 com o caso do Luciano); (2) quando um
 * usuário já logado preenche o CPF depois, pela primeira vez, em
 * Configurações (ConfiguracoesModal.tsx — contas antigas de antes do CPF
 * virar obrigatório) — manda `excluirUid` com o próprio uid, pra não acusar
 * a própria pessoa resalvando o mesmo CPF que já é dela.
 *
 * Pública (sem Authorization) de propósito — quem está se cadastrando ainda
 * não tem conta nenhuma, não tem token pra mandar. Só devolve um booleano
 * (em uso ou não), nunca de quem é o CPF — não dá pra descobrir nome/e-mail
 * de ninguém por aqui. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    cpf?: string;
    excluirUid?: string;
  } | null;
  const cpf = body?.cpf?.replace(/\D/g, "");
  if (!cpf || cpf.length !== 11) {
    return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });
  }

  const snap = await getAdminDb().collection("usuarios").where("cpf", "==", cpf).get();
  const emUso = snap.docs.some((d) => d.id !== body?.excluirUid);

  return NextResponse.json({ emUso });
}
