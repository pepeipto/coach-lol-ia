import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { escribirAtomico } from '../archivoAtomico';
import type { EntradaAnalisis } from '../../shared/tiposApp';
import { esAnalisis } from './clienteIa';

/*
 * Historial local de los análisis con IA (3.2): userData/analisis.json con los 50 últimos, del más reciente al más
 * antiguo. Solo en este equipo; nunca se sube a ningún sitio.
 */

export const MAX_HISTORIAL = 50;

function esEntrada(v: unknown): v is EntradaAnalisis {
  const e = v as EntradaAnalisis | null;
  return (
    !!e &&
    typeof e.id === 'string' &&
    typeof e.fecha === 'string' &&
    typeof e.campeon === 'string' &&
    typeof e.duracion === 'number' &&
    !!e.final &&
    Array.isArray(e.linea) &&
    Array.isArray(e.muertes) &&
    esAnalisis(e.analisis)
  );
}

export interface HistorialAnalisis {
  lista(): EntradaAnalisis[];
  agregar(e: EntradaAnalisis): void;
}

/** Historial guardado en `ruta`. Un archivo dañado o de otra versión se ignora (se empieza de cero). */
export function crearHistorial(ruta: string): HistorialAnalisis {
  let cache: EntradaAnalisis[] | null = null;
  const leer = (): EntradaAnalisis[] => {
    if (cache) return cache;
    try {
      const crudo: unknown = JSON.parse(readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
      const lista = Array.isArray(crudo) ? crudo : (crudo as { analisis?: unknown } | null)?.analisis;
      cache = (Array.isArray(lista) ? lista : []).filter(esEntrada).slice(0, MAX_HISTORIAL);
    } catch {
      cache = [];
    }
    return cache;
  };
  return {
    lista: () => [...leer()],
    agregar(e) {
      cache = [e, ...leer().filter((x) => x.id !== e.id)].slice(0, MAX_HISTORIAL);
      mkdirSync(dirname(ruta), { recursive: true });
      // Se escribe aparte y se renombra: un cierre a medias no deja el historial roto.
      escribirAtomico(ruta, JSON.stringify({ version: 1, analisis: cache }));
    },
  };
}
