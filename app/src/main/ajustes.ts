import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { esIdioma, IDIOMA_POR_DEFECTO, type Idioma } from '../shared/i18n';
import { NIVEL_POR_DEFECTO, TIPOS_VOZ as TIPOS_VOZ_COMPARTIDOS, tiposDeNivel } from '../shared/vozCategorias';
import { esIdVozNatural } from './voz/catalogo';
import type { Ajustes, AjustesCarga, AjustesIa, AjustesOverlay, AjustesVoz, CalibracionHabilidad, ConfigWidget, IdCampamento, IdWidget, ModoPantallaCarga, Tema, TipoVoz } from '../shared/tiposApp';

export const WIDGETS: IdWidget[] = ['objetivos', 'habilidad', 'cs', 'compra', 'jungla', 'avisos'];
/** Categorías de la voz (3.1: viven en shared/vozCategorias.ts, que también usa la vista Overlay). */
export const TIPOS_VOZ: readonly TipoVoz[] = TIPOS_VOZ_COMPARTIDOS;
export const CAMPAMENTOS_JUNGLA: IdCampamento[] = ['azul', 'gromp', 'lobos', 'aviar', 'rojo', 'krugs', 'escarabajoArriba', 'escarabajoAbajo'];
export const TEMAS: Tema[] = ['clasico', 'sombra'];
export const TEMA_POR_DEFECTO: Tema = 'clasico';
export const esTema = (v: unknown): v is Tema => TEMAS.includes(v as Tema);
export const ESCALA_MIN = 0.75;
export const ESCALA_MAX = 1.5;
export const OPACIDAD_MIN = 0.5;

const widget = (activo: boolean): ConfigWidget => ({ activo, x: null, y: null, escala: 1 });

export const OVERLAY_POR_DEFECTO: AjustesOverlay = {
  widgets: {
    objetivos: widget(true),
    habilidad: widget(true),
    cs: widget(true),
    // 3.0.1: sin avisos emergentes por defecto (la voz sigue avisando); se pueden encender en la vista Overlay.
    compra: widget(false),
    // Los temporizadores de la jungla son manuales y opcionales: apagados por defecto.
    jungla: widget(false),
    avisos: widget(false),
  },
  opacidad: 0.95,
  voz: {
    activa: false,
    volumen: 0.8,
    vozId: null,
    // 3.1: nivel de detalle «Normal». Unos ajustes anteriores conservan sus interruptores y estrenan las categorías
    // nuevas con los valores de «Normal».
    tipos: tiposDeNivel(NIVEL_POR_DEFECTO),
    // 3.1: voz pregrabada de Coach LoL IA por defecto (si hay paquete del idioma), con la natural y la de Windows de reserva.
    motor: 'pack',
    vocesNaturales: {},
  },
  jungla: { presentacion: 'minimapa', minimapa: null },
  // 3.1: la pantalla de carga tapa toda la pantalla y Espacio la oculta.
  carga: { modo: 'completa', ocultarConEspacio: true },
};

export const MODOS_PANTALLA_CARGA: ModoPantallaCarga[] = ['completa', 'tarjetas', 'desactivada'];

/**
 * Sección `overlay.carga` (3.1). Sin ella (ajustes de la 3.0.x) o con valores raros, los de por defecto: pantalla
 * completa y Espacio para ocultarla.
 */
export function normalizarCarga(crudo: unknown): AjustesCarga {
  const d = OVERLAY_POR_DEFECTO.carga;
  if (!esObj(crudo)) return { ...d };
  return {
    modo: MODOS_PANTALLA_CARGA.includes(crudo.modo as ModoPantallaCarga) ? (crudo.modo as ModoPantallaCarga) : d.modo,
    ocultarConEspacio: typeof crudo.ocultarConEspacio === 'boolean' ? crudo.ocultarConEspacio : d.ocultarConEspacio,
  };
}

/** Límites del lado del minimapa (fracción del alto de la pantalla). */
export const LADO_MINIMAPA_MIN = 0.08;
export const LADO_MINIMAPA_MAX = 0.6;

/** 3.2: coach con IA. Encendido por defecto; los consejos, como mucho 6 por partida (1-8). */
export const MAX_CONSEJOS_MIN = 1;
export const MAX_CONSEJOS_MAX = 8;
export const IA_POR_DEFECTO: AjustesIa = { analisis: true, consejos: true, maxConsejos: 6, vozAnalisis: true };

