import type { Papel, PapelAvaliacao } from "@/lib/auth";

const PAPEL_META: Record<Papel, { label: string; text: string; bg: string }> = {
  aluno: {
    label: "Aluno",
    text: "text-fatec-sky-600",
    bg: "bg-fatec-sky-100",
  },
  avaliador: {
    label: "Avaliador",
    text: "text-fatec-navy-800",
    bg: "bg-fatec-navy-100",
  },
  orientador: {
    label: "Orientador",
    text: "text-purple-700",
    bg: "bg-purple-50",
  },
  moderador: {
    label: "Moderador",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  organizacao: {
    label: "Organização",
    text: "text-fatec-orange-600",
    bg: "bg-fatec-orange-100",
  },
  admin: {
    label: "Admin",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
};

export function PapelBadge({
  papel,
  papeisAvaliacao,
}: {
  papel: Papel;
  // Papéis extras combinados (2026-08-26, ver PAPEIS_AVALIACAO em
  // src/lib/auth.tsx) — mostrados como badges menores ao lado do principal.
  papeisAvaliacao?: PapelAvaliacao[];
}) {
  const meta = PAPEL_META[papel];
  const extras = (papeisAvaliacao ?? []).filter((p) => p !== papel);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}
      >
        {meta.label}
      </span>
      {extras.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAPEL_META[p].bg} ${PAPEL_META[p].text}`}
        >
          + {PAPEL_META[p].label}
        </span>
      ))}
    </span>
  );
}

export { PAPEL_META };
