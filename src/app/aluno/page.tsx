"use client";

import { useState } from "react";
import {
  LayoutGrid,
  FileStack,
  Award,
  CalendarDays,
  Plus,
  X,
  Search,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";

const NAV_ALUNO = [
  { label: "Painel", href: "/aluno", icon: LayoutGrid },
  { label: "Trabalhos", href: "/aluno/trabalhos", icon: FileStack },
  { label: "Certificações", href: "/aluno/certificacoes", icon: Award },
];

const EVENTOS_ATIVOS = [
  {
    id: "mac-2026",
    nome: "MAC 2026",
    periodo: "Inscrições até 20 de outubro",
  },
  {
    id: "mopi-2026",
    nome: "MOPI 2026",
    periodo: "Inscrições até 5 de novembro",
  },
];

const EU_MESMO = {
  nome: "Beatriz Nogueira",
  email: "beatriz.nogueira@aluno.fatecivaipora.com.br",
};

type Pessoa = { nome: string; email: string };

const RESUMO_MAX = 2000;

export default function AlunoPainelPage() {
  const [modalEventoId, setModalEventoId] = useState<string | null>(null);
  const [inscricoes, setInscricoes] = useState<Record<string, boolean>>({});

  const [participantes, setParticipantes] = useState<Pessoa[]>([]);
  const [orientador, setOrientador] = useState<Pessoa | null>(null);
  const [resumo, setResumo] = useState("");

  const eventoModal = EVENTOS_ATIVOS.find((e) => e.id === modalEventoId);

  function fecharModal() {
    setModalEventoId(null);
  }

  function enviarTrabalho() {
    if (modalEventoId) {
      setInscricoes((prev) => ({ ...prev, [modalEventoId]: true }));
    }
    setParticipantes([]);
    setOrientador(null);
    setResumo("");
    fecharModal();
  }

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ALUNO}
        activeHref="/aluno"
        userName="Beatriz Nogueira"
        userRoleLabel="Aluno"
        userInitials="BN"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Bem-vinda, Beatriz
          </h1>
          <p className="text-sm text-fatec-muted">
            Acompanhe os eventos abertos e inscreva seu trabalho.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <section>
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Eventos abertos para inscrição
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EVENTOS_ATIVOS.map((evento) => {
                const inscrito = !!inscricoes[evento.id];
                return (
                  <div
                    key={evento.id}
                    className="flex flex-col items-start gap-3 rounded-2xl border border-fatec-line bg-white p-5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                      <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="font-semibold text-fatec-navy-900">
                        {evento.nome}
                      </p>
                      <p className="text-sm text-fatec-muted">
                        {evento.periodo}
                      </p>
                    </div>

                    {inscrito ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Inscrição feita
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModalEventoId(evento.id)}
                        className="rounded-full bg-fatec-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                      >
                        Inscrever trabalho
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={!!eventoModal}
        onClose={fecharModal}
        title={`Inscrever trabalho — ${eventoModal?.nome ?? ""}`}
      >
        <p className="-mt-2 mb-5 text-sm text-fatec-muted">
          Categorias do evento: a definir pela organização.
        </p>

        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Título do trabalho
            </span>
            <input
              type="text"
              placeholder="Ex.: Otimização de rotas com algoritmos genéticos"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fatec-navy-900">
              Palavras-chave
            </span>
            <input
              type="text"
              placeholder="Ex.: logística, otimização, algoritmos genéticos"
              className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
            />
            <span className="text-xs text-fatec-muted">
              Separe por vírgula.
            </span>
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

          <div>
            <span className="text-sm font-medium text-fatec-navy-900">
              Participantes
            </span>

            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-xl border border-fatec-line bg-fatec-navy-50 px-4 py-2.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-navy-800 text-xs font-semibold text-white">
                  BN
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fatec-navy-900">
                    {EU_MESMO.nome}{" "}
                    <span className="font-normal text-fatec-muted">
                      (você)
                    </span>
                  </p>
                  <p className="truncate text-xs text-fatec-muted">
                    {EU_MESMO.email}
                  </p>
                </div>
              </div>

              {participantes.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-fatec-line px-3 py-2"
                >
                  <Search
                    className="h-4 w-4 flex-none text-fatec-muted"
                    strokeWidth={1.75}
                  />
                  <input
                    defaultValue={p.nome}
                    placeholder="Buscar aluno por nome ou e-mail"
                    className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Remover participante"
                    onClick={() =>
                      setParticipantes((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setParticipantes((prev) => [...prev, { nome: "", email: "" }])
              }
              className="mt-2 flex w-fit items-center gap-1.5 text-sm font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Adicionar participante
            </button>
          </div>

          <div>
            <span className="text-sm font-medium text-fatec-navy-900">
              Orientador <span className="text-fatec-orange-600">*</span>
            </span>
            <p className="mt-0.5 text-xs text-fatec-muted">
              Obrigatório. Precisa aprovar o trabalho antes da avaliação.
            </p>

            <div className="mt-2 flex items-center gap-2 rounded-xl border border-fatec-line px-3 py-2">
              <UserRound
                className="h-4 w-4 flex-none text-fatec-muted"
                strokeWidth={1.75}
              />
              <input
                required
                defaultValue={orientador?.nome ?? ""}
                onChange={(e) =>
                  setOrientador({ nome: e.target.value, email: "" })
                }
                placeholder="Buscar entre avaliadores e alunos"
                className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={enviarTrabalho}
            className="mt-2 w-fit rounded-xl bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            Enviar trabalho
          </button>
        </div>
      </Modal>
    </main>
  );
}
