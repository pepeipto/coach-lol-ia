import type { Rol, RutaJungla } from '@coach/shared';
import { t } from '../../shared/i18n';
import { esGrieta } from '../../shared/modosOverlay';
import type { EstadoPartida, JugadorCarga } from '../../shared/tiposApp';

/*
 * Track F1 · Avisos del jungla enemigo por el registro de muertes.
 * Solo usa lo que ya enseña el juego: el evento ChampionKill de la Live Client Data API (el registro de muertes)
 * y los roles de la pantalla de carga (o `position` de la API). Nunca dice dónde «está» el jungla: el texto
 * siempre habla de la kill que acaba de pasar («acaba de aparecer en … (kill)»).
 */

/** Como mucho un aviso cada 20 s de partida. */
export const INTERVALO_AVISO_S = 20;
/** Una kill que llega con más de 10 s de retraso ya no se avisa (ya no dice nada útil). */
export const RETRASO_MAXIMO_S = 10;

export type ZonaJungla = 'top' | 'mid' | 'bot' | 'jungla';

export interface AvisoJunglaEnemiga {
  clave: string;
  zona: ZonaJungla;
  texto: string;
}

function enemigos(estado: EstadoPartida) {
  if (!estado.equipo) return [];
  return (estado.jugadores ?? []).filter((j) => j.equipo !== estado.equipo);
}

/**
 * El campeón del jungla enemigo: el enemigo con rol JUNGLE en la pantalla de carga; si no, el que la API marca
 * como JUNGLE; si no, el único enemigo con Castigo. Null si no se sabe sin adivinar.
 */
export function junglaEnemigo(estado: EstadoPartida, carga: JugadorCarga[] | null): string | null {
  const rivales = enemigos(estado);
  if (rivales.length === 0) return null;
  const deCarga = carga?.find((j) => j.equipo === 'enemigo' && j.rol === 'JUNGLE' && j.campeon);
  if (deCarga && rivales.some((j) => j.campeon === deCarga.campeon)) return deCarga.campeon;
  const porPosicion = rivales.filter((j) => j.posicion === 'JUNGLE');
  if (porPosicion.length === 1) return porPosicion[0]!.campeon;
  const conCastigo = rivales.filter((j) => j.castigo);
  return conCastigo.length === 1 ? conCastigo[0]!.campeon : null;
}

/** Rol de un campeón de la partida: el de la pantalla de carga o, si no, `position` de la API. */
export function rolDe(campeon: string, estado: EstadoPartida, carga: JugadorCarga[] | null): Rol | null {
  const deCarga = carga?.find((j) => j.campeon === campeon)?.rol;
  if (deCarga) return deCarga;
  return estado.jugadores?.find((j) => j.campeon === campeon)?.posicion ?? null;
}

export function zonaDeRol(rol: Rol): ZonaJungla {
  if (rol === 'TOP') return 'top';
  if (rol === 'MIDDLE') return 'mid';
  if (rol === 'JUNGLE') return 'jungla';
  return 'bot';
}

/** Decide, estado a estado, si una kill nueva del jungla enemigo merece aviso. */
export class AvisadorJunglaEnemiga {
  private vistas = new Set<string>();
  private primero = true;
  private ultimoAviso = -Infinity;

  procesar(estado: EstadoPartida, carga: JugadorCarga[] | null): AvisoJunglaEnemiga | null {
    const kills = estado.eventos.filter((e) => e.nombre === 'ChampionKill').sort((a, b) => a.tiempo - b.tiempo);
    const nuevas = kills.filter((k) => !this.vistas.has(claveDe(k)));
    for (const k of nuevas) this.vistas.add(claveDe(k));
    // Al empezar (o reconectar), lo que ya había pasado no se avisa.
    if (this.primero) {
      this.primero = false;
      return null;
    }
    if (!esGrieta(estado.modo)) return null;
    const jungla = junglaEnemigo(estado, carga);
    if (!jungla) return null;

    let aviso: AvisoJunglaEnemiga | null = null;
    for (const k of nuevas) {
      if (estado.tiempo - k.tiempo > RETRASO_MAXIMO_S) continue;
      if (k.asesino !== jungla && !k.asistentes?.includes(jungla)) continue;
      if (!k.victima) continue;
      const rol = rolDe(k.victima, estado, carga);
      if (!rol) continue;
      if (k.tiempo - this.ultimoAviso < INTERVALO_AVISO_S) continue;
      const zona = zonaDeRol(rol);
      this.ultimoAviso = k.tiempo;
      aviso = { clave: `junglaEnemiga:${claveDe(k)}`, zona, texto: t('junglaEnemiga.aviso', { zona: t(`junglaEnemiga.zona.${zona}`) }) };
    }
    return aviso;
  }

  reiniciar(): void {
    this.vistas.clear();
    this.primero = true;
    this.ultimoAviso = -Infinity;
  }
}

const claveDe = (k: { id?: number; tiempo: number }) => (k.id !== undefined ? String(k.id) : `t${k.tiempo}`);

const CALLES = ['top', 'mid', 'bot'] as const;

/** La respuesta de `GET /jungla/ruta/:campeon` solo si tiene la forma esperada (minuto del primer gank entre 2 y 4). */
export function validarRutaJungla(x: unknown): RutaJungla | null {
  if (typeof x !== 'object' || x === null) return null;
  const r = x as Record<string, unknown>;
  if (r.inicio !== null && r.inicio !== 'rojo' && r.inicio !== 'azul') return null;
  if (typeof r.partidas !== 'number' || !Number.isFinite(r.partidas) || r.partidas < 0) return null;
  let primerGank: RutaJungla['primerGank'] = null;
  if (r.primerGank !== null) {
    const g = r.primerGank as Record<string, unknown> | undefined;
    if (typeof g !== 'object' || !g || !CALLES.includes(g.calle as never)) return null;
    if (typeof g.minuto !== 'number' || !(g.minuto >= 2 && g.minuto <= 4)) return null;
    primerGank = { calle: g.calle as (typeof CALLES)[number], minuto: g.minuto };
  }
  return { inicio: r.inicio, primerGank, partidas: r.partidas };
}

/**
 * Texto de la ruta estimada (Track F2): siempre «Estimación: … suele …», nunca dónde está el jungla.
 * Null si no hay nada claro que decir.
 */
export function textoRutaJungla(nombre: string, ruta: RutaJungla): string | null {
  const inicio = ruta.inicio ? t(`junglaEnemiga.lado.${ruta.inicio}`) : null;
  const g = ruta.primerGank;
  const calle = g ? t(`junglaEnemiga.calle.${g.calle}`) : null;
  const minuto = g ? String(Math.round(g.minuto * 10) / 10).replace('.', ',') : '';
  if (inicio && calle) return t('junglaEnemiga.ruta.completa', { campeon: nombre, inicio, calle, minuto });
  if (inicio) return t('junglaEnemiga.ruta.inicio', { campeon: nombre, inicio });
  if (calle) return t('junglaEnemiga.ruta.gank', { campeon: nombre, calle, minuto });
  return null;
}
