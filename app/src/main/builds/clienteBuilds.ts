import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MODO_POR_DEFECTO, ROLES, sanearBuildPolitica, TIERS, tieneRoles, type Build, type EntradaCampeon, type ListaCampeones, type ModoJuego, type Rol, type RolesCampeon, type Tier } from '@coach/shared';

export type ResultadoBuild = { estado: 'ok' | 'sin_conexion'; build: Build } | { estado: 'no_disponible' };

export type ResultadoCampeones = { estado: 'ok' | 'sin_conexion'; lista: ListaCampeones } | { estado: 'no_disponible' };

const TIEMPO_ESPERA_POR_DEFECTO_MS = 1500;
/** La lista de campeones es más grande que una build: se le da algo más de margen. */
const TIEMPO_ESPERA_LISTA_MS = 5000;

const esFraccion = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

const esNumeroOpcional = (x: unknown, min: number, max: number) =>
  x === undefined || (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max);

/** Entrada válida de la lista de un modo: con rol en clasificatoria, rol null en los demás. */
function esEntradaCampeon(x: unknown, modo: ModoJuego): x is EntradaCampeon {
  const e = x as Partial<EntradaCampeon> | null;
  return (
    !!e &&
    typeof e === 'object' &&
    typeof e.campeon === 'string' &&
    e.campeon.length > 0 &&
    (tieneRoles(modo) ? ROLES.includes(e.rol as Rol) : e.rol === null) &&
    esNumeroOpcional(e.posicionMedia, 1, 8) &&
    esNumeroOpcional(e.top4, 0, 1) &&
    typeof e.partidas === 'number' &&
    Number.isInteger(e.partidas) &&
    e.partidas >= 0 &&
    esFraccion(e.tasaVictoria) &&
    esFraccion(e.uso) &&
    TIERS.includes(e.tier as Tier) &&
    typeof e.datosLimitados === 'boolean'
  );
}

/** Lista del servidor (o de la caché) validada: null si no tiene la forma esperada; las entradas no válidas se descartan. */
function normalizarLista(x: unknown, modo: ModoJuego): ListaCampeones | null {
  const l = x as Partial<ListaCampeones> | null;
  if (!l || typeof l !== 'object' || typeof l.parche !== 'string' || !Array.isArray(l.campeones)) return null;
  return { parche: l.parche, campeones: l.campeones.filter((e) => esEntradaCampeon(e, modo)) };
}

/** Segmento del rol en la URL fuera de clasificatoria (el servidor lo ignora). */
const ROL_SIN_ROL = 'ninguno';

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

  // Clasificatoria conserva el nombre de antes (`Ahri-MIDDLE.json`); los demás modos van por campeón (`aram-Ahri.json`).
  const rutaCache = (campeon: string, rol: Rol | null, modo: ModoJuego) =>
    join(dirBuilds, tieneRoles(modo) ? `${campeon}-${rol}.json` : `${modo}-${campeon}.json`);
  const rutaCacheCampeones = (modo: ModoJuego) => join(o.dirCache, `campeones-${modo}.json`);

  async function leerCache(campeon: string, rol: Rol | null, modo: ModoJuego): Promise<Build | null> {
    try {
      // Una caché escrita por la 3.1 puede traer % de victorias de aumentos y de objetos de Arena: fuera.
      return sanearBuildPolitica(JSON.parse(await readFile(rutaCache(campeon, rol, modo), 'utf8')) as Build);
    } catch {
      return null;
    }
  }

  async function guardarCache(campeon: string, rol: Rol | null, modo: ModoJuego, build: Build): Promise<void> {
    try {
      await mkdir(dirBuilds, { recursive: true });
      await writeFile(rutaCache(campeon, rol, modo), JSON.stringify(build), 'utf8');
    } catch {
      // la caché es solo una ayuda: un fallo al guardar no debe romper la consulta
    }
  }

  const pedir = (ruta: string, espera = tiempoEsperaMs) => fetchFn(`${base}${ruta}`, { signal: AbortSignal.timeout(espera) });

  return {
    /**
     * Build de un campeón en un modo (`GET /builds/:campeon/:rol?modo=`). En clasificatoria la URL no lleva `modo`
     * (igual que antes); en los demás modos el rol se ignora.
     */
    async obtenerBuild(campeon: string, rol: Rol | null, modo: ModoJuego = MODO_POR_DEFECTO): Promise<ResultadoBuild> {
      const conRol = tieneRoles(modo);
      if (conRol && rol === null) return { estado: 'no_disponible' };
      const ruta = conRol
        ? `/builds/${encodeURIComponent(campeon)}/${encodeURIComponent(rol!)}`
        : `/builds/${encodeURIComponent(campeon)}/${ROL_SIN_ROL}?modo=${encodeURIComponent(modo)}`;
      try {
        const respuesta = await pedir(ruta);
        if (respuesta.status === 200) {
          // Política de Riot (3.2): sin % de victorias de aumentos ni de objetos de Arena, aunque un servidor 3.1 los mande.
          const build = sanearBuildPolitica((await respuesta.json()) as Build);
          await guardarCache(campeon, rol, modo, build);
          return { estado: 'ok', build };
        }
      } catch {
        // caída, error de red o tiempo agotado: se trata igual que cualquier respuesta no 200
      }
      const enCache = await leerCache(campeon, rol, modo);
      if (enCache) return { estado: 'sin_conexion', build: enCache };
      // 3.7: ARAM: Caos tiene pocos datos todavía; mientras tanto, la build de ARAM (mismo mapa y mismos objetos).
      if (modo === 'caos') {
        const aram = await this.obtenerBuild(campeon, null, 'aram');
        if (aram.estado !== 'no_disponible') return { ...aram, build: { ...aram.build, respaldoDe: 'aram' } };
      }
      return { estado: 'no_disponible' };
    },

    /** Lista de campeones con su tier (`GET /campeones`); sin servidor, la última guardada. */
    async obtenerCampeones(modo: ModoJuego): Promise<ResultadoCampeones> {
      const ruta = rutaCacheCampeones(modo);
      try {
        const respuesta = await pedir(`/campeones?modo=${encodeURIComponent(modo)}`, o.tiempoEsperaMs ?? TIEMPO_ESPERA_LISTA_MS);
        if (respuesta.status === 200) {
          const lista = normalizarLista(await respuesta.json(), modo);
          if (lista) {
            try {
              await mkdir(o.dirCache, { recursive: true });
              await writeFile(ruta, JSON.stringify(lista), 'utf8');
            } catch {
              // la caché es solo una ayuda
            }
            return { estado: 'ok', lista };
          }
        }
      } catch {
        // caída, error de red o tiempo agotado: se usa la caché si la hay
      }
      try {
        const lista = normalizarLista(JSON.parse(await readFile(ruta, 'utf8')), modo);
        if (lista) return { estado: 'sin_conexion', lista };
      } catch {
        // sin caché
      }
      return { estado: 'no_disponible' };
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
