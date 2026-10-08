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
  // Data de término (2026-09-30) — só preenchida pra evento "simples" de
  // mais de 1 dia (ex. Semana Acadêmica de Medicina, 08 a 10/10). Ausente/
  // igual a dataRealizacao = evento de 1 dia só, comportamento de sempre.
  // Substituiu um campo "Dias do evento" separado (número digitado à parte
  // — podia discordar da Data de realização, saía estranho no certificado:
  // "realizado em 08/10" com "16 horas" parecia 1 dia só de 16h). Com as
  // duas datas, o certificado imprime o período certo ("realizado de 08/10
  // a 10/10") e o número de dias é sempre derivado daqui — ver
  // diasDoEvento em src/lib/certificadoDias.ts, usado tanto pro cálculo de
  // horas proporcionais quanto pelo seletor de dia no Ensalamento.
  dataRealizacaoFim?: string;
  // Quantidade de janelas de presença (2026-10-08, pedido explícito do
  // usuário — Semana de Medicina tem 5 sessões: ontem à noite, hoje manhã+
  // tarde, amanhã manhã+tarde, mas só 3 dias de calendário). Sobrescreve
  // diasDoEvento() só pra contagem de presença/QR/horas proporcionais — ver
  // periodosDoEvento em src/lib/periodosPresenca.ts. Ausente = cada dia de
  // calendário é 1 janela só, comportamento de sempre. Escolha "Por dia"
  // vs. "Por período" no formulário de Eventos (criação e "Dados do
  // certificado") grava/limpa esses dois campos — não é mais só Firestore
  // direto (2026-10-08, formalizado depois do uso emergencial na Medicina).
  periodosPresenca?: number;
  // Mínimo de janelas confirmadas pra liberar o certificado (2026-10-08) —
  // ver presencaMinimaDoEvento em src/lib/periodosPresenca.ts. Ausente =
  // "pelo menos 1", comportamento de sempre.
  presencaMinimaPeriodos?: number;
  // Nome de cada período (2026-10-08, pedido explícito do usuário — "a
  // onde eu vou colocar o nome de cada período?"), índice 0 = período 1.
  // Opcional, por período: um ausente/vazio cai pro genérico "Dia N". Só
  // usado quando periodosPresenca está definido — aparece no seletor de QR
  // do Ensalamento e no gráfico de Relatórios no lugar de "Dia N".
  periodosPresencaLabels?: string[];
  // Carga horária: SEMPRE o total do evento, nunca muda de significado —
  // nem pra evento "simples" multi-dia. Pra qualquer papel que não seja
  // "participante" (aluno/avaliador/moderador/orientador/monitor), esse
  // total é só estampado direto na declaração. Horas proporcionais por dia
  // (só papel "participante"): ver cálculo em /api/certificados —
  // horasConcedidas = round(diasConfirmados / diasDoEvento(evento) ×
  // cargaHoraria), nunca passa do total (arredonda só no final, não por
  // dia, pra não acumular erro quando não divide exato como 16÷3).
  cargaHoraria?: number;
  // Quem assina o certificado desse evento (2026-10-05, substituiu
  // nomeDiretorAcademico/nomeCoordenadorPesquisa — 2 cargos fixos que
  // travaram de verdade quando precisou de um 3° cargo pra assinar, sem
  // onde encaixar). ids de src/lib/assinantesCertificado.ts (catálogo de
  // quem tem assinatura digitalizada cadastrada) — pelo menos 1 é exigido
  // (ver faltandoDadosEvento em src/app/api/certificados/route.ts).
  assinantesCertificadoIds?: string[];
  // Logo no cabeçalho da declaração, no lugar do texto "FATEC/IVP" padrão
  // (2026-10-06, pedido explícito do usuário pra Semana de Medicina — quis
  // a logo MEDFATEC só nesse evento, não em todos). Ausente = cabeçalho
  // padrão (a maioria dos eventos). id de um catálogo code-level em
  // src/lib/certificadosPdf.tsx (LOGO_CABECALHO) — cadastro manual, de
  // propósito, mesmo padrão dos assinantes de certificado; sem UI própria
  // ainda (só esse 1 evento usa até agora). Setado direto no Firestore.
  logoCertificadoId?: string;
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
  // Encerrar evento (2026-09-10, pedido do usuário) — botão do admin que
  // desliga TUDO de uma vez (banner de destaque, aceitar inscrição nova,
  // enviar trabalho), reversível ("clicar pra reabrir"), independente das
  // datas configuradas (é um interruptor manual por cima delas, não troca
  // as datas). Some da aba "Submissões" do aluno inteiramente — nem
  // aparece como card comum lá — mas continua visível em "Meus eventos"/
  // "Trabalhos" de quem já tinha se inscrito antes (é só descoberta de
  // evento NOVO que trava, não o histórico de quem já participava).
  encerrado?: boolean;
  encerradoEm?: Timestamp;
  // Modalidades de apresentação aceitas por esse evento (2026-09-17, pedido
  // da comissão — cada evento tem sua peculiaridade: a X MAC aceita as duas,
  // a MOPI só uma). Ausente/vazio = evento sem etapa de apresentação (não
  // ensala, aluno não escolhe modalidade na submissão). 1 item = só aquela
  // modalidade, auto-selecionada, sem pergunta pro aluno. 2 itens = escolha
  // livre, como era o comportamento único de antes dessa opção existir. Ver
  // SubmeterTrabalhoModal (filtra as opções) e /ensalamento (só ensala
  // trabalhos de eventos com isso preenchido).
  modalidadesApresentacao?: ("oral" | "roda_conversa")[];
  // Configuração da grade automática de ensalamento (2026-09-17) — preenchida
  // direto na aba Ensalamento (não no wizard/Configurações de Eventos, é
  // específico desse fluxo). Ausente = grade automática ainda não configurada,
  // botão "Gerar grade automaticamente" fica desabilitado. Mesmo padrão de
  // prazoEdicaoTrabalho (Timestamp.fromDate calculado no client). Ver
  // src/lib/data/sessoes.ts.
  apresentacaoInicio?: Timestamp;
  apresentacaoFim?: Timestamp;
  // Só se aplica a modalidade "oral" (fatiada por minuto). "roda_conversa"
  // usa vagasBannerPorSala abaixo — banner/pôster fica exposto o bloco
  // inteiro, não é fatiado por tempo (ver montarGradeAutomatica).
  duracaoApresentacaoMinutos?: number;
  // Quantos trabalhos cabem ao mesmo tempo numa sala de roda de conversa
  // (2026-09-28) — todos expostos juntos, o bloco inteiro
  // (apresentacaoInicio–apresentacaoFim), diferente da oral. Só relevante se
  // o evento aceita "roda_conversa" em modalidadesApresentacao.
  vagasBannerPorSala?: number;
  // Quais salas do catálogo único (coleção salas/, ver src/lib/data/salas.ts,
  // 2026-09-28) esse evento usa na grade automática — o catálogo é
  // compartilhado entre todos os eventos, cada um escolhe seu subconjunto
  // aqui. Ausente/vazio = nenhuma sala escolhida ainda, "Gerar grade" fica
  // desabilitado (mesmo espírito de apresentacaoInicio acima).
  salasIds?: string[];
  // Modelo do evento (2026-09-22, pedido da comissão — nem todo evento tem
  // trabalho acadêmico, ex. palestra/curso/workshop). Ausente = modelo de
  // hoje (trabalho, avaliação, ensalamento — todos os campos acima). Nesse
  // caso, aluno só se inscreve/paga (fluxo já genérico de inscricoesEvento)
  // e recebe um certificado de participação — nenhum dos campos de trabalho
  // acima é preenchido. Ver /trabalhos (mostra lista de inscritos em vez das
  // abas de avaliação) e /api/certificados?papel=participante.
  tipo?: "simples";
  // Certificado de participação liberado manualmente pela organização
  // (2026-09-22) — só usado quando tipo === "simples". Mesmo espírito de
  // Trabalho.certificadoLiberado, só que por evento inteiro (aqui não tem
  // trabalho nenhum pra liberar um por um).
  certificadosLiberados?: boolean;
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

/** Pode ENVIAR um trabalho novo agora? Dois motivos pra travar, checados
 * juntos (2026-09-10): (1) evento.encerrado — interruptor manual do admin,
 * vale na hora, independe de qualquer data configurada; (2) passou de
 * fimEnvioTrabalho (23:59 do dia de fim do período de envio, definido em
 * Configurações). Ausente = sem prazo, nunca trava por data (mesmo padrão
 * de "campo ausente = sem restrição" do resto do app). Não confundir com
 * dentroDoPrazoEdicao (em aluno/trabalhos/page.tsx) — aquele trava EDITAR
 * um trabalho já enviado, este trava ENVIAR um novo. */
export function dentroDoPrazoEnvio(evento: Evento | undefined): boolean {
  if (evento?.encerrado) return false;
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
