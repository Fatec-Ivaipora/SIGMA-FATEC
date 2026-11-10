"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { Modal } from "@/components/Modal";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { temPapel } from "@/lib/auth";
import { useEventos, dentroDoPrazoAvaliacao, chegouODiaDoEvento, type Evento } from "@/lib/data/eventos";
import { renderResumoFormatado } from "@/lib/textoFormatado";
import { useSessoesDoEvento, type Sessao } from "@/lib/data/sessoes";
import { useSalasCatalogo } from "@/lib/data/salas";
import {
  useTrabalhos,
  atualizarTrabalho,
  type NotasCriterios,
  type NotasCriteriosApresentacao,
  type Trabalho,
  type TrabalhoStatus,
} from "@/lib/data/trabalhos";
import { notificarStatusTrabalho } from "@/lib/notificarEmail";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import {
  CRITERIOS_AVALIACAO,
  NOTAS_AVALIACAO,
  type CriterioDef,
  type NotaOpcao,
} from "@/lib/criteriosAvaliacao";

const TODOS_MEUS_EVENTOS = "Todos os meus eventos";

// "Pontuação: cada critério será avaliado de 1 a 3 pontos, conforme os
// níveis: 1 – Regular, 2 – Bom, 3 – Excelente" (texto exato pedido pelo
// usuário) — soma por trabalho vai de 7 a 21 agora (7 critérios), não mais
// 7 a 35.
const NOTAS_APRESENTACAO: NotaOpcao[] = [
  { valor: 1, label: "Regular" },
  { valor: 2, label: "Bom" },
  { valor: 3, label: "Excelente" },
];

// Liga/desliga o botão "Rejeitar trabalho" (2026-11-03, pedido explícito do
// usuário — "oculte o botão... por hora não vamos usar nesse evento mas
// deixe o código dele quando formos reativálo"). Todo o resto da feature
// (painel de confirmação, onRejeitar, e-mail "rejeitado") continua intacto
// — só essa flag esconde o botão da tela. Pra reativar, basta voltar pra
// `true`.
const REJEICAO_HABILITADA = false;

// Critérios da etapa de Apresentação (item 6.4 do edital X MAC, conferido
// 2026-09-08 contra o PDF real — substituem os 5 placeholder de antes, que
// nunca bateram com o edital de verdade). 7 critérios, 1 a 3 cada (2026-11-05,
// pedido explícito do usuário — "1 – Regular, 2 – Bom, 3 – Excelente"), soma
// 7-21 — ver NotasCriteriosApresentacao e NOTAS_APRESENTACAO acima.
// `descricao` ver comentário acima.
const CRITERIOS_APRESENTACAO: CriterioDef[] = [
  {
    key: "pontualidade",
    label: "Pontualidade para início da apresentação",
    descricao: "O(s) apresentador(es) estavam presentes e começaram no horário agendado pelo ensalamento.",
  },
  {
    key: "numeroApresentadores",
    label: "Respeito ao número máximo de apresentadores",
    descricao: "No máximo 2 pessoas apresentaram (edital, item 3.2 — é facultativo, mas o limite é esse).",
  },
  {
    key: "linguagemTecnica",
    label: "Uso de linguagem formal e técnica apropriada",
    descricao:
      "Linguagem formal e adequada ao conteúdo técnico/científico do trabalho, sem informalidade excessiva.",
  },
  {
    key: "qualidadeSlides",
    label: "Qualidade dos slides",
    descricao:
      "Slides (quando usados) claros, legíveis e bem organizados, sem poluição visual ou excesso de texto.",
  },
  {
    key: "clarezaObjetividade",
    label: "Clareza e objetividade das informações",
    descricao: "As informações foram passadas de forma clara e direta, sem rodeio nem informação desnecessária.",
  },
  {
    key: "ordemLogica",
    label: "Ordem lógica da apresentação",
    descricao:
      "Seguiu uma sequência lógica — ex.: introdução, objetivo, método, resultados, conclusão — fácil de acompanhar.",
  },
  {
    key: "postura",
    label: "Postura adequada ao longo da apresentação",
    descricao:
      "Postura profissional durante toda a apresentação (tom de voz, postura corporal, respeito ao tempo e ao público).",
  },
];

/** Lista + formulário de nota reaproveitado tanto pela aba Avaliação
 * (avaliador) quanto pela aba Apresentação (moderador, 2026-08-26) — muda a
 * lista de trabalhos, os critérios, a ESCALA de nota (`escalaNotas`,
 * 2026-11-05 — cada painel pode ter a sua, ver NOTAS_AVALIACAO/
 * NOTAS_APRESENTACAO) e o que acontece ao enviar/pedir revisão. */
