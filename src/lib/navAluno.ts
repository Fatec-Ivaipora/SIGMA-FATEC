import { LayoutGrid, FileStack, CalendarRange, Award, GraduationCap } from "lucide-react";

// "Submissões" em vez de "Eventos" (2026-09-08, pedido do coordenador — os
// alunos entendem melhor esse nome). Rota continua /aluno/eventos por
// baixo, só o texto do menu mudou.
export const NAV_ALUNO = [
  { label: "Início", href: "/aluno", icon: LayoutGrid },
  { label: "Projeto Integrador", href: "/aluno/projeto-integrador", icon: GraduationCap },
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
export function navAlunoPara(vinculoFatec: boolean | undefined, temEventoAtivo = false) {
  const itens = vinculoFatec === false
    ? NAV_ALUNO.filter((item) => item.label !== "Projeto Integrador")
    : NAV_ALUNO;
  return itens.map((item) =>
    item.href === "/aluno/eventos" ? { ...item, indicador: temEventoAtivo } : item,
  );
}
