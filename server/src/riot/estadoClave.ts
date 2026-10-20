/**
 * Estado de la clave de Riot del servidor, para avisar al dueño cuando caduca (la de desarrollo dura 24 h).
 *
 * Sale de las propias llamadas del servidor a Riot: un 401 o un 403 la marca como caducada y cualquier
 * respuesta que demuestre que Riot acepta la clave (2xx, 404 o 429) la devuelve a ok. Si el servidor lleva un
 * rato sin hablar con Riot, `consultar` lanza (sin esperarla) una comprobación barata, como mucho cada
 * INTERVALO_COMPROBACION_MS. Aquí nunca entra la clave ni las cabeceras: solo códigos HTTP y fechas.
 */

export type EstadoRiot = 'ok' | 'caducada' | 'desconocida';

export interface InformeClaveRiot {
  riot: EstadoRiot;
  /** Desde cuándo (ISO) está en ese estado. */
  riotDesde: string;
}

export interface EstadoClaveRiot {
  /** Apunta el código HTTP de una respuesta de Riot. */
  observar(estadoHttp: number): void;
  /** Estado actual, sin efectos. */
  estado(): InformeClaveRiot;
  /** Estado actual; si hace falta, lanza en segundo plano una comprobación barata (no la espera). */
  consultar(): InformeClaveRiot;
  /** La comprobación en curso, si la hay (para las pruebas y el apagado). */
  enCurso(): Promise<void>;
}

export interface OpcionesEstadoClave {
  /** Una petición barata a Riot; devuelve el código HTTP o null si no hubo respuesta. */
  comprobar: () => Promise<number | null>;
  ahora?: () => number;
  intervaloMs?: number;
  log?: (mensaje: string) => void;
}

export const INTERVALO_COMPROBACION_MS = 10 * 60_000;

/** null: el código no dice nada de la clave (5xx, 400…). */
export function clasificarRespuesta(estadoHttp: number): Exclude<EstadoRiot, 'desconocida'> | null {
  if (estadoHttp === 401 || estadoHttp === 403) return 'caducada';
  if ((estadoHttp >= 200 && estadoHttp < 300) || estadoHttp === 404 || estadoHttp === 429) return 'ok';
  return null;
}

export function crearEstadoClaveRiot(opciones: OpcionesEstadoClave): EstadoClaveRiot {
  const ahora = opciones.ahora ?? Date.now;
  const intervalo = opciones.intervaloMs ?? INTERVALO_COMPROBACION_MS;
  const log = opciones.log ?? ((m: string) => console.info(m));

  let riot: EstadoRiot = 'desconocida';
  let desde = ahora();
  let ultimaRespuesta = -Infinity;
  let ultimaComprobacion = -Infinity;
  let enCurso: Promise<void> | null = null;

  function observar(estadoHttp: number): void {
    const nuevo = clasificarRespuesta(estadoHttp);
    if (!nuevo) return;
    ultimaRespuesta = ahora();
    if (nuevo === riot) return;
    riot = nuevo;
    desde = ahora();
    log(
      nuevo === 'caducada'
        ? `[riot] Riot rechaza la clave (HTTP ${estadoHttp}): ha caducado o no es válida. Renuévala con «Renovar clave Riot».`
        : '[riot] La clave de Riot funciona.',
    );
  }

  function estado(): InformeClaveRiot {
    return { riot, riotDesde: new Date(desde).toISOString() };
  }

  return {
    observar,
    estado,
    consultar() {
      const t = ahora();
      if (!enCurso && t - ultimaRespuesta >= intervalo && t - ultimaComprobacion >= intervalo) {
        ultimaComprobacion = t;
        enCurso = (async () => {
          try {
            const r = await opciones.comprobar();
            if (r !== null) observar(r);
          } catch {
            // Sin respuesta de Riot (red caída): no dice nada de la clave.
          } finally {
            enCurso = null;
          }
        })();
      }
      return estado();
    },
    enCurso: () => enCurso ?? Promise.resolve(),
  };
}
