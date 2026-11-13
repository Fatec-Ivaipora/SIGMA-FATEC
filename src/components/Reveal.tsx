"use client";

import { useEffect, useRef, useState } from "react";

/** Entrada ao rolar até a seção (2026-11-13, pedido explícito do usuário —
 * "essa página inicial tá muito crua, vamos dar um movimento pra ela").
 * Único momento de movimento autoral da home pública — por isso fica num
 * componente só, reaproveitado nas poucas seções que merecem o efeito, em
 * vez de cada seção inventar a própria entrada. Dispara uma vez só
 * (`disconnect` depois do primeiro `isIntersecting`), nunca reanima ao
 * rolar pra cima e voltar. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
