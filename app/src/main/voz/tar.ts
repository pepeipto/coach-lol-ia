import { closeSync, mkdirSync, openSync, readSync, writeSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Tar (ustar) mínimo para los paquetes de voz: solo archivos normales y carpetas, sin enlaces. Escribir sirve a la
 * herramienta que genera el paquete; leer, a la app que lo instala. Los nombres se validan: nada absoluto, nada de
 * «..» y solo caracteres seguros, para que un paquete manipulado no pueda escribir fuera de su carpeta.
 */

const BLOQUE = 512;
const NOMBRE_SEGURO = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function nombreSeguro(nombre: string): boolean {
  return NOMBRE_SEGURO.test(nombre) && !nombre.split('/').some((p) => p === '..' || p === '.') && nombre.length <= 100;
}

function octal(valor: number, largo: number): string {
  return valor.toString(8).padStart(largo - 1, '0') + '\0';
}

function cabecera(nombre: string, tamano: number, tipo: '0' | '5'): Buffer {
  const h = Buffer.alloc(BLOQUE, 0);
  h.write(nombre, 0, 100, 'utf8');
  h.write(octal(tipo === '5' ? 0o755 : 0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(tamano, 12), 124, 'ascii');
  // Fecha fija: el mismo contenido da siempre el mismo paquete (y la misma suma SHA-256).
  h.write(octal(0, 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write(tipo, 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  let suma = 0;
  for (const b of h) suma += b;
  h.write(octal(suma, 7) + ' ', 148, 'ascii');
  return h;
}

export interface EntradaTar {
  nombre: string;
  datos: Buffer;
}

/** Tar de las entradas, en el orden dado (con las carpetas intermedias). */
export function escribirTar(entradas: EntradaTar[]): Buffer {
  const partes: Buffer[] = [];
  const carpetas = new Set<string>();
  for (const e of entradas) {
    if (!nombreSeguro(e.nombre)) throw new Error(`Nombre no válido en el paquete: ${e.nombre}`);
    const trozos = e.nombre.split('/');
    for (let i = 1; i < trozos.length; i++) {
      const carpeta = `${trozos.slice(0, i).join('/')}/`;
      if (carpetas.has(carpeta)) continue;
      carpetas.add(carpeta);
      partes.push(cabecera(carpeta, 0, '5'));
    }
    partes.push(cabecera(e.nombre, e.datos.length, '0'), e.datos);
    const relleno = (BLOQUE - (e.datos.length % BLOQUE)) % BLOQUE;
    if (relleno) partes.push(Buffer.alloc(relleno, 0));
  }
  partes.push(Buffer.alloc(BLOQUE * 2, 0));
  return Buffer.concat(partes);
}

const leerTexto = (b: Buffer, ini: number, largo: number) => b.toString('utf8', ini, ini + largo).replace(/\0.*$/s, '');
const leerOctal = (b: Buffer, ini: number, largo: number) => {
  const t = b.toString('ascii', ini, ini + largo).replace(/\0.*$/s, '').trim();
  if (!/^[0-7]*$/.test(t)) throw new Error('Paquete de voz dañado (cabecera)');
  return t ? parseInt(t, 8) : 0;
};

/** Extrae un .tar del disco a `destino`. Devuelve los archivos extraídos (rutas relativas con «/»). */
export function extraerTar(rutaTar: string, destino: string): string[] {
  const raiz = resolve(destino);
  mkdirSync(raiz, { recursive: true });
  const fd = openSync(rutaTar, 'r');
  const extraidos: string[] = [];
  try {
    const h = Buffer.alloc(BLOQUE);
    const trozo = Buffer.alloc(1024 * 1024);
    let pos = 0;
    for (;;) {
      if (readSync(fd, h, 0, BLOQUE, pos) < BLOQUE) throw new Error('Paquete de voz incompleto');
      pos += BLOQUE;
      if (h.every((b) => b === 0)) break;
      let suma = 0;
      for (let i = 0; i < BLOQUE; i++) suma += i >= 148 && i < 156 ? 32 : h[i]!;
      if (suma !== leerOctal(h, 148, 8)) throw new Error('Paquete de voz dañado (suma de cabecera)');
      const prefijo = leerTexto(h, 345, 155);
      const nombre = (prefijo ? `${prefijo}/` : '') + leerTexto(h, 0, 100);
      const tamano = leerOctal(h, 124, 12);
      const tipo = String.fromCharCode(h[156] || 48);
      const limpio = nombre.replace(/\/$/, '');
      if (!nombreSeguro(limpio)) throw new Error(`Nombre no válido en el paquete: ${nombre}`);
      const ruta = resolve(raiz, ...limpio.split('/'));
      if (!ruta.startsWith(raiz + sep)) throw new Error(`Ruta fuera del paquete: ${nombre}`);
      if (tipo === '5') mkdirSync(ruta, { recursive: true });
      else if (tipo === '0') {
        mkdirSync(dirname(ruta), { recursive: true });
        const salida = openSync(ruta, 'w');
        try {
          let quedan = tamano;
          let p = pos;
          while (quedan > 0) {
            const n = readSync(fd, trozo, 0, Math.min(trozo.length, quedan), p);
            if (n <= 0) throw new Error('Paquete de voz incompleto');
            writeSync(salida, trozo, 0, n);
            quedan -= n;
            p += n;
          }
        } finally {
          closeSync(salida);
        }
        extraidos.push(limpio);
      } else throw new Error(`Tipo de entrada no admitido en el paquete: ${tipo}`);
      pos += Math.ceil(tamano / BLOQUE) * BLOQUE;
    }
  } finally {
    closeSync(fd);
  }
  return extraidos;
}

/** Ruta de un archivo del paquete dentro de su carpeta. */
export const rutaEnPaquete = (dir: string, nombre: string) => join(dir, ...nombre.split('/'));
