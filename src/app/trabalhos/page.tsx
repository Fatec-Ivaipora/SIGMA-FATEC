"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge, type TrabalhoStatus } from "@/components/StatusBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";

const EVENTOS = ["Todos os eventos", "MAC 2026", "MOPI 2026", "MAC 2025"];

const STATUS_FILTROS: { label: string; status: TrabalhoStatus | "todos" }[] = [
  { label: "Todos", status: "todos" },
  { label: "Aguardando orientador", status: "aguardando_orientador" },
  { label: "Aguardando avaliação", status: "aguardando_avaliacao" },
  { label: "Avaliado", status: "avaliado" },
  { label: "Correção solicitada", status: "aceito_com_correcao" },
  { label: "Aceito", status: "aceito" },
  { label: "Recusado", status: "nao_aceito" },
];

const TRABALHOS: {
  titulo: string;
  aluno: string;
  evento: string;
  status: TrabalhoStatus;
  avaliador: string;
  atualizado: string;
}[] = [
  {
    titulo: "Otimização de rotas com algoritmos genéticos",
    aluno: "Beatriz Nogueira",
    evento: "MAC 2026",
    status: "aguardando_avaliacao",
    avaliador: "Prof. Renato Alves",
    atualizado: "há 2 horas",
  },
  {
    titulo: "Painel solar de baixo custo para propriedades rurais",
    aluno: "Elaine Souza",
    evento: "MAC 2026",
    status: "avaliado",
    avaliador: "Prof. Renato Alves",
    atualizado: "há 3 horas",
  },
  {
    titulo: "Detecção de pragas em lavouras via visão computacional",
    aluno: "João Pedro Salles",
    evento: "MOPI 2026",
    status: "aceito_com_correcao",
    avaliador: "Profa. Camila Duarte",
    atualizado: "há 5 horas",
  },
  {
    titulo: "Automação residencial de baixo custo com IoT",
    aluno: "Larissa Mendes",
    evento: "MAC 2026",
    status: "aguardando_orientador",
    avaliador: "—",
    atualizado: "há 1 dia",
  },
  {
    titulo: "Sensor de umidade para hortas comunitárias",
    aluno: "Tiago Ramos",
    evento: "MOPI 2026",
    status: "aguardando_orientador",
    avaliador: "—",
    atualizado: "há 1 dia",
  },
  {
    titulo: "Análise preditiva de evasão escolar",
    aluno: "Gabriel Torres",
    evento: "MAC 2026",
    status: "aceito",
    avaliador: "Prof. Marcos Vinícius",
    atualizado: "há 2 dias",
  },
  {
    titulo: "App de gestão para pequenos produtores rurais",
    aluno: "Juliana Prado",
    evento: "MAC 2026",
    status: "aguardando_avaliacao",
    avaliador: "Prof. Renato Alves",
    atualizado: "há 2 dias",
  },
  {
    titulo: "Sistema de gestão para hortas comunitárias",
    aluno: "Fernanda Lima",
    evento: "MOPI 2026",
    status: "nao_aceito",
    avaliador: "Profa. Camila Duarte",
    atualizado: "há 3 dias",
  },
  {
    titulo: "Aplicativo de apoio à agricultura familiar",
    aluno: "Gabriel Torres",
    evento: "MAC 2025",
    status: "aceito",
    avaliador: "Prof. Marcos Vinícius",
    atualizado: "há 3 meses",
  },
];

export default function TrabalhosAdminPage() {
  const [busca, setBusca] = useState("");
  const [evento, setEvento] = useState(EVENTOS[0]);
  const [statusFiltro, setStatusFiltro] = useState<TrabalhoStatus | "todos">(
    "todos",
  );

  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return TRABALHOS.filter((t) => {
      const bateEvento = evento === EVENTOS[0] || t.evento === evento;
      const bateStatus = statusFiltro === "todos" || t.status === statusFiltro;
      const bateBusca =
        !termo ||
        t.titulo.toLowerCase().includes(termo) ||
        t.aluno.toLowerCase().includes(termo);
      return bateEvento && bateStatus && bateBusca;
    });
  }, [busca, evento, statusFiltro]);

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/trabalhos"
        userName="Ana Carolina"
        userRoleLabel="Organização"
        userInitials="AC"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            Todos os trabalhos inscritos nos eventos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
              <Search
                className="h-4 w-4 flex-none text-fatec-muted"
                strokeWidth={1.75}
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título ou nome do aluno"
                className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
              />
            </div>

            <div className="relative">
              <select
                value={evento}
                onChange={(e) => setEvento(e.target.value)}
                className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
              >
                {EVENTOS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                strokeWidth={1.75}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1 rounded-xl bg-fatec-navy-50 p-1">
            {STATUS_FILTROS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setStatusFiltro(f.status)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  statusFiltro === f.status
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    <th className="px-6 py-3 font-semibold">Trabalho</th>
                    <th className="px-6 py-3 font-semibold">Evento</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Avaliador</th>
                    <th className="px-6 py-3 font-semibold">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {trabalhosFiltrados.map((t) => (
                    <tr
                      key={t.titulo}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      <td className="max-w-[320px] px-6 py-4 align-top">
                        <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                          {t.titulo}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-fatec-muted">
                          {t.aluno}
                        </p>
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {t.evento}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {t.avaliador}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 align-top text-fatec-muted">
                        {t.atualizado}
                      </td>
                    </tr>
                  ))}

                  {trabalhosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-fatec-muted"
                      >
                        Nenhum trabalho encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
