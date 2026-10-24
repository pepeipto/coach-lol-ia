/*
 * 3.8: modo streamer. Todo vive en el PC del jugador: no se manda nada nuevo a ningún servidor.
 * - Modo streamer: en todas las ventanas (app y overlay) el nombre y el Riot ID de los demás jugadores se sustituyen
 *   por el nombre de su campeón; `ocultarPropio` hace lo mismo con el tuyo.
 * - Fuente para OBS: un servidor HTTP local de solo lectura (127.0.0.1) con una página transparente para la «Fuente de
 *   navegador» de OBS: barra de objetivos, panel de aumentos de ARAM: Caos y subtítulos de la voz del coach.
 */

export interface AjustesObs {
  /** Servidor local encendido. */
  activa: boolean;
  /** Puerto en 127.0.0.1 (1024-65535, nunca el 8080). */
  puerto: number;
}

export interface AjustesStreamer {
  /** Cambia los nombres y Riot ID de los demás jugadores por el nombre de su campeón. */
  activo: boolean;
  /** También tu propio Riot ID. */
  ocultarPropio: boolean;
  /** Tecla global opcional para encender o apagar el modo streamer ('' = ninguna). */
  tecla: string;
  obs: AjustesObs;
}

/** Puerto alto poco usado (no es el 8080 del servidor de desarrollo ni el de ningún programa habitual). */
export const PUERTO_OBS_POR_DEFECTO = 47615;
export const PUERTO_OBS_MIN = 1024;
export const PUERTO_OBS_MAX = 65535;
const PUERTOS_PROHIBIDOS = new Set([8080]);

export const STREAMER_POR_DEFECTO: AjustesStreamer = {
  activo: false,
  ocultarPropio: false,
  tecla: '',
  obs: { activa: false, puerto: PUERTO_OBS_POR_DEFECTO },
};

/** Tamaño recomendado de la fuente de navegador en OBS (el del lienzo de 1080p). */
export const TAMANO_OBS = { ancho: 1920, alto: 1080 } as const;

/** Enlace del comando !coach del chat. */
export const URL_WEB_COACH = 'https://www.coachlolia.com';

export const puertoValido = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= PUERTO_OBS_MIN && v <= PUERTO_OBS_MAX && !PUERTOS_PROHIBIDOS.has(v);

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Sección `streamer` de los ajustes. Sin ella (ajustes anteriores a la 3.8) o con valores raros, todo apagado. */
export function normalizarStreamer(crudo: unknown): AjustesStreamer {
  const d = STREAMER_POR_DEFECTO;
  if (!esObj(crudo)) return { ...d, obs: { ...d.obs } };
  const obs = esObj(crudo.obs) ? crudo.obs : {};
  return {
    activo: crudo.activo === true,
    ocultarPropio: crudo.ocultarPropio === true,
    tecla: typeof crudo.tecla === 'string' ? crudo.tecla.trim().slice(0, 60) : d.tecla,
    obs: {
      activa: obs.activa === true,
      puerto: puertoValido(obs.puerto) ? obs.puerto : d.obs.puerto,
    },
  };
}

/** Estado de la fuente para OBS que ve la ventana de Ajustes. */
export interface EstadoObs {
  activa: boolean;
  /** El servidor está escuchando en `puerto`. */
  escuchando: boolean;
  puerto: number;
  /** URL para pegar en OBS (con el token); null si el servidor no escucha. */
  url: string | null;
  /** 'puerto_ocupado': otro programa usa ese puerto; 'error': no se pudo arrancar. */
  error: 'puerto_ocupado' | 'error' | null;
}

/** Una frase de la voz como subtítulo (sin saltos de línea ni espacios de más, como mucho 300 caracteres). */
export function textoSubtitulo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const texto = v.replace(/\s+/g, ' ').trim().slice(0, 300);
  return texto || null;
}
