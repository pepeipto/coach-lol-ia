/** URL del servidor fijada al compilar (`COACH_SERVIDOR` en `npm run build`); vacía si no se fijó. */
declare const __COACH_SERVIDOR__: string | undefined;

const URL_COMPILADA = typeof __COACH_SERVIDOR__ === 'string' ? __COACH_SERVIDOR__ : undefined;
const URL_POR_DEFECTO = 'http://localhost:8080';

let empaquetadaGlobal = false;
/** index.ts lo llama al arrancar con `app.isPackaged`. */
export function marcarEmpaquetada(v: boolean): void {
  empaquetadaGlobal = v;
}

/**
 * URL del servidor de builds. No es un ajuste del usuario (así nunca se queda congelada en
 * ajustes.json): `COACH_SERVIDOR` al ejecutar (solo en desarrollo: la app instalada lo ignora),
 * si no la fijada al compilar, si no localhost.
 */
export function urlServidor(
  env: Record<string, string | undefined> = process.env,
  compilada: string | undefined = URL_COMPILADA,
  empaquetada: boolean = empaquetadaGlobal,
): string {
  return (!empaquetada && env.COACH_SERVIDOR) || compilada || URL_POR_DEFECTO;
}
