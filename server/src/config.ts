import { REGIONES, REGIONES_RECOLECTOR_POR_DEFECTO, type Region } from './riot/riotApi';

/** Dominio propio de la web (sin ruta base); se puede cambiar con la variable URL_WEB. */
export const URL_WEB_POR_DEFECTO = 'https://www.coachlolia.com';

export interface Configuracion {
  clave: string;
  puerto: number;
  rutaDb: string;
  /** Máximo de partidas nuevas por región y ciclo; undefined usa el valor por defecto. */
  maxPartidas: number | undefined;
  /** Regiones del recolector (REGIONES_RECOLECTOR, separadas por comas); por defecto EUW, LAN y LAS. */
  regionesRecolector: Region[];
  /** Credenciales de Stripe; null si falta alguna (las rutas de premium responden 503). */
  stripe: { clave: string; webhook: string; precio: string } | null;
  /** URL pública de la web (origen del CORS y de las URL de Stripe). */
  urlWeb: string;
  /**
   * Saltos de proxy de confianza (1-5) para leer la IP del cliente de X-Forwarded-For; false sin proxy.
   * Nunca `true`: con él se confiaría en toda la cabecera y bastaría con falsificarla.
   */
  trustProxy: number | false;
  /** Sal del hash de las IP de las pruebas gratuitas (PRUEBA_SAL); null para usar una aleatoria guardada en la base. */
  salPrueba: string | null;
  /** Premium (licencias, pruebas y Stripe): solo con PREMIUM_HABILITADO=1, si Riot aprueba la monetización. */
  premiumHabilitado: boolean;
  /** Asistente de soporte con IA: null sin ANTHROPIC_API_KEY (que lee el SDK del entorno). */
  asistente: { modelo: string; maxHora: number; maxDia: number } | null;
  /**
   * 3.2: coach con IA (análisis al terminar la partida y consejos de momentos muertos): null sin ANTHROPIC_API_KEY.
   * Modelos (COACH_IA_MODELO_ANALISIS / _CONSEJO), límites por IP y día (COACH_IA_ANALISIS_IP_DIA / _CONSEJO_IP_DIA) y
   * topes globales por hora y día (COACH_IA_ANALISIS_MAX_HORA / _MAX_DIA, COACH_IA_CONSEJO_MAX_HORA / _MAX_DIA).
   */
  coachIa: {
    modeloAnalisis: string;
    modeloConsejo: string;
    analisisIpDia: number;
    consejoIpDia: number;
    analisisMaxHora: number;
    analisisMaxDia: number;
    consejoMaxHora: number;
    consejoMaxDia: number;
  } | null;
  /**
   * Porcentaje de cada regla de Riot (por host) que pueden usar las consultas de la pantalla de carga
   * (RIOT_PORCENTAJE_INTERACTIVO, 5–70; por defecto 60): el resto queda siempre para el recolector.
   */
  porcentajeInteractivo: number;
}

function entero(nombre: string, valor: string, min: number, max: number): number {
  const n = /^\d+$/.test(valor.trim()) ? Number(valor) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`La variable de entorno ${nombre} debe ser un número entero entre ${min} y ${max} (valor recibido: «${valor}»).`);
  }
  return n;
}

/** «EUW, lan,BR» → ['EUW', 'LAN', 'BR'] (sin repetidas); lanza un error en español con una región desconocida. */
export function leerRegiones(valor: string | undefined): Region[] {
  if (valor === undefined) return [...REGIONES_RECOLECTOR_POR_DEFECTO];
  const regiones: Region[] = [];
  for (const parte of valor.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean)) {
    if (!Object.hasOwn(REGIONES, parte)) {
      throw new Error(`La variable de entorno REGIONES_RECOLECTOR tiene una región desconocida: «${parte}». Valores posibles: ${Object.keys(REGIONES).join(', ')}.`);
    }
    if (!regiones.includes(parte as Region)) regiones.push(parte as Region);
  }
  if (regiones.length === 0) throw new Error('La variable de entorno REGIONES_RECOLECTOR no tiene ninguna región.');
  return regiones;
}

