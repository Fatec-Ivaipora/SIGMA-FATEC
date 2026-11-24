import type { TrabalhoStatus } from "@/lib/data/trabalhos";

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
    label: "Em reavaliação",
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
  aguardando_apresentacao: {
    label: "Aguardando apresentação",
    dot: "bg-purple-600",
    text: "text-purple-700",
    bg: "bg-purple-50",
  },
  apresentado: {
    label: "Apresentado",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
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
  entregue_com_atraso: {
    label: "Entregue com atraso",
    dot: "bg-amber-600",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  // Trabalho legado que ganhou nota depois de corrigido (2026-11-05, ver
  // comentário em TrabalhoStatus) — tem nota mas fica fora do pódio/
  // desempate, por isso cor própria, nem laranja (ainda em revisão) nem
  // verde (avaliado "de verdade").
  revisao_realizada: {
    label: "Revisão concluída",
    dot: "bg-cyan-600",
    text: "text-cyan-700",
    bg: "bg-cyan-50",
  },
  // Etapas de TCC (2026-11-16, ver comentário em TrabalhoStatus).
  tcc_inscrito: {
    label: "Inscrito",
    dot: "bg-fatec-sky-600",
    text: "text-fatec-sky-600",
    bg: "bg-fatec-sky-100",
  },
  tcc_banca_agendada: {
    label: "Banca agendada",
    dot: "bg-fatec-navy-700",
    text: "text-fatec-navy-800",
    bg: "bg-fatec-navy-100",
  },
  // Todo mundo da banca já lançou nota, mas o admin ainda não decidiu
  // aprovar/reprovar (2026-11-24, pedido explícito do usuário — mesmo
  // espírito do "avaliado" de MAC: fica aqui até alguém mandar pra
  // Resultado em lote).
  tcc_avaliado: {
    label: "Avaliado",
    dot: "bg-fatec-sky-600",
    text: "text-fatec-sky-700",
    bg: "bg-fatec-sky-100",
  },
  tcc_aprovado: {
    label: "Aprovado",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  tcc_reprovado: {
    label: "Reprovado",
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
