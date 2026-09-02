import type { AreaTematicaComplexa } from "@/lib/data/eventos";

/** "{nomeGrupo} – {subArea.nome}" pra cada sub-área — é essa string que
 * entra em Evento.areasTematicas (2026-09-01). */
export function stringsDaAreaComplexa(grupo: AreaTematicaComplexa): string[] {
  return grupo.subAreas.map((s) => `${grupo.nomeGrupo} – ${s.nome}`);
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
