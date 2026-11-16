"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, CalendarDays, FolderOpen, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Reveal } from "@/components/Reveal";
import { WaveDivider } from "@/components/WaveDivider";
import { formatarDataEvento } from "@/lib/formatarDataEvento";

type EventoComMural = {
  id: string;
  nome: string;
  dataRealizacao?: string;
  dataRealizacaoFim?: string;
};

/** Ponto de entrada do mural de certificados (2026-11-13, pedido explícito
 * do usuário — "essa consulta... tem que estar em um lugar fácil, acho
 * melhor na tela de login em algum menu"). Lista os eventos com mural
 * ativo (normalmente só 1) e manda pra /certificados/{eventoId} — mesmo
 * espírito de /editais, mas pra certificados em grupo. Visual alinhado com
 * a home (2026-11-13, pedido explícito — "traga esse estilo da home pra
 * ela, traga o menu também"): mesmo cabeçalho (`SiteHeader`), mesmo herói
 * navy com manchas em deriva + curva (`WaveDivider`) no lugar da página
 * solta/cinza de antes.
 *
 * Cards à esquerda, não botão centralizado (2026-11-16, pedido explícito do
 * usuário — "a parte de selecionar o evento poderia ser um card, não um
 * botão centralizado, coloque ele na esquerda e o próximo sempre vai na
 * esquerda dele, pra sempre o último evento ficar na frente"): linha de
 * cards começando da esquerda (sem `mx-auto`/centralizar), ordenados pelo
 * `dataRealizacao` mais recente primeiro — o evento mais novo sempre
 * aparece primeiro/na frente da fila, não só na ordem que o Firestore
 * devolveu. Card aumentado (ajuste no mesmo dia, pedido explícito — "o
 * card ficou muito pequeno, não fala a data de realização nem a
 * descrição, esse card pode ser maior") — mostra a data de realização,
 * não só o nome. Descrição removida de novo e data com mais destaque
 * (ajuste seguinte, pedido explícito — "retire a descrição e dê destaque
 * pra data de realização"). */
export default function ListaMuraisCertificadosPage() {
  const [eventos, setEventos] = useState<EventoComMural[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/certificados/grupo/lista-eventos")
      .then((r) => r.json())
      .then((dados) => {
        const lista: EventoComMural[] = dados.eventos ?? [];
        lista.sort((a, b) => (b.dataRealizacao ?? "").localeCompare(a.dataRealizacao ?? ""));
        setEventos(lista);
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader mostrarEvento={false} />

      <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-24 pt-16 md:px-12 md:pb-32 md:pt-20">
        <div
          aria-hidden
          className="sigma-anim-drift pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fatec-sky-600/20 blur-3xl"
        />
        <div
          aria-hidden
          className="sigma-anim-drift-slow pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/10 text-white">
            <Award className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white md:text-5xl">
            Certificados de apresentação e premiação
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-fatec-navy-50/90 md:text-lg">
            Escolha o evento pra buscar o seu certificado pelo nome ou pelo
            título do trabalho — sem precisar de login.
          </p>
        </div>

        <WaveDivider fill="#f0f5f8" className="absolute inset-x-0 bottom-0" />
      </section>

      <div className="flex-1 bg-fatec-navy-50 px-4 py-14 md:px-12">
        {carregando && (
          <div className="flex items-center gap-2 text-fatec-muted">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
          </div>
        )}

        {!carregando && eventos.length === 0 && (
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fatec-navy-50 text-fatec-navy-800">
              <FolderOpen className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-medium text-fatec-navy-900">
              Nenhum mural de certificados aberto no momento
            </p>
          </div>
        )}

        {!carregando && eventos.length > 0 && (
          <div className="flex flex-wrap gap-5">
            {eventos.map((e, i) => (
              <Reveal key={e.id} delay={i * 80}>
                <Link
                  href={`/certificados/${e.id}`}
                  className="group flex w-full max-w-md flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-fatec-orange-500 hover:shadow-lg hover:shadow-fatec-orange-500/10 sm:w-96"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800 transition-colors group-hover:bg-fatec-orange-500 group-hover:text-white">
                    <Award className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <span className="text-lg font-bold leading-snug text-fatec-navy-900">{e.nome}</span>
                  {e.dataRealizacao && (
                    <span className="flex items-center gap-2 text-base font-semibold text-fatec-navy-800">
                      <CalendarDays className="h-4.5 w-4.5 flex-none text-fatec-orange-500" strokeWidth={1.75} />
                      {formatarDataEvento(e.dataRealizacao, e.dataRealizacaoFim)}
                    </span>
                  )}
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-fatec-sky-600 transition-colors group-hover:text-fatec-orange-600">
                    Ver certificados
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
