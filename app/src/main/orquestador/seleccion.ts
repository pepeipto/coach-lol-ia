import { clasificarObjeto, tieneRoles, type Build, type ModoJuego, type Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Ajustes, EstadoPrincipal, ResultadoImportar } from '../../shared/tiposApp';
import { crearClienteBuilds } from '../builds/clienteBuilds';
import { recursosDe } from '../builds/recursos';
import type { Aumentos } from '../datos/aumentos';
import type { DatosEstaticos } from '../datos/estaticos';
import type { ClienteLcu } from '../lcu/cliente';
import { importarTodo } from '../lcu/importar';
import type { SeleccionCampeon } from '../lcu/seleccion';
import { registrar } from '../log';
import { urlServidor } from '../servidor';
import { buildDeOpcion, opcionValida } from '../../shared/opciones';

interface Dependencias {
  dirCache: string;
  cargarDatos: () => Promise<DatosEstaticos>;
  obtenerAjustes: () => Ajustes;
  enviar: (estado: EstadoPrincipal) => void;
  /** Nombres e iconos de los aumentos (ARAM: Caos y Arena); sin ella, se enseñan sus ids. */
  cargarAumentos?: () => Promise<Aumentos>;
  /** Sustituibles en las pruebas. */
  crearBuilds?: typeof crearClienteBuilds;
  importarTodo?: typeof importarTodo;
  urlServidor?: () => string;
}

const FALLO_TOTAL: ResultadoImportar = {
  runas: { ok: false, motivo: 'error' },
  hechizos: { ok: false, motivo: 'error' },
  objetos: { ok: false, motivo: 'error' },
};

