import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Ajustes } from '../shared/tiposApp';

declare const __COACH_SERVIDOR__: string | undefined;

const URL_SERVIDOR_POR_DEFECTO =
  (typeof __COACH_SERVIDOR__ === 'string' && __COACH_SERVIDOR__) ||
  process.env.COACH_SERVIDOR ||
  'http://localhost:8080';

export const AJUSTES_POR_DEFECTO: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: false,
  teclaOverlay: 'CommandOrControl+Shift+O',
  posicionOverlay: null,
  urlServidor: URL_SERVIDOR_POR_DEFECTO,
};

export function cargarAjustes(ruta: string): Ajustes {
  try {
    const crudo = JSON.parse(readFileSync(ruta, 'utf8'));
    if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return structuredClone(AJUSTES_POR_DEFECTO);
    return {
      ...AJUSTES_POR_DEFECTO,
      ...crudo,
      avisos: { ...AJUSTES_POR_DEFECTO.avisos, ...(typeof crudo.avisos === 'object' && crudo.avisos ? crudo.avisos : {}) },
    };
  } catch {
    return structuredClone(AJUSTES_POR_DEFECTO);
  }
}

export function guardarAjustes(ruta: string, a: Ajustes): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(a, null, 2), 'utf8');
}
