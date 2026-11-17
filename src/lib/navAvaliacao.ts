import { CalendarCheck, LayoutGrid } from "lucide-react";
import { ROTA_POR_PAPEL, temPapel, type PerfilUsuario } from "@/lib/auth";
import { NAV_AVALIADOR } from "@/lib/navAvaliador";
import { NAV_ORIENTADOR } from "@/lib/navOrientador";

/** Menu lateral combinado (2026-08-26) — quem acumula avaliador/moderador
 * com orientador vê os itens dos dois num menu só, sem duplicar "Início"
 * (moderador reaproveita as rotas /avaliador/*, igual orientador já
 * reaproveita avaliadorUid pra atuar como avaliador). Usado em todas as
 * páginas /avaliador/* e /orientador/* no lugar do NAV_AVALIADOR/
 * NAV_ORIENTADOR fixo.
 *
 * Banca de TCC (2026-11-16) — item de menu PRÓPRIO, de propósito
 * (2026-11-17, decisão final do usuário depois de cogitar virar uma aba
 * dentro de "Trabalhos": "pensando em praticidade podemos deixar esse menu
 * banca de TCC porque ajuda a diferenciar e é um evento recorrente na
 * instituição") — fica fora dos dois blocos abaixo, porque
 * avaliador/moderador/orientador podem entrar numa banca de TCC e nem
 * todo mundo que tem um desses papéis tem os outros (ex.: orientador puro,
 * sem papeisAvaliacao "avaliador"); item único, empurrado uma vez só, pra
 * nunca duplicar se a pessoa acumular mais de um papel de avaliação. */
export function navParaPerfil(perfil: PerfilUsuario) {
  const itens = [{ label: "Início", href: ROTA_POR_PAPEL[perfil.papel], icon: LayoutGrid }];

  if (temPapel(perfil, "avaliador") || temPapel(perfil, "moderador")) {
    itens.push(...NAV_AVALIADOR.filter((i) => i.label !== "Início"));
  }
  if (temPapel(perfil, "orientador")) {
    itens.push(...NAV_ORIENTADOR.filter((i) => i.label !== "Início"));
  }
  if (
    temPapel(perfil, "avaliador") ||
    temPapel(perfil, "moderador") ||
    temPapel(perfil, "orientador")
  ) {
    itens.push({ label: "Banca de TCC", href: "/avaliador/banca", icon: CalendarCheck });
  }

  return itens;
}
