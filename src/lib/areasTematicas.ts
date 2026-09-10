import type { AreaTematicaComplexa } from "@/lib/data/eventos";

const SEPARADOR = " – ";

/** "{nomeGrupo} – {subArea.nome}" pra cada sub-área — é essa string que
 * entra em Evento.areasTematicas (2026-09-01). */
export function stringsDaAreaComplexa(grupo: AreaTematicaComplexa): string[] {
  return grupo.subAreas.map((s) => `${grupo.nomeGrupo}${SEPARADOR}${s.nome}`);
}

/** Desfaz o "{nomeGrupo} – {subArea.nome}" de uma área temática (relatórios,
 * 2026-09-10) — retorna null se a área não vier de um grupo complexo (área
 * simples, sem sub-áreas dentro). Não depende de carregar
 * areasTematicasComplexas do evento: o separador em si já é a fonte da
 * verdade (mesma constante usada em stringsDaAreaComplexa acima). */
export function separarGrupoSubArea(area: string): { grupo: string; subArea: string } | null {
  const i = area.indexOf(SEPARADOR);
  if (i === -1) return null;
  return { grupo: area.slice(0, i), subArea: area.slice(i + SEPARADOR.length) };
}

/** Recalcula a lista achatada de áreas depois de criar/editar/remover um
 * grupo complexo — troca só as strings desse grupo (identificado por id),
 * preservando áreas simples e as de outros grupos intactas. Passe
 * `grupoNovo: null` pra remover o grupo. */
export function recalcularAreasTematicas(
  areasAtuais: string[],
  grupoAntigo: AreaTematicaComplexa | null,
  grupoNovo: AreaTematicaComplexa | null,
): string[] {
  const stringsAntigas = new Set(grupoAntigo ? stringsDaAreaComplexa(grupoAntigo) : []);
  const base = areasAtuais.filter((a) => !stringsAntigas.has(a));
  const stringsNovas = grupoNovo ? stringsDaAreaComplexa(grupoNovo) : [];
  return Array.from(new Set([...base, ...stringsNovas]));
}
