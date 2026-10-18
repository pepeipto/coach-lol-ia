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
    urlWeb: (leer('URL_WEB')?.trim() ?? 'https://pepeipto.github.io/coach-lol-ia').replace(/\/+$/, ''),
  };
}
