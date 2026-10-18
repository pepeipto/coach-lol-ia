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
  };
  let generacion = 0;

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
    const d = await asegurarDatos();
    if (gen !== generacion) return;
    if (!d) return publicar({ seleccion: null, error: 'datos' });
    const campeon = d.campeones.get(sel.campeonId);
    if (!campeon) return publicar({ seleccion: null, error: null });
    const builds = crearClienteBuilds({ urlServidor: dep.obtenerAjustes().urlServidor, dirCache: dep.dirCache });
    const roles = await builds.obtenerRoles(campeon.id);
    const rol: Rol = rolElegido ?? sel.rol ?? roles[0] ?? 'MIDDLE';
    const resultado = await builds.obtenerBuild(campeon.id, rol);
    if (gen !== generacion) return;
    publicar({
      seleccion: { campeon: { ...campeon, key: sel.campeonId }, rol, rolesDisponibles: roles, resultado },
      version: d.version,
      recursos: resultado.estado === 'no_disponible' ? estado.recursos : recursosDe(resultado.build, d),
      error: null,
    });
    if (dep.obtenerAjustes().importacionAutomatica && resultado.estado !== 'no_disponible') await importar();
  }

  async function importar(): Promise<ResultadoImportar> {
    const sel = estado.seleccion;
    if (!lcu || !sel || sel.resultado.estado === 'no_disponible') return FALLO_TOTAL;
    const titulo = `Coach: ${sel.campeon.nombre} ${t('rol.' + sel.rol)}`;
    return importarTodo(lcu, sel.resultado.build, sel.campeon.key, titulo);
  }

  return {
    estado: () => estado,
    importar,
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
      generacion++;
      publicar({ cliente: 'esperando', seleccion: null, error: null });
    },
    async alSeleccionar(sel: SeleccionCampeon): Promise<void> {
      seleccion = sel;
      await mostrar(sel);
    },
  };
}
