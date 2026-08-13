import {
  ChevronDown,
  Download,
  UserCheck,
  ClipboardCheck,
  FileClock,
  BadgeCheck,
  BadgeX,
  Clock,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge, type TrabalhoStatus } from "@/components/StatusBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";

const STATS: {
  label: string;
  value: number;
  icon: typeof UserCheck;
  accent: string;
}[] = [
  {
    label: "Aguardando orientador",
    value: 18,
    icon: UserCheck,
    accent: "text-fatec-sky-600 bg-fatec-sky-100",
  },
  {
    label: "Aguardando avaliação",
    value: 42,
    icon: FileClock,
    accent: "text-fatec-navy-800 bg-fatec-navy-100",
  },
  {
    label: "Correção solicitada",
    value: 9,
    icon: ClipboardCheck,
    accent: "text-fatec-orange-600 bg-fatec-orange-100",
  },
  {
    label: "Aceitos",
    value: 156,
    icon: BadgeCheck,
    accent: "text-emerald-700 bg-emerald-50",
  },
  {
    label: "Recusados",
    value: 11,
    icon: BadgeX,
    accent: "text-rose-700 bg-rose-50",
  },
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
    titulo: "Análise preditiva de evasão escolar",
    aluno: "Gabriel Torres",
    evento: "MAC 2026",
    status: "aceito",
    avaliador: "Prof. Marcos Vinícius",
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
];

export default function DashboardPage() {
  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/dashboard"
        userName="Ana Carolina"
        userRoleLabel="Organização"
        userInitials="AC"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Bem-vinda, Ana
            </h1>
            <p className="text-sm text-fatec-muted">
              Acompanhe as submissões e o andamento das avaliações.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50">
              MAC 2026
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600">
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Exportar relatório (PDF)
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {STATS.map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className="rounded-2xl border border-fatec-line bg-white p-5"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                  {value}
                </p>
                <p className="text-sm text-fatec-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
            <div className="overflow-hidden rounded-2xl border border-fatec-line bg-white">
              <div className="flex items-center justify-between border-b border-fatec-line px-6 py-4">
                <h2 className="text-base font-semibold text-fatec-navy-900">
                  Trabalhos recentes
                </h2>
                <a
                  href="#"
                  className="text-sm font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
                >
                  Ver todos
                </a>
              </div>

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
                    {TRABALHOS.map((t) => (
                      <tr
                        key={t.titulo}
                        className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                      >
                        <td className="max-w-[280px] px-6 py-4 align-top">
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
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-6">
              <div className="flex items-center gap-2">
                <Clock
                  className="h-4.5 w-4.5 text-fatec-orange-500"
                  strokeWidth={1.75}
                />
                <h2 className="text-base font-semibold text-fatec-navy-900">
                  Prazos de correção
                </h2>
              </div>

              <ul className="flex flex-col gap-4">
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fatec-navy-900">
                      Detecção de pragas em lavouras...
                    </p>
                    <p className="text-xs text-fatec-muted">
                      João Pedro Salles
                    </p>
                  </div>
                  <span className="flex-none rounded-full bg-fatec-orange-100 px-2.5 py-1 text-xs font-semibold text-fatec-orange-600">
                    vence em 2 dias
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fatec-navy-900">
                      Sensor de umidade para hortas...
                    </p>
                    <p className="text-xs text-fatec-muted">Tiago Ramos</p>
                  </div>
                  <span className="flex-none rounded-full bg-fatec-orange-100 px-2.5 py-1 text-xs font-semibold text-fatec-orange-600">
                    vence em 4 dias
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fatec-navy-900">
                      Painel solar de baixo custo...
                    </p>
                    <p className="text-xs text-fatec-muted">Elaine Souza</p>
                  </div>
                  <span className="flex-none rounded-full bg-fatec-navy-100 px-2.5 py-1 text-xs font-semibold text-fatec-navy-800">
                    vence em 6 dias
                  </span>
                </li>
              </ul>

              <a
                href="#"
                className="mt-1 text-sm font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Ver todos os prazos
              </a>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
