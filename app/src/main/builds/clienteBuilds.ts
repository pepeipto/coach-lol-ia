import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MODO_POR_DEFECTO, ROLES, RUTAS_COUNTERS, RUTAS_ROTATIVOS, sanearBuildPolitica, type CountersCampeon, type Enfrentamiento, type EnfrentamientoLinea, type SinergiaAliado, type SinergiasCampeon, TIERS, tieneRoles, type Build, type EntradaCampeon, type ListaCampeones, type ListaModosRotativos, type ModoJuego, type ModoRotativo, type Rol, type RolesCampeon, type Tier } from '@coach/shared';

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
    typeof e.datosLimitados === 'boolean' &&
    esNumeroOpcional(e.tasaBloqueo, 0, 1) &&
    esNumeroOpcional(e.tasaSeleccion, 0, 1)
  );
}

/** Lista del servidor (o de la caché) validada: null si no tiene la forma esperada; las entradas no válidas se descartan. */
function normalizarLista(x: unknown, modo: ModoJuego): ListaCampeones | null {
  const l = x as Partial<ListaCampeones> | null;
  if (!l || typeof l !== 'object' || typeof l.parche !== 'string' || !Array.isArray(l.campeones)) return null;
  return { parche: l.parche, campeones: l.campeones.filter((e) => esEntradaCampeon(e, modo)) };
}

/** 3.8: un modo rotativo de `GET /rotativos` con la forma del contrato. */
function esModoRotativo(x: unknown): x is ModoRotativo {
  const m = x as Partial<ModoRotativo> | null;
  return (
    !!m &&
    typeof m === 'object' &&
    typeof m.cola === 'number' &&
    Number.isInteger(m.cola) &&
    typeof m.gameMode === 'string' &&
    typeof m.mapa === 'number' &&
    typeof m.nombre === 'string' &&
    typeof m.conDatos === 'boolean' &&
    typeof m.pve === 'boolean'
  );
}

/** Lista de modos rotativos validada (servidor o caché): null si no tiene la forma esperada; los modos raros fuera. */
export function normalizarRotativos(x: unknown): ListaModosRotativos | null {
  const l = x as Partial<ListaModosRotativos> | null;
  if (!l || typeof l !== 'object' || !Array.isArray(l.modos)) return null;
  return { actualizado: typeof l.actualizado === 'string' ? l.actualizado : '', modos: l.modos.filter(esModoRotativo) };
}

export type ResultadoCounters = { estado: 'ok' | 'sin_conexion'; counters: CountersCampeon } | { estado: 'no_disponible' };
export type ResultadoSinergias = { estado: 'ok' | 'sin_conexion'; sinergias: SinergiasCampeon } | { estado: 'no_disponible' };
export type ResultadoEnfrentamiento = { estado: 'ok' | 'sin_conexion'; enfrentamiento: Enfrentamiento } | { estado: 'no_disponible' };

/** Ids de Data Dragon: letras y números. También protege los nombres de los ficheros de caché. */
const REGEX_ID_CAMPEON = /^[A-Za-z0-9]{1,40}$/;
const esId = (x: unknown): x is string => typeof x === 'string' && REGEX_ID_CAMPEON.test(x);
const esConteo = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

/** 3.9: un cruce de `CountersCampeon` con la forma del contrato. */
function esLinea(x: unknown): x is EnfrentamientoLinea {
  const e = x as Partial<EnfrentamientoLinea> | null;
  return !!e && typeof e === 'object' && esId(e.rival) && esConteo(e.partidas) && e.partidas > 0 && esFraccion(e.tasaVictoria) && typeof e.datosLimitados === 'boolean';
}

/**
 * 3.9.1: fase de líneas y puntuación de un cruce, solo si vienen bien formadas (un servidor 3.9 no las manda; si
 * alguna es rara, no se enseña ninguna).
 */
function faseLineas(e: Partial<EnfrentamientoLinea>): Pick<EnfrentamientoLinea, 'tasaFaseLineas' | 'partidasFaseLineas' | 'puntuacion'> {
  const { tasaFaseLineas: tasa, partidasFaseLineas: partidas, puntuacion } = e;
  if (!esFraccion(tasa) || !esConteo(partidas) || partidas === 0) return {};
  const conPuntuacion = typeof puntuacion === 'number' && Number.isFinite(puntuacion) && puntuacion >= -100 && puntuacion <= 100;
  return { tasaFaseLineas: tasa as number, partidasFaseLineas: partidas, ...(conPuntuacion ? { puntuacion } : {}) };
}

/** Un cruce válido, con solo los campos del contrato. */
const limpiarLinea = (e: EnfrentamientoLinea): EnfrentamientoLinea => ({
  rival: e.rival,
  partidas: e.partidas,
  tasaVictoria: e.tasaVictoria,
  datosLimitados: e.datosLimitados,
  ...faseLineas(e),
});
const lineasValidas = (lista: unknown[]) => lista.filter(esLinea).map(limpiarLinea);

