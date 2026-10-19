import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Ajustes, AjustesOverlay, ConfigWidget, IdCampamento, IdWidget, TipoVoz } from '../shared/tiposApp';

export const WIDGETS: IdWidget[] = ['objetivos', 'habilidad', 'cs', 'compra', 'jungla', 'avisos'];
export const TIPOS_VOZ: TipoVoz[] = ['objetivo', 'compra', 'habilidad', 'cs', 'vision', 'fase', 'jungla'];
export const CAMPAMENTOS_JUNGLA: IdCampamento[] = ['azul', 'gromp', 'lobos', 'aviar', 'rojo', 'krugs', 'escarabajoArriba', 'escarabajoAbajo'];
export const ESCALA_MIN = 0.75;
export const ESCALA_MAX = 1.5;
export const OPACIDAD_MIN = 0.5;

const widget = (activo: boolean): ConfigWidget => ({ activo, x: null, y: null, escala: 1 });

export const OVERLAY_POR_DEFECTO: AjustesOverlay = {
  widgets: {
    objetivos: widget(true),
    habilidad: widget(true),
    cs: widget(true),
    compra: widget(true),
    // Los temporizadores de la jungla son manuales y opcionales: apagados por defecto.
    jungla: widget(false),
    avisos: widget(true),
  },
  opacidad: 0.95,
  voz: {
    activa: false,
    volumen: 0.8,
    vozId: null,
    tipos: { objetivo: true, compra: true, habilidad: true, cs: true, vision: true, fase: true, jungla: true },
  },
};

export const AJUSTES_POR_DEFECTO: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: false,
  teclaOverlay: 'CommandOrControl+Shift+O',
  posicionOverlay: null,
  bienvenidaVista: false,
  ultimaVersionVista: null,
  overlay: OVERLAY_POR_DEFECTO,
  teclasJungla: {},
};

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const coordenada = (v: unknown): number | null => (numero(v) ? Math.round(v) : null);

function normalizarWidget(crudo: unknown, d: ConfigWidget): ConfigWidget {
  if (!esObj(crudo)) return { ...d };
  return {
    activo: typeof crudo.activo === 'boolean' ? crudo.activo : d.activo,
    x: 'x' in crudo ? coordenada(crudo.x) : d.x,
    y: 'y' in crudo ? coordenada(crudo.y) : d.y,
    escala: numero(crudo.escala) ? acotar(crudo.escala, ESCALA_MIN, ESCALA_MAX) : d.escala,
  };
}

/**
 * Sección `overlay`. Si falta (ajustes de la 2.x), se migra: la voz antigua pasa a `voz.activa` y la
 * posición del panel fijo, que llevaba los avisos debajo, pasa al widget de avisos.
 */
function normalizarOverlay(c: Obj): AjustesOverlay {
  const d = OVERLAY_POR_DEFECTO;
  const crudo = esObj(c.overlay) ? c.overlay : null;
  const widgetsCrudos = crudo && esObj(crudo.widgets) ? crudo.widgets : {};
  const widgets = {} as AjustesOverlay['widgets'];
  for (const id of WIDGETS) widgets[id] = normalizarWidget(widgetsCrudos[id], d.widgets[id]);
  if (!crudo) {
    const pos = c.posicionOverlay;
    if (esObj(pos) && numero(pos.x) && numero(pos.y)) widgets.avisos = { ...widgets.avisos, x: Math.round(pos.x), y: Math.round(pos.y) };
  }

  const vozCruda = crudo && esObj(crudo.voz) ? crudo.voz : {};
  const tiposCrudos = esObj(vozCruda.tipos) ? vozCruda.tipos : {};
  const tipos = { ...d.voz.tipos };
  for (const k of TIPOS_VOZ) if (typeof tiposCrudos[k] === 'boolean') tipos[k] = tiposCrudos[k];
  const vozAntigua = typeof c.voz === 'boolean' ? c.voz : d.voz.activa;
  return {
    widgets,
    opacidad: crudo && numero(crudo.opacidad) ? acotar(crudo.opacidad, OPACIDAD_MIN, 1) : d.opacidad,
    voz: {
      activa: typeof vozCruda.activa === 'boolean' ? vozCruda.activa : vozAntigua,
      volumen: numero(vozCruda.volumen) ? acotar(vozCruda.volumen, 0, 1) : d.voz.volumen,
      vozId: typeof vozCruda.vozId === 'string' && vozCruda.vozId ? vozCruda.vozId : null,
      tipos,
    },
  };
}

