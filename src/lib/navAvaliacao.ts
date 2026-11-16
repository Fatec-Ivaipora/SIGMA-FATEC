import { CalendarCheck, LayoutGrid } from "lucide-react";
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
  // Disponibilidade de banca de TCC (2026-11-16) — fora dos dois blocos
  // acima de propósito: avaliador/moderador/orientador podem entrar na
  // banca de TCC, mas nem todo mundo que tem um desses papéis tem os
  // outros (ex.: orientador puro, sem papeisAvaliacao "avaliador") — item
  // único, empurrado uma vez só, em vez de arriscar duplicar se a pessoa
  // acumular mais de um papel de avaliação.
  if (
    temPapel(perfil, "avaliador") ||
    temPapel(perfil, "moderador") ||
    temPapel(perfil, "orientador")
  ) {
    itens.push({ label: "Banca de TCC", href: "/avaliador/banca", icon: CalendarCheck });
  }

  return itens;
}
