import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Ajustes, EstadoPrincipal, RecursosBuild, ResultadoImportar } from '../../shared/tiposApp';
import { crearClienteBuilds } from '../builds/clienteBuilds';
import type { DatosEstaticos } from '../datos/estaticos';
import type { ClienteLcu } from '../lcu/cliente';
import { importarTodo } from '../lcu/importar';
import type { SeleccionCampeon } from '../lcu/seleccion';
import { registrar } from '../log';

interface Dependencias {
  dirCache: string;
  cargarDatos: () => Promise<DatosEstaticos>;
  obtenerAjustes: () => Ajustes;
  enviar: (estado: EstadoPrincipal) => void;
  /** Sustituibles en las pruebas. */
  crearBuilds?: typeof crearClienteBuilds;
  importarTodo?: typeof importarTodo;
}

const FALLO_TOTAL: ResultadoImportar = {
  runas: { ok: false, motivo: 'error' },
  hechizos: { ok: false, motivo: 'error' },
  objetos: { ok: false, motivo: 'error' },
};

function recursosDe(build: Build, datos: DatosEstaticos): RecursosBuild {
  const recursos: RecursosBuild = { objetos: {}, runas: {}, hechizos: {} };
  const ids = [...build.objetosIniciales, ...build.nucleo, ...build.situacionales, ...(build.botas !== null ? [build.botas] : [])];
  for (const id of ids) recursos.objetos[id] = datos.objetos[id]?.name ?? String(id);
  for (const id of [build.runas.estiloPrincipal, build.runas.estiloSecundario, ...build.runas.runas]) {
    const r = datos.runas.get(id);
    if (r) recursos.runas[id] = r;
  }
  for (const id of build.hechizos) {
    const h = datos.hechizos.get(id);
    if (h) recursos.hechizos[id] = h;
  }
  return recursos;
}

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
      const builds = crearBuilds({ urlServidor: dep.obtenerAjustes().urlServidor, dirCache: dep.dirCache });
      const roles = await builds.obtenerRoles(campeon.id);
      const rol: Rol = rolElegido ?? sel.rol ?? roles[0] ?? 'MIDDLE';
      const resultado = await builds.obtenerBuild(campeon.id, rol);
      if (gen !== generacion) return;
      publicar({
        seleccion: { campeon: { ...campeon, key: sel.campeonId }, rol, rolesDisponibles: roles, resultado },
        version: d.version,
        recursos: resultado.estado === 'no_disponible' ? estado.recursos : recursosDe(resultado.build, d),
        error: null,
        importacion: null,
      });
      const clave = `${sel.campeonId}-${rol}`;
      if (dep.obtenerAjustes().importacionAutomatica && resultado.estado !== 'no_disponible' && clave !== ultimaAuto) {
        ultimaAuto = clave;
        await importar();
      }
    } catch (e) {
      registrar('error', `Error al mostrar la build: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Las importaciones se encadenan: nunca hay dos a la vez borrando y creando páginas. */
  function importar(): Promise<ResultadoImportar> {
    const turno = cola.then(async () => {
      const sel = estado.seleccion;
      if (!lcu || !sel || sel.resultado.estado === 'no_disponible') return FALLO_TOTAL;
      const titulo = `Coach: ${sel.campeon.nombre} ${t('rol.' + sel.rol)}`;
      let resultado: ResultadoImportar;
      try {
        resultado = await importarLcu(lcu, sel.resultado.build, sel.campeon.key, titulo);
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
    /** Build y rol efectivos de la selección, y los objetos, para los consejos en partida. Null si no hay datos. */
    async contexto(): Promise<{ build: Build | null; rol: Rol; objetos: DatosEstaticos['objetos'] } | null> {
      const d = await asegurarDatos();
      if (!d) return null;
      const sel = estado.seleccion;
      const build = sel && sel.resultado.estado !== 'no_disponible' ? sel.resultado.build : null;
      return { build, rol: sel?.rol ?? seleccion?.rol ?? 'MIDDLE', objetos: d.objetos };
    },
    avisar(aviso: string | null): void {
      publicar({ aviso });
    },
    /** Al salir de la selección de campeones se olvida la última importación automática. */
    fase(fase: string): void {
      if (fase !== 'ChampSelect') ultimaAuto = null;
    },
    async cambiarRol(rol: Rol): Promise<void> {
      if (seleccion) await mostrar(seleccion, rol);
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
