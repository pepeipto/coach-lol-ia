import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CampeonPerfil, EstadoReto, IdReto, LineaTiempo, PartidaHistorial, Perfil, PuntoPl, RangoCola } from '../../shared/perfil';
import type { ClienteLcu } from '../lcu/cliente';
import { registrar } from '../log';
import { anotarPl, interpretarInvocador, interpretarLineaTiempo, interpretarListaPartidas, interpretarPartida, interpretarRango, RUTAS_LCU } from './lcuPerfil';
import { cuenta, kdaDe, tendencias, yoEn } from './puntuaciones';
import { esIdReto, estadoReto, retoDeAnalisis, retoSugerido } from './retos';

/*
 * 3.5: perfil del jugador guardado en userData/perfil (solo en este PC): perfil.json con el invocador, el rango, el
 * historial de PL, las 50 últimas partidas y el reto activo, y lineas/<id>.json con la línea de tiempo de cada
 * partida abierta. Se actualiza al conectar el cliente y al terminar cada partida.
 */

export const MAX_PARTIDAS = 50;
/** Partidas que se piden al cliente en cada actualización. */
export const PARTIDAS_POR_LECTURA = 20;
/** Líneas de tiempo guardadas como mucho (de todas las cuentas). */
const MAX_LINEAS = 150;

interface Guardado {
  version: 1;
  invocador: Perfil['invocador'];
  puuid: string;
  rangos: RangoCola[];
  pl: PuntoPl[];
  partidas: PartidaHistorial[];
  reto: { id: IdReto; desde: string } | null;
  actualizado: string | null;
}

const VACIO: Guardado = { version: 1, invocador: null, puuid: '', rangos: [], pl: [], partidas: [], reto: null, actualizado: null };

export interface DependenciasPerfil {
  dir: string;
  lcu: () => ClienteLcu | null;
  /** Versión de Data Dragon y nombres de los campeones por número (para los iconos). */
  campeones: () => Promise<{ version: string; porId: Record<number, { id: string; nombre: string }> }>;
  /** Avisa a la ventana de que el perfil cambió. */
  alCambiar?: (p: Perfil) => void;
  /** 3.6: lo que el último análisis con IA pide mejorar (títulos de «mejorar» y el enfoque), para sugerir el reto. */
  ultimoAnalisis?: () => string[];
  /** El reto activo se acaba de completar con las partidas nuevas. */
  alCompletarReto?: (reto: EstadoReto) => void;
  ahora?: () => Date;
}

/** Campeones del jugador en sus partidas que cuentan, del más jugado al menos. */
export function campeonesDe(partidas: PartidaHistorial[]): CampeonPerfil[] {
  const por = new Map<number, { partidas: number; victorias: number; k: number; d: number; a: number; cs: number; min: number; punt: number }>();
  for (const p of partidas.filter(cuenta)) {
    const yo = yoEn(p);
    if (!yo) continue;
    const c = por.get(yo.campeonId) ?? { partidas: 0, victorias: 0, k: 0, d: 0, a: 0, cs: 0, min: 0, punt: 0 };
    c.partidas++;
    if (yo.victoria) c.victorias++;
    c.k += yo.asesinatos;
    c.d += yo.muertes;
    c.a += yo.asistencias;
    c.cs += yo.cs;
    c.min += p.duracion / 60;
    c.punt += yo.puntuaciones.total;
    por.set(yo.campeonId, c);
  }
  return [...por.entries()]
    .map(([campeonId, c]) => ({
      campeonId,
      partidas: c.partidas,
      victorias: c.victorias,
      kda: kdaDe({ asesinatos: c.k, muertes: c.d, asistencias: c.a }),
      csMin: Math.round((c.cs / Math.max(1, c.min)) * 10) / 10,
      puntuacion: Math.round(c.punt / c.partidas),
    }))
    .sort((a, b) => b.partidas - a.partidas || b.victorias - a.victorias || a.campeonId - b.campeonId);
}

