import { LayoutGrid, FileStack, Award } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge, type TrabalhoStatus } from "@/components/StatusBadge";

const NAV_ALUNO = [
  { label: "Painel", href: "/aluno", icon: LayoutGrid },
  { label: "Trabalhos", href: "/aluno/trabalhos", icon: FileStack },
  { label: "Certificações", href: "/aluno/certificacoes", icon: Award },
];

const MEUS_TRABALHOS: {
  ano: number;
  evento: string;
  titulo: string;
  status: TrabalhoStatus;
}[] = [
  {
    ano: 2026,
    evento: "MAC 2026",
    titulo: "Otimização de rotas com algoritmos genéticos",
    status: "aguardando_avaliacao",
  },
  {
    ano: 2025,
    evento: "MOPI 2025",
    titulo: "Sensor de umidade para hortas comunitárias",
    status: "aceito_com_correcao",
  },
  {
    ano: 2025,
    evento: "MAC 2025",
    titulo: "Aplicativo de apoio à agricultura familiar",
    status: "aceito",
  },
];

export default function AlunoTrabalhosPage() {
  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ALUNO}
        activeHref="/aluno/trabalhos"
        userName="Beatriz Nogueira"
        userRoleLabel="Aluno"
        userInitials="BN"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            Seus trabalhos inscritos e o andamento de cada um.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    <th className="px-6 py-3 font-semibold">Trabalho</th>
                    <th className="px-6 py-3 font-semibold">Evento</th>
                    <th className="px-6 py-3 font-semibold">Ano</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {MEUS_TRABALHOS.map((t) => (
                    <tr
                      key={t.titulo}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      <td className="max-w-[320px] px-6 py-4 align-top">
                        <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                          {t.titulo}
                        </p>
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {t.evento}
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {t.ano}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 align-top">
                        {t.status === "aceito_com_correcao" && (
                          <button className="rounded-lg bg-fatec-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600">
                            Corrigir e reenviar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
