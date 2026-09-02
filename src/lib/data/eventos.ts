"use client";

import { useEffect, useState } from "react";
import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PerfilUsuario } from "@/lib/auth";

// Sub-área dentro de uma área temática "complexa" (2026-09-01) — ex.: dentro
// de "Projetos Integradores", cada curso/grupo de cursos vira uma sub-área
// própria ("Projetos Integradores – Ciências da Saúde"). descricao é livre,
// usada pra listar os cursos que caem ali (só informativo).
export type SubAreaTematica = { nome: string; descricao?: string };

// Área temática "complexa" — um grupo com várias sub-áreas dentro. Cada
// sub-área vira uma string própria em areasTematicas (formato
// "{nomeGrupo} – {subArea.nome}"), que é o que o resto do app já usa
// (submissão de trabalho, atribuição de avaliador, filtro em Trabalhos) —
// isso aqui é só o metadado que permite editar o grupo depois.
export type AreaTematicaComplexa = {
  id: string;
  nomeGrupo: string;
  subAreas: SubAreaTematica[];
};

export type Evento = {
  id: string;
  nome: string;
  descricao?: string;
  periodoSubmissao?: string;
  periodoAvaliacao?: string;
  destaque?: boolean;
  imagemDestaqueUrl?: string | null;
  // Lista "achatada" de todas as áreas selecionáveis desse evento — inclui
  // tanto as áreas simples (só um nome) quanto as strings geradas por cada
  // área complexa em areasTematicasComplexas. É essa lista que o resto do
  // app usa (formulário de submissão, atribuição de avaliador/moderador,
  // filtro em Trabalhos) — nunca ler areasTematicasComplexas diretamente
  // fora da tela de edição de áreas.
  areasTematicas?: string[];
  // Metadado das áreas complexas desse evento (2026-09-01) — só usado pra
  // poder reabrir e editar um grupo depois (ver AreaComplexaModal). As
  // strings geradas a partir daqui já estão espelhadas em areasTematicas.
  areasTematicasComplexas?: AreaTematicaComplexa[];
  // Se true, participantes externos (não-alunos da Fatec) podem se inscrever.
  // Padrão (ausente) = só alunos da Fatec, mantendo o comportamento anterior
  // a essa opção para eventos já cadastrados.
  aceitaExternos?: boolean;
  // Taxa de inscrição em reais (2026-08-26). Ausente/0 = evento gratuito,
  // fluxo de uma etapa só (comportamento anterior a essa feature).
  valorInscricao?: number;
  // Dados pro certificado (2026-08-27) — data em que o evento acontece de
  // fato (diferente do período de inscrições/avaliação acima), carga
  // horária e os dois nomes que assinam o certificado de apresentação/
  // declaração. Sem esses quatro campos preenchidos, a geração do PDF é
  // bloqueada (ver /api/certificados) — o aviso pede pra completar aqui antes.
  dataRealizacao?: string;
  cargaHoraria?: number;
  nomeDiretorAcademico?: string;
  nomePresidenteComissao?: string;
  // Código desse evento no sistema Edubox (2026-08-28) — usado pra lançar os
  // alunos participantes lá dentro (exigência legal do MEC). Preenchido à mão
  // pelo admin por enquanto: a busca automática desse código no banco do
  // Edubox depende do relay de IP fixo, ver /api/edubox/testar-conexao.
  codigoEdubox?: string;
  // Libera o botão "Simular pagamento" (ver /api/asaas/simular) mesmo com o
  // Asaas de produção configurado (2026-08-28) — só pra eventos de
  // demonstração, onde não faz sentido cobrar de verdade. Em qualquer outro
  // evento, a simulação continua bloqueada assim que ASAAS_API_KEY existir.
  permiteSimulacaoPagamento?: boolean;
};

/** Lê eventos do Firestore, escopado por RN-15: admin vê tudo; organizacao/avaliador só os seus. */
export function useEventos(perfil: PerfilUsuario | null | undefined) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;

    const restrito = perfil.papel !== "admin";
    if (restrito && (!perfil.eventosPermitidos || perfil.eventosPermitidos.length === 0)) {
      Promise.resolve().then(() => {
        setEventos([]);
        setCarregando(false);
      });
      return;
    }

    const ref = collection(db, "eventos");
    const q = restrito
      ? query(ref, where(documentId(), "in", perfil.eventosPermitidos!.slice(0, 30)))
      : query(ref);

    return onSnapshot(q, (snap) => {
      setEventos(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento),
      );
      setCarregando(false);
    });
  }, [perfil]);

  return { eventos, carregando };
}

/** Lê todos os eventos, sem escopo — para o aluno, que não é restrito por
 * RN-15 (RN-15 só se aplica a organizacao/avaliador). Exige estar logado. */
export function useEventosPublicos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, "eventos"), (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento));
      setCarregando(false);
    });
  }, []);

  return { eventos, carregando };
}