function PainelTrabalhos({
  trabalhos,
  eventos,
  criterios,
  escalaNotas,
  mostrarDescricaoCriterio = true,
  mostrarResumo = true,
  mostrarAutores = false,
  statusPendente,
  mensagemVazia,
  permiteRevisao,
  permiteRejeitar,
  respeitaPrazoAvaliacao,
  respeitaLiberacaoNoDiaEvento,
  permitePresenca,
  agruparPorSala,
  sessoesPorId,
  nomesSalas,
  duracaoApresentacaoMinutos,
  onEnviarNota,
  onSolicitarRevisao,
  onRejeitar,
  onMarcarPresenca,
}: {
  trabalhos: Trabalho[];
  eventos: Evento[];
  criterios: CriterioDef[];
  escalaNotas: NotaOpcao[];
  // Esconde a descrição de cada critério (2026-11-05, pedido explícito do
  // usuário — só na Apresentação/moderador, "muito carregado"; a Avaliação
  // do resumo mantém, as descrições lá são mais substanciais). Default true
  // (mostra), igual sempre foi.
  mostrarDescricaoCriterio?: boolean;
  // Apresentação (moderador, 2026-11-05, pedido explícito do usuário — "não
  // precisa mostrar o resumo, só o título e o nome dos autores") não é mais
  // às cegas feito a Avaliação (RF-14): o moderador já sabe quem apresenta,
  // não precisa do resumo completo pra pontuar os 7 critérios da
  // apresentação. Default mostrarResumo=true/mostrarAutores=false mantém o
  // comportamento de sempre na Avaliação.
  mostrarResumo?: boolean;
  mostrarAutores?: boolean;
  statusPendente: TrabalhoStatus;
  mensagemVazia: string;
  permiteRevisao: boolean;
  // Rejeitar direto (2026-11-04, pedido explícito do usuário — "caso o
  // trabalho não siga os 5 critérios avaliativos") — só na etapa Avaliação
  // (resumo), não em Apresentação. Pula revisão/apresentação/resultado
  // final: vai direto pra "Não aceito", decisão final, sem segunda chance —
  // diferente de "Solicitar revisão", que devolve pro aluno corrigir.
  permiteRejeitar?: boolean;
  // Prazo final de avaliação (2026-11-03, pedido explícito do usuário) — só
  // true na aba Avaliação (avaliador); Apresentação (moderador) não tem
  // prazo próprio ainda. Ver dentroDoPrazoAvaliacao em src/lib/data/eventos.
  respeitaPrazoAvaliacao?: boolean;
  // Moderador só avalia a partir do dia do evento (2026-11-09, pedido
  // explícito do usuário — manda os empatados com antecedência pra montar
  // o cronograma, mas trava a nota até o dia de verdade). Só true na aba
  // Apresentação (moderador); Avaliação (avaliador) não tem essa trava. O
  // trabalho continua abrindo normal pra ver os critérios — só os botões de
  // nota/"Enviar nota" ficam desabilitados, com aviso. Ver
  // chegouODiaDoEvento em src/lib/data/eventos.
  respeitaLiberacaoNoDiaEvento?: boolean;
  // Confirmação de presença pra quem NÃO está empatado (2026-11-10,
  // pedido explícito do usuário — "tem alunos que já está em primeiro...
  // mas não vai vir apresentar, e isso é injusto com os demais"). Só true
  // na aba Apresentação (moderador); esses trabalhos chegam aqui com
  // moderadorUid preenchido mas status continua o que já era (normalmente
  // "aceito") — ver liberarTrabalhosParaModeradores em
  // src/app/trabalhos/page.tsx. Marcar falta tira o trabalho do pódio na
  // hora (ver analiseResultadoPorArea); quem vinha atrás sobe sozinho.
  permitePresenca?: boolean;
  // Agrupa por sala, com cabeçalho "Evento X - Sala Y" colapsável, e mostra
  // o horário de cada trabalho (2026-11-10, pedido explícito do usuário —
  // "acho legal se tiver ali na frente do nome do trabalho o horário...
  // esses trabalhos estarem dentro de um menu que se clicar ele expande").
  // Só true na aba Apresentação (moderador); precisa de sessoesPorId/
  // nomesSalas/duracaoApresentacaoMinutos pra resolver sala e horário —
  // sem eles, cai de volta na lista achatada de sempre.
  agruparPorSala?: boolean;
  sessoesPorId?: Map<string, Sessao>;
  nomesSalas?: Map<string, string>;
  duracaoApresentacaoMinutos?: number;
  onEnviarNota: (id: string, soma: number, notas: Record<string, number>) => void;
  // soma/notas também aqui (2026-11-05, pedido explícito do usuário — "antes
  // de mandar para revisão o professor precisa atribuir uma nota", pra não
  // dar uma segunda chance de melhorar a nota depois que o aluno corrige).
  onSolicitarRevisao?: (
    id: string,
    comentario: string,
    soma: number,
    notas: Record<string, number>,
  ) => void;
  onRejeitar?: (id: string) => void;
  onMarcarPresenca?: (id: string, presente: boolean) => void;
}) {
  const [busca, setBusca] = useState("");
  const [eventoId, setEventoId] = useState(TODOS_MEUS_EVENTOS);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, number>>({});
  // "notas" (padrão) | "revisao" (pedir ajuste) | "rejeicao" (confirmar
  // rejeição definitiva) — 3 sub-telas dentro do painel de avaliação de um
  // trabalho, nunca mais de uma aberta ao mesmo tempo.
  const [modoAcao, setModoAcao] = useState<"notas" | "revisao" | "rejeicao">("notas");
  const [comentarioRevisao, setComentarioRevisao] = useState("");

  const somaNotas = criterios.reduce((acc, c) => acc + (notas[c.key] ?? 0), 0);
  const notasCompletas = criterios.every((c) => notas[c.key]);
  const notaMinima = Math.min(...escalaNotas.map((n) => n.valor));
  const notaMaxima = Math.max(...escalaNotas.map((n) => n.valor));

  // Busca só por título (2026-11-03, pedido explícito do usuário — "vamos
  // remover o nome dos alunos" da tela do avaliador, avaliação não deve
  // identificar o autor). Nunca filtra por alunoNome.
  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return trabalhos.filter((t) => {
      const bateEvento = eventoId === TODOS_MEUS_EVENTOS || t.eventoId === eventoId;
      const bateBusca = !termo || t.titulo.toLowerCase().includes(termo);
      return bateEvento && bateBusca;
    });
  }, [busca, eventoId, trabalhos]);

  function abrirAvaliacao(id: string) {
    setAvaliando(id);
    setNotas({});
    setModoAcao("notas");
    setComentarioRevisao("");
  }

  function fecharAvaliacao() {
    setAvaliando(null);
    setNotas({});
    setModoAcao("notas");
    setComentarioRevisao("");
  }

  function enviar(id: string) {
    if (!notasCompletas || bloqueadoPorData) return;
    onEnviarNota(id, somaNotas, notas);
    setAvaliando(null);
    setNotas({});
  }

  function enviarRevisao(id: string) {
    if (!comentarioRevisao.trim() || !onSolicitarRevisao) return;
    if (exigeNotaAntesDeRevisao && !notasCompletas) return;
    onSolicitarRevisao(id, comentarioRevisao.trim(), somaNotas, notas);
    setAvaliando(null);
    setNotas({});
    setModoAcao("notas");
    setComentarioRevisao("");
  }

  function confirmarRejeicao(id: string) {
    if (!onRejeitar) return;
    onRejeitar(id);
    setAvaliando(null);
    setModoAcao("notas");
  }

  // Prazo final de avaliação (2026-11-03) — eventos (dentre os que essa
  // pessoa atua) que têm prazoAvaliacao definido, pra avisar no topo da
  // aba. Normalmente é só 1 evento; lista cada um porque, em tese, dá pra
  // atuar em mais de um evento com prazos diferentes.
  const eventosComPrazo = respeitaPrazoAvaliacao
    ? eventos.filter((ev) => ev.prazoAvaliacao)
    : [];

  // Liberação no dia do evento (2026-11-09) — mesma ideia do bloco acima,
  // mas pro moderador: avisa no topo de quais eventos a avaliação ainda não
  // abriu. Só entram eventos que de fato têm trabalho pendente aqui (não
  // adianta avisar de um evento sem nada pra avaliar ainda).
  const eventosBloqueadosPorData = respeitaLiberacaoNoDiaEvento
    ? eventos.filter(
        (ev) =>
          ev.dataRealizacao &&
          !chegouODiaDoEvento(ev) &&
          trabalhos.some((t) => t.eventoId === ev.id && t.status === statusPendente),
      )
    : [];

  // Modal de avaliação (2026-11-03, pedido explícito do usuário — "hoje tá
  // muito ruim, ele clica, desce a avaliação ali mesmo, fica confuso e
  // depende do tamanho do título quebra os botões"). Antes a avaliação
  // abria embutida embaixo do próprio card, empurrando a lista; agora abre
  // num modal com fundo escurecido, focando só naquele trabalho — resolve
  // os dois problemas de uma vez (confusão de contexto + botões quebrando,
  // já que o modal é bem mais largo que um card). Busca em `trabalhos`
  // (não em `trabalhosFiltrados`) de propósito: se a busca/filtro mudar
  // com o modal aberto, ele continua mostrando o mesmo trabalho.
  const trabalhoAvaliando = trabalhos.find((t) => t.id === avaliando);
  // Nota obrigatória antes de revisão NÃO vale pros trabalhos legados —
  // ver comentário em enviarRevisao.
  const exigeNotaAntesDeRevisao = !trabalhoAvaliando?.revisaoLegado;
  const eventoDoTrabalhoAvaliando = eventos.find(
    (e) => e.id === trabalhoAvaliando?.eventoId,
  );
  const bloqueadoPorData =
    !!respeitaLiberacaoNoDiaEvento && !chegouODiaDoEvento(eventoDoTrabalhoAvaliando);

  // Horário específico do trabalho dentro da sessão (2026-11-10) — mesma
  // conta do PDF do ensalamento (horarioInicio + índice × duração); roda de
  // conversa não tem horário por trabalho, todos ficam expostos juntos.
  function horarioDoTrabalho(t: Trabalho): string | null {
    if (!t.sessaoId) return null;
    const sessao = sessoesPorId?.get(t.sessaoId);
    if (!sessao || sessao.modalidade !== "oral" || !duracaoApresentacaoMinutos) return null;
    const indice = sessao.trabalhoIds.indexOf(t.id);
    if (indice < 0) return null;
    const inicio = sessao.horarioInicio.toDate().getTime() + indice * duracaoApresentacaoMinutos * 60000;
    return new Date(inicio).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // Grupos "Evento X - Sala Y" (2026-11-10) — só quando agruparPorSala.
  // Quem não tem sessão resolvida (ainda não ensalado, ou dado antigo sem
  // sessaoId) cai num grupo "Sem sala definida" no fim, nunca some da
  // lista.
  const SEM_SALA = "sem-sala";
  const gruposPorSala = useMemo(() => {
    if (!agruparPorSala) return null;
    const mapa = new Map<string, Trabalho[]>();
    for (const t of trabalhosFiltrados) {
      const sessao = t.sessaoId ? sessoesPorId?.get(t.sessaoId) : undefined;
      const chave = sessao ? `${t.eventoId}::${sessao.salaId}` : SEM_SALA;
      const lista = mapa.get(chave) ?? [];
      lista.push(t);
      mapa.set(chave, lista);
    }
    // "Sem sala" sempre por último, o resto em ordem alfabética do nome.
    return new Map(
      [...mapa.entries()].sort(([a], [b]) => {
        if (a === SEM_SALA) return 1;
        if (b === SEM_SALA) return -1;
        return a.localeCompare(b, "pt-BR");
      }),
    );
  }, [agruparPorSala, trabalhosFiltrados, sessoesPorId]);
  const [salasAbertas, setSalasAbertas] = useState<Set<string>>(new Set());
  function alternarSala(chave: string) {
    setSalasAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function renderLinhaTrabalho(t: Trabalho) {
    const ganhouExcecaoDePrazo = t.status === "entregue_com_atraso" || t.revisaoLegado === true;
    const prazoEncerrado =
      respeitaPrazoAvaliacao &&
      !ganhouExcecaoDePrazo &&
      !dentroDoPrazoAvaliacao(eventos.find((e) => e.id === t.eventoId));
    const mostraAvaliar =
      t.status === statusPendente || (respeitaPrazoAvaliacao && ganhouExcecaoDePrazo);
    const podeMarcarPresenca =
      permitePresenca &&
      !mostraAvaliar &&
      t.status !== "apresentado" &&
      typeof t.compareceuApresentacao !== "boolean";
    const presencaJaMarcada =
      permitePresenca && t.status !== "apresentado" && typeof t.compareceuApresentacao === "boolean";
    const horario = horarioDoTrabalho(t);
    return (
      <div key={t.id} className="rounded-2xl border border-fatec-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-fatec-navy-900">
              {horario && (
                <span className="mr-1.5 font-semibold text-fatec-sky-600">{horario} —</span>
              )}
              {tituloExibicao(t.titulo)}
            </p>
            <p className="text-sm text-fatec-muted">
              {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={t.status} />
            {mostraAvaliar &&
              (prazoEncerrado ? (
                <span className="text-xs font-medium text-fatec-muted">
                  Prazo de avaliação encerrado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => abrirAvaliacao(t.id)}
                  className="rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                >
                  Avaliar
                </button>
              ))}
            {podeMarcarPresenca && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMarcarPresenca?.(t.id, true)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Presente
                </button>
                <button
                  type="button"
                  onClick={() => onMarcarPresenca?.(t.id, false)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  Faltou
                </button>
              </div>
            )}
            {presencaJaMarcada && (
              <span
                className={`text-xs font-semibold ${
                  t.compareceuApresentacao ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {t.compareceuApresentacao ? "Presente" : "Faltou"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {eventosComPrazo.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-fatec-orange-200 bg-fatec-orange-50 px-4 py-3">
          {eventosComPrazo.map((ev) => (
            <p key={ev.id} className="text-sm text-fatec-orange-700">
              <span className="font-semibold">
                {eventosComPrazo.length > 1 ? `${ev.nome} — prazo` : "Prazo"} para avaliar:
              </span>{" "}
              até{" "}
              {ev.prazoAvaliacao!.toDate().toLocaleDateString("pt-BR")} às{" "}
              {ev.prazoAvaliacao!.toDate().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Depois disso não dá mais pra dar nota, pedir revisão ou rejeitar.
            </p>
          ))}
        </div>
      )}

      {eventosBloqueadosPorData.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-fatec-orange-200 bg-fatec-orange-50 px-4 py-3">
          {eventosBloqueadosPorData.map((ev) => (
            <p key={ev.id} className="text-sm text-fatec-orange-700">
              <span className="font-semibold">
                {eventosBloqueadosPorData.length > 1 ? `${ev.nome} — avaliação` : "Avaliação"} será
                liberada no dia:
              </span>{" "}
              {new Date(`${ev.dataRealizacao}T00:00:00`).toLocaleDateString("pt-BR")}. Dá pra abrir e
              ver os trabalhos designados, mas as notas só liberam nesse dia.
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
          <Search className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título"
            className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
          >
            <option value={TODOS_MEUS_EVENTOS}>{TODOS_MEUS_EVENTOS}</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
            strokeWidth={1.75}
          />
        </div>
      </div>

      {trabalhosFiltrados.length === 0 && (
        <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
          {mensagemVazia}
        </p>
      )}

      {gruposPorSala
        ? Array.from(gruposPorSala.entries()).map(([chave, lista]) => {
            const primeiro = lista[0];
            const sessaoDoGrupo = primeiro.sessaoId ? sessoesPorId?.get(primeiro.sessaoId) : undefined;
            const nomeSala = sessaoDoGrupo ? nomesSalas?.get(sessaoDoGrupo.salaId) : undefined;
            const eventoNome = eventos.find((e) => e.id === primeiro.eventoId)?.nome;
            const titulo =
              chave === SEM_SALA
                ? "Sem sala definida ainda"
                : `${eventoNome ?? "Evento"} - Sala ${nomeSala ?? "?"}`;
            const aberto = salasAbertas.has(chave);
            return (
              <div key={chave} className="overflow-hidden rounded-2xl border border-fatec-line bg-white">
                <button
                  type="button"
                  onClick={() => alternarSala(chave)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-fatec-navy-50"
                >
                  <span className="font-semibold text-fatec-navy-900">
                    {titulo}{" "}
                    <span className="font-normal text-fatec-muted">({lista.length})</span>
                  </span>
                  {aberto ? (
                    <ChevronDown className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={2} />
                  )}
                </button>
                {aberto && (
                  <div className="flex flex-col gap-3 border-t border-fatec-line p-5">
                    {lista.map((t) => renderLinhaTrabalho(t))}
                  </div>
                )}
              </div>
            );
          })
        : trabalhosFiltrados.map((t) => renderLinhaTrabalho(t))}

      <Modal
        open={!!trabalhoAvaliando}
        onClose={fecharAvaliacao}
        title="Avaliar trabalho"
        size="lg"
      >
        {trabalhoAvaliando && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-bold leading-snug text-fatec-navy-900">
                {tituloExibicao(trabalhoAvaliando.titulo)}
              </h3>
              <p className="mt-1 text-sm text-fatec-muted">
                {eventoDoTrabalhoAvaliando?.nome ?? trabalhoAvaliando.eventoId}
              </p>
              {mostrarAutores && (
                <p className="mt-1 text-sm text-fatec-ink">
                  <span className="font-medium text-fatec-navy-900">Autor(es): </span>
                  {[trabalhoAvaliando.alunoNome, ...(trabalhoAvaliando.participantesNomes ?? [])].join(
                    ", ",
                  )}
                </p>
              )}
            </div>

            {mostrarResumo && trabalhoAvaliando.palavrasChave?.trim() && (
              <p className="text-sm text-fatec-ink">
                <span className="font-medium text-fatec-navy-900">Palavras-chave: </span>
                {trabalhoAvaliando.palavrasChave}
              </p>
            )}
            {mostrarResumo && trabalhoAvaliando.resumo && (
              <div className="text-sm leading-relaxed text-fatec-ink">
                {renderResumoFormatado(trabalhoAvaliando.resumo)}
              </div>
            )}

            {bloqueadoPorData && (
              <p className="rounded-xl border border-fatec-orange-200 bg-fatec-orange-50 px-4 py-3 text-sm font-medium text-fatec-orange-700">
                A avaliação será liberada no dia{" "}
                {new Date(`${eventoDoTrabalhoAvaliando?.dataRealizacao}T00:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
                . Até lá dá pra ver os critérios, mas não pra dar nota.
              </p>
            )}

            {modoAcao === "notas" ? (
              <>
                <div className="flex flex-col gap-3 border-t border-fatec-line pt-5">
                  <div>
                    <span className="text-sm font-medium text-fatec-navy-900">
                      Critérios ({notaMinima} a {notaMaxima} cada — a nota final é a soma)
                    </span>
                    {/* Legenda dos rótulos 1 vez só (2026-11-05, pedido
                      * explícito do usuário) — cada botão mostra só o
                      * número, igual o padrão da Avaliação. */}
                    {escalaNotas.some((n) => n.label) && (
                      <p className="mt-0.5 text-xs text-fatec-muted">
                        {escalaNotas.map((n) => `${n.valor} ${n.label}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  {/* Padrão idêntico ao da Avaliação (2026-11-05, pedido
                    * explícito do usuário — "volte ao padrão do avaliador
                    * sem a descrição só") — única diferença é
                    * mostrarDescricaoCriterio, escondido na Apresentação. */}
                  {criterios.map((c) => (
                    <div
                      key={c.key}
                      className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 sm:max-w-sm">
                        <p className="text-sm font-medium text-fatec-navy-900">{c.label}</p>
                        {mostrarDescricaoCriterio && (
                          <p className="text-xs text-fatec-muted">{c.descricao}</p>
                        )}
                      </div>
                      <div className="flex flex-none gap-2">
                        {escalaNotas.map((n) => (
                          <button
                            key={n.valor}
                            type="button"
                            disabled={bloqueadoPorData}
                            onClick={() => setNotas((prev) => ({ ...prev, [c.key]: n.valor }))}
                            title={n.label}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              notas[c.key] === n.valor
                                ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                                : "border-fatec-line text-fatec-navy-900 hover:border-fatec-orange-500/60"
                            }`}
                          >
                            {n.valor}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-sm text-fatec-muted">
                    Total:{" "}
                    <span className="font-semibold text-fatec-navy-900">{somaNotas}</span> /{" "}
                    {criterios.length * notaMaxima}
                  </p>
                </div>

                {/* Nota obrigatória ANTES de revisão (2026-11-05, pedido
                  * explícito do usuário) — "Solicitar revisão" também exige
                  * notasCompletas agora, não só "Enviar nota". Sem isso, dava
                  * pra mandar pra revisão sem nota nenhuma, o aluno corrigia,
                  * e só aí o avaliador dava nota já vendo a versão corrigida
                  * — uma segunda chance de melhorar a nota, o que não era a
                  * intenção. NÃO vale pros ~49 trabalhos legados
                  * (exigeNotaAntesDeRevisao) — ver comentário em
                  * ganhouExcecaoDePrazo mais acima. */}
                {permiteRevisao && exigeNotaAntesDeRevisao && !notasCompletas && (
                  <p className="text-xs text-fatec-muted">
                    Preencha todos os critérios antes de enviar a nota ou pedir revisão — a nota fica travada mesmo se o trabalho for pra revisão.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => enviar(trabalhoAvaliando.id)}
                    disabled={!notasCompletas || bloqueadoPorData}
                    className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                  >
                    Enviar nota
                  </button>
                  {permiteRevisao && (
                    <button
                      type="button"
                      onClick={() => setModoAcao("revisao")}
                      disabled={exigeNotaAntesDeRevisao && !notasCompletas}
                      className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:border-fatec-navy-100 disabled:text-fatec-muted"
                    >
                      Solicitar revisão
                    </button>
                  )}
                  {permiteRejeitar && (
                    <button
                      type="button"
                      onClick={() => setModoAcao("rejeicao")}
                      className="rounded-xl border border-rose-200 px-6 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Rejeitar trabalho
                    </button>
                  )}
                </div>
              </>
            ) : modoAcao === "revisao" ? (
              <>
                {notasCompletas ? (
                  <p className="border-t border-fatec-line pt-5 text-sm text-fatec-muted">
                    Nota já registrada:{" "}
                    <span className="font-semibold text-fatec-navy-900">
                      {somaNotas}/{criterios.length * notaMaxima}
                    </span>{" "}
                    — essa é a nota final, não muda depois mesmo que o aluno corrija.
                  </p>
                ) : (
                  <p className="border-t border-fatec-line pt-5 text-sm text-fatec-muted">
                    Trabalho antigo, de antes da nota ficar obrigatória pra revisão — segue sem nota por enquanto, igual sempre foi.
                  </p>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-fatec-navy-900">
                    O que o aluno precisa revisar?
                  </span>
                  <textarea
                    rows={3}
                    value={comentarioRevisao}
                    onChange={(e) => setComentarioRevisao(e.target.value)}
                    placeholder="Explique o que precisa ser ajustado antes de reenviar"
                    className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => enviarRevisao(trabalhoAvaliando.id)}
                    disabled={!comentarioRevisao.trim() || (exigeNotaAntesDeRevisao && !notasCompletas)}
                    className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                  >
                    Enviar solicitação
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoAcao("notas")}
                    className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    Voltar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-700">
                    Rejeitar esse trabalho é definitivo
                  </p>
                  <p className="mt-1 text-sm text-rose-700">
                    O trabalho vai direto pra &quot;Não aceito&quot;, sem passar por revisão nem
                    apresentação — o aluno é avisado, mas não tem como reenviar. Use só quando o
                    trabalho realmente não segue os 5 critérios avaliativos.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => confirmarRejeicao(trabalhoAvaliando.id)}
                    className="rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition-colors hover:bg-rose-700"
                  >
                    Confirmar rejeição
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoAcao("notas")}
                    className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function AvaliadorTrabalhosPage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const [abaAtiva, setAbaAtiva] = useState<"avaliacao" | "apresentacao">("avaliacao");

  const souAvaliador = temPapel(perfil, "avaliador") || temPapel(perfil, "orientador");
  const souModerador = temPapel(perfil, "moderador");

  const trabalhosAvaliacao = useMemo(
    () => trabalhos.filter((t) => t.avaliadorUid === user?.uid),
    [trabalhos, user?.uid],
  );
  const trabalhosApresentacao = useMemo(
    () => trabalhos.filter((t) => t.moderadorUid === user?.uid),
    [trabalhos, user?.uid],
  );

  // Sala/horário por trabalho na Apresentação (2026-11-10, pedido explícito
  // do usuário — agrupar por "Evento X - Sala Y" com horário na frente).
  // Assume 1 evento só por moderador aqui (o uso real é sempre assim — um
  // moderador cobre um evento de cada vez); se um dia cobrir 2 eventos ao
  // mesmo tempo, só o primeiro ganha sala/horário resolvidos, o resto cai
  // no grupo "Sem sala definida" (nunca some da lista, só sem agrupamento
  // fino). `useSalasCatalogo` é compartilhado entre todos os eventos (não
  // precisa saber qual evento pra pegar os nomes).
  const eventoIdApresentacao = trabalhosApresentacao[0]?.eventoId;
  const { sessoes: sessoesApresentacao } = useSessoesDoEvento(eventoIdApresentacao);
  const { salas } = useSalasCatalogo();
  const sessoesPorId = useMemo(
    () => new Map(sessoesApresentacao.map((s) => [s.id, s])),
    [sessoesApresentacao],
  );
  const nomesSalas = useMemo(() => new Map(salas.map((s) => [s.id, s.nome])), [salas]);
  const eventoApresentacao = eventos.find((e) => e.id === eventoIdApresentacao);

  if (carregando || !perfil) return null;

  const mostrarAbas = souAvaliador && souModerador;
  const abaVisivel = mostrarAbas ? abaAtiva : souModerador ? "apresentacao" : "avaliacao";

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/trabalhos"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            {abaVisivel === "avaliacao"
              ? "Trabalhos que a organização enviou para você avaliar."
              : "Trabalhos que a organização enviou para você moderar a apresentação."}
          </p>

          {mostrarAbas && (
            <div className="mt-4 flex w-fit gap-1 rounded-xl bg-fatec-navy-50 p-1">
              <button
                type="button"
                onClick={() => setAbaAtiva("avaliacao")}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  abaAtiva === "avaliacao"
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                Avaliação
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("apresentacao")}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  abaAtiva === "apresentacao"
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                Apresentação
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {abaVisivel === "avaliacao" ? (
            <PainelTrabalhos
              trabalhos={trabalhosAvaliacao}
              eventos={eventos}
              criterios={CRITERIOS_AVALIACAO}
              escalaNotas={NOTAS_AVALIACAO}
              statusPendente="aguardando_avaliacao"
              mensagemVazia="Nenhum trabalho designado a você ainda."
              // Avaliador não pede mais revisão (2026-11-06, pedido explícito do
              // usuário — "eles só podem dar a nota em cima do trabalho"). Os
              // que já estavam em revisão a comissão organizadora reavalia
              // pela aba Revisão (src/app/trabalhos/page.tsx).
              permiteRevisao={false}
              permiteRejeitar={REJEICAO_HABILITADA}
              respeitaPrazoAvaliacao
              onEnviarNota={async (id, soma, notas) => {
                // Trabalho legado que já estava em "revisao" sem nota ANTES
                // do fix de 2026-11-05 (ver `revisaoLegado` em
                // src/lib/data/trabalhos.ts) — essa é a primeira nota dele,
                // mas não vira "avaliado" normal: fica em "revisao_realizada"
                // (não concorre a pódio, ver STATUS_JA_AVALIADO em
                // src/app/trabalhos/page.tsx).
                const origemLegado = trabalhosAvaliacao.find((t) => t.id === id)?.revisaoLegado === true;
                await atualizarTrabalho(id, {
                  status: origemLegado ? "revisao_realizada" : "avaliado",
                  notasCriterios: notas as unknown as NotasCriterios,
                  notaAvaliador: soma,
                  atualizadoEm: serverTimestamp(),
                });
                if (user) notificarStatusTrabalho(user, id, "avaliado");
              }}
              onSolicitarRevisao={async (id, comentario, soma, notas) => {
                // Trabalho legado nunca grava nota aqui (2026-11-05, pedido
                // explícito do usuário — "esses 49 só vão devolver uma única
                // vez"), mas por segurança: se um dia voltar pra revisão de
                // novo, não pode gravar nota no meio do caminho, senão o
                // próximo reenvio do aluno seria tratado como fluxo novo
                // (fecharia direto em "avaliado" em vez de
                // "revisao_realizada" — ver salvarEdicao em
                // aluno/trabalhos/page.tsx).
                const legado = trabalhosAvaliacao.find((t) => t.id === id)?.revisaoLegado === true;
                await atualizarTrabalho(id, {
                  status: "revisao",
                  comentarioRevisao: comentario,
                  ...(legado
                    ? {}
                    : {
                        notasCriterios: notas as unknown as NotasCriterios,
                        notaAvaliador: soma,
                      }),
                  atualizadoEm: serverTimestamp(),
                });
                if (user) notificarStatusTrabalho(user, id, "revisao");
              }}
              onRejeitar={async (id) => {
                await atualizarTrabalho(id, {
                  status: "nao_aceito",
                  atualizadoEm: serverTimestamp(),
                });
                // "rejeitado" (não "nao_aceito") — e-mail específico de
                // resumo rejeitado na avaliação, texto formal pedido pelo
                // usuário (2026-11-03); o status salvo no trabalho continua
                // "nao_aceito" mesmo, só o tipo de e-mail/feed é diferente
                // (ver TEXTO_ATIVIDADE/CONTEUDO em
                // /api/mail/trabalho-status/route.ts).
                if (user) notificarStatusTrabalho(user, id, "rejeitado");
              }}
            />
          ) : (
            <PainelTrabalhos
              trabalhos={trabalhosApresentacao}
              eventos={eventos}
              criterios={CRITERIOS_APRESENTACAO}
              escalaNotas={NOTAS_APRESENTACAO}
              mostrarDescricaoCriterio={false}
              mostrarResumo={false}
              mostrarAutores
              statusPendente="aguardando_apresentacao"
              mensagemVazia="Nenhum trabalho designado a você ainda."
              permiteRevisao={false}
              respeitaLiberacaoNoDiaEvento
              permitePresenca
              agruparPorSala
              sessoesPorId={sessoesPorId}
              nomesSalas={nomesSalas}
              duracaoApresentacaoMinutos={eventoApresentacao?.duracaoApresentacaoMinutos}
              onEnviarNota={(id, soma, notas) =>
                atualizarTrabalho(id, {
                  status: "apresentado",
                  notasCriteriosApresentacao: notas as unknown as NotasCriteriosApresentacao,
                  notaModerador: soma,
                  // Receber nota já prova que apresentou — presença fica
                  // automática, sem precisar de um clique extra do moderador
                  // (2026-11-10, pedido explícito do usuário).
                  compareceuApresentacao: true,
                  atualizadoEm: serverTimestamp(),
                })
              }
              onMarcarPresenca={(id, presente) =>
                atualizarTrabalho(id, {
                  compareceuApresentacao: presente,
                  // Falta tira só o prêmio — o trabalho continua "aceito"
                  // (foi avaliado, o texto era bom); quem vinha atrás na
                  // área sobe de posição sozinho (ver analiseResultadoPorArea
                  // em src/app/trabalhos/page.tsx, que exclui quem faltou).
                  ...(presente ? {} : { premiado: false }),
                  atualizadoEm: serverTimestamp(),
                })
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
