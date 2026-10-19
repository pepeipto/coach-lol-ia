/**
 * Nombres de campeón (id de Data Dragon, `rawChampionName` de la Live Client Data API o `championName` de Match-v5):
 * no siempre coinciden en mayúsculas (p. ej. «FiddleSticks» y «Fiddlesticks»), así que se comparan sin distinguirlas.
 */
export const claveCampeon = (nombre: string): string => nombre.toLowerCase();

export const mismoCampeon = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && claveCampeon(a) === claveCampeon(b);
