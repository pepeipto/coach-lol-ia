import { textosDe, type Idioma } from '../../shared/i18n';

/** Como mucho estas frases se preparan al empezar una partida (el resto se sintetiza al vuelo y queda en caché). */
export const MAX_PRECALENTAR = 160;

const HUECO = /\{(\w+)\}/g;

/**
 * Frases de voz que se pueden preparar antes de la partida, leídas de los textos del idioma (no de la lógica de
 * las frases, para no depender de ella):
 * - todos los textos `voz.*` sin huecos y las frases de fase (`fase.*`);
 * - las plantillas `voz.*` de un solo hueco cuyo valor sale de un grupo conocido de textos: `{objetivo}` con los
 *   nombres de los objetivos y los dragones, `{campamento}` con los campamentos y `{habilidad}` con Q, W, E y R.
 * Las frases con nombres de objetos o campeones se sintetizan al vuelo (y se guardan en la caché de disco).
 */
export function frasesParaPrecalentar(idioma: Idioma, max = MAX_PRECALENTAR): string[] {
  const textos = textosDe(idioma);
  const claves = Object.keys(textos);
  const valoresDe = (prefijos: string[]) => claves.filter((k) => prefijos.some((p) => k.startsWith(p))).map((k) => textos[k]!);
  const objetivos = (ids: string[]) => ids.map((o) => textos[`objetivo.${o}`]).filter((x): x is string => !!x);
  const grupos: Record<string, string[]> = {
    objetivo: [...valoresDe(['voz.dragon.']), ...objetivos(['dragon', 'anciano', 'heraldo', 'baron'])],
    objetivoPlural: objetivos(['larvas']),
    campamento: valoresDe(['jungla.voz.']),
    habilidad: ['Q', 'W', 'E', 'R'],
  };
  const salida = new Set<string>();
  for (const k of claves) {
    const texto = textos[k]!;
    const huecos = [...texto.matchAll(HUECO)].map((m) => m[1]!);
    if (k.startsWith('fase.') && huecos.length === 0) salida.add(texto);
    if (!k.startsWith('voz.') || k.startsWith('voz.dragon.')) continue;
    if (huecos.length === 0) salida.add(texto);
    else if (huecos.length === 1) {
      // Las plantillas en plural (…Plural) solo con los objetivos en plural (las larvas), y al revés.
      const grupo = grupos[huecos[0]! + (k.endsWith('Plural') ? 'Plural' : '')] ?? [];
      for (const valor of grupo) salida.add(texto.replace(HUECO, valor));
    }
  }
  return [...salida].filter((f) => f.trim().length > 0 && f.length <= 300).slice(0, max);
}
