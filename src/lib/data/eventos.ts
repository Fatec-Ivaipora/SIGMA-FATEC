"use client";

import { useEffect, useState } from "react";
import { collection, documentId, onSnapshot, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PerfilUsuario } from "@/lib/auth";
import { useMinhasInscricoes } from "@/lib/data/inscricoes";

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
  // Texto pronto pro badge "Inscrições: X" (nome histórico confuso — é
  // sobre INSCRIÇÃO/pagamento, não sobre enviar trabalho; não renomeado
  // porque já é lido em vários lugares do app, risco não vale a pena).
  periodoSubmissao?: string;
  // Período de ENVIO do trabalho em si (2026-09-09, pedido do coordenador)
  // — diferente de periodoSubmissao acima (que é sobre inscrição/pagamento).
  // Chamado de "envio" no código pra não colidir de nome com o campo
  // antigo, mas aparece como "Submissão" pro usuário. fimEnvioTrabalho
  // bloqueia ENVIAR um trabalho novo (ver dentroDoPrazoEnvio abaixo) — não
  // confundir com prazoEdicaoTrabalho, que trava EDITAR um já enviado.
  periodoEnvioTrabalho?: string;
  inicioEnvioTrabalho?: string;
  fimEnvioTrabalho?: string;
  // Datas "cruas" (ISO, 2026-09-09) por trás do texto de periodoSubmissao —
  // até aqui só existiam como estado local do formulário de criação, nunca
  // eram salvas, então não dava pra reabrir e editar depois (o texto pronto
  // não é "desmontável" de volta pra um <input type="date">). Guardadas
  // agora pra alimentar o modal de Configurações (editar nome/data depois
  // de criado). Eventos criados antes disso ficam sem esses campos — o
  // modal de Configurações trata isso como "nunca preenchido", o admin só
  // digita de novo uma vez.
  inicioInscricoes?: string;
  fimInscricoes?: string;
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
  // Renomeado de nomePresidenteComissao (2026-09-04) — o cargo no
  // certificado mudou de "Presidente da Comissão Organizadora" pra
  // "Coordenador(a) da Pesquisa e Formação Científica" (documento oficial
  // atualizado, ver CERTIFICADOS APRESENTAÇÃO - PARA IMPRESSÃO-C.ORIENTADOR).
  nomeCoordenadorPesquisa?: string;
  // Número do primeiro certificado desse evento no "REGISTRO SOB O N°" —
  // definido pela organização/comissão (documento próprio deles, fora do
  // sistema); os certificados seguintes desse evento saem em sequência a
  // partir daqui (ver obterNumeroRegistro em /api/certificados). Ausente =
  // começa em 1.
  numeroRegistroInicial?: number;
  // Código desse evento no sistema Edubox (2026-08-28) — usado pra lançar os
  // alunos participantes lá dentro (exigência legal do MEC). Preenchido à mão
  // pelo admin por enquanto: a busca automática desse código no banco do
  // Edubox depende do relay de IP fixo, ver /api/edubox/testar-conexao.
  codigoEdubox?: string;
  // Prazo de edição do trabalho pelo aluno (2026-09-04) — 23:55 do dia de
  // fim das inscrições (fimInscricoes na criação do evento), gravado como
  // Timestamp real pra dar pra comparar com "agora" tanto no client quanto
  // nas firestore.rules. Ausente = sem prazo definido, edição nunca trava
  // (eventos criados antes dessa feature, ou sem fimInscricoes preenchido).
  prazoEdicaoTrabalho?: Timestamp;
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

/** Participante externo (sem vínculo com a Fatec) só vê/participa dos
 * eventos marcados aceitaExternos; aluno da Fatec vê todos. Centralizado
 * aqui (2026-09-04) — antes cada tela do aluno repetia esse filtro na mão. */
export function eventosParaAluno(eventos: Evento[], vinculoFatec: boolean | undefined) {
  return vinculoFatec === false ? eventos.filter((e) => e.aceitaExternos) : eventos;
}

/** Prazo de ENVIAR um trabalho novo (2026-09-09, pedido do coordenador) —
 * até 23:59 do dia de fim do período de envio (eventos/{id}.fimEnvioTrabalho,
 * definido em Configurações). Ausente = sem prazo, nunca trava (mesmo
 * padrão de "campo ausente = sem restrição" usado no resto do app). Não
 * confundir com dentroDoPrazoEdicao (em aluno/trabalhos/page.tsx) — aquele
 * trava EDITAR um trabalho já enviado, este trava ENVIAR um novo. */
export function dentroDoPrazoEnvio(evento: Evento | undefined): boolean {
  if (!evento?.fimEnvioTrabalho) return true;
  return new Date(`${evento.fimEnvioTrabalho}T23:59:59`).getTime() > Date.now();
}

/** Indicador do item "Eventos" no menu do aluno (2026-09-04): só acende se
 * existe algum evento visível pra ele (já filtrado por vinculoFatec) em que
 * ele ainda não tem NENHUMA inscricaoEvento — ou seja, ainda não clicou em
 * "Participar" nesse evento. Assim que ele se inscreve (mesmo sem ter
 * enviado trabalho ainda), o indicador some pra esse evento — pedido
 * explícito do usuário. Usado nas telas que não têm essa lista pronta na
 * mão (as que já têm — /aluno e /aluno/eventos — calculam isso na hora
 * pra não abrir mais um listener duplicado). */
export function useIndicadorEventos(perfil: PerfilUsuario | null | undefined, uid: string | undefined) {
  const { eventos: todosEventos } = useEventosPublicos();
  const { inscricoes } = useMinhasInscricoes(uid);
  const eventos = eventosParaAluno(todosEventos, perfil?.vinculoFatec);
  return eventos.some((e) => !inscricoes.has(e.id));
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
