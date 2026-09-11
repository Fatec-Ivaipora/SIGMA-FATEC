import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

// Tipos do feed da tela inicial (2026-09-09, aluno; 2026-09-09 também
// avaliador/moderador) — cada um vira uma frase pronta gravada no momento
// do evento (ver chamadas em /api/mail/trabalho-status, /api/mail/atribuicao,
// /api/asaas/webhook, /api/asaas/manual e /api/trabalhos/convite-aceito). O
// client só lê e mostra (ver src/lib/data/atividades.ts) — nunca decide o
// texto nem escreve aqui.
export type TipoAtividade =
  | "submetido"
  | "revisao"
  | "avaliado"
  | "aceito"
  | "nao_aceito"
  | "convite_aceito"
  | "pagamento"
  | "atribuicao"
  // Admin corrigiu um trabalho por fora do fluxo normal (2026-09-11) —
  // avisa TODOS os autores, sempre, mesmo sem eles pedirem nada: é uma
  // transparência de segurança (ver /api/trabalhos/alterado-admin), pra
  // ninguém conseguir mexer no trabalho de outra pessoa sem que isso deixe
  // rastro visível pra quem é dono dele.
  | "trabalho_alterado_admin";

/** Grava uma linha no feed pessoal de alguém — só server-side (Admin SDK),
 * nunca chamado do client. "Melhor esforço": erro aqui nunca deve derrubar
 * a ação principal (mandar e-mail, confirmar pagamento etc.) — por isso os
 * call sites sempre envolvem essa chamada num try/catch próprio. */
export async function registrarAtividade(dados: {
  uid: string;
  tipo: TipoAtividade;
  texto: string;
  // Substrings exatas de `texto` (nome de trabalho, evento, autor) que o
  // client vai destacar em negrito — nunca HTML, ver
  // src/app/aluno/page.tsx#renderTextoComNegrito.
  negritos?: string[];
  trabalhoId?: string;
  eventoId?: string;
}) {
  await getAdminDb()
    .collection("atividades")
    .add({ ...dados, criadoEm: FieldValue.serverTimestamp() });
}
