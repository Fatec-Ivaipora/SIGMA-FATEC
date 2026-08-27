import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { buscarCobranca, buscarOuCriarCliente, criarCobranca } from "@/lib/asaas";

const CPF_REGEX = /^\d{11}$/;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const { eventoId, cpf } = (await request.json()) as { eventoId?: string; cpf?: string };
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  const valorInscricao = evento?.valorInscricao as number | undefined;
  if (!evento || !valorInscricao || valorInscricao <= 0) {
    return NextResponse.json(
      { erro: "Este evento não tem taxa de inscrição." },
      { status: 400 },
    );
  }

  const inscricaoId = `${eventoId}::${uid}`;
  const inscricaoRef = db.doc(`inscricoesEvento/${inscricaoId}`);
  const inscricaoSnap = await inscricaoRef.get();
  const inscricaoExistente = inscricaoSnap.data();

  // Cobrança pendente já criada — reaproveita em vez de gerar outra no Asaas.
  if (inscricaoExistente?.status === "pendente" && inscricaoExistente.asaasPaymentId) {
    try {
      const cobranca = await buscarCobranca(inscricaoExistente.asaasPaymentId);
      if (cobranca.status !== "CANCELLED" && cobranca.status !== "OVERDUE") {
        return NextResponse.json({ invoiceUrl: inscricaoExistente.asaasInvoiceUrl });
      }
    } catch {
      // cobrança não encontrada/expirada no Asaas — cai pra criar uma nova abaixo.
    }
  }

  const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
  const usuario = usuarioSnap.data();
  if (!usuario) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  const cpfParaUso = (usuario.cpf as string | undefined) ?? cpf;
  if (!cpfParaUso || !CPF_REGEX.test(cpfParaUso.replace(/\D/g, ""))) {
    return NextResponse.json({ erro: "Informe um CPF válido (11 dígitos)." }, { status: 400 });
  }

  let customerId: string;
  let cobranca;
  try {
    customerId = await buscarOuCriarCliente({
      uid,
      nome: usuario.nome,
      email: usuario.email,
      cpf: cpfParaUso,
    });
    cobranca = await criarCobranca({
      customer: customerId,
      value: valorInscricao,
      description: `Inscrição — ${evento.nome}`,
      externalReference: inscricaoId,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message || "Não foi possível gerar a cobrança." },
      { status: 502 },
    );
  }

  await inscricaoRef.set(
    {
      eventoId,
      uid,
      nome: usuario.nome,
      email: usuario.email,
      vinculoFatec: usuario.vinculoFatec ?? true,
      valor: valorInscricao,
      status: "pendente",
      asaasCustomerId: customerId,
      asaasPaymentId: cobranca.id,
      asaasInvoiceUrl: cobranca.invoiceUrl,
      criadoEm: inscricaoExistente?.criadoEm ?? FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ invoiceUrl: cobranca.invoiceUrl });
}
