"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Check, Download, GraduationCap } from "lucide-react";
import type { User } from "firebase/auth";
import { Modal } from "@/components/Modal";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos, type Trabalho } from "@/lib/data/trabalhos";
import { baixarCertificadoBancaTCC } from "@/lib/baixarCertificado";
import {
  diasDoIntervalo,
  salvarMinhaDisponibilidade,
  salvarNotaBanca,
  useMinhaDisponibilidade,
  type NotaBancaTCC,
} from "@/lib/data/bancas";
import { CRITERIOS_BANCA_TCC, escalaParaPeso } from "@/lib/criteriosAvaliacao";

/** Banca de TCC (2026-11-16, pedido explícito do usuário) — duas coisas
 * nessa tela: (1) disponibilidade de dias (autoatendimento, sem precedente
 * de UI no app — não existe nenhum "calendário de disponibilidade" hoje),
 * aberta num modal a partir de um botão no cabeçalho (2026-11-17, pedido
 * explícito do usuário — "essa forma de selecionar a disponibilidade tá
 * muito feia... pode ser um ícone que a pessoa clica e abre um modal"); (2)
 * a lista de TCCs em que a pessoa é avaliador(a) ou orientador(a), em
 * cards no mesmo estilo de `/avaliador/eventos` ("como é na tela do
 * avaliador mesmo").
 *
 * Sem campo de "máximo de bancas" por dia (2026-11-17, removido por pedido
 * explícito do usuário — "quando ele seleciona os dias ele vai estar
 * disponível o período de trabalho na instituição", sem precisar dizer
 * quantas bancas topa fazer nesse dia). Marcar o dia já basta; quem
 * espalha a carga de forma justa é `montarBancaAutomatica`
 * (src/lib/data/bancas.ts), na geração. */
export default function BancaDisponibilidadePage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador", "orientador"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  const eventosTCC = useMemo(() => eventos.filter((e) => e.tipo === "tcc"), [eventos]);
  const [eventoId, setEventoId] = useState("");
  // Ajuste de estado durante a renderização (padrão já usado em
  // eventos/page.tsx) em vez de useEffect — auto-seleciona o único/primeiro
  // evento de TCC assim que a lista chega, sem precisar sincronizar com
  // nada externo.
  if (!eventoId && eventosTCC.length > 0) {
    setEventoId(eventosTCC[0].id);
  }

  const evento = eventosTCC.find((e) => e.id === eventoId);
  const [modalDisponibilidadeAberto, setModalDisponibilidadeAberto] = useState(false);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/banca"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Banca de TCC
            </h1>
            <p className="text-sm text-fatec-muted">
              TCCs em que você é avaliador(a) ou orientador(a).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {eventosTCC.length > 1 && (
              <select
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 md:w-64"
              >
                {eventosTCC.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nome}
                  </option>
                ))}
              </select>
            )}
            {evento && (
              <button
                type="button"
                onClick={() => setModalDisponibilidadeAberto(true)}
                title="Definir disponibilidade"
                className="inline-flex flex-none items-center gap-1.5 rounded-xl border border-fatec-line bg-white px-3.5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                <CalendarCheck className="h-4 w-4" strokeWidth={1.75} />
                Disponibilidade
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {eventosTCC.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Você ainda não foi vinculado a nenhum evento de TCC.
            </p>
          ) : (
            <MinhasBancasView
              trabalhos={trabalhos.filter((t) => t.eventoId === evento?.id)}
              user={user}
              meuNome={perfil.nome}
              horarioInicioBanca={evento?.horarioInicioBanca}
              duracaoBancaMinutos={evento?.duracaoBancaMinutos}
            />
          )}
        </div>
      </div>

      {evento && (
        <ModalDisponibilidade
          open={modalDisponibilidadeAberto}
          onClose={() => setModalDisponibilidadeAberto(false)}
          evento={evento}
          user={user}
          meuNome={perfil.nome}
        />
      )}
    </main>
  );
}

/** Modal de disponibilidade (2026-11-17) — extraído da tela principal:
 * marcar dia a dia num modal, não numa lista enorme ocupando a página
 * inteira. `dataRealizacao`/`dataRealizacaoFim` do evento definem a janela
 * de dias selecionáveis. */
