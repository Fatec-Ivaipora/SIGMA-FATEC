import {
  LayoutGrid,
  FileStack,
  CalendarRange,
  Tag,
  BarChart3,
  Users,
  FileText,
  ScrollText,
} from "lucide-react";

export const NAV_ADMIN = [
  { label: "Painel", href: "/dashboard", icon: LayoutGrid },
  { label: "Trabalhos", href: "/trabalhos", icon: FileStack },
  { label: "Eventos", href: "/eventos", icon: CalendarRange },
  { label: "Áreas temáticas", href: "/areas-tematicas", icon: Tag },
  { label: "Declarações", href: "/declaracoes", icon: ScrollText },
  { label: "Editais", href: "/editais/gerenciar", icon: FileText },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Usuários", href: "/usuarios", icon: Users },
];
