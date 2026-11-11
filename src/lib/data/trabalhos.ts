"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  or,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { temPapel, type PerfilUsuario } from "@/lib/auth";

export type TrabalhoStatus =
  | "submissao"
  | "aguardando_avaliacao"
  | "revisao"
  | "avaliado"
  | "aguardando_apresentacao"
  | "apresentado"
  | "aceito"
  | "nao_aceito"
  // Aluno corrigiu um trabalho em "revisao" depois que evento.prazoAvaliacao
  // já tinha passado (2026-11-04, pedido explícito do usuário — "ele vai
  // ficar entregue, pro avaliador vai chegar uma mensagem... e ele pode
  // avaliar"). Diferente de um trabalho comum fora do prazo: o avaliador
  // GANHA uma exceção pra esse trabalho específico e continua conseguindo
  // dar nota/pedir revisão/rejeitar nele, mesmo com o prazo geral do evento
  // já vencido (ver dentroDoPrazoAvaliacao(eventoId) || status ==
  // "entregue_com_atraso" em firestore.rules). Continua listado na aba
  // Revisão do admin (ver STATUS_POR_ETAPA em src/app/trabalhos/page.tsx) —
  // serve de registro, no final do evento, de quem foi mandado pra revisão
  // e nunca respondeu versus quem respondeu só que atrasado.
  | "entregue_com_atraso"
  // Destino EXCLUSIVO dos trabalhos que já estavam em "revisao" sem nota
  // nenhuma ANTES do fix de 2026-11-05 (ver `revisaoLegado` abaixo) — nunca
  // usado por trabalhos novos daqui pra frente (esses fecham direto em
  // "avaliado" quando o aluno reenvia corrigido, porque a nota já foi
  // travada antes de ir pra revisão — ver salvarEdicao em
  // aluno/trabalhos/page.tsx). Pedido explícito do usuário: o avaliador
  // finalmente dá a nota (primeira vez, já vendo a versão corrigida), mas o
  // trabalho continua na aba Revisão (não "Resultado"), apresenta e entra
  // no ensalamento normalmente, só NÃO concorre a pódio/prêmio nem entra no
  // cálculo de empate (ver STATUS_JA_AVALIADO em src/app/trabalhos/page.tsx
  // — de propósito NÃO inclui esse status).
  | "revisao_realizada";

// Critérios do edital (item 6.1): cada um recebe uma nota de 1 a 5 (item
// 6.2); notaAvaliador guarda a SOMA dos cinco (5 a 25), usada pra ranquear
// os resumos mais bem pontuados.
export type NotasCriterios = {
  suficiencia: number;
  coerencia: number;
  estruturaTexto: number;
  clarezaPrecisao: number;
  aplicabilidadeRelevancia: number;
};

// Critérios da etapa de Apresentação, pontuados pelo moderador — item 6.4 do
// edital X MAC (conferido 2026-09-08 contra o PDF real, substituindo os 5
// placeholder que existiam antes). 7 critérios, 1 a 3 cada (2026-11-05,
// pedido explícito do usuário — "1 – Regular, 2 – Bom, 3 – Excelente"), soma
// 7-21 — ver CRITERIOS_APRESENTACAO/NOTAS_APRESENTACAO em
// src/app/avaliador/trabalhos/page.tsx.
export type NotasCriteriosApresentacao = {
  pontualidade: number;
  numeroApresentadores: number;
  linguagemTecnica: number;
  qualidadeSlides: number;
  clarezaObjetividade: number;
  ordemLogica: number;
  postura: number;
};

