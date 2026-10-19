import type { EstadoCarga, JugadorCarga } from '../../shared/tiposApp';
import type { ClienteLcu } from '../lcu/cliente';
import { interpretarSesionPartida, regionDeLcu, type JugadorSesion } from '../lcu/sesionPartida';
import { registrar } from '../log';

/** La pantalla de carga se quita, como muy tarde, a los 3 minutos. */
export const DURACION_MAXIMA_CARGA_MS = 3 * 60_000;
export const TIEMPO_ESPERA_SERVIDOR_MS = 12_000;
/** Si la sesión aún no está lista (p. ej. vacía en GameStart), se reintenta hasta 5 veces cada 1,5 s. */
export const MAX_INTENTOS_SESION = 5;
export const ESPERA_REINTENTO_MS = 1500;

export type ModoOverlay = 'carga' | 'partida' | 'oculto';

export interface DependenciasCarga {
  urlServidor: () => string;
  fetch?: typeof fetch;
  /** Versión y campeones de Data Dragon (de la caché de la app); null si no hay datos. */
  datos: () => Promise<{ version: string; campeones: Map<number, { id: string; nombre: string }> } | null>;
  /** `overlay:modo` (se envía después de `overlay:carga`, para no pintar datos de la partida anterior) */
  enviarModo: (modo: ModoOverlay) => void;
  /** `overlay:carga` */
  enviarCarga: (estado: EstadoCarga) => void;
  mostrar: () => void;
  ocultar: () => void;
  /** Hay una partida con datos válidos (el orquestador de partida ya muestra su overlay). */
  enPartida: () => boolean;
}

/** Fases en las que dura la partida: la pantalla de carga empieza en las dos primeras. */
const FASES_INICIO = new Set(['GameStart', 'InProgress']);
const FASES_DE_PARTIDA = new Set([...FASES_INICIO, 'Reconnect']);

function esJugadorCarga(x: unknown): x is JugadorCarga {
  if (typeof x !== 'object' || x === null) return false;
  const j = x as Record<string, unknown>;
  return (
    (j.equipo === 'aliado' || j.equipo === 'enemigo') &&
    typeof j.campeonId === 'number' &&
    typeof j.campeon === 'string' &&
    typeof j.nombre === 'string' &&
    typeof j.riotId === 'string' &&
    Array.isArray(j.etiquetas) &&
    (j.campeonWinrate === null || typeof j.campeonWinrate === 'number')
  );
}

/**
 * Pantalla de carga en el overlay (modo 'carga'): desde la fase GameStart/InProgress hasta el primer
 * estado válido de Live Client Data o, como mucho, 3 minutos. Pinta primero lo que sabe el cliente de
 * LoL (campeones, roles, Riot ID) y lo completa con el servidor (rango oficial, maestría, winrate y
 * etiquetas) si la región es una de las suyas.
 */
