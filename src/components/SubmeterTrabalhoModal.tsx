"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useAlunosParaBusca, type AlunoParaBusca } from "@/lib/data/usuarios";
import { useInscritosPagosUids } from "@/lib/data/inscricoes";

const RESUMO_MAX = 2000;

export type DadosSubmissao = {
  titulo: string;
  areaTematica: string;
  resumo: string;
  nomeOrientador: string;
  participantesUids: string[];
  participantesNomes: string[];
};

export function SubmeterTrabalhoModal({
  open,
  eventoId,
  temTaxa,
  eventoNome,
  areasDisponiveis,
  meuUid,
  valoresIniciais,
  onClose,
  onSubmit,
}: {
  open: boolean;
  // Taxa de inscrição (2026-08-26): usado pra restringir a busca de colega
  // aos que já pagaram a Etapa 1 do evento — só se aplica quando temTaxa.
  eventoId: string;
  temTaxa?: boolean;
  eventoNome: string;
  areasDisponiveis: string[];
  meuUid: string | undefined;
  // Pré-preenche título/resumo — usado ao inscrever num evento um trabalho já
  // aprovado pelo orientador numa turma do Projeto Integrador (2026-08-25).
  valoresIniciais?: { titulo?: string; resumo?: string };
  onClose: () => void;
  onSubmit: (dados: DadosSubmissao) => void;
}) {
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [nomeOrientador, setNomeOrientador] = useState("");
  const [areaTematica, setAreaTematica] = useState("");
  const [resumo, setResumo] = useState(valoresIniciais?.resumo ?? "");
  const [buscaColega, setBuscaColega] = useState("");
  const [participantes, setParticipantes] = useState<AlunoParaBusca[]>([]);

  const inscritosPagos = useInscritosPagosUids(temTaxa ? eventoId : undefined);
  const alunos = useAlunosParaBusca(meuUid, {
    restringirA: temTaxa ? inscritosPagos : undefined,
  });

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

  const valido = titulo.trim() && areaTematica && nomeOrientador.trim();

  function adicionarColega(aluno: AlunoParaBusca) {
    setParticipantes((prev) => [...prev, aluno]);
    setBuscaColega("");
  }

  function removerColega(uid: string) {
    setParticipantes((prev) => prev.filter((p) => p.uid !== uid));
  }

  function limpar() {
    setTitulo(valoresIniciais?.titulo ?? "");
    setNomeOrientador("");
    setAreaTematica("");
    setResumo(valoresIniciais?.resumo ?? "");
    setBuscaColega("");
    setParticipantes([]);
  }

  function enviar() {
    if (!valido) return;
    onSubmit({
      titulo: titulo.trim(),
      areaTematica,
      resumo: resumo.trim(),
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
    <Modal open={open} onClose={fechar} title={`Inscrever trabalho — ${eventoNome}`}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Título do trabalho <span className="text-fatec-orange-600">*</span>
          </span>
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Otimização de rotas com algoritmos genéticos"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Área temática <span className="text-fatec-orange-600">*</span>
          </span>
          <select
            required
            value={areaTematica}
            onChange={(e) => setAreaTematica(e.target.value)}
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
          >
            <option value="" disabled>
              Selecione a área temática
            </option>
            {areasDisponiveis.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-fatec-navy-900">
              Resumo
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
          <textarea
            rows={5}
            maxLength={RESUMO_MAX}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="Descreva brevemente o trabalho (até 2000 caracteres)"
            className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Colegas (participantes)
          </span>

          {participantes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {participantes.map((p) => (
                <span
                  key={p.uid}
                  className="flex items-center gap-1.5 rounded-full bg-fatec-navy-50 py-1.5 pl-3.5 pr-2 text-sm font-medium text-fatec-navy-900"
                >
                  {p.nome}
                  <button
                    type="button"
                    aria-label={`Remover ${p.nome}`}
                    onClick={() => removerColega(p.uid)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-100 hover:text-fatec-navy-900"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={buscaColega}
              onChange={(e) => setBuscaColega(e.target.value)}
              placeholder="Buscar colega por nome ou e-mail"
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
          <span className="text-xs text-fatec-muted">
            Opcional. Colegas adicionados também acompanham o status deste
            trabalho, mas só quem submeteu pode corrigir e reenviar.
            {temTaxa &&
              " Só aparecem colegas que já pagaram a inscrição deste evento."}
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome do orientador <span className="text-fatec-orange-600">*</span>
          </span>
          <input
            type="text"
            required
            value={nomeOrientador}
            onChange={(e) => setNomeOrientador(e.target.value)}
            placeholder="Nome completo do professor orientador"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
          <span className="text-xs text-fatec-muted">
            Apenas identificação — a aprovação do orientador acontece fora do
            sistema.
          </span>
        </label>

        <button
          type="button"
          onClick={enviar}
          disabled={!valido}
          className="mt-2 w-fit rounded-xl bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
        >
          Enviar trabalho
        </button>
      </div>
    </Modal>
  );
}
