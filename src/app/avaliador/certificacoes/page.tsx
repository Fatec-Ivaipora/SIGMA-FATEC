import { LayoutGrid, ClipboardCheck, Award, Download } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

const NAV_AVALIADOR = [
  { label: "Painel", href: "/avaliador", icon: LayoutGrid },
  { label: "Trabalhos", href: "/avaliador/trabalhos", icon: ClipboardCheck },
  { label: "Certificações", href: "/avaliador/certificacoes", icon: Award },
];

const CERTIFICADOS = [
  { evento: "MAC 2025", emitidoEm: "20 de novembro de 2025" },
  { evento: "MOPI 2025", emitidoEm: "12 de junho de 2025" },
];

export default function AvaliadorCertificacoesPage() {
  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_AVALIADOR}
        activeHref="/avaliador/certificacoes"
        userName="Prof. Renato Alves"
        userRoleLabel="Avaliador"
        userInitials="RA"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Certificados emitidos por sua participação como avaliador.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-3">
            {CERTIFICADOS.map((c) => (
              <div
                key={c.evento}
                className="flex items-center gap-4 rounded-2xl border border-fatec-line bg-white p-5"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                  <Award className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fatec-navy-900">
                    Certificado de avaliador — {c.evento}
                  </p>
                  <p className="text-sm text-fatec-muted">
                    Emitido em {c.emitidoEm}
                  </p>
                </div>
                <button className="flex flex-none items-center gap-2 rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50">
                  <Download className="h-4 w-4" strokeWidth={1.75} />
                  PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
