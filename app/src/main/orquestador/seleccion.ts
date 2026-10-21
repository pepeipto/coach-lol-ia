import { clasificarObjeto, MAPA_DE_MODO, tieneRoles, type Build, type ModoJuego, type Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Ajustes, EstadoPrincipal, ResultadoImportar } from '../../shared/tiposApp';
import { crearClienteBuilds } from '../builds/clienteBuilds';
import { recursosDe } from '../builds/recursos';
import type { Aumentos } from '../datos/aumentos';
import { panelAumentos } from '../consejos/aumentosCaos';
import type { DatosEstaticos } from '../datos/estaticos';
import type { ClienteLcu } from '../lcu/cliente';
import { importarTodo, type OpcionesRunas } from '../lcu/importar';
import type { SeleccionCampeon } from '../lcu/seleccion';
import { registrar } from '../log';
import { urlServidor } from '../servidor';
import { buildElegida, opcionValida, runasValida } from '../../shared/opciones';

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
  /** Página de runas elegida por campeón, modo y rol (3.0.1), también solo durante la sesión. */
  const runasElegidas = new Map<string, number>();
  /** Campeón, modo y rol ya importados en esta selección de campeones: cambiar de runas los vuelve a importar. */
  let importadaEn: string | null = null;
  const claveDe = (sel: NonNullable<EstadoPrincipal['seleccion']>) => `${sel.campeon.key}-${sel.modo ?? 'clasificatoria'}-${sel.rol}`;
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
      const necesitaAumentos = modo === 'caos' || (resultado.estado !== 'no_disponible' && !!resultado.build.aumentosPopulares?.length);
      const listaAumentos = necesitaAumentos ? await aumentos() : undefined;
      // 3.4: en ARAM: Caos, la tier list de aumentos por encaje con el campeón (sin % de victorias: política de Riot).
      const aumentosCaos = modo === 'caos' && listaAumentos?.size ? panelAumentos(campeon, listaAumentos) : undefined;
      if (gen !== generacion) return;
      const recordada = opcionesElegidas.get(`${sel.campeonId}-${modo}-${rol}`) ?? 0;
      const opcion = resultado.estado !== 'no_disponible' && opcionValida(resultado.build, recordada) ? recordada : 0;
      const runasRecordada = runasElegidas.get(`${sel.campeonId}-${modo}-${rol}`) ?? 0;
      const opcionRunas = resultado.estado !== 'no_disponible' && runasValida(resultado.build, runasRecordada) ? runasRecordada : 0;
      publicar({
        seleccion: {
          campeon: { ...campeon, key: sel.campeonId },
          rol,
          ...(conRoles ? {} : { modo }),
          rolesDisponibles: roles,
          resultado,
          opcion,
          opcionRunas,
          ...(aumentosCaos ? { aumentosCaos } : {}),
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
    // Hasta saber la cola no se importa solo: podría ser ARAM o Arena y la build cambiaría al llegar.
    if (seleccion?.modoPendiente) return;
    const clave = `${claveDe(sel)}-${sel.opcion}-${sel.opcionRunas ?? 0}`;
    if (clave === ultimaAuto) return;
    ultimaAuto = clave;
    await importar();
  }

  /**
   * Las importaciones se encadenan: nunca hay dos a la vez borrando y creando páginas. `opcionesRunas` solo llega
   * desde «Importar» (manual): la importación automática nunca sustituye una página del jugador.
   */
  function importar(opcionesRunas: OpcionesRunas = {}): Promise<ResultadoImportar> {
    const turno = cola.then(async () => {
      const sel = estado.seleccion;
      if (!lcu || !sel || sel.resultado.estado === 'no_disponible' || !importable(sel.modo)) return FALLO_TOTAL;
      const titulo = `Coach: ${sel.campeon.nombre} ${sel.rol ? t('rol.' + sel.rol) : t('modo.' + sel.modo)}`;
      const mapa = sel.modo === 'aram' || sel.modo === 'caos' ? 12 : 11;
      let resultado: ResultadoImportar;
      try {
        // Runas de la página elegida; hechizos y objetos, de la opción de build.
        resultado = await importarLcu(lcu, buildElegida(sel.resultado.build, sel.opcion, sel.opcionRunas), sel.campeon.key, titulo, mapa, opcionesRunas);
      } catch (e) {
        registrar('error', `Importación fallida: ${e instanceof Error ? e.message : String(e)}`);
        resultado = FALLO_TOTAL;
      }
      if (resultado.runas.ok || resultado.hechizos.ok || resultado.objetos.ok) importadaEn = claveDe(sel);
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
      let build = sel && sel.resultado.estado !== 'no_disponible' ? buildElegida(sel.resultado.build, sel.opcion, sel.opcionRunas) : null;
      if (build?.modo === 'arena' && build.objetosArenaPopulares?.length) {
        const legendarios = build.objetosArenaPopulares
          .map((o) => o.id)
          .filter((id) => d.objetos[id] && clasificarObjeto(id, d.objetos[id], MAPA_DE_MODO.arena) === 'legendario')
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
      if (fase !== 'ChampSelect') {
        ultimaAuto = null;
        importadaEn = null;
      }
    },
    /** Elige otra opción de build; un índice no válido (o sin build) se ignora. */
    async cambiarOpcion(i: number): Promise<void> {
      const sel = estado.seleccion;
      if (!sel || sel.resultado.estado === 'no_disponible' || !opcionValida(sel.resultado.build, i) || i === sel.opcion) return;
      opcionesElegidas.set(claveDe(sel), i);
      publicar({ seleccion: { ...sel, opcion: i }, importacion: null });
      await importarAutomatico();
    },
    /**
     * Elige otra página de runas (3.0.1); un índice no válido (o una build sin páginas elegibles) se ignora. Con la
     * importación automática se importa como al cambiar de opción; sin ella, se vuelve a importar solo si ya se
     * importó en esta selección de campeones (para que la página «Coach: …» sea la elegida).
     */
    async cambiarRunas(i: number): Promise<void> {
      const sel = estado.seleccion;
      if (!sel || sel.resultado.estado === 'no_disponible' || !runasValida(sel.resultado.build, i) || i === (sel.opcionRunas ?? 0)) return;
      runasElegidas.set(claveDe(sel), i);
      publicar({ seleccion: { ...sel, opcionRunas: i }, importacion: null });
      if (importable(sel.modo) && dep.obtenerAjustes().importacionAutomatica) await importarAutomatico();
      else if (importadaEn === claveDe(sel)) await importar();
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
      importadaEn = null;
      generacion++;
      publicar({ cliente: 'esperando', seleccion: null, error: null, importacion: null });
    },
    async alSeleccionar(sel: SeleccionCampeon): Promise<void> {
      seleccion = sel;
      await mostrar(sel);
    },
    /** El idioma de la app cambió: los nombres de Data Dragon se vuelven a cargar y la selección se repinta en el nuevo. */
    async idiomaCambiado(): Promise<void> {
      datos = null;
      if (seleccion) await mostrar(seleccion, estado.seleccion?.rol ?? undefined);
    },
  };
}
