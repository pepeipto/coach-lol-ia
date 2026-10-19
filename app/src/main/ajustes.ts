import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Ajustes } from '../shared/tiposApp';

export const AJUSTES_POR_DEFECTO: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: false,
  teclaOverlay: 'CommandOrControl+Shift+O',
  posicionOverlay: null,
  bienvenidaVista: false,
  ultimaVersionVista: null,
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
    bienvenidaVista: typeof c.bienvenidaVista === 'boolean' ? c.bienvenidaVista : d.bienvenidaVista,
    ultimaVersionVista: typeof c.ultimaVersionVista === 'string' && c.ultimaVersionVista ? c.ultimaVersionVista : d.ultimaVersionVista,
  };
}

/** La posición del overlay la guarda el modo mover, nunca la ventana de ajustes: se conserva la ya guardada. */
export function conservarPosicion(nuevos: Ajustes, guardados: Ajustes): Ajustes {
  return { ...nuevos, posicionOverlay: guardados.posicionOverlay };
}

export function cargarAjustes(ruta: string): Ajustes {
  try {
    const crudo: unknown = JSON.parse(readFileSync(ruta, 'utf8'));
    const a = normalizarAjustes(crudo);
    // Un ajustes.json de una versión anterior (sin el campo) es de alguien que ya usaba la app:
    // no ve la bienvenida, sino las novedades de esta versión. Sin archivo es una instalación nueva.
    if (typeof crudo === 'object' && crudo !== null && !Array.isArray(crudo) && !('bienvenidaVista' in crudo)) {
      a.bienvenidaVista = true;
    }
    return a;
  } catch {
    return structuredClone(AJUSTES_POR_DEFECTO);
  }
}

export function guardarAjustes(ruta: string, a: Ajustes): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(a, null, 2), 'utf8');
}
