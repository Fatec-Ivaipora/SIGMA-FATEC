import { LayoutGrid, FileStack, Award, Download } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

const NAV_ALUNO = [
  { label: "Painel", href: "/aluno", icon: LayoutGrid },
  { label: "Trabalhos", href: "/aluno/trabalhos", icon: FileStack },
  { label: "Certificações", href: "/aluno/certificacoes", icon: Award },
];

const CERTIFICADOS = [
  {
    titulo: "Aplicativo de apoio à agricultura familiar",
    evento: "MAC 2025",
    emitidoEm: "18 de novembro de 2025",
  },
];

export default function AlunoCertificacoesPage() {
  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ALUNO}
        activeHref="/aluno/certificacoes"
        userName="Beatriz Nogueira"
        userRoleLabel="Aluno"
        userInitials="BN"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Certificados emitidos para trabalhos aceitos.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {CERTIFICADOS.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Award className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum certificado ainda
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Certificados aparecem aqui assim que um trabalho seu for
                aceito e a organização confirmar o evento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {CERTIFICADOS.map((c) => (
                <div
                  key={c.titulo}
                  className="flex items-center gap-4 rounded-2xl border border-fatec-line bg-white p-5"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                    <Award className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fatec-navy-900">
                      {c.titulo}
                    </p>
                    <p className="text-sm text-fatec-muted">
                      {c.evento} · emitido em {c.emitidoEm}
                    </p>
                  </div>
                  <button className="flex flex-none items-center gap-2 rounded-lg border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50">
                    <Download className="h-4 w-4" strokeWidth={1.75} />
                    PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
