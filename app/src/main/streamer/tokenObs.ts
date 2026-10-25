import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/*
 * 3.8: token de la URL de la fuente para OBS. Aleatorio (32 bytes, base64url) y guardado en userData/obs.json, para
 * que la URL pegada en OBS siga valiendo al reiniciar la app. No es una clave de ningún servicio: solo abre la
 * página local. «Cambiar enlace» crea otro y el anterior deja de valer.
 */

const FORMA = /^[A-Za-z0-9_-]{43}$/;

export const nuevoToken = (): string => randomBytes(32).toString('base64url');
export const tokenValido = (v: unknown): v is string => typeof v === 'string' && FORMA.test(v);

export function crearAlmacenToken(ruta: string, generar: () => string = nuevoToken) {
  let token: string | null = null;
  const guardar = (t: string) => {
    try {
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, JSON.stringify({ token: t }), { encoding: 'utf8', mode: 0o600 });
    } catch {
      // sin disco: el token vale mientras la app siga abierta
    }
  };
  return {
    token(): string {
      if (token) return token;
      try {
        const leido = (JSON.parse(readFileSync(ruta, 'utf8')) as { token?: unknown }).token;
        if (tokenValido(leido)) return (token = leido);
      } catch {
        // sin archivo o roto: se crea uno nuevo
      }
      token = generar();
      guardar(token);
      return token;
    },
    regenerar(): string {
      token = generar();
      guardar(token);
      return token;
    },
  };
}
