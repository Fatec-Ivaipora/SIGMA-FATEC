"use client";

import { useMemo, useState } from "react";
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
  GraduationCap,
  Users,
  Printer,
  Loader2,
} from "lucide-react";
import { serverTimestamp, writeBatch, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { DetalheTrabalhoModal } from "@/components/DetalheTrabalhoModal";
import { AvisoConflitos } from "@/components/AvisoConflitos";
import { planejarDistribuicao, conflitoDeInteresse } from "@/lib/conflitoInteresse";
import { useSessoesDoEvento } from "@/lib/data/sessoes";
import { SubmeterTrabalhoModal, type DadosSubmissao } from "@/components/SubmeterTrabalhoModal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type Evento } from "@/lib/data/eventos";
import {
  useTrabalhos,
  type TrabalhoStatus,
  type Trabalho,
  type NotasCriterios,
  atualizarTrabalho,
} from "@/lib/data/trabalhos";
import { useUsuarios, type UsuarioRegistro } from "@/lib/data/usuarios";
import { useMinhaInscricao, useInscritosDoEvento } from "@/lib/data/inscricoes";
import { useMonitoresDoEvento } from "@/lib/data/monitores";
import {
  notificarAtribuicao,
  notificarStatusTrabalho,
  notificarConviteColega,
  notificarAlteracaoAdmin,
} from "@/lib/notificarEmail";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import { baixarCertificadosImpressao } from "@/lib/baixarCertificado";
import { CRITERIOS_AVALIACAO, NOTAS_AVALIACAO } from "@/lib/criteriosAvaliacao";

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
  { key: "apresentacao", label: "Desempate" },
  { key: "resultado_final", label: "Resultado Final" },
];

const STATUS_POR_ETAPA: Record<Etapa, TrabalhoStatus[]> = {
  submissao: ["submissao"],
  avaliacao: ["aguardando_avaliacao"],
  // "entregue_com_atraso" (2026-11-04) fica aqui também — aluno corrigiu um
  // "revisao" depois do prazo de avaliação encerrar; o avaliador ganha uma
  // exceção e ainda consegue avaliar esse trabalho específico (ver
  // firestore.rules), mas continua listado aqui pra registrar, no fim do
  // evento, quem respondeu atrasado versus quem nunca respondeu.
  // "revisao_realizada" (2026-11-05) também — trabalho legado que ganhou
  // nota tarde fica travado aqui pra sempre, nunca passa pra "Resultado"
  // (ver comentário em TrabalhoStatus).
  revisao: ["revisao", "entregue_com_atraso", "revisao_realizada"],
  resultado: ["avaliado"],
  apresentacao: ["aguardando_apresentacao"],
  resultado_final: ["apresentado", "aceito", "nao_aceito"],
};

// Etapas em que a organização seleciona trabalhos e distribui entre pessoas
// (avaliadores na Submissão, moderadores no Resultado) — mesma mecânica nos
// dois casos, só troca o papel-alvo (2026-08-26).
// "revisao" entrou em 2026-11-06 (pedido explícito do usuário — "a comissão
// está sendo pressionada a reavaliar esses trabalhos... criar uma forma de
// enviar aqueles que estão em revisão para pessoas específicas"): reaproveita
// a MESMA distribuição manual de avaliador, só que a partir da aba Revisão —
// ver trabalhosSelecionaveisRevisao (só os 46 legados aparecem com
// checkbox) e o campo extra em camposEnvio que limpa revisaoLegado.
const ETAPA_PARA_PAPEL_ALVO: Partial<Record<Etapa, "avaliador" | "moderador">> = {
  submissao: "avaliador",
  revisao: "avaliador",
  resultado: "moderador",
};

// Status que significam "já passou pela avaliação" — usado pro pódio por
// área considerar todo mundo que já tem nota, mesmo quem já saiu de
// "avaliado" (ver analiseResultadoPorArea). "revisao_realizada" (2026-11-05)
// FICA DE FORA de propósito, mesmo tendo notaAvaliador — pedido explícito do
// usuário: esses trabalhos legados apresentam normalmente, mas não
// concorrem a pódio/prêmio nem entram no cálculo de empate.
//
// "revisao" ENTRA (2026-11-06, pedido explícito do usuário) — desde que a
// nota já tenha sido travada ANTES de mandar pra revisão (fluxo corrigido
// em 2026-11-05: professor dá nota + pede ajuste de texto no mesmo passo).
// A nota é definitiva, então o trabalho já concorre a pódio/empate na hora,
// sem esperar o aluno corrigir o texto — "a revisão não deveria interferir
// no evento, é só pra facilitar na hora de levar os resumos aceitos pra
// revista depois". `analiseResultadoPorArea` abaixo já exige
// `typeof t.notaAvaliador === "number"`, então isso NUNCA pega os
// trabalhos legados sem nota (que continuam de fora até alguém os
// reavaliar — ver tela Revisão, "Enviar para reavaliação").
const STATUS_JA_AVALIADO: TrabalhoStatus[] = [
  "avaliado",
  "revisao",
  "aguardando_apresentacao",
  "apresentado",
  "aceito",
  "nao_aceito",
];

function formatarData(valor: unknown): string {
  if (!valor || typeof valor !== "object" || !("toDate" in valor)) return "—";
  return (valor as { toDate(): Date }).toDate().toLocaleDateString("pt-BR");
}

