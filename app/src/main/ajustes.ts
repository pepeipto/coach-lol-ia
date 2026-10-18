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

/** Mezcla un valor desconocido con los ajustes por defecto; los campos con tipo incorrecto vuelven al valor por defecto. */
export function normalizarAjustes(crudo: unknown): Ajustes {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return structuredClone(AJUSTES_POR_DEFECTO);
  const c = crudo as Record<string, unknown>;
  const d = AJUSTES_POR_DEFECTO;
  const avisosCrudos = typeof c.avisos === 'object' && c.avisos !== null ? (c.avisos as Record<string, unknown>) : {};
  const avisos = { ...d.avisos };
  for (const k of Object.keys(avisos) as (keyof Ajustes['avisos'])[]) {
    if (typeof avisosCrudos[k] === 'boolean') avisos[k] = avisosCrudos[k];
  }
  const pos = c.posicionOverlay as { x?: unknown; y?: unknown } | null | undefined;
  return {
    avisos,
    voz: typeof c.voz === 'boolean' ? c.voz : d.voz,
    importacionAutomatica: typeof c.importacionAutomatica === 'boolean' ? c.importacionAutomatica : d.importacionAutomatica,
    teclaOverlay: typeof c.teclaOverlay === 'string' && c.teclaOverlay ? c.teclaOverlay : d.teclaOverlay,
    posicionOverlay:
      pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : d.posicionOverlay,
    urlServidor: typeof c.urlServidor === 'string' && c.urlServidor ? c.urlServidor : d.urlServidor,
  };
}

/** La posición del overlay la guarda el modo mover, nunca la ventana de ajustes: se conserva la ya guardada. */
export function conservarPosicion(nuevos: Ajustes, guardados: Ajustes): Ajustes {
  return { ...nuevos, posicionOverlay: guardados.posicionOverlay };
}

export function cargarAjustes(ruta: string): Ajustes {
  try {
    return normalizarAjustes(JSON.parse(readFileSync(ruta, 'utf8')));
  } catch {
    return structuredClone(AJUSTES_POR_DEFECTO);
  }
}

export function guardarAjustes(ruta: string, a: Ajustes): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(a, null, 2), 'utf8');
}
