import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IDIOMAS_IA, normalizarNotasParche, RUTAS_PARCHE, type IdiomaIa, type NotasParche } from '@coach/shared';
import { idiomaActual } from '../shared/i18n';
import type { CampeonPerfil } from '../shared/perfil';
import type { CambioCampeonVista, CambioObjetoVista, NotasParcheVista, RespuestaNotasParche } from '../shared/tiposApp';
import { indiceCampeones } from './builds/counters';
import type { DatosEstaticos } from './datos/estaticos';

/*
 * Novedades del parche en la app: lo que cambia para tus campeones.
 *
 * El servidor resume una vez por parche e idioma las notas oficiales de Riot (GET /parche/actual?idioma=); aquí se
 * piden con caché en disco (`parche/actual-<idioma>.json`) y se cruzan con el Perfil local para poner primero los
 * campeones que más juegas. Ningún dato del jugador sale del PC: la petición es la misma para todos.
 */

export type ResultadoNotasParche = { estado: 'ok' | 'sin_conexion'; notas: NotasParche } | { estado: 'no_disponible' };

/** Unas notas guardadas hace menos de esto se usan sin preguntar al servidor. */
export const VIGENCIA_NOTAS_PARCHE_MS = 6 * 60 * 60_000;
/** La primera vez en un idioma el servidor escribe el resumen con la IA: se le da margen. */
const TIEMPO_ESPERA_MS = 90_000;
/** Cuántos de tus campeones más jugados se miran para «Tus campeones». */
export const MAX_TUS_CAMPEONES = 10;

/** Enlaces que se pueden abrir desde la vista: solo las notas de leagueoflegends.com. */
const URL_NOTAS = /^https:\/\/www\.leagueoflegends\.com\/[a-z]{2}-[a-z]{2}\/news\/game-updates\/league-of-legends-patch-\d{1,2}-\d{1,2}-notes\/$/;
export const esUrlNotasParche = (x: unknown): x is string => typeof x === 'string' && URL_NOTAS.test(x);