function formatarDataHora(valor: unknown): string {
  if (!valor || typeof valor !== "object" || !("toDate" in valor)) return "—";
  return (valor as { toDate(): Date }).toDate().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Milissegundos do envio (cai pra última edição em trabalho sem enviadoEm) —
// ordena a tabela pelo último envio recebido (2026-10-28).
function momentoEnvio(t: Trabalho): number {
  const valor = (t.enviadoEm ?? t.atualizadoEm) as { toMillis?: () => number } | undefined;
  return typeof valor?.toMillis === "function" ? valor.toMillis() : 0;
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

function SecaoInscritos({
  titulo,
  icone,
  pessoas,
  mostrarPago,
}: {
  titulo: string;
  icone: React.ReactNode;
  pessoas: { uid: string; nome: string; email: string; status: string }[];
  mostrarPago: boolean;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fatec-navy-900">
        {icone}
        {titulo}
        <span className="font-normal text-fatec-muted">({pessoas.length})</span>
      </h3>
      <div className="mt-2 flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line bg-white">
        {pessoas.map((p) => {
          const pago = p.status === "pago";
          return (
            <div key={p.uid} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-xs font-semibold text-white">
                {(p.nome || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fatec-navy-900">{p.nome}</p>
                <p className="truncate text-xs text-fatec-muted">{p.email}</p>
              </div>
              <span
                className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
                  pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {mostrarPago ? (pago ? "Pago" : "Não pago") : "Inscrito"}
              </span>
            </div>
          );
        })}
        {pessoas.length === 0 && (
          <p className="px-4 py-3 text-sm text-fatec-muted">Ninguém encontrado.</p>
        )}
      </div>
    </div>
  );
}

/** Evento "simples" (2026-09-22) não tem trabalho/avaliação — no lugar da
 * pipeline de ETAPAS, essa tela mostra só quem se inscreveu (mesmo
 * conteúdo de InscritosEventoModal.tsx, aqui em tela cheia em vez de modal).
 * "Liberar certificados" morava aqui, mudou pra aba Ensalamento (2026-09-30,
 * pedido explícito do usuário) — lá dá pra ver a presença de verdade antes
 * de decidir, que é o critério que mais importa (o pagamento mostrado
 * abaixo é só informativo, quem trava de verdade é /api/certificados). */
function InscritosSimplesView({ evento }: { evento: Evento }) {
  const { inscritos } = useInscritosDoEvento(evento.id);
  const [busca, setBusca] = useState("");
  // Filtro por pagamento (2026-10-05, pedido explícito do usuário) — só faz
  // sentido quando o evento cobra inscrição (mesmo critério de mostrarPago
  // abaixo); evento gratuito não tem "pago/não pago", só "inscrito".
  const [filtroPagamento, setFiltroPagamento] = useState<"todos" | "pago" | "nao_pago">("todos");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscritos.filter((i) => {
      const bateBusca =
        !termo || i.nome.toLowerCase().includes(termo) || i.email.toLowerCase().includes(termo);
      const batePagamento =
        filtroPagamento === "todos" ||
        (filtroPagamento === "pago" ? i.status === "pago" : i.status !== "pago");
      return bateBusca && batePagamento;
    });
  }, [inscritos, busca, filtroPagamento]);

  const daFatec = filtrados.filter((i) => i.vinculoFatec !== false);
  const externos = filtrados.filter((i) => i.vinculoFatec === false);
  const pagos = inscritos.filter((i) => i.status === "pago").length;

  return (
    <div className="flex-1 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl bg-fatec-navy-50 px-4 py-3 text-sm text-fatec-muted">
            <span className="font-semibold text-fatec-navy-900">{inscritos.length}</span>{" "}
            {inscritos.length === 1 ? "inscrito" : "inscritos"}
            {!!evento.valorInscricao && (
              <>
                {" — "}
                <span className="font-semibold text-emerald-700">{pagos} pagos</span>,{" "}
                <span className="font-semibold text-amber-700">
                  {inscritos.length - pagos} pendentes
                </span>
              </>
            )}
            .
          </div>

          <div className="relative sm:w-72">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full rounded-xl border border-fatec-line bg-white py-2.5 pl-10 pr-4 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </div>
        </div>

        {/* Filtro por pagamento (2026-10-05, pedido explícito do usuário) —
            só em evento pago, igual mostrarPago abaixo: gratuito não tem
            "pago/não pago" pra filtrar. */}
        {!!evento.valorInscricao && (
          <div className="flex flex-wrap gap-1 self-start rounded-xl bg-fatec-navy-50 p-1">
            {(
              [
                { label: "Todos", valor: "todos" },
                { label: "Pago", valor: "pago" },
                { label: "Não pago", valor: "nao_pago" },
              ] as const
            ).map((v) => (
              <button
                key={v.valor}
                type="button"
                onClick={() => setFiltroPagamento(v.valor)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  filtroPagamento === v.valor
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SecaoInscritos
            titulo="Alunos da Fatec"
            icone={<GraduationCap className="h-4 w-4" strokeWidth={1.75} />}
            pessoas={daFatec}
            mostrarPago={!!evento.valorInscricao}
          />
          <SecaoInscritos
            titulo="Externos"
            icone={<Users className="h-4 w-4" strokeWidth={1.75} />}
            pessoas={externos}
            mostrarPago={!!evento.valorInscricao}
          />
        </div>
      </div>
    </div>
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
  // Nota da comissão organizadora pros trabalhos da aba Revisão (2026-11-06,
  // pedido explícito do usuário — só admin/organização acessam essa tela,
  // então o botão "Dar nota" já fica restrito a quem já tem acesso aqui).
  const [notaComissao, setNotaComissao] = useState<Trabalho | null>(null);
  const [notasComissao, setNotasComissao] = useState<Record<string, number>>({});
  const [salvandoNotaComissao, setSalvandoNotaComissao] = useState(false);
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

  // Abre sempre em "Todos os eventos" (2026-10-16, pedido explícito do
  // usuário, mesmo achado de Relatórios) — a pré-seleção automática do
  // evento em destaque (2026-08-31) fazia a tela parecer travada no evento
  // de sempre; ficou pior ainda depois que encerrado passou a sumir do
  // dropdown (o destaque podia ser um evento JÁ ENCERRADO, tipo a Semana
  // de Medicina: o `<select>` mostrava "Todos os eventos" — primeira opção,
  // já que o valor selecionado de verdade não tinha mais option — mas o
  // conteúdo embaixo continuava sendo só daquele evento). A pessoa escolhe
  // o evento ela mesma.

  // Monitores do evento selecionado — "Emitir certificados" libera junto
  // com os trabalhos aceitos (2026-09-01). Só faz sentido com um evento
  // específico escolhido (não em "todos", que mistura vários eventos).
  const { monitores: monitoresDoEventoAtual } = useMonitoresDoEvento(
    eventoId !== "todos" ? eventoId : undefined,
  );

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEnviar, setModalEnviar] = useState(false);
  const [papelAlvoEnvio, setPapelAlvoEnvio] = useState<"avaliador" | "moderador">("avaliador");
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

  // Encerrado some do seletor (2026-10-16, pedido explícito do usuário) —
  // só enche espaço num fluxo que é sobre trabalho em andamento; eventoId só
  // muda por este dropdown (sem deep-link por URL nessa tela), então não
  // tem risco de ficar com um encerrado selecionado "invisível" na lista.
  // "Ver encerrados" (2026-10-21, pedido explícito do usuário) — só admin:
  // botão ao lado do seletor que devolve os encerrados pra lista (marcados
  // "(encerrado)"), pra consultar trabalho/certificado de evento que já
  // fechou. Desligado = comportamento acima, de sempre.
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const podeVerEncerrados = perfil?.papel === "admin";
  const eventosSelecionaveis = useMemo(
    () => eventos.filter((e) => !e.encerrado || (podeVerEncerrados && mostrarEncerrados)),
    [eventos, podeVerEncerrados, mostrarEncerrados],
  );

  function alternarEncerrados() {
    // Esconder de novo com um encerrado selecionado volta pra "todos" —
    // senão ele ficaria selecionado sem aparecer no dropdown (mesmo
    // problema descrito no comentário de "Abre sempre em Todos" acima).
    if (mostrarEncerrados && eventos.find((e) => e.id === eventoId)?.encerrado) {
      setEventoId("todos");
      setAreaFiltro("Todas as áreas");
    }
    setMostrarEncerrados((v) => !v);
  }

  // Evento "simples" (2026-09-22) não tem trabalho/avaliação nenhuma — essa
  // tela vira só uma lista de inscritos + liberar certificado, ver o early
  // return logo depois do guard de carregando abaixo.
  const eventoSelecionado =
    eventoId !== "todos" ? eventos.find((e) => e.id === eventoId) : undefined;

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
    // Sem ordenação por nota: o último envio recebido primeiro (2026-10-28,
    // pedido explícito do usuário). Só a exibição — trabalhosFiltrados (usado
    // na divisão entre avaliadores) continua como está.
    if (!direcaoOrdenacaoNota) {
      return [...trabalhosFiltrados].sort((a, b) => momentoEnvio(b) - momentoEnvio(a));
    }
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

  // Orientador pode ser alocado como avaliador de um evento (2026-08-25,
  // RF-46). Também entra quem tem "avaliador" em papeisAvaliacao mesmo com
  // outro papel primário (2026-10-16, achado real cadastrando os
  // avaliadores da X MAC: organização que também avalia ficava invisível
  // aqui, só o moderador já tinha essa checagem — mesmo padrão agora).
  const avaliadoresDisponiveis = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.papel === "avaliador" ||
          u.papel === "orientador" ||
          u.papeisAvaliacao?.includes("avaliador"),
      ),
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

  // Trabalhos selecionados na etapa Submissão — usada tanto pra descobrir
  // se compartilham evento/área quanto pra fatiar a divisão entre
  // avaliadores. Deriva de `trabalhos` (lista inteira), não de
  // `trabalhosFiltrados` (2026-10-28, corrigido — achado ao vivo: marcar
  // trabalhos em buscas diferentes, com o campo de busca ainda preenchido
  // na última, fazia a modal "Enviar para avaliação" só considerar o
  // trabalho ainda visível no filtro atual, mesmo com o contador "(N)" do
  // botão mostrando a seleção global certa). `selecionados` é zerado toda
  // troca de etapa (ver setEtapa), então já não precisa refiltrar por
  // etapa aqui — ids ali dentro sempre pertencem à etapa atual.
  const trabalhosSelecionadosObjs = useMemo(
    () => trabalhos.filter((t) => selecionados.has(t.id)),
    [trabalhos, selecionados],
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

  // Reavaliação externa, sem login (2026-11-06, pedido explícito do usuário
  // — "muitos dos professores que se prontificaram a ajudar nessa segunda
  // revisão não são avaliadores e nem estão no SIGMA... uma tela de
  // avaliação externa que não precisa de login"). ⚠ EXCEÇÃO TEMPORÁRIA — ver
  // comentário em src/app/api/revisao-externa/convidar/route.ts, remover
  // depois que os legados da X MAC forem reavaliados. Envia TODOS os
  // selecionados pra UM e-mail só (admin repete a seleção+envio pra cada
  // pessoa, uns 4-5 trabalhos por vez).
  const [modalReavaliacaoExterna, setModalReavaliacaoExterna] = useState(false);
  const [emailExterno, setEmailExterno] = useState("");
  const [nomeExterno, setNomeExterno] = useState("");
  const [enviandoExterno, setEnviandoExterno] = useState(false);
  const [erroExterno, setErroExterno] = useState<string | null>(null);

  async function enviarReavaliacaoExterna() {
    if (!user || !eventoComumSelecionado) return;
    setEnviandoExterno(true);
    setErroExterno(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/revisao-externa/convidar", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: eventoComumSelecionado,
          trabalhoIds: [...selecionados],
          email: emailExterno,
          nome: nomeExterno,
        }),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        setErroExterno(dados?.erro ?? "Não foi possível enviar o convite.");
        return;
      }
      setModalReavaliacaoExterna(false);
      setEmailExterno("");
      setNomeExterno("");
      setSelecionados(new Set());
    } finally {
      setEnviandoExterno(false);
    }
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
    setModoManual(daArea.length === 0);
    setDistribuicao(
      daArea.length > 0
        ? distribuicaoPadrao(
            daArea.map((a) => ({ uid: a.uid, nome: a.nome })),
            selecionados.size,
          )
        : [],
    );
    setModalEnviar(true);
  }

  function ajustarQuantidade(uid: string, delta: number) {
    setDistribuicao((prev) =>
      prev.map((linha) =>
        linha.uid === uid
          ? { ...linha, quantidade: Math.max(0, linha.quantidade + delta) }
          : linha,
      ),
    );
  }

  // Modo manual (2026-10-28, pedido explícito do usuário — achado real: "não
  // conseguimos selecionar mais de um avaliador por vez sem área temática")
  // — marca/desmarca uma pessoa na divisão; some da lista some do
  // `distribuicao`, aparece já com 1 trabalho reservado (fácil de ajustar
  // pelos botões +/-, mesmo padrão da divisão automática).
  function alternarPessoaManual(pessoa: { uid: string; nome: string }) {
    setDistribuicao((prev) => {
      const jaMarcada = prev.some((p) => p.uid === pessoa.uid);
      if (jaMarcada) return prev.filter((p) => p.uid !== pessoa.uid);
      return [...prev, { ...pessoa, quantidade: 1 }];
    });
  }

  // "Selecionar todos" no modo manual (2026-10-28, pedido explícito do
  // usuário — achado real: marcar um por um fica complicado com 25
  // avaliadores). Marca todo mundo já dividindo os trabalhos igualmente
  // entre eles (mesmo cálculo de "Dividir igualmente entre os marcados"),
  // em vez de 1 trabalho reservado por pessoa — evita que a soma passe
  // longe do total e precise ajustar manualmente depois.
  const todosManualMarcados =
    pessoasParaManual.length > 0 &&
    pessoasParaManual.every((a) => distribuicao.some((d) => d.uid === a.uid));

  function alternarTodosManual() {
    setDistribuicao(
      todosManualMarcados
        ? []
        : distribuicaoPadrao(
            pessoasParaManual.map((a) => ({ uid: a.uid, nome: a.nome })),
            selecionados.size,
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

  // Certificados pra imprimir no papel timbrado (2026-11-04, pedido explícito
  // do usuário — "liberar pra secretaria gerar"): organização do evento também
  // gera, não só o admin. Precisa de um evento escolhido no filtro. A
  // secretaria imprime ANTES do evento: entram todos os trabalhos que já
  // foram pra avaliação (só fica de fora a Submissão), e o botão aparece em
  // todas as abas. Com trabalhos marcados na tabela, imprime só esses.
  const [gerandoImpressao, setGerandoImpressao] = useState(false);
  const [erroImpressao, setErroImpressao] = useState<string | null>(null);
  async function imprimirCertificados() {
    if (!user || eventoId === "todos") return;
    setErroImpressao(null);
    setGerandoImpressao(true);
    const r = await baixarCertificadosImpressao(user, eventoId, [...selecionados]);
    if (!r.ok) setErroImpressao(r.erro);
    setGerandoImpressao(false);
  }

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

  // Na aba Revisão, só os 46 legados (sem nota, fluxo antigo) podem ser
  // selecionados pra reavaliação (2026-11-06, pedido explícito do usuário —
  // escopo confirmado: "só os 46 legados", não os que já seguem o fluxo
  // corrigido com nota travada nem o que já virou "Revisão concluída").
  // Fora da aba Revisão, todo mundo visível pode ser selecionado, igual
  // sempre foi.
  function podeSelecionar(t: Trabalho): boolean {
    return etapa !== "revisao" || t.revisaoLegado === true;
  }

  // Só os selecionados que ainda fazem sentido aceitar (já apresentados,
  // aguardando decisão) — selecionar um já aceito/recusado não faz nada.
  // Mesmo bug do trabalhosSelecionadosObjs acima, mesma correção — selação
  // pode ter vindo de buscas/filtros diferentes dentro da mesma etapa.
  const selecionadosElegiveisParaAceite = useMemo(
    () => trabalhos.filter((t) => selecionados.has(t.id) && t.status === "apresentado"),
    [trabalhos, selecionados],
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
  // `podeSelecionar` (2026-11-06) filtra pra só os legados na aba Revisão.
  const trabalhosSelecionaveisVisiveis = useMemo(
    () => trabalhosFiltrados.filter((t) => etapa !== "revisao" || t.revisaoLegado === true),
    [trabalhosFiltrados, etapa],
  );
  const todosVisiveisSelecionados =
    trabalhosSelecionaveisVisiveis.length > 0 &&
    trabalhosSelecionaveisVisiveis.every((t) => selecionados.has(t.id));

  function alternarSelecaoTodos() {
    setSelecionados((prev) => {
      if (todosVisiveisSelecionados) {
        const next = new Set(prev);
        for (const t of trabalhosSelecionaveisVisiveis) next.delete(t.id);
        return next;
      }
      const next = new Set(prev);
      for (const t of trabalhosSelecionaveisVisiveis) next.add(t.id);
      return next;
    });
  }

  // Conflito de interesse (2026-10-27, pedido explícito do usuário) —
  // professor pode ser orientador e avaliador/moderador ao mesmo tempo.
  // Divisão automática: plano que desvia os conflitos sempre que dá.
  // Envio manual: lista os trabalhos selecionados em que a pessoa escolhida
  // é autora/orientadora/coorientadora, pra quem envia decidir.
  const planoDistribuicao = useMemo(
    () => planejarDistribuicao(trabalhosSelecionadosObjs, distribuicao),
    [trabalhosSelecionadosObjs, distribuicao],
  );
  // Campos e status gravados mudam conforme o alvo do envio (2026-08-26).
  function camposEnvio(uid: string, nome: string) {
    return papelAlvoEnvio === "avaliador"
      ? { status: "aguardando_avaliacao" as const, avaliadorUid: uid, avaliadorNome: nome }
      : { status: "aguardando_apresentacao" as const, moderadorUid: uid, moderadorNome: nome };
  }

  async function confirmarEnvioDistribuido() {
    if (somaDistribuicao !== selecionados.size) return;

    // Conflito de interesse (2026-10-27, trava de verdade desde 2026-10-28):
    // em vez de fatiar na ordem da tabela, cada trabalho vai pra quem ainda
    // tem vaga e NÃO é autor/orientador/coorientador dele — ver
    // planejarDistribuicao. Trabalho que só tinha o próprio orientador como
    // opção fica fora de `atribuicoes` (listado em `naoAtribuidos`, já
    // avisado na modal antes de chegar aqui) — nunca é enviado pra ele.
    const batch = writeBatch(db);
    for (const { trabalho, pessoa } of planoDistribuicao.atribuicoes) {
      batch.update(doc(db, "trabalhos", trabalho.id), {
        ...camposEnvio(pessoa.uid, pessoa.nome),
        atualizadoEm: serverTimestamp(),
      });
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

  /** Abre a nota da comissão já com a nota anterior do avaliador marcada
   * (quando existir) — a comissão confirma ou ajusta. */
  function abrirNotaComissao(t: Trabalho) {
    const anterior = (t.notasCriterios ?? {}) as unknown as Record<string, unknown>;
    const iniciais: Record<string, number> = {};
    for (const c of CRITERIOS_AVALIACAO) {
      if (typeof anterior[c.key] === "number") iniciais[c.key] = anterior[c.key] as number;
    }
    setNotasComissao(iniciais);
    setNotaComissao(t);
  }

  /** Nota da comissão vira avaliação normal: status "avaliado", entra no
   * Resultado e concorre ao pódio/empate como qualquer outro (2026-11-06,
   * pedido explícito do usuário — "deixar o botão Dar nota para a
   * organização e admin", que já é a única audiência desta tela).
   * `notaPelaComissao` só registra quem deu a nota; avaliadorUid/
   * avaliadorNome ficam como estavam. */
  async function salvarNotaComissao() {
    if (!notaComissao) return;
    if (!CRITERIOS_AVALIACAO.every((c) => notasComissao[c.key])) return;
    const soma = CRITERIOS_AVALIACAO.reduce((acc, c) => acc + notasComissao[c.key], 0);
    setSalvandoNotaComissao(true);
    try {
      await atualizarTrabalho(notaComissao.id, {
        status: "avaliado",
        notasCriterios: notasComissao as unknown as NotasCriterios,
        notaAvaliador: soma,
        notaPelaComissao: true,
        comentarioRevisao: null,
        atualizadoEm: serverTimestamp(),
      });
      // Avisa o aluno (2026-11-06, pedido explícito do usuário) — sem isso
      // ele só saberia entrando no SIGMA pra conferir.
      if (user) notificarStatusTrabalho(user, notaComissao.id, "reavaliado");
      setNotaComissao(null);
    } finally {
      setSalvandoNotaComissao(false);
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

  // Contagem só pro rótulo/disabled do botão "Liberar trabalhos para
  // moderadores" (2026-11-04) — empatados desse evento que ainda estão
  // "avaliado" de verdade, mesmo cálculo de liberarTrabalhosParaModeradores.
  const qtdEmpatadosParaLiberar = useMemo(() => {
    if (!podeAceitarSemEmpate) return 0;
    let total = 0;
    for (const [chave, analise] of analiseResultadoPorArea) {
      if (!chave.startsWith(`${eventoId}::`)) continue;
      total += analise.empatados.filter((id) => idsAindaAvaliado.has(id)).length;
    }
    return total;
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

  // Sessões do evento selecionado (2026-11-04) — só pra achar a sala de
  // cada trabalho empatado na hora de "Liberar trabalhos para moderadores"
  // (sessaoId -> salaId -> evento.moderadoresPorSala, ver /ensalamento).
  const { sessoes: sessoesDoEvento } = useSessoesDoEvento(
    eventoId !== "todos" ? eventoId : undefined,
  );

  // Resultado de "Liberar trabalhos para moderadores" — trabalhos que não
  // deu pra resolver sozinho (sala sem moderador, ou moderador da sala em
  // conflito com aquele trabalho específico) ficam aqui pra quem administra
  // resolver na mão, reaproveitando o "Enviar para desempate" manual.
  const [pendentesLiberacao, setPendentesLiberacao] = useState<
    { trabalho: Trabalho; motivo: string }[] | null
  >(null);

  // Liga o ensalamento (sala + moderador da sala) com o desempate
  // (2026-11-04, pedido explícito do usuário — "evita que a gente tenha
  // que enviar pros moderadores os trabalhos empatados"). Pra cada trabalho
  // empatado ainda não liberado (status "avaliado" de verdade, não só
  // reaparecendo no cálculo): acha a sessão pelo sessaoId, a sala pela
  // sessão, o moderador da sala em evento.moderadoresPorSala — se tudo
  // bater e não houver conflito de interesse, grava moderadorUid/Nome +
  // status "aguardando_apresentacao", igual o "Enviar para desempate"
  // manual já fazia. Quem não bateu (sem sala ainda, sala sem moderador, ou
  // moderador em conflito) fica em pendentesLiberacao pra resolver na mão.
  async function liberarTrabalhosParaModeradores() {
    if (eventoId === "todos") return;
    const eventoAtual = eventos.find((e) => e.id === eventoId);
    const moderadoresPorSala = eventoAtual?.moderadoresPorSala ?? {};
    const sessaoPorId = new Map(sessoesDoEvento.map((s) => [s.id, s]));

    const idsDoEvento = new Set<string>();
    for (const [chave, analise] of analiseResultadoPorArea) {
      if (!chave.startsWith(`${eventoId}::`)) continue;
      analise.empatados.forEach((id) => idsDoEvento.add(id));
    }
    const trabalhosEmpatados = trabalhos.filter(
      (t) => idsDoEvento.has(t.id) && idsAindaAvaliado.has(t.id),
    );

    const batch = writeBatch(db);
    const porModerador = new Map<string, { uid: string; nome: string; quantidade: number }>();
    const pendentes: { trabalho: Trabalho; motivo: string }[] = [];

    for (const t of trabalhosEmpatados) {
      const sessao = t.sessaoId ? sessaoPorId.get(t.sessaoId) : undefined;
      if (!sessao) {
        pendentes.push({ trabalho: t, motivo: "Ainda não foi ensalado (sem sala)." });
        continue;
      }
      const moderador = moderadoresPorSala[sessao.salaId];
      if (!moderador) {
        pendentes.push({ trabalho: t, motivo: "A sala onde está não tem moderador atribuído." });
        continue;
      }
      if (conflitoDeInteresse(moderador, t)?.nivel === "certo") {
        pendentes.push({
          trabalho: t,
          motivo: "O moderador da sala tem conflito de interesse com esse trabalho.",
        });
        continue;
      }
      batch.update(doc(db, "trabalhos", t.id), {
        status: "aguardando_apresentacao",
        moderadorUid: moderador.uid,
        moderadorNome: moderador.nome,
        atualizadoEm: serverTimestamp(),
      });
      const atual = porModerador.get(moderador.uid) ?? {
        uid: moderador.uid,
        nome: moderador.nome,
        quantidade: 0,
      };
      atual.quantidade++;
      porModerador.set(moderador.uid, atual);
    }

    if (porModerador.size > 0) {
      await batch.commit();
      if (user) {
        notificarAtribuicao(
          user,
          Array.from(porModerador.values()).map((m) => ({
            uid: m.uid,
            papel: "moderador" as const,
            quantidade: m.quantidade,
          })),
          eventoId,
        );
      }
    }
    setPendentesLiberacao(pendentes);
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

  // Evento simples (2026-09-22) — sem trabalho/avaliação, mostra a lista de
  // inscritos em vez de toda a pipeline de ETAPAS abaixo. Cabeçalho e
  // seletor de evento continuam os mesmos, só o conteúdo muda.
  if (eventoSelecionado?.tipo === "simples") {
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
                Esse evento é do tipo “simples” — sem trabalho, só inscrição
                e certificado de participação.
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              {podeVerEncerrados && (
                <button
                  type="button"
                  onClick={alternarEncerrados}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    mostrarEncerrados
                      ? "bg-fatec-navy-900 text-white hover:bg-fatec-navy-800"
                      : "border border-fatec-line bg-white text-fatec-navy-900 hover:bg-fatec-navy-50"
                  }`}
                >
                  {mostrarEncerrados ? "Ocultar encerrados" : "Ver encerrados"}
                </button>
              )}
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
                  {eventosSelecionaveis.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.nome}
                      {ev.encerrado ? " (encerrado)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                  strokeWidth={1.75}
                />
              </div>
            </div>
          </header>

          <InscritosSimplesView evento={eventoSelecionado} />
        </div>
      </main>
    );
  }

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

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {podeVerEncerrados && (
              <button
                type="button"
                onClick={alternarEncerrados}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mostrarEncerrados
                    ? "bg-fatec-navy-900 text-white hover:bg-fatec-navy-800"
                    : "border border-fatec-line bg-white text-fatec-navy-900 hover:bg-fatec-navy-50"
                }`}
              >
                {mostrarEncerrados ? "Ocultar encerrados" : "Ver encerrados"}
              </button>
            )}
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
                {eventosSelecionaveis.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nome}
                    {ev.encerrado ? " (encerrado)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                strokeWidth={1.75}
              />
            </div>
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
              {/* "Ações do resultado" sempre aparece na aba Resultado, mesmo
                * sem evento específico selecionado — antes virava o botão
                * antigo "Enviar para desempate" sozinho nesse caso, sem
                * acesso a "Liberar trabalhos para moderadores" nenhuma, e o
                * usuário achou que o botão novo "não existia" (2026-11-05,
                * achado real). Agora fica cinza/desabilitado com um aviso,
                * mesmo padrão sempre, nunca troca de botão. */}
              {etapa === "resultado" ? (
                <div className="relative flex-none">
                  <button
                    type="button"
                    onClick={() => podeAceitarSemEmpate && setMenuResultadoAberto((v) => !v)}
                    disabled={!podeAceitarSemEmpate}
                    title={!podeAceitarSemEmpate ? "Selecione um evento específico pra usar essas ações" : undefined}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                  >
                    <Send className="h-4 w-4 flex-none" strokeWidth={1.75} />
                    Ações do resultado
                    <ChevronDown className="h-4 w-4 flex-none" strokeWidth={1.75} />
                  </button>

                  {menuResultadoAberto && podeAceitarSemEmpate && (
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
                          title="Resolve de uma vez toda área sem empate na fronteira do top 3 — os 3 melhores viram Aceito+Premiado, o resto vira só Aceito. Quem está empatado fica de fora, esperando ir pro desempate."
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
                          Enviar para desempate
                          {selecionados.size > 0 && ` (${selecionados.size})`}
                        </button>
                        <button
                          type="button"
                          disabled={qtdEmpatadosParaLiberar === 0}
                          onClick={() => {
                            liberarTrabalhosParaModeradores();
                            setMenuResultadoAberto(false);
                          }}
                          title="Pra cada empatado, acha a sala onde já está (ensalamento) e o moderador designado pra ela — libera direto pro SIGMA dele, sem precisar escolher na mão."
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
                        >
                          <Users className="h-4 w-4 flex-none" strokeWidth={1.75} />
                          Liberar trabalhos para moderadores
                          {qtdEmpatadosParaLiberar > 0 && ` (${qtdEmpatadosParaLiberar})`}
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
                    {etapa === "revisao"
                      ? "Enviar para reavaliação"
                      : ETAPA_PARA_PAPEL_ALVO[etapa] === "avaliador"
                        ? "Enviar para avaliação"
                        : "Enviar para desempate"}
                    {selecionados.size > 0 && ` (${selecionados.size})`}
                  </button>
                )
              )}

              {/* ⚠ EXCEÇÃO TEMPORÁRIA (2026-11-06) — ver comentário em
                * src/app/api/revisao-externa/convidar/route.ts. */}
              {etapa === "revisao" && (
                <button
                  type="button"
                  disabled={selecionados.size === 0}
                  onClick={() => setModalReavaliacaoExterna(true)}
                  title="Pra professores convidados que não têm conta no SIGMA — manda um link público, sem login, pra avaliar só os trabalhos marcados"
                  className="flex flex-none items-center justify-center gap-1.5 rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                >
                  <Send className="h-4 w-4 flex-none" strokeWidth={1.75} />
                  Enviar para reavaliação externa
                  {selecionados.size > 0 && ` (${selecionados.size})`}
                </button>
              )}

              <button
                  type="button"
                  onClick={imprimirCertificados}
                  disabled={eventoId === "todos" || gerandoImpressao}
                  title={
                    eventoId === "todos"
                      ? "Escolha o evento no filtro para imprimir os certificados"
                      : "PDF com os certificados de apresentação (sem o fundo) para imprimir no papel timbrado — só os marcados, se houver"
                  }
                  className="flex flex-none items-center justify-center gap-1.5 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                >
                  {gerandoImpressao ? (
                    <Loader2 className="h-4 w-4 flex-none animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Printer className="h-4 w-4 flex-none" strokeWidth={1.75} />
                  )}
                  Imprimir certificados (papel timbrado)
                  {selecionados.size > 0 && ` (${selecionados.size})`}
              </button>
              {erroImpressao && (
                <span className="text-xs font-medium text-rose-700">{erroImpressao}</span>
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
                    {/* Revisão também mostra a nota do avaliador (2026-11-06, pedido
                      * explícito do usuário — a comissão precisa ver se o
                      * professor já tinha dado nota antes de dar a dela). */}
                    {(etapa === "resultado" || etapa === "revisao") && (
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
                          title="Nota do desempate — só existe pra quem empatou e precisou dela. Ordena junto com a nota av, pela soma das duas."
                        >
                          <button
                            type="button"
                            onClick={alternarOrdenacaoNota}
                            className="mx-auto flex items-center gap-1 uppercase tracking-[-0.01em] text-fatec-muted transition-colors hover:text-fatec-navy-900"
                          >
                            Nota des (/25)
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
                    <th className="px-3 py-2 font-semibold" title="Mais recentes primeiro">
                      Enviado em ↓
                    </th>
                    <th className="px-3 py-2 font-semibold">Última edição</th>
                    <th className="px-3 py-2 font-semibold">Situação</th>
                    {(etapa === "resultado_final" || etapa === "revisao") && (
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
                            disabled={!podeSelecionar(t)}
                            title={
                              !podeSelecionar(t)
                                ? "Esse trabalho já segue o fluxo com nota travada ou já foi reavaliado — só os trabalhos legados (sem nota) entram na reavaliação manual"
                                : undefined
                            }
                            className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500 disabled:cursor-not-allowed disabled:opacity-30"
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
                            {tituloExibicao(t.titulo)}
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
                      {etapa === "revisao" && (
                        <td className="px-3 py-2.5 text-center align-top">
                          {typeof t.notaAvaliador === "number" ? (
                            <span className="font-semibold text-fatec-navy-900">{t.notaAvaliador}</span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-fatec-navy-50 px-2 py-0.5 text-xs font-medium text-fatec-muted">
                              Sem nota
                            </span>
                          )}
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
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-medium text-fatec-navy-900">
                        {formatarDataHora(t.enviadoEm)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top text-fatec-muted">
                        {formatarData(t.atualizadoEm)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top">
                        <CelulaSituacaoPagamento
                          trabalho={t}
                          evento={eventos.find((e) => e.id === t.eventoId)}
                        />
                      </td>
                      {etapa === "revisao" && (
                        <td className="border-l border-fatec-line px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => abrirNotaComissao(t)}
                            className="whitespace-nowrap rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                          >
                            Dar nota
                          </button>
                        </td>
                      )}
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
                        colSpan={10}
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
        title={
          etapa === "revisao"
            ? "Enviar para reavaliação"
            : papelAlvoEnvio === "avaliador"
              ? "Enviar para avaliação"
              : "Enviar para desempate"
        }
      >
        <p className="text-sm text-fatec-ink">
          Enviar <span className="font-semibold">{selecionados.size}</span>{" "}
          trabalho(s) selecionado(s) para{" "}
          {etapa === "revisao" ? "reavaliação" : papelAlvoEnvio === "avaliador" ? "avaliação" : "desempate"}.
          {etapa === "revisao" && (
            <>
              {" "}
              A nota anterior (se houver) é descartada — quem receber vai avaliar do zero, como se
              fosse a primeira vez.
            </>
          )}
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
                onClick={() => {
                  setModoManual(true);
                  setDistribuicao([]);
                }}
                className="flex-none text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Escolher manualmente
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {distribuicao.map((linha) => (
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
                      onClick={() => ajustarQuantidade(linha.uid, -1)}
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
                      onClick={() => ajustarQuantidade(linha.uid, 1)}
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
          <div className="mt-5 flex flex-col gap-3">
            {areaComumSelecionada && pessoasDaArea.length === 0 && (
              <p className="text-sm text-fatec-muted">
                Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado
                para {areaComumSelecionada} neste evento — escolha manualmente abaixo.
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fatec-navy-900">
                Marque um ou mais {papelAlvoEnvio === "avaliador" ? "avaliadores" : "moderadores"}
              </span>
              <div className="flex flex-none items-center gap-3">
                {pessoasParaManual.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-fatec-sky-600">
                    <input
                      type="checkbox"
                      checked={todosManualMarcados}
                      onChange={alternarTodosManual}
                      className="h-3.5 w-3.5 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-sky-600"
                    />
                    Selecionar todos
                  </label>
                )}
                {pessoasDaArea.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setModoManual(false);
                      setDistribuicao(
                        distribuicaoPadrao(
                          pessoasDaArea.map((a) => ({ uid: a.uid, nome: a.nome })),
                          selecionados.size,
                        ),
                      );
                    }}
                    className="flex-none text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
                  >
                    Voltar pra divisão automática
                  </button>
                )}
              </div>
            </div>

            {/* Lista com checkbox (2026-10-28, pedido explícito do usuário —
                achado real: "hoje não conseguimos selecionar mais de um
                avaliador por vez sem área temática") — marcar adiciona na
                divisão (1 trabalho reservado pra começar), desmarcar tira;
                os números ajustam com os mesmos botões +/- da divisão
                automática. Scroll porque pode ter 25+ pessoas na lista. */}
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {pessoasParaManual.length === 0 && (
                <p className="text-sm text-fatec-muted">
                  Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado.
                </p>
              )}
              {pessoasParaManual.map((a) => {
                const linha = distribuicao.find((d) => d.uid === a.uid);
                const marcado = !!linha;
                return (
                  <div
                    key={a.uid}
                    className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarPessoaManual({ uid: a.uid, nome: a.nome })}
                        className="h-4 w-4 flex-none rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-sky-600"
                      />
                      <span className="truncate text-sm font-medium text-fatec-navy-900">
                        {a.nome}
                      </span>
                    </label>
                    {marcado && (
                      <div className="flex flex-none items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Diminuir para ${a.nome}`}
                          onClick={() => ajustarQuantidade(a.uid, -1)}
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
                          aria-label={`Aumentar para ${a.nome}`}
                          onClick={() => ajustarQuantidade(a.uid, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {distribuicao.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setDistribuicao(
                    distribuicaoPadrao(
                      distribuicao.map(({ uid, nome }) => ({ uid, nome })),
                      selecionados.size,
                    ),
                  )
                }
                className="self-start text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Dividir igualmente entre os marcados
              </button>
            )}

            <p
              className={`text-sm ${
                somaDistribuicao === selecionados.size
                  ? "text-fatec-muted"
                  : "font-medium text-fatec-orange-600"
              }`}
            >
              {somaDistribuicao} / {selecionados.size} trabalhos distribuídos
              {somaDistribuicao !== selecionados.size &&
                " — marque mais gente ou ajuste os números"}
            </p>
          </div>
        )}

        <AvisoConflitos
          conflitos={planoDistribuicao.conflitos}
          naoAtribuidos={planoDistribuicao.naoAtribuidos}
          automatico={!modoManual && pessoasDaArea.length > 0}
        />

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
            onClick={confirmarEnvioDistribuido}
            disabled={somaDistribuicao !== selecionados.size}
            className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            Enviar
          </button>
        </div>
      </Modal>

      {/* ⚠ EXCEÇÃO TEMPORÁRIA (2026-11-06) — ver comentário em
        * src/app/api/revisao-externa/convidar/route.ts, remover junto com
        * o resto da feature depois que os legados da X MAC forem
        * reavaliados. */}
      <Modal
        open={modalReavaliacaoExterna}
        onClose={() => setModalReavaliacaoExterna(false)}
        title="Enviar para reavaliação externa"
      >
        <p className="text-sm text-fatec-ink">
          Enviar <span className="font-semibold">{selecionados.size}</span> trabalho(s)
          selecionado(s) pra um professor sem conta no SIGMA. Ele recebe um e-mail com um link
          público (sem login) pra avaliar só esses trabalhos.
        </p>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">E-mail do professor</span>
          <input
            type="email"
            value={emailExterno}
            onChange={(e) => setEmailExterno(e.target.value)}
            placeholder="nome@exemplo.com"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Nome (opcional)</span>
          <input
            value={nomeExterno}
            onChange={(e) => setNomeExterno(e.target.value)}
            placeholder="Pra personalizar o e-mail — ele confirma o próprio nome na primeira vez que abrir o link"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
          />
        </label>
        {erroExterno && <p className="mt-3 text-sm text-rose-600">{erroExterno}</p>}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModalReavaliacaoExterna(false)}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviarReavaliacaoExterna}
            disabled={!emailExterno.trim() || enviandoExterno}
            className="rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {enviandoExterno ? "Enviando..." : "Enviar convite"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!notaComissao}
        onClose={() => setNotaComissao(null)}
        title="Nota da comissão organizadora"
      >
        {notaComissao && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-medium text-fatec-navy-900">{tituloExibicao(notaComissao.titulo)}</p>
              <p className="text-sm text-fatec-muted">
                {notaComissao.areaTematica} · Avaliador: {notaComissao.avaliadorNome ?? "—"}
              </p>
            </div>
            {notaComissao.comentarioRevisao && (
              <div className="rounded-xl border border-fatec-orange-200 bg-fatec-orange-50 px-4 py-3">
                <p className="text-xs font-semibold text-fatec-orange-700">O que o avaliador tinha pedido</p>
                <p className="mt-1 whitespace-pre-line text-sm text-fatec-ink">{notaComissao.comentarioRevisao}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-fatec-muted">Resumo</p>
              <p className="mt-1 max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border border-fatec-line px-4 py-3 text-sm text-fatec-ink">
                {notaComissao.resumo}
              </p>
            </div>
            <div className="flex flex-col gap-4 border-t border-fatec-line pt-5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Critérios (1 a 5 cada — a nota final é a soma)
                {typeof notaComissao.notaAvaliador === "number" && (
                  <span className="font-normal text-fatec-muted">
                    {" "}— já vem marcada a nota do avaliador ({notaComissao.notaAvaliador}/25)
                  </span>
                )}
              </span>
              {CRITERIOS_AVALIACAO.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 sm:max-w-sm">
                    <p className="text-sm font-medium text-fatec-navy-900">{c.label}</p>
                    <p className="text-xs text-fatec-muted">{c.descricao}</p>
                  </div>
                  <div className="flex flex-none gap-2">
                    {NOTAS_AVALIACAO.map((n) => (
                      <button
                        key={n.valor}
                        type="button"
                        onClick={() => setNotasComissao((prev) => ({ ...prev, [c.key]: n.valor }))}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                          notasComissao[c.key] === n.valor
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
                <span className="font-semibold text-fatec-navy-900">
                  {CRITERIOS_AVALIACAO.reduce((acc, c) => acc + (notasComissao[c.key] ?? 0), 0)}
                </span>{" "}
                / {CRITERIOS_AVALIACAO.length * 5}
              </p>
            </div>
            <p className="text-xs text-fatec-muted">
              Ao salvar, o trabalho vai para a aba Resultado e concorre normalmente.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={salvarNotaComissao}
                disabled={
                  salvandoNotaComissao || !CRITERIOS_AVALIACAO.every((c) => notasComissao[c.key])
                }
                className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
              >
                {salvandoNotaComissao ? "Salvando..." : "Salvar nota"}
              </button>
              <button
                type="button"
                onClick={() => setNotaComissao(null)}
                className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
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
          modalidadesPermitidas={eventos.find((e) => e.id === trabalhoEditando.eventoId)?.modalidadesApresentacao}
          resumoAcademico
          meuUid={user?.uid}
          autorPrincipal={{ nome: trabalhoEditando.alunoNome, souEu: false }}
          modoEdicao
          valoresIniciais={{
            titulo: trabalhoEditando.titulo,
            resumo: trabalhoEditando.resumo,
            palavrasChave: trabalhoEditando.palavrasChave,
            areaTematica: trabalhoEditando.areaTematica,
            modalidadeApresentacao: trabalhoEditando.modalidadeApresentacao,
            nomeOrientador: trabalhoEditando.nomeOrientador,
            nomesCoorientadores: trabalhoEditando.nomesCoorientadores,
            participantes: (trabalhoEditando.participantesUids ?? []).map((uid, i) => ({
              uid,
              nome: trabalhoEditando.participantesNomes?.[i] ?? uid,
            })),
          }}
          onClose={() => setTrabalhoEditando(null)}
          onSubmit={(dados) => salvarEdicaoAdmin(trabalhoEditando, dados)}
        />
      )}

      <Modal
        open={!!pendentesLiberacao}
        onClose={() => setPendentesLiberacao(null)}
        title="Liberar trabalhos para moderadores"
      >
        {pendentesLiberacao && (
          <>
            {pendentesLiberacao.length === 0 ? (
              <p className="text-sm text-fatec-ink">
                Todos os trabalhos empatados foram liberados pros moderadores
                das salas onde já estão. E-mail enviado pra cada um.
              </p>
            ) : (
              <>
                <p className="text-sm text-fatec-ink">
                  {pendentesLiberacao.length} trabalho(s) não deu pra resolver
                  sozinho — precisam de decisão manual (use &quot;Enviar para
                  desempate&quot; só pra esses).
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {pendentesLiberacao.map(({ trabalho, motivo }) => (
                    <li
                      key={trabalho.id}
                      className="rounded-xl border border-fatec-orange-200 bg-fatec-orange-50 px-4 py-2.5 text-sm"
                    >
                      <p className="font-medium text-fatec-navy-900">
                        {tituloExibicao(trabalho.titulo)}
                      </p>
                      <p className="mt-0.5 text-fatec-orange-700">{motivo}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setPendentesLiberacao(null)}
                className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                Fechar
              </button>
              {pendentesLiberacao.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelecionados(new Set(pendentesLiberacao!.map((p) => p.trabalho.id)));
                    setPendentesLiberacao(null);
                  }}
                  className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
                >
                  Selecionar pendentes
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}
