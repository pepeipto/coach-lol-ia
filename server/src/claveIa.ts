/**
 * Credencial de Anthropic del servidor. Dos tipos:
 * - Clave de API clásica (`sk-ant-api…`) en ANTHROPIC_API_KEY: el SDK la manda como `x-api-key`.
 * - Clave de usuario de la consola nueva (`sk-ant-usr-…`, caduca al mes) o token en ANTHROPIC_AUTH_TOKEN: se manda
 *   como `Authorization: Bearer` y la API exige además la beta `oauth-2025-04-20` (sin ella responde 401).
 */
export const BETA_TOKEN = 'oauth-2025-04-20';

export interface CredencialIa {
  /** Opciones para `new Anthropic(...)`. */
  opciones: { apiKey?: string | null; authToken?: string | null };
  /** Betas que hay que añadir a cada petición (la beta de los tokens). */
  betasExtra: string[];
}

/** Hay alguna credencial de Anthropic configurada. */
export function hayClaveIa(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim());
}

/** Elige cómo autenticarse según la variable y el prefijo de la clave. */
export function credencialIa(env: Record<string, string | undefined> = process.env): CredencialIa {
  const token = env.ANTHROPIC_AUTH_TOKEN?.trim();
  const clave = env.ANTHROPIC_API_KEY?.trim();
  if (token) return { opciones: { apiKey: null, authToken: token }, betasExtra: [BETA_TOKEN] };
  if (clave?.startsWith('sk-ant-usr-')) return { opciones: { apiKey: null, authToken: clave }, betasExtra: [BETA_TOKEN] };
  return { opciones: {}, betasExtra: [] };
}

/** Añade las betas extra a las de la petición (sin repetir). */
export function conBetas<T extends object>(params: T, betasExtra: string[]): T & { betas?: string[] } {
  if (!betasExtra.length) return params;
  const actuales = (params as { betas?: string[] }).betas ?? [];
  return { ...params, betas: [...new Set([...actuales, ...betasExtra])] };
}