/** 3.9: counters del servidor (o de la caché) validados: null si no tienen la forma esperada; los cruces raros fuera. */
export function normalizarCounters(x: unknown): CountersCampeon | null {
  const c = x as Partial<CountersCampeon> | null;
  if (!c || typeof c !== 'object' || !esId(c.campeon) || !ROLES.includes(c.rol as Rol) || typeof c.parche !== 'string') return null;
  if (!esConteo(c.partidas) || !Array.isArray(c.faciles) || !Array.isArray(c.dificiles)) return null;
  return {
    campeon: c.campeon,
    rol: c.rol as Rol,
    parche: c.parche,
    partidas: c.partidas,
    // Un servidor sin la lista completa: sus dos extremos, de mejor a peor.
    enfrentamientos: Array.isArray(c.enfrentamientos)
      ? lineasValidas(c.enfrentamientos)
      : [...lineasValidas(c.faciles), ...lineasValidas(c.dificiles).reverse()],
    faciles: lineasValidas(c.faciles),
    dificiles: lineasValidas(c.dificiles),
  };
}

/** 3.9.1: un compañero de `SinergiasCampeon` con la forma del contrato. */
function esAliado(x: unknown): x is SinergiaAliado {
  const a = x as Partial<SinergiaAliado> | null;
  return !!a && typeof a === 'object' && esId(a.aliado) && esConteo(a.partidas) && a.partidas > 0 && esFraccion(a.tasaVictoria) && typeof a.datosLimitados === 'boolean';
}

/** 3.9.1: sinergias del servidor (o de la caché) validadas: null si no tienen la forma esperada; lo raro fuera. */
export function normalizarSinergias(x: unknown): SinergiasCampeon | null {
  const s = x as Partial<SinergiasCampeon> | null;
  if (!s || typeof s !== 'object' || !esId(s.campeon) || !ROLES.includes(s.rol as Rol) || typeof s.parche !== 'string' || !Array.isArray(s.porRol)) return null;
  const porRol: SinergiasCampeon['porRol'] = [];
  for (const g of s.porRol as unknown[]) {
    const grupo = g as Partial<SinergiasCampeon['porRol'][number]> | null;
    if (!grupo || typeof grupo !== 'object' || !ROLES.includes(grupo.rol as Rol) || grupo.rol === s.rol || !Array.isArray(grupo.aliados)) continue;
    if (porRol.some((p) => p.rol === grupo.rol)) continue;
    const aliados = grupo.aliados.filter(esAliado).map((a) => ({ aliado: a.aliado, partidas: a.partidas, tasaVictoria: a.tasaVictoria, datosLimitados: a.datosLimitados }));
    if (aliados.length > 0) porRol.push({ rol: grupo.rol as Rol, aliados });
  }
  return { campeon: s.campeon, rol: s.rol as Rol, parche: s.parche, porRol };
}

