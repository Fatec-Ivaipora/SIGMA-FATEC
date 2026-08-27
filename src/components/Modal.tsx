"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const TAMANHOS = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof TAMANHOS;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-fatec-navy-950/60 backdrop-blur-sm"
      />
      <div className={`relative flex max-h-[90vh] w-full ${TAMANHOS[size]} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-fatec-line px-6 py-4">
          <h2 className="text-base font-semibold text-fatec-navy-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
