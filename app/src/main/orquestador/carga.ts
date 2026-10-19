import type { EstadoCarga, JugadorCarga, ModoOverlay } from '../../shared/tiposApp';
import type { ClienteLcu } from '../lcu/cliente';
import { interpretarSesionPartida, regionDeLcu, type JugadorSesion } from '../lcu/sesionPartida';
import { registrar } from '../log';
import { textoRutaJungla, validarRutaJungla } from '../consejos/junglaEnemiga';

/** La pantalla de carga se quita, como muy tarde, a los 2 minutos. */
export const DURACION_MAXIMA_CARGA_MS = 2 * 60_000;
/** Los datos del servidor (rango, maestría…) rellenan las tarjetas si llegan antes de 6 s; si no, se quedan sin ellos. */
export const TIEMPO_ESPERA_SERVIDOR_MS = 6000;
/** Mientras dura la carga se pregunta a la Live Client Data API cada segundo si la partida ya se juega. */
export const INTERVALO_SONDEO_MS = 1000;
/** Antes de enseñar la carga se espera la primera respuesta del sondeo como mucho este tiempo. */
export const ESPERA_PRIMER_SONDEO_MS = 250;
/** Si la sesión aún no está lista (p. ej. vacía en GameStart), se reintenta hasta 5 veces cada 1,5 s. */
export const MAX_INTENTOS_SESION = 5;
export const ESPERA_REINTENTO_MS = 1500;

export type { ModoOverlay };

/** Versión y campeones de Data Dragon que necesita la pantalla de carga. */
export type DatosCarga = { version: string; campeones: Map<number, { id: string; nombre: string }> };

export interface DependenciasCarga {
  urlServidor: () => string;
  fetch?: typeof fetch;
  /** Versión y campeones de Data Dragon (de la caché de la app); null si no hay datos. */
  datos: () => Promise<DatosCarga | null>;
  /** `overlay:modo` (se envía después de `overlay:carga`, para no pintar datos de la partida anterior) */
  enviarModo: (modo: ModoOverlay) => void;
  /** `overlay:carga` */
  enviarCarga: (estado: EstadoCarga) => void;
  mostrar: () => void;
  ocultar: () => void;
  /** Hay una partida con datos válidos (el orquestador de partida ya muestra su overlay). */
  enPartida: () => boolean;
  /** Track F2: pedir la ruta estimada del jungla enemigo (ajuste `junglaEnemiga.ruta`, apagado por defecto). */
  rutaJunglaActiva?: () => boolean;
  /**
   * La Live Client Data API responde (la partida ya se juega). Mientras dura la carga se pregunta cada segundo:
   * en cuanto responde, la carga termina, sin esperar al primer estado del orquestador de la partida.
   */
  partidaEnVivo?: () => Promise<boolean>;
}

/** Fases en las que dura la partida: la pantalla de carga empieza en las dos primeras. */
const FASES_INICIO = new Set(['GameStart', 'InProgress']);
const FASES_DE_PARTIDA = new Set([...FASES_INICIO, 'Reconnect']);

/**
 * Etiquetas retiradas (3.0): «Poca experiencia con este campeón» señalaba a otros jugadores. Si un servidor
 * antiguo aún la manda (con clave o, antes de la 3.0, solo con el texto), no se enseña.
 */
