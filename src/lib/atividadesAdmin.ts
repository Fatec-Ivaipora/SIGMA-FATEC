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
  // Resumo rejeitado pelo avaliador direto na Avaliação (2026-11-03) —
  // separado de "nao_aceito" (resultado final pós-apresentação), ver
  // /api/mail/trabalho-status.
  | "rejeitado"
  // Aluno corrigiu um trabalho em revisão depois do prazo de avaliação já
  // ter encerrado (2026-11-04) — confirmação pro aluno, ver TrabalhoStatus
  // "entregue_com_atraso" em src/lib/data/trabalhos.ts.
  | "entregue_fora_prazo"
  // Mesmo evento acima, mas o aviso que vai pro AVALIADOR (feed dele, não
  // do aluno) — "fulano devolveu fora do prazo, você ainda pode avaliar".
  | "aviso_entrega_atrasada"
  // Aviso automático 1 dia antes do prazo de avaliação terminar, pra quem
  // tem trabalho em "revisao" (2026-11-04) — ver
  // /api/cron/lembrete-prazo-avaliacao, única rota disparada por data
  // (Vercel Cron) em vez de ação do usuário.
  | "lembrete_prazo_avaliacao"
  | "convite_aceito"
  | "pagamento"
  | "atribuicao"
  // Confirmação de presença por QR em evento "simples" (2026-10-07, achado
  // real: aluno confirmava a presença e não aparecia nada no feed — único
  // gatilho dessa lista que nunca tinha sido ligado). Ver
  // /api/inscricoes/confirmar-presenca.
  | "presenca"
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
