import type { Build } from '@coach/shared';
import { opcionesDe } from '../../shared/opciones';
import type { RecursosBuild } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';

/** Nombres e iconos de todo lo que sale en cualquiera de las opciones (las pestañas muestran sus núcleos). */
export function recursosDe(respuesta: Build, datos: DatosEstaticos): RecursosBuild {
  const recursos: RecursosBuild = { objetos: {}, runas: {}, hechizos: {} };
  for (const build of opcionesDe(respuesta)) {
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
  }
  return recursos;
}