function normalizarTeclasJungla(crudo: unknown): Ajustes['teclasJungla'] {
  const salida: Ajustes['teclasJungla'] = {};
  if (!esObj(crudo)) return salida;
  for (const id of CAMPAMENTOS_JUNGLA) {
    const tecla = crudo[id];
    if (typeof tecla === 'string' && tecla.trim()) salida[id] = tecla.trim();
  }
  return salida;
}

/** Mezcla un valor desconocido con los ajustes por defecto; los campos con tipo incorrecto vuelven al valor por defecto. */
export function normalizarAjustes(crudo: unknown): Ajustes {
  if (!esObj(crudo)) return structuredClone(AJUSTES_POR_DEFECTO);
  const c = crudo;
  const d = AJUSTES_POR_DEFECTO;
  const avisosCrudos = esObj(c.avisos) ? c.avisos : {};
  const avisos = { ...d.avisos };
  for (const k of Object.keys(avisos) as (keyof Ajustes['avisos'])[]) {
    if (typeof avisosCrudos[k] === 'boolean') avisos[k] = avisosCrudos[k];
  }
  const pos = c.posicionOverlay as { x?: unknown; y?: unknown } | null | undefined;
  const overlay = normalizarOverlay(c);
  return {
    avisos,
    // Reflejo de overlay.voz.activa, para quien lea el campo antiguo.
    voz: overlay.voz.activa,
    importacionAutomatica: typeof c.importacionAutomatica === 'boolean' ? c.importacionAutomatica : d.importacionAutomatica,
    teclaOverlay: typeof c.teclaOverlay === 'string' && c.teclaOverlay ? c.teclaOverlay : d.teclaOverlay,
    posicionOverlay:
      pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : d.posicionOverlay,
    bienvenidaVista: typeof c.bienvenidaVista === 'boolean' ? c.bienvenidaVista : d.bienvenidaVista,
    ultimaVersionVista: typeof c.ultimaVersionVista === 'string' && c.ultimaVersionVista ? c.ultimaVersionVista : d.ultimaVersionVista,
    overlay,
    teclasJungla: normalizarTeclasJungla(c.teclasJungla),
  };
}

/**
 * Las posiciones del overlay las guarda el modo mover, nunca la ventana de ajustes: se conservan
 * las ya guardadas (la del panel antiguo y la de cada widget); el resto llega de la ventana.
 */
export function conservarPosicion(nuevos: Ajustes, guardados: Ajustes): Ajustes {
  const widgets = { ...nuevos.overlay.widgets };
  for (const id of WIDGETS) {
    const g = guardados.overlay.widgets[id];
    widgets[id] = { ...widgets[id], x: g.x, y: g.y };
  }
  return { ...nuevos, posicionOverlay: guardados.posicionOverlay, overlay: { ...nuevos.overlay, widgets } };
}

/** Guarda las posiciones que deja el modo mover en la sección de cada widget. */
export function aplicarPosiciones(a: Ajustes, posiciones: Partial<Record<IdWidget, { x: number; y: number }>>): Ajustes {
  const widgets = { ...a.overlay.widgets };
  for (const id of WIDGETS) {
    const p = posiciones[id];
    if (p) widgets[id] = { ...widgets[id], x: Math.round(p.x), y: Math.round(p.y) };
  }
  return { ...a, overlay: { ...a.overlay, widgets } };
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
