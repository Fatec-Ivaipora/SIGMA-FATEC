"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  documentId,
  getDocs,
  query,
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
  { numero: 3, label: "Inscrições e avaliação" },
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

function CardEventoAdmin({
  evento,
  totalTrabalhos,
  onMarcarDestaque,
  onAlternarAceitaExternos,
  onAbrirInscritos,
  onInscricaoExtra,
  onConfigurarCertificado,
  onAbrirEdubox,
  onAbrirMonitores,
  onAbrirBanner,
}: {
  evento: Evento;
  totalTrabalhos: number;
  onMarcarDestaque: () => void;
  onAlternarAceitaExternos: () => void;
  onAbrirInscritos: () => void;
  onInscricaoExtra: () => void;
  onConfigurarCertificado: () => void;
  onAbrirEdubox?: () => void;
  onAbrirMonitores: () => void;
  onAbrirBanner: () => void;
}) {
  const temTaxa = !!evento.valorInscricao;
  const { inscritos } = useInscritosDoEvento(temTaxa ? evento.id : undefined);
  const inscritosPagos = inscritos.filter((i) => i.status === "pago").length;

  const periodo = [
    evento.periodoSubmissao && `Inscrições: ${evento.periodoSubmissao}`,
    evento.periodoAvaliacao && `Avaliação: ${evento.periodoAvaliacao}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
          {periodo && <p className="text-sm text-fatec-muted">{periodo}</p>}
        </div>
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {!evento.destaque && (
          <AcaoEvento icone={Star} cor="navy" label="Marcar destaque" onClick={onMarcarDestaque} />
        )}
        <AcaoEvento
          icone={Globe}
          cor="navy"
          label={evento.aceitaExternos ? "Não aceitar externos" : "Aceitar externos"}
          onClick={onAlternarAceitaExternos}
        />
        {temTaxa && (
          <AcaoEvento icone={Ticket} cor="navy" label="Inscrição extra" onClick={onInscricaoExtra} />
        )}
        <AcaoEvento
          icone={ImageIcon}
          cor="navy"
          label={evento.imagemDestaqueUrl ? "Trocar banner" : "Adicionar banner"}
          onClick={onAbrirBanner}
        />
        <AcaoEvento icone={Tag} cor="navy" label="Áreas temáticas" href="/areas-tematicas" />
        <AcaoEvento icone={UserCog} cor="navy" label="Monitores" onClick={onAbrirMonitores} />
        <AcaoEvento
          icone={certificadoConfigurado ? Award : AlertTriangle}
          cor={certificadoConfigurado ? "navy" : "amber"}
          label={certificadoConfigurado ? "Certificado" : "Configurar certificado"}
          onClick={onConfigurarCertificado}
        />
        {onAbrirEdubox && (
          <AcaoEvento
            icone={evento.codigoEdubox ? Send : AlertTriangle}
            cor={evento.codigoEdubox ? "navy" : "amber"}
            label={evento.codigoEdubox ? "Edubox" : "Configurar Edubox"}
            onClick={onAbrirEdubox}
          />
        )}
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
  const [inicioAvaliacao, setInicioAvaliacao] = useState("");
  const [fimAvaliacao, setFimAvaliacao] = useState("");
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
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [nomeDiretorAcademico, setNomeDiretorAcademico] = useState("");
  const [nomePresidenteComissao, setNomePresidenteComissao] = useState("");
  const [criando, setCriando] = useState(false);

  const [modalCertificadoId, setModalCertificadoId] = useState<string | null>(null);
  const [dataRealizacaoCert, setDataRealizacaoCert] = useState("");
  const [cargaHorariaCert, setCargaHorariaCert] = useState("");
  const [nomeDiretorCert, setNomeDiretorCert] = useState("");
  const [nomePresidenteCert, setNomePresidenteCert] = useState("");
  const [salvandoCert, setSalvandoCert] = useState(false);

  const [modalEduboxId, setModalEduboxId] = useState<string | null>(null);
  const [codigoEduboxForm, setCodigoEduboxForm] = useState("");
  const [salvandoEdubox, setSalvandoEdubox] = useState(false);
  const [cpfPorUid, setCpfPorUid] = useState<Record<string, string | undefined>>({});
  const [carregandoCpfs, setCarregandoCpfs] = useState(false);
  const [teste, setTeste] = useState<
    | { status: "idle" }
    | { status: "testando" }
    | { status: "ok"; mensagem: string }
    | { status: "erro"; mensagem: string; explicacao: string }
  >({ status: "idle" });

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
    setInicioAvaliacao("");
    setFimAvaliacao("");
    setAreasTematicasForm([]);
    setNovaAreaForm("");
    setAreasComplexasForm([]);
    setDestaqueNoForm(false);
    setAceitaExternosNoForm(false);
    setValorInscricao("");
    setDataRealizacao("");
    setCargaHoraria("");
    setNomeDiretorAcademico("");
    setNomePresidenteComissao("");
    setFaseCriar(1);
  }

  function abrirModalCertificado(evento: Evento) {
    setModalCertificadoId(evento.id);
    setDataRealizacaoCert(evento.dataRealizacao ?? "");
    setCargaHorariaCert(evento.cargaHoraria?.toString() ?? "");
    setNomeDiretorCert(evento.nomeDiretorAcademico ?? "");
    setNomePresidenteCert(evento.nomePresidenteComissao ?? "");
  }

  async function salvarCertificado() {
    if (!modalCertificadoId) return;
    setSalvandoCert(true);
    try {
      await updateDoc(doc(db, "eventos", modalCertificadoId), {
        dataRealizacao: dataRealizacaoCert || null,
        cargaHoraria: cargaHorariaCert.trim() ? Number(cargaHorariaCert) : null,
        nomeDiretorAcademico: nomeDiretorCert.trim(),
        nomePresidenteComissao: nomePresidenteCert.trim(),
      });
      setModalCertificadoId(null);
    } finally {
      setSalvandoCert(false);
    }
  }

  const participantesDoEventoEdubox = useMemo(() => {
    if (!modalEduboxId) return [];
    const mapa = new Map<string, string>();
    for (const t of trabalhos) {
      if (t.eventoId !== modalEduboxId || t.status !== "aceito") continue;
      mapa.set(t.alunoUid, t.alunoNome);
      (t.participantesUids ?? []).forEach((uid, i) => {
        mapa.set(uid, t.participantesNomes?.[i] ?? uid);
      });
    }
    return Array.from(mapa, ([uid, nome]) => ({ uid, nome }));
  }, [trabalhos, modalEduboxId]);

  useEffect(() => {
    if (participantesDoEventoEdubox.length === 0) return;
    const uids = participantesDoEventoEdubox.map((p) => p.uid);
    // "in" do Firestore aceita no máximo 30 valores por consulta — evento
    // típico não deve passar disso, mas divide em blocos por segurança.
    const blocos: string[][] = [];
    for (let i = 0; i < uids.length; i += 30) blocos.push(uids.slice(i, i + 30));

    async function buscarCpfs() {
      setCarregandoCpfs(true);
      try {
        const snaps = await Promise.all(
          blocos.map((bloco) =>
            getDocs(query(collection(db, "usuarios"), where(documentId(), "in", bloco))),
          ),
        );
        const mapa: Record<string, string | undefined> = {};
        snaps.forEach((snap) =>
          snap.forEach((d) => {
            mapa[d.id] = d.data().cpf;
          }),
        );
        setCpfPorUid(mapa);
      } finally {
        setCarregandoCpfs(false);
      }
    }

    void buscarCpfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEduboxId]);

  async function abrirModalEdubox(evento: Evento) {
    setModalEduboxId(evento.id);
    setCodigoEduboxForm(evento.codigoEdubox ?? "");
    setTeste({ status: "idle" });
    setCpfPorUid({});
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

  async function criarEvento() {
    if (!nome.trim() || areasTematicasForm.length === 0) return;
    setCriando(true);
    try {
      const eventoRef = await addDoc(collection(db, "eventos"), {
        nome: nome.trim(),
        descricao: descricao.trim(),
        periodoSubmissao:
          inicioInscricoes && fimInscricoes
            ? `${formatarData(inicioInscricoes)} — ${formatarData(fimInscricoes)}`
            : "",
        periodoAvaliacao:
          inicioAvaliacao && fimAvaliacao
            ? `${formatarData(inicioAvaliacao)} — ${formatarData(fimAvaliacao)}`
            : "",
        destaque: destaqueNoForm,
        aceitaExternos: aceitaExternosNoForm,
        areasTematicas: areasTematicasForm,
        ...(areasComplexasForm.length > 0
          ? { areasTematicasComplexas: areasComplexasForm }
          : {}),
        ...(valorInscricao.trim() ? { valorInscricao: Number(valorInscricao) } : {}),
        ...(dataRealizacao ? { dataRealizacao } : {}),
        ...(cargaHoraria.trim() ? { cargaHoraria: Number(cargaHoraria) } : {}),
        ...(nomeDiretorAcademico.trim()
          ? { nomeDiretorAcademico: nomeDiretorAcademico.trim() }
          : {}),
        ...(nomePresidenteComissao.trim()
          ? { nomePresidenteComissao: nomePresidenteComissao.trim() }
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

      <div className="flex flex-1 flex-col overflow-x-hidden">
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
                onConfigurarCertificado={() => abrirModalCertificado(evento)}
                onAbrirEdubox={
                  perfil.papel === "admin" ? () => abrirModalEdubox(evento) : undefined
                }
                onAbrirMonitores={() => setModalMonitoresId(evento.id)}
                onAbrirBanner={() => setBannerEditEventoId(evento.id)}
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
                <span className="text-sm text-fatec-muted">
                  Escolher imagem (usada no banner de destaque da home)
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
                Início das avaliações
              </span>
              <input
                type="date"
                value={inicioAvaliacao}
                onChange={(e) => setInicioAvaliacao(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim das avaliações
              </span>
              <input
                type="date"
                value={fimAvaliacao}
                onChange={(e) => setFimAvaliacao(e.target.value)}
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Valor da inscrição (R$)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorInscricao}
              onChange={(e) => setValorInscricao(e.target.value)}
              placeholder="Deixe em branco para evento gratuito"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            <span className="text-xs text-fatec-muted">
              Com valor definido, o aluno paga (via Asaas) antes de poder
              enviar o trabalho para este evento.
            </span>
          </label>

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
                  Presidente da Comissão
                </span>
                <input
                  type="text"
                  value={nomePresidenteComissao}
                  onChange={(e) => setNomePresidenteComissao(e.target.value)}
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
                disabled={!nome.trim() || areasTematicasForm.length === 0 || criando}
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
              <span className="text-sm text-fatec-muted">Escolher nova imagem</span>
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
              Presidente da Comissão Organizadora
            </span>
            <input
              type="text"
              value={nomePresidenteCert}
              onChange={(e) => setNomePresidenteCert(e.target.value)}
              placeholder="Nome de quem assina"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
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
            Lança os participantes desse evento no Edubox. Isso ainda depende
            de infraestrutura que não temos (ver aviso abaixo) — essa tela
            existe pra deixar pronto o que já dá pra preparar.
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
            <span className="text-xs text-fatec-muted">
              Hoje precisa ser digitado à mão (buscar automaticamente no banco
              do Edubox depende da mesma conexão testada abaixo).
            </span>
          </label>

          <div className="flex flex-col gap-2 border-t border-fatec-line pt-4">
            <p className="text-sm font-semibold text-fatec-navy-900">
              Participantes com resultado aceito ({participantesDoEventoEdubox.length})
            </p>
            {participantesDoEventoEdubox.length === 0 ? (
              <p className="text-sm text-fatec-muted">
                Nenhum trabalho aceito nesse evento ainda.
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {participantesDoEventoEdubox.map((p) => {
                  const cpf = cpfPorUid[p.uid];
                  return (
                    <div
                      key={p.uid}
                      className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-3 py-2"
                    >
                      <span className="truncate text-sm text-fatec-navy-900">{p.nome}</span>
                      {carregandoCpfs ? (
                        <Loader2
                          className="h-3.5 w-3.5 flex-none animate-spin text-fatec-muted"
                          strokeWidth={1.75}
                        />
                      ) : cpf ? (
                        <span className="inline-flex flex-none items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                          CPF ok
                        </span>
                      ) : (
                        <span className="inline-flex flex-none items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <XCircle className="h-3 w-3" strokeWidth={2} />
                          CPF pendente
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              O CPF só fica salvo pra quem já pagou uma inscrição pelo Asaas —
              em eventos gratuitos vai faltar pra todo mundo. Data de
              nascimento (também exigida pelo Edubox) ainda não é coletada em
              nenhum lugar do sistema. Os dois precisam entrar no cadastro
              antes do lançamento automático funcionar de verdade.
            </p>
          </div>

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
      </Modal>
    </main>
  );
}
