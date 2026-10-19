import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EstadoLicencia, TipoLicencia } from '../shared/tiposApp';
import { registrar } from './log';
import { abrirWeb } from './web';

/** Formato de las claves (el mismo que genera el servidor): sin 0, 1, I ni O. */
export const FORMATO_CLAVE = /^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/;
/** Sin conexión con el servidor, la última respuesta «activa» vale durante 7 días. */
export const TOLERANCIA_SIN_CONEXION_MS = 7 * 24 * 3600 * 1000;
/** Cada cuánto se vuelve a consultar el servidor con la app abierta. */
export const INTERVALO_COMPROBACION_MS = 6 * 3600 * 1000;
const TIEMPO_MAXIMO_MS = 10_000;

type EstadoServidor = 'activa' | 'cancelada' | 'impagada' | 'caducada' | 'otro_dispositivo' | 'prueba_ya_usada';
const ESTADOS_SERVIDOR: EstadoServidor[] = ['activa', 'cancelada', 'impagada', 'caducada', 'otro_dispositivo', 'prueba_ya_usada'];
/** Estados con los que una clave de prueba no se puede activar en este equipo. */
const RECHAZOS_PRUEBA: EstadoServidor[] = ['caducada', 'otro_dispositivo', 'prueba_ya_usada'];
const TIPOS: TipoLicencia[] = ['suscripcion', 'vitalicia', 'prueba'];
/** setTimeout no admite más de ~24,8 días. */
const MAX_ESPERA_MS = 2 ** 31 - 1;

/** Respuesta de GET /api/premium/estado/:clave. */
interface RespuestaEstado {
  premium: boolean;
  estado: EstadoServidor;
  renuevaEn: string | null;
  /** Solo en las licencias vitalicias. */
  vitalicia?: boolean;
  caducaEn?: string | null;
  tipo?: TipoLicencia;
}

/** Contenido de licencia.json. */
interface Guardado {
  clave: string;
  ultimoEstado: RespuestaEstado;
  /** ISO de la última respuesta válida del servidor. */
  comprobadaEn: string;
}

const SIN_LICENCIA: EstadoLicencia = { plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null };

/** «CLIA-••••-••••-••••-WXYZ»: solo se ve el último grupo. */
export function ocultarClave(clave: string): string {
  return `CLIA-••••-••••-••••-${clave.slice(-4)}`;
}

function esRespuesta(x: unknown): x is RespuestaEstado {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.premium === 'boolean' &&
    ESTADOS_SERVIDOR.includes(r.estado as EstadoServidor) &&
    (r.renuevaEn === null || typeof r.renuevaEn === 'string') &&
    (r.vitalicia === undefined || typeof r.vitalicia === 'boolean') &&
    (r.caducaEn === undefined || r.caducaEn === null || (typeof r.caducaEn === 'string' && !Number.isNaN(Date.parse(r.caducaEn)))) &&
    (r.tipo === undefined || TIPOS.includes(r.tipo as TipoLicencia))
  );
}

function leer(ruta: string): Guardado | null {
  try {
    const g = JSON.parse(readFileSync(ruta, 'utf8')) as Partial<Guardado>;
    if (typeof g.clave !== 'string' || !FORMATO_CLAVE.test(g.clave)) return null;
    if (!esRespuesta(g.ultimoEstado) || typeof g.comprobadaEn !== 'string') return null;
    if (Number.isNaN(Date.parse(g.comprobadaEn))) return null;
    return g as Guardado;
  } catch {
    return null;
  }
}

/** Resultado de consultar al servidor: su respuesta, «desconocida» (404) o sin conexión (red, 5xx, 429…). */
type Consulta = { tipo: 'ok'; respuesta: RespuestaEstado } | { tipo: 'desconocida' } | { tipo: 'sin_conexion' };

/**
 * Licencia Premium en el proceso principal. Guarda la clave y la última respuesta del servidor en
 * licencia.json; si el servidor no responde, esa respuesta vale 7 días (después, plan gratuito).
 */
