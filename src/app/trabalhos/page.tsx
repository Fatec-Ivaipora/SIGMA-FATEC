"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Send,
  Minus,
  Plus,
  Check,
  X,
  Award,
  ListChecks,
  Scale,
} from "lucide-react";
import { serverTimestamp, writeBatch, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { DetalheTrabalhoModal } from "@/components/DetalheTrabalhoModal";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos, type TrabalhoStatus, type Trabalho, atualizarTrabalho } from "@/lib/data/trabalhos";
import { useUsuarios, type UsuarioRegistro } from "@/lib/data/usuarios";
import { useMinhaInscricao } from "@/lib/data/inscricoes";
import { useMonitoresDoEvento } from "@/lib/data/monitores";
import {
  notificarAtribuicao,
  notificarStatusTrabalho,
  notificarConviteColega,
  notificarAlteracaoAdmin,
} from "@/lib/notificarEmail";

type Etapa =
  | "submissao"
  | "avaliacao"
  | "revisao"
  | "resultado"
  | "apresentacao"
  | "resultado_final";

const ETAPAS: { key: Etapa; label: string }[] = [
  { key: "submissao", label: "Submissão" },
  { key: "avaliacao", label: "Avaliação" },
  { key: "revisao", label: "Revisão" },
  { key: "resultado", label: "Resultado" },
  { key: "apresentacao", label: "Apresentação" },
  { key: "resultado_final", label: "Resultado Final" },
];

const STATUS_POR_ETAPA: Record<Etapa, TrabalhoStatus[]> = {
  submissao: ["submissao"],
  avaliacao: ["aguardando_avaliacao"],
  revisao: ["revisao"],
  resultado: ["avaliado"],
  apresentacao: ["aguardando_apresentacao"],
  resultado_final: ["apresentado", "aceito", "nao_aceito"],
};

// Etapas em que a organização seleciona trabalhos e distribui entre pessoas
// (avaliadores na Submissão, moderadores no Resultado) — mesma mecânica nos
// dois casos, só troca o papel-alvo (2026-08-26).
const ETAPA_PARA_PAPEL_ALVO: Partial<Record<Etapa, "avaliador" | "moderador">> = {
  submissao: "avaliador",
  resultado: "moderador",
};

// Status que significam "já passou pela avaliação" — usado pro pódio por
// área considerar todo mundo que já tem nota, mesmo quem já saiu de
// "avaliado" (ver analiseResultadoPorArea).
const STATUS_JA_AVALIADO: TrabalhoStatus[] = [
  "avaliado",
  "aguardando_apresentacao",
  "apresentado",
  "aceito",
  "nao_aceito",
];

function formatarData(valor: unknown): string {
  if (!valor || typeof valor !== "object" || !("toDate" in valor)) return "—";
  return (valor as { toDate(): Date }).toDate().toLocaleDateString("pt-BR");
}

/** Situação do pagamento do dono do trabalho nesse evento (2026-08-31) —
 * componente próprio só pra poder chamar useMinhaInscricao por linha da
 * tabela. Evento sem taxa não tem pagamento pra checar. A leitura funciona
 * aqui (admin/organização) mesmo sendo de outra pessoa — ver firestore.rules,
 * inscricoesEvento permite admin/organização lerem qualquer inscrição. */
function CelulaSituacaoPagamento({ trabalho, evento }: { trabalho: Trabalho; evento: Evento | undefined }) {
  const temTaxa = !!evento?.valorInscricao;
  const { inscricao, carregando } = useMinhaInscricao(
    temTaxa ? trabalho.eventoId : undefined,
    trabalho.alunoUid,
  );

  if (!temTaxa) {
    return <span className="text-xs text-fatec-muted">Gratuito</span>;
  }
  if (carregando) {
    return <span className="text-xs text-fatec-muted">…</span>;
  }
  const pago = inscricao?.status === "pago";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {pago ? "Pago" : "Não pago"}
    </span>
  );
}

