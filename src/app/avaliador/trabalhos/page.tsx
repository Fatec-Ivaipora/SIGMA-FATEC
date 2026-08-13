"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, ClipboardCheck, Award, Search } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge, type TrabalhoStatus } from "@/components/StatusBadge";

const NAV_AVALIADOR = [
  { label: "Painel", href: "/avaliador", icon: LayoutGrid },
  { label: "Trabalhos", href: "/avaliador/trabalhos", icon: ClipboardCheck },
  { label: "Certificações", href: "/avaliador/certificacoes", icon: Award },
];

type TrabalhoDesignado = {
  id: string;
  titulo: string;
  aluno: string;
  evento: string;
  status: TrabalhoStatus;
  resumo: string;
};

const TRABALHOS_DESIGNADOS_INICIAL: TrabalhoDesignado[] = [
  {
    id: "t1",
    titulo: "Otimização de rotas com algoritmos genéticos",
    aluno: "Beatriz Nogueira",
    evento: "MAC 2026",
    status: "aguardando_avaliacao",
    resumo:
      "O trabalho propõe um algoritmo genético para otimizar rotas de entrega em áreas rurais do Vale do Ivaí, reduzindo tempo de deslocamento e custo de combustível em comparação com o roteamento manual usado atualmente.",
  },
  {
    id: "t2",
    titulo: "Painel solar de baixo custo para propriedades rurais",
    aluno: "Elaine Souza",
    evento: "MAC 2026",
    status: "aguardando_avaliacao",
    resumo:
      "Protótipo de painel solar montado com materiais de baixo custo, voltado a pequenas propriedades rurais sem acesso à rede elétrica, com foco em viabilidade econômica e facilidade de manutenção local.",
  },
  {
    id: "t3",
    titulo: "Aplicativo de apoio à agricultura familiar",
    aluno: "Gabriel Torres",
    evento: "MAC 2025",
    status: "aceito",
    resumo:
      "Aplicativo móvel que auxilia agricultores familiares no planejamento de plantio e colheita a partir de dados climáticos locais.",
  },
];

type TrabalhoOrientando = {
  id: string;
  titulo: string;
  evento: string;
  palavrasChave: string[];
  alunos: string[];
  resumo: string;
  status: TrabalhoStatus;
};

const TRABALHOS_ORIENTANDO_INICIAL: TrabalhoOrientando[] = [
  {
    id: "o1",
    titulo: "Sensor de umidade para hortas comunitárias",
    evento: "MOPI 2026",
    palavrasChave: ["IoT", "agricultura urbana", "sensores"],
    alunos: ["Tiago Ramos"],
    resumo:
      "O projeto desenvolve um sensor de baixo custo para medir a umidade do solo em hortas comunitárias urbanas, enviando alertas via aplicativo quando a irrigação é necessária. O objetivo é reduzir o desperdício de água e facilitar o manejo por voluntários sem experiência técnica em irrigação.",
    status: "aguardando_orientador",
  },
  {
    id: "o2",
    titulo: "App de gestão para pequenos produtores rurais",
    evento: "MAC 2026",
    palavrasChave: ["gestão rural", "aplicativo móvel"],
    alunos: ["Juliana Prado", "Marcos Aurélio"],
    resumo:
      "Aplicativo móvel voltado a pequenos produtores rurais do Vale do Ivaí, permitindo registrar custos de produção, controlar estoque de insumos e acompanhar preços de venda em tempo real, com foco em produtores sem acesso a sistemas de gestão tradicionais.",
    status: "aguardando_avaliacao",
  },
];

const NOTAS = [1, 2, 3, 4, 5];

const DECISOES = [
  { label: "Aceito", status: "aguardando_avaliacao" as TrabalhoStatus, className: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "Correção", status: "aceito_com_correcao" as TrabalhoStatus, className: "bg-fatec-orange-500 hover:bg-fatec-orange-600" },
  { label: "Recusado", status: "nao_aceito" as TrabalhoStatus, className: "bg-rose-600 hover:bg-rose-700" },
];

