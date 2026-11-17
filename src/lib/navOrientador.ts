import { LayoutGrid } from "lucide-react";
// GraduationCap fica sem uso enquanto "Projeto Integrador" está comentado
// abaixo — volta a ser necessário quando o item for reativado.

export const NAV_ORIENTADOR = [
  { label: "Início", href: "/orientador", icon: LayoutGrid },
  // Escondido do menu (2026-11-17, achado testando o fluxo de TCC —
  // inconsistente com navAluno.ts, que já esconde esse mesmo item do lado
  // do aluno desde 2026-09-09: "por hora não vamos usar"). A tela e a rota
  // continuam existindo, só não aparece na navegação; é só descomentar
  // aqui (e o import de GraduationCap acima) pra voltar a mostrar.
  // { label: "Projeto Integrador", href: "/orientador/projeto-integrador", icon: GraduationCap },
];
