"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Check, Download, Italic, Mic, Presentation, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useAlunosParaBusca, type AlunoParaBusca } from "@/lib/data/usuarios";
import { useInscritosUids } from "@/lib/data/inscricoes";
import type { AreaTematicaComplexa } from "@/lib/data/eventos";
import { renderResumoFormatado } from "@/lib/textoFormatado";

const RESUMO_MAX = 2000;

const FASES_SUBMISSAO = [
  { numero: 1, label: "Trabalho" },
  { numero: 2, label: "Detalhes" },
  { numero: 3, label: "Autores" },
] as const;

const MODALIDADES = [
  {
    valor: "oral" as const,
    icone: Mic,
    titulo: "Apresentação Oral",
    descricao:
      "Modalidade expositiva em que o apresentador expõe oralmente o conteúdo do trabalho, com apoio de slides projetados.",
  },
  {
    valor: "roda_conversa" as const,
    icone: Presentation,
    titulo: "Roda de Conversa",
    descricao:
      "Modalidade em que o trabalho é apresentado em formato de banner (impresso).",
  },
];

/** Indicador de progresso do wizard de submissão (2026-09-01, mesmo padrão
 * do wizard "Criar evento") — puramente visual, navegação só pelos botões
 * Voltar/Próximo no rodapé. */