/** Sección `ia` (3.2). Sin ella (ajustes anteriores) o con valores raros, los de por defecto. */
export function normalizarIa(crudo: unknown): AjustesIa {
  const d = IA_POR_DEFECTO;
  if (!esObj(crudo)) return { ...d };
  return {
    analisis: typeof crudo.analisis === 'boolean' ? crudo.analisis : d.analisis,
    consejos: typeof crudo.consejos === 'boolean' ? crudo.consejos : d.consejos,
    maxConsejos: numero(crudo.maxConsejos) ? acotar(Math.round(crudo.maxConsejos), MAX_CONSEJOS_MIN, MAX_CONSEJOS_MAX) : d.maxConsejos,
    vozAnalisis: typeof crudo.vozAnalisis === 'boolean' ? crudo.vozAnalisis : d.vozAnalisis,
  };
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: false,
  sustituirPaginaSinPreguntar: false,
  teclaOverlay: 'CommandOrControl+Shift+O',
  posicionOverlay: null,
  bienvenidaVista: false,
  ultimaVersionVista: null,
  overlay: OVERLAY_POR_DEFECTO,
  teclasJungla: {},
  teclaJungla: 'Alt+Shift+L',
  junglaEnemiga: { avisos: true, ruta: false },
  idioma: IDIOMA_POR_DEFECTO,
  avisosEmergentesMigrados: true,
  tema: TEMA_POR_DEFECTO,
  ia: IA_POR_DEFECTO,
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
  const calibracionHabilidad = normalizarCalibracion(crudo?.calibracionHabilidad);
  return {
    jungla: normalizarJungla(crudo?.jungla),
    carga: normalizarCarga(crudo?.carga),
    ...(Object.keys(calibracionHabilidad).length ? { calibracionHabilidad } : {}),
    widgets,
    opacidad: crudo && numero(crudo.opacidad) ? acotar(crudo.opacidad, OPACIDAD_MIN, 1) : d.opacidad,
    voz: {
      activa: typeof vozCruda.activa === 'boolean' ? vozCruda.activa : vozAntigua,
      volumen: numero(vozCruda.volumen) ? acotar(vozCruda.volumen, 0, 1) : d.voz.volumen,
      vozId: typeof vozCruda.vozId === 'string' && vozCruda.vozId ? vozCruda.vozId : null,
      tipos,
      motor: vozCruda.motor === 'sistema' || vozCruda.motor === 'natural' || vozCruda.motor === 'pack' ? vozCruda.motor : d.voz.motor,
      vocesNaturales: normalizarVocesNaturales(vozCruda.vocesNaturales),
    },
  };
}

/** 3.1: voz natural elegida por idioma; solo idiomas de la app con un id del catálogo. */
function normalizarVocesNaturales(crudo: unknown): AjustesVoz['vocesNaturales'] {
  const salida: AjustesVoz['vocesNaturales'] = {};
  if (!esObj(crudo)) return salida;
  for (const [idioma, id] of Object.entries(crudo)) if (esIdioma(idioma) && esIdVozNatural(id)) salida[idioma] = id;
  return salida;
}

/** Tamaños de pantalla con calibración que se guardan como mucho (los más recientes). */
export const MAX_CALIBRACIONES = 12;
const CLAVE_PANTALLA = /^\d{3,5}x\d{3,5}$/;

/** Calibración de la flecha por tamaño de pantalla (3.0.1): solo claves «AxB» con x e y numéricas. */
export function normalizarCalibracion(crudo: unknown): CalibracionHabilidad {
  const salida: CalibracionHabilidad = {};
  if (!esObj(crudo)) return salida;
  const validas = Object.entries(crudo).filter(([k, v]) => CLAVE_PANTALLA.test(k) && esObj(v) && numero(v.x) && numero(v.y));
  for (const [k, v] of validas.slice(-MAX_CALIBRACIONES)) {
    const p = v as { x: number; y: number };
    salida[k] = { x: Math.round(p.x), y: Math.round(p.y) };
  }
  return salida;
}

const enRango = (v: unknown, min: number, max: number): v is number => numero(v) && v >= min && v <= max;

