// Lee las novedades de CHANGELOG.md (en la raíz del repositorio) al compilar la web.
// Sin dependencias de Astro para poder probarlo también desde las pruebas.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Version {
  version: string;
  /** Fecha AAAA-MM-DD tal y como aparece en el CHANGELOG. */
  fecha: string;
  puntos: string[];
}

/** Trozos de un punto: texto normal o `código`. Se pintan sin innerHTML. */
export type Trozo = { codigo: boolean; texto: string };

const CABECERA = /^##\s+\[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/;

/** Convierte el CHANGELOG (formato «## [x.y.z] - AAAA-MM-DD» y una lista de puntos) en versiones. */
export function interpretarChangelog(texto: string): Version[] {
  const versiones: Version[] = [];
  let actual: Version | null = null;
  for (const linea of texto.split(/\r?\n/)) {
    const cab = CABECERA.exec(linea.trim());
    if (cab) {
      actual = { version: cab[1], fecha: cab[2], puntos: [] };
      versiones.push(actual);
      continue;
    }
    if (!actual) continue;
    if (/^##\s/.test(linea)) {
      actual = null;
      continue;
    }
    const punto = /^\s*[-*]\s+(.*)$/.exec(linea);
    if (punto) actual.puntos.push(punto[1].trim());
    else if (linea.trim() && actual.puntos.length > 0 && /^\s+/.test(linea)) {
      // Continuación de un punto partido en varias líneas.
      actual.puntos[actual.puntos.length - 1] += ` ${linea.trim()}`;
    }
  }
  return versiones;
}

/** Separa los fragmentos entre comillas invertidas para pintarlos como código. */
export function trozos(punto: string): Trozo[] {
  return punto
    .split('`')
    .map((texto, i) => ({ codigo: i % 2 === 1, texto }))
    .filter((t) => t.texto !== '');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-10-19» → «19 de octubre de 2026». */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** Lee ../CHANGELOG.md respecto a la carpeta web/ (donde se ejecutan `astro build` y las pruebas). */
export function leerNovedades(ruta = resolve(process.cwd(), '..', 'CHANGELOG.md')): Version[] {
  return interpretarChangelog(readFileSync(ruta, 'utf8'));
}
