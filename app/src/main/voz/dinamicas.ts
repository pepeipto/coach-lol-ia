/*
 * Frases dinámicas de la voz (3.2): los consejos con IA se escriben en el momento, así que la voz pregrabada (Dan Dan)
 * no puede decirlas. Se marcan aquí y el motor las dice SIEMPRE enteras con la voz natural (o la de Windows si no está),
 * aunque por casualidad sus palabras estuvieran en el paquete: nunca se mezclan dos voces en una frase. Es una frase
 * aparte, así que oír la voz natural tras una pregrabada es aceptable.
 */

const MAX = 40;
const textos: string[] = [];

const clave = (texto: string) => texto.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** Marca un texto como dinámico (solo voz natural). */
export function marcarDinamica(texto: string): void {
  const k = clave(texto);
  if (!k || textos.includes(k)) return;
  textos.push(k);
  if (textos.length > MAX) textos.shift();
}

/** El texto se marcó como dinámico. */
export function esDinamica(texto: string): boolean {
  return textos.includes(clave(texto));
}

/** Pruebas. */
export function olvidarDinamicas(): void {
  textos.length = 0;
}