export type Trabalho = {
  id: string;
  titulo: string;
  alunoUid: string;
  alunoNome: string;
  eventoId: string;
  areaTematica: string;
  // Como o trabalho será apresentado (2026-09-01) — Oral (sala reservada,
  // com slides, tempo de perguntas no final) ou Roda de Conversa (banner
  // impresso, apresentador junto ao material, formato mais interativo).
  // Escolhido pelo aluno na submissão.
  modalidadeApresentacao?: "oral" | "roda_conversa";
  nomeOrientador?: string;
  // Coorientadores em texto livre (2026-10-27) — ver DadosSubmissao em
  // SubmeterTrabalhoModal.tsx. Ausente nos trabalhos enviados antes.
  nomesCoorientadores?: string[];
  resumo?: string;
  // Palavras-chave do resumo acadêmico (2026-10-09, pedido explícito do
  // usuário — "sinto que falta um campo de palavras chave tbm antes do
  // resumo"). Texto livre, aluno separa por vírgula/ponto e vírgula; só
  // existe pra trabalho de evento completo (ver `resumoAcademico` em
  // SubmeterTrabalhoModal.tsx — Projeto Integrador não ganha esse campo,
  // não é um resumo no formato acadêmico ABNT). Ausente em trabalhos
  // submetidos antes dessa data.
  palavrasChave?: string;
  // Colegas adicionados na submissão (RF-08) — só leem o trabalho, não podem
  // editá-lo/reenviá-lo (isso continua exclusivo de alunoUid). Entram em
  // participantesUids/Nomes já na submissão, mas ficam em convitesPendentes
  // até aceitarem ou recusarem o convite (RF-52, 2026-08-25) — recusar
  // remove o colega de participantesUids/Nomes também.
  participantesUids?: string[];
  participantesNomes?: string[];
  convitesPendentes?: string[];
  status: TrabalhoStatus;
  avaliadorUid?: string | null;
  avaliadorNome?: string | null;
  // Soma dos 5 critérios (NotasCriterios), 5 a 25 — ver notasCriterios pro
  // detalhamento por critério.
  notaAvaliador?: number | null;
  notasCriterios?: NotasCriterios | null;
  comentarioRevisao?: string | null;
  // Marca os trabalhos que já estavam em "revisao" ANTES do fix de
  // 2026-11-05 (nota só depois de corrigido, não antes) — gravado uma vez
  // só, por script, nos ~50 trabalhos afetados da X MAC. Usado só por
  // onEnviarNota (avaliador/trabalhos/page.tsx) pra mandar esses pra
  // "revisao_realizada" em vez de "avaliado" quando finalmente ganham
  // nota. Nunca gravado em trabalhos novos.
  revisaoLegado?: boolean;
  // Nota dada pela comissão organizadora na aba Revisão (2026-11-06) — o
  // avaliador não pede mais revisão; os que estavam em revisão a comissão
  // reavalia e dá a nota direto (botão "Dar nota", só admin/organização).
  // Só registro, não muda nada no ranking.
  notaPelaComissao?: boolean;
  // Etapa Apresentação (2026-08-26) — moderador designado e sua nota, mesmo
  // padrão de avaliadorUid/notaAvaliador acima.
  moderadorUid?: string | null;
  moderadorNome?: string | null;
  notaModerador?: number | null;
  notasCriteriosApresentacao?: NotasCriteriosApresentacao | null;
  // Presença na apresentação (2026-11-10, pedido explícito do usuário —
  // "tem alunos que já está em primeiro [lugar, só pela nota da avaliação]
  // mas não vai vir apresentar, e isso é injusto com os demais"). Marcado
  // pelo moderador na própria sala pra quem NÃO está empatado (quem está
  // empatado já confirma presença ao receber a nota da apresentação,
  // não precisa desse campo separado). `false` tira o trabalho do pódio
  // (perde só `premiado`, continua "aceito") — ver analiseResultadoPorArea
  // em src/lib/analiseEmpate.ts, que exclui quem tem isso `false` do
  // cálculo. `undefined` = ainda não chegou a vez de marcar.
  compareceuApresentacao?: boolean;
  // Desempate manual (2026-11-11, pedido explícito do usuário — achado
  // real: ano passado uma área teve 10 trabalhos empatados na nota
  // MÁXIMA do moderador, o empate persistiu mesmo depois da
  // apresentação). Admin escolhe a posição final na mão, direto na aba
  // Desempate, só quando o cálculo automático já esgotou os critérios
  // (mesma nota de avaliação E mesma nota de apresentação) — ver
  // analisarEmpatesPorArea em src/lib/analiseEmpate.ts.
  posicaoManual?: number;
  // Controla quando o certificado/declaração desse trabalho aparece pro
  // aluno/avaliador/moderador (2026-08-28) — chegar em "aceito" não libera
  // sozinho; a organização decide o momento clicando "Liberar certificado"
  // na aba Resultado Final (ver trabalhos/page.tsx).
  certificadoLiberado?: boolean;
  // Top 3 da área temática (2026-09-11) — "aceito" sozinho só significa que
  // o trabalho participou/foi validado; "premiado" é quem de fato ficou
  // entre os 3 melhores da área (edital 6.6, "certificado de
  // reconhecimento"). Decide se o aluno baixa Certificado (premiado) ou
  // Declaração (aceito, mas não premiado) — ver /api/certificados.
  premiado?: boolean;
  // Sessão de apresentação (sala + bloco de horário + modalidade + área) a
  // que esse trabalho foi designado pela grade automática (2026-09-17) — ver
  // src/lib/data/sessoes.ts e /ensalamento. Ausente = ainda não ensalado.
  sessaoId?: string | null;
  // Quando o trabalho foi ENVIADO (2026-10-28, pedido explícito do usuário —
  // "organizar pelo último envio recebido, não pela edição"). Gravado só na
  // criação; atualizadoEm continua mudando a cada edição. Trabalhos antigos
  // receberam o momento em que o documento foi criado.
  enviadoEm?: unknown;
  atualizadoEm?: unknown;
  // Gravado pelo cron de lembrete (2026-11-04, ver /api/cron/
  // lembrete-prazo-avaliacao) assim que manda o aviso de "prazo termina
  // amanhã" pra quem tem esse trabalho em "revisao" — garante que não manda
  // duas vezes. Só escrito pelo servidor, nunca lido pelo client.
  lembretePrazoEnviadoEm?: unknown;
};

