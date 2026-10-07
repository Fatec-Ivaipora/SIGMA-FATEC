import type { Papel } from "@/lib/auth";

/** Extraído de src/lib/auth.tsx pra cá (2026-10-07, achado real) — esse
 * arquivo aqui NUNCA leva `"use client"`, de propósito. auth.tsx tem (por
 * causa do hook/contexto useAuth), e quando uma rota de SERVIDOR (ex.:
 * /api/usuarios) importa um valor de um módulo `"use client"`, o Next.js
 * substitui TODAS as exportações dele por referências opacas — funciona
 * pra componente React (é pra isso que existe), mas quebra em silêncio
 * qualquer constante comum: `ROTA_POR_PAPEL[papel]` virava `undefined` sem
 * erro nenhum (o e-mail "você foi cadastrado como avaliador" saía com o
 * link `https://sigma.fatecivaipora.com.brundefined`). `Papel` (tipo, não
 * valor) continua seguro de importar de auth.tsx em qualquer lugar — tipo
 * é só compilação, nunca passa por esse problema; só valor em tempo de
 * execução (como esse objeto) precisa morar num arquivo sem `"use client"`
 * pra poder ser lido de dentro de uma rota /api/*. */
export const ROTA_POR_PAPEL: Record<Papel, string> = {
  aluno: "/aluno",
  avaliador: "/avaliador",
  organizacao: "/dashboard",
  admin: "/dashboard",
  orientador: "/orientador",
  moderador: "/avaliador",
};