export function crearOrquestadorCarga(dep: DependenciasCarga) {
  const hacerFetch = dep.fetch ?? fetch;
  let cliente: Pick<ClienteLcu, 'peticion'> | null = null;
  /** Partida en curso para la que ya se lanzó (o descartó) la pantalla de carga. */
  let partidaEmpezada = false;
  let activa = false;
  /** Cambia con cada partida y al terminar la carga: descarta las respuestas que llegan tarde. */
  let generacion = 0;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let reintento: ReturnType<typeof setTimeout> | null = null;
  let intentos = 0;
  let faseActual = '';

  function cancelarReintento(): void {
    if (reintento) clearTimeout(reintento);
    reintento = null;
  }

  function terminar(modo: ModoOverlay): void {
    generacion++;
    cancelarReintento();
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    if (!activa) return;
    activa = false;
    dep.enviarModo(modo);
  }

  async function leerSesion(c: Pick<ClienteLcu, 'peticion'>): Promise<{ jugadores: JugadorSesion[]; region: ReturnType<typeof regionDeLcu> } | null> {
    const [sesion, region, yo] = await Promise.all([
      c.peticion('GET', '/lol-gameflow/v1/session'),
      c.peticion('GET', '/riotclient/region-locale').catch(() => null),
      c.peticion<{ puuid?: unknown }>('GET', '/lol-summoner/v1/current-summoner').catch(() => null),
    ]);
    const puuid = typeof yo?.puuid === 'string' && yo.puuid ? yo.puuid : null;
    const jugadores = interpretarSesionPartida(sesion, puuid);
    return jugadores ? { jugadores, region: regionDeLcu(region) } : null;
  }

  async function pedirServidor(region: NonNullable<ReturnType<typeof regionDeLcu>>, jugadores: JugadorSesion[]): Promise<JugadorCarga[] | null> {
    // Tiempo límite con setTimeout propio (y no AbortSignal.timeout) para poder probarlo con relojes falsos.
    const control = new AbortController();
    const limite = setTimeout(() => control.abort(new Error('tiempo de espera agotado')), TIEMPO_ESPERA_SERVIDOR_MS);
    try {
      const base = dep.urlServidor().replace(/\/+$/, '');
      const r = await hacerFetch(`${base}/api/partida/jugadores`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, jugadores }),
        signal: control.signal,
      });
      if (!r.ok) {
        registrar('aviso', `Pantalla de carga: el servidor respondió ${r.status}`);
        return null;
      }
      const datos = (await r.json()) as { jugadores?: unknown };
      const lista = datos?.jugadores;
      if (!Array.isArray(lista) || lista.length !== jugadores.length || !lista.every(esJugadorCarga)) return null;
      return lista;
    } catch (e) {
      registrar('aviso', `Pantalla de carga: no se pudo consultar el servidor (${e instanceof Error ? e.message : String(e)})`);
      return null;
    } finally {
      clearTimeout(limite);
    }
  }

  /** 'fallo' si no se pudo leer la sesión (se reintenta); 'obsoleto' si la partida cambió mientras tanto. */
  async function empezar(): Promise<'ok' | 'fallo' | 'obsoleto'> {
    const c = cliente;
    if (!c) return 'obsoleto';
    const gen = ++generacion;
    let sesion: Awaited<ReturnType<typeof leerSesion>>;
    let datos: Awaited<ReturnType<DependenciasCarga['datos']>> = null;
    try {
      [sesion, datos] = await Promise.all([leerSesion(c), dep.datos().catch(() => null)]);
    } catch (e) {
      if (gen !== generacion) return 'obsoleto';
      registrar('aviso', `Pantalla de carga: no se pudo leer la sesión (${e instanceof Error ? e.message : String(e)})`);
      return 'fallo';
    }
    if (gen !== generacion) return 'obsoleto';
    if (!sesion) return 'fallo';
    const version = datos?.version ?? '';
    const locales: JugadorCarga[] = sesion.jugadores.map((j) => ({
      equipo: j.equipo,
      riotId: j.riotId,
      campeonId: j.campeonId,
      campeon: datos?.campeones.get(j.campeonId)?.id ?? '',
      nombre: datos?.campeones.get(j.campeonId)?.nombre ?? '',
      rol: j.rol,
      rango: null,
      maestria: null,
      campeonWinrate: null,
      etiquetas: [],
    }));

    activa = true;
    dep.enviarCarga({ jugadores: locales, version });
    dep.enviarModo('carga');
    dep.mostrar();
    temporizador = setTimeout(() => {
      temporizador = null;
      terminar('partida');
      if (!dep.enPartida()) dep.ocultar();
    }, DURACION_MAXIMA_CARGA_MS);

    if (!sesion.region) {
      registrar('info', 'Pantalla de carga: región sin servidor de Coach LoL IA, solo información local');
      return 'ok';
    }
    const remotos = await pedirServidor(sesion.region, sesion.jugadores);
    if (gen !== generacion || !remotos) return 'ok';
    // El servidor responde en el mismo orden; lo local completa lo que él no sepa (Riot ID, campeón).
    const jugadores = remotos.map((r, i) => ({
      ...r,
      equipo: locales[i]!.equipo,
      riotId: r.riotId || locales[i]!.riotId,
      campeon: locales[i]!.campeon || r.campeon,
      nombre: locales[i]!.nombre || r.nombre,
    }));
    dep.enviarCarga({ jugadores, version });
    return 'ok';
  }

  /** Lanza la pantalla de carga; si la sesión no está lista, deja la partida sin empezar y reintenta. */
  async function intentar(): Promise<void> {
    cancelarReintento();
    partidaEmpezada = true;
    intentos++;
    if ((await empezar()) !== 'fallo') return;
    partidaEmpezada = false;
    if (intentos < MAX_INTENTOS_SESION && FASES_INICIO.has(faseActual)) {
      reintento = setTimeout(() => {
        reintento = null;
        if (!partidaEmpezada && FASES_INICIO.has(faseActual)) void intentar();
      }, ESPERA_REINTENTO_MS);
    }
  }

  /** La partida terminó (o el cliente se cerró): sin pantalla de carga y lista para la siguiente. */
  function reiniciar(): void {
    partidaEmpezada = false;
    intentos = 0;
    const estaba = activa;
    terminar('oculto');
    if (estaba) dep.ocultar();
  }

  return {
    conectado(c: Pick<ClienteLcu, 'peticion'>): void {
      cliente = c;
    },
    desconectado(): void {
      cliente = null;
      reiniciar();
    },
    async fase(fase: string): Promise<void> {
      faseActual = fase;
      if (FASES_INICIO.has(fase)) {
        if (partidaEmpezada) return;
        await intentar();
      } else if (!FASES_DE_PARTIDA.has(fase)) {
        reiniciar();
      }
    },
    /** Primer estado válido de Live Client Data: el overlay pasa a la partida. */
    partidaIniciada(): void {
      // La partida ya se ve: ni reintentos ni pantalla de carga hasta la siguiente.
      partidaEmpezada = true;
      terminar('partida');
    },
    /** El overlay está en modo carga. */
    activa: (): boolean => activa,
  };
}

export type OrquestadorCarga = ReturnType<typeof crearOrquestadorCarga>;