function ModalDisponibilidade({
  open,
  onClose,
  evento,
  user,
  meuNome,
}: {
  open: boolean;
  onClose: () => void;
  evento: { id: string; dataRealizacao?: string; dataRealizacaoFim?: string };
  user: User | null | undefined;
  meuNome: string;
}) {
  const dias = useMemo(
    () => diasDoIntervalo(evento.dataRealizacao ?? "", evento.dataRealizacaoFim ?? ""),
    [evento.dataRealizacao, evento.dataRealizacaoFim],
  );
  const { disponibilidade } = useMinhaDisponibilidade(evento.id, user?.uid);
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Prefill a partir do que já foi salvo, uma vez só por evento (ajuste de
  // estado durante a renderização, mesmo padrão de eventos/page.tsx) —
  // dispara assim que o snapshot do Firestore chega com dado de verdade,
  // sem sobrescrever o que a pessoa já está editando depois disso.
  const [eventoIdCarregado, setEventoIdCarregado] = useState<string | null>(null);
  if (disponibilidade && evento.id !== eventoIdCarregado) {
    setEventoIdCarregado(evento.id);
    setDiasSelecionados(disponibilidade.dias);
  }

  function alternarDia(dia: string) {
    setSalvo(false);
    setDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
  }

  async function salvar() {
    if (!user) return;
    setSalvando(true);
    try {
      await salvarMinhaDisponibilidade({
        eventoId: evento.id,
        uid: user.uid,
        nome: meuNome,
        dias: diasSelecionados,
      });
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Disponibilidade de dias">
      {!evento.dataRealizacao ? (
        <p className="text-sm text-fatec-muted">
          A organização ainda não definiu a janela de dias das bancas desse
          evento.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fatec-muted">
            Marque os dias em que você está disponível — considere o seu
            período normal de trabalho na instituição nesse dia (o
            orientador também entra nessa conta: ele sempre faz parte da
            banca do próprio orientando).
          </p>

          <div className="flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line bg-white">
            {dias.map((dia) => {
              const marcado = diasSelecionados.includes(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => alternarDia(dia)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fatec-navy-50"
                  aria-pressed={marcado}
                >
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border transition-colors ${
                      marcado
                        ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                        : "border-fatec-line bg-white"
                    }`}
                  >
                    {marcado && <Check className="h-4 w-4" strokeWidth={2.5} />}
                  </span>
                  <span className="flex-1 text-sm font-medium text-fatec-navy-900">
                    {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "long",
                    })}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
            >
              <CalendarCheck className="h-4 w-4" strokeWidth={1.75} />
              {salvando ? "Salvando..." : "Salvar disponibilidade"}
            </button>
            {salvo && <span className="text-sm font-medium text-emerald-700">Salvo.</span>}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Lista de TCCs em que a pessoa logada é avaliador(a) ou orientador(a) —
 * cards no mesmo estilo de `/avaliador/eventos` (ícone + nome + dado
 * secundário num card arredondado, não mais uma lista com divisórias).
 * Cada card com o formulário da rubrica de 7 critérios (CRITERIOS_BANCA_TCC)
 * pra lançar a própria nota, sem mexer na dos outros 2 membros (ver
 * salvarNotaBanca). */
// Mesma lógica de /api/ensalamento/pdf-banca (route.ts), duplicada de
// propósito aqui (2026-11-27, pedido explícito do usuário — tag de sala e
// horário junto da de orientador/avaliador) — ali é servidor, aqui é
// client, não dá pra importar uma rota API como função.
function somarMinutos(horario: string, minutos: number): string {
  const [h, m] = horario.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function MinhasBancasView({
  trabalhos,
  user,
  meuNome,
  horarioInicioBanca,
  duracaoBancaMinutos,
}: {
  trabalhos: Trabalho[];
  user: User | null | undefined;
  meuNome: string;
  horarioInicioBanca?: string;
  duracaoBancaMinutos?: number;
}) {
  function rotuloHorario(horarioIndex: number): string {
    if (horarioInicioBanca && duracaoBancaMinutos) {
      const ini = somarMinutos(horarioInicioBanca, horarioIndex * duracaoBancaMinutos);
      const fim = somarMinutos(horarioInicioBanca, (horarioIndex + 1) * duracaoBancaMinutos);
      return `${ini}–${fim}`;
    }
    return `Horário ${horarioIndex + 1}`;
  }

  const uid = user?.uid;
  const minhasBancas = trabalhos.filter(
    (t) => t.orientadorUid === uid || t.bancaAvaliadores?.some((a) => a.uid === uid),
  );
  const [avaliandoId, setAvaliandoId] = useState<string | null>(null);
  const trabalhoAvaliando = minhasBancas.find((t) => t.id === avaliandoId);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);

  async function baixarCertificado(trabalhoId: string) {
    if (!user) return;
    setErroBaixar(null);
    setBaixandoId(trabalhoId);
    try {
      const resultado = await baixarCertificadoBancaTCC(user, trabalhoId);
      if (!resultado.ok) setErroBaixar(resultado.erro);
    } finally {
      setBaixandoId(null);
    }
  }

  if (minhasBancas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
        Nenhum TCC em que você é avaliador(a) ou orientador(a) ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {minhasBancas.map((t) => {
        const jaAvaliei = t.notasBanca?.some((n) => n.uid === uid);
        // Tag (2026-11-17, pedido explícito do usuário) — a mesma pessoa
        // pode ser orientador(a) num trabalho e avaliador(a) em outro, no
        // mesmo evento; deixa claro em qual papel entra em CADA banca.
        const souOrientadorDesta = t.orientadorUid === uid;
        return (
          <div key={t.id} className="rounded-2xl border border-fatec-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                  <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-fatec-navy-900">{t.alunoNome}</p>
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        souOrientadorDesta
                          ? "bg-fatec-navy-100 text-fatec-navy-800"
                          : "bg-fatec-sky-100 text-fatec-sky-700"
                      }`}
                    >
                      {souOrientadorDesta ? "Orientador(a)" : "Avaliador(a)"}
                    </span>
                    {/* Sala/horário em tags separadas (2026-11-27, pedido
                        explícito do usuário) — só aparecem quando a banca já
                        foi gerada com sala/horário definidos (ajuste manual
                        limpa os dois, ver moverBanca). */}
                    {t.bancaSala != null && (
                      <span className="flex-none rounded-full bg-fatec-navy-50 px-2 py-0.5 text-[11px] font-semibold text-fatec-navy-700">
                        Sala {t.bancaSala}
                      </span>
                    )}
                    {t.bancaHorarioIndex != null && (
                      <span className="flex-none rounded-full bg-fatec-navy-50 px-2 py-0.5 text-[11px] font-semibold text-fatec-navy-700">
                        {rotuloHorario(t.bancaHorarioIndex)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-fatec-muted">
                    {t.bancaData
                      ? new Date(`${t.bancaData}T00:00:00`).toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })
                      : "Banca ainda não agendada"}
                  </p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2">
                {t.status === "tcc_aprovado" && (
                  <button
                    type="button"
                    onClick={() => baixarCertificado(t.id)}
                    disabled={baixandoId === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {baixandoId === t.id ? "Gerando..." : "Certificado"}
                  </button>
                )}
                {!t.bancaData ? null : jaAvaliei ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Nota lançada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAvaliandoId(t.id)}
                    className="rounded-lg border border-fatec-line px-3 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    Dar nota
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {erroBaixar && <p className="text-sm text-rose-600">{erroBaixar}</p>}

      {/* Nota num modal (2026-11-17, pedido explícito do usuário — "a
          avaliação poderia ser igual do avaliador, abrir um modal, fica
          mais bonito") — antes expandia dentro do próprio card. */}
      {trabalhoAvaliando && uid && (
        <Modal
          open
          onClose={() => setAvaliandoId(null)}
          title={`Avaliar — ${trabalhoAvaliando.alunoNome}`}
        >
          <FormularioNotaBanca
            trabalho={trabalhoAvaliando}
            uid={uid}
            meuNome={meuNome}
            onEnviado={() => setAvaliandoId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioNotaBanca({
  trabalho,
  uid,
  meuNome,
  onEnviado,
}: {
  trabalho: Trabalho;
  uid: string;
  meuNome: string;
  onEnviado: () => void;
}) {
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const completo = CRITERIOS_BANCA_TCC.every((c) => notas[c.key] !== undefined);
  const soma = CRITERIOS_BANCA_TCC.reduce((acc, c) => acc + (notas[c.key] ?? 0), 0);

  async function enviar() {
    if (!completo) return;
    setEnviando(true);
    try {
      const minhaNota: NotaBancaTCC = {
        uid,
        nome: meuNome,
        papelNaBanca: trabalho.orientadorUid === uid ? "orientador" : "avaliador",
        notas,
        nota: soma,
      };
      await salvarNotaBanca({
        trabalhoId: trabalho.id,
        notasBancaAtuais: trabalho.notasBanca ?? [],
        minhaNota,
      });
      onEnviado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {CRITERIOS_BANCA_TCC.map((c) => (
        <div key={c.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-fatec-navy-900">{c.label}</p>
            <p className="text-xs text-fatec-muted">{c.descricao}</p>
          </div>
          <div className="flex flex-none gap-1">
            {escalaParaPeso(c.peso ?? 1).map((n) => (
              <button
                key={n.valor}
                type="button"
                onClick={() => setNotas((prev) => ({ ...prev, [c.key]: n.valor }))}
                className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors ${
                  notas[c.key] === n.valor
                    ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                    : "border-fatec-line bg-white text-fatec-navy-900 hover:bg-fatec-navy-100"
                }`}
              >
                {n.valor}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-fatec-line pt-3">
        <span className="text-sm text-fatec-muted">
          Nota: <span className="font-semibold text-fatec-navy-900">{soma.toFixed(1)}</span> / 10
        </span>
        <button
          type="button"
          onClick={enviar}
          disabled={!completo || enviando}
          className="rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
        >
          {enviando ? "Enviando..." : "Enviar nota"}
        </button>
      </div>
    </div>
  );
}