/** Une el vigilante del cliente, los datos y las builds, y empuja el estado a la ventana principal. */
export function crearOrquestadorSeleccion(dep: Dependencias) {
  let datos: DatosEstaticos | null = null;
  let lcu: ClienteLcu | null = null;
  let seleccion: SeleccionCampeon | null = null;
  let estado: EstadoPrincipal = {
    cliente: 'esperando',
    seleccion: null,
    version: '',
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    error: null,
    importacion: null,
    aviso: null,
  };
  let generacion = 0;
  let cola: Promise<unknown> = Promise.resolve();
  let ultimaAuto: string | null = null;
  /** Arena no tiene runas ni un conjunto de objetos que importar: no se ofrece «Importar». */
  const importable = (modo: ModoJuego | undefined) => modo !== 'arena';
  async function aumentos(): Promise<Aumentos | undefined> {
    try {
      return await dep.cargarAumentos?.();
    } catch {
      return undefined;
    }
  }

  /** Opción elegida por campeón y rol, solo durante la sesión. */
  const opcionesElegidas = new Map<string, number>();
  const crearBuilds = dep.crearBuilds ?? crearClienteBuilds;
  const importarLcu = dep.importarTodo ?? importarTodo;

  const publicar = (parcial: Partial<EstadoPrincipal>) => {
    estado = { ...estado, ...parcial };
    dep.enviar(estado);
  };

  async function asegurarDatos(): Promise<DatosEstaticos | null> {
    if (datos) return datos;
    try {
      datos = await dep.cargarDatos();
      return datos;
    } catch (e) {
      registrar('error', `No se pudieron cargar los datos de Data Dragon: ${String(e)}`);
      return null;
    }
  }

  async function mostrar(sel: SeleccionCampeon, rolElegido?: Rol): Promise<void> {
    const gen = ++generacion;
    try {
      const d = await asegurarDatos();
      if (gen !== generacion) return;
      if (!d) return publicar({ seleccion: null, error: 'datos', importacion: null });
      const campeon = d.campeones.get(sel.campeonId);
      if (!campeon) return publicar({ seleccion: null, error: null, importacion: null });
      const builds = crearBuilds({ urlServidor: (dep.urlServidor ?? urlServidor)(), dirCache: dep.dirCache });
      // ARAM, ARAM: Caos y Arena: build por campeón, sin roles. Una cola sin datos propios usa clasificatoria.
      const modo: ModoJuego = sel.modo ?? 'clasificatoria';
      const conRoles = tieneRoles(modo);
      const roles = conRoles ? await builds.obtenerRoles(campeon.id) : [];
      const rol: Rol | null = conRoles ? (rolElegido ?? sel.rol ?? roles[0] ?? 'MIDDLE') : null;
      const resultado = await builds.obtenerBuild(campeon.id, rol, modo);
      const listaAumentos = resultado.estado !== 'no_disponible' && resultado.build.aumentos?.length ? await aumentos() : undefined;
      if (gen !== generacion) return;
      const recordada = opcionesElegidas.get(`${sel.campeonId}-${modo}-${rol}`) ?? 0;
      const opcion = resultado.estado !== 'no_disponible' && opcionValida(resultado.build, recordada) ? recordada : 0;
      publicar({
        seleccion: {
          campeon: { ...campeon, key: sel.campeonId },
          rol,
          ...(conRoles ? {} : { modo }),
          rolesDisponibles: roles,
          resultado,
          opcion,
        },
        version: d.version,
        recursos: resultado.estado === 'no_disponible' ? estado.recursos : recursosDe(resultado.build, d, listaAumentos),
        error: null,
        importacion: null,
      });
      await importarAutomatico();
    } catch (e) {
      registrar('error', `Error al mostrar la build: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Con la importación automática, importa la selección actual (con su opción) si aún no se hizo. */
  async function importarAutomatico(): Promise<void> {
    const sel = estado.seleccion;
    if (!sel || sel.resultado.estado === 'no_disponible' || !importable(sel.modo) || !dep.obtenerAjustes().importacionAutomatica) return;
    const clave = `${sel.campeon.key}-${sel.modo ?? 'clasificatoria'}-${sel.rol}-${sel.opcion}`;
    if (clave === ultimaAuto) return;
    ultimaAuto = clave;
    await importar();
  }

  /** Las importaciones se encadenan: nunca hay dos a la vez borrando y creando páginas. */
  function importar(): Promise<ResultadoImportar> {
    const turno = cola.then(async () => {
      const sel = estado.seleccion;
      if (!lcu || !sel || sel.resultado.estado === 'no_disponible' || !importable(sel.modo)) return FALLO_TOTAL;
      const titulo = `Coach: ${sel.campeon.nombre} ${sel.rol ? t('rol.' + sel.rol) : t('modo.' + sel.modo)}`;
      const mapa = sel.modo === 'aram' || sel.modo === 'caos' ? 12 : 11;
      let resultado: ResultadoImportar;
      try {
        resultado = await importarLcu(lcu, buildDeOpcion(sel.resultado.build, sel.opcion), sel.campeon.key, titulo, mapa);
      } catch (e) {
        registrar('error', `Importación fallida: ${e instanceof Error ? e.message : String(e)}`);
        resultado = FALLO_TOTAL;
      }
      // Solo se publica si la selección sigue siendo la misma.
      if (estado.seleccion === sel) publicar({ importacion: resultado });
      return resultado;
    });
    cola = turno.catch(() => undefined);
    return turno;
  }

  return {
    estado: () => estado,
    importar,
    /**
     * Build y rol efectivos de la selección, y los objetos, para los consejos en partida. Null si no hay datos.
     * En Arena, la próxima compra sale de los objetos legendarios más elegidos (la build no tiene núcleo).
     */
    async contexto(): Promise<{ build: Build | null; rol: Rol; objetos: DatosEstaticos['objetos']; version: string; modo: ModoJuego } | null> {
      const d = await asegurarDatos();
      if (!d) return null;
      const sel = estado.seleccion;
      let build = sel && sel.resultado.estado !== 'no_disponible' ? buildDeOpcion(sel.resultado.build, sel.opcion) : null;
      if (build?.modo === 'arena' && build.objetosArena?.length) {
        const legendarios = build.objetosArena
          .map((o) => o.id)
          .filter((id) => d.objetos[id] && clasificarObjeto(id, d.objetos[id]) === 'legendario')
          .slice(0, 3);
        build = { ...build, nucleo: legendarios };
      }
      return { build, rol: sel?.rol ?? seleccion?.rol ?? 'MIDDLE', objetos: d.objetos, version: d.version, modo: sel?.modo ?? 'clasificatoria' };
    },
    avisar(aviso: string | null): void {
      publicar({ aviso });
    },
    /** Al salir de la selección de campeones se olvida la última importación automática. */
    fase(fase: string): void {
      if (fase !== 'ChampSelect') ultimaAuto = null;
    },
    /** Elige otra opción de build; un índice no válido (o sin build) se ignora. */
    async cambiarOpcion(i: number): Promise<void> {
      const sel = estado.seleccion;
      if (!sel || sel.resultado.estado === 'no_disponible' || !opcionValida(sel.resultado.build, i) || i === sel.opcion) return;
      opcionesElegidas.set(`${sel.campeon.key}-${sel.modo ?? 'clasificatoria'}-${sel.rol}`, i);
      publicar({ seleccion: { ...sel, opcion: i }, importacion: null });
      await importarAutomatico();
    },
    async cambiarRol(rol: Rol): Promise<void> {
      // Fuera de clasificatoria no hay roles: el cambio se ignora.
      if (seleccion && tieneRoles(seleccion.modo ?? 'clasificatoria')) await mostrar(seleccion, rol);
    },
    conectado(cliente: ClienteLcu): void {
      lcu = cliente;
      publicar({ cliente: 'conectado' });
    },
    desconectado(): void {
      lcu = null;
      seleccion = null;
      ultimaAuto = null;
      generacion++;
      publicar({ cliente: 'esperando', seleccion: null, error: null, importacion: null });
    },
    async alSeleccionar(sel: SeleccionCampeon): Promise<void> {
      seleccion = sel;
      await mostrar(sel);
    },
  };
}
