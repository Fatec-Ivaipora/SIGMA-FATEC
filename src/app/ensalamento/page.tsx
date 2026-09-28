"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plus,
  QrCode,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { arrayRemove, arrayUnion, doc, Timestamp, updateDoc } from "firebase/firestore";
import QRCode from "qrcode";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos, type Trabalho, type TrabalhoStatus } from "@/lib/data/trabalhos";
import { useSalasCatalogo, criarSala, removerSala, type SalaEnsalamento } from "@/lib/data/salas";
import { useInscritosDoEvento } from "@/lib/data/inscricoes";
import {
  useSessoesDoEvento,
  montarGradeAutomatica,
  substituirGradeDoEvento,
  moverTrabalho,
  type GrupoParaGrade,
} from "@/lib/data/sessoes";

// Universo do ensalamento (2026-09-17, confirmado com o usuário): todo
// trabalho que já saiu de "avaliado" pra Desempate ou Resultado Final —
// TODOS apresentam fisicamente no evento, não só quem ganhou. Trabalho ainda
// em "avaliado" (Resultado, não triado) não entra.
const STATUS_ELEGIVEIS: TrabalhoStatus[] = [
  "aguardando_apresentacao",
  "apresentado",
  "aceito",
  "nao_aceito",
];

const LABEL_MODALIDADE: Record<"oral" | "roda_conversa", string> = {
  oral: "Apresentação Oral",
  roda_conversa: "Roda de Conversa",
};

type Grupo = {
  area: string;
  modalidade: "oral" | "roda_conversa";
  trabalhos: Trabalho[];
};

function paraDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatarHorario(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Evento "simples" (2026-09-23) não tem trabalho/sala pra alocar — no
 * lugar das abas Salas/Ensalamento, mostra o QR rotativo de confirmação de
 * presença (pra projetar no local do evento) + a lista de quem já
 * confirmou. Busca um código novo a cada 15s (bem dentro da janela de 60s
 * de cada código, ver src/lib/qrPresenca.ts) e redesenha o QR. */
function ConfirmacaoPresencaView({ evento, user }: { evento: Evento; user: User | null | undefined }) {
  const { inscritos } = useInscritosDoEvento(evento.id);
  const [busca, setBusca] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [erroQr, setErroQr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    async function buscarQr() {
      try {
        const idToken = await user!.getIdToken();
        const res = await fetch(`/api/eventos/qr-atual?eventoId=${evento.id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível gerar o QR.");
        const dataUrl = await QRCode.toDataURL(corpo.texto as string, { width: 320, margin: 1 });
        if (!cancelado) {
          setQrDataUrl(dataUrl);
          setErroQr(null);
        }
      } catch (e) {
        if (!cancelado) setErroQr(e instanceof Error ? e.message : "Erro ao gerar o QR.");
      }
    }

    buscarQr();
    const intervalo = setInterval(buscarQr, 15_000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [evento.id, user]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return inscritos;
    return inscritos.filter(
      (i) => i.nome.toLowerCase().includes(termo) || i.email.toLowerCase().includes(termo),
    );
  }, [inscritos, busca]);

  const confirmados = inscritos.filter((i) => i.presencaConfirmada).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-fatec-line bg-white p-8 text-center">
        <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
          <QrCode className="h-4 w-4" strokeWidth={2} />
          QR de confirmação de presença
        </span>
        <p className="max-w-md text-sm text-fatec-muted">
          Deixe essa tela projetada ou visível no local do evento. Cada
          inscrito escaneia com o celular pra confirmar presença — o código
          muda sozinho a cada minuto, então um print antigo não funciona
          mais.
        </p>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR de confirmação de presença" className="h-80 w-80" />
        ) : (
          <div className="flex h-80 w-80 items-center justify-center rounded-xl bg-fatec-navy-50 text-sm text-fatec-muted">
            {erroQr ?? "Gerando QR..."}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-fatec-line bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fatec-navy-900">
            Presenças
            <span className="font-normal text-fatec-muted">
              ({confirmados}/{inscritos.length} confirmadas)
            </span>
          </h2>
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

        <div className="mt-4 flex flex-col divide-y divide-fatec-line overflow-hidden rounded-xl border border-fatec-line">
          {filtrados.map((i) => (
            <div key={i.uid} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-xs font-semibold text-white">
                {(i.nome || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fatec-navy-900">{i.nome}</p>
                <p className="truncate text-xs text-fatec-muted">{i.email}</p>
              </div>
              <span
                className={`flex-none inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  i.presencaConfirmada
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-fatec-navy-50 text-fatec-muted"
                }`}
              >
                {i.presencaConfirmada ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Confirmada
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                    Aguardando
                  </>
                )}
              </span>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="px-4 py-3 text-sm text-fatec-muted">Ninguém encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function EnsalamentoPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  const [aba, setAba] = useState<"ensalamento" | "salas">("ensalamento");
  const [eventoId, setEventoId] = useState("");
  const evento = eventos.find((e) => e.id === eventoId);
  const modalidadesDoEvento = evento?.modalidadesApresentacao ?? [];

  const { salas: catalogoSalas } = useSalasCatalogo();
  const { sessoes } = useSessoesDoEvento(eventoId || undefined);

  // Salas escolhidas pra ESTE evento, dentro do catálogo único (ver
  // evento.salasIds em src/lib/data/eventos.ts) — é esse subconjunto que a
  // grade automática usa, não o catálogo inteiro.
  const salasIdsDoEvento = evento?.salasIds ?? [];
  const salas = catalogoSalas.filter((s) => salasIdsDoEvento.includes(s.id));

  // Aba Salas — cadastro no catálogo (só Admin) + seleção pra este evento
  // (Admin ou Organização, é uma escolha por evento como as demais).
  const [nomeSalaForm, setNomeSalaForm] = useState("");
  const [criandoSala, setCriandoSala] = useState(false);
  // Apagar do catálogo afeta TODOS os eventos, não só o selecionado aqui —
  // confirmação obrigatória (2026-09-28, depois de um apagão sem querer: o
  // botão de lixeira fica coladinho no chip de marcar/desmarcar).
  const [salaParaRemover, setSalaParaRemover] = useState<SalaEnsalamento | null>(null);
  const [removendoSala, setRemovendoSala] = useState(false);

  async function confirmarRemoverSala() {
    if (!salaParaRemover) return;
    setRemovendoSala(true);
    try {
      await removerSala(salaParaRemover.id);
      setSalaParaRemover(null);
    } finally {
      setRemovendoSala(false);
    }
  }

  async function handleCriarSala() {
    if (!nomeSalaForm.trim()) return;
    setCriandoSala(true);
    try {
      await criarSala({ nome: nomeSalaForm.trim() });
      setNomeSalaForm("");
    } finally {
      setCriandoSala(false);
    }
  }

  async function toggleSalaDoEvento(salaId: string, incluir: boolean) {
    if (!eventoId) return;
    await updateDoc(doc(db, "eventos", eventoId), {
      salasIds: incluir ? arrayUnion(salaId) : arrayRemove(salaId),
    });
  }

  async function selecionarTodasSalas() {
    if (!eventoId) return;
    await updateDoc(doc(db, "eventos", eventoId), {
      salasIds: catalogoSalas.map((s) => s.id),
    });
  }

  async function limparSelecaoSalas() {
    if (!eventoId) return;
    await updateDoc(doc(db, "eventos", eventoId), { salasIds: [] });
  }

  // Configuração da grade (início/fim das apresentações + duração) — vive no
  // próprio evento, editada aqui na aba Ensalamento (não no wizard de
  // Eventos, é específico desse fluxo).
  const [configForm, setConfigForm] = useState({ inicio: "", fim: "", duracao: "", vagasBanner: "" });
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const temRodaDeConversa = modalidadesDoEvento.includes("roda_conversa");

  // Reseta o formulário quando o evento selecionado muda — ajuste de estado
  // durante a renderização (padrão recomendado pelo React pra "adjusting
  // state when a prop changes"), não dentro de um useEffect.
  const [eventoIdDoForm, setEventoIdDoForm] = useState(eventoId);
  if (eventoId !== eventoIdDoForm) {
    setEventoIdDoForm(eventoId);
    setConfigForm(
      evento
        ? {
            inicio: evento.apresentacaoInicio
              ? paraDatetimeLocal(evento.apresentacaoInicio.toDate())
              : "",
            fim: evento.apresentacaoFim ? paraDatetimeLocal(evento.apresentacaoFim.toDate()) : "",
            duracao:
              evento.duracaoApresentacaoMinutos != null
                ? String(evento.duracaoApresentacaoMinutos)
                : "",
            vagasBanner:
              evento.vagasBannerPorSala != null ? String(evento.vagasBannerPorSala) : "",
          }
        : { inicio: "", fim: "", duracao: "", vagasBanner: "" },
    );
  }

  const duracaoValida = Number(configForm.duracao) > 0;
  // Só exige "vagas por sala" se o evento aceita roda de conversa — evento
  // só com oral nem mostra esse campo (ver JSX abaixo).
  const vagasBannerValida = !temRodaDeConversa || Number(configForm.vagasBanner) > 0;
  const datasValidas =
    !!configForm.inicio &&
    !!configForm.fim &&
    new Date(configForm.fim).getTime() > new Date(configForm.inicio).getTime();
  const configValidaPraSalvar = duracaoValida && vagasBannerValida && datasValidas;

  async function salvarConfigGrade() {
    if (!eventoId || !configValidaPraSalvar) return;
    setSalvandoConfig(true);
    try {
      await updateDoc(doc(db, "eventos", eventoId), {
        apresentacaoInicio: Timestamp.fromDate(new Date(configForm.inicio)),
        apresentacaoFim: Timestamp.fromDate(new Date(configForm.fim)),
        duracaoApresentacaoMinutos: Number(configForm.duracao),
        ...(temRodaDeConversa ? { vagasBannerPorSala: Number(configForm.vagasBanner) } : {}),
      });
    } finally {
      setSalvandoConfig(false);
    }
  }

  const trabalhosDoEvento = useMemo(
    () =>
      trabalhos.filter(
        (t) =>
          t.eventoId === eventoId &&
          STATUS_ELEGIVEIS.includes(t.status) &&
          !!t.modalidadeApresentacao,
      ),
    [trabalhos, eventoId],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>();
    for (const t of trabalhosDoEvento) {
      if (!t.modalidadeApresentacao) continue;
      const chave = `${t.areaTematica}::${t.modalidadeApresentacao}`;
      const atual = mapa.get(chave) ?? {
        area: t.areaTematica,
        modalidade: t.modalidadeApresentacao,
        trabalhos: [],
      };
      atual.trabalhos.push(t);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort(
      (a, b) => a.area.localeCompare(b.area) || a.modalidade.localeCompare(b.modalidade),
    );
  }, [trabalhosDoEvento]);

  // Geração automática da grade — first-fit decreasing, ver
  // src/lib/data/sessoes.ts. Substitui a grade inteira (com confirmação),
  // inclusive ajustes manuais feitos antes.
  const [confirmandoGeracao, setConfirmandoGeracao] = useState(false);
  const [gerando, setGerando] = useState(false);

  const podeGerar =
    configValidaPraSalvar &&
    !!evento?.apresentacaoInicio &&
    !!evento?.duracaoApresentacaoMinutos &&
    (!temRodaDeConversa || !!evento?.vagasBannerPorSala) &&
    salas.length > 0 &&
    grupos.length > 0;

  async function handleGerarGrade() {
    if (!evento?.apresentacaoInicio || !evento?.apresentacaoFim || !evento?.duracaoApresentacaoMinutos)
      return;
    setGerando(true);
    try {
      const gruposParaGrade: GrupoParaGrade[] = grupos.map((g) => ({
        areaTematica: g.area,
        modalidade: g.modalidade,
        trabalhoIds: g.trabalhos.map((t) => t.id),
      }));
      const { sessoesNovas } = montarGradeAutomatica({
        grupos: gruposParaGrade,
        salas: salas.map((s) => ({ id: s.id })),
        apresentacaoInicio: evento.apresentacaoInicio.toDate(),
        apresentacaoFim: evento.apresentacaoFim.toDate(),
        duracaoApresentacaoMinutos: evento.duracaoApresentacaoMinutos,
        vagasBannerPorSala: evento.vagasBannerPorSala ?? 0,
      });
      await substituirGradeDoEvento({
        eventoId,
        sessoesAntigas: sessoes.map((s) => ({ id: s.id })),
        trabalhosDoEvento: trabalhosDoEvento.map((t) => ({ id: t.id })),
        sessoesNovas,
      });
      setConfirmandoGeracao(false);
    } finally {
      setGerando(false);
    }
  }

  // Trabalhos elegíveis que não caíram em nenhuma sessão da grade atual —
  // ou porque a grade nunca foi gerada, ou porque a capacidade configurada
  // não foi suficiente (overflow do algoritmo).
  const naoAlocados = useMemo(
    () => trabalhosDoEvento.filter((t) => !sessoes.some((s) => s.trabalhoIds.includes(t.id))),
    [trabalhosDoEvento, sessoes],
  );

  const sessoesOrdenadas = useMemo(
    () =>
      [...sessoes].sort(
        (a, b) =>
          a.areaTematica.localeCompare(b.areaTematica) ||
          a.modalidade.localeCompare(b.modalidade) ||
          a.horarioInicio.toMillis() - b.horarioInicio.toMillis(),
      ),
    [sessoes],
  );

  const [erroMover, setErroMover] = useState<string | null>(null);

  // Lista de trabalhos por sessão vem recolhida por padrão (2026-09-28) — com
  // 200-300 trabalhos cada sessão tem 15-17 itens, e deixar tudo sempre
  // expandido vira parede de texto (cada linha da tabela ficava gigante,
  // difícil até de comparar sala/horário entre sessões diferentes).
  const [sessoesExpandidas, setSessoesExpandidas] = useState<Set<string>>(new Set());

  function toggleExpandirSessao(sessaoId: string) {
    setSessoesExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(sessaoId)) novo.delete(sessaoId);
      else novo.add(sessaoId);
      return novo;
    });
  }

  async function handleMover(trabalhoId: string, deSessaoId: string, paraSessaoId: string) {
    if (!paraSessaoId || paraSessaoId === deSessaoId) return;
    if (!evento?.apresentacaoInicio || !evento?.apresentacaoFim || !evento?.duracaoApresentacaoMinutos)
      return;
    setErroMover(null);
    const resultado = await moverTrabalho({
      trabalhoId,
      deSessaoId,
      paraSessaoId,
      sessoes,
      duracaoApresentacaoMinutos: evento.duracaoApresentacaoMinutos,
      vagasBannerPorSala: evento.vagasBannerPorSala ?? 0,
      apresentacaoInicio: evento.apresentacaoInicio.toDate(),
      apresentacaoFim: evento.apresentacaoFim.toDate(),
    });
    if (!resultado.ok) setErroMover(resultado.erro);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/ensalamento"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Ensalamento
            </h1>
            <p className="text-sm text-fatec-muted">
              {evento?.tipo === "simples"
                ? "Confirmação de presença por QR — evento sem trabalho/ensalamento."
                : "Monte a grade de apresentações automaticamente, por sala, horário, modalidade e área temática."}
            </p>
          </div>

          <div className="relative">
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600"
            >
              <option value="">Selecione o evento</option>
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
          {!eventoId && (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Selecione um evento acima pra começar.
            </p>
          )}

          {eventoId && evento?.tipo === "simples" && (
            <ConfirmacaoPresencaView evento={evento} user={user} />
          )}

          {eventoId && evento?.tipo !== "simples" && modalidadesDoEvento.length === 0 && (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Esse evento não tem etapa de apresentação configurada — ajuste
              em Eventos → Configurações (“Modalidades de apresentação”)
              antes de ensalar.
            </p>
          )}

          {eventoId && modalidadesDoEvento.length > 0 && (
            <div className="flex flex-col gap-6">
              <div className="flex w-fit overflow-hidden rounded-xl border border-fatec-line">
                <button
                  type="button"
                  onClick={() => setAba("ensalamento")}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
                    aba === "ensalamento"
                      ? "bg-fatec-orange-500 text-white"
                      : "bg-white text-fatec-navy-800 hover:bg-fatec-navy-50"
                  }`}
                >
                  Ensalamento
                </button>
                <button
                  type="button"
                  onClick={() => setAba("salas")}
                  className={`border-l border-fatec-line px-5 py-2.5 text-sm font-semibold transition-colors ${
                    aba === "salas"
                      ? "bg-fatec-orange-500 text-white"
                      : "bg-white text-fatec-navy-800 hover:bg-fatec-navy-50"
                  }`}
                >
                  Salas
                </button>
              </div>

              {aba === "salas" && (
                <section className="rounded-2xl border border-fatec-line bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-fatec-navy-900">Salas</h2>
                      <p className="mt-1 text-sm text-fatec-muted">
                        Catálogo único, compartilhado entre todos os eventos.
                        Marque abaixo quais salas valem pra este evento — a
                        grade automática distribui os trabalhos só entre as
                        marcadas.
                      </p>
                    </div>
                    <div className="flex flex-none gap-2">
                      <button
                        type="button"
                        onClick={selecionarTodasSalas}
                        disabled={catalogoSalas.length === 0}
                        className="rounded-xl border border-fatec-line bg-white px-3.5 py-1.5 text-xs font-semibold text-fatec-navy-800 transition-colors hover:border-fatec-orange-400 disabled:cursor-not-allowed disabled:text-fatec-muted"
                      >
                        Selecionar todas
                      </button>
                      <button
                        type="button"
                        onClick={limparSelecaoSalas}
                        disabled={salas.length === 0}
                        className="rounded-xl border border-fatec-line bg-white px-3.5 py-1.5 text-xs font-semibold text-fatec-navy-800 transition-colors hover:border-fatec-orange-400 disabled:cursor-not-allowed disabled:text-fatec-muted"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {catalogoSalas.map((s) => {
                      const selecionada = salasIdsDoEvento.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-1.5 rounded-xl border py-1.5 pl-3.5 pr-1.5 text-sm font-semibold transition-colors ${
                            selecionada
                              ? "border-fatec-navy-900 bg-fatec-navy-900 text-white"
                              : "border-fatec-line bg-white text-fatec-navy-800 hover:border-fatec-orange-400"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSalaDoEvento(s.id, !selecionada)}
                            className="py-0.5"
                          >
                            {s.nome}
                          </button>
                          {perfil.papel === "admin" && (
                            <button
                              type="button"
                              aria-label={`Remover ${s.nome} do catálogo`}
                              onClick={() => setSalaParaRemover(s)}
                              className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg transition-colors ${
                                selecionada
                                  ? "hover:bg-white/20"
                                  : "hover:bg-rose-50 hover:text-rose-600"
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {catalogoSalas.length === 0 && (
                      <p className="text-sm text-fatec-muted">
                        Nenhuma sala cadastrada ainda no catálogo.
                      </p>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-fatec-muted">
                    {salas.length} sala(s) selecionada(s) pra este evento.
                  </p>

                  {perfil.papel === "admin" && (
                    <div className="mt-4 flex flex-col gap-2 border-t border-fatec-line pt-4 sm:flex-row">
                      <input
                        type="text"
                        value={nomeSalaForm}
                        onChange={(e) => setNomeSalaForm(e.target.value)}
                        placeholder="Nova sala pro catálogo (ex.: Sala 101, Auditório)"
                        className="flex-1 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none focus:border-fatec-sky-600"
                      />
                      <button
                        type="button"
                        onClick={handleCriarSala}
                        disabled={criandoSala || !nomeSalaForm.trim()}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2} />
                        Adicionar ao catálogo
                      </button>
                    </div>
                  )}
                </section>
              )}

              {aba === "ensalamento" && (
                <>
                  {/* Configuração da grade */}
                  <section className="rounded-2xl border border-fatec-line bg-white p-5">
                    <h2 className="font-semibold text-fatec-navy-900">Configuração da grade</h2>
                    <p className="mt-1 text-sm text-fatec-muted">
                      Início e fim das apresentações{" "}
                      {temRodaDeConversa
                        ? "e como cada modalidade ocupa a sala: oral é fatiada por minuto, roda de conversa fica exposta o bloco inteiro, com vagas simultâneas por sala."
                        : "e a duração de cada uma — usados pra calcular quantos trabalhos cabem em cada sala."}
                    </p>
                    <div
                      className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 ${temRodaDeConversa ? "lg:grid-cols-4" : ""}`}
                    >
                      <label className="flex flex-col gap-1 text-xs font-medium text-fatec-muted">
                        Início das apresentações
                        <input
                          type="datetime-local"
                          value={configForm.inicio}
                          onChange={(e) => setConfigForm((f) => ({ ...f, inicio: e.target.value }))}
                          className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-fatec-muted">
                        Fim das apresentações
                        <input
                          type="datetime-local"
                          value={configForm.fim}
                          onChange={(e) => setConfigForm((f) => ({ ...f, fim: e.target.value }))}
                          className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-fatec-muted">
                        {temRodaDeConversa
                          ? "Duração de cada apresentação oral (minutos)"
                          : "Duração de cada apresentação (minutos)"}
                        <input
                          type="number"
                          min={1}
                          value={configForm.duracao}
                          onChange={(e) => setConfigForm((f) => ({ ...f, duracao: e.target.value }))}
                          className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                        />
                      </label>
                      {temRodaDeConversa && (
                        <label className="flex flex-col gap-1 text-xs font-medium text-fatec-muted">
                          Vagas simultâneas por sala (roda de conversa)
                          <input
                            type="number"
                            min={1}
                            value={configForm.vagasBanner}
                            onChange={(e) =>
                              setConfigForm((f) => ({ ...f, vagasBanner: e.target.value }))
                            }
                            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                          />
                        </label>
                      )}
                    </div>
                    {configForm.inicio && configForm.fim && !datasValidas && (
                      <p className="mt-2 text-xs font-medium text-fatec-orange-600">
                        O fim precisa ser depois do início.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={salvarConfigGrade}
                      disabled={salvandoConfig || !configValidaPraSalvar}
                      className="mt-4 w-fit rounded-xl bg-fatec-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-navy-800 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                    >
                      {salvandoConfig ? "Salvando..." : "Salvar configuração"}
                    </button>
                  </section>

                  {/* Trabalhos por área x modalidade */}
                  <section className="rounded-2xl border border-fatec-line bg-white p-5">
                    <h2 className="font-semibold text-fatec-navy-900">
                      Trabalhos por área × modalidade
                    </h2>
                    <p className="mt-1 text-sm text-fatec-muted">
                      Todo trabalho que já passou de “avaliado” (Desempate ou
                      Resultado Final) — é esse universo que apresenta no
                      evento.
                    </p>

                    <div className="mt-4 flex flex-col gap-2">
                      {grupos.map((g) => (
                        <div
                          key={`${g.area}::${g.modalidade}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-3"
                        >
                          <span className="text-sm font-medium text-fatec-navy-900">{g.area}</span>
                          <span className="text-xs text-fatec-muted">
                            {LABEL_MODALIDADE[g.modalidade]} · {g.trabalhos.length} trabalho(s)
                          </span>
                        </div>
                      ))}
                      {grupos.length === 0 && (
                        <p className="text-sm text-fatec-muted">
                          Nenhum trabalho chegou em Desempate/Resultado Final
                          ainda pra esse evento.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmandoGeracao(true)}
                      disabled={!podeGerar}
                      title={
                        !podeGerar
                          ? "Preencha a configuração da grade, selecione pelo menos 1 sala e tenha trabalhos elegíveis"
                          : undefined
                      }
                      className="mt-4 flex w-fit items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                    >
                      <Wand2 className="h-4 w-4" strokeWidth={1.75} />
                      Gerar grade automaticamente
                    </button>
                  </section>

                  {sessoes.length > 0 && naoAlocados.length > 0 && (
                    <section className="flex items-start gap-3 rounded-2xl border border-fatec-orange-200 bg-fatec-orange-50 p-5">
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 flex-none text-fatec-orange-600"
                        strokeWidth={1.75}
                      />
                      <div>
                        <p className="text-sm font-semibold text-fatec-orange-700">
                          {naoAlocados.length} trabalho(s) não couberam na grade atual
                        </p>
                        <p className="mt-1 text-sm text-fatec-orange-700/80">
                          A capacidade configurada (salas × tempo disponível)
                          não foi suficiente. Aumente o número de salas, o
                          período de apresentações ou gere a grade de novo
                          depois de ajustar.
                        </p>
                        <ul className="mt-2 list-inside list-disc text-sm text-fatec-orange-700/80">
                          {naoAlocados.map((t) => (
                            <li key={t.id}>{t.titulo}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}

                  {/* Grade montada */}
                  <section className="rounded-2xl border border-fatec-line bg-white p-5">
                    <h2 className="font-semibold text-fatec-navy-900">Grade montada</h2>
                    {erroMover && (
                      <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                        {erroMover}
                      </p>
                    )}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                            <th className="px-3 py-2 font-semibold">Sala</th>
                            <th className="px-3 py-2 font-semibold">Horário</th>
                            <th className="px-3 py-2 font-semibold">Modalidade</th>
                            <th className="px-3 py-2 font-semibold">Área</th>
                            <th className="px-3 py-2 font-semibold">Trabalhos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessoesOrdenadas.map((s) => {
                            const salaNome = salas.find((sa) => sa.id === s.salaId)?.nome ?? "—";
                            const duracaoMin = evento?.duracaoApresentacaoMinutos ?? 0;
                            // Só entre sessões da MESMA modalidade — oral e
                            // roda de conversa ocupam sala de jeitos
                            // incompatíveis (ver moverTrabalho).
                            const outrasSessoes = sessoesOrdenadas.filter(
                              (o) => o.id !== s.id && o.modalidade === s.modalidade,
                            );
                            return (
                              <tr key={s.id} className="border-b border-fatec-line last:border-0">
                                <td className="px-3 py-2.5 align-top font-medium text-fatec-navy-900">
                                  {salaNome}
                                </td>
                                <td className="px-3 py-2.5 align-top text-fatec-ink">
                                  {formatarHorario(s.horarioInicio.toDate())} –{" "}
                                  {formatarHorario(s.horarioFim.toDate())}
                                </td>
                                <td className="px-3 py-2.5 align-top text-fatec-ink">
                                  {LABEL_MODALIDADE[s.modalidade]}
                                </td>
                                <td className="px-3 py-2.5 align-top text-fatec-ink">
                                  {s.areaTematica}
                                </td>
                                <td className="px-3 py-2.5 align-top text-fatec-ink">
                                  {s.trabalhoIds.length === 0 ? (
                                    <span className="text-fatec-muted">—</span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandirSessao(s.id)}
                                        className="flex items-center gap-1 text-xs font-semibold text-fatec-sky-600 transition-colors hover:text-fatec-sky-700"
                                      >
                                        <ChevronDown
                                          className={`h-3.5 w-3.5 transition-transform ${
                                            sessoesExpandidas.has(s.id) ? "rotate-180" : ""
                                          }`}
                                          strokeWidth={2}
                                        />
                                        {s.trabalhoIds.length} trabalho(s)
                                        {sessoesExpandidas.has(s.id) ? " — recolher" : " — ver lista"}
                                      </button>
                                      {sessoesExpandidas.has(s.id) && (
                                        <ul className="mt-2 flex flex-col gap-2">
                                          {s.trabalhoIds.map((id, i) => {
                                            const t = trabalhosDoEvento.find((tr) => tr.id === id);
                                            // Roda de conversa não tem horário por trabalho — todos
                                            // ficam expostos ao mesmo tempo, o bloco inteiro.
                                            const horarioItem =
                                              s.modalidade === "oral" && duracaoMin > 0
                                                ? formatarHorario(
                                                    new Date(
                                                      s.horarioInicio.toDate().getTime() +
                                                        i * duracaoMin * 60000,
                                                    ),
                                                  )
                                                : null;
                                            return (
                                              <li key={id} className="flex items-center gap-2">
                                                <span>
                                                  {horarioItem && (
                                                    <span className="text-fatec-muted">
                                                      {horarioItem} —{" "}
                                                    </span>
                                                  )}
                                                  {t?.titulo ?? id}
                                                </span>
                                                <select
                                                  value=""
                                                  onChange={(e) => handleMover(id, s.id, e.target.value)}
                                                  className="rounded-lg border border-fatec-line bg-white px-2 py-1 text-xs text-fatec-muted outline-none focus:border-fatec-sky-600"
                                                >
                                                  <option value="">Mover para...</option>
                                                  {outrasSessoes.map((o) => (
                                                    <option key={o.id} value={o.id}>
                                                      {salas.find((sa) => sa.id === o.salaId)?.nome ?? "—"} ·{" "}
                                                      {formatarHorario(o.horarioInicio.toDate())} ·{" "}
                                                      {o.areaTematica}
                                                    </option>
                                                  ))}
                                                </select>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {sessoesOrdenadas.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-8 text-center text-fatec-muted">
                                Nenhuma grade gerada ainda.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmandoGeracao}
        onClose={() => setConfirmandoGeracao(false)}
        title="Gerar grade automaticamente"
      >
        <p className="text-sm text-fatec-ink">
          Isso substitui a grade atual inteira — inclusive qualquer ajuste
          manual feito antes. Os {trabalhosDoEvento.length} trabalho(s)
          elegíveis serão redistribuídos do zero entre as {salas.length}{" "}
          sala(s) selecionadas. Continuar?
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmandoGeracao(false)}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGerarGrade}
            disabled={gerando}
            className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {gerando ? "Gerando..." : "Gerar grade"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!salaParaRemover}
        onClose={() => setSalaParaRemover(null)}
        title="Remover sala do catálogo"
      >
        <p className="text-sm text-fatec-ink">
          Isso apaga <strong>{salaParaRemover?.nome}</strong> do catálogo
          único — some da seleção de qualquer evento que estivesse usando
          essa sala, não só do evento atual. Continuar?
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setSalaParaRemover(null)}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarRemoverSala}
            disabled={removendoSala}
            className="w-fit rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            {removendoSala ? "Removendo..." : "Remover do catálogo"}
          </button>
        </div>
      </Modal>
    </main>
  );
}
