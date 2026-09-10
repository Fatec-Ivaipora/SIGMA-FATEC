"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  type LucideIcon,
  CalendarDays,
  Plus,
  Star,
  FileStack,
  Tag,
  Image as ImageIcon,
  Globe,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  X,
  UserCog,
  Layers,
  Pencil,
  Ticket,
  AlertTriangle,
  Award,
  Settings,
  MoreVertical,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { InscritosEventoModal } from "@/components/InscritosEventoModal";
import { InscricaoManualModal } from "@/components/InscricaoManualModal";
import { MonitoresEventoModal } from "@/components/MonitoresEventoModal";
import { AreaComplexaModal } from "@/components/AreaComplexaModal";
import { BannerCropModal } from "@/components/BannerCropModal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type Evento, type AreaTematicaComplexa } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useInscritosDoEvento } from "@/lib/data/inscricoes";
import { recalcularAreasTematicas } from "@/lib/areasTematicas";

function formatarData(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const FASES_CRIAR = [
  { numero: 1, label: "Básico" },
  { numero: 2, label: "Áreas temáticas" },
  { numero: 3, label: "Inscrições e submissão" },
  { numero: 4, label: "Certificado e valores" },
] as const;

/** Indicador de progresso do wizard "Criar evento" (2026-08-31, área
 * temática virou fase própria em 2026-09-01 por causa das áreas com
 * sub-área) — modal virou muito longo/bagunçado como formulário único;
 * quebrado em fases pra ficar mais dinâmico. Puramente visual, não
 * clicável — navegação é só pelos botões Voltar/Próximo no rodapé. */
function PassosCriarEvento({ fase }: { fase: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      {FASES_CRIAR.map((f) => (
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

// Cor única (navy, a mesma identidade usada no resto do app) pra todo ícone
// de ação — só "amber" foge disso, e por um motivo funcional (não visual):
// sinaliza "precisa configurar antes de funcionar", igual o amber já é usado
// em outros avisos de pendência pelo sistema.
const CORES_ACAO_EVENTO = {
  navy: "bg-fatec-navy-100 text-fatec-navy-800",
  amber: "bg-amber-100 text-amber-700",
} as const;

/** Botão de ação do card de evento (2026-09-01) — cada ação com o próprio
 * ícone (em vez de um bloco só de botões cinza sem ícone), mas com a mesma
 * cor de identidade do app — não um ícone de cor diferente por botão. */
function AcaoEvento({
  icone: Icone,
  cor,
  label,
  onClick,
  href,
}: {
  icone: LucideIcon;
  cor: keyof typeof CORES_ACAO_EVENTO;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const conteudo = (
    <>
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${CORES_ACAO_EVENTO[cor]}`}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
      <span className="truncate text-xs font-semibold text-fatec-navy-900">{label}</span>
    </>
  );
  const className =
    "flex items-center gap-2 rounded-xl border border-fatec-line px-3 py-2 transition-colors hover:bg-fatec-navy-50 hover:border-fatec-navy-200";
  if (href) {
    return (
      <Link href={href} className={className}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {conteudo}
    </button>
  );
}

type ItemMenuEvento = {
  icone: LucideIcon;
  cor: keyof typeof CORES_ACAO_EVENTO;
  label: string;
  onClick?: () => void;
  href?: string;
};

/** Menu "⋮ Mais opções" (2026-09-09) — o card de evento tinha até 9 botões
 * soltos num grid, ficando poluído (pedido explícito do usuário pra reduzir
 * isso). Fica só o que é usado com mais frequência solto no card (Banner,
 * Monitores); o resto (configurações, certificado, edubox etc.) mora aqui
 * dentro. `pendencia` acende um ponto laranja no próprio gatilho quando
 * algum item escondido precisa de atenção (certificado/Edubox ainda não
 * configurado) — sem isso, esconder o item também esconderia o aviso. */
function MenuAcoesEvento({ itens, pendencia }: { itens: ItemMenuEvento[]; pendencia?: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative flex items-center gap-2 rounded-xl border border-fatec-line px-3 py-2 transition-colors hover:bg-fatec-navy-50 hover:border-fatec-navy-200"
      >
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-fatec-navy-100 text-fatec-navy-800">
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span className="truncate text-xs font-semibold text-fatec-navy-900">Mais opções</span>
        {pendencia && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
          />
        )}
      </button>

      {aberto && (
        <>
          {/* Backdrop invisível só pra fechar ao clicar fora — não usa o
              Modal com fundo escuro/blur porque isso aqui é um menu leve,
              não um diálogo. */}
          <div aria-hidden onClick={() => setAberto(false)} className="fixed inset-0 z-10" />
          <div className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-fatec-line bg-white py-1.5 shadow-lg">
            {itens.map((item) => {
              const Icone = item.icone;
              const conteudo = (
                <>
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg ${CORES_ACAO_EVENTO[item.cor]}`}
                  >
                    <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="truncate text-sm text-fatec-navy-900">{item.label}</span>
                </>
              );
              const className =
                "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-fatec-navy-50";
              if (item.href) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={className}
                    onClick={() => setAberto(false)}
                  >
                    {conteudo}
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    item.onClick?.();
                  }}
                  className={className}
                >
                  {conteudo}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CardEventoAdmin({
  evento,
  totalTrabalhos,
  onMarcarDestaque,
  onAlternarAceitaExternos,
  onAbrirInscritos,
  onInscricaoExtra,
  onConfigurarEvento,
  onConfigurarCertificado,
  onAbrirEdubox,
  onAbrirMonitores,
  onAbrirBanner,
  onEncerrarEvento,
}: {
  evento: Evento;
  totalTrabalhos: number;
  onMarcarDestaque: () => void;
  onAlternarAceitaExternos: () => void;
  onAbrirInscritos: () => void;
  onInscricaoExtra: () => void;
  onConfigurarEvento: () => void;
  onConfigurarCertificado: () => void;
  onAbrirEdubox?: () => void;
  onAbrirMonitores: () => void;
  onAbrirBanner: () => void;
  onEncerrarEvento: () => void;
}) {
  const temTaxa = !!evento.valorInscricao;
  const { inscritos } = useInscritosDoEvento(temTaxa ? evento.id : undefined);
  const inscritosPagos = inscritos.filter((i) => i.status === "pago").length;

  // Duas linhas, uma embaixo da outra (2026-09-09, pedido do coordenador) —
  // "Inscrições" (pagamento/interesse) e "Submissão" (janela de ENVIAR o
  // trabalho em si) são coisas diferentes, precisam aparecer separadas, não
  // juntas com " · " como antes.
  const periodoInscricao = evento.periodoSubmissao && `Inscrições: ${evento.periodoSubmissao}`;
  const periodoEnvio = evento.periodoEnvioTrabalho && `Submissão: ${evento.periodoEnvioTrabalho}`;

  const certificadoConfigurado =
    !!(evento.dataRealizacao && evento.cargaHoraria && evento.nomeDiretorAcademico);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
          <CalendarDays className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-fatec-navy-900">{evento.nome}</p>
            {evento.encerrado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                Encerrado
                {evento.encerradoEm &&
                  ` em ${evento.encerradoEm.toDate().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`}
              </span>
            )}
            {evento.destaque && (
              <span className="inline-flex items-center gap-1 rounded-full bg-fatec-orange-100 px-2.5 py-0.5 text-xs font-semibold text-fatec-orange-600">
                <Star className="h-3 w-3" strokeWidth={2} />
                Destaque
              </span>
            )}
            {evento.aceitaExternos && (
              <span className="inline-flex items-center gap-1 rounded-full bg-fatec-sky-100 px-2.5 py-0.5 text-xs font-semibold text-fatec-sky-600">
                <Globe className="h-3 w-3" strokeWidth={2} />
                Externos
              </span>
            )}
            {temTaxa && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Taxa R${" "}
                {evento.valorInscricao!.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
          {periodoInscricao && <p className="text-sm text-fatec-muted">{periodoInscricao}</p>}
          {periodoEnvio && <p className="text-sm text-fatec-muted">{periodoEnvio}</p>}
        </div>
        {/* Botão vermelho bem visível (2026-09-10, pedido do usuário) — fora
            do grid de ações normais de propósito, é uma ação importante
            (desliga banner de destaque, inscrição nova e envio de trabalho
            de uma vez). Reversível — clicar de novo reabre. */}
        <button
          type="button"
          onClick={onEncerrarEvento}
          className={`flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            evento.encerrado
              ? "border border-fatec-line text-fatec-navy-900 hover:bg-fatec-navy-50"
              : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {evento.encerrado ? "Reabrir evento" : "Encerrar evento"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-fatec-line pt-4 text-xs text-fatec-muted">
        <span className="inline-flex items-center gap-1.5">
          <FileStack className="h-3.5 w-3.5" strokeWidth={1.75} />
          {totalTrabalhos} trabalhos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
          {(evento.areasTematicas ?? []).length} áreas
        </span>
        {temTaxa && (
          <button
            type="button"
            onClick={onAbrirInscritos}
            className="inline-flex items-center gap-1.5 font-semibold text-fatec-sky-600 transition-colors hover:text-fatec-navy-800"
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            {inscritos.length} inscritos ({inscritosPagos} pagos)
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <AcaoEvento
          icone={ImageIcon}
          cor="navy"
          label={evento.imagemDestaqueUrl ? "Trocar banner" : "Adicionar banner"}
          onClick={onAbrirBanner}
        />
        <AcaoEvento icone={UserCog} cor="navy" label="Monitores" onClick={onAbrirMonitores} />
        <AcaoEvento icone={Settings} cor="navy" label="Configurações" onClick={onConfigurarEvento} />
        <AcaoEvento
          icone={certificadoConfigurado ? Award : AlertTriangle}
          cor={certificadoConfigurado ? "navy" : "amber"}
          label={certificadoConfigurado ? "Certificado" : "Configurar certificado"}
          onClick={onConfigurarCertificado}
        />
        {temTaxa && (
          <AcaoEvento icone={Ticket} cor="navy" label="Inscrição extra" onClick={onInscricaoExtra} />
        )}
        <MenuAcoesEvento
          pendencia={!!onAbrirEdubox && !evento.codigoEdubox}
          itens={[
            ...(!evento.destaque
              ? [{ icone: Star, cor: "navy" as const, label: "Marcar destaque", onClick: onMarcarDestaque }]
              : []),
            {
              icone: Globe,
              cor: "navy",
              label: evento.aceitaExternos ? "Não aceitar externos" : "Aceitar externos",
              onClick: onAlternarAceitaExternos,
            },
            { icone: Tag, cor: "navy", label: "Áreas temáticas", href: "/areas-tematicas" },
            ...(onAbrirEdubox
              ? [
                  {
                    icone: evento.codigoEdubox ? Send : AlertTriangle,
                    cor: evento.codigoEdubox ? ("navy" as const) : ("amber" as const),
                    label: evento.codigoEdubox ? "Edubox" : "Configurar Edubox",
                    onClick: onAbrirEdubox,
                  },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );
}

export default function EventosPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  const [modalCriar, setModalCriar] = useState(false);
  const [faseCriar, setFaseCriar] = useState<1 | 2 | 3 | 4>(1);
  const [modalInscritosId, setModalInscritosId] = useState<string | null>(null);
  const [modalInscricaoExtraId, setModalInscricaoExtraId] = useState<string | null>(null);
  const [modalMonitoresId, setModalMonitoresId] = useState<string | null>(null);
  const [bannerEditEventoId, setBannerEditEventoId] = useState<string | null>(null);
  const [bannerEditParaCortar, setBannerEditParaCortar] = useState<File | null>(null);
  const [salvandoBannerEdit, setSalvandoBannerEdit] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [banner, setBanner] = useState<Blob | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [bannerParaCortar, setBannerParaCortar] = useState<File | null>(null);
  const [inicioInscricoes, setInicioInscricoes] = useState("");
  const [fimInscricoes, setFimInscricoes] = useState("");
  const [inicioEnvioTrabalho, setInicioEnvioTrabalho] = useState("");
  const [fimEnvioTrabalho, setFimEnvioTrabalho] = useState("");
  const [areasTematicasForm, setAreasTematicasForm] = useState<string[]>([]);
  const [novaAreaForm, setNovaAreaForm] = useState("");
  const [areasComplexasForm, setAreasComplexasForm] = useState<AreaTematicaComplexa[]>([]);
  const [modalAreaComplexa, setModalAreaComplexa] = useState<{
    aberto: boolean;
    grupo: AreaTematicaComplexa | null;
  }>({ aberto: false, grupo: null });
  const [destaqueNoForm, setDestaqueNoForm] = useState(false);
  const [aceitaExternosNoForm, setAceitaExternosNoForm] = useState(false);
  const [valorInscricao, setValorInscricao] = useState("");
  const [eventoGratuito, setEventoGratuito] = useState(false);
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [nomeDiretorAcademico, setNomeDiretorAcademico] = useState("");
  const [nomeCoordenadorPesquisa, setNomeCoordenadorPesquisa] = useState("");
  const [criando, setCriando] = useState(false);

  // Configurações do evento (2026-09-09) — editar nome/descrição/datas de
  // inscrição/avaliação depois que o evento já existe (o wizard de criação
  // só permite preencher uma vez, e às vezes sai errado ou precisa mudar).
  const [modalConfigId, setModalConfigId] = useState<string | null>(null);
  const [nomeConfig, setNomeConfig] = useState("");
  const [descricaoConfig, setDescricaoConfig] = useState("");
  const [inicioInscricoesConfig, setInicioInscricoesConfig] = useState("");
  const [fimInscricoesConfig, setFimInscricoesConfig] = useState("");
  const [inicioEnvioTrabalhoConfig, setInicioEnvioTrabalhoConfig] = useState("");
  const [fimEnvioTrabalhoConfig, setFimEnvioTrabalhoConfig] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [modalCertificadoId, setModalCertificadoId] = useState<string | null>(null);
  const [dataRealizacaoCert, setDataRealizacaoCert] = useState("");
  const [cargaHorariaCert, setCargaHorariaCert] = useState("");
  const [nomeDiretorCert, setNomeDiretorCert] = useState("");
  const [nomeCoordenadorCert, setNomeCoordenadorCert] = useState("");
  const [numeroRegistroInicialCert, setNumeroRegistroInicialCert] = useState("");
  const [salvandoCert, setSalvandoCert] = useState(false);

  const [modalEduboxId, setModalEduboxId] = useState<string | null>(null);
  const [codigoEduboxForm, setCodigoEduboxForm] = useState("");
  const [salvandoEdubox, setSalvandoEdubox] = useState(false);
  const [teste, setTeste] = useState<
    | { status: "idle" }
    | { status: "testando" }
    | { status: "ok"; mensagem: string }
    | { status: "erro"; mensagem: string; explicacao: string }
  >({ status: "idle" });
  type StatusEdubox = { total: number; prontos: number; pendentesDados: number; jaEnviados: number };
  const [statusEdubox, setStatusEdubox] = useState<
    | { status: "idle" }
    | { status: "carregando" }
    | { status: "ok"; dados: StatusEdubox }
    | { status: "erro"; mensagem: string }
  >({ status: "idle" });
  const [abaEdubox, setAbaEdubox] = useState<"enviar" | "logs">("enviar");
  type LogEdubox = {
    id: string;
    uid: string;
    nome: string | null;
    sucesso: boolean;
    mensagem?: string;
    codclEdubox?: number | null;
    codinsEdubox?: number | null;
    jaExistiaInscricao?: boolean;
    pagoEnviado?: boolean | null;
    chpinsEnviado?: number | null;
    enviadoEm?: Timestamp | null;
  };
  const [logsEdubox, setLogsEdubox] = useState<
    | { status: "idle" }
    | { status: "carregando" }
    | { status: "ok"; itens: LogEdubox[] }
    | { status: "erro"; mensagem: string }
  >({ status: "idle" });
  const [envio, setEnvio] = useState<
    | { status: "idle" }
    | { status: "enviando" }
    | { status: "ok"; enviadosAgora: number; pagamentosAtualizados: number; falharam: number }
    | { status: "erro"; mensagem: string }
  >({ status: "idle" });
  // Progresso do envio em andamento (2026-09-04) — populado conforme o NDJSON
  // do /api/edubox/lancar chega, pra tela mostrar uma barra de verdade em
  // envios longos (200+ pessoas) em vez de deixar o admin sem feedback.
  const [progressoEnvio, setProgressoEnvio] = useState<{ processados: number; total: number } | null>(
    null,
  );

  const valorValido = eventoGratuito || (valorInscricao.trim() !== "" && Number(valorInscricao) > 0);

  const trabalhosPorEvento = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of trabalhos) mapa.set(t.eventoId, (mapa.get(t.eventoId) ?? 0) + 1);
    return mapa;
  }, [trabalhos]);

  function adicionarAreaForm() {
    const nome = novaAreaForm.trim();
    if (!nome || areasTematicasForm.includes(nome)) return;
    setAreasTematicasForm((prev) => [...prev, nome]);
    setNovaAreaForm("");
  }

  function removerAreaForm(area: string) {
    setAreasTematicasForm((prev) => prev.filter((a) => a !== area));
  }

  function salvarAreaComplexaForm(grupo: AreaTematicaComplexa) {
    const grupoAntigo = areasComplexasForm.find((g) => g.id === grupo.id) ?? null;
    setAreasTematicasForm((prev) => recalcularAreasTematicas(prev, grupoAntigo, grupo));
    setAreasComplexasForm((prev) =>
      grupoAntigo ? prev.map((g) => (g.id === grupo.id ? grupo : g)) : [...prev, grupo],
    );
    setModalAreaComplexa({ aberto: false, grupo: null });
  }

  function removerAreaComplexaForm(id: string) {
    const grupo = areasComplexasForm.find((g) => g.id === id) ?? null;
    setAreasTematicasForm((prev) => recalcularAreasTematicas(prev, grupo, null));
    setAreasComplexasForm((prev) => prev.filter((g) => g.id !== id));
    setModalAreaComplexa({ aberto: false, grupo: null });
  }

  function fecharCriar() {
    setModalCriar(false);
    setNome("");
    setDescricao("");
    setBanner(null);
    setBannerPreviewUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
    setBannerParaCortar(null);
    setInicioInscricoes("");
    setFimInscricoes("");
    setInicioEnvioTrabalho("");
    setFimEnvioTrabalho("");
    setAreasTematicasForm([]);
    setNovaAreaForm("");
    setAreasComplexasForm([]);
    setDestaqueNoForm(false);
    setAceitaExternosNoForm(false);
    setValorInscricao("");
    setEventoGratuito(false);
    setDataRealizacao("");
    setCargaHoraria("");
    setNomeDiretorAcademico("");
    setNomeCoordenadorPesquisa("");
    setFaseCriar(1);
  }

  function abrirModalConfig(evento: Evento) {
    setModalConfigId(evento.id);
    setNomeConfig(evento.nome);
    setDescricaoConfig(evento.descricao ?? "");
    setInicioInscricoesConfig(evento.inicioInscricoes ?? "");
    setFimInscricoesConfig(evento.fimInscricoes ?? "");
    setInicioEnvioTrabalhoConfig(evento.inicioEnvioTrabalho ?? "");
    setFimEnvioTrabalhoConfig(evento.fimEnvioTrabalho ?? "");
  }

  async function salvarConfig() {
    if (!modalConfigId || !nomeConfig.trim()) return;
    setSalvandoConfig(true);
    try {
      await updateDoc(doc(db, "eventos", modalConfigId), {
        nome: nomeConfig.trim(),
        descricao: descricaoConfig.trim(),
        periodoSubmissao:
          inicioInscricoesConfig && fimInscricoesConfig
            ? `${formatarData(inicioInscricoesConfig)} — ${formatarData(fimInscricoesConfig)}`
            : "",
        periodoEnvioTrabalho:
          inicioEnvioTrabalhoConfig && fimEnvioTrabalhoConfig
            ? `${formatarData(inicioEnvioTrabalhoConfig)} — ${formatarData(fimEnvioTrabalhoConfig)}`
            : "",
        inicioInscricoes: inicioInscricoesConfig || deleteField(),
        fimInscricoes: fimInscricoesConfig || deleteField(),
        inicioEnvioTrabalho: inicioEnvioTrabalhoConfig || deleteField(),
        fimEnvioTrabalho: fimEnvioTrabalhoConfig || deleteField(),
        // Reflete a mudança no prazo de edição do trabalho pelo aluno também
        // (mesma regra da criação: 23:55 do dia de fim das inscrições) — se
        // o admin corrigir a data de fim, o prazo de edição some/atualiza
        // junto, em vez de ficar preso na data antiga.
        prazoEdicaoTrabalho: fimInscricoesConfig
          ? Timestamp.fromDate(new Date(`${fimInscricoesConfig}T23:55:00`))
          : deleteField(),
      });
      setModalConfigId(null);
    } finally {
      setSalvandoConfig(false);
    }
  }

  function abrirModalCertificado(evento: Evento) {
    setModalCertificadoId(evento.id);
    setDataRealizacaoCert(evento.dataRealizacao ?? "");
    setCargaHorariaCert(evento.cargaHoraria?.toString() ?? "");
    setNomeDiretorCert(evento.nomeDiretorAcademico ?? "");
    setNomeCoordenadorCert(evento.nomeCoordenadorPesquisa ?? "");
    setNumeroRegistroInicialCert(evento.numeroRegistroInicial?.toString() ?? "");
  }

  async function salvarCertificado() {
    if (!modalCertificadoId) return;
    setSalvandoCert(true);
    try {
      await updateDoc(doc(db, "eventos", modalCertificadoId), {
        dataRealizacao: dataRealizacaoCert || null,
        cargaHoraria: cargaHorariaCert.trim() ? Number(cargaHorariaCert) : null,
        nomeDiretorAcademico: nomeDiretorCert.trim(),
        nomeCoordenadorPesquisa: nomeCoordenadorCert.trim(),
        numeroRegistroInicial: numeroRegistroInicialCert.trim()
          ? Number(numeroRegistroInicialCert)
          : null,
      });
      setModalCertificadoId(null);
    } finally {
      setSalvandoCert(false);
    }
  }

  async function buscarStatusEdubox(eventoId: string) {
    if (!user) return;
    setStatusEdubox({ status: "carregando" });
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/edubox/lancar", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, apenasStatus: true }),
      });
      const corpo = await res.json();
      if (!res.ok) {
        setStatusEdubox({ status: "erro", mensagem: corpo.erro ?? "Falha ao consultar." });
        return;
      }
      setStatusEdubox({ status: "ok", dados: corpo });
    } catch {
      setStatusEdubox({ status: "erro", mensagem: "Falha ao consultar." });
    }
  }

  async function abrirModalEdubox(evento: Evento) {
    setModalEduboxId(evento.id);
    setCodigoEduboxForm(evento.codigoEdubox ?? "");
    setTeste({ status: "idle" });
    setEnvio({ status: "idle" });
    setAbaEdubox("enviar");
    setLogsEdubox({ status: "idle" });
    void buscarStatusEdubox(evento.id);
  }

  async function carregarLogsEdubox(eventoId: string) {
    setLogsEdubox({ status: "carregando" });
    try {
      const snap = await getDocs(
        query(collection(db, "eduboxLancamentos"), where("eventoId", "==", eventoId)),
      );
      const itens: LogEdubox[] = snap.docs.map((d) => {
        const dados = d.data();
        return {
          id: d.id,
          uid: dados.uid,
          nome: dados.nome ?? null,
          sucesso: dados.sucesso,
          mensagem: dados.mensagem,
          codclEdubox: dados.codclEdubox ?? null,
          codinsEdubox: dados.codinsEdubox ?? null,
          jaExistiaInscricao: dados.jaExistiaInscricao ?? false,
          pagoEnviado: dados.pagoEnviado ?? null,
          chpinsEnviado: dados.chpinsEnviado ?? null,
          enviadoEm: dados.enviadoEm ?? null,
        };
      });
      itens.sort((a, b) => (b.enviadoEm?.toMillis() ?? 0) - (a.enviadoEm?.toMillis() ?? 0));
      setLogsEdubox({ status: "ok", itens });
    } catch {
      setLogsEdubox({ status: "erro", mensagem: "Não foi possível carregar os logs." });
    }
  }

  function abrirAbaLogs() {
    setAbaEdubox("logs");
    if (modalEduboxId && logsEdubox.status === "idle") void carregarLogsEdubox(modalEduboxId);
  }

  async function salvarCodigoEdubox() {
    if (!modalEduboxId) return;
    setSalvandoEdubox(true);
    try {
      await updateDoc(doc(db, "eventos", modalEduboxId), {
        codigoEdubox: codigoEduboxForm.trim() || null,
      });
    } finally {
      setSalvandoEdubox(false);
    }
  }

  async function testarConexaoEdubox() {
    if (!user) return;
    setTeste({ status: "testando" });
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/edubox/testar-conexao", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const corpo = await res.json();
      if (corpo.ok) {
        setTeste({ status: "ok", mensagem: corpo.mensagem });
      } else {
        setTeste({
          status: "erro",
          mensagem: corpo.mensagem ?? corpo.erro ?? "Falha desconhecida.",
          explicacao: corpo.explicacao ?? "",
        });
      }
    } catch {
      setTeste({
        status: "erro",
        mensagem: "Não foi possível chamar a rota de teste.",
        explicacao: "",
      });
    }
  }

  async function enviarParaEdubox() {
    if (!user || !modalEduboxId) return;
    setEnvio({ status: "enviando" });
    setProgressoEnvio(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/edubox/lancar", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId: modalEduboxId }),
      });

      // Erro antes de começar a processar (auth, evento sem código Edubox,
      // etc.) ainda vem como JSON único, não NDJSON.
      if (!res.ok || !res.body) {
        const corpo = await res.json().catch(() => ({}));
        setEnvio({ status: "erro", mensagem: corpo.erro ?? "Falha ao enviar." });
        return;
      }

      // Daqui em diante é NDJSON — uma linha por participante processado,
      // pra barra de progresso acompanhar em tempo real (2026-09-04).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let concluido = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let quebra: number;
        while ((quebra = buffer.indexOf("\n")) !== -1) {
          const linha = buffer.slice(0, quebra).trim();
          buffer = buffer.slice(quebra + 1);
          if (!linha) continue;
          const evento = JSON.parse(linha);
          if (evento.tipo === "progresso") {
            setProgressoEnvio({ processados: evento.processados, total: evento.total });
          } else if (evento.tipo === "fim") {
            concluido = true;
            setEnvio({
              status: "ok",
              enviadosAgora: evento.enviadosAgora,
              pagamentosAtualizados: evento.pagamentosAtualizados,
              falharam: evento.falharam,
            });
            setStatusEdubox({
              status: "ok",
              dados: {
                total: evento.total,
                prontos: evento.prontos,
                pendentesDados: evento.pendentesDados,
                jaEnviados: evento.jaEnviados + evento.enviadosAgora,
              },
            });
            // Logs ficam desatualizados após um envio — força recarregar na
            // próxima vez que a aba for aberta (ou já recarrega se estiver
            // aberta agora).
            setLogsEdubox({ status: "idle" });
            if (abaEdubox === "logs" && modalEduboxId) void carregarLogsEdubox(modalEduboxId);
          } else if (evento.tipo === "erro") {
            concluido = true;
            setEnvio({ status: "erro", mensagem: evento.erro ?? "Falha ao enviar." });
          }
        }
      }

      if (!concluido) {
        setEnvio({ status: "erro", mensagem: "Conexão encerrada antes de terminar o envio." });
      }
    } catch {
      setEnvio({ status: "erro", mensagem: "Não foi possível chamar a rota de envio." });
    } finally {
      setProgressoEnvio(null);
    }
  }

  function selecionarBannerEdit(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (file) setBannerEditParaCortar(file);
  }

  async function confirmarCorteBannerEdit(blob: Blob) {
    if (!bannerEditEventoId) return;
    setSalvandoBannerEdit(true);
    try {
      const bannerRef = storageRef(storage, `eventos/${bannerEditEventoId}/banner`);
      await uploadBytes(bannerRef, blob);
      const imagemDestaqueUrl = await getDownloadURL(bannerRef);
      await updateDoc(doc(db, "eventos", bannerEditEventoId), { imagemDestaqueUrl });
      setBannerEditParaCortar(null);
      setBannerEditEventoId(null);
    } finally {
      setSalvandoBannerEdit(false);
    }
  }

  function selecionarBanner(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (file) setBannerParaCortar(file);
  }

  function confirmarCorteBanner(blob: Blob) {
    setBanner(blob);
    setBannerPreviewUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return URL.createObjectURL(blob);
    });
    setBannerParaCortar(null);
  }

  async function marcarDestaque(eventoId: string) {
    const batch = writeBatch(db);
    for (const e of eventos) {
      if (e.destaque && e.id !== eventoId) {
        batch.update(doc(db, "eventos", e.id), { destaque: false });
      }
    }
    batch.update(doc(db, "eventos", eventoId), { destaque: true });
    await batch.commit();
  }

  async function alternarAceitaExternos(eventoId: string, atual: boolean) {
    await updateDoc(doc(db, "eventos", eventoId), { aceitaExternos: !atual });
  }

  // Encerrar/reabrir evento (2026-09-10, pedido do usuário) — interruptor
  // manual reversível: desliga banner de destaque, inscrição nova (rota
  // /api/asaas/interesse) e envio de trabalho (firestore.rules) de uma vez,
  // e some da aba "Submissões" do aluno por completo. Reabrir só apaga
  // encerradoEm (não precisa reconfigurar nada, volta a valer as datas de
  // inscrição/submissão já cadastradas).
  async function alternarEncerrado(evento: Evento) {
    await updateDoc(doc(db, "eventos", evento.id), {
      encerrado: !evento.encerrado,
      encerradoEm: evento.encerrado ? deleteField() : serverTimestamp(),
    });
  }

  async function criarEvento() {
    if (!nome.trim() || areasTematicasForm.length === 0 || !valorValido) return;
    setCriando(true);
    try {
      const eventoRef = await addDoc(collection(db, "eventos"), {
        nome: nome.trim(),
        descricao: descricao.trim(),
        periodoSubmissao:
          inicioInscricoes && fimInscricoes
            ? `${formatarData(inicioInscricoes)} — ${formatarData(fimInscricoes)}`
            : "",
        periodoEnvioTrabalho:
          inicioEnvioTrabalho && fimEnvioTrabalho
            ? `${formatarData(inicioEnvioTrabalho)} — ${formatarData(fimEnvioTrabalho)}`
            : "",
        // Datas cruas por trás dos textos acima (2026-09-09) — sem isso não
        // dá pra reabrir e editar depois no modal de Configurações.
        ...(inicioInscricoes ? { inicioInscricoes } : {}),
        ...(fimInscricoes ? { fimInscricoes } : {}),
        ...(inicioEnvioTrabalho ? { inicioEnvioTrabalho } : {}),
        ...(fimEnvioTrabalho ? { fimEnvioTrabalho } : {}),
        destaque: destaqueNoForm,
        aceitaExternos: aceitaExternosNoForm,
        areasTematicas: areasTematicasForm,
        ...(areasComplexasForm.length > 0
          ? { areasTematicasComplexas: areasComplexasForm }
          : {}),
        ...(!eventoGratuito ? { valorInscricao: Number(valorInscricao) } : {}),
        // Prazo de edição do trabalho pelo aluno (2026-09-04): 23:55 do dia
        // de fim das inscrições — depois disso o trabalho trava do jeito que
        // estiver (ver firestore.rules e o botão "Editar" em
        // src/app/aluno/trabalhos/page.tsx). Sem fimInscricoes definido, o
        // campo fica ausente e a edição nunca trava (mesmo padrão de
        // "campo ausente = sem restrição" usado no resto do arquivo).
        ...(fimInscricoes
          ? { prazoEdicaoTrabalho: Timestamp.fromDate(new Date(`${fimInscricoes}T23:55:00`)) }
          : {}),
        ...(dataRealizacao ? { dataRealizacao } : {}),
        ...(cargaHoraria.trim() ? { cargaHoraria: Number(cargaHoraria) } : {}),
        ...(nomeDiretorAcademico.trim()
          ? { nomeDiretorAcademico: nomeDiretorAcademico.trim() }
          : {}),
        ...(nomeCoordenadorPesquisa.trim()
          ? { nomeCoordenadorPesquisa: nomeCoordenadorPesquisa.trim() }
          : {}),
      });

      if (banner) {
        const bannerRef = storageRef(storage, `eventos/${eventoRef.id}/banner`);
        await uploadBytes(bannerRef, banner);
        const imagemDestaqueUrl = await getDownloadURL(bannerRef);
        await updateDoc(eventoRef, { imagemDestaqueUrl });
      }

      fecharCriar();
    } finally {
      setCriando(false);
    }
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/eventos"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Eventos
            </h1>
            <p className="text-sm text-fatec-muted">
              Cadastre eventos e escolha qual aparece em destaque na home.
            </p>
          </div>

          {perfil.papel === "admin" && (
            <button
              type="button"
              onClick={() => setModalCriar(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Criar evento
            </button>
          )}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-3">
            {eventos.map((evento) => (
              <CardEventoAdmin
                key={evento.id}
                evento={evento}
                totalTrabalhos={trabalhosPorEvento.get(evento.id) ?? 0}
                onMarcarDestaque={() => marcarDestaque(evento.id)}
                onAlternarAceitaExternos={() =>
                  alternarAceitaExternos(evento.id, !!evento.aceitaExternos)
                }
                onAbrirInscritos={() => setModalInscritosId(evento.id)}
                onInscricaoExtra={() => setModalInscricaoExtraId(evento.id)}
                onConfigurarEvento={() => abrirModalConfig(evento)}
                onConfigurarCertificado={() => abrirModalCertificado(evento)}
                onAbrirEdubox={
                  perfil.papel === "admin" ? () => abrirModalEdubox(evento) : undefined
                }
                onAbrirMonitores={() => setModalMonitoresId(evento.id)}
                onAbrirBanner={() => setBannerEditEventoId(evento.id)}
                onEncerrarEvento={() => alternarEncerrado(evento)}
              />
            ))}

            {eventos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                Nenhum evento cadastrado ainda.
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal open={modalCriar} onClose={fecharCriar} title="Criar evento" size="lg">
        <form className="flex flex-col gap-5">
          <PassosCriarEvento fase={faseCriar} />

          {faseCriar === 1 && (
          <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nome do evento
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: MAC 2027"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Descrição do evento
            </span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Do que se trata o evento, pra quem é, etc."
              className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Banner do evento
            </span>
            {bannerPreviewUrl ? (
              <div className="relative aspect-[12/5] overflow-hidden rounded-xl border border-fatec-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerPreviewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <label className="cursor-pointer rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/80">
                    Trocar
                    <input
                      type="file"
                      accept="image/*"
                      onChange={selecionarBanner}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBanner(null);
                      setBannerPreviewUrl((antigo) => {
                        if (antigo) URL.revokeObjectURL(antigo);
                        return null;
                      });
                    }}
                    className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/80"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-fatec-line bg-fatec-navy-50 px-4 py-4 transition-colors hover:border-fatec-sky-600">
                <ImageIcon
                  className="h-5 w-5 flex-none text-fatec-muted"
                  strokeWidth={1.75}
                />
                <span className="flex flex-col">
                  <span className="text-sm text-fatec-muted">
                    Escolher imagem (usada no banner de destaque da home)
                  </span>
                  <span className="text-xs text-fatec-muted/70">
                    Recomendado: pelo menos 2560 × 1067px (proporção 12:5) — dá pra ajustar o enquadramento depois
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={selecionarBanner}
                  className="hidden"
                />
              </label>
            )}
          </div>
          </>
          )}

          {faseCriar === 2 && (
          <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Áreas temáticas <span className="text-fatec-orange-600">*</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {areasTematicasForm
                .filter(
                  (area) => !areasComplexasForm.some((g) => area.startsWith(`${g.nomeGrupo} – `)),
                )
                .map((area) => (
                <span
                  key={area}
                  className="flex items-center gap-1.5 rounded-full bg-fatec-navy-50 py-1.5 pl-3.5 pr-2 text-sm font-medium text-fatec-navy-900"
                >
                  {area}
                  <button
                    type="button"
                    aria-label={`Remover ${area}`}
                    onClick={() => removerAreaForm(area)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-100 hover:text-fatec-navy-900"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </span>
              ))}
              {areasTematicasForm.length === 0 && (
                <p className="text-sm text-fatec-muted">
                  Nenhuma área adicionada ainda — obrigatório pelo menos uma.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={novaAreaForm}
                onChange={(e) => setNovaAreaForm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarAreaForm();
                  }
                }}
                placeholder="Ex.: Ciências Exatas e da Terra"
                className="min-w-0 flex-1 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
              <button
                type="button"
                onClick={adicionarAreaForm}
                className="flex flex-none items-center gap-1.5 rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Adicionar
              </button>
            </div>
            <span className="text-xs text-fatec-muted">
              Usadas na submissão do trabalho e pra distribuir entre
              avaliadores/moderadores — dá pra ajustar depois em Áreas
              temáticas.
            </span>
          </div>

          <div className="flex flex-col gap-2 border-t border-fatec-line pt-5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Áreas com sub-áreas dentro
            </span>
            <span className="text-xs text-fatec-muted">
              Pra área que se divide em vários grupos por curso, tipo
              &quot;Projetos Integradores&quot; — cada sub-área vira uma área
              selecionável própria.
            </span>
            {areasComplexasForm.length > 0 && (
              <div className="flex flex-col gap-2">
                {areasComplexasForm.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setModalAreaComplexa({ aberto: true, grupo: g })}
                    className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-fatec-navy-900">
                      <Layers className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
                      {g.nomeGrupo}
                      <span className="text-xs font-normal text-fatec-muted">
                        ({g.subAreas.length} sub-área{g.subAreas.length === 1 ? "" : "s"})
                      </span>
                    </span>
                    <Pencil className="h-3.5 w-3.5 flex-none text-fatec-muted" strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setModalAreaComplexa({ aberto: true, grupo: null })}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-fatec-line px-3 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Adicionar área com sub-áreas
            </button>
          </div>
          </>
          )}

          {faseCriar === 3 && (
          <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Início das inscrições
              </span>
              <input
                type="date"
                value={inicioInscricoes}
                onChange={(e) => setInicioInscricoes(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim das inscrições
              </span>
              <input
                type="date"
                value={fimInscricoes}
                onChange={(e) => setFimInscricoes(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Início da submissão de trabalho
              </span>
              <input
                type="date"
                value={inicioEnvioTrabalho}
                onChange={(e) => setInicioEnvioTrabalho(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim da submissão de trabalho
              </span>
              <input
                type="date"
                value={fimEnvioTrabalho}
                onChange={(e) => setFimEnvioTrabalho(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <span className="text-xs text-fatec-muted sm:col-span-2">
              Depois dessa data, o aluno não consegue mais enviar um trabalho
              novo pra esse evento.
            </span>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={aceitaExternosNoForm}
              onChange={(e) => setAceitaExternosNoForm(e.target.checked)}
              className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
            />
            <span className="text-sm font-medium text-fatec-navy-900">
              Aceitar inscrição de participantes externos (não alunos da Fatec)
            </span>
          </label>
          </>
          )}

          {faseCriar === 4 && (
          <>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={destaqueNoForm}
              onChange={(e) => setDestaqueNoForm(e.target.checked)}
              className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
            />
            <span className="text-sm font-medium text-fatec-navy-900">
              Marcar como evento em destaque na tela inicial
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Valor da inscrição (R$) <span className="text-fatec-orange-600">*</span>
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={eventoGratuito}
                value={valorInscricao}
                onChange={(e) => setValorInscricao(e.target.value)}
                placeholder="Ex.: 25.00"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:bg-fatec-navy-50 disabled:text-fatec-muted"
              />
              <span className="text-xs text-fatec-muted">
                Com valor definido, o aluno paga (via Asaas) antes de poder
                enviar o trabalho para este evento.
              </span>
            </label>
            <label className="mt-1 flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={eventoGratuito}
                onChange={(e) => {
                  setEventoGratuito(e.target.checked);
                  if (e.target.checked) setValorInscricao("");
                }}
                className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
              />
              <span className="text-sm font-medium text-fatec-navy-900">
                Este evento é gratuito
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-4 border-t border-fatec-line pt-5">
            <p className="text-sm font-semibold text-fatec-navy-900">
              Dados do certificado
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Data de realização
                </span>
                <input
                  type="date"
                  value={dataRealizacao}
                  onChange={(e) => setDataRealizacao(e.target.value)}
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Carga horária (horas)
                </span>
                <input
                  type="number"
                  min="0"
                  value={cargaHoraria}
                  onChange={(e) => setCargaHoraria(e.target.value)}
                  placeholder="Ex.: 4"
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Diretor(a) Acadêmico(a)
                </span>
                <input
                  type="text"
                  value={nomeDiretorAcademico}
                  onChange={(e) => setNomeDiretorAcademico(e.target.value)}
                  placeholder="Nome de quem assina"
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  Coordenador(a) da Pesquisa
                </span>
                <input
                  type="text"
                  value={nomeCoordenadorPesquisa}
                  onChange={(e) => setNomeCoordenadorPesquisa(e.target.value)}
                  placeholder="Nome de quem assina"
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                />
              </label>
            </div>
            <p className="text-xs text-fatec-muted">
              Pode deixar em branco e preencher depois — sem isso, os
              certificados desse evento não podem ser gerados.
            </p>
          </div>
          </>
          )}

          <div className="mt-1 flex items-center justify-between border-t border-fatec-line pt-5">
            {faseCriar > 1 ? (
              <button
                type="button"
                onClick={() => setFaseCriar((f) => (f - 1) as 1 | 2 | 3 | 4)}
                className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                Voltar
              </button>
            ) : (
              <span />
            )}

            {faseCriar < 4 ? (
              <button
                type="button"
                onClick={() => setFaseCriar((f) => (f + 1) as 1 | 2 | 3 | 4)}
                disabled={
                  (faseCriar === 1 && !nome.trim()) ||
                  (faseCriar === 2 && areasTematicasForm.length === 0)
                }
                className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={criarEvento}
                disabled={!nome.trim() || areasTematicasForm.length === 0 || !valorValido || criando}
                className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
              >
                {criando ? "Criando..." : "Criar evento"}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <BannerCropModal
        open={!!bannerParaCortar}
        arquivo={bannerParaCortar}
        onCancel={() => setBannerParaCortar(null)}
        onConfirmar={confirmarCorteBanner}
      />

      {bannerEditEventoId && !bannerEditParaCortar && (
        <Modal
          open
          onClose={() => setBannerEditEventoId(null)}
          title={
            eventos.find((e) => e.id === bannerEditEventoId)?.imagemDestaqueUrl
              ? "Trocar banner do evento"
              : "Adicionar banner do evento"
          }
        >
          <div className="flex flex-col gap-4">
            {eventos.find((e) => e.id === bannerEditEventoId)?.imagemDestaqueUrl && (
              <div className="aspect-[12/5] overflow-hidden rounded-xl border border-fatec-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={eventos.find((e) => e.id === bannerEditEventoId)!.imagemDestaqueUrl!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-fatec-line bg-fatec-navy-50 px-4 py-4 transition-colors hover:border-fatec-sky-600">
              <ImageIcon className="h-5 w-5 flex-none text-fatec-muted" strokeWidth={1.75} />
              <span className="flex flex-col">
                <span className="text-sm text-fatec-muted">Escolher nova imagem</span>
                <span className="text-xs text-fatec-muted/70">
                  Recomendado: pelo menos 2560 × 1067px (proporção 12:5) — dá pra ajustar o enquadramento depois
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={selecionarBannerEdit}
                className="hidden"
              />
            </label>
          </div>
        </Modal>
      )}

      <BannerCropModal
        open={!!bannerEditParaCortar}
        arquivo={bannerEditParaCortar}
        salvando={salvandoBannerEdit}
        onCancel={() => setBannerEditParaCortar(null)}
        onConfirmar={confirmarCorteBannerEdit}
      />

      <AreaComplexaModal
        open={modalAreaComplexa.aberto}
        grupoInicial={modalAreaComplexa.grupo}
        onClose={() => setModalAreaComplexa({ aberto: false, grupo: null })}
        onSalvar={salvarAreaComplexaForm}
        onRemover={
          modalAreaComplexa.grupo
            ? () => removerAreaComplexaForm(modalAreaComplexa.grupo!.id)
            : undefined
        }
      />

      {modalInscritosId && (
        <InscritosEventoModal
          open={!!modalInscritosId}
          eventoId={modalInscritosId}
          eventoNome={eventos.find((e) => e.id === modalInscritosId)?.nome ?? ""}
          onClose={() => setModalInscritosId(null)}
        />
      )}

      {modalInscricaoExtraId && (
        <InscricaoManualModal
          open={!!modalInscricaoExtraId}
          eventoId={modalInscricaoExtraId}
          eventoNome={eventos.find((e) => e.id === modalInscricaoExtraId)?.nome ?? ""}
          user={user}
          onClose={() => setModalInscricaoExtraId(null)}
        />
      )}

      {modalMonitoresId && (
        <MonitoresEventoModal
          open={!!modalMonitoresId}
          eventoId={modalMonitoresId}
          eventoNome={eventos.find((e) => e.id === modalMonitoresId)?.nome ?? ""}
          onClose={() => setModalMonitoresId(null)}
        />
      )}

      <Modal
        open={!!modalConfigId}
        onClose={() => setModalConfigId(null)}
        title="Configurações do evento"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fatec-muted">
            Nome, período de inscrição e período de submissão de trabalho —
            dá pra corrigir aqui a qualquer momento, mesmo depois do evento
            já criado.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nome do evento
            </span>
            <input
              type="text"
              value={nomeConfig}
              onChange={(e) => setNomeConfig(e.target.value)}
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Descrição
            </span>
            <textarea
              rows={3}
              value={descricaoConfig}
              onChange={(e) => setDescricaoConfig(e.target.value)}
              className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 border-t border-fatec-line pt-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Início das inscrições
              </span>
              <input
                type="date"
                value={inicioInscricoesConfig}
                onChange={(e) => setInicioInscricoesConfig(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim das inscrições
              </span>
              <input
                type="date"
                value={fimInscricoesConfig}
                onChange={(e) => setFimInscricoesConfig(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>
          <span className="-mt-3 text-xs text-fatec-muted">
            O prazo de edição do trabalho pelo aluno (23:55 do dia de fim das
            inscrições) é recalculado automaticamente ao salvar.
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Início da submissão de trabalho
              </span>
              <input
                type="date"
                value={inicioEnvioTrabalhoConfig}
                onChange={(e) => setInicioEnvioTrabalhoConfig(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim da submissão de trabalho
              </span>
              <input
                type="date"
                value={fimEnvioTrabalhoConfig}
                onChange={(e) => setFimEnvioTrabalhoConfig(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>
          <span className="-mt-3 text-xs text-fatec-muted">
            Depois dessa data, o aluno não consegue mais enviar um trabalho
            novo pra esse evento.
          </span>
          <button
            type="button"
            onClick={salvarConfig}
            disabled={salvandoConfig || !nomeConfig.trim()}
            className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {salvandoConfig ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!modalCertificadoId}
        onClose={() => setModalCertificadoId(null)}
        title="Dados do certificado"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fatec-muted">
            Usados pra gerar o certificado de apresentação e as declarações de
            avaliador/moderador/orientador desse evento.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Data de realização
              </span>
              <input
                type="date"
                value={dataRealizacaoCert}
                onChange={(e) => setDataRealizacaoCert(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Carga horária (horas)
              </span>
              <input
                type="number"
                min="0"
                value={cargaHorariaCert}
                onChange={(e) => setCargaHorariaCert(e.target.value)}
                placeholder="Ex.: 4"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Diretor(a) Acadêmico(a)
            </span>
            <input
              type="text"
              value={nomeDiretorCert}
              onChange={(e) => setNomeDiretorCert(e.target.value)}
              placeholder="Nome de quem assina"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Coordenador(a) da Pesquisa e Formação Científica
            </span>
            <input
              type="text"
              value={nomeCoordenadorCert}
              onChange={(e) => setNomeCoordenadorCert(e.target.value)}
              placeholder="Nome de quem assina"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>
          <label className="flex flex-col gap-1.5 border-t border-fatec-line pt-4">
            <span className="text-sm font-medium text-fatec-navy-900">
              Número inicial de registro
            </span>
            <input
              type="number"
              min="1"
              value={numeroRegistroInicialCert}
              onChange={(e) => setNumeroRegistroInicialCert(e.target.value)}
              placeholder="Ex.: 15520"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            <span className="text-xs text-fatec-muted">
              Número do primeiro certificado desse evento no &quot;REGISTRO
              SOB O N°&quot; — definido pela comissão. Os próximos saem em
              sequência a partir daqui. Só vale antes do primeiro certificado
              ser emitido; depois disso, mudar aqui não afeta os números já
              usados. Em branco, começa em 1.
            </span>
          </label>
          <button
            type="button"
            onClick={salvarCertificado}
            disabled={salvandoCert}
            className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {salvandoCert ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!modalEduboxId}
        onClose={() => setModalEduboxId(null)}
        title="Lançar alunos no Edubox"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fatec-muted">
            Envia os participantes desse evento pro Edubox. Pode ser usado
            várias vezes durante o período de inscrição — quem já foi
            enviado não é duplicado, mas o status de pagamento é revisado a
            cada envio.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Código do evento no Edubox
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoEduboxForm}
                onChange={(e) => setCodigoEduboxForm(e.target.value)}
                placeholder="Ex.: 2026047"
                className="flex-1 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
              <button
                type="button"
                onClick={salvarCodigoEdubox}
                disabled={salvandoEdubox}
                className="flex-none rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
              >
                {salvandoEdubox ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </label>

          <div className="flex gap-1 border-t border-fatec-line pt-4">
            <button
              type="button"
              onClick={() => setAbaEdubox("enviar")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                abaEdubox === "enviar"
                  ? "bg-fatec-navy-900 text-white"
                  : "text-fatec-muted hover:bg-fatec-navy-50"
              }`}
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={abrirAbaLogs}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                abaEdubox === "logs"
                  ? "bg-fatec-navy-900 text-white"
                  : "text-fatec-muted hover:bg-fatec-navy-50"
              }`}
            >
              Logs
            </button>
          </div>

          {abaEdubox === "enviar" && (
          <div className="flex flex-col gap-3">
            {statusEdubox.status === "carregando" && (
              <p className="flex items-center gap-2 text-sm text-fatec-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                Consultando...
              </p>
            )}
            {statusEdubox.status === "erro" && (
              <p className="text-sm text-rose-700">{statusEdubox.mensagem}</p>
            )}
            {statusEdubox.status === "ok" && (
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl border border-fatec-line px-4 py-3">
                  <p className="text-2xl font-bold text-fatec-navy-900">
                    {statusEdubox.dados.prontos - statusEdubox.dados.jaEnviados > 0
                      ? statusEdubox.dados.prontos - statusEdubox.dados.jaEnviados
                      : 0}
                  </p>
                  <p className="text-xs text-fatec-muted">prontos pra enviar</p>
                </div>
                <div className="flex-1 rounded-xl border border-fatec-line px-4 py-3">
                  <p className="text-2xl font-bold text-fatec-navy-900">
                    {statusEdubox.dados.jaEnviados}
                  </p>
                  <p className="text-xs text-fatec-muted">já enviados</p>
                </div>
                {statusEdubox.dados.pendentesDados > 0 && (
                  <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-2xl font-bold text-amber-800">
                      {statusEdubox.dados.pendentesDados}
                    </p>
                    <p className="text-xs text-amber-700">sem CPF/nascimento</p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={enviarParaEdubox}
              disabled={
                envio.status === "enviando" ||
                statusEdubox.status !== "ok" ||
                statusEdubox.dados.prontos <= 0
              }
              className="flex w-fit items-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
            >
              {envio.status === "enviando" && (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              )}
              Enviar ao Edubox
            </button>
            {envio.status === "enviando" && (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-fatec-navy-100">
                  <div
                    className="h-full rounded-full bg-fatec-orange-500 transition-all duration-300"
                    style={{
                      width: progressoEnvio
                        ? `${Math.round((progressoEnvio.processados / progressoEnvio.total) * 100)}%`
                        : "6%",
                    }}
                  />
                </div>
                <p className="text-xs text-fatec-muted">
                  {progressoEnvio
                    ? `Enviando... ${progressoEnvio.processados} de ${progressoEnvio.total}`
                    : "Conectando ao Edubox..."}
                </p>
              </div>
            )}
            {envio.status === "ok" && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  {envio.enviadosAgora} enviado{envio.enviadosAgora === 1 ? "" : "s"} agora.
                </p>
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  {envio.pagamentosAtualizados} pagamento
                  {envio.pagamentosAtualizados === 1 ? "" : "s"} atualizado
                  {envio.pagamentosAtualizados === 1 ? "" : "s"} (de não pago pra pago).
                </p>
                {envio.falharam > 0 && (
                  <p className="flex items-center gap-1.5 text-sm text-rose-700">
                    <XCircle className="h-4 w-4" strokeWidth={2} />
                    {envio.falharam} falharam. Veja o motivo na aba{" "}
                    <button type="button" onClick={abrirAbaLogs} className="font-semibold underline">
                      Logs
                    </button>
                    .
                  </p>
                )}
              </div>
            )}
            {envio.status === "erro" && (
              <p className="flex items-center gap-1.5 text-sm text-rose-700">
                <XCircle className="h-4 w-4" strokeWidth={2} />
                {envio.mensagem}
              </p>
            )}

          <div className="flex flex-col gap-2 border-t border-fatec-line pt-4">
            <p className="text-sm font-semibold text-fatec-navy-900">
              Conexão com o banco do Edubox
            </p>
            <button
              type="button"
              onClick={testarConexaoEdubox}
              disabled={teste.status === "testando"}
              className="flex w-fit items-center gap-2 rounded-xl bg-fatec-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {teste.status === "testando" && (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              )}
              Testar conexão
            </button>
            {teste.status === "ok" && (
              <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                ✓ {teste.mensagem}
              </p>
            )}
            {teste.status === "erro" && (
              <div className="flex flex-col gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
                <p className="font-medium">✗ {teste.mensagem}</p>
                {teste.explicacao && (
                  <p className="text-xs text-rose-700">{teste.explicacao}</p>
                )}
              </div>
            )}
          </div>
          </div>
          )}

          {abaEdubox === "logs" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-fatec-muted">
                Histórico de envios desse evento (mais recentes primeiro).
              </p>
              <button
                type="button"
                onClick={() => modalEduboxId && carregarLogsEdubox(modalEduboxId)}
                disabled={logsEdubox.status === "carregando"}
                className="text-xs font-semibold text-fatec-sky-600 hover:underline disabled:opacity-60"
              >
                Atualizar
              </button>
            </div>
            {logsEdubox.status === "carregando" && (
              <p className="flex items-center gap-2 text-sm text-fatec-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                Carregando...
              </p>
            )}
            {logsEdubox.status === "erro" && (
              <p className="text-sm text-rose-700">{logsEdubox.mensagem}</p>
            )}
            {logsEdubox.status === "ok" && logsEdubox.itens.length === 0 && (
              <p className="text-sm text-fatec-muted">Ninguém foi enviado ainda.</p>
            )}
            {logsEdubox.status === "ok" && logsEdubox.itens.length > 0 && (
              <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                {logsEdubox.itens.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-4 py-2.5 text-sm ${
                      item.sucesso
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-fatec-navy-900">
                        {item.nome ?? item.uid}
                      </p>
                      <span
                        className={`flex-none text-xs font-semibold ${
                          item.sucesso ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {item.sucesso ? "OK" : "Falhou"}
                      </span>
                    </div>
                    {item.enviadoEm && (
                      <p className="text-xs text-fatec-muted">
                        {item.enviadoEm.toDate().toLocaleString("pt-BR")}
                      </p>
                    )}
                    {item.sucesso ? (
                      <p className="mt-1 text-xs text-emerald-800">
                        {item.jaExistiaInscricao ? "Pagamento revisado" : "Inscrição criada"}
                        {" · pagamento: "}
                        {item.pagoEnviado === true ? "pago" : item.pagoEnviado === false ? "não pago" : "?"}
                        {" · carga horária: "}
                        {item.chpinsEnviado ?? "?"}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-rose-800">{item.mensagem}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </Modal>
    </main>
  );
}