export default function TrabalhosAdminPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { usuarios } = useUsuarios();

  const [etapa, setEtapaBruta] = useState<Etapa>("submissao");
  const [busca, setBusca] = useState("");
  const [eventoId, setEventoId] = useState("todos");
  const [areaFiltro, setAreaFiltro] = useState("Todas as áreas");
  // Só empatados (2026-09-08, pedido explícito) — nem todo trabalho avaliado
  // vai pra apresentação, só os que empataram em nota dentro da mesma área
  // temática (prêmio é "em cada categoria", item 6.6 do edital) — sem isso a
  // organização não tinha como saber quem precisa da apresentação pra
  // desempatar.
  const [soEmpatados, setSoEmpatados] = useState(false);

  // Ordenação por nota (2026-09-11, pedido explícito) — clicar no cabeçalho
  // alterna maior→menor / menor→maior; null = ordem padrão (como veio do
  // Firestore). É UMA SÓ ordenação mesmo em Resultado Final, onde a tabela
  // mostra nota av e nota apr em colunas separadas (transparência de onde
  // veio o resultado — ver trabalhosExibidos) mas ambas ordenam pelo mesmo
  // critério: quem tem as duas notas ordena pela SOMA (é o placar real de
  // quem passou por desempate); quem só tem av ordena só por ela. Ordenar
  // cada coluna separadamente foi tentado e revertido (2026-09-11): dá
  // ranking capenga, ex. 25 av + 24 apr (total 49) aparecia atrás de 10 av +
  // 25 apr (total 35) se você olhasse só a coluna apr.
  const [direcaoOrdenacaoNota, setDirecaoOrdenacaoNota] = useState<"desc" | "asc" | null>(null);
  const alternarOrdenacaoNota = () =>
    setDirecaoOrdenacaoNota((atual) => (atual === "desc" ? "asc" : "desc"));

  // Ver detalhes / editar um trabalho (2026-09-11) — clicar no título da
  // tabela abre o resumo completo; "Editar" (só admin) troca pro mesmo
  // wizard de submissão em modo edição, pra corrigir casos excepcionais
  // (prazo perdido, orientador errado, colega esquecido etc — admin já tem
  // update liberado em firestore.rules, sem trava de prazo).
  const [trabalhoDetalhe, setTrabalhoDetalhe] = useState<Trabalho | null>(null);
  const [trabalhoEditando, setTrabalhoEditando] = useState<Trabalho | null>(null);

  // Mesma lógica de src/app/aluno/trabalhos/page.tsx#salvarEdicao (convite
  // pendente só pra colega novo, reenvia pra avaliação se estava em
  // "revisao") — admin corrigindo em casos excepcionais segue as mesmas
  // regras de consistência, só que sem a trava de prazo (essa já não existe
  // pro update dele em firestore.rules).
  async function salvarEdicaoAdmin(trabalho: Trabalho, dados: DadosSubmissao) {
    const uidsAntigos = new Set(trabalho.participantesUids ?? []);
    const novosConvites = dados.participantesUids.filter((uid) => !uidsAntigos.has(uid));
    const convitesPendentes = Array.from(
      new Set([
        ...(trabalho.convitesPendentes ?? []).filter((uid) =>
          dados.participantesUids.includes(uid),
        ),
        ...novosConvites,
      ]),
    );
    await atualizarTrabalho(trabalho.id, {
      ...dados,
      convitesPendentes,
      ...(trabalho.status === "revisao"
        ? { status: "aguardando_avaliacao" as const, comentarioRevisao: null }
        : {}),
      atualizadoEm: serverTimestamp(),
    });
    if (user) {
      novosConvites.forEach((colegaUid) => notificarConviteColega(user, trabalho.id, colegaUid));

      // Alerta de segurança (2026-09-11, pedido explícito): TODOS os
      // autores de antes e depois da edição ficam sabendo que um admin
      // mexeu no trabalho — inclusive quem acabou de ser removido agora
      // mesmo, pra não sumir sem explicação nenhuma.
      const destinatarios = Array.from(
        new Set([trabalho.alunoUid, ...uidsAntigos, ...dados.participantesUids]),
      );
      notificarAlteracaoAdmin(user, trabalho.id, destinatarios);
    }
    setTrabalhoEditando(null);
  }

  // Pré-seleciona o evento em destaque assim que a lista carrega, só na
  // primeira vez (2026-08-31) — evita ter que escolher toda vez o evento que
  // já está em foco no momento; troca manual depois disso nunca é sobrescrita.
  const preSelecaoFeita = useRef(false);
  useEffect(() => {
    if (preSelecaoFeita.current || eventos.length === 0) return;
    preSelecaoFeita.current = true;
    const destaque = eventos.find((e) => e.destaque);
    if (destaque) Promise.resolve().then(() => setEventoId(destaque.id));
  }, [eventos]);

  // Monitores do evento selecionado — "Emitir certificados" libera junto
  // com os trabalhos aceitos (2026-09-01). Só faz sentido com um evento
  // específico escolhido (não em "todos", que mistura vários eventos).
  const { monitores: monitoresDoEventoAtual } = useMonitoresDoEvento(
    eventoId !== "todos" ? eventoId : undefined,
  );

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEnviar, setModalEnviar] = useState(false);
  const [papelAlvoEnvio, setPapelAlvoEnvio] = useState<"avaliador" | "moderador">("avaliador");
  const [avaliadorEscolhido, setAvaliadorEscolhido] = useState("");
  const [distribuicao, setDistribuicao] = useState<
    { uid: string; nome: string; quantidade: number }[]
  >([]);
  const [modoManual, setModoManual] = useState(false);
  const [menuLoteAberto, setMenuLoteAberto] = useState(false);
  const [menuResultadoAberto, setMenuResultadoAberto] = useState(false);

  // Seleção não sobrevive troca de etapa (2026-08-25 -> agora tem 2 etapas
  // selecionáveis, Submissão e Resultado, então isso passa a importar de
  // verdade).
  function setEtapa(nova: Etapa) {
    setEtapaBruta(nova);
    setSelecionados(new Set());
    setDirecaoOrdenacaoNota(null);
    setMenuResultadoAberto(false);
  }

  const todosLabel =
    perfil?.papel === "admin" ? "Todos os eventos" : "Todos os meus eventos";

  const areasParaFiltro = useMemo(() => {
    if (eventoId === "todos") {
      const set = new Set<string>();
      for (const e of eventos) (e.areasTematicas ?? []).forEach((a) => set.add(a));
      return Array.from(set).sort();
    }
    return eventos.find((e) => e.id === eventoId)?.areasTematicas ?? [];
  }, [eventos, eventoId]);

  // Análise de ranking por área temática (2026-09-11, substitui o "empate"
  // ingênuo de antes, que marcava qualquer nota repetida — mesmo empatados
  // em 8º lugar, o que não tinha nada a ver com o pódio). Só interessa
  // empate na FRONTEIRA do top 3 (edital 6.6): quem tira nota acima do
  // corte já é premiado direto; quem tira abaixo já não é, sem precisar de
  // apresentação nenhuma; só quem empata bem na 3ª vaga (ou disputa ela)
  // precisa ir pro moderador desempatar.
  //
  // IMPORTANTE (bug real, achado testando em 2026-09-11): o pódio da área
  // tem que ser calculado sobre TODO MUNDO que já foi avaliado ali, mesmo
  // quem já saiu de "avaliado" (porque já foi aceito/premiado antes). Se
  // filtrássemos só por status === "avaliado", clicar "Aceitar sem empate"
  // tira os não-empatados da lista e o cálculo seguinte recalcula o corte
  // só com quem sobrou — aí um trio empatado na 3ª vaga "esquece" que já
  // tinha 2 trabalhos melhores aceitos antes dele e vira "cabe todo mundo,
  // sem empate" por engano. Por isso o pool aqui é qualquer trabalho que já
  // passou pela avaliação (tem nota), não só quem ainda está pendurado.
  type AnaliseArea = {
    premiadosDiretos: string[];
    aceitosDiretos: string[];
    empatados: string[];
  };
  const analiseResultadoPorArea = useMemo(() => {
    const porGrupo = new Map<string, Trabalho[]>();
    for (const t of trabalhos) {
      if (!STATUS_JA_AVALIADO.includes(t.status) || typeof t.notaAvaliador !== "number") continue;
      const chave = `${t.eventoId}::${t.areaTematica}`;
      const lista = porGrupo.get(chave) ?? [];
      lista.push(t);
      porGrupo.set(chave, lista);
    }
    const resultado = new Map<string, AnaliseArea>();
    for (const [chave, lista] of porGrupo) {
      const ordenados = [...lista].sort(
        (a, b) => (b.notaAvaliador ?? 0) - (a.notaAvaliador ?? 0),
      );
      // Área com 3 ou menos trabalhos: todo mundo cabe no pódio, sem disputa.
      if (ordenados.length <= 3) {
        resultado.set(chave, {
          premiadosDiretos: ordenados.map((t) => t.id),
          aceitosDiretos: [],
          empatados: [],
        });
        continue;
      }
      // Nota de quem está na 3ª posição depois de ordenar — não "o 3º valor
      // distinto" (testado e corrigido, 2026-09-11: com nota repetida os
      // dois viram coisas diferentes. Ex.: 25, 20, 20, 15 — o 3º valor
      // distinto seria 15, mas quem está na 3ª posição tem nota 20; usar o
      // valor distinto errado tratava 15 como fronteira do pódio quando na
      // real o pódio (25+20+20) já estava fechado sem disputa nenhuma).
      const corteNota = ordenados[2].notaAvaliador as number;
      const acimaCorte = ordenados.filter((t) => (t.notaAvaliador ?? 0) > corteNota);
      const noCorte = ordenados.filter((t) => (t.notaAvaliador ?? 0) === corteNota);
      const abaixoCorte = ordenados.filter((t) => (t.notaAvaliador ?? 0) < corteNota);
      const vagasRestantes = 3 - acimaCorte.length;
      if (noCorte.length <= vagasRestantes) {
        // Cabe todo mundo do corte nas vagas que sobraram — não é empate de verdade.
        resultado.set(chave, {
          premiadosDiretos: [...acimaCorte, ...noCorte].map((t) => t.id),
          aceitosDiretos: abaixoCorte.map((t) => t.id),
          empatados: [],
        });
      } else {
        // Mais gente empatada na fronteira do que vaga sobrando — precisa desempate.
        resultado.set(chave, {
          premiadosDiretos: acimaCorte.map((t) => t.id),
          aceitosDiretos: abaixoCorte.map((t) => t.id),
          empatados: noCorte.map((t) => t.id),
        });
      }
    }
    return resultado;
  }, [trabalhos]);

  const idsEmpatados = useMemo(() => {
    const empatados = new Set<string>();
    for (const analise of analiseResultadoPorArea.values()) {
      analise.empatados.forEach((id) => empatados.add(id));
    }
    return empatados;
  }, [analiseResultadoPorArea]);

  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return trabalhos.filter((t) => {
      const bateEtapa = STATUS_POR_ETAPA[etapa].includes(t.status);
      const bateEvento = eventoId === "todos" || t.eventoId === eventoId;
      const bateArea =
        areaFiltro === "Todas as áreas" || t.areaTematica === areaFiltro;
      const bateEmpate = !soEmpatados || idsEmpatados.has(t.id);
      const bateBusca =
        !termo ||
        t.titulo.toLowerCase().includes(termo) ||
        t.alunoNome?.toLowerCase().includes(termo);
      return bateEtapa && bateEvento && bateArea && bateEmpate && bateBusca;
    });
  }, [trabalhos, busca, eventoId, areaFiltro, etapa, soEmpatados, idsEmpatados]);

  // Lista exibida na tabela — igual a trabalhosFiltrados, só que reordenada
  // por nota quando o usuário clica no cabeçalho (ver direcaoOrdenacaoNota
  // acima). Mantida separada de trabalhosFiltrados de propósito: a ordem "de
  // chegada" continua sendo usada pra dividir trabalhos entre
  // avaliadores/moderadores de forma estável, e não deve mudar só porque a
  // organização reordenou a tabela pra olhar as notas.
  const trabalhosExibidos = useMemo(() => {
    if (!direcaoOrdenacaoNota) return trabalhosFiltrados;
    // Resultado Final ordena pela SOMA (av + apr) — é o placar real de quem
    // passou por desempate; quem só tem av (venceu sem precisar de
    // apresentação) ordena só por ela.
    const valorDe = (t: Trabalho) =>
      etapa === "resultado_final"
        ? typeof t.notaModerador === "number"
          ? (t.notaAvaliador ?? 0) + t.notaModerador
          : t.notaAvaliador
        : t.notaAvaliador;
    const sinal = direcaoOrdenacaoNota === "desc" ? -1 : 1;
    return [...trabalhosFiltrados].sort((a, b) => {
      const va = valorDe(a);
      const vb = valorDe(b);
      const na = typeof va === "number";
      const nb = typeof vb === "number";
      // Quem não tem nota nenhuma fica sempre por último, nas duas direções.
      if (na && nb) return sinal * (va - vb);
      if (na) return -1;
      if (nb) return 1;
      return 0;
    });
  }, [trabalhosFiltrados, direcaoOrdenacaoNota, etapa]);

  // Orientador pode ser alocado como avaliador de um evento (2026-08-25, RF-46).
  const avaliadoresDisponiveis = useMemo(
    () => usuarios.filter((u) => u.papel === "avaliador" || u.papel === "orientador"),
    [usuarios],
  );

  // Moderadores (2026-08-26) — papel primário "moderador" ou combinado via
  // papeisAvaliacao (ex.: orientador que também modera apresentações).
  const moderadoresDisponiveis = useMemo(
    () => usuarios.filter((u) => u.papel === "moderador" || u.papeisAvaliacao?.includes("moderador")),
    [usuarios],
  );

  const pessoasDisponiveis: UsuarioRegistro[] =
    papelAlvoEnvio === "avaliador" ? avaliadoresDisponiveis : moderadoresDisponiveis;

  // Trabalhos selecionados na etapa Submissão, na mesma ordem da tabela —
  // usada tanto pra descobrir se compartilham evento/área quanto pra fatiar
  // a divisão entre avaliadores em ordem estável.
  const trabalhosSelecionadosObjs = useMemo(
    () => trabalhosFiltrados.filter((t) => selecionados.has(t.id)),
    [trabalhosFiltrados, selecionados],
  );

  const eventoComumSelecionado = useMemo(() => {
    if (trabalhosSelecionadosObjs.length === 0) return null;
    const primeiro = trabalhosSelecionadosObjs[0].eventoId;
    return trabalhosSelecionadosObjs.every((t) => t.eventoId === primeiro)
      ? primeiro
      : null;
  }, [trabalhosSelecionadosObjs]);

  const areaComumSelecionada = useMemo(() => {
    if (trabalhosSelecionadosObjs.length === 0) return null;
    const primeira = trabalhosSelecionadosObjs[0].areaTematica;
    return trabalhosSelecionadosObjs.every((t) => t.areaTematica === primeira)
      ? primeira
      : null;
  }, [trabalhosSelecionadosObjs]);

  // Pessoas (avaliador ou moderador, conforme papelAlvoEnvio) designadas pra
  // essa área nesse evento (ver areasTematicas em AtribuicaoEvento) — só
  // existe divisão automática quando isso não é vazio.
  const pessoasDaArea = useMemo(() => {
    if (!eventoComumSelecionado || !areaComumSelecionada) return [];
    return pessoasDisponiveis.filter((a) =>
      (a.atribuicoesEventos ?? []).some(
        (at) =>
          at.eventoId === eventoComumSelecionado &&
          (at.areasTematicas ?? []).includes(areaComumSelecionada),
      ),
    );
  }, [pessoasDisponiveis, eventoComumSelecionado, areaComumSelecionada]);

  // Fallback do modo manual: pessoas do evento em comum, se alguma; senão,
  // todo mundo cadastrado com esse papel (seleção mistura eventos, ou
  // ninguém foi designado ainda pro evento).
  const pessoasParaManual = useMemo(() => {
    if (!eventoComumSelecionado) return pessoasDisponiveis;
    const doEvento = pessoasDisponiveis.filter((a) =>
      (a.atribuicoesEventos ?? []).some((at) => at.eventoId === eventoComumSelecionado),
    );
    return doEvento.length > 0 ? doEvento : pessoasDisponiveis;
  }, [pessoasDisponiveis, eventoComumSelecionado]);

  function distribuicaoPadrao(
    lista: { uid: string; nome: string }[],
    total: number,
  ): { uid: string; nome: string; quantidade: number }[] {
    const base = Math.floor(total / lista.length);
    const resto = total % lista.length;
    return lista.map((a, i) => ({ ...a, quantidade: base + (i < resto ? 1 : 0) }));
  }

  function abrirModalEnviar(papel: "avaliador" | "moderador") {
    setPapelAlvoEnvio(papel);
    // Recalcula na hora em vez de reaproveitar pessoasDaArea/pessoasParaManual
    // memoizados: setPapelAlvoEnvio só reflete no próximo render, então esses
    // memos ainda estariam com o alvo antigo neste exato ponto do código. A
    // modal em si (JSX abaixo) já usa os memoizados normalmente, porque aí
    // o estado já assentou.
    const disponiveis = papel === "avaliador" ? avaliadoresDisponiveis : moderadoresDisponiveis;
    const daArea = !eventoComumSelecionado || !areaComumSelecionada
      ? []
      : disponiveis.filter((a) =>
          (a.atribuicoesEventos ?? []).some(
            (at) =>
              at.eventoId === eventoComumSelecionado &&
              (at.areasTematicas ?? []).includes(areaComumSelecionada),
          ),
        );
    const paraManual =
      !eventoComumSelecionado
        ? disponiveis
        : (() => {
            const doEvento = disponiveis.filter((a) =>
              (a.atribuicoesEventos ?? []).some((at) => at.eventoId === eventoComumSelecionado),
            );
            return doEvento.length > 0 ? doEvento : disponiveis;
          })();

    setModoManual(daArea.length === 0);
    setDistribuicao(
      daArea.length > 0
        ? distribuicaoPadrao(
            daArea.map((a) => ({ uid: a.uid, nome: a.nome })),
            selecionados.size,
          )
        : [],
    );
    setAvaliadorEscolhido(paraManual[0]?.uid ?? "");
    setModalEnviar(true);
  }

  function ajustarQuantidade(index: number, delta: number) {
    setDistribuicao((prev) =>
      prev.map((linha, i) =>
        i === index
          ? { ...linha, quantidade: Math.max(0, linha.quantidade + delta) }
          : linha,
      ),
    );
  }

  const somaDistribuicao = distribuicao.reduce((acc, l) => acc + l.quantidade, 0);

  const contagem = (e: Etapa) =>
    trabalhos.filter((t) => STATUS_POR_ETAPA[e].includes(t.status)).length;

  // Botão/ação de liberar certificado é exclusivo do admin (pedido do
  // usuário, 2026-08-28) — organização vê a aba Resultado Final normalmente,
  // sem esse controle.
  const podeLiberarCertificados = etapa === "resultado_final" && perfil?.papel === "admin";

  // "Liberar certificados" age sobre tudo que está aceito e ainda não foi
  // liberado, dentro dos filtros ativos — sem precisar selecionar nada.
  const trabalhosPendentesDeLiberacao = useMemo(
    () => trabalhosFiltrados.filter((t) => t.status === "aceito" && !t.certificadoLiberado),
    [trabalhosFiltrados],
  );

  const monitoresPendentesDeLiberacao = useMemo(
    () => monitoresDoEventoAtual.filter((m) => !m.certificadoLiberado),
    [monitoresDoEventoAtual],
  );

  // Checkbox de seleção também aparece no Resultado Final (2026-08-31) —
  // usado pelo "Aceitar todos selecionados" do menu de funções em lote.
  const mostrarCheckbox = !!ETAPA_PARA_PAPEL_ALVO[etapa] || etapa === "resultado_final";

  // Só os selecionados que ainda fazem sentido aceitar (já apresentados,
  // aguardando decisão) — selecionar um já aceito/recusado não faz nada.
  const selecionadosElegiveisParaAceite = useMemo(
    () => trabalhosFiltrados.filter((t) => selecionados.has(t.id) && t.status === "apresentado"),
    [trabalhosFiltrados, selecionados],
  );

  function alternarSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Checkbox "selecionar todos" no cabeçalho (2026-08-31, igual serviço de
  // e-mail) — seleciona/desseleciona só os trabalhos visíveis com o filtro
  // atual (ex.: uma área temática), não a tabela inteira sem filtro.
  const todosVisiveisSelecionados =
    trabalhosFiltrados.length > 0 && trabalhosFiltrados.every((t) => selecionados.has(t.id));

  function alternarSelecaoTodos() {
    setSelecionados((prev) => {
      if (todosVisiveisSelecionados) {
        const next = new Set(prev);
        for (const t of trabalhosFiltrados) next.delete(t.id);
        return next;
      }
      const next = new Set(prev);
      for (const t of trabalhosFiltrados) next.add(t.id);
      return next;
    });
  }

  // Campos e status gravados mudam conforme o alvo do envio (2026-08-26).
  function camposEnvio(uid: string, nome: string) {
    return papelAlvoEnvio === "avaliador"
      ? { status: "aguardando_avaliacao" as const, avaliadorUid: uid, avaliadorNome: nome }
      : { status: "aguardando_apresentacao" as const, moderadorUid: uid, moderadorNome: nome };
  }

  async function confirmarEnvio() {
    const pessoa = pessoasParaManual.find((a) => a.uid === avaliadorEscolhido);
    if (!pessoa) return;

    const batch = writeBatch(db);
    for (const id of selecionados) {
      batch.update(doc(db, "trabalhos", id), {
        ...camposEnvio(pessoa.uid, pessoa.nome),
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
    if (user) {
      notificarAtribuicao(
        user,
        [{ uid: pessoa.uid, papel: papelAlvoEnvio, quantidade: selecionados.size }],
        eventoComumSelecionado,
      );
    }
    setSelecionados(new Set());
    setModalEnviar(false);
  }

  async function confirmarEnvioDistribuido() {
    if (somaDistribuicao !== selecionados.size) return;

    const idsOrdenados = trabalhosSelecionadosObjs.map((t) => t.id);
    const batch = writeBatch(db);
    let cursor = 0;
    for (const linha of distribuicao) {
      const fatia = idsOrdenados.slice(cursor, cursor + linha.quantidade);
      cursor += linha.quantidade;
      for (const id of fatia) {
        batch.update(doc(db, "trabalhos", id), {
          ...camposEnvio(linha.uid, linha.nome),
          atualizadoEm: serverTimestamp(),
        });
      }
    }
    await batch.commit();
    if (user) {
      notificarAtribuicao(
        user,
        distribuicao
          .filter((linha) => linha.quantidade > 0)
          .map((linha) => ({ uid: linha.uid, papel: papelAlvoEnvio, quantidade: linha.quantidade })),
        eventoComumSelecionado,
      );
    }
    setSelecionados(new Set());
    setModalEnviar(false);
  }

  /** Etapa Resultado Final (2026-08-26) — organização confirma aceite,
   * fecha a pendência 8.2 (RF-19). Redesenhado em 2026-09-11: quem chega
   * aqui já passou por apresentação porque empatou na fronteira do top 3 —
   * "aceitar" sozinho não significa mais "ganhou", significa só "participou
   * de verdade". `premiado` marca quem de fato ficou com a vaga que sobrou
   * no pódio (decide Certificado x Declaração na hora de baixar). "Recusar"
   * continua existindo só pra reprovação de verdade (raro), nunca é o
   * destino padrão de quem perdeu o desempate. */
  async function decidirResultado(
    id: string,
    decisao: "premiar" | "aceitar" | "recusar",
  ) {
    await updateDoc(doc(db, "trabalhos", id), {
      status: decisao === "recusar" ? "nao_aceito" : "aceito",
      premiado: decisao === "premiar",
      atualizadoEm: serverTimestamp(),
    });
    if (user) {
      notificarStatusTrabalho(user, id, decisao === "recusar" ? "nao_aceito" : "aceito");
    }
  }

  /** Libera o certificado/declaração pro aluno/avaliador/moderador verem na
   * própria tela de Certificações — separado do aceite em si, pra decidir o
   * momento (2026-08-28). Exclusivo do admin (pedido do usuário) — a
   * organização vê a aba Resultado Final normalmente, mas não esse botão. */
  async function liberarCertificado(id: string) {
    await updateDoc(doc(db, "trabalhos", id), {
      certificadoLiberado: true,
      atualizadoEm: serverTimestamp(),
    });
  }

  // Libera todo mundo que já está aceito na aba Resultado Final (respeitando
  // os filtros de busca/área/evento ativos) — não precisa selecionar nada
  // (pedido do usuário, 2026-08-28). Libera junto os monitores do evento
  // selecionado (2026-09-01) — eles não têm trabalho nenhum, então entram
  // por fora dessa lista.
  async function liberarTodosCertificados() {
    const batch = writeBatch(db);
    for (const t of trabalhosPendentesDeLiberacao) {
      batch.update(doc(db, "trabalhos", t.id), {
        certificadoLiberado: true,
        atualizadoEm: serverTimestamp(),
      });
    }
    for (const m of monitoresPendentesDeLiberacao) {
      batch.update(doc(db, "monitoresEvento", m.id), {
        certificadoLiberado: true,
      });
    }
    await batch.commit();
  }

  // Resolve de uma vez toda área que NÃO tem empate na fronteira do top 3
  // (2026-09-11) — pega analiseResultadoPorArea (já filtrado pro evento
  // selecionado) e aceita direto: premiadosDiretos vira aceito+premiado,
  // aceitosDiretos vira só aceito. Quem está com empate (analise.empatados)
  // fica de fora, esperando a apresentação — continua indo por "Enviar para
  // apresentação" do jeito que já funciona.
  const podeAceitarSemEmpate = etapa === "resultado" && eventoId !== "todos";

  // analiseResultadoPorArea agora olha o pódio inteiro da área (ver comentário
  // acima), então premiadosDiretos/aceitosDiretos podem incluir trabalhos que
  // já foram resolvidos antes — aqui só interessa quem ainda está esperando
  // decisão (status "avaliado" de verdade).
  const idsAindaAvaliado = useMemo(
    () => new Set(trabalhos.filter((t) => t.status === "avaliado").map((t) => t.id)),
    [trabalhos],
  );

  const resumoAceiteSemEmpate = useMemo(() => {
    if (!podeAceitarSemEmpate) return { premiados: 0, aceitos: 0 };
    let premiados = 0;
    let aceitos = 0;
    for (const [chave, analise] of analiseResultadoPorArea) {
      if (!chave.startsWith(`${eventoId}::`)) continue;
      premiados += analise.premiadosDiretos.filter((id) => idsAindaAvaliado.has(id)).length;
      aceitos += analise.aceitosDiretos.filter((id) => idsAindaAvaliado.has(id)).length;
    }
    return { premiados, aceitos };
  }, [analiseResultadoPorArea, eventoId, podeAceitarSemEmpate, idsAindaAvaliado]);

  async function aceitarSemEmpate() {
    if (eventoId === "todos") return;
    const batch = writeBatch(db);
    const idsNotificar: string[] = [];
    for (const [chave, analise] of analiseResultadoPorArea) {
      if (!chave.startsWith(`${eventoId}::`)) continue;
      for (const id of analise.premiadosDiretos) {
        if (!idsAindaAvaliado.has(id)) continue;
        batch.update(doc(db, "trabalhos", id), {
          status: "aceito",
          premiado: true,
          atualizadoEm: serverTimestamp(),
        });
        idsNotificar.push(id);
      }
      for (const id of analise.aceitosDiretos) {
        if (!idsAindaAvaliado.has(id)) continue;
        batch.update(doc(db, "trabalhos", id), {
          status: "aceito",
          premiado: false,
          atualizadoEm: serverTimestamp(),
        });
        idsNotificar.push(id);
      }
    }
    if (idsNotificar.length === 0) return;
    await batch.commit();
    if (user) idsNotificar.forEach((id) => notificarStatusTrabalho(user, id, "aceito"));
  }

  // Aceita em lote os selecionados que estão "apresentado" (2026-08-31,
  // função em lote pra não precisar clicar ✓ um por um em eventos grandes —
  // chegaram a ter 600+ trabalhos na MAC). Ignora silenciosamente quem foi
  // selecionado mas já não está mais aguardando decisão. Sempre premiado:false
  // (2026-09-11) — premiar é decisão individual, deliberada, por linha
  // ("Premiar" no lugar do ✓ antigo); o lote é só pra aceitar em massa quem
  // já não vai ficar com a vaga do pódio.
  async function aceitarTodosSelecionados() {
    const batch = writeBatch(db);
    for (const t of selecionadosElegiveisParaAceite) {
      batch.update(doc(db, "trabalhos", t.id), {
        status: "aceito",
        premiado: false,
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
    if (user) {
      selecionadosElegiveisParaAceite.forEach((t) => notificarStatusTrabalho(user, t.id, "aceito"));
    }
    setSelecionados(new Set());
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/trabalhos"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Trabalhos
            </h1>
            <p className="text-sm text-fatec-muted">
              Da submissão ao resultado final, em seis etapas.
            </p>
          </div>

          <div className="relative">
            <select
              value={eventoId}
              onChange={(e) => {
                setEventoId(e.target.value);
                setAreaFiltro("Todas as áreas");
              }}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 md:w-64"
            >
              <option value="todos">{todosLabel}</option>
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
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {/* overflow-x-auto próprio (2026-08-31): sem isso, em telas
              estreitas as abas ficavam cortadas pelo overflow-x-hidden do
              container pai, sem jeito nenhum de alcançar as últimas. */}
          <div className="overflow-x-auto pb-1">
            <div className="flex w-fit overflow-hidden rounded-xl border border-fatec-line">
            {ETAPAS.map((e, i) => {
              const ativa = etapa === e.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setEtapa(e.key)}
                  style={{
                    clipPath:
                      i === ETAPAS.length - 1
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 18px 50%)"
                        : "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
                    marginLeft: i === 0 ? 0 : -18,
                  }}
                  className={`relative flex items-center gap-2 py-3 pl-6 pr-8 text-sm font-semibold transition-colors ${
                    ativa
                      ? "z-10 bg-fatec-orange-500 text-white"
                      : "bg-fatec-navy-50 text-fatec-navy-800 hover:bg-fatec-navy-100"
                  }`}
                >
                  {e.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      ativa
                        ? "bg-white/20 text-white"
                        : "bg-white text-fatec-navy-700"
                    }`}
                  >
                    {contagem(e.key)}
                  </span>
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:w-64">
                <Search
                  className="h-4 w-4 flex-none text-fatec-muted"
                  strokeWidth={1.75}
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título ou aluno"
                  className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
                />
              </div>

              <div className="relative">
                <select
                  value={areaFiltro}
                  onChange={(e) => setAreaFiltro(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
                >
                  <option value="Todas as áreas">Todas as áreas</option>
                  {areasParaFiltro.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                  strokeWidth={1.75}
                />
              </div>

              <button
                type="button"
                onClick={() => setSoEmpatados((v) => !v)}
                title="Mostra só quem empatou em nota com outro trabalho da mesma área — são esses que precisam da apresentação pra desempatar"
                className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  soEmpatados
                    ? "border-fatec-orange-500 bg-fatec-orange-50 text-fatec-orange-700"
                    : "border-fatec-line bg-white text-fatec-navy-900 hover:bg-fatec-navy-50"
                }`}
              >
                <Scale className="h-4 w-4 flex-none" strokeWidth={1.75} />
                Só empatados
                {idsEmpatados.size > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      soEmpatados ? "bg-fatec-orange-500 text-white" : "bg-fatec-navy-100 text-fatec-navy-800"
                    }`}
                  >
                    {idsEmpatados.size}
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {podeAceitarSemEmpate ? (
                <div className="relative flex-none">
                  <button
                    type="button"
                    onClick={() => setMenuResultadoAberto((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
                  >
                    <Send className="h-4 w-4 flex-none" strokeWidth={1.75} />
                    Ações do resultado
                    <ChevronDown className="h-4 w-4 flex-none" strokeWidth={1.75} />
                  </button>

                  {menuResultadoAberto && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuResultadoAberto(false)}
                      />
                      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-fatec-line bg-white p-1.5 shadow-lg">
                        <button
                          type="button"
                          disabled={
                            resumoAceiteSemEmpate.premiados + resumoAceiteSemEmpate.aceitos === 0
                          }
                          onClick={() => {
                            aceitarSemEmpate();
                            setMenuResultadoAberto(false);
                          }}
                          title="Resolve de uma vez toda área sem empate na fronteira do top 3 — os 3 melhores viram Aceito+Premiado, o resto vira só Aceito. Quem está empatado fica de fora, esperando ir pra apresentação."
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
                        >
                          <Check className="h-4 w-4 flex-none" strokeWidth={1.75} />
                          Aceitar sem empate
                          {resumoAceiteSemEmpate.premiados + resumoAceiteSemEmpate.aceitos > 0 &&
                            ` (${resumoAceiteSemEmpate.premiados + resumoAceiteSemEmpate.aceitos})`}
                        </button>
                        <button
                          type="button"
                          disabled={selecionados.size === 0}
                          onClick={() => {
                            abrirModalEnviar("moderador");
                            setMenuResultadoAberto(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
                        >
                          <Send className="h-4 w-4 flex-none" strokeWidth={1.75} />
                          Enviar para apresentação
                          {selecionados.size > 0 && ` (${selecionados.size})`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                ETAPA_PARA_PAPEL_ALVO[etapa] && (
                  <button
                    type="button"
                    disabled={selecionados.size === 0}
                    onClick={() => abrirModalEnviar(ETAPA_PARA_PAPEL_ALVO[etapa]!)}
                    className="flex flex-none items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                  >
                    <Send className="h-4 w-4 flex-none" strokeWidth={1.75} />
                    {ETAPA_PARA_PAPEL_ALVO[etapa] === "avaliador"
                      ? "Enviar para avaliação"
                      : "Enviar para apresentação"}
                    {selecionados.size > 0 && ` (${selecionados.size})`}
                  </button>
                )
              )}

              {podeLiberarCertificados && (
                <div className="relative flex-none">
                  <button
                    type="button"
                    onClick={() => setMenuLoteAberto((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
                  >
                    <ListChecks className="h-4 w-4 flex-none" strokeWidth={1.75} />
                    Funções em lote
                    <ChevronDown className="h-4 w-4 flex-none" strokeWidth={1.75} />
                  </button>

                  {menuLoteAberto && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuLoteAberto(false)}
                      />
                      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-fatec-line bg-white p-1.5 shadow-lg">
                        <button
                          type="button"
                          disabled={selecionadosElegiveisParaAceite.length === 0}
                          onClick={() => {
                            aceitarTodosSelecionados();
                            setMenuLoteAberto(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
                        >
                          <Check className="h-4 w-4 flex-none" strokeWidth={1.75} />
                          Aceitar todos selecionados
                          {selecionadosElegiveisParaAceite.length > 0 &&
                            ` (${selecionadosElegiveisParaAceite.length})`}
                        </button>
                        <button
                          type="button"
                          disabled={
                            trabalhosPendentesDeLiberacao.length === 0 &&
                            monitoresPendentesDeLiberacao.length === 0
                          }
                          onClick={() => {
                            liberarTodosCertificados();
                            setMenuLoteAberto(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
                        >
                          <Award className="h-4 w-4 flex-none" strokeWidth={1.75} />
                          Emitir certificados
                          {trabalhosPendentesDeLiberacao.length + monitoresPendentesDeLiberacao.length >
                            0 &&
                            ` (${trabalhosPendentesDeLiberacao.length + monitoresPendentesDeLiberacao.length})`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    {mostrarCheckbox && (
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={todosVisiveisSelecionados}
                          onChange={alternarSelecaoTodos}
                          className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                        />
                      </th>
                    )}
                    <th className="px-3 py-2 font-semibold">Trabalho</th>
                    <th className="px-3 py-2 font-semibold">Evento</th>
                    <th className="px-3 py-2 font-semibold">Área temática</th>
                    {etapa !== "submissao" && (
                      <th className="px-3 py-2 font-semibold">Avaliador</th>
                    )}
                    {(etapa === "apresentacao" || etapa === "resultado_final") && (
                      <th className="px-3 py-2 font-semibold">Moderador</th>
                    )}
                    <th className="px-3 py-2 font-semibold">Status</th>
                    {etapa === "resultado" && (
                      <th className="px-3 py-2 text-center font-semibold">
                        <button
                          type="button"
                          onClick={alternarOrdenacaoNota}
                          className="mx-auto flex items-center gap-1 uppercase tracking-[-0.01em] text-fatec-muted transition-colors hover:text-fatec-navy-900"
                        >
                          Nota av (/25)
                          {direcaoOrdenacaoNota === "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                          ) : direcaoOrdenacaoNota === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                        </button>
                      </th>
                    )}
                    {etapa === "resultado_final" && (
                      <>
                        <th className="px-3 py-2 text-center font-semibold" title="Nota da avaliação">
                          <button
                            type="button"
                            onClick={alternarOrdenacaoNota}
                            className="mx-auto flex items-center gap-1 uppercase tracking-[-0.01em] text-fatec-muted transition-colors hover:text-fatec-navy-900"
                          >
                            Nota av (/25)
                            {direcaoOrdenacaoNota === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : direcaoOrdenacaoNota === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                          </button>
                        </th>
                        <th
                          className="px-3 py-2 text-center font-semibold"
                          title="Nota da apresentação — só existe pra quem precisou de desempate. Ordena junto com a nota av, pela soma das duas."
                        >
                          <button
                            type="button"
                            onClick={alternarOrdenacaoNota}
                            className="mx-auto flex items-center gap-1 uppercase tracking-[-0.01em] text-fatec-muted transition-colors hover:text-fatec-navy-900"
                          >
                            Nota apr (/25)
                            {direcaoOrdenacaoNota === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : direcaoOrdenacaoNota === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                          </button>
                        </th>
                      </>
                    )}
                    <th className="px-3 py-2 font-semibold">Atualizado</th>
                    <th className="px-3 py-2 font-semibold">Situação</th>
                    {etapa === "resultado_final" && (
                      <th className="border-l border-fatec-line px-4 py-2 font-semibold">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {trabalhosExibidos.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      {mostrarCheckbox && (
                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="checkbox"
                            checked={selecionados.has(t.id)}
                            onChange={() => alternarSelecao(t.id)}
                            className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                          />
                        </td>
                      )}
                      <td className="max-w-[300px] px-3 py-2.5 align-top">
                        <button
                          type="button"
                          onClick={() => setTrabalhoDetalhe(t)}
                          className="text-left"
                        >
                          <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900 hover:text-fatec-sky-600 hover:underline">
                            {t.titulo}
                          </p>
                        </button>
                        <p className="mt-0.5 truncate text-xs text-fatec-muted">
                          {t.alunoNome}
                          {(t.participantesNomes?.length ?? 0) > 0 &&
                            ` +${t.participantesNomes!.length}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top text-fatec-ink">
                        {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                      </td>
                      <td className="px-3 py-2.5 align-top text-fatec-ink">
                        {t.areaTematica}
                      </td>
                      {etapa !== "submissao" && (
                        <td className="px-3 py-2.5 align-top text-fatec-ink">
                          {t.avaliadorNome ?? "—"}
                        </td>
                      )}
                      {(etapa === "apresentacao" || etapa === "resultado_final") && (
                        <td className="px-3 py-2.5 align-top text-fatec-ink">
                          {t.moderadorNome ?? "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                      {etapa === "resultado" && (
                        <td className="px-3 py-2.5 text-center align-top font-semibold text-fatec-navy-900">
                          {t.notaAvaliador ?? "—"}
                        </td>
                      )}
                      {etapa === "resultado_final" && (
                        <>
                          <td className="px-3 py-2.5 text-center align-top font-semibold text-fatec-navy-900">
                            {t.notaAvaliador ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center align-top font-semibold text-fatec-navy-900">
                            {t.notaModerador ?? "—"}
                          </td>
                        </>
                      )}
                      <td className="whitespace-nowrap px-3 py-2.5 align-top text-fatec-muted">
                        {formatarData(t.atualizadoEm)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top">
                        <CelulaSituacaoPagamento
                          trabalho={t}
                          evento={eventos.find((e) => e.id === t.eventoId)}
                        />
                      </td>
                      {etapa === "resultado_final" && (
                        <td className="border-l border-fatec-line px-4 py-3 align-top">
                          {/* Empatou, voltou da apresentação, ainda sem decisão
                              (2026-09-11): "Premiar" pra quem fica com a vaga do
                              pódio que sobrou, "Aceitar" pra quem participou mas
                              não ficou com ela (nunca é "recusado" só por
                              perder o desempate) — "Recusar" fica separado,
                              só pra reprovação de verdade. */}
                          {t.status === "apresentado" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Premiar"
                                title="Premiar — fica com a vaga do pódio, ganha Certificado"
                                onClick={() => decidirResultado(t.id, "premiar")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-orange-600 transition-colors hover:bg-fatec-orange-50"
                              >
                                <Award className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                aria-label="Aceitar sem prêmio"
                                title="Aceitar — participou, ganha Declaração"
                                onClick={() => decidirResultado(t.id, "aceitar")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
                              >
                                <Check className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                aria-label="Recusar"
                                title="Recusar — só pra reprovação de verdade, não pra quem só perdeu o desempate"
                                onClick={() => decidirResultado(t.id, "recusar")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50"
                              >
                                <X className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          )}
                          {t.status === "aceito" && (
                            <div className="flex flex-col items-start gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  t.premiado
                                    ? "bg-fatec-orange-100 text-fatec-orange-700"
                                    : "bg-fatec-navy-50 text-fatec-muted"
                                }`}
                              >
                                {t.premiado && <Award className="h-3 w-3" strokeWidth={2} />}
                                {t.premiado ? "Premiado" : "Aceito"}
                              </span>
                              {perfil?.papel === "admin" && (
                                t.certificadoLiberado ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                    <Award className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    Certificado liberado
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => liberarCertificado(t.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-fatec-line px-2.5 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                                  >
                                    <Award className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    Liberar certificado
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}

                  {trabalhosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-sm text-fatec-muted"
                      >
                        Nenhum trabalho nesta etapa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalEnviar}
        onClose={() => setModalEnviar(false)}
        title={papelAlvoEnvio === "avaliador" ? "Enviar para avaliação" : "Enviar para apresentação"}
      >
        <p className="text-sm text-fatec-ink">
          Enviar <span className="font-semibold">{selecionados.size}</span>{" "}
          trabalho(s) selecionado(s) para{" "}
          {papelAlvoEnvio === "avaliador" ? "avaliação" : "apresentação"}.
        </p>

        {!modoManual && pessoasDaArea.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fatec-navy-900">
                Dividir entre os {papelAlvoEnvio === "avaliador" ? "avaliadores" : "moderadores"} de{" "}
                {areaComumSelecionada}
              </span>
              <button
                type="button"
                onClick={() => setModoManual(true)}
                className="flex-none text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Escolher 1 avaliador manualmente
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {distribuicao.map((linha, i) => (
                <div
                  key={linha.uid}
                  className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-fatec-navy-900">
                    {linha.nome}
                  </span>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Diminuir para ${linha.nome}`}
                      onClick={() => ajustarQuantidade(i, -1)}
                      disabled={linha.quantidade <= 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-fatec-navy-900">
                      {linha.quantidade}
                    </span>
                    <button
                      type="button"
                      aria-label={`Aumentar para ${linha.nome}`}
                      onClick={() => ajustarQuantidade(i, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p
              className={`text-sm ${
                somaDistribuicao === selecionados.size
                  ? "text-fatec-muted"
                  : "font-medium text-fatec-orange-600"
              }`}
            >
              {somaDistribuicao} / {selecionados.size} trabalhos distribuídos
              {somaDistribuicao !== selecionados.size &&
                " — ajuste os números até bater o total"}
            </p>
          </div>
        ) : (
          <>
            {areaComumSelecionada && pessoasDaArea.length === 0 && (
              <p className="mt-4 text-sm text-fatec-muted">
                Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado
                para {areaComumSelecionada} neste evento — escolha manualmente.
              </p>
            )}

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Selecione o {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"}
              </span>
              <div className="relative">
                <select
                  value={avaliadorEscolhido}
                  onChange={(e) => setAvaliadorEscolhido(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                >
                  {pessoasParaManual.length === 0 && (
                    <option value="">
                      Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado
                    </option>
                  )}
                  {pessoasParaManual.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                  strokeWidth={1.75}
                />
              </div>
            </label>

            {pessoasDaArea.length > 0 && (
              <button
                type="button"
                onClick={() => setModoManual(false)}
                className="mt-2 text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Voltar pra divisão automática
              </button>
            )}
          </>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModalEnviar(false)}
            className="rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={
              !modoManual && pessoasDaArea.length > 0
                ? confirmarEnvioDistribuido
                : confirmarEnvio
            }
            disabled={
              !modoManual && pessoasDaArea.length > 0
                ? somaDistribuicao !== selecionados.size
                : !avaliadorEscolhido
            }
            className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            Enviar
          </button>
        </div>
      </Modal>

      <DetalheTrabalhoModal
        trabalho={trabalhoDetalhe}
        evento={eventos.find((e) => e.id === trabalhoDetalhe?.eventoId)}
        onClose={() => setTrabalhoDetalhe(null)}
        onEditar={
          perfil?.papel === "admin"
            ? () => {
                setTrabalhoEditando(trabalhoDetalhe);
                setTrabalhoDetalhe(null);
              }
            : undefined
        }
      />

      {trabalhoEditando && (
        <SubmeterTrabalhoModal
          open={!!trabalhoEditando}
          eventoId={trabalhoEditando.eventoId}
          temTaxa={!!eventos.find((e) => e.id === trabalhoEditando.eventoId)?.valorInscricao}
          eventoNome={eventos.find((e) => e.id === trabalhoEditando.eventoId)?.nome ?? ""}
          areasDisponiveis={eventos.find((e) => e.id === trabalhoEditando.eventoId)?.areasTematicas ?? []}
          areasComplexas={eventos.find((e) => e.id === trabalhoEditando.eventoId)?.areasTematicasComplexas ?? []}
          meuUid={user?.uid}
          modoEdicao
          valoresIniciais={{
            titulo: trabalhoEditando.titulo,
            resumo: trabalhoEditando.resumo,
            areaTematica: trabalhoEditando.areaTematica,
            modalidadeApresentacao: trabalhoEditando.modalidadeApresentacao,
            nomeOrientador: trabalhoEditando.nomeOrientador,
            participantes: (trabalhoEditando.participantesUids ?? []).map((uid, i) => ({
              uid,
              nome: trabalhoEditando.participantesNomes?.[i] ?? uid,
            })),
          }}
          onClose={() => setTrabalhoEditando(null)}
          onSubmit={(dados) => salvarEdicaoAdmin(trabalhoEditando, dados)}
        />
      )}
    </main>
  );
}
