import { getAdminDb } from "@/lib/firebaseAdmin";

const BASE_URL = process.env.ASAAS_BASE_URL ?? "https://sandbox.asaas.com/api/v3";

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) {
    throw new Error("ASAAS_API_KEY ausente — configure em .env.local / Vercel.");
  }
  return key;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey(),
      ...init?.headers,
    },
  });
  const corpo = await res.json();
  if (!res.ok) {
    const mensagem =
      corpo?.errors?.map((e: { description?: string }) => e.description).join(" ") ??
      `Erro ${res.status} na API do Asaas.`;
    throw new Error(mensagem);
  }
  return corpo as T;
}

type ClienteAsaas = { id: string };

/** Reaproveita o customer do Asaas salvo em usuarios/{uid}.asaasCustomerId;
 * cria um novo (e salva) na primeira cobrança do usuário. */
export async function buscarOuCriarCliente(dados: {
  uid: string;
  nome: string;
  email: string;
  cpf: string;
}): Promise<string> {
  const usuarioRef = getAdminDb().doc(`usuarios/${dados.uid}`);
  const usuarioSnap = await usuarioRef.get();
  const existente = usuarioSnap.data()?.asaasCustomerId as string | undefined;
  if (existente) return existente;

  const cliente = await asaasFetch<ClienteAsaas>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      email: dados.email,
      cpfCnpj: dados.cpf.replace(/\D/g, ""),
      externalReference: dados.uid,
    }),
  });

  await usuarioRef.set(
    { asaasCustomerId: cliente.id, cpf: dados.cpf.replace(/\D/g, "") },
    { merge: true },
  );

  return cliente.id;
}

export type CobrancaAsaas = {
  id: string;
  status: string;
  invoiceUrl: string;
};

function dataVencimento(diasAPartirDeHoje: number): string {
  const data = new Date();
  data.setDate(data.getDate() + diasAPartirDeHoje);
  return data.toISOString().slice(0, 10);
}

export async function criarCobranca(dados: {
  customer: string;
  value: number;
  description: string;
  externalReference: string;
}): Promise<CobrancaAsaas> {
  return asaasFetch<CobrancaAsaas>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customer,
      billingType: "UNDEFINED",
      value: dados.value,
      dueDate: dataVencimento(3),
      description: dados.description,
      externalReference: dados.externalReference,
    }),
  });
}

export async function buscarCobranca(id: string): Promise<CobrancaAsaas> {
  return asaasFetch<CobrancaAsaas>(`/payments/${id}`);
}
