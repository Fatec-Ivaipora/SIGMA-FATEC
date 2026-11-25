"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { OrientadorPicker, type OrientadorEscolhido } from "@/components/OrientadorPicker";
import { useAlunosParaBusca, type AlunoParaBusca } from "@/lib/data/usuarios";
import { caixaAltaNome } from "@/lib/textoNome";

// Minúsculo e sem acento — mesmo critério de busca de colega em
// SubmeterTrabalhoModal.tsx ("cassia" acha "Cássia").
function semAcento(texto: string): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type DadosSubmissaoTCC = {
  titulo: string;
  orientadorUid: string;
  orientadorNome: string;
  // Outro(s) autor(es) — TCC feito em dupla (2026-11-25, achado real do
  // usuário: "tem tcc feito em dupla, tínhamos esquecido"). Mesmo campo/
  // mecanismo de participantesUids/Nomes do MAC (convite pendente até
  // aceitar, ver responderConvite em src/lib/data/trabalhos.ts) — só o
  // rótulo na tela muda ("Outro(s) autor(es)", nunca "coautor", pedido
  // explícito do usuário).
  participantesUids: string[];
  participantesNomes: string[];
};

/** Inscrição de TCC (2026-11-16, pedido explícito do usuário) — bem mais
 * enxuta que `SubmeterTrabalhoModal` (MAC): só título + orientador (+ outro
 * autor, 2026-11-25), sem área temática, modalidade ou resumo. Modal
 * próprio em vez de reaproveitar o de MAC — quase nenhum campo daquele se
 * aplica aqui, e a diferença mais importante é estrutural: orientador vem
 * de `OrientadorPicker` (usuário real, com uid), não texto livre.
 *
 * Também serve pra EDITAR (2026-11-24, achado real do usuário — a tela
 * `/aluno/trabalhos` abria `SubmeterTrabalhoModal` até pra editar um TCC,
 * mostrando "Apresentação oral ou roda de conversa" à toa, campo que não
 * existe em evento TCC — ver comentário de `modalidadesApresentacao` em
 * src/lib/data/eventos.ts). `modoEdicao`/`valoresIniciais`/`somenteLeitura`
 * espelham os mesmos nomes de prop do modal de MAC, pro chamador poder
 * escolher entre os dois modais com o mínimo de diferença de uso. */