export function crearClienteNotasParche(o: { urlServidor: string; dirCache: string; fetch?: typeof fetch }) {
  const base = o.urlServidor.replace(/\/+$/, '');
  const hacerFetch = o.fetch ?? fetch;
  const dir = join(o.dirCache, 'parche');

  async function leerCache(archivo: string, idioma: IdiomaIa): Promise<NotasParche | null> {
    try {
      const n = normalizarNotasParche(JSON.parse(await readFile(archivo, 'utf8')));
      return n && n.idioma === idioma ? n : null;
    } catch {
      return null;
    }
  }

  return {
    /**
     * Notas del último parche resumido: la guardada si tiene menos de VIGENCIA_NOTAS_PARCHE_MS; si no, se pide al
     * servidor y, si falla, se usa la guardada como 'sin_conexion'.
     */
    async obtener(idioma: IdiomaIa, ahora: number = Date.now()): Promise<ResultadoNotasParche> {
      if (!IDIOMAS_IA.includes(idioma)) return { estado: 'no_disponible' };
      const archivo = join(dir, `actual-${idioma}.json`);
      try {
        const info = await stat(archivo);
        if (ahora - info.mtimeMs < VIGENCIA_NOTAS_PARCHE_MS) {
          const n = await leerCache(archivo, idioma);
          if (n) return { estado: 'ok', notas: n };
        }
      } catch {
        // sin caché reciente
      }
      try {
        const r = await hacerFetch(`${base}${RUTAS_PARCHE.notas('actual', idioma)}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
        if (r.status === 200) {
          const n = normalizarNotasParche(await r.json());
          if (n && n.idioma === idioma) {
            try {
              await mkdir(dir, { recursive: true });
              await writeFile(archivo, JSON.stringify(n), 'utf8');
            } catch {
              // la caché es solo una ayuda
            }
            return { estado: 'ok', notas: n };
          }
        }
      } catch {
        // caída, error de red o tiempo agotado: se usa la caché si la hay
      }
      const guardada = await leerCache(archivo, idioma);
      return guardada ? { estado: 'sin_conexion', notas: guardada } : { estado: 'no_disponible' };
    },
  };
}

/**
 * Notas con los campeones resueltos (nombre e icono de Data Dragon, en el idioma de la app) y repartidas: primero los
 * que más juegas (del Perfil local, en orden de partidas), luego el resto por nombre. Los objetos, con su nombre en el
 * idioma de la app si Data Dragon los conoce.
 */
export function notasParcheVista(
  notas: NotasParche,
  datos: Pick<DatosEstaticos, 'campeones' | 'objetos'>,
  tusCampeones: Pick<CampeonPerfil, 'campeonId' | 'partidas'>[],
  sinConexion: boolean,
  locale = 'es',
): NotasParcheVista {
  const indice = indiceCampeones(datos);
  const cambios: CambioCampeonVista[] = [];
  for (const c of notas.campeones) {
    const campeon = indice.get(c.campeon.toLowerCase());
    if (campeon) cambios.push({ campeon, tipo: c.tipo, resumen: c.resumen });
  }
  const partidasDe = new Map(tusCampeones.slice(0, MAX_TUS_CAMPEONES).map((c) => [c.campeonId, c.partidas]));
  const tuyos = cambios
    .filter((c) => partidasDe.has(c.campeon.key))
    .map((c) => ({ ...c, partidas: partidasDe.get(c.campeon.key)! }))
    .sort((a, b) => b.partidas - a.partidas);
  const resto = cambios.filter((c) => !partidasDe.has(c.campeon.key)).sort((a, b) => a.campeon.nombre.localeCompare(b.campeon.nombre, locale));
  const objetos: CambioObjetoVista[] = notas.objetos.map((o) => {
    const dd = o.id ? datos.objetos[o.id] : undefined;
    return { ...(dd && o.id ? { id: o.id } : {}), nombre: dd?.name || o.objeto, tipo: o.tipo, resumen: o.resumen };
  });
  return {
    parcheJuego: notas.parcheJuego,
    url: notas.url,
    ...(notas.general ? { general: notas.general } : {}),
    tuyos,
    resto,
    objetos,
    hayPerfil: tusCampeones.length > 0,
    sinConexion,
  };
}

/**
 * IPC de las novedades del parche (solo para la ventana principal):
 * - 'coach:notas-parche': las notas del último parche en el idioma de la app, con «Tus campeones» primero.
 * - 'coach:abrir-notas-parche' (url): abre las notas oficiales de Riot en el navegador (solo esa URL).
 */
export function registrarIpcNotasParche(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: {
    esPrincipal: (sender: unknown) => boolean;
    cargarDatos: () => Promise<DatosEstaticos>;
    cliente: () => Pick<ReturnType<typeof crearClienteNotasParche>, 'obtener'>;
    /** Campeones del Perfil local, del más jugado al menos (vacío si no hay perfil). */
    tusCampeones: () => Promise<Pick<CampeonPerfil, 'campeonId' | 'partidas'>[]>;
    abrir: (url: string) => Promise<void>;
    locale?: () => string;
  },
): void {
  ipc.handle('coach:notas-parche', async (e): Promise<RespuestaNotasParche> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    let datos: DatosEstaticos;
    try {
      datos = await o.cargarDatos();
    } catch {
      return { ok: false };
    }
    const r = await o.cliente().obtener(idiomaActual());
    if (r.estado === 'no_disponible') return { ok: false };
    let tuyos: Pick<CampeonPerfil, 'campeonId' | 'partidas'>[] = [];
    try {
      tuyos = await o.tusCampeones();
    } catch {
      // sin perfil: todos los campeones van al «resto»
    }
    return { ok: true, version: datos.version, notas: notasParcheVista(r.notas, datos, tuyos, r.estado === 'sin_conexion', o.locale?.()) };
  });

  ipc.handle('coach:abrir-notas-parche', async (e, url) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (!esUrlNotasParche(url)) throw new Error('Argumentos no válidos');
    await o.abrir(url);
  });
}
