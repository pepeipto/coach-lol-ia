import type { Build } from '@coach/shared';
import { opcionesDe, opcionesRunasDe } from '../../shared/opciones';
import type { RecursosBuild } from '../../shared/tiposApp';
import type { Aumentos } from '../datos/aumentos';
import type { DatosEstaticos } from '../datos/estaticos';

/**
 * Nombres e iconos de todo lo que sale en cualquiera de las opciones (las pestañas muestran sus núcleos), más los
 * objetos de Arena y los aumentos (ARAM: Caos y Arena). Un aumento sin nombre conocido se omite y la vista enseña
 * su id.
 */
export function recursosDe(respuesta: Build, datos: DatosEstaticos, aumentos?: Aumentos): RecursosBuild {
  const recursos: RecursosBuild = { objetos: {}, runas: {}, hechizos: {} };
  for (const { id } of respuesta.objetosArenaPopulares ?? []) {
    recursos.objetos[id] = datos.objetos[id]?.name ?? String(id);
  }
  const idsAumentos = respuesta.aumentosPopulares ?? [];
  if (idsAumentos.length) {
    recursos.aumentos = {};
    for (const { id } of idsAumentos) {
      const a = aumentos?.get(id);
      if (a) recursos.aumentos[id] = a;
    }
  }
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
  // Las páginas de runas elegibles (3.0.1): sus pestañas y la tarjeta enseñan sus runas.
  for (const { runas } of opcionesRunasDe(respuesta)) {
    for (const id of [runas.estiloPrincipal, runas.estiloSecundario, ...runas.runas]) {
      const r = datos.runas.get(id);
      if (r) recursos.runas[id] = r;
    }
  }
  return recursos;
}
