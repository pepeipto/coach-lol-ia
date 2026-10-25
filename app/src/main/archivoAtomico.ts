import * as nodeFs from 'node:fs';

/** Lo que se usa de node:fs (sustituible en las pruebas). */
export interface FsAtomico {
  writeFileSync(ruta: string, datos: string, codificacion: 'utf8'): void;
  renameSync(desde: string, hasta: string): void;
  rmSync?(ruta: string, opciones: { force: boolean }): void;
}

/** Intentos de renombrar: en Windows, un antivirus o el indexador pueden tener el archivo abierto un instante. */
const INTENTOS_RENOMBRAR = 3;
const BLOQUEADO = new Set(['EPERM', 'EBUSY', 'EACCES']);

/**
 * Escribe el archivo aparte (`<ruta>.tmp`) y lo renombra encima: un cierre o un apagado a medias deja el archivo
 * anterior entero en vez de uno cortado (ajustes, licencia, perfil…). El directorio tiene que existir. Si el
 * archivo sigue bloqueado tras varios intentos, se escribe directamente (como antes) para no perder el guardado.
 */
export function escribirAtomico(ruta: string, datos: string, fs: FsAtomico = nodeFs): void {
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, datos, 'utf8');
  for (let intento = 1; ; intento++) {
    try {
      fs.renameSync(temporal, ruta);
      return;
    } catch (e) {
      if (!BLOQUEADO.has((e as { code?: unknown } | null)?.code as string)) throw e;
      if (intento < INTENTOS_RENOMBRAR) continue;
      fs.writeFileSync(ruta, datos, 'utf8');
      try {
        fs.rmSync?.(temporal, { force: true });
      } catch {
        // el temporal sobra, pero no impide nada
      }
      return;
    }
  }
}
