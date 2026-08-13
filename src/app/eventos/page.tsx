"use client";

import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Star,
  Users,
  FileStack,
  Image as ImageIcon,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { NAV_ADMIN } from "@/lib/navAdmin";

type Evento = {
  id: string;
  nome: string;
  periodoSubmissao: string;
  periodoAvaliacao: string;
  prazoCorrecaoDias: number;
  destaque: boolean;
  avaliadoresInscritos: number;
  trabalhos: number;
};

const EVENTOS_INICIAL: Evento[] = [
  {
    id: "mac-2026",
    nome: "MAC 2026",
    periodoSubmissao: "1 de agosto — 20 de outubro de 2026",
    periodoAvaliacao: "até 15 de novembro de 2026",
    prazoCorrecaoDias: 7,
    destaque: true,
    avaliadoresInscritos: 12,
    trabalhos: 68,
  },
  {
    id: "mopi-2026",
    nome: "MOPI 2026",
    periodoSubmissao: "1 de setembro — 5 de novembro de 2026",
    periodoAvaliacao: "até 30 de novembro de 2026",
    prazoCorrecaoDias: 5,
    destaque: false,
    avaliadoresInscritos: 6,
    trabalhos: 24,
  },
  {
    id: "mac-2025",
    nome: "MAC 2025",
    periodoSubmissao: "encerrado em 20 de outubro de 2025",
    periodoAvaliacao: "encerrado em 18 de novembro de 2025",
    prazoCorrecaoDias: 7,
    destaque: false,
    avaliadoresInscritos: 9,
    trabalhos: 54,
  },
];

export default function EventosPage() {
  const [eventos, setEventos] = useState(EVENTOS_INICIAL);
  const [modalCriar, setModalCriar] = useState(false);
  const [destaqueNoForm, setDestaqueNoForm] = useState(false);

  function marcarDestaque(id: string) {
    setEventos((prev) =>
      prev.map((e) => ({ ...e, destaque: e.id === id })),
    );
  }

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/eventos"
        userName="Ana Carolina"
        userRoleLabel="Organização"
        userInitials="AC"
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

          <button
            type="button"
            onClick={() => setModalCriar(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Criar evento
          </button>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-4">
            {eventos.map((evento) => (
              <div
                key={evento.id}
                className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                    <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-fatec-navy-900">
                        {evento.nome}
                      </p>
                      {evento.destaque && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fatec-orange-100 px-2.5 py-0.5 text-xs font-semibold text-fatec-orange-600">
                          <Star className="h-3 w-3" strokeWidth={2} />
                          Destaque
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-fatec-muted">
                      Inscrições: {evento.periodoSubmissao}
                    </p>
                    <p className="text-sm text-fatec-muted">
                      Avaliação: {evento.periodoAvaliacao} · correção em até{" "}
                      {evento.prazoCorrecaoDias} dias
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fatec-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <FileStack className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {evento.trabalhos} trabalhos
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {evento.avaliadoresInscritos} avaliadores inscritos
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-none items-center gap-2">
                  {!evento.destaque && (
                    <button
                      type="button"
                      onClick={() => marcarDestaque(evento.id)}
                      className="rounded-lg border border-fatec-line px-3.5 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      Marcar como destaque
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-fatec-line px-3.5 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={modalCriar}
        onClose={() => setModalCriar(false)}
        title="Criar evento"
      >
        <form className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Nome do evento
            </span>
            <input
              type="text"
              placeholder="Ex.: MAC 2027"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Início das inscrições
              </span>
              <input
                type="date"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Fim das inscrições
              </span>
              <input
                type="date"
                className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Fim do período de avaliação
            </span>
            <input
              type="date"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Prazo padrão de correção (dias)
            </span>
            <input
              type="number"
              min={1}
              placeholder="Ex.: 7"
              className="w-32 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

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

          {destaqueNoForm && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Imagem de destaque
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-fatec-line bg-fatec-navy-50 px-4 py-4">
                <ImageIcon
                  className="h-5 w-5 flex-none text-fatec-muted"
                  strokeWidth={1.75}
                />
                <span className="text-sm text-fatec-muted">
                  Clique para enviar uma imagem (JPG ou PNG)
                </span>
                <input type="file" accept="image/*" className="hidden" />
              </div>
            </label>
          )}

          <button
            type="button"
            onClick={() => setModalCriar(false)}
            className="mt-1 w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            Criar evento
          </button>
        </form>
      </Modal>
    </main>
  );
}