export function crearGestorLicencia(o: {
  ruta: string;
  urlServidor: string;
  fetch?: typeof fetch;
  ahora?: () => number;
  forzarPremium?: boolean;
  /** Id anónimo del dispositivo; se envía como ?dispositivo= para vincular las pruebas. */
  dispositivo?: () => Promise<string | null>;
  /** Programa una comprobación (la de la caducidad de una prueba); devuelve cómo cancelarla. */
  programar?: (ms: number, cb: () => void) => () => void;
}) {
  const pedir = o.fetch ?? fetch;
  const ahora = o.ahora ?? Date.now;
  const base = o.urlServidor.replace(/\/+$/, '');
  let guardado = leer(o.ruta);
  /** La última consulta no obtuvo respuesta del servidor. */
  let sinConexion = false;
  const oyentes = new Set<(e: EstadoLicencia) => void>();
  let ultimoAvisado = '';
  const programar =
    o.programar ??
    ((ms: number, cb: () => void) => {
      const t = setTimeout(cb, ms);
      return () => clearTimeout(t);
    });
  let cancelarProgramada: (() => void) | null = null;

  function calcular(): EstadoLicencia {
    if (o.forzarPremium) {
      return { plan: 'premium', estado: 'activa', renuevaEn: null, claveVisible: guardado ? ocultarClave(guardado.clave) : null };
    }
    if (!guardado) return SIN_LICENCIA;
    const { ultimoEstado } = guardado;
    const reciente = ahora() - Date.parse(guardado.comprobadaEn) <= TOLERANCIA_SIN_CONEXION_MS;
    // La caducidad de una prueba se aplica también sin conexión.
    const caducada = !!ultimoEstado.caducaEn && ahora() >= Date.parse(ultimoEstado.caducaEn);
    const e: EstadoLicencia = {
      plan: ultimoEstado.estado === 'activa' && reciente && !caducada ? 'premium' : 'gratis',
      estado: caducada ? 'caducada' : sinConexion || !reciente ? 'sin_conexion' : ultimoEstado.estado,
      renuevaEn: ultimoEstado.renuevaEn,
      claveVisible: ocultarClave(guardado.clave),
    };
    if (ultimoEstado.vitalicia) e.vitalicia = true;
    if (ultimoEstado.tipo) e.tipo = ultimoEstado.tipo;
    if (ultimoEstado.caducaEn !== undefined) e.caducaEn = ultimoEstado.caducaEn;
    return e;
  }

  /** Con una prueba vigente, programa otra comprobación para el momento en que caduca. */
  function reprogramar(): void {
    cancelarProgramada?.();
    cancelarProgramada = null;
    const caducaEn = guardado?.ultimoEstado.caducaEn;
    if (o.forzarPremium || !caducaEn) return;
    const falta = Date.parse(caducaEn) - ahora();
    if (falta <= 0) return;
    cancelarProgramada = programar(Math.min(falta + 1000, MAX_ESPERA_MS), () => void comprobar());
  }

  function avisar(): EstadoLicencia {
    reprogramar();
    const e = calcular();
    const firma = JSON.stringify(e);
    if (firma !== ultimoAvisado) {
      ultimoAvisado = firma;
      for (const cb of oyentes) cb(e);
    }
    return e;
  }
  ultimoAvisado = JSON.stringify(calcular());

  function guardar(g: Guardado | null): void {
    guardado = g;
    if (g) {
      mkdirSync(dirname(o.ruta), { recursive: true });
      writeFileSync(o.ruta, JSON.stringify(g, null, 2), 'utf8');
    } else {
      rmSync(o.ruta, { force: true });
    }
  }

  async function consultar(clave: string): Promise<Consulta> {
    try {
      const id = await o.dispositivo?.().catch(() => null);
      const consulta = id ? `?dispositivo=${encodeURIComponent(id)}` : '';
      const r = await pedir(`${base}/api/premium/estado/${encodeURIComponent(clave)}${consulta}`, {
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      if (r.status === 404) return { tipo: 'desconocida' };
      if (!r.ok) return { tipo: 'sin_conexion' };
      const cuerpo: unknown = await r.json();
      return esRespuesta(cuerpo) ? { tipo: 'ok', respuesta: cuerpo } : { tipo: 'sin_conexion' };
    } catch (e) {
      registrar('aviso', `No se pudo comprobar la licencia: ${e instanceof Error ? e.message : String(e)}`);
      return { tipo: 'sin_conexion' };
    }
  }

  /** Consulta el servidor con la clave guardada (al arrancar, cada 6 h y al caducar una prueba). */
  async function comprobar(): Promise<EstadoLicencia> {
    if (o.forzarPremium || !guardado) return avisar();
    const clave = guardado.clave;
    const c = await consultar(clave);
    if (guardado?.clave !== clave) return calcular(); // se quitó o cambió mientras tanto
    if (c.tipo === 'ok') {
      sinConexion = false;
      guardar({ clave, ultimoEstado: c.respuesta, comprobadaEn: new Date(ahora()).toISOString() });
    } else if (c.tipo === 'desconocida') {
      sinConexion = false;
      registrar('aviso', 'El servidor ya no reconoce la licencia guardada: se quita.');
      guardar(null);
    } else {
      sinConexion = true;
    }
    return avisar();
  }
  reprogramar();

  return {
    estado: calcular,
    comprobar,

    /** Valida el formato y guarda la clave solo si el servidor la reconoce. */
    async activar(texto: unknown): Promise<EstadoLicencia> {
      const clave = typeof texto === 'string' ? texto.trim().toUpperCase() : '';
      if (!FORMATO_CLAVE.test(clave)) throw new Error('clave_no_valida');
      const c = await consultar(clave);
      if (c.tipo === 'sin_conexion') throw new Error('sin_conexion');
      if (c.tipo === 'desconocida') return calcular();
      // Una prueba caducada, de otro dispositivo o ya usada aquí no se guarda: se explica el motivo.
      if (!c.respuesta.premium && RECHAZOS_PRUEBA.includes(c.respuesta.estado)) throw new Error(c.respuesta.estado);
      sinConexion = false;
      guardar({ clave, ultimoEstado: c.respuesta, comprobadaEn: new Date(ahora()).toISOString() });
      return avisar();
    },

    quitar(): EstadoLicencia {
      sinConexion = false;
      guardar(null);
      return avisar();
    },

    alCambiar(cb: (e: EstadoLicencia) => void): () => void {
      oyentes.add(cb);
      return () => void oyentes.delete(cb);
    },
  };
}

export type GestorLicencia = ReturnType<typeof crearGestorLicencia>;

/** Lo que se usa de ipcMain. */
export interface IpcLicencia {
  handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void;
}

/**
 * Canales de la licencia y de la web. Solo atiende a la ventana principal; la ruta de la web se
 * valida aquí contra la lista blanca, nunca en el renderer.
 */
export function registrarIpcLicencia(
  ipc: IpcLicencia,
  gestor: GestorLicencia,
  o: { abrir: (url: string) => Promise<void>; esPrincipal: (sender: unknown) => boolean },
): void {
  const soloPrincipal = (e: { sender: unknown }) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
  };
  ipc.handle('coach:licencia-estado', (e) => {
    soloPrincipal(e);
    return gestor.estado();
  });
  ipc.handle('coach:licencia-activar', (e, clave) => {
    soloPrincipal(e);
    return gestor.activar(clave);
  });
  ipc.handle('coach:licencia-quitar', (e) => {
    soloPrincipal(e);
    return gestor.quitar();
  });
  ipc.handle('coach:abrir-web', (e, ruta) => {
    soloPrincipal(e);
    return abrirWeb(ruta, o.abrir);
  });
}
