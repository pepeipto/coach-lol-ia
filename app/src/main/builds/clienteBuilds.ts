import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Build, Rol, RolesCampeon } from '@coach/shared';

export type ResultadoBuild = { estado: 'ok' | 'sin_conexion'; build: Build } | { estado: 'no_disponible' };

const TIEMPO_ESPERA_POR_DEFECTO_MS = 1500;

export function crearClienteBuilds(o: {
  urlServidor: string;
  dirCache: string;
  fetch?: typeof fetch;
  tiempoEsperaMs?: number;
}) {
  const fetchFn = o.fetch ?? fetch;
  const tiempoEsperaMs = o.tiempoEsperaMs ?? TIEMPO_ESPERA_POR_DEFECTO_MS;
  const base = o.urlServidor.replace(/\/+$/, '');
  const dirBuilds = join(o.dirCache, 'builds');

  const rutaCache = (campeon: string, rol: Rol) => join(dirBuilds, `${campeon}-${rol}.json`);

  async function leerCache(campeon: string, rol: Rol): Promise<Build | null> {
    try {
      return JSON.parse(await readFile(rutaCache(campeon, rol), 'utf8')) as Build;
    } catch {
      return null;
    }
  }

  async function guardarCache(campeon: string, rol: Rol, build: Build): Promise<void> {
    try {
      await mkdir(dirBuilds, { recursive: true });
      await writeFile(rutaCache(campeon, rol), JSON.stringify(build), 'utf8');
    } catch {
      // la caché es solo una ayuda: un fallo al guardar no debe romper la consulta
    }
  }

  const pedir = (ruta: string) =>
    fetchFn(`${base}${ruta}`, { signal: AbortSignal.timeout(tiempoEsperaMs) });

  return {
    async obtenerBuild(campeon: string, rol: Rol): Promise<ResultadoBuild> {
      try {
        const respuesta = await pedir(`/builds/${encodeURIComponent(campeon)}/${encodeURIComponent(rol)}`);
        if (respuesta.status === 200) {
          const build = (await respuesta.json()) as Build;
          await guardarCache(campeon, rol, build);
          return { estado: 'ok', build };
        }
      } catch {
        // caída, error de red o tiempo agotado: se trata igual que cualquier respuesta no 200
      }
      const enCache = await leerCache(campeon, rol);
      return enCache ? { estado: 'sin_conexion', build: enCache } : { estado: 'no_disponible' };
    },

    async obtenerRoles(campeon: string): Promise<Rol[]> {
      try {
        const respuesta = await pedir(`/roles/${encodeURIComponent(campeon)}`);
        if (!respuesta.ok) return [];
        const datos = (await respuesta.json()) as RolesCampeon;
        return datos.roles.map((r) => r.rol);
      } catch {
        return [];
      }
    },
  };
}