/** Sección `overlay.jungla` (3.0, minimapa). Sin ella (ajustes anteriores) o con valores raros, los de por defecto. */
export function normalizarJungla(crudo: unknown): AjustesOverlay['jungla'] {
  const d = OVERLAY_POR_DEFECTO.jungla;
  if (!esObj(crudo)) return { ...d };
  const m = crudo.minimapa;
  const minimapa =
    esObj(m) && enRango(m.x, 0, 1) && enRango(m.y, 0, 1) && enRango(m.lado, LADO_MINIMAPA_MIN, LADO_MINIMAPA_MAX)
      ? { x: m.x, y: m.y, lado: m.lado }
      : null;
  const presentacion = crudo.presentacion === 'panel' || crudo.presentacion === 'minimapa' ? crudo.presentacion : d.presentacion;
  return { presentacion, minimapa };
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

function normalizarJunglaEnemiga(crudo: unknown): Ajustes['junglaEnemiga'] {
  const d = AJUSTES_POR_DEFECTO.junglaEnemiga;
  if (!esObj(crudo)) return { ...d };
  return {
    avisos: typeof crudo.avisos === 'boolean' ? crudo.avisos : d.avisos,
    ruta: typeof crudo.ruta === 'boolean' ? crudo.ruta : d.ruta,
  };
}

/**
 * Mezcla un valor desconocido con los ajustes por defecto; los campos con tipo incorrecto vuelven al valor por defecto.
 * `idiomaSistema` es el idioma por defecto (el del sistema, ver `idiomaDeSistema`): sin el campo `idioma` (instalación
 * nueva o ajustes de antes de la 3.0) se usa ese, así que quien ya usaba la app sigue en español salvo que su sistema
 * esté en uno de los otros idiomas.
 */
export function normalizarAjustes(crudo: unknown, idiomaSistema: Idioma = IDIOMA_POR_DEFECTO): Ajustes {
  if (!esObj(crudo)) return { ...structuredClone(AJUSTES_POR_DEFECTO), idioma: idiomaSistema };
  const c = crudo;
  const d = AJUSTES_POR_DEFECTO;
  const avisosCrudos = esObj(c.avisos) ? c.avisos : {};
  const avisos = { ...d.avisos };
  for (const k of Object.keys(avisos) as (keyof Ajustes['avisos'])[]) {
    if (typeof avisosCrudos[k] === 'boolean') avisos[k] = avisosCrudos[k];
  }
  const pos = c.posicionOverlay as { x?: unknown; y?: unknown } | null | undefined;
  const overlay = normalizarOverlay(c);
  // Migración de la 3.0.1: los avisos emergentes (texto y compra) se apagan una sola vez. La marca
  // queda guardada, así que quien los vuelve a encender los conserva encendidos.
  if (c.avisosEmergentesMigrados !== true) {
    overlay.widgets.avisos = { ...overlay.widgets.avisos, activo: false };
    overlay.widgets.compra = { ...overlay.widgets.compra, activo: false };
  }
  return {
    avisos,
    // Reflejo de overlay.voz.activa, para quien lea el campo antiguo.
    voz: overlay.voz.activa,
    importacionAutomatica: typeof c.importacionAutomatica === 'boolean' ? c.importacionAutomatica : d.importacionAutomatica,
    sustituirPaginaSinPreguntar: c.sustituirPaginaSinPreguntar === true,
    teclaOverlay: typeof c.teclaOverlay === 'string' && c.teclaOverlay ? c.teclaOverlay : d.teclaOverlay,
    posicionOverlay:
      pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : d.posicionOverlay,
    bienvenidaVista: typeof c.bienvenidaVista === 'boolean' ? c.bienvenidaVista : d.bienvenidaVista,
    ultimaVersionVista: typeof c.ultimaVersionVista === 'string' && c.ultimaVersionVista ? c.ultimaVersionVista : d.ultimaVersionVista,
    overlay,
    teclasJungla: normalizarTeclasJungla(c.teclasJungla),
    teclaJungla: typeof c.teclaJungla === 'string' ? c.teclaJungla.trim() : d.teclaJungla,
    junglaEnemiga: normalizarJunglaEnemiga(c.junglaEnemiga),
    idioma: esIdioma(c.idioma) ? c.idioma : idiomaSistema,
    avisosEmergentesMigrados: true,
    // Migración 3.0.1: sin `tema` (o con uno desconocido), el clásico.
    tema: esTema(c.tema) ? c.tema : TEMA_POR_DEFECTO,
    ia: normalizarIa(c.ia),
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
  // El marco del minimapa también lo guarda el modo mover (o «Restablecer», que va por su propia vía).
  const jungla = { ...nuevos.overlay.jungla, minimapa: guardados.overlay.jungla.minimapa };
  // La calibración de la flecha por tamaño de pantalla (3.0.1) también es del modo mover.
  const overlay: AjustesOverlay = { ...nuevos.overlay, widgets, jungla };
  delete overlay.calibracionHabilidad;
  if (guardados.overlay.calibracionHabilidad) overlay.calibracionHabilidad = guardados.overlay.calibracionHabilidad;
  return { ...nuevos, posicionOverlay: guardados.posicionOverlay, overlay };
}

/** Lee el JSON de ajustes; un BOM al principio (Bloc de notas, PowerShell 5) no debe hacer perder los ajustes. */
function leerJson(ruta: string): unknown {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
}

/**
 * Guarda las posiciones que deja el modo mover en la sección de cada widget. La flecha de habilidad, si llega con el
 * tamaño de la pantalla, se guarda como calibración de ese tamaño (3.0.1): cada resolución tiene su sitio.
 */
export function aplicarPosiciones(
  a: Ajustes,
  posiciones: Partial<Record<IdWidget, { x: number; y: number; pantalla?: { ancho: number; alto: number } }>>,
): Ajustes {
  const widgets = { ...a.overlay.widgets };
  let calibracion = a.overlay.calibracionHabilidad;
  for (const id of WIDGETS) {
    const p = posiciones[id];
    if (!p) continue;
    const pantalla = p.pantalla;
    if (id === 'habilidad' && pantalla && numero(pantalla.ancho) && numero(pantalla.alto)) {
      const clave = `${Math.round(pantalla.ancho)}x${Math.round(pantalla.alto)}`;
      const resto = { ...calibracion };
      delete resto[clave];
      calibracion = normalizarCalibracion({ ...resto, [clave]: { x: p.x, y: p.y } });
    } else widgets[id] = { ...widgets[id], x: Math.round(p.x), y: Math.round(p.y) };
  }
  return { ...a, overlay: { ...a.overlay, widgets, ...(calibracion ? { calibracionHabilidad: calibracion } : {}) } };
}

export function cargarAjustes(ruta: string, idiomaSistema: Idioma = IDIOMA_POR_DEFECTO): Ajustes {
  try {
    const crudo: unknown = leerJson(ruta);
    const a = normalizarAjustes(crudo, idiomaSistema);
    // Un ajustes.json de una versión anterior (sin el campo) es de alguien que ya usaba la app:
    // no ve la bienvenida, sino las novedades de esta versión. Sin archivo es una instalación nueva.
    if (typeof crudo === 'object' && crudo !== null && !Array.isArray(crudo) && !('bienvenidaVista' in crudo)) {
      a.bienvenidaVista = true;
    }
    return a;
  } catch {
    return { ...structuredClone(AJUSTES_POR_DEFECTO), idioma: idiomaSistema };
  }
}

/**
 * Migraciones al arrancar, guardadas una sola vez si el archivo de ajustes existe:
 * - idioma (3.0): sin `idioma`, se guarda el del sistema (o español), para que la elección quede fija aunque luego
 *   cambie el idioma de Windows;
 * - avisos emergentes (3.0.1): sin la marca `avisosEmergentesMigrados`, se guardan apagados (ver normalizarAjustes);
 * - pantalla de carga (3.1): sin `overlay.carga` (o con valores no válidos), se guarda la de por defecto (pantalla
 *   completa, Espacio para ocultarla).
 * Devuelve los ajustes.
 */
export function migrarAjustes(ruta: string, idiomaSistema: Idioma): Ajustes {
  const a = cargarAjustes(ruta, idiomaSistema);
  try {
    const crudo: unknown = leerJson(ruta);
    if (esObj(crudo) && (!esIdioma(crudo.idioma) || crudo.avisosEmergentesMigrados !== true || !cargaGuardada(crudo))) guardarAjustes(ruta, a);
  } catch {
    // sin archivo (instalación nueva): el idioma del sistema se guarda con el primer cambio de ajustes
  }
  return a;
}

/** El ajustes.json ya tiene una sección `overlay.carga` válida (3.1). */
function cargaGuardada(crudo: Obj): boolean {
  const carga = esObj(crudo.overlay) ? crudo.overlay.carga : undefined;
  return esObj(carga) && JSON.stringify(normalizarCarga(carga)) === JSON.stringify({ modo: carga.modo, ocultarConEspacio: carga.ocultarConEspacio });
}

/** Nombre anterior de migrarAjustes (3.0). */
export const migrarIdioma = migrarAjustes;

export function guardarAjustes(ruta: string, a: Ajustes): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(a, null, 2), 'utf8');
}

/** Tecla Alt+Shift+L: enciende o apaga los temporizadores de la jungla (se guarda). */
export function alternarJungla(a: Ajustes): Ajustes {
  const jungla = { ...a.overlay.widgets.jungla, activo: !a.overlay.widgets.jungla.activo };
  return { ...a, overlay: { ...a.overlay, widgets: { ...a.overlay.widgets, jungla } } };
}

/** Marco del minimapa calibrado en el modo mover (fracciones de la pantalla); null lo restablece. Uno inválido se ignora. */
export function guardarMinimapa(a: Ajustes, marco: unknown): Ajustes {
  if (marco === null) return { ...a, overlay: { ...a.overlay, jungla: { ...a.overlay.jungla, minimapa: null } } };
  const minimapa = normalizarJungla({ minimapa: marco }).minimapa;
  if (!minimapa) return a;
  return { ...a, overlay: { ...a.overlay, jungla: { ...a.overlay.jungla, minimapa } } };
}
