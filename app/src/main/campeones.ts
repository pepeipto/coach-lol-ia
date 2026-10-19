import { MODO_POR_DEFECTO, MODOS_JUEGO, ROLES, type ModoJuego, type Rol } from '@coach/shared';
import type { CampeonDDragon, RespuestaBuildDe, RespuestaCampeones } from '../shared/tiposApp';
import type { crearClienteBuilds } from './builds/clienteBuilds';
import { recursosDe } from './builds/recursos';
import type { DatosEstaticos } from './datos/estaticos';
import { registrar } from './log';

type ClienteBuilds = Pick<ReturnType<typeof crearClienteBuilds>, 'obtenerCampeones' | 'obtenerBuild' | 'obtenerRoles'>;

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

function listaDDragon(datos: DatosEstaticos): CampeonDDragon[] {
  return [...datos.campeones.entries()]
    .map(([key, c]) => ({ id: c.id, nombre: c.nombre, key }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * IPC del apartado «Campeones»: solo para la ventana principal y con los argumentos validados en main.
 * - 'coach:campeones' (filtro?): todos los campeones de Data Dragon y la lista con tiers del servidor.
 * - 'coach:build-de' (campeon, rol): la build de cualquier campeón y rol, con sus nombres e iconos.
 */
export function registrarIpcCampeones(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: {
    esPrincipal: (sender: unknown) => boolean;
    cargarDatos: () => Promise<DatosEstaticos>;
    /** Cliente de builds con la URL del servidor vigente. */
    builds: () => ClienteBuilds;
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

  ipc.handle('coach:build-de', async (e, campeon, rol): Promise<RespuestaBuildDe> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof campeon !== 'string' || !REGEX_ID_CAMPEON.test(campeon) || !ROLES.includes(rol as Rol)) {
      throw new Error('Argumentos no válidos');
    }
    const d = await datos();
    if (!d) return { ok: false, error: 'datos' };
    const entrada = [...d.campeones.entries()].find(([, c]) => c.id === campeon);
    if (!entrada) return { ok: false, error: 'campeon' };
    const [key, c] = entrada;
    const builds = o.builds();
    const [rolesDisponibles, resultado] = await Promise.all([builds.obtenerRoles(c.id), builds.obtenerBuild(c.id, rol as Rol)]);
    return {
      ok: true,
      campeon: { id: c.id, nombre: c.nombre, key },
      rol: rol as Rol,
      rolesDisponibles,
      resultado,
      version: d.version,
      recursos: resultado.estado === 'no_disponible' ? { objetos: {}, runas: {}, hechizos: {} } : recursosDe(resultado.build, d),
    };
  });
}
