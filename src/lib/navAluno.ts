import { LayoutGrid, FileStack, CalendarRange, Award, GraduationCap } from "lucide-react";

export const NAV_ALUNO = [
  { label: "Início", href: "/aluno", icon: LayoutGrid },
  { label: "Projeto Integrador", href: "/aluno/projeto-integrador", icon: GraduationCap },
  { label: "Eventos", href: "/aluno/eventos", icon: CalendarRange },
  { label: "Trabalhos", href: "/aluno/trabalhos", icon: FileStack },
  { label: "Certificações", href: "/aluno/certificacoes", icon: Award },
];

// Projeto Integrador é exclusivo de aluno da Fatec (RF-53, 2026-08-25) —
// participante externo (vinculoFatec === false) não vê esse item de menu.
export function navAlunoPara(vinculoFatec: boolean | undefined) {
  return vinculoFatec === false
    ? NAV_ALUNO.filter((item) => item.label !== "Projeto Integrador")
    : NAV_ALUNO;
}
