import { localeActual } from '../shared/i18n';
import { mismoCampeon } from '../shared/campeones';
import { MODO_POR_DEFECTO, MODOS_JUEGO, ROLES, tieneRoles, type ModoJuego, type Rol } from '@coach/shared';
import type { CampeonDDragon, RespuestaBuildDe, RespuestaCampeones, RespuestaCounters, RespuestaSinergias } from '../shared/tiposApp';
import { countersVista, indiceCampeones, sinergiasVista } from './builds/counters';
import type { crearClienteBuilds } from './builds/clienteBuilds';
import { recursosDe } from './builds/recursos';
import type { Aumentos } from './datos/aumentos';
import type { DatosEstaticos } from './datos/estaticos';
import { registrar } from './log';

type ClienteBuilds = Pick<ReturnType<typeof crearClienteBuilds>, 'obtenerCampeones' | 'obtenerBuild' | 'obtenerRoles'> &
  Partial<Pick<ReturnType<typeof crearClienteBuilds>, 'obtenerCounters' | 'obtenerSinergias'>>;

/** Ids de Data Dragon: letras y números (p. ej. «MonkeyKing», «KSante»). */
const REGEX_ID_CAMPEON = /^[A-Za-z0-9]{1,40}$/;

/** Filtro de 'coach:campeones': ausente o un objeto con, como mucho, un modo conocido. Null si no es válido. */
function validarFiltro(filtro: unknown): ModoJuego | null {
  if (filtro === undefined) return MODO_POR_DEFECTO;
  if (typeof filtro !== 'object' || filtro === null || Array.isArray(filtro)) return null;
  const { modo } = filtro as { modo?: unknown };
  if (modo === undefined) return MODO_POR_DEFECTO;
  return MODOS_JUEGO.includes(modo as ModoJuego) ? (modo as ModoJuego) : null;
}

/** Modo de 'coach:build-de': ausente (clasificatoria) o uno conocido. Null si no es válido. */
function validarModo(modo: unknown): ModoJuego | null {
  if (modo === undefined || modo === null) return MODO_POR_DEFECTO;
  return MODOS_JUEGO.includes(modo as ModoJuego) ? (modo as ModoJuego) : null;
}

function listaDDragon(datos: DatosEstaticos): CampeonDDragon[] {
  return [...datos.campeones.entries()]
    .map(([key, c]) => ({ id: c.id, nombre: c.nombre, key }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, localeActual()));
}

/**
 * IPC del apartado «Campeones»: solo para la ventana principal y con los argumentos validados en main.
 * - 'coach:campeones' (filtro?): todos los campeones de Data Dragon y la lista con tiers del servidor.
 * - 'coach:build-de' (campeon, rol, modo?): la build de cualquier campeón y rol (o solo campeón fuera de
 *   clasificatoria, con rol null), con sus nombres e iconos.
 * - 'coach:counters' (campeon, rol): 3.9, enfrentamientos de línea del campeón en ese rol (clasificatoria).
 * - 'coach:sinergias' (campeon, rol): 3.9.1, mejores compañeros de equipo del campeón en ese rol (clasificatoria).
 */
export function registrarIpcCampeones(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: {
    esPrincipal: (sender: unknown) => boolean;
    cargarDatos: () => Promise<DatosEstaticos>;
    /** Cliente de builds con la URL del servidor vigente. */
    builds: () => ClienteBuilds;
    /** Nombres e iconos de los aumentos (ARAM: Caos y Arena). */
    cargarAumentos?: () => Promise<Aumentos>;
  },
): void {
  async function datos(): Promise<DatosEstaticos | null> {
    try {
      return await o.cargarDatos();
    } catch (e) {
      registrar('error', `Campeones: no se pudieron cargar los datos de Data Dragon: ${String(e)}`);
      return null;
    }
  }

  ipc.handle('coach:campeones', async (e, filtro): Promise<RespuestaCampeones> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    const modo = validarFiltro(filtro);
    if (!modo) throw new Error('Filtro no válido');
    const d = await datos();
    if (!d) return { ok: false, error: 'datos' };
    const resultado = await o.builds().obtenerCampeones(modo);
    return { ok: true, modo, version: d.version, campeones: listaDDragon(d), resultado };
  });

  ipc.handle('coach:counters', async (e, campeon, rol): Promise<RespuestaCounters> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof campeon !== 'string' || !REGEX_ID_CAMPEON.test(campeon) || !ROLES.includes(rol as Rol)) throw new Error('Argumentos no válidos');
    const d = await datos();
    const builds = o.builds();
    if (!d || !builds.obtenerCounters) return { ok: false };
    const r = await builds.obtenerCounters(campeon, rol as Rol);
    if (r.estado === 'no_disponible') return { ok: false };
    return { ok: true, version: d.version, counters: countersVista(r.counters, indiceCampeones(d), r.estado === 'sin_conexion') };
  });

  ipc.handle('coach:sinergias', async (e, campeon, rol): Promise<RespuestaSinergias> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof campeon !== 'string' || !REGEX_ID_CAMPEON.test(campeon) || !ROLES.includes(rol as Rol)) throw new Error('Argumentos no válidos');
    const d = await datos();
    const builds = o.builds();
    if (!d || !builds.obtenerSinergias) return { ok: false };
    const r = await builds.obtenerSinergias(campeon, rol as Rol);
    if (r.estado === 'no_disponible') return { ok: false };
    return { ok: true, version: d.version, sinergias: sinergiasVista(r.sinergias, indiceCampeones(d), r.estado === 'sin_conexion') };
  });

  ipc.handle('coach:build-de', async (e, campeon, rolCrudo, modoCrudo): Promise<RespuestaBuildDe> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    const modo = validarModo(modoCrudo);
    const rolValido = rolCrudo === null ? !modo || !tieneRoles(modo) : ROLES.includes(rolCrudo as Rol);
    if (typeof campeon !== 'string' || !REGEX_ID_CAMPEON.test(campeon) || !modo || !rolValido) {
      throw new Error('Argumentos no válidos');
    }
    const rol: Rol | null = tieneRoles(modo) ? (rolCrudo as Rol) : null;
    const d = await datos();
    if (!d) return { ok: false, error: 'datos' };
    const entrada = [...d.campeones.entries()].find(([, c]) => mismoCampeon(c.id, campeon));
    if (!entrada) return { ok: false, error: 'campeon' };
    const [key, c] = entrada;
    const builds = o.builds();
    const [rolesDisponibles, resultado] = await Promise.all([
      rol ? builds.obtenerRoles(c.id) : Promise.resolve([]),
      builds.obtenerBuild(c.id, rol, modo),
    ]);
    let aumentos: Aumentos | undefined;
    if (resultado.estado !== 'no_disponible' && resultado.build.aumentosPopulares?.length) {
      try {
        aumentos = await o.cargarAumentos?.();
      } catch {
        aumentos = undefined;
      }
    }
    return {
      ok: true,
      campeon: { id: c.id, nombre: c.nombre, key },
      rol,
      modo,
      rolesDisponibles,
      resultado,
      version: d.version,
      recursos: resultado.estado === 'no_disponible' ? { objetos: {}, runas: {}, hechizos: {} } : recursosDe(resultado.build, d, aumentos),
    };
  });
}
