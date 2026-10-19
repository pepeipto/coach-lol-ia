import type { Build } from '@coach/shared';

/** Opciones de build de una respuesta del servidor; una build de v1 (sin `opciones`) es su única opción. */
export function opcionesDe(build: Build): Build[] {
  return build.opciones && build.opciones.length > 0 ? build.opciones : [build];
}

/** La build de la opción `i` (la 0 si el índice no existe). */
export function buildDeOpcion(build: Build, i: number): Build {
  const opciones = opcionesDe(build);
  return opciones[i] ?? opciones[0]!;
}

/** El índice es un entero válido para esas opciones. */
export function opcionValida(build: Build, i: unknown): i is number {
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < opcionesDe(build).length;
}
