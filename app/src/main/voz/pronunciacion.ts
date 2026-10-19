import type { Idioma } from '../../shared/i18n';

/**
 * Ajustes de pronunciación para la voz natural. El modelo lee el texto tal cual y las letras sueltas o las siglas
 * («sube la R», «tu CS») le salen raras («Argra», «Tus S»): aquí se escriben como se dicen en cada comunidad.
 * Solo toca letras de habilidad (Q W E R) y siglas en mayúsculas sueltas, nunca el resto de la frase.
 */
const LETRAS: Record<Idioma, Partial<Record<string, string>>> = {
  es: { Q: 'cu', W: 'uve doble', E: 'e', R: 'erre' },
  'pt-BR': { Q: 'quê', W: 'dáblio', E: 'é', R: 'erre' },
  fr: { Q: 'ku', W: 'double vé', E: 'eu', R: 'erre' },
  de: { Q: 'Ku', W: 'We', E: 'Eh', R: 'Er' },
  en: {},
};

const SIGLAS: Record<Idioma, Partial<Record<string, string>>> = {
  es: { CS: 'ce ese', KDA: 'ca de a', ADC: 'a de ce', AP: 'a pe', AD: 'a de' },
  'pt-BR': { CS: 'cê esse', KDA: 'cá dê á', ADC: 'á dê cê', AP: 'á pê', AD: 'á dê' },
  fr: { CS: 'cé esse', KDA: 'ka dé a', ADC: 'a dé cé', AP: 'a pé', AD: 'a dé' },
  de: { CS: 'Ce Es', KDA: 'Ka De A', ADC: 'A De Ce', AP: 'A Pe', AD: 'A De' },
  en: { CS: 'C S', KDA: 'K D A', ADC: 'A D C' },
};

/** Texto preparado para la voz natural en `idioma`. */
export function pronunciar(texto: string, idioma: Idioma): string {
  const siglas = SIGLAS[idioma];
  const letras = LETRAS[idioma];
  let t = texto.replace(/\b[A-Z]{2,4}\b/g, (s) => siglas[s] ?? s);
  // Una letra de habilidad suelta, nunca al principio de la frase (la «E» inicial puede ser una palabra).
  t = t.replace(/(?<=\s)([QWER])(?=$|[\s.,;:!?)»"])/g, (l) => letras[l] ?? l);
  return t;
}
