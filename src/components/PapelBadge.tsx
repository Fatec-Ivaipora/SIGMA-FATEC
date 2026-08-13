export type Papel = "aluno" | "avaliador" | "organizacao" | "admin";

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

export function PapelBadge({ papel }: { papel: Papel }) {
  const meta = PAPEL_META[papel];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}
    >
      {meta.label}
    </span>
  );
}

export { PAPEL_META };