export default function AvaliadorTrabalhosPage() {
  const [aba, setAba] = useState<"todos" | "orientador">("todos");
  const [busca, setBusca] = useState("");
  const [trabalhos, setTrabalhos] = useState(TRABALHOS_DESIGNADOS_INICIAL);
  const [avaliando, setAvaliando] = useState<string | null>("t1");
  const [nota, setNota] = useState<number | null>(null);

  const [orientandos, setOrientandos] = useState(TRABALHOS_ORIENTANDO_INICIAL);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});

  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return trabalhos;
    return trabalhos.filter(
      (t) =>
        t.titulo.toLowerCase().includes(termo) ||
        t.aluno.toLowerCase().includes(termo),
    );
  }, [busca, trabalhos]);

  function enviarNota(id: string) {
    setTrabalhos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "avaliado" } : t)),
    );
    setAvaliando(null);
    setNota(null);
  }

  function decidirOrientacao(id: string, status: TrabalhoStatus) {
    setOrientandos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t)),
    );
  }

  return (
    <main className="flex flex-1">
      <Sidebar
        navItems={NAV_AVALIADOR}
        activeHref="/avaliador/trabalhos"
        userName="Prof. Renato Alves"
        userRoleLabel="Avaliador"
        userInitials="RA"
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            Trabalhos dos eventos em que você atua.
          </p>

          <div className="mt-4 flex w-fit gap-1 rounded-xl bg-fatec-navy-50 p-1">
            <button
              type="button"
              onClick={() => setAba("todos")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                aba === "todos"
                  ? "bg-white text-fatec-navy-900 shadow-sm"
                  : "text-fatec-muted hover:text-fatec-navy-900"
              }`}
            >
              Todos os trabalhos
            </button>
            <button
              type="button"
              onClick={() => setAba("orientador")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                aba === "orientador"
                  ? "bg-white text-fatec-navy-900 shadow-sm"
                  : "text-fatec-muted hover:text-fatec-navy-900"
              }`}
            >
              Sou orientador
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {aba === "todos" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-fatec-muted">
                Todos os trabalhos inscritos e aceitos nos eventos em que você
                está inscrito como avaliador. A ação de avaliar aparece só nos
                trabalhos designados a você — apenas com nota, sem parecer
                (parecer e comentário existem só para trabalhos em que você é
                orientador, na aba ao lado).
              </p>

              <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5">
                <Search
                  className="h-4 w-4 flex-none text-fatec-muted"
                  strokeWidth={1.75}
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título do trabalho ou nome do aluno"
                  className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
                />
              </div>

              {trabalhosFiltrados.length === 0 && (
                <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                  Nenhum trabalho encontrado para &quot;{busca}&quot;.
                </p>
              )}

              {trabalhosFiltrados.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-fatec-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fatec-navy-900">
                        {t.titulo}
                      </p>
                      <p className="text-sm text-fatec-muted">
                        {t.aluno} · {t.evento}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      {t.status === "aguardando_avaliacao" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvaliando((cur) =>
                              cur === t.id ? null : t.id,
                            );
                            setNota(null);
                          }}
                          className="rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                        >
                          {avaliando === t.id ? "Fechar" : "Avaliar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {avaliando === t.id && (
                    <div className="mt-5 flex flex-col gap-4 border-t border-fatec-line pt-5">
                      <p className="text-sm leading-relaxed text-fatec-ink">
                        {t.resumo}
                      </p>

                      <div>
                        <span className="text-sm font-medium text-fatec-navy-900">
                          Nota (1 a 5)
                        </span>
                        <div className="mt-2 flex gap-2">
                          {NOTAS.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNota(n)}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                                nota === n
                                  ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                                  : "border-fatec-line text-fatec-navy-900 hover:border-fatec-orange-500/60"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => enviarNota(t.id)}
                        className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
                      >
                        Enviar nota
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-fatec-muted">
                Trabalhos em que você foi indicado como orientador. Precisa
                decidir antes que sigam para avaliação.
              </p>

              {orientandos.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-fatec-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fatec-navy-900">
                        {t.titulo}
                      </p>
                      <p className="text-sm text-fatec-muted">{t.evento}</p>
                      <dl className="mt-2 flex flex-col gap-1 text-sm">
                        <div className="flex gap-1.5">
                          <dt className="flex-none font-medium text-fatec-navy-900">
                            Palavras-chave:
                          </dt>
                          <dd className="text-fatec-muted">
                            {t.palavrasChave.join(", ")}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="flex-none font-medium text-fatec-navy-900">
                            Alunos:
                          </dt>
                          <dd className="text-fatec-muted">
                            {t.alunos.join(", ")}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>

                  {t.status === "aguardando_orientador" && (
                    <div className="mt-5 flex flex-col gap-4 border-t border-fatec-line pt-5">
                      <div>
                        <span className="text-sm font-medium text-fatec-navy-900">
                          Resumo
                        </span>
                        <p className="mt-1 text-sm leading-relaxed text-fatec-ink">
                          {t.resumo}
                        </p>
                      </div>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-fatec-navy-900">
                          Comentário
                        </span>
                        <textarea
                          rows={3}
                          value={comentarios[t.id] ?? ""}
                          onChange={(e) =>
                            setComentarios((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                          placeholder="Deixe uma observação para o aluno (obrigatório em caso de correção ou recusa)"
                          className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {DECISOES.map((d) => (
                          <button
                            key={d.label}
                            type="button"
                            onClick={() => decidirOrientacao(t.id, d.status)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${d.className}`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