const CLAVES_RETIRADAS = new Set(['carga.etiqueta.pocaExperiencia']);
const TEXTOS_RETIRADOS = new Set(['Poca experiencia con este campeón']);
const etiquetaPermitida = (e: JugadorCarga['etiquetas'][number]) =>
  !(e.clave && CLAVES_RETIRADAS.has(e.clave)) && !TEXTOS_RETIRADOS.has(e.texto);

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
 * estado válido de Live Client Data o, como mucho, 2 minutos (o hasta que la Live Client responde). Pinta primero lo que sabe el cliente de
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
  /** Lo último enviado al overlay en esta partida (roles y ruta estimada), para el orquestador de la partida. */
  let actual: EstadoCarga | null = null;
  /** Cambia solo al terminar la partida (no al pasar de la carga a la partida): la ruta puede llegar ya en partida. */
  let numPartida = 0;
  /** Instante en que empezó la carga de esta partida (para registrar cuánto tarda cada paso). */
  let inicioCarga = 0;
  const ms = () => `${Date.now() - inicioCarga} ms`;

  function enviar(estado: EstadoCarga): void {
    actual = estado;
    dep.enviarCarga(estado);
  }

  // ---- Sondeo de la Live Client Data API: la carga nunca sigue en pantalla con la partida en juego ----
  let sondeando = false;
  let sondeo: ReturnType<typeof setTimeout> | null = null;
  let primerSondeo: Promise<void> | null = null;

  function pararSondeo(): void {
    sondeando = false;
    primerSondeo = null;
    if (sondeo) clearTimeout(sondeo);
    sondeo = null;
  }

  function empezarSondeo(): void {
    if (!dep.partidaEnVivo || sondeando) return;
    sondeando = true;
    primerSondeo = sondear();
  }

  async function sondear(): Promise<void> {
    const partida = numPartida;
    let vivo = false;
    try {
      vivo = await dep.partidaEnVivo!();
    } catch {
      vivo = false;
    }
    if (!sondeando || partida !== numPartida) return;
    if (vivo) {
      // La partida ya se juega: fuera la carga (y, si aún no estaba, ya no saldrá en esta partida).
      registrar('info', `Pantalla de carga: la Live Client ya responde (${ms()}); ${activa ? 'se retira' : 'no llega a salir'}`);
      partidaEmpezada = true;
      cancelarReintento();
      const estaba = activa;
      terminar('partida');
      if (estaba && !dep.enPartida()) dep.ocultar();
      return;
    }
    sondeo = setTimeout(() => {
      sondeo = null;
      void sondear();
    }, INTERVALO_SONDEO_MS);
  }

  /** Track F2: la ruta habitual del jungla enemigo, ya en texto; null si no hay datos o falla (no es imprescindible). */
  async function pedirRuta(jugadores: JugadorCarga[]): Promise<EstadoCarga['rutaJungla']> {
    const jungla = jugadores.find((j) => j.equipo === 'enemigo' && j.rol === 'JUNGLE' && j.campeon);
    if (!jungla) return null;
    const control = new AbortController();
    const limite = setTimeout(() => control.abort(new Error('tiempo de espera agotado')), TIEMPO_ESPERA_SERVIDOR_MS);
    try {
      const base = dep.urlServidor().replace(/\/+$/, '');
      const r = await hacerFetch(`${base}/jungla/ruta/${encodeURIComponent(jungla.campeon)}`, { signal: control.signal });
      if (!r.ok) return null;
      const ruta = validarRutaJungla(await r.json());
      const texto = ruta ? textoRutaJungla(jungla.nombre || jungla.campeon, ruta) : null;
      return texto ? { campeon: jungla.campeon, texto } : null;
    } catch (e) {
      registrar('aviso', `Pantalla de carga: no se pudo pedir la ruta del jungla enemigo (${e instanceof Error ? e.message : String(e)})`);
      return null;
    } finally {
      clearTimeout(limite);
    }
  }

  function cancelarReintento(): void {
    if (reintento) clearTimeout(reintento);
    reintento = null;
  }

  function terminar(modo: ModoOverlay): void {
    generacion++;
    pararSondeo();
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

  /** Entra en el modo carga con estas tarjetas; se retira sola, como muy tarde, a los 2 minutos. */
  function mostrarCarga(estado: EstadoCarga): void {
    activa = true;
    registrar('info', `Pantalla de carga: tarjetas en pantalla (${ms()})`);
    // overlay:carga antes que overlay:modo 'carga': el modo nunca enseña datos de la partida anterior.
    enviar(estado);
    dep.enviarModo('carga');
    dep.mostrar();
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      terminar('partida');
      if (!dep.enPartida()) dep.ocultar();
    }, DURACION_MAXIMA_CARGA_MS);
  }

  /** 'fallo' si no se pudo leer la sesión (se reintenta); 'obsoleto' si la partida cambió o ya se juega. */
  async function empezar(): Promise<'ok' | 'fallo' | 'obsoleto'> {
    const c = cliente;
    if (!c) return 'obsoleto';
    const gen = ++generacion;
    // Data Dragon (iconos y nombres) no bloquea: las tarjetas salen en cuanto se lee la sesión.
    let datos: DatosCarga | null = null;
    let datosListos = false;
    const promDatos = dep
      .datos()
      .catch(() => null)
      .then((d) => {
        datos = d;
        datosListos = true;
      });
    let sesion: Awaited<ReturnType<typeof leerSesion>>;
    try {
      sesion = await leerSesion(c);
    } catch (e) {
      if (gen !== generacion) return 'obsoleto';
      registrar('aviso', `Pantalla de carga: no se pudo leer la sesión (${e instanceof Error ? e.message : String(e)})`);
      return 'fallo';
    }
    if (gen !== generacion) return 'obsoleto';
    if (!sesion) return 'fallo';
    // Si la partida ya se juega (reconexión, la app abierta tarde), la carga no llega a salir.
    if (primerSondeo) {
      let espera: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([primerSondeo, new Promise<void>((r) => (espera = setTimeout(r, ESPERA_PRIMER_SONDEO_MS)))]);
      clearTimeout(espera);
    }
    if (gen !== generacion) return 'obsoleto';

    const ses = sesion;
    let remotos: JugadorCarga[] | null = null;
    let servidorPendiente = !!ses.region;
    /** Las tarjetas con lo que se sepa ahora: sesión, Data Dragon (si llegó) y servidor (si respondió). */
    const componer = (): EstadoCarga => {
      const d = datos as DatosCarga | null;
      const jugadores = ses.jugadores.map((j, i): JugadorCarga => {
        const info = d?.campeones.get(j.campeonId);
        const local: JugadorCarga = {
          equipo: j.equipo,
          riotId: j.riotId,
          campeonId: j.campeonId,
          campeon: info?.id ?? '',
          nombre: info?.nombre ?? '',
          rol: j.rol,
          rango: null,
          maestria: null,
          campeonWinrate: null,
          etiquetas: [],
        };
        const r = remotos?.[i];
        // El servidor responde en el mismo orden; lo local completa lo que él no sepa (Riot ID, campeón).
        const base = r
          ? {
              ...r,
              equipo: local.equipo,
              riotId: r.riotId || local.riotId,
              campeon: local.campeon || r.campeon,
              nombre: local.nombre || r.nombre,
              etiquetas: r.etiquetas.filter(etiquetaPermitida),
            }
          : local;
        return { ...base, cargando: servidorPendiente || !datosListos };
      });
      return { jugadores, version: d?.version ?? '', ...(actual?.rutaJungla ? { rutaJungla: actual.rutaJungla } : {}) };
    };

    const conDatos = datosListos;
    mostrarCarga(componer());
    if (!conDatos) {
      // Los nombres e iconos llegan después: solo si la carga sigue siendo esta y sigue en pantalla.
      void promDatos.then(() => {
        if (gen === generacion && activa) enviar(componer());
      });
    }

    if (dep.rutaJunglaActiva?.()) {
      const partida = numPartida;
      // Espera a Data Dragon para saber el nombre del jungla enemigo.
      void promDatos
        .then(() => pedirRuta(componer().jugadores))
        .then((rutaJungla) => {
          if (partida !== numPartida || !rutaJungla || !actual) return;
          // Ya en partida solo se guarda (para la voz de los 0:30); en la carga, además se enseña.
          if (activa) enviar({ ...actual, rutaJungla });
          else actual = { ...actual, rutaJungla };
        });
    }

    if (!ses.region) {
      registrar('info', 'Pantalla de carga: región sin servidor de Coach LoL IA, solo información local');
      return 'ok';
    }
    const respuesta = await pedirServidor(ses.region, ses.jugadores);
    registrar('info', `Pantalla de carga: servidor ${respuesta ? 'respondió' : 'sin datos'} (${ms()})`);
    if (gen !== generacion) return 'ok';
    servidorPendiente = false;
    remotos = respuesta;
    if (activa) enviar(componer());
    return 'ok';
  }

  /** Lanza la pantalla de carga; si la sesión no está lista, deja la partida sin empezar y reintenta. */
  async function intentar(): Promise<void> {
    cancelarReintento();
    if (intentos === 0) inicioCarga = Date.now();
    empezarSondeo();
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
    actual = null;
    numPartida++;
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
      if (activa) registrar('info', `Pantalla de carga: primer estado de la partida, se retira (${ms()})`);
      partidaEmpezada = true;
      terminar('partida');
    },
    /**
     * Depuración (COACH_FORZAR_PARTIDA=1, capturas y vídeo): enseña estas tarjetas sin cliente de LoL.
     * Termina igual que una carga real: con partidaIniciada(), con la primera respuesta de la Live Client o a los 2 minutos.
     */
    simular(estado: EstadoCarga): void {
      generacion++;
      cancelarReintento();
      partidaEmpezada = true;
      inicioCarga = Date.now();
      mostrarCarga(estado);
      // Como una carga real: si la Live Client (o el simulador) ya responde, se retira.
      empezarSondeo();
    },
    /** El overlay está en modo carga. */
    activa: (): boolean => activa,
    /** La carga de la partida en curso (sigue disponible en la partida, hasta que termina); null si no hubo. */
    actual: (): EstadoCarga | null => actual,
  };
}

export type OrquestadorCarga = ReturnType<typeof crearOrquestadorCarga>;
