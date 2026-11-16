"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Award, ChevronLeft, ChevronRight, FileText, Loader2, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Reveal } from "@/components/Reveal";
import { WaveDivider } from "@/components/WaveDivider";

type Resultado = {
  id: string;
  titulo: string;
  autores: string;
  orientador: string;
  areaTematica: string;
  temApresentacao: boolean;
  temPremiacao: boolean;
  posicao: number | null;
};

/** Mural público dos certificados de apresentação/premiação (2026-11-13,
 * pedido explícito do usuário, decisão com o chefe da comissão: "ter um
 * lugar pra postar igual do edital... a pessoa busca pelo nome ou pelo
 * título"). Liga/desliga em Trabalhos → Resultado Final → "Emitir
 * certificados públicos" — desligado, mostra "indisponível" (ver GET
 * /api/certificados/grupo/busca). Os PDFs em si são gerados na hora do
 * clique, não ficam armazenados em lugar nenhum — sempre refletem o
 * estado atual do trabalho. Visual alinhado com a home (2026-11-13,
 * pedido explícito — "traga esse estilo da home pra ela, traga o menu
 * também"): `SiteHeader` + herói navy com manchas em deriva + curva, em
 * vez da página solta/cinza de antes.
 *
 * Listagem padrão + paginação de 20 (2026-11-16, pedido explícito do
 * usuário — "acho justo quando a pessoa entrar já apareça uns 20
 * trabalhos ali pra não ficar a tela vazia... 20 por 20, cada página").
 * Busca vazia já lista os trabalhos do evento (antes só mostrava "digite
 * 2 letras"); trocar o texto da busca sempre volta pra página 1. */
export default function MuralCertificadosPage() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [eventoNome, setEventoNome] = useState("");
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function mudarBusca(valor: string) {
    setBusca(valor);
    setPagina(1);
  }

  useEffect(() => {
    const termo = busca.trim();
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErro(null);
    setCarregando(true);
    const id = setTimeout(() => {
      fetch(
        `/api/certificados/grupo/busca?eventoId=${encodeURIComponent(eventoId)}&busca=${encodeURIComponent(termo)}&pagina=${pagina}`,
      )
        .then((res) => res.json())
        .then((dados) => {
          if (cancelado) return;
          setAtivo(dados.ativo ?? false);
          setEventoNome(dados.eventoNome ?? "");
          setResultados(dados.resultados ?? []);
          setTotalPaginas(dados.totalPaginas ?? 1);
        })
        .catch(() => {
          if (!cancelado) setErro("Não foi possível buscar agora. Tente de novo.");
        })
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [eventoId, busca, pagina]);

  if (ativo === false) {
    return (
      <main className="flex flex-1 flex-col">
        <SiteHeader mostrarEvento={false} />
        <div className="flex flex-1 items-center justify-center bg-fatec-navy-50 px-6 py-20">
          <div className="w-full max-w-md rounded-2xl border border-fatec-line bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-fatec-navy-900">Mural indisponível</h1>
            <p className="mt-2 text-sm text-fatec-muted">
              Esse mural de certificados não está disponível no momento.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader mostrarEvento={false} />

      <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-28 pt-16 md:px-12 md:pb-36 md:pt-20">
        <div
          aria-hidden
          className="sigma-anim-drift pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fatec-sky-600/20 blur-3xl"
        />
        <div
          aria-hidden
          className="sigma-anim-drift-slow pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/10 text-white">
            <Award className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.02em] text-fatec-sky-100">
            {eventoNome || "Certificados"}
          </p>
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white md:text-4xl">
            Certificados de apresentação e premiação
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-fatec-navy-50/90">
            Busque pelo seu nome, pelo título do trabalho ou pelo nome do
            orientador — sem precisar de login.
          </p>

          <div className="relative mt-2 w-full max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
            <input
              autoFocus
              value={busca}
              onChange={(e) => mudarBusca(e.target.value)}
              placeholder="Seu nome ou o título do trabalho"
              className="w-full rounded-full border border-transparent bg-white py-3.5 pl-11 pr-5 text-sm text-fatec-ink shadow-lg shadow-black/20 outline-none placeholder:text-fatec-muted/70 focus:border-fatec-sky-600"
            />
          </div>
        </div>

        <WaveDivider fill="#f0f5f8" className="absolute inset-x-0 bottom-0" />
      </section>

      <div className="flex-1 bg-fatec-navy-50 px-4 py-12 md:px-8">
        <div className="mx-auto w-full max-w-[1800px]">
          {erro && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
          )}

          {carregando && (
            <div className="flex items-center justify-center py-6 text-fatec-muted">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
            </div>
          )}

          {!carregando && resultados.length === 0 && !erro && (
            <p className="mx-auto max-w-lg rounded-xl border border-fatec-line bg-white px-4 py-6 text-center text-sm text-fatec-muted">
              {busca.trim().length >= 2
                ? <>Nenhum resultado pra &ldquo;{busca.trim()}&rdquo;. Confira a digitação ou fale com a secretaria.</>
                : "Nenhum trabalho disponível ainda nesse mural."}
            </p>
          )}

          {/* Grade de 5 por linha, num container bem mais largo (2026-11-16,
              2 rodadas de ajuste — "faça 5 certificado por linha" e depois
              "os cards do trabalho estão muito apertados e estreitos,
              podem ser mais largos, ocupar mais espaço da tela": o
              problema não era o número de colunas, era o container
              (`max-w-7xl` virou `max-w-[1800px]`) deixando cada uma das 5
              colunas estreita demais. Cartão levanta e fica laranja no
              hover (pedido explícito — "quando passa o mouse ele levanta,
              fica laranja"); os 2 botões de certificado continuam os
              dois, cada um clicável — pedido explícito: "tem que ter a
              seleção certificado de apresentação e de premiação" —, só
              que empilhados (não lado a lado) pra caber num card mais
              estreito que o antigo de 1 coluna só. */}
          {!carregando && resultados.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {resultados.map((r, i) => (
                <Reveal key={r.id} delay={i * 60}>
                  <div className="flex h-full flex-col rounded-2xl border border-fatec-line bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-fatec-orange-500 hover:shadow-lg hover:shadow-fatec-orange-500/10">
                    <p className="font-semibold leading-snug text-fatec-navy-900">{r.titulo}</p>
                    <p className="mt-1 text-sm text-fatec-muted">{r.autores}</p>
                    {r.orientador && (
                      <p className="mt-0.5 text-xs text-fatec-muted">
                        Orientador(a): {r.orientador}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-fatec-muted">{r.areaTematica}</p>
                    <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
                      {r.temApresentacao && (
                        <a
                          href={`/api/certificados/grupo/apresentacao?trabalhoId=${r.id}`}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-fatec-line px-3 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:border-fatec-orange-500 hover:bg-fatec-orange-50 hover:text-fatec-orange-600"
                        >
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Certificado de apresentação
                        </a>
                      )}
                      {r.temPremiacao && (
                        <a
                          href={`/api/certificados/grupo/premiacao?trabalhoId=${r.id}`}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-fatec-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                        >
                          <Award className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Certificado de premiação{r.posicao ? ` (${r.posicao}º lugar)` : ""}
                        </a>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}

          {!carregando && totalPaginas > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
              <span className="text-sm text-fatec-muted">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
