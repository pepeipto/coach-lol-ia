import { REGIONES, REGIONES_RECOLECTOR_POR_DEFECTO, type Region } from './riot/riotApi';
import {
  ASISTENTE_MAX_DIA,
  ASISTENTE_MAX_HORA,
  CRUCE_CONSEJOS_IP_DIA,
  CRUCE_CONSEJOS_MAX_DIA,
  FICHA_IP_DIA,
  FICHA_MAX_DIA,
  LIMITES_COACH_IA as C,
  MODELO_ASISTENTE,
  JUGADORES_MAX_HORA,
  JUGADORES_MAX_MINUTO,
  PARCHE_MAX_DIA,
} from './topes';

/** Dominio propio de la web (sin ruta base); se puede cambiar con la variable URL_WEB. */
export const URL_WEB_POR_DEFECTO = 'https://www.coachlolia.com';

export interface Configuracion {
  /** ADMIN_TOKEN: contraseña de /admin/clave; null si no está. */
  admin: string | null;
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
  /**
   * Cabecera con la IP real del cliente que pone el proxy de delante (seguridad, hallazgo 6), en minúsculas; null para
   * usar req.ip (X-Forwarded-For con trustProxy). CABECERA_IP_CLIENTE la fija; si no está, en Fly.io (FLY_APP_NAME)
   * con TRUST_PROXY se usa `fly-client-ip`, que pone fly-proxy y el cliente no puede falsificar.
   */
  cabeceraIpCliente: string | null;
  /** Sal del hash de las IP de las pruebas gratuitas (PRUEBA_SAL); null para usar una aleatoria guardada en la base. */
  salPrueba: string | null;
  /** Premium (licencias, pruebas y Stripe): solo con PREMIUM_HABILITADO=1, si Riot aprueba la monetización. */
  premiumHabilitado: boolean;
  /**
   * La clave de Riot es de producción (RIOT_CLAVE_PRODUCCION=1) y no caduca. Si no, se trata como de desarrollo y
   * /salud estima cuándo caduca (24 h desde que empezó a usarse).
   */
  claveProduccion: boolean;
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
    personalIpDia: number;
    personalMaxHora: number;
    personalMaxDia: number;
  } | null;
  /**
   * Ficha del campeón (GET /ficha/:campeon): null sin ANTHROPIC_API_KEY. Modelo (FICHA_MODELO; por defecto el del
   * análisis del coach), tope global de generaciones al día (FICHA_MAX_DIA, 100) y por IP (FICHA_IP_DIA, 15).
   */
  ficha: { modelo: string; maxDia: number; ipDia: number } | null;
  /**
   * Consejos del enfrentamiento (GET /enfrentamiento-consejos/:campeon/:rival/:rol): null sin ANTHROPIC_API_KEY.
   * Modelo (CRUCE_CONSEJOS_MODELO; por defecto el de la ficha), tope global de generaciones al día
   * (CRUCE_CONSEJOS_MAX_DIA, 120) y por IP (CRUCE_CONSEJOS_IP_DIA, 20).
   */
  consejosCruce: { modelo: string; maxDia: number; ipDia: number } | null;
  /**
   * Novedades del parche (GET /parche/:parche): null sin ANTHROPIC_API_KEY. Modelo (PARCHE_MODELO; por defecto el del
   * análisis del coach) y tope global de resúmenes nuevos al día (PARCHE_MAX_DIA, 10: 5 idiomas por parche).
   */
  parche: { modelo: string; maxDia: number } | null;
  /**
   * Porcentaje de cada regla de Riot (por host) que pueden usar las consultas de la pantalla de carga
   * (RIOT_PORCENTAJE_INTERACTIVO, 5–70; por defecto 60): el resto queda siempre para el recolector.
   */
  porcentajeInteractivo: number;
  /** Topes globales de la pantalla de carga (JUGADORES_MAX_MINUTO / JUGADORES_MAX_HORA; ver topes.ts). */
  jugadores: { maxMinuto: number; maxHora: number };
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
  // 3.9.1: contraseña de la página /admin/clave (renovar la clave de Riot desde el móvil); sin ella, la página no existe.
  const admin = leer('ADMIN_TOKEN')?.trim() ?? null;
  if (admin && admin.length < 24) throw new Error('ADMIN_TOKEN es demasiado corto: usa al menos 24 caracteres (lo crea clave-admin-servidor.ps1).');
  return {
    clave,
    admin,
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
    cabeceraIpCliente: (() => {
      const v = leer('CABECERA_IP_CLIENTE')?.trim().toLowerCase();
      if (v !== undefined) {
        if (v === 'no' || v === 'ninguna') return null;
        if (!/^[a-z0-9-]{1,64}$/.test(v)) throw new Error(`La variable de entorno CABECERA_IP_CLIENTE no es un nombre de cabecera válido: «${v}».`);
        return v;
      }
      return leer('FLY_APP_NAME') && /^(?:[1-5]|true)$/i.test(leer('TRUST_PROXY')?.trim() ?? '') ? 'fly-client-ip' : null;
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
    claveProduccion: leer('RIOT_CLAVE_PRODUCCION')?.trim() === '1',
    asistente: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          // Topes por defecto prudentes para un proyecto gratuito; la justificación está junto a cada constante.
          modelo: leer('ASISTENTE_MODELO')?.trim() || MODELO_ASISTENTE,
          maxHora: entero('ASISTENTE_MAX_HORA', leer('ASISTENTE_MAX_HORA') ?? String(ASISTENTE_MAX_HORA), 1, 1_000_000),
          maxDia: entero('ASISTENTE_MAX_DIA', leer('ASISTENTE_MAX_DIA') ?? String(ASISTENTE_MAX_DIA), 1, 10_000_000),
        }
      : null,
    coachIa: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modeloAnalisis: leer('COACH_IA_MODELO_ANALISIS')?.trim() || 'claude-sonnet-5-5',
          modeloConsejo: leer('COACH_IA_MODELO_CONSEJO')?.trim() || 'claude-haiku-5-5',
          analisisIpDia: entero('COACH_IA_ANALISIS_IP_DIA', leer('COACH_IA_ANALISIS_IP_DIA') ?? String(C.analisisIpDia), 1, 10_000),
          consejoIpDia: entero('COACH_IA_CONSEJO_IP_DIA', leer('COACH_IA_CONSEJO_IP_DIA') ?? String(C.consejoIpDia), 1, 100_000),
          analisisMaxHora: entero('COACH_IA_ANALISIS_MAX_HORA', leer('COACH_IA_ANALISIS_MAX_HORA') ?? String(C.analisisMaxHora), 1, 1_000_000),
          analisisMaxDia: entero('COACH_IA_ANALISIS_MAX_DIA', leer('COACH_IA_ANALISIS_MAX_DIA') ?? String(C.analisisMaxDia), 1, 10_000_000),
          consejoMaxHora: entero('COACH_IA_CONSEJO_MAX_HORA', leer('COACH_IA_CONSEJO_MAX_HORA') ?? String(C.consejoMaxHora), 1, 10_000_000),
          consejoMaxDia: entero('COACH_IA_CONSEJO_MAX_DIA', leer('COACH_IA_CONSEJO_MAX_DIA') ?? String(C.consejoMaxDia), 1, 100_000_000),
          personalIpDia: entero('COACH_IA_PERSONAL_IP_DIA', leer('COACH_IA_PERSONAL_IP_DIA') ?? String(C.personalIpDia), 1, 10_000),
          personalMaxHora: entero('COACH_IA_PERSONAL_MAX_HORA', leer('COACH_IA_PERSONAL_MAX_HORA') ?? String(C.personalMaxHora), 1, 1_000_000),
          personalMaxDia: entero('COACH_IA_PERSONAL_MAX_DIA', leer('COACH_IA_PERSONAL_MAX_DIA') ?? String(C.personalMaxDia), 1, 10_000_000),
        }
      : null,
    ficha: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modelo: leer('FICHA_MODELO')?.trim() || leer('COACH_IA_MODELO_ANALISIS')?.trim() || 'claude-sonnet-5-5',
          maxDia: entero('FICHA_MAX_DIA', leer('FICHA_MAX_DIA') ?? String(FICHA_MAX_DIA), 1, 1_000_000),
          ipDia: entero('FICHA_IP_DIA', leer('FICHA_IP_DIA') ?? String(FICHA_IP_DIA), 1, 100_000),
        }
      : null,
    consejosCruce: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modelo:
            leer('CRUCE_CONSEJOS_MODELO')?.trim() || leer('FICHA_MODELO')?.trim() || leer('COACH_IA_MODELO_ANALISIS')?.trim() || 'claude-sonnet-5-5',
          maxDia: entero('CRUCE_CONSEJOS_MAX_DIA', leer('CRUCE_CONSEJOS_MAX_DIA') ?? String(CRUCE_CONSEJOS_MAX_DIA), 1, 1_000_000),
          ipDia: entero('CRUCE_CONSEJOS_IP_DIA', leer('CRUCE_CONSEJOS_IP_DIA') ?? String(CRUCE_CONSEJOS_IP_DIA), 1, 100_000),
        }
      : null,
    parche: leer('ANTHROPIC_API_KEY')?.trim() || leer('ANTHROPIC_AUTH_TOKEN')?.trim()
      ? {
          modelo: leer('PARCHE_MODELO')?.trim() || leer('COACH_IA_MODELO_ANALISIS')?.trim() || 'claude-sonnet-5-5',
          maxDia: entero('PARCHE_MAX_DIA', leer('PARCHE_MAX_DIA') ?? String(PARCHE_MAX_DIA), 1, 10_000),
        }
      : null,
    porcentajeInteractivo: entero('RIOT_PORCENTAJE_INTERACTIVO', leer('RIOT_PORCENTAJE_INTERACTIVO') ?? '60', 5, 70),
    jugadores: {
      maxMinuto: entero('JUGADORES_MAX_MINUTO', leer('JUGADORES_MAX_MINUTO') ?? String(JUGADORES_MAX_MINUTO), 1, 100_000),
      maxHora: entero('JUGADORES_MAX_HORA', leer('JUGADORES_MAX_HORA') ?? String(JUGADORES_MAX_HORA), 1, 10_000_000),
    },
  };
}