export function SubmeterTCCModal({
  open,
  eventoId,
  eventoNome,
  meuUid,
  autorPrincipal,
  modoEdicao = false,
  somenteLeitura = false,
  valoresIniciais,
  onClose,
  onSubmit,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  // Obrigatório só pra busca de outro autor (exclui a si mesmo da lista) —
  // ausente/undefined só desabilita a busca, não quebra o resto do modal.
  meuUid?: string;
  // Selo fixo do autor principal na etapa de autores (mesmo padrão de
  // SubmeterTrabalhoModal) — ausente = não mostra a seção de outro autor
  // (ex.: admin/organização olhando o trabalho de outra tela).
  autorPrincipal?: { nome: string; souEu: boolean };
  modoEdicao?: boolean;
  somenteLeitura?: boolean;
  valoresIniciais?: DadosSubmissaoTCC;
  onClose: () => void;
  onSubmit: (dados: DadosSubmissaoTCC) => Promise<string | void> | void;
}) {
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [orientador, setOrientador] = useState<OrientadorEscolhido | null>(
    valoresIniciais
      ? { uid: valoresIniciais.orientadorUid, nome: valoresIniciais.orientadorNome }
      : null,
  );
  const [participantes, setParticipantes] = useState<AlunoParaBusca[]>(
    (valoresIniciais?.participantesUids ?? []).map((uid, i) => ({
      uid,
      nome: valoresIniciais?.participantesNomes?.[i] ?? uid,
      email: "",
    })),
  );
  const [buscaColega, setBuscaColega] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alunos = useAlunosParaBusca(meuUid);
  const buscaTemSeparador = /[,;]/.test(buscaColega);
  const sugestoes = useMemo(() => {
    if (buscaTemSeparador) return [];
    const termos = semAcento(buscaColega).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return [];
    const jaSelecionados = new Set(participantes.map((p) => p.uid));
    return alunos
      .filter((a) => {
        if (jaSelecionados.has(a.uid)) return false;
        const alvo = `${semAcento(a.nome)} ${semAcento(a.email)}`;
        return termos.every((t) => alvo.includes(t));
      })
      .slice(0, 8);
  }, [alunos, buscaColega, buscaTemSeparador, participantes]);
  const buscaSemResultado =
    !buscaTemSeparador && buscaColega.trim().length >= 2 && sugestoes.length === 0;

  function adicionarColega(aluno: AlunoParaBusca) {
    setParticipantes((prev) => [...prev, aluno]);
    setBuscaColega("");
  }

  function removerColega(uid: string) {
    setParticipantes((prev) => prev.filter((p) => p.uid !== uid));
  }

  const podeEnviar = titulo.trim().length > 0 && !!orientador && !enviando;

  async function enviar() {
    if (!podeEnviar || !orientador) return;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await onSubmit({
        titulo: titulo.trim(),
        orientadorUid: orientador.uid,
        // Nome copiado de uma conta já existente, não digitado aqui — mas
        // passa por caixaAltaNome mesmo assim (2026-11-25, pedido explícito
        // do usuário: "temos que ter essa regra fixa em toda a aplicação"),
        // pra não depender de uma conta antiga ainda não corrigida.
        orientadorNome: caixaAltaNome(orientador.nome),
        participantesUids: participantes.map((p) => p.uid),
        participantesNomes: participantes.map((p) => caixaAltaNome(p.nome)),
      });
      if (resultado) {
        setErro(resultado);
        return;
      }
      if (!modoEdicao) {
        setTitulo("");
        setOrientador(null);
        setParticipantes([]);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        somenteLeitura
          ? `TCC — ${eventoNome}`
          : modoEdicao
            ? `Editar TCC — ${eventoNome}`
            : `Inscrever TCC — ${eventoNome}`
      }
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Título do TCC</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={somenteLeitura}
            placeholder="Título do Trabalho de Conclusão de Curso"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">Orientador(a)</span>
          <OrientadorPicker
            eventoId={eventoId}
            value={orientador}
            onChange={setOrientador}
            disabled={somenteLeitura}
          />
        </label>

        {autorPrincipal && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">Autores</span>
            {!somenteLeitura && (autorPrincipal.souEu ?? true) && (
              <p className="rounded-xl bg-fatec-sky-100 px-4 py-3 text-sm text-fatec-navy-900">
                <strong>Você já está incluído(a) como autor principal</strong> — não
                precisa se adicionar. Aqui você adiciona{" "}
                <strong>outro(s) autor(es)</strong> (TCC feito em dupla). Se fez
                sozinho(a), é só enviar.
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full border border-fatec-sky-600/40 bg-fatec-sky-100 py-1.5 pl-2.5 pr-3.5 text-sm font-medium text-fatec-navy-900">
                {autorPrincipal.nome
                  ? autorPrincipal.souEu
                    ? `${autorPrincipal.nome} (você)`
                    : autorPrincipal.nome
                  : "Você"}
                <span className="text-xs font-normal text-fatec-muted">
                  · autor principal · já incluído
                </span>
              </span>
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

            {!somenteLeitura && (
              <div className="relative">
                <input
                  type="text"
                  value={buscaColega}
                  onChange={(e) => setBuscaColega(e.target.value)}
                  placeholder="Adicionar outro autor: buscar colega por nome ou e-mail"
                  className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 ${
                    buscaTemSeparador ? "border-rose-300" : "border-fatec-line"
                  }`}
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
                        <span className="text-sm font-medium text-fatec-navy-900">{a.nome}</span>
                        <span className="text-xs text-fatec-muted">{a.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {buscaTemSeparador ? (
              <p className="text-xs text-rose-600">
                Busque e adicione um autor de cada vez — não dá pra colar
                vários nomes juntos separados por vírgula ou ponto e vírgula.
              </p>
            ) : buscaSemResultado ? (
              <p className="text-xs text-amber-600">
                Nenhum autor encontrado pra &quot;{buscaColega.trim()}&quot;. Para
                aparecer aqui, o colega precisa criar a conta no SIGMA antes.
              </p>
            ) : null}
            <span className="text-xs text-fatec-muted">
              Opcional — só para o(s) outro(s) autor(es) (quem envia já está
              incluído). Autor adicionado também acompanha o status deste TCC,
              mas só quem inscreveu pode editar.
            </span>
          </div>
        )}

        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        <div className="flex items-center justify-end gap-3 border-t border-fatec-line pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            {somenteLeitura ? "Fechar" : "Cancelar"}
          </button>
          {!somenteLeitura && (
            <button
              type="button"
              onClick={enviar}
              disabled={!podeEnviar}
              className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              {enviando ? "Enviando..." : modoEdicao ? "Salvar" : "Inscrever TCC"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