/** Lê trabalhos do Firestore, escopado por papel: admin vê tudo; organizacao só
 * os eventos em que atua (RN-15); avaliador só os que lhe foram designados;
 * aluno só os que ele mesmo submeteu. */
export function useTrabalhos(
  perfil: PerfilUsuario | null | undefined,
  uid: string | null | undefined,
) {
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil || !uid) return;

    const ref = collection(db, "trabalhos");

    if (perfil.papel === "admin") {
      return onSnapshot(query(ref), (snap) => {
        setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho));
        setCarregando(false);
      });
    }

    if (perfil.papel === "organizacao") {
      if (!perfil.eventosPermitidos || perfil.eventosPermitidos.length === 0) {
        Promise.resolve().then(() => {
          setTrabalhos([]);
          setCarregando(false);
        });
        return;
      }
      const q = query(ref, where("eventoId", "in", perfil.eventosPermitidos.slice(0, 30)));
      return onSnapshot(q, (snap) => {
        setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho));
        setCarregando(false);
      });
    }

    if (
      temPapel(perfil, "avaliador") ||
      temPapel(perfil, "orientador") ||
      temPapel(perfil, "moderador")
    ) {
      // Papéis combináveis (2026-08-26, ver PAPEIS_AVALIACAO em auth.tsx) —
      // uma pessoa pode ser avaliadorUid de uns trabalhos e moderadorUid de
      // outros ao mesmo tempo; a tela em si separa por aba (ver
      // src/app/avaliador/trabalhos/page.tsx).
      //
      // Dois listeners separados, não um só `or(avaliadorUid==uid,
      // moderadorUid==uid)` (2026-11-03, corrigido — achado real: TODOS os
      // 25 avaliadores reais do MAC têm só "avaliador" em papeisAvaliacao,
      // nenhum tem "moderador" também. firestore.rules autoriza cada ramo
      // (avaliador/moderador) separadamente, checando o papel de quem
      // pergunta — mas numa query `or()` sobre DOIS campos diferentes, o
      // Firestore só libera se CADA sub-filtro da query, isolado, já for
      // coberto pela regra pra esse usuário. Quem não é moderador nunca
      // bate no ramo `moderadorUid==uid` da regra, então esse pedaço da
      // query é negado — e nega a query INTEIRA, mesmo a metade
      // (avaliadorUid==uid) que seria permitida sozinha. Resultado: todo
      // avaliador sem o papel moderador tomava "permission-denied" e via a
      // tela de trabalhos sempre vazia. Confirmado direto contra as regras
      // publicadas (não só o arquivo local) testando como um avaliador de
      // teste de verdade. Dois onSnapshot separados, cada um só com o
      // campo que a regra já cobre pra esse papel, evita o problema.
      const comoAvaliador = query(ref, where("avaliadorUid", "==", uid));
      const comoModerador = query(ref, where("moderadorUid", "==", uid));
      const porId = new Map<string, Trabalho>();
      let carregouAvaliador = false;
      let carregouModerador = false;

      function publicar() {
        setTrabalhos(Array.from(porId.values()));
        if (carregouAvaliador && carregouModerador) setCarregando(false);
      }

      const paraTrabalho = (d: { id: string; data: () => unknown }) =>
        ({ id: d.id, ...(d.data() as object) }) as Trabalho;

      const unsubAvaliador = onSnapshot(comoAvaliador, (snap) => {
        for (const d of snap.docs) porId.set(d.id, paraTrabalho(d));
        // Remove quem saiu do resultado (deixou de ser o avaliador).
        const idsAtuais = new Set(snap.docs.map((d) => d.id));
        for (const [id, t] of porId) {
          if (t.avaliadorUid === uid && !idsAtuais.has(id)) porId.delete(id);
        }
        carregouAvaliador = true;
        publicar();
      });
      const unsubModerador = onSnapshot(comoModerador, (snap) => {
        for (const d of snap.docs) {
          const existente = porId.get(d.id);
          porId.set(d.id, existente ? { ...existente, ...paraTrabalho(d) } : paraTrabalho(d));
        }
        const idsAtuais = new Set(snap.docs.map((d) => d.id));
        for (const [id, t] of porId) {
          if (t.moderadorUid === uid && t.avaliadorUid !== uid && !idsAtuais.has(id)) {
            porId.delete(id);
          }
        }
        carregouModerador = true;
        publicar();
      });

      return () => {
        unsubAvaliador();
        unsubModerador();
      };
    }

    // Dono do trabalho ou colega adicionado como participante (RF-08) — os
    // dois ramos dessa `or()` já são cobertos pela MESMA condição de regra
    // (meuPapel() == "aluno"), sem depender de outro papel por campo, então
    // não sofre do problema acima — continua uma query só.
    const q = query(
      ref,
      or(where("alunoUid", "==", uid), where("participantesUids", "array-contains", uid)),
    );
    return onSnapshot(q, (snap) => {
      setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho));
      setCarregando(false);
    });
  }, [perfil, uid]);

  return { trabalhos, carregando };
}

export function atualizarTrabalho(trabalhoId: string, dados: Partial<Trabalho>) {
  return updateDoc(doc(db, "trabalhos", trabalhoId), dados);
}

/** Colega responde ao convite de participação (RF-52). Aceitar só tira o
 * convite da lista de pendentes; recusar também remove o colega de
 * participantesUids/Nomes — deixa de aparecer como colega desse trabalho. */
export function responderConvite(trabalho: Trabalho, uid: string, aceitar: boolean) {
  const convitesPendentes = (trabalho.convitesPendentes ?? []).filter((u) => u !== uid);

  if (aceitar) {
    return atualizarTrabalho(trabalho.id, { convitesPendentes });
  }

  const indice = (trabalho.participantesUids ?? []).indexOf(uid);
  const participantesUids = (trabalho.participantesUids ?? []).filter((u) => u !== uid);
  const participantesNomes = (trabalho.participantesNomes ?? []).filter(
    (_, i) => i !== indice,
  );
  return atualizarTrabalho(trabalho.id, {
    convitesPendentes,
    participantesUids,
    participantesNomes,
  });
}
