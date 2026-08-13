"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { PapelBadge, type Papel } from "@/components/PapelBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";

type Aba = "participantes" | "envios" | "aceitos" | "recusados";

const ABAS: { key: Aba; label: string }[] = [
  { key: "participantes", label: "Participantes" },
  { key: "envios", label: "Envios" },
  { key: "aceitos", label: "Aceitos" },
  { key: "recusados", label: "Recusados" },
];

const PARTICIPANTES: { nome: string; email: string; papel: Papel; evento: string }[] = [
  { nome: "Beatriz Nogueira", email: "beatriz.nogueira@aluno.fatecivaipora.com.br", papel: "aluno", evento: "MAC 2026" },
  { nome: "João Pedro Salles", email: "joao.salles@aluno.fatecivaipora.com.br", papel: "aluno", evento: "MOPI 2026" },
  { nome: "Prof. Renato Alves", email: "renato.alves@fatecivaipora.com.br", papel: "avaliador", evento: "MAC 2026" },
  { nome: "Profa. Camila Duarte", email: "camila.duarte@fatecivaipora.com.br", papel: "avaliador", evento: "MOPI 2026" },
];

const ENVIOS: { titulo: string; aluno: string; evento: string; data: string }[] = [
  { titulo: "Otimização de rotas com algoritmos genéticos", aluno: "Beatriz Nogueira", evento: "MAC 2026", data: "12/08/2026" },
  { titulo: "Detecção de pragas em lavouras via visão computacional", aluno: "João Pedro Salles", evento: "MOPI 2026", data: "13/08/2026" },
  { titulo: "Sensor de umidade para hortas comunitárias", aluno: "Tiago Ramos", evento: "MOPI 2026", data: "13/08/2026" },
];

const ACEITOS: { titulo: string; aluno: string; evento: string; avaliador: string; nota: number }[] = [
  { titulo: "Aplicativo de apoio à agricultura familiar", aluno: "Gabriel Torres", evento: "MAC 2025", avaliador: "Prof. Marcos Vinícius", nota: 5 },
  { titulo: "Análise preditiva de evasão escolar", aluno: "Gabriel Torres", evento: "MAC 2026", avaliador: "Prof. Marcos Vinícius", nota: 4 },
];

const RECUSADOS: { titulo: string; aluno: string; evento: string; motivo: string }[] = [
  { titulo: "Sistema de gestão para hortas comunitárias", aluno: "Fernanda Lima", evento: "MOPI 2026", motivo: "Recusado pelo orientador — escopo incompatível com o edital." },
];

export default function RelatoriosPage() {
  const [aba, setAba] = useState<Aba>("participantes");

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/relatorios"
        userName="Ana Carolina"
        userRoleLabel="Organização"
        userInitials="AC"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Relatórios
            </h1>
            <p className="text-sm text-fatec-muted">
              Participantes, envios, aceitos e recusados por evento.
            </p>
          </div>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Exportar relatório (PDF)
          </button>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex w-fit gap-1 rounded-xl bg-fatec-navy-50 p-1">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAba(a.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  aba === a.key
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              {aba === "participantes" && (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                      <th className="px-6 py-3 font-semibold">Nome</th>
                      <th className="px-6 py-3 font-semibold">E-mail</th>
                      <th className="px-6 py-3 font-semibold">Papel</th>
                      <th className="px-6 py-3 font-semibold">Evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARTICIPANTES.map((p) => (
                      <tr
                        key={p.email}
                        className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                      >
                        <td className="px-6 py-4 font-medium text-fatec-navy-900">
                          {p.nome}
                        </td>
                        <td className="px-6 py-4 text-fatec-muted">
                          {p.email}
                        </td>
                        <td className="px-6 py-4">
                          <PapelBadge papel={p.papel} />
                        </td>
                        <td className="px-6 py-4 text-fatec-ink">
                          {p.evento}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {aba === "envios" && (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                      <th className="px-6 py-3 font-semibold">Trabalho</th>
                      <th className="px-6 py-3 font-semibold">Aluno</th>
                      <th className="px-6 py-3 font-semibold">Evento</th>
                      <th className="px-6 py-3 font-semibold">Enviado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENVIOS.map((e) => (
                      <tr
                        key={e.titulo}
                        className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                      >
                        <td className="max-w-[280px] px-6 py-4 align-top">
                          <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                            {e.titulo}
                          </p>
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {e.aluno}
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {e.evento}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 align-top text-fatec-muted">
                          {e.data}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {aba === "aceitos" && (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                      <th className="px-6 py-3 font-semibold">Trabalho</th>
                      <th className="px-6 py-3 font-semibold">Aluno</th>
                      <th className="px-6 py-3 font-semibold">Evento</th>
                      <th className="px-6 py-3 font-semibold">Avaliador</th>
                      <th className="px-6 py-3 font-semibold">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACEITOS.map((a) => (
                      <tr
                        key={a.titulo}
                        className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                      >
                        <td className="max-w-[260px] px-6 py-4 align-top">
                          <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                            {a.titulo}
                          </p>
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {a.aluno}
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {a.evento}
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {a.avaliador}
                        </td>
                        <td className="px-6 py-4 align-top font-semibold text-emerald-700">
                          {a.nota}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {aba === "recusados" && (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                      <th className="px-6 py-3 font-semibold">Trabalho</th>
                      <th className="px-6 py-3 font-semibold">Aluno</th>
                      <th className="px-6 py-3 font-semibold">Evento</th>
                      <th className="px-6 py-3 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECUSADOS.map((r) => (
                      <tr
                        key={r.titulo}
                        className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                      >
                        <td className="max-w-[220px] px-6 py-4 align-top">
                          <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                            {r.titulo}
                          </p>
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {r.aluno}
                        </td>
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {r.evento}
                        </td>
                        <td className="max-w-[320px] px-6 py-4 align-top text-fatec-muted">
                          {r.motivo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