/** 3.9: un cruce del servidor (o de la caché) validado; la build, sin cifras prohibidas por la política de Riot. */
export function normalizarEnfrentamiento(x: unknown): Enfrentamiento | null {
  const e = x as Partial<Enfrentamiento> | null;
  if (!e || typeof e !== 'object' || !esId(e.campeon) || !esId(e.rival) || !ROLES.includes(e.rol as Rol) || typeof e.parche !== 'string') return null;
  if (!esConteo(e.partidas) || e.partidas === 0 || !esFraccion(e.tasaVictoria) || typeof e.datosLimitados !== 'boolean') return null;
  const build = e.build && typeof e.build === 'object' && Array.isArray(e.build.nucleo) && e.build.runas ? sanearBuildPolitica(e.build) : undefined;
  return {
    campeon: e.campeon,
    rival: e.rival,
    rol: e.rol as Rol,
    parche: e.parche,
    partidas: e.partidas,
    tasaVictoria: e.tasaVictoria as number,
    datosLimitados: e.datosLimitados,
    ...faseLineas(e),
    ...(build ? { build } : {}),
  };
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

  /**
   * GET de una ruta JSON con caché en disco: con 200 y forma válida guarda y devuelve 'ok'; si no (caída, 404,
   * tiempo agotado o respuesta rara), lo último guardado como 'sin_conexion'; sin caché, null.
   */
  async function pedirConCache<T>(ruta: string, archivo: string, normalizar: (x: unknown) => T | null): Promise<{ estado: 'ok' | 'sin_conexion'; valor: T } | null> {
    try {
      const respuesta = await pedir(ruta);
      if (respuesta.status === 200) {
        const valor = normalizar(await respuesta.json());
        if (valor) {
          try {
            await mkdir(join(archivo, '..'), { recursive: true });
            await writeFile(archivo, JSON.stringify(valor), 'utf8');
          } catch {
            // la caché es solo una ayuda
          }
          return { estado: 'ok', valor };
        }
      }
    } catch {
      // caída, error de red o tiempo agotado: se usa la caché si la hay
    }
    try {
      const valor = normalizar(JSON.parse(await readFile(archivo, 'utf8')));
      if (valor) return { estado: 'sin_conexion', valor };
    } catch {
      // sin caché
    }
    return null;
  }
  const dirCounters = join(o.dirCache, 'counters');

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

    /**
     * 3.8: modos rotativos que conoce el servidor (`GET /rotativos`); sin servidor, la última lista guardada; null si
     * no hay ninguna.
     */
    async obtenerRotativos(): Promise<{ estado: 'ok' | 'sin_conexion'; lista: ListaModosRotativos } | null> {
      const ruta = join(o.dirCache, 'rotativos.json');
      try {
        const respuesta = await pedir(RUTAS_ROTATIVOS.lista);
        if (respuesta.status === 200) {
          const lista = normalizarRotativos(await respuesta.json());
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
        const lista = normalizarRotativos(JSON.parse(await readFile(ruta, 'utf8')));
        if (lista) return { estado: 'sin_conexion', lista };
      } catch {
        // sin caché
      }
      return null;
    },

    /**
     * 3.8: build de un campeón en un modo rotativo (`GET /rotativos/:cola/builds/:campeon`), con caché en disco
     * (`builds/rotativo-<cola>-<campeon>.json`). 404 `sin_datos` sin caché → no_disponible.
     */
    async obtenerBuildRotativa(cola: number, campeon: string): Promise<ResultadoBuild> {
      const archivo = join(dirBuilds, `rotativo-${cola}-${campeon}.json`);
      try {
        const respuesta = await pedir(RUTAS_ROTATIVOS.build(cola, campeon));
        if (respuesta.status === 200) {
          const build = sanearBuildPolitica((await respuesta.json()) as Build);
          try {
            await mkdir(dirBuilds, { recursive: true });
            await writeFile(archivo, JSON.stringify(build), 'utf8');
          } catch {
            // la caché es solo una ayuda
          }
          return { estado: 'ok', build };
        }
      } catch {
        // caída, error de red o tiempo agotado
      }
      try {
        return { estado: 'sin_conexion', build: sanearBuildPolitica(JSON.parse(await readFile(archivo, 'utf8')) as Build) };
      } catch {
        return { estado: 'no_disponible' };
      }
    },

    /**
     * 3.9: enfrentamientos de línea de un campeón en un rol (`GET /counters/:campeon/:rol`), con caché en disco
     * (`counters/<campeon>-<rol>.json`).
     */
    async obtenerCounters(campeon: string, rol: Rol): Promise<ResultadoCounters> {
      if (!esId(campeon) || !ROLES.includes(rol)) return { estado: 'no_disponible' };
      const r = await pedirConCache(RUTAS_COUNTERS.counters(campeon, rol), join(dirCounters, `${campeon}-${rol}.json`), normalizarCounters);
      return r ? { estado: r.estado, counters: r.valor } : { estado: 'no_disponible' };
    },

    /**
     * 3.9: un cruce concreto (`GET /enfrentamiento/:campeon/:rival/:rol`), con caché en disco
     * (`counters/<campeon>-vs-<rival>-<rol>.json`).
     */
    async obtenerEnfrentamiento(campeon: string, rival: string, rol: Rol): Promise<ResultadoEnfrentamiento> {
      if (!esId(campeon) || !esId(rival) || !ROLES.includes(rol)) return { estado: 'no_disponible' };
      const r = await pedirConCache(
        RUTAS_COUNTERS.enfrentamiento(campeon, rival, rol),
        join(dirCounters, `${campeon}-vs-${rival}-${rol}.json`),
        normalizarEnfrentamiento,
      );
      return r ? { estado: r.estado, enfrentamiento: r.valor } : { estado: 'no_disponible' };
    },

    /**
     * 3.9.1: mejores compañeros de equipo de un campeón en un rol (`GET /sinergias/:campeon/:rol`), con caché en disco
     * (`counters/<campeon>-<rol>-sinergias.json`).
     */
    async obtenerSinergias(campeon: string, rol: Rol): Promise<ResultadoSinergias> {
      if (!esId(campeon) || !ROLES.includes(rol)) return { estado: 'no_disponible' };
      const r = await pedirConCache(RUTAS_COUNTERS.sinergias(campeon, rol), join(dirCounters, `${campeon}-${rol}-sinergias.json`), normalizarSinergias);
      return r ? { estado: r.estado, sinergias: r.valor } : { estado: 'no_disponible' };
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