function PassosSubmissao({ fase }: { fase: 1 | 2 | 3 }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      {FASES_SUBMISSAO.map((f) => (
        <div key={f.numero} className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 w-full rounded-full transition-colors ${
                f.numero <= fase ? "bg-fatec-orange-500" : "bg-fatec-navy-100"
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                f.numero === fase
                  ? "text-fatec-navy-900"
                  : f.numero < fase
                    ? "text-fatec-muted"
                    : "text-fatec-muted/60"
              }`}
            >
              {f.numero < fase ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  {f.label}
                </span>
              ) : (
                `${f.numero}. ${f.label}`
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export type DadosSubmissao = {
  titulo: string;
  areaTematica: string;
  // Ausente = evento sem etapa de apresentação (ver modalidadesPermitidas
  // abaixo) — trabalho fica sem modalidade, não entra em Ensalamento.
  modalidadeApresentacao?: "oral" | "roda_conversa";
  resumo: string;
  // Só preenchido quando `resumoAcademico` (2026-10-09) — Projeto
  // Integrador reaproveita este mesmo componente/tipo, mas nunca pede
  // palavras-chave (não é um resumo em formato acadêmico ABNT).
  palavrasChave?: string;
  nomeOrientador: string;
  participantesUids: string[];
  participantesNomes: string[];
};

/** Campo de resumo com negrito/itálico + pré-visualização (2026-10-09,
 * pedido explícito do usuário — "sinto uma falta de formatação... procure
 * exemplos"). Padrão "Escrever/Pré-visualizar" (GitHub, editores de
 * markdown) em vez de contentEditable de verdade — mais simples, mais
 * seguro (nunca guarda/renderiza HTML, só a sintaxe leve `**`/`*`
 * interpretada por renderResumoFormatado) e não precisa de biblioteca
 * nenhuma. Os botões envolvem a SELEÇÃO atual do textarea com o marcador
 * (ou a palavra "texto", sem nada selecionado) e devolvem o foco/seleção
 * pro trecho recém-marcado, padrão de qualquer editor "wrap selection". */
function CampoResumoFormatado({
  valor,
  onChange,
  disabled,
}: {
  valor: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}) {
  const [modo, setModo] = useState<"escrever" | "visualizar">("escrever");
  const refTextarea = useRef<HTMLTextAreaElement>(null);

  function aplicarEstilo(marcador: string) {
    const el = refTextarea.current;
    if (!el) return;
    const inicio = el.selectionStart;
    const fim = el.selectionEnd;
    const selecionado = valor.slice(inicio, fim) || "texto";
    onChange(valor.slice(0, inicio) + marcador + selecionado + marcador + valor.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      const novoInicio = inicio + marcador.length;
      el.setSelectionRange(novoInicio, novoInicio + selecionado.length);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-fatec-line bg-white p-0.5">
          <button
            type="button"
            disabled={disabled || modo !== "escrever"}
            onClick={() => aplicarEstilo("**")}
            title="Negrito"
            aria-label="Negrito"
            className="flex h-7 w-7 items-center justify-center rounded-md text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
          >
            <Bold className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            disabled={disabled || modo !== "escrever"}
            onClick={() => aplicarEstilo("*")}
            title="Itálico"
            aria-label="Itálico"
            className="flex h-7 w-7 items-center justify-center rounded-md text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted disabled:hover:bg-transparent"
          >
            <Italic className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-fatec-navy-50 p-0.5 text-xs font-semibold">
          {(
            [
              { valor: "escrever" as const, label: "Escrever" },
              { valor: "visualizar" as const, label: "Pré-visualizar" },
            ]
          ).map((m) => (
            <button
              key={m.valor}
              type="button"
              onClick={() => setModo(m.valor)}
              className={`rounded px-2.5 py-1 transition-colors ${
                modo === m.valor
                  ? "bg-white text-fatec-navy-900 shadow-sm"
                  : "text-fatec-muted hover:text-fatec-navy-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {modo === "escrever" ? (
        <textarea
          ref={refTextarea}
          rows={6}
          maxLength={RESUMO_MAX}
          disabled={disabled}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            "Ex.: Este estudo analisa... O objetivo é... Trata-se de uma " +
            "pesquisa qualitativa/quantitativa, realizada a partir de... " +
            "Os resultados indicam que... Conclui-se que..."
          }
          className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
        />
      ) : (
        <div className="min-h-[9.5rem] rounded-xl border border-fatec-line bg-fatec-navy-50/40 px-4 py-2.5 text-sm leading-relaxed text-fatec-ink">
          {valor.trim() ? (
            renderResumoFormatado(valor)
          ) : (
            <span className="text-fatec-muted">Nada pra pré-visualizar ainda.</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Dado um valor de área temática já "achatado" (ex.: "Projetos
 * Integradores – Ciências da Saúde"), separa de volta em (grupo, sub-área)
 * quando ele bate com uma área complexa — usado só pra pré-preencher o
 * formulário no modo edição, onde o trabalho já tem esse valor salvo. */
function separarAreaInicial(
  areaTematica: string | undefined,
  areasComplexas: AreaTematicaComplexa[],
): { areaNivel1: string; subArea: string } {
  if (!areaTematica) return { areaNivel1: "", subArea: "" };
  for (const g of areasComplexas) {
    const prefixo = `${g.nomeGrupo} – `;
    if (areaTematica.startsWith(prefixo)) {
      return { areaNivel1: g.nomeGrupo, subArea: areaTematica.slice(prefixo.length) };
    }
  }
  return { areaNivel1: areaTematica, subArea: "" };
}

export function SubmeterTrabalhoModal({
  open,
  eventoId,
  temTaxa,
  eventoNome,
  areasDisponiveis,
  areasComplexas = [],
  modalidadesPermitidas = ["oral", "roda_conversa"],
  resumoAcademico = false,
  meuUid,
  valoresIniciais,
  modoEdicao = false,
  somenteLeitura = false,
  comentarioRevisao,
  onClose,
  onSubmit,
}: {
  open: boolean;
  // Taxa de inscrição (2026-08-26): usado pra restringir a busca de colega
  // a quem já demonstrou interesse no evento (não precisa ter pago — ver
  // 2026-08-31) — só se aplica quando temTaxa.
  eventoId: string;
  temTaxa?: boolean;
  eventoNome: string;
  // Lista achatada (Evento.areasTematicas) — inclui as strings já geradas
  // pelas áreas complexas, filtradas aqui pra não duplicar com o nome do
  // grupo (ver areasSimples abaixo).
  areasDisponiveis: string[];
  // Áreas com sub-área dentro (2026-09-01, ex.: "Projetos Integradores") —
  // selecionar o grupo abre um segundo campo com as sub-áreas.
  areasComplexas?: AreaTematicaComplexa[];
  // Modalidades que ESSE evento aceita (Evento.modalidadesApresentacao,
  // 2026-09-17). Ausente = eventos antigos, sem essa configuração —
  // preserva o comportamento de antes (as duas, escolha livre). Vazio =
  // evento sem etapa de apresentação nenhuma (esconde o bloco inteiro,
  // trabalho fica sem modalidadeApresentacao). 1 item = auto-selecionado,
  // sem pergunta pro aluno.
  modalidadesPermitidas?: ("oral" | "roda_conversa")[];
  // Evento completo/MAC (2026-10-09, pedido explícito do usuário) vs.
  // Projeto Integrador, que reaproveita este mesmo modal/tipo pra "resumo"
  // só que num sentido mais solto — ausente/false preserva o campo Resumo
  // de sempre (textarea simples, sem palavras-chave, sem mínimo de
  // caracteres). true liga: palavras-chave (campo novo), negrito/itálico +
  // pré-visualização (CampoResumoFormatado), texto de ajuda com a
  // estrutura esperada (objetivo/metodologia/resultados/conclusão), e
  // resumo/palavras-chave passam a ser obrigatórios (sem mínimo de
  // caracteres — pedido explícito do usuário, 2026-10-09).
  resumoAcademico?: boolean;
  meuUid: string | undefined;
  // Pré-preenche o formulário — usado tanto ao inscrever num evento um
  // trabalho já aprovado pelo orientador numa turma do Projeto Integrador
  // (2026-08-25, só titulo/resumo) quanto no modo edição (2026-09-04, todos
  // os campos, vindos do trabalho já submetido).
  valoresIniciais?: {
    titulo?: string;
    resumo?: string;
    palavrasChave?: string;
    areaTematica?: string;
    modalidadeApresentacao?: "oral" | "roda_conversa";
    nomeOrientador?: string;
    participantes?: { uid: string; nome: string }[];
  };
  // Edição de um trabalho já submetido (2026-09-04, trava de prazo — ver
  // src/app/aluno/trabalhos/page.tsx) — só muda o título do modal e o texto
  // do botão final; onSubmit continua devolvendo o mesmo formato, quem
  // decide se isso vira um addDoc ou updateDoc é o componente pai.
  modoEdicao?: boolean;
  // Colega/autor convidado abrindo o trabalho de outra pessoa (2026-09-09) —
  // vê tudo (inclusive o comentário de revisão), mas não mexe em nada; só
  // quem submeteu o trabalho (dono) pode editar. Desabilita todo campo e
  // esconde o botão final — navegação entre fases continua funcionando,
  // é só olhar.
  somenteLeitura?: boolean;
  // Mostrado no topo (fase 1) quando o trabalho está em "revisao" — o motivo
  // que o avaliador deu pra pedir o ajuste, mesmo aviso que existia no
  // CorrigirTrabalhoModal (substituído por este componente em 2026-09-04).
  comentarioRevisao?: string | null;
  onClose: () => void;
  onSubmit: (dados: DadosSubmissao) => void;
}) {
  const areaInicial = separarAreaInicial(valoresIniciais?.areaTematica, areasComplexas);

  // Modalidades que esse evento aceita, já filtradas — 0 = sem etapa de
  // apresentação (esconde o bloco), 1 = auto-seleciona (esconde o bloco
  // também, não tem o que escolher), 2 = escolha livre (comportamento
  // original, bloco aparece normal).
  const modalidadesFiltradas = MODALIDADES.filter((m) => modalidadesPermitidas.includes(m.valor));
  const modalidadeInicial = (): "oral" | "roda_conversa" | "" =>
    valoresIniciais?.modalidadeApresentacao ??
    (modalidadesFiltradas.length === 1 ? modalidadesFiltradas[0].valor : "");

  const [fase, setFase] = useState<1 | 2 | 3>(1);
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [nomeOrientador, setNomeOrientador] = useState(valoresIniciais?.nomeOrientador ?? "");
  const [areaNivel1, setAreaNivel1] = useState(areaInicial.areaNivel1);
  const [subArea, setSubArea] = useState(areaInicial.subArea);
  const [modalidadeApresentacao, setModalidadeApresentacao] = useState<
    "oral" | "roda_conversa" | ""
  >(modalidadeInicial());
  const [resumo, setResumo] = useState(valoresIniciais?.resumo ?? "");
  const [palavrasChave, setPalavrasChave] = useState(valoresIniciais?.palavrasChave ?? "");
  const [buscaColega, setBuscaColega] = useState("");
  const [participantes, setParticipantes] = useState<AlunoParaBusca[]>(
    (valoresIniciais?.participantes ?? []).map((p) => ({ ...p, email: "" })),
  );

  const inscritosNoEvento = useInscritosUids(temTaxa ? eventoId : undefined);
  const alunos = useAlunosParaBusca(meuUid, {
    restringirA: temTaxa ? inscritosNoEvento : undefined,
  });

  // Áreas simples pra exibir no primeiro nível — tira as que já são strings
  // geradas por um grupo complexo (essas entram como o nome do grupo, não
  // repetidas uma a uma).
  const areasSimples = useMemo(
    () =>
      areasDisponiveis.filter(
        (a) => !areasComplexas.some((g) => a.startsWith(`${g.nomeGrupo} – `)),
      ),
    [areasDisponiveis, areasComplexas],
  );
  const grupoSelecionado = areasComplexas.find((g) => g.nomeGrupo === areaNivel1);

  function trocarArea(valor: string) {
    setAreaNivel1(valor);
    // Trocou de área — a sub-área antiga não faz mais sentido.
    setSubArea("");
  }

  const sugestoes = useMemo(() => {
    const termo = buscaColega.trim().toLowerCase();
    if (!termo) return [];
    const jaSelecionados = new Set(participantes.map((p) => p.uid));
    return alunos
      .filter(
        (a) =>
          !jaSelecionados.has(a.uid) &&
          (a.nome.toLowerCase().includes(termo) ||
            a.email.toLowerCase().includes(termo)),
      )
      .slice(0, 5);
  }, [alunos, buscaColega, participantes]);

  const areaTematicaFinal = grupoSelecionado
    ? subArea
      ? `${grupoSelecionado.nomeGrupo} – ${subArea}`
      : ""
    : areaNivel1;

  const fase1Valida =
    titulo.trim() &&
    areaTematicaFinal &&
    (modalidadesFiltradas.length === 0 || !!modalidadeApresentacao);
  const fase2Valida =
    nomeOrientador.trim() &&
    (!resumoAcademico || (palavrasChave.trim() && resumo.trim()));
  const valido = fase1Valida && fase2Valida;

  function adicionarColega(aluno: AlunoParaBusca) {
    setParticipantes((prev) => [...prev, aluno]);
    setBuscaColega("");
  }

  function removerColega(uid: string) {
    setParticipantes((prev) => prev.filter((p) => p.uid !== uid));
  }

  function limpar() {
    setFase(1);
    setTitulo(valoresIniciais?.titulo ?? "");
    setNomeOrientador(valoresIniciais?.nomeOrientador ?? "");
    setAreaNivel1(areaInicial.areaNivel1);
    setSubArea(areaInicial.subArea);
    setModalidadeApresentacao(modalidadeInicial());
    setResumo(valoresIniciais?.resumo ?? "");
    setPalavrasChave(valoresIniciais?.palavrasChave ?? "");
    setBuscaColega("");
    setParticipantes((valoresIniciais?.participantes ?? []).map((p) => ({ ...p, email: "" })));
  }

  function enviar() {
    if (!valido) return;
    onSubmit({
      titulo: titulo.trim(),
      areaTematica: areaTematicaFinal,
      ...(modalidadeApresentacao ? { modalidadeApresentacao } : {}),
      resumo: resumo.trim(),
      ...(resumoAcademico ? { palavrasChave: palavrasChave.trim() } : {}),
      nomeOrientador: nomeOrientador.trim(),
      participantesUids: participantes.map((p) => p.uid),
      participantesNomes: participantes.map((p) => p.nome),
    });
    limpar();
  }

  function fechar() {
    limpar();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={`${somenteLeitura ? "Ver trabalho" : modoEdicao ? "Editar trabalho" : "Inscrever trabalho"} — ${eventoNome}`}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <PassosSubmissao fase={fase} />

        {fase === 1 && comentarioRevisao && (
          <div className="rounded-xl bg-fatec-orange-50 px-4 py-3">
            <p className="text-sm font-medium text-fatec-orange-700">
              O que o avaliador pediu pra ajustar
            </p>
            <p className="mt-1 text-sm text-fatec-ink">{comentarioRevisao}</p>
          </div>
        )}

        {fase === 1 && (
        <>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Título do trabalho <span className="text-fatec-orange-600">*</span>
          </span>
          <input
            type="text"
            required
            disabled={somenteLeitura}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Otimização de rotas com algoritmos genéticos"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Área temática <span className="text-fatec-orange-600">*</span>
          </span>
          <select
            required
            disabled={somenteLeitura}
            value={areaNivel1}
            onChange={(e) => trocarArea(e.target.value)}
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
          >
            <option value="" disabled>
              Selecione a área temática
            </option>
            {areasSimples.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
            {areasComplexas.map((g) => (
              <option key={g.id} value={g.nomeGrupo}>
                {g.nomeGrupo}
              </option>
            ))}
          </select>
        </label>

        {grupoSelecionado && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Sub-área de {grupoSelecionado.nomeGrupo}{" "}
              <span className="text-fatec-orange-600">*</span>
            </span>
            <select
              required
              disabled={somenteLeitura}
              value={subArea}
              onChange={(e) => setSubArea(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
            >
              <option value="" disabled>
                Selecione a sub-área
              </option>
              {grupoSelecionado.subAreas.map((s) => (
                <option key={s.nome} value={s.nome}>
                  {s.nome}
                  {s.descricao ? ` (${s.descricao})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {modalidadesFiltradas.length > 0 && (
        <div className="flex flex-col gap-2">
          {modalidadesFiltradas.length > 1 && (
          <>
          <span className="text-sm font-medium text-fatec-navy-900">
            Como o trabalho será apresentado{" "}
            <span className="text-fatec-orange-600">*</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modalidadesFiltradas.map((m) => {
              const Icone = m.icone;
              const selecionada = modalidadeApresentacao === m.valor;
              return (
                <button
                  key={m.valor}
                  type="button"
                  disabled={somenteLeitura}
                  onClick={() => setModalidadeApresentacao(m.valor)}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                    selecionada
                      ? "border-fatec-orange-500 bg-fatec-orange-50"
                      : "border-fatec-line hover:bg-fatec-navy-50 disabled:hover:bg-transparent"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-sm font-semibold ${
                      selecionada ? "text-fatec-orange-700" : "text-fatec-navy-900"
                    }`}
                  >
                    <Icone className="h-4 w-4 flex-none" strokeWidth={1.75} />
                    {m.titulo}
                  </span>
                  <span className="text-xs leading-relaxed text-fatec-muted">
                    {m.descricao}
                  </span>
                </button>
              );
            })}
          </div>
          </>
          )}
          {modalidadeApresentacao === "roda_conversa" && (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-fatec-orange-500 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white/20 text-white">
                  <Presentation className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Não esqueça o modelo do banner!
                  </p>
                  <p className="text-xs text-white/85">
                    Baixe agora e use como base pro seu banner impresso.
                  </p>
                </div>
              </div>
              <a
                href="/materiais/modelo-banner-mac.pdf"
                target="_blank"
                rel="noreferrer"
                className="flex flex-none items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-fatec-orange-600 transition-colors hover:bg-fatec-orange-50"
              >
                <Download className="h-4 w-4" strokeWidth={2} />
                Baixar modelo
              </a>
            </div>
          )}
        </div>
        )}
        </>
        )}

        {fase === 2 && (
        <>
        {resumoAcademico && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Palavras-chave <span className="text-fatec-orange-600">*</span>
            </span>
            <input
              type="text"
              disabled={somenteLeitura}
              value={palavrasChave}
              onChange={(e) => setPalavrasChave(e.target.value)}
              placeholder="Ex.: Cyberbullying, saúde mental, comportamento virtual"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
            />
            <span className="text-xs text-fatec-muted">
              3 a 5 termos que resumem o trabalho, separados por vírgula.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-fatec-navy-900">
              Resumo {resumoAcademico && <span className="text-fatec-orange-600">*</span>}
            </span>
            <span
              className={`text-xs ${
                resumo.length >= RESUMO_MAX
                  ? "font-medium text-fatec-orange-600"
                  : "text-fatec-muted"
              }`}
            >
              {resumo.length}/{RESUMO_MAX}
            </span>
          </div>
          {resumoAcademico && (
            <p className="text-xs text-fatec-muted">
              Um resumo acadêmico de verdade, não um título estendido —
              inclua do que trata o trabalho, o objetivo, a metodologia
              usada, os principais resultados e a conclusão.
            </p>
          )}
          {resumoAcademico ? (
            <CampoResumoFormatado
              valor={resumo}
              onChange={setResumo}
              disabled={somenteLeitura}
            />
          ) : (
            <textarea
              rows={6}
              maxLength={RESUMO_MAX}
              disabled={somenteLeitura}
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Descreva brevemente o trabalho (até 2000 caracteres)"
              className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
            />
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome do orientador <span className="text-fatec-orange-600">*</span>
          </span>
          <input
            type="text"
            required
            disabled={somenteLeitura}
            value={nomeOrientador}
            onChange={(e) => setNomeOrientador(e.target.value)}
            placeholder="Nome completo do professor orientador"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
          />
          <span className="text-xs text-fatec-muted">
            Apenas identificação — a aprovação do orientador acontece fora do
            sistema.
          </span>
        </label>
        </>
        )}

        {fase === 3 && (
        <>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Autores (participantes)
          </span>

          {participantes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {participantes.map((p) => (
                <span
                  key={p.uid}
                  className="flex items-center gap-1.5 rounded-full bg-fatec-navy-50 py-1.5 pl-3.5 pr-2 text-sm font-medium text-fatec-navy-900"
                >
                  {p.nome}
                  {!somenteLeitura && (
                    <button
                      type="button"
                      aria-label={`Remover ${p.nome}`}
                      onClick={() => removerColega(p.uid)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-100 hover:text-fatec-navy-900"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Busca de autor some inteira em modo leitura (2026-09-09) —
              colega convidado só acompanha, não adiciona/remove ninguém. */}
          {!somenteLeitura && (
          <div className="relative">
            <input
              type="text"
              value={buscaColega}
              onChange={(e) => setBuscaColega(e.target.value)}
              placeholder="Buscar autor por nome ou e-mail"
              className="w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            {sugestoes.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-fatec-line bg-white shadow-lg">
                {sugestoes.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    onClick={() => adicionarColega(a)}
                    className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50"
                  >
                    <span className="text-sm font-medium text-fatec-navy-900">
                      {a.nome}
                    </span>
                    <span className="text-xs text-fatec-muted">{a.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
          <span className="text-xs text-fatec-muted">
            Opcional. Autores adicionados também acompanham o status deste
            trabalho, mas só quem submeteu pode corrigir e reenviar.
            {temTaxa &&
              " Só aparecem autores que já demonstraram interesse neste evento."}
          </span>
        </div>
        </>
        )}

        <div className="mt-1 flex items-center justify-between border-t border-fatec-line pt-5">
          {fase > 1 ? (
            <button
              type="button"
              onClick={() => setFase((f) => (f - 1) as 1 | 2 | 3)}
              className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
            >
              Voltar
            </button>
          ) : (
            <span />
          )}

          {fase < 3 ? (
            <button
              type="button"
              onClick={() => setFase((f) => (f + 1) as 1 | 2 | 3)}
              disabled={
                (fase === 1 && !fase1Valida) || (fase === 2 && !fase2Valida)
              }
              className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              Próximo
            </button>
          ) : somenteLeitura ? (
            // Sem botão de salvar em modo leitura (2026-09-09) — colega só
            // acompanha, "Fechar" já existe no X do cabeçalho do Modal.
            <span />
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={!valido}
              className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              {modoEdicao ? "Salvar alterações" : "Enviar trabalho"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
