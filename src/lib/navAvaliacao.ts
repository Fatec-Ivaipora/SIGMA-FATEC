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
 * instituição") — avaliador/moderador/orientador podem entrar numa banca
 * de TCC, então entra pro mesmo bloco de NAV_AVALIADOR em vez de um bloco
 * à parte. Posição fixa: logo depois de "Trabalhos", antes de
 * "Certificações" (2026-11-17, pedido explícito do usuário — "banca de tcc
 * fica em baixo de trabalhos") — por isso NAV_AVALIADOR é filtrado em duas
 * partes aqui (Eventos+Trabalhos, depois Certificações) em vez de inteiro
 * de uma vez.
 *
 * Orientador também ganha NAV_AVALIADOR agora (2026-11-17, pedido
 * explícito do usuário testando o fluxo de TCC — "Eventos"/"Trabalhos"
 * como qualquer outro avaliador) — antes só avaliador/moderador viam esses
 * itens; orientador puro nunca alcançava "Eventos"/"Trabalhos", só os de
 * NAV_ORIENTADOR. As 3 páginas (/avaliador/eventos, /avaliador/trabalhos,
 * /avaliador/certificacoes) também tiveram o próprio useRequireAuth
 * ampliado pra aceitar "orientador" — sem isso o link levaria a pessoa até
 * lá só pra ser redirecionada de volta. */
export function navParaPerfil(perfil: PerfilUsuario) {
  const itens = [{ label: "Início", href: ROTA_POR_PAPEL[perfil.papel], icon: LayoutGrid }];

  const souAvaliacao =
    temPapel(perfil, "avaliador") || temPapel(perfil, "moderador") || temPapel(perfil, "orientador");

  if (souAvaliacao) {
    itens.push(...NAV_AVALIADOR.filter((i) => i.label === "Eventos" || i.label === "Trabalhos"));
    itens.push({ label: "Banca de TCC", href: "/avaliador/banca", icon: CalendarCheck });
    itens.push(...NAV_AVALIADOR.filter((i) => i.label === "Certificações"));
  }
  if (temPapel(perfil, "orientador")) {
    itens.push(...NAV_ORIENTADOR.filter((i) => i.label !== "Início"));
  }

  return itens;
}
