import {
  LayoutGrid,
  FileStack,
  CalendarRange,
  Tag,
  BarChart3,
  Users,
} from "lucide-react";

export const NAV_ADMIN = [
  { label: "Painel", href: "/dashboard", icon: LayoutGrid },
  { label: "Trabalhos", href: "/trabalhos", icon: FileStack },
  { label: "Eventos", href: "/eventos", icon: CalendarRange },
  { label: "Áreas temáticas", href: "/areas-tematicas", icon: Tag },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Usuários", href: "/usuarios", icon: Users },
];
