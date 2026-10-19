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

/** Clave de i18n de la app para el rasgo de una etiqueta de Data Dragon, y la de mecánicas exigentes. */
export const claveRasgo = (tag: string) => `carga.rasgo.${tag}`;
export const CLAVE_DIFICULTAD_ALTA = 'carga.rasgo.dificil';

/** Rasgos con su clave de i18n (la app los enseña en su idioma; el texto en español queda para apps anteriores). */
export function rasgosConClaveDe(tags: string[], dificultad: number): { texto: string; clave: string }[] {
  const rasgos: { texto: string; clave: string }[] = [];
  const principal = tags.find((t) => RASGOS_POR_ETIQUETA[t]);
  if (principal) rasgos.push({ texto: RASGOS_POR_ETIQUETA[principal]!, clave: claveRasgo(principal) });
  if (dificultad >= DIFICULTAD_ALTA) rasgos.push({ texto: TEXTO_DIFICULTAD_ALTA, clave: CLAVE_DIFICULTAD_ALTA });
  return rasgos;
}

/** Rasgos del campeón: el de su etiqueta principal y, si es muy difícil, que tiene mecánicas exigentes. */
export function rasgosDe(tags: string[], dificultad: number): string[] {
  return rasgosConClaveDe(tags, dificultad).map((r) => r.texto);
}
