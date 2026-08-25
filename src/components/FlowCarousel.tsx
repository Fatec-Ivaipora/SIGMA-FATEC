"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  UserPlus,
  FileText,
  ClipboardCheck,
  Award,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Slide = {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    icon: UserPlus,
    step: "1",
    title: "Crie sua conta",
    description:
      "Cadastro rápido com seu e-mail — leva menos de dois minutos e já te dá acesso a todos os eventos abertos.",
  },
  {
    icon: FileText,
    step: "2",
    title: "Inscreva seu trabalho",
    description:
      "Escolha o evento (MAC, MOPI ou outro em aberto), conte um pouco sobre o seu trabalho e pronto — sua inscrição já está registrada.",
  },
  {
    icon: ClipboardCheck,
    step: "3",
    title: "Acompanhe a avaliação",
    description:
      "Um professor avaliador analisa seu trabalho. Se pedir algum ajuste, você recebe o retorno na hora e pode corrigir e reenviar direto por aqui.",
  },
  {
    icon: Award,
    step: "4",
    title: "Receba seu certificado",
    description:
      "Trabalho aceito? Seu certificado em PDF fica disponível pra download assim que a organização confirma o resultado.",
  },
];

const AUTOPLAY_MS = 5000;

export function FlowCarousel() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((next: number) => {
    setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const pause = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const resume = () => {
    pause();
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
  };

  const active = SLIDES[index];
  const Icon = active.icon;

  return (
    <div
      className="relative"
      onMouseEnter={pause}
      onMouseLeave={resume}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Como funciona o processo de submissão"
    >
      <div className="overflow-hidden rounded-2xl border border-fatec-line bg-white shadow-[0_20px_50px_-25px_rgba(14,58,94,0.35)]">
        <div className="grid gap-0 md:grid-cols-[minmax(0,220px)_1fr]">
          <div className="flex items-center justify-center bg-fatec-navy-800 p-10 md:p-12">
            <div
              key={active.step}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-fatec-orange-500/95 shadow-lg shadow-black/20"
            >
              <Icon className="h-10 w-10 text-white" strokeWidth={1.75} />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 p-8 md:p-12">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Etapa {active.step} de {SLIDES.length}
            </span>
            <h3 className="text-2xl font-bold text-fatec-navy-900 md:text-3xl">
              {active.title}
            </h3>
            <p className="max-w-prose text-base leading-relaxed text-fatec-muted">
              {active.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2" role="tablist" aria-label="Selecionar etapa">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ir para etapa ${i + 1}: ${slide.title}`}
              onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-8 bg-fatec-orange-500"
                  : "w-2.5 bg-fatec-navy-100 hover:bg-fatec-sky-100"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Etapa anterior"
            onClick={() => goTo(index - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-fatec-line bg-white text-fatec-navy-800 transition-colors hover:bg-fatec-navy-50"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Próxima etapa"
            onClick={() => goTo(index + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-fatec-line bg-white text-fatec-navy-800 transition-colors hover:bg-fatec-navy-50"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
