import {
  LayoutGrid,
  FileStack,
  DoorOpen,
  CalendarRange,
  Tag,
  BarChart3,
  Users,
  FileText,
  ScrollText,
  PenTool,
} from "lucide-react";

// Ordem (2026-10-05, pedido explícito do usuário — reorganizou o menu
// inteiro): fluxo de trabalho primeiro (Painel → Eventos → Trabalhos →
// Ensalamento → Áreas temáticas), depois análise/gestão (Relatórios →
// Usuários), depois documentos (Editais → Declarações), Assinaturas por
// último — logo acima de "Configurações" (esse é fixo, fora desse array,
// ver Sidebar.tsx), já que é a tela que menos muda no dia a dia.
export const NAV_ADMIN = [
  { label: "Painel", href: "/dashboard", icon: LayoutGrid },
  { label: "Eventos", href: "/eventos", icon: CalendarRange },
  { label: "Trabalhos", href: "/trabalhos", icon: FileStack },
  { label: "Ensalamento", href: "/ensalamento", icon: DoorOpen },
  { label: "Áreas temáticas", href: "/areas-tematicas", icon: Tag },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Usuários", href: "/usuarios", icon: Users },
  { label: "Editais", href: "/editais/gerenciar", icon: FileText },
  { label: "Declarações", href: "/declaracoes", icon: ScrollText },
  { label: "Assinaturas", href: "/assinaturas", icon: PenTool },
];
