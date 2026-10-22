import * as nodeFs from 'node:fs';

/** Lo que se usa de node:fs (sustituible en las pruebas). */
export interface FsAtomico {
  writeFileSync(ruta: string, datos: string, codificacion: 'utf8'): void;
  renameSync(desde: string, hasta: string): void;
}

/**
 * Escribe el archivo aparte (`<ruta>.tmp`) y lo renombra encima: un cierre o un apagado a medias deja el archivo
 * anterior entero en vez de uno cortado (ajustes, licencia, perfil…). El directorio tiene que existir.
 */
export function escribirAtomico(ruta: string, datos: string, fs: FsAtomico = nodeFs): void {
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, datos, 'utf8');
  fs.renameSync(temporal, ruta);
}
