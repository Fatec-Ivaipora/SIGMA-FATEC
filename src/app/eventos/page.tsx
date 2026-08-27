"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  Star,
  FileStack,
  Tag,
  Image as ImageIcon,
  Globe,
  Users,
} from "lucide-react";
import { addDoc, collection, doc, updateDoc, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { InscritosEventoModal } from "@/components/InscritosEventoModal";
import { InscricaoManualModal } from "@/components/InscricaoManualModal";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos, type Evento } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { useInscritosDoEvento } from "@/lib/data/inscricoes";

function formatarData(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CardEventoAdmin({
  evento,
  totalTrabalhos,
  onMarcarDestaque,
  onAlternarAceitaExternos,
  onAbrirInscritos,
  onInscricaoExtra,
}: {
  evento: Evento;
  totalTrabalhos: number;
  onMarcarDestaque: () => void;
  onAlternarAceitaExternos: () => void;
  onAbrirInscritos: () => void;
  onInscricaoExtra: () => void;
}) {
  const temTaxa = !!evento.valorInscricao;
  const { inscritos } = useInscritosDoEvento(temTaxa ? evento.id : undefined);

  const periodo = [
    evento.periodoSubmissao && `Inscrições: ${evento.periodoSubmissao}`,
    evento.periodoAvaliacao && `Avaliação: ${evento.periodoAvaliacao}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fatec-line pt-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fatec-muted">
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
              {inscritos.length} inscritos
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!evento.destaque && (
            <button
              type="button"
              onClick={onMarcarDestaque}
              className="rounded-lg border border-fatec-line px-2.5 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
            >
              Marcar destaque
            </button>
          )}
          <button
            type="button"
            onClick={onAlternarAceitaExternos}
            className="rounded-lg border border-fatec-line px-2.5 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            {evento.aceitaExternos ? "Não aceitar externos" : "Aceitar externos"}
          </button>
          {temTaxa && (
            <button
              type="button"
              onClick={onInscricaoExtra}
              className="rounded-lg border border-fatec-line px-2.5 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
            >
              Inscrição extra
            </button>
          )}
          <Link
            href="/areas-tematicas"
            className="rounded-lg border border-fatec-line px-2.5 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Áreas temáticas
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EventosPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  const [modalCriar, setModalCriar] = useState(false);
  const [modalInscritosId, setModalInscritosId] = useState<string | null>(null);
  const [modalInscricaoExtraId, setModalInscricaoExtraId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [inicioInscricoes, setInicioInscricoes] = useState("");
  const [fimInscricoes, setFimInscricoes] = useState("");
  const [inicioAvaliacao, setInicioAvaliacao] = useState("");
  const [fimAvaliacao, setFimAvaliacao] = useState("");
  const [destaqueNoForm, setDestaqueNoForm] = useState(false);
  const [aceitaExternosNoForm, setAceitaExternosNoForm] = useState(false);
  const [valorInscricao, setValorInscricao] = useState("");
  const [criando, setCriando] = useState(false);

  const trabalhosPorEvento = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of trabalhos) mapa.set(t.eventoId, (mapa.get(t.eventoId) ?? 0) + 1);
    return mapa;
  }, [trabalhos]);

  function fecharCriar() {
    setModalCriar(false);
    setNome("");
    setDescricao("");
    setBanner(null);
    setBannerPreviewUrl(null);
    setInicioInscricoes("");
    setFimInscricoes("");
    setInicioAvaliacao("");
    setFimAvaliacao("");
    setDestaqueNoForm(false);
    setAceitaExternosNoForm(false);
    setValorInscricao("");
  }

  function selecionarBanner(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setBanner(file);
    if (!file) {
      setBannerPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBannerPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
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
    if (!nome.trim()) return;
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
        areasTematicas: [],
        ...(valorInscricao.trim() ? { valorInscricao: Number(valorInscricao) } : {}),
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
          <div className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
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

      <Modal open={modalCriar} onClose={fecharCriar} title="Criar evento">
        <form className="flex flex-col gap-5">
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
              <div className="relative overflow-hidden rounded-xl border border-fatec-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerPreviewUrl}
                  alt=""
                  className="h-32 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBanner(null);
                    setBannerPreviewUrl(null);
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/80"
                >
                  Remover
                </button>
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

          <button
            type="button"
            onClick={criarEvento}
            disabled={!nome.trim() || criando}
            className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {criando ? "Criando..." : "Criar evento"}
          </button>
        </form>
      </Modal>

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
    </main>
  );
}
