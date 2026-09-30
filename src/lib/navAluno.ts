import { LayoutGrid, FileStack, CalendarRange, Award, QrCode } from "lucide-react";
// GraduationCap fica sem uso enquanto "Projeto Integrador" está comentado
// abaixo — volta a ser necessário quando o item for reativado.

// "Submissões" em vez de "Eventos" (2026-09-08, pedido do coordenador — os
// alunos entendem melhor esse nome). Rota continua /aluno/eventos por
// baixo, só o texto do menu mudou.
export const NAV_ALUNO = [
  { label: "Início", href: "/aluno", icon: LayoutGrid },
  // Escondido do menu por pedido do usuário (2026-09-09) — "por hora não
  // vamos usar". A tela e a rota continuam existindo, só não aparece na
  // navegação; é só descomentar aqui pra voltar a mostrar.
  // { label: "Projeto Integrador", href: "/aluno/projeto-integrador", icon: GraduationCap },
  { label: "Submissões", href: "/aluno/eventos", icon: CalendarRange },
  { label: "Trabalhos", href: "/aluno/trabalhos", icon: FileStack },
  { label: "Certificações", href: "/aluno/certificacoes", icon: Award },
];

// Projeto Integrador é exclusivo de aluno da Fatec (RF-53, 2026-08-25) —
// participante externo (vinculoFatec === false) não vê esse item de menu.
// temEventoAtivo (2026-09-04) — acende um indicador no item "Submissões" pra
// avisar o aluno que tem evento aberto sem precisar entrar na tela; quem
// chama já filtrou os eventos por vinculoFatec (ver eventosParaAluno).
// Casa por href (não por label) pra não depender do texto exibido.
// souMonitorEventoSimples (2026-09-30) — acrescenta "Ensalamento" só pra
// quem monitora pelo menos 1 evento tipo "simples" (ver
// useMonitoriasSimplesDoAluno em src/lib/data/monitores.ts); monitor de
// evento completo não ganha esse item, é só um cargo sem função no sistema.
export function navAlunoPara(
  vinculoFatec: boolean | undefined,
  temEventoAtivo = false,
  souMonitorEventoSimples = false,
) {
  const base = vinculoFatec === false
    ? NAV_ALUNO.filter((item) => item.label !== "Projeto Integrador")
    : NAV_ALUNO;
  const itens = base.map((item) =>
    item.href === "/aluno/eventos" ? { ...item, indicador: temEventoAtivo } : item,
  );
  return souMonitorEventoSimples
    ? [...itens, { label: "Ensalamento", href: "/ensalamento", icon: QrCode }]
    : itens;
}
