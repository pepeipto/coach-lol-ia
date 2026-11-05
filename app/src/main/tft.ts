import {
  crearIndiceNombresTft,
  normalizarObjetosCampeonTft,
  normalizarResultadoTft,
  REGEX_UNIDAD_TFT,
  RUTAS_TFT,
  type EntradaDDragonTft,
  type NombreTft,
} from '@coach/shared';
import type { CompTftVista, ElementoTftVista, ObjetosCampeonTftVista, RespuestaObjetosTft, RespuestaTft } from '../shared/tiposApp';

/*
 * TFT en la app (fuera de la partida, política de Riot): la tier list de composiciones y los mejores objetos de cada
 * unidad que calcula el servidor con partidas de Maestro en adelante. Los nombres e iconos, de los archivos TFT de
 * Data Dragon en el idioma de la app; si no se encuentran, un nombre legible sacado del id.
 */

const CDN = 'https://ddragon.leagueoflegends.com/cdn';
const TIEMPO_ESPERA_MS = 20_000;
/** Lo que dura en memoria la tier list antes de volver a pedirla (el servidor la recalcula cada pocas horas). */
const VIGENCIA_MS = 30 * 60_000;
type ArchivoTft = 'tft-champion' | 'tft-trait' | 'tft-item';

export interface IndicesTft {
  campeon: (id: string) => NombreTft;
  rasgo: (id: string) => NombreTft;
  objeto: (id: string) => NombreTft;
}

export function crearClienteTft(o: { urlServidor: string; fetch?: typeof fetch; ahora?: () => number }) {
  const base = o.urlServidor.replace(/\/+$/, '');
  const hacerFetch = o.fetch ?? fetch;
  const ahora = o.ahora ?? Date.now;
  const indices = new Map<string, Promise<IndicesTft>>();
  let comps: { en: number; datos: RespuestaTft } | null = null;

  async function json(url: string): Promise<unknown> {
    const r = await hacerFetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Respuesta ${r.status}`);
    return r.json();
  }

  async function archivo(version: string, locale: string, nombre: ArchivoTft): Promise<Record<string, EntradaDDragonTft>> {
    try {
      const d = (await json(`${CDN}/${version}/data/${locale}/${nombre}.json`)) as { data?: Record<string, EntradaDDragonTft> } | null;
      return d?.data && typeof d.data === 'object' ? d.data : {};
    } catch {
      return {};
    }
  }

  /** Índices de nombres de una versión e idioma (se piden una vez por sesión; sin Data Dragon, nombres legibles). */
  function indicesDe(version: string, locale: string): Promise<IndicesTft> {
    const clave = `${version}|${locale}`;
    let p = indices.get(clave);
    if (!p) {
      p = (async () => {
        const [cl, ce, rl, re, ol, oe] = await Promise.all(
          (['tft-champion', 'tft-trait', 'tft-item'] as const).flatMap((n) => [archivo(version, locale, n), archivo(version, 'en_US', n)]),
        );
        return {
          campeon: crearIndiceNombresTft(cl, ce),
          rasgo: crearIndiceNombresTft(rl, re),
          objeto: crearIndiceNombresTft(ol, oe),
        };
      })();
      indices.set(clave, p);
    }
    return p;
  }

  const elemento = (version: string, id: string, n: NombreTft): ElementoTftVista => ({
    id,
    nombre: n.nombre,
    ...(n.icono ? { icono: `${CDN}/${version}/img/${n.icono.grupo}/${n.icono.archivo}` } : {}),
  });

  return {
    /** Tier list del parche con nombres e iconos en el idioma `locale` de Data Dragon. */
    async comps(version: string, locale: string): Promise<RespuestaTft> {
      if (comps && ahora() - comps.en < VIGENCIA_MS && comps.datos.ok && comps.datos.locale === locale) return comps.datos;
      let r;
      try {
        r = normalizarResultadoTft(await json(`${base}${RUTAS_TFT.comps}`));
      } catch {
        return comps?.datos.ok ? comps.datos : { ok: false, motivo: 'sin_conexion' };
      }
      if (!r || r.comps.length === 0) return { ok: false, motivo: 'sin_datos' };
      const idx = await indicesDe(version, locale);
      const lista: CompTftVista[] = r.comps.map((c) => ({
        id: c.id,
        tier: c.tier,
        rasgos: c.rasgos.map((x) => elemento(version, x, idx.rasgo(x))),
        portador: elemento(version, c.portador, idx.campeon(c.portador)),
        unidades: c.unidades.map((u) => ({ ...elemento(version, u.id, idx.campeon(u.id)), frecuencia: u.frecuencia })),
        objetosPortador: c.objetosPortador.map((x) => elemento(version, x, idx.objeto(x))),
        nivelMedio: c.nivelMedio,
        tableros: c.tableros,
        frecuencia: c.frecuencia,
        puestoMedio: c.puestoMedio,
        top4: c.top4,
        victorias: c.victorias,
      }));
      const datos: RespuestaTft = { ok: true, locale, parche: r.parche, partidas: r.partidas, comps: lista };
      comps = { en: ahora(), datos };
      return datos;
    },

    /** Mejores objetos de una unidad (id interno). */
    async objetos(version: string, locale: string, id: string): Promise<RespuestaObjetosTft> {
      if (!REGEX_UNIDAD_TFT.test(id)) return { ok: false, motivo: 'sin_datos' };
      let r;
      try {
        r = normalizarObjetosCampeonTft(await json(`${base}${RUTAS_TFT.campeon(id)}`));
      } catch {
        return { ok: false, motivo: 'sin_conexion' };
      }
      if (!r) return { ok: false, motivo: 'sin_datos' };
      const idx = await indicesDe(version, locale);
      const vista: ObjetosCampeonTftVista = {
        campeon: elemento(version, r.campeon, idx.campeon(r.campeon)),
        tableros: r.tableros,
        juegos: r.juegos.map((j) => ({ ...j, objetos: j.objetos.map((x) => elemento(version, x, idx.objeto(x))) })),
        populares: r.populares.map((p) => ({ ...elemento(version, p.objeto, idx.objeto(p.objeto)), frecuencia: p.frecuencia })),
      };
      return { ok: true, objetos: vista };
    },
  };
}

/**
 * IPC de TFT (solo la ventana principal):
 * - 'coach:tft': la tier list del parche.
 * - 'coach:tft-objetos' (id): los mejores objetos de una unidad.
 */
export function registrarIpcTft(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: {
    esPrincipal: (sender: unknown) => boolean;
    version: () => Promise<string>;
    locale: () => string;
    cliente: () => Pick<ReturnType<typeof crearClienteTft>, 'comps' | 'objetos'>;
  },
): void {
  ipc.handle('coach:tft', async (e): Promise<RespuestaTft> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    let version: string;
    try {
      version = await o.version();
    } catch {
      return { ok: false, motivo: 'sin_conexion' };
    }
    return o.cliente().comps(version, o.locale());
  });
  ipc.handle('coach:tft-objetos', async (e, id): Promise<RespuestaObjetosTft> => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof id !== 'string' || !REGEX_UNIDAD_TFT.test(id)) throw new Error('Argumentos no válidos');
    let version: string;
    try {
      version = await o.version();
    } catch {
      return { ok: false, motivo: 'sin_conexion' };
    }
    return o.cliente().objetos(version, o.locale(), id);
  });
}
