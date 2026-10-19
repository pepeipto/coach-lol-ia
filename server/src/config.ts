/** Dominio propio de la web (sin ruta base); se puede cambiar con la variable URL_WEB. */
export const URL_WEB_POR_DEFECTO = 'https://www.coachlolia.com';

export interface Configuracion {
  clave: string;
  puerto: number;
  rutaDb: string;
  /** Máximo de partidas nuevas por región y ciclo; undefined usa el valor por defecto. */
  maxPartidas: number | undefined;
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
  /** Asistente de soporte con IA: null sin ANTHROPIC_API_KEY (que lee el SDK del entorno). */
  asistente: { modelo: string; maxHora: number; maxDia: number } | null;
}

function entero(nombre: string, valor: string, min: number, max: number): number {
  const n = /^\d+$/.test(valor.trim()) ? Number(valor) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`La variable de entorno ${nombre} debe ser un número entero entre ${min} y ${max} (valor recibido: «${valor}»).`);
  }
  return n;
}

/** Lee y valida la configuración del servidor; lanza un error en español si algo no es válido. */
export function leerConfiguracion(env: Record<string, string | undefined>): Configuracion {
  // Una variable vacía (habitual en un .env de plantilla) cuenta como no definida.
  const leer = (nombre: string) => (env[nombre]?.trim() ? env[nombre] : undefined);
  // Al copiar la clave es fácil arrastrar espacios o comillas, que Riot rechaza con un 401.
  const clave = env.RIOT_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!clave) throw new Error('Falta la variable de entorno RIOT_API_KEY.');
  return {
    clave,
    puerto: entero('PUERTO', leer('PUERTO') ?? '8080', 1, 65535),
    rutaDb: leer('RUTA_DB') ?? './coach.db',
    maxPartidas: (() => {
      const valor = leer('MAX_PARTIDAS');
      return valor === undefined ? undefined : entero('MAX_PARTIDAS', valor, 1, 1_000_000);
    })(),
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
      if (!sal && env.NODE_ENV === 'production') {
        throw new Error('Falta la variable de entorno PRUEBA_SAL (obligatoria con NODE_ENV=production): define una cadena aleatoria y secreta para el hash de las IP de las pruebas.');
      }
      return sal;
    })(),
    asistente: leer('ANTHROPIC_API_KEY')
      ? {
          modelo: leer('ASISTENTE_MODELO')?.trim() || 'claude-opus-5-5',
          maxHora: entero('ASISTENTE_MAX_HORA', leer('ASISTENTE_MAX_HORA') ?? '300', 1, 1_000_000),
          maxDia: entero('ASISTENTE_MAX_DIA', leer('ASISTENTE_MAX_DIA') ?? '2000', 1, 10_000_000),
        }
      : null,
  };
}
