/**
 * Segmentos de la voz pregrabada (3.1). Una frase suena con la voz pregrabada solo si se puede escribir ENTERA
 * como una sucesión de segmentos del paquete (partes fijas de las plantillas y valores como nombres de objetos,
 * campeones o números). Si falta uno, la frase entera sale con la voz natural: nunca se mezclan dos voces.
 * Lo usan la app (para buscar) y el generador del paquete (para crear las claves).
 */

/** Clave de un segmento: minúsculas, sin signos de puntuación y con los espacios simplificados (conserva tildes). */
export function normalizarSegmento(texto: string): string {
  return texto
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Como mucho este número de palabras por segmento (las frases fijas más largas caben de sobra). */
export const MAX_PALABRAS_SEGMENTO = 40;

/**
 * Divide una frase en segmentos del paquete con el menor número de piezas (programación dinámica sobre las
 * palabras). Devuelve las claves en orden, o null si alguna parte de la frase no está en el paquete.
 */
export function segmentar(texto: string, tiene: (clave: string) => boolean): string[] | null {
  const palabras = normalizarSegmento(texto).split(' ').filter(Boolean);
  if (palabras.length === 0) return null;
  const n = palabras.length;
  // mejor[i]: menor número de segmentos que cubren las i primeras palabras; desde[i]: dónde empieza el último.
  const mejor = new Array<number>(n + 1).fill(Infinity);
  const desde = new Array<number>(n + 1).fill(-1);
  mejor[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_PALABRAS_SEGMENTO); j < i; j++) {
      if (mejor[j]! + 1 >= mejor[i]!) continue;
      if (tiene(palabras.slice(j, i).join(' '))) {
        mejor[i] = mejor[j]! + 1;
        desde[i] = j;
      }
    }
  }
  if (!Number.isFinite(mejor[n])) return null;
  const claves: string[] = [];
  for (let i = n; i > 0; i = desde[i]!) claves.unshift(palabras.slice(desde[i]!, i).join(' '));
  return claves;
}

/** Pausa tras un clip según cómo acaba su texto: coma o dos puntos, una pausa corta; punto, una más larga. */
export function pausaTras(textoClip: string): number {
  const t = textoClip.trim();
  if (/[.!?…]$/.test(t)) return 280;
  if (/[,;:]$/.test(t)) return 160;
  return 0;
}

export interface SegmentoManifest {
  /** Archivo del clip dentro de la carpeta del idioma. */
  archivo: string;
  /** Texto con el que se generó (con su puntuación). */
  texto: string;
}

export interface ManifestPack {
  version: 1;
  idioma: string;
  vozId: string;
  modelo: string;
  fecha: string;
  segmentos: Record<string, SegmentoManifest>;
}

/** Valida un manifest leído de disco (lo justo para no fallar con uno dañado). */
export function esManifest(v: unknown): v is ManifestPack {
  const m = v as Partial<ManifestPack> | null;
  if (!m || m.version !== 1 || typeof m.segmentos !== 'object' || m.segmentos === null) return false;
  return Object.values(m.segmentos).every(
    (s) => !!s && typeof s.archivo === 'string' && /^[a-z0-9]{8,64}\.(mp3|ogg|opus|wav)$/.test(s.archivo) && typeof s.texto === 'string',
  );
}
