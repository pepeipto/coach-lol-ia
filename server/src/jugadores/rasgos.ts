/**
 * Rasgos del campeón (no del jugador) para la pantalla de carga, a partir de sus etiquetas de Data
 * Dragon y de su dificultad. Políticas de Riot: solo hechos neutros sobre el estilo del campeón;
 * nunca valoraciones negativas de nadie.
 */
export const RASGOS_POR_ETIQUETA: Record<string, string> = {
  Assassin: 'Fuerte al principio',
  Fighter: 'Fuerte en peleas largas',
  Mage: 'Daño mágico en área',
  Marksman: 'Escala a final de partida',
  Support: 'Protege a su equipo',
  Tank: 'Inicia las peleas',
};

/** Dificultad de Data Dragon a partir de la cual se indica que el campeón es exigente. */
export const DIFICULTAD_ALTA = 8;
export const TEXTO_DIFICULTAD_ALTA = 'Mecánicas exigentes';

/** Rasgos del campeón: el de su etiqueta principal y, si es muy difícil, que tiene mecánicas exigentes. */
export function rasgosDe(tags: string[], dificultad: number): string[] {
  const rasgos: string[] = [];
  const principal = tags.find((t) => RASGOS_POR_ETIQUETA[t]);
  if (principal) rasgos.push(RASGOS_POR_ETIQUETA[principal]!);
  if (dificultad >= DIFICULTAD_ALTA) rasgos.push(TEXTO_DIFICULTAD_ALTA);
  return rasgos;
}
