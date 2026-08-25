export type TrabalhoStatus =
  | "submissao"
  | "aguardando_avaliacao"
  | "revisao"
  | "avaliado"
  | "aceito"
  | "nao_aceito";

const STATUS_META: Record<
  TrabalhoStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  submissao: {
    label: "Em submissão",
    dot: "bg-fatec-sky-600",
    text: "text-fatec-sky-600",
    bg: "bg-fatec-sky-100",
  },
  aguardando_avaliacao: {
    label: "Aguardando avaliação",
    dot: "bg-fatec-navy-700",
    text: "text-fatec-navy-800",
    bg: "bg-fatec-navy-100",
  },
  revisao: {
    label: "Revisão solicitada",
    dot: "bg-fatec-orange-500",
    text: "text-fatec-orange-600",
    bg: "bg-fatec-orange-100",
  },
  avaliado: {
    label: "Avaliado",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  aceito: {
    label: "Aceito",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  nao_aceito: {
    label: "Recusado",
    dot: "bg-rose-600",
    text: "text-rose-700",
    bg: "bg-rose-50",
  },
};

export function StatusBadge({ status }: { status: TrabalhoStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export { STATUS_META };
