import { LayoutGrid } from "lucide-react";
import { ROTA_POR_PAPEL, temPapel, type PerfilUsuario } from "@/lib/auth";
import { NAV_AVALIADOR } from "@/lib/navAvaliador";
import { NAV_ORIENTADOR } from "@/lib/navOrientador";

/** Menu lateral combinado (2026-08-26) — quem acumula avaliador/moderador
 * com orientador vê os itens dos dois num menu só, sem duplicar "Início"
 * (moderador reaproveita as rotas /avaliador/*, igual orientador já
 * reaproveita avaliadorUid pra atuar como avaliador). Usado em todas as
 * páginas /avaliador/* e /orientador/* no lugar do NAV_AVALIADOR/
 * NAV_ORIENTADOR fixo. */
export function navParaPerfil(perfil: PerfilUsuario) {
  const itens = [{ label: "Início", href: ROTA_POR_PAPEL[perfil.papel], icon: LayoutGrid }];

  if (temPapel(perfil, "avaliador") || temPapel(perfil, "moderador")) {
    itens.push(...NAV_AVALIADOR.filter((i) => i.label !== "Início"));
  }
  if (temPapel(perfil, "orientador")) {
    itens.push(...NAV_ORIENTADOR.filter((i) => i.label !== "Início"));
  }

  return itens;
}