/** Lee y valida la configuración del servidor; lanza un error en español si algo no es válido. */
export function leerConfiguracion(env: Record<string, string | undefined>): Configuracion {
  // Una variable vacía (habitual en un .env de plantilla) cuenta como no definida.
  const leer = (nombre: string) => (env[nombre]?.trim() ? env[nombre] : undefined);
  // Al copiar la clave es fácil arrastrar espacios o comillas, que Riot rechaza con un 401.
  const clave = env.RIOT_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!clave) throw new Error('Falta la variable de entorno RIOT_API_KEY.');
  const premiumHabilitado = leer('PREMIUM_HABILITADO')?.trim() === '1';
  return {
    clave,
    puerto: entero('PUERTO', leer('PUERTO') ?? '8080', 1, 65535),
    rutaDb: leer('RUTA_DB') ?? './coach.db',
    maxPartidas: (() => {
      const valor = leer('MAX_PARTIDAS');
      return valor === undefined ? undefined : entero('MAX_PARTIDAS', valor, 1, 1_000_000);
    })(),
    regionesRecolector: leerRegiones(leer('REGIONES_RECOLECTOR')),
    stripe: (() => {
      const k = leer('STRIPE_SECRET_KEY')?.trim();
      const w = leer('STRIPE_WEBHOOK_SECRET')?.trim();
      const p = leer('STRIPE_PRICE_ID')?.trim();
      return k && w && p ? { clave: k, webhook: w, precio: p } : null;
    })(),
    urlWeb: (leer('URL_WEB')?.trim() ?? URL_WEB_POR_DEFECTO).replace(/\/+$/, ''),
    trustProxy: (() => {
      const v = leer('TRUST_PROXY')?.trim().toLowerCase() ?? '';
      if (v === 'true') return 1; // compatibilidad: «true» era un salto
      return /^[1-5]$/.test(v) ? Number(v) : false;
    })(),
    salPrueba: (() => {
      const sal = leer('PRUEBA_SAL')?.trim() ?? null;
      // En producción la sal debe ser fija y secreta: con una aleatoria guardada en la base, quien
      // copie la base podría comprobar IP por fuerza bruta igual, pero perderla reinicia los límites.
      // Sin Premium no hay pruebas gratuitas, así que no hace falta.
      if (!sal && premiumHabilitado && env.NODE_ENV === 'production') {
        throw new Error('Falta la variable de entorno PRUEBA_SAL (obligatoria con NODE_ENV=production): define una cadena aleatoria y secreta para el hash de las IP de las pruebas.');
      }
      return sal;
    })(),
    premiumHabilitado,
    asistente: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modelo: leer('ASISTENTE_MODELO')?.trim() || 'claude-opus-5-5',
          maxHora: entero('ASISTENTE_MAX_HORA', leer('ASISTENTE_MAX_HORA') ?? '300', 1, 1_000_000),
          maxDia: entero('ASISTENTE_MAX_DIA', leer('ASISTENTE_MAX_DIA') ?? '2000', 1, 10_000_000),
        }
      : null,
    coachIa: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modeloAnalisis: leer('COACH_IA_MODELO_ANALISIS')?.trim() || 'claude-sonnet-5-5',
          modeloConsejo: leer('COACH_IA_MODELO_CONSEJO')?.trim() || 'claude-haiku-5-5',
          analisisIpDia: entero('COACH_IA_ANALISIS_IP_DIA', leer('COACH_IA_ANALISIS_IP_DIA') ?? '10', 1, 10_000),
          consejoIpDia: entero('COACH_IA_CONSEJO_IP_DIA', leer('COACH_IA_CONSEJO_IP_DIA') ?? '60', 1, 100_000),
          analisisMaxHora: entero('COACH_IA_ANALISIS_MAX_HORA', leer('COACH_IA_ANALISIS_MAX_HORA') ?? '300', 1, 1_000_000),
          analisisMaxDia: entero('COACH_IA_ANALISIS_MAX_DIA', leer('COACH_IA_ANALISIS_MAX_DIA') ?? '3000', 1, 10_000_000),
          consejoMaxHora: entero('COACH_IA_CONSEJO_MAX_HORA', leer('COACH_IA_CONSEJO_MAX_HORA') ?? '3000', 1, 10_000_000),
          consejoMaxDia: entero('COACH_IA_CONSEJO_MAX_DIA', leer('COACH_IA_CONSEJO_MAX_DIA') ?? '30000', 1, 100_000_000),
        }
      : null,
    porcentajeInteractivo: entero('RIOT_PORCENTAJE_INTERACTIVO', leer('RIOT_PORCENTAJE_INTERACTIVO') ?? '60', 5, 70),
  };
}