export function crearServicioPerfil(dep: DependenciasPerfil) {
  const ruta = join(dep.dir, 'perfil.json');
  const dirLineas = join(dep.dir, 'lineas');
  const ahora = dep.ahora ?? (() => new Date());
  let g: Guardado | null = null;
  let actualizando: Promise<void> | null = null;

  function leer(): Guardado {
    if (g) return g;
    try {
      const crudo = JSON.parse(readFileSync(ruta, 'utf8')) as Partial<Guardado>;
      g = crudo && crudo.version === 1 ? { ...VACIO, ...crudo, reto: crudo.reto && esIdReto(crudo.reto.id) ? crudo.reto : null } : { ...VACIO };
    } catch {
      g = { ...VACIO };
    }
    return g;
  }

  function guardar(nuevo: Guardado): void {
    g = nuevo;
    try {
      mkdirSync(dep.dir, { recursive: true });
      const tmp = `${ruta}.tmp`;
      writeFileSync(tmp, JSON.stringify(nuevo), 'utf8');
      renameSync(tmp, ruta);
    } catch (e) {
      registrar('aviso', `Perfil: no se pudo guardar: ${String(e)}`);
    }
  }

  async function perfil(): Promise<Perfil> {
    const d = leer();
    const dd = await dep.campeones().catch(() => ({ version: '', porId: {} }));
    return {
      invocador: d.invocador,
      rangos: d.rangos,
      pl: d.pl,
      partidas: d.partidas,
      campeones: campeonesDe(d.partidas),
      tendencias: tendencias(d.partidas),
      reto: d.reto ? estadoReto(d.reto.id, d.reto.desde, d.partidas) : null,
      retoSugerido: retoDeAnalisis(dep.ultimoAnalisis?.() ?? []) ?? retoSugerido(d.partidas),
      actualizado: d.actualizado,
      conectado: !!dep.lcu(),
      version: dd.version,
      campeonesDD: dd.porId,
    };
  }

  async function avisar(): Promise<void> {
    if (dep.alCambiar) dep.alCambiar(await perfil());
  }

  /** 3.6: cada cuenta guarda su perfil en cuentas/<puuid>.json; perfil.json es el de la cuenta de ahora. */
  const archivoCuenta = (puuid: string) => join(dep.dir, 'cuentas', `${puuid.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
  function cambiarDeCuenta(actual: Guardado, puuidNuevo: string): Guardado {
    try {
      if (actual.puuid) {
        mkdirSync(join(dep.dir, 'cuentas'), { recursive: true });
        writeFileSync(archivoCuenta(actual.puuid), JSON.stringify(actual), 'utf8');
      }
    } catch (e) {
      registrar('aviso', `Perfil: no se pudo apartar el perfil de la otra cuenta: ${String(e)}`);
    }
    try {
      const crudo = JSON.parse(readFileSync(archivoCuenta(puuidNuevo), 'utf8')) as Partial<Guardado>;
      if (crudo && crudo.version === 1) return { ...VACIO, ...crudo, reto: crudo.reto && esIdReto(crudo.reto.id) ? crudo.reto : null };
    } catch {
      // primera vez con esta cuenta
    }
    return { ...VACIO };
  }

  /** Lee del cliente y guarda; devuelve los ids de las partidas nuevas (la más reciente primero). */
  async function leerDelCliente(lcu: ClienteLcu): Promise<number[]> {
    const d = leer();
    const inv = interpretarInvocador(await lcu.peticion('GET', RUTAS_LCU.invocador));
    if (!inv) throw new Error('el cliente no devolvió el invocador');
    // Otra cuenta en este PC: se aparta el perfil de la anterior y se recupera el de esta (si ya lo había).
    const base: Guardado = d.puuid && inv.puuid && d.puuid !== inv.puuid ? cambiarDeCuenta(d, inv.puuid) : d;
    const rangos = interpretarRango(await lcu.peticion('GET', RUTAS_LCU.rango).catch(() => null));
    const ids = interpretarListaPartidas(await lcu.peticion('GET', RUTAS_LCU.partidas(PARTIDAS_POR_LECTURA)).catch(() => null));
    const conocidas = new Map(base.partidas.map((p) => [p.id, p]));
    const nuevas: PartidaHistorial[] = [];
    // Una a una y solo las que faltan: Riot limita las peticiones a la LCU.
    for (const id of ids) {
      if (conocidas.has(id)) continue;
      try {
        const p = interpretarPartida(await lcu.peticion('GET', RUTAS_LCU.partida(id)), inv.puuid);
        if (p) nuevas.push(p);
      } catch (e) {
        registrar('aviso', `Perfil: no se pudo leer la partida ${id}: ${String(e)}`);
      }
    }
    const partidas = [...nuevas, ...base.partidas]
      .filter((p, i, xs) => xs.findIndex((x) => x.id === p.id) === i)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_PARTIDAS);
    const fecha = ahora().toISOString();
    guardar({
      ...base,
      invocador: { nombre: inv.nombre, tag: inv.tag, nivel: inv.nivel, icono: inv.icono },
      puuid: inv.puuid,
      rangos: rangos.length ? rangos : base.rangos,
      pl: anotarPl(base.pl, rangos, fecha),
      partidas,
      actualizado: fecha,
    });
    return nuevas.sort((a, b) => b.fecha.localeCompare(a.fecha)).map((p) => p.id);
  }

  /** Línea de tiempo de una partida: la guardada o, con el cliente abierto, la del cliente. */
  async function lineaTiempo(id: number): Promise<LineaTiempo | null> {
    const archivo = join(dirLineas, `${id}.json`);
    try {
      return JSON.parse(readFileSync(archivo, 'utf8')) as LineaTiempo;
    } catch {
      // no está guardada
    }
    const partida = leer().partidas.find((p) => p.id === id);
    const lcu = dep.lcu();
    if (!partida || !lcu) return null;
    const equipos = new Map(partida.jugadores.map((j) => [j.participante, j.equipo]));
    const linea = interpretarLineaTiempo(
      await lcu.peticion('GET', RUTAS_LCU.lineaTiempo(id)).catch(() => null),
      (pid) => equipos.get(pid) ?? 100,
    );
    if (!linea || !linea.minutos.length) return null;
    try {
      mkdirSync(dirLineas, { recursive: true });
      writeFileSync(archivo, JSON.stringify(linea), 'utf8');
      // Como mucho unas 150 (las de todas las cuentas): se borran primero las que ya no están en el historial.
      const vivas = new Set(leer().partidas.map((p) => `${p.id}.json`));
      const archivos = readdirSync(dirLineas);
      let sobran = archivos.length - MAX_LINEAS;
      for (const a of archivos) {
        if (sobran <= 0) break;
        if (!vivas.has(a)) {
          rmSync(join(dirLineas, a), { force: true });
          sobran--;
        }
      }
    } catch {
      // la copia es solo una ayuda
    }
    return linea;
  }

  return {
    perfil,
    /** Lee del cliente (si está abierto) y guarda; las llamadas a la vez esperan a la que ya está en marcha. */
    actualizar(): Promise<void> {
      const lcu = dep.lcu();
      if (!lcu) return avisar();
      const d = leer();
      const antes = d.reto ? estadoReto(d.reto.id, d.reto.desde, d.partidas).completado : true;
      actualizando ??= leerDelCliente(lcu)
        .then(async (nuevas) => {
          // 3.6: las gráficas de las partidas nuevas quedan guardadas aunque luego se cierre el cliente (como
          // mucho 3 por lectura, de una en una: Riot limita las peticiones a la LCU).
          for (const id of nuevas.slice(0, 3)) await lineaTiempo(id).catch(() => null);
          const g2 = leer();
          if (!antes && g2.reto) {
            const ahoraReto = estadoReto(g2.reto.id, g2.reto.desde, g2.partidas);
            if (ahoraReto.completado) dep.alCompletarReto?.(ahoraReto);
          }
        })
        .catch((e: unknown) => registrar('aviso', `Perfil: no se pudo actualizar: ${String(e)}`))
        .finally(() => (actualizando = null));
      return actualizando.then(avisar);
    },
    /** Línea de tiempo de una partida: la guardada o, con el cliente abierto, la del cliente. */
    lineaTiempo,
    /** Elige el reto activo (null lo quita); empieza a contar desde ahora. */
    async elegirReto(id: IdReto | null): Promise<Perfil> {
      const d = leer();
      guardar({ ...d, reto: id ? { id, desde: ahora().toISOString() } : null });
      const p = await perfil();
      dep.alCambiar?.(p);
      return p;
    },
  };
}

export type ServicioPerfil = ReturnType<typeof crearServicioPerfil>;
