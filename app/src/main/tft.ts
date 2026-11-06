import {
  crearIndiceNombresTft,
  normalizarObjetosCampeonTft,
  normalizarResultadoTft,
  REGEX_UNIDAD_TFT,
  RUTAS_TFT,
  type EntradaDDragonTft,
  type NombreTft,
} from '@coach/shared';
import { COMPONENTES_TFT, RECETAS_TFT, recetaDe, type ChuletaTftVista, type CompChuletaTft } from '../shared/tftChuleta';
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

const CDRAGON = 'https://raw.communitydragon.org/latest';
/** El JSON de TFT de CommunityDragon pesa varios MB: más margen que para Data Dragon. */
const TIEMPO_ESPERA_CDRAGON_MS = 60_000;

/** Ruta de un recurso del juego («ASSETS/…/Foo.TFT_Set18.tex») → su PNG en CommunityDragon; null si no tiene esa forma. */
export function urlRecursoCDragon(ruta: unknown): string | null {
  if (typeof ruta !== 'string' || !/^[\w./ -]{1,300}\.(?:tex|dds|png)$/i.test(ruta) || ruta.includes('..')) return null;
  return `${CDRAGON}/game/${ruta.toLowerCase().replace(/\.(?:tex|dds)$/, '.png')}`;
}

/** Datos de TFT de CommunityDragon con la forma de Data Dragon; los iconos van en `urls` (clave: image.full). */
export interface DatosCDragonTft {
  campeon: Record<string, EntradaDDragonTft>;
  rasgo: Record<string, EntradaDDragonTft>;
  objeto: Record<string, EntradaDDragonTft>;
  urls: Map<string, string>;
}

/**
 * 3.15: respaldo de nombres e iconos con `cdragon/tft/<locale>.json` de CommunityDragon, que trae el set nuevo antes
 * que Data Dragon. Forma: { items: [{ apiName, name, icon }], setData: [{ number, champions: [{ apiName, name,
 * squareIcon, tileIcon, icon }], traits: [{ apiName, name, icon }] }] }. El set más reciente va primero.
 */
export function interpretarCDragonTft(json: unknown, prefijo = 'cd'): DatosCDragonTft | null {
  if (typeof json !== 'object' || json === null) return null;
  const j = json as { items?: unknown; setData?: unknown };
  const datos: DatosCDragonTft = { campeon: {}, rasgo: {}, objeto: {}, urls: new Map() };
  let n = 0;
  const anadir = (destino: Record<string, EntradaDDragonTft>, e: unknown, rutas: string[]) => {
    if (typeof e !== 'object' || e === null) return;
    const o = e as Record<string, unknown>;
    if (typeof o.apiName !== 'string' || !o.apiName || typeof o.name !== 'string' || !o.name.trim() || destino[o.apiName]) return;
    const url = rutas.map((r) => urlRecursoCDragon(o[r])).find((u) => u);
    const entrada: EntradaDDragonTft = { id: o.apiName, name: o.name.trim() };
    if (url) {
      const clave = `${prefijo}${n++}.png`;
      datos.urls.set(clave, url);
      entrada.image = { full: clave, group: 'cdragon' };
    }
    destino[o.apiName] = entrada;
  };
  const sets = Array.isArray(j.setData) ? [...(j.setData as { number?: unknown }[])] : [];
  sets.sort((a, b) => (typeof b?.number === 'number' ? b.number : 0) - (typeof a?.number === 'number' ? a.number : 0));
  for (const set of sets as { champions?: unknown; traits?: unknown }[]) {
    if (Array.isArray(set?.champions)) for (const c of set.champions) anadir(datos.campeon, c, ['squareIcon', 'tileIcon', 'icon']);
    if (Array.isArray(set?.traits)) for (const t of set.traits) anadir(datos.rasgo, t, ['icon']);
  }
  if (Array.isArray(j.items)) for (const i of j.items) anadir(datos.objeto, i, ['icon']);
  return Object.keys(datos.campeon).length + Object.keys(datos.objeto).length > 0 ? datos : null;
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

  /** URLs de los iconos de CommunityDragon (de todos los idiomas cargados; las claves llevan el idioma). */
  const urlsCDragon = new Map<string, string>();
  /** CommunityDragon en el idioma de la app (es_MX → es_mx); sin red, null (se quedan los de Data Dragon). */
  async function cdragon(locale: string): Promise<DatosCDragonTft | null> {
    try {
      const r = await hacerFetch(`${CDRAGON}/cdragon/tft/${locale.toLowerCase()}.json`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_CDRAGON_MS) });
      const datos = r.ok ? interpretarCDragonTft(await r.json(), `cd_${locale.toLowerCase().replace(/[^a-z0-9]/g, '')}_`) : null;
      for (const [k, v] of datos?.urls ?? []) urlsCDragon.set(k, v);
      return datos;
    } catch {
      return null;
    }
  }

  /** Índices de nombres de una versión e idioma (se piden una vez por sesión; sin Data Dragon, nombres legibles). */
  function indicesDe(version: string, locale: string): Promise<IndicesTft> {
    const clave = `${version}|${locale}`;
    let p = indices.get(clave);
    if (!p) {
      p = (async () => {
        const [[cl, ce, rl, re, ol, oe], cd] = await Promise.all([
          Promise.all((['tft-champion', 'tft-trait', 'tft-item'] as const).flatMap((n) => [archivo(version, locale, n), archivo(version, 'en_US', n)])),
          cdragon(locale),
        ]);
        /** Data Dragon primero; lo que no tenga icono allí (set nuevo), de CommunityDragon. */
        const con = (dd: (id: string) => NombreTft, datos: Record<string, EntradaDDragonTft> | undefined) => {
          if (!datos || Object.keys(datos).length === 0) return dd;
          const respaldo = crearIndiceNombresTft(datos);
          return (id: string): NombreTft => {
            const n = dd(id);
            if (n.icono) return n;
            const r = respaldo(id);
            return r.icono ? r : n;
          };
        };
        return {
          campeon: con(crearIndiceNombresTft(cl, ce), cd?.campeon),
          rasgo: con(crearIndiceNombresTft(rl, re), cd?.rasgo),
          objeto: con(crearIndiceNombresTft(ol, oe), cd?.objeto),
        };
      })();
      indices.set(clave, p);
    }
    return p;
  }

  const elemento = (version: string, id: string, n: NombreTft): ElementoTftVista => {
    const icono = !n.icono ? null : n.icono.grupo === 'cdragon' ? urlsCDragon.get(n.icono.archivo) : `${CDN}/${version}/img/${n.icono.grupo}/${n.icono.archivo}`;
    return { id, nombre: n.nombre, ...(icono ? { icono } : {}) };
  };

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

    /**
     * 3.15: chuleta de TFT para la partida, con nombres e iconos: las composiciones elegidas (campeones y objetos del
     * portador con su receta) y la tabla de recetas. No pide nada al servidor: solo Data Dragon (y sin él, nombres legibles).
     */
    async chuleta(version: string, locale: string, guardadas: readonly CompChuletaTft[]): Promise<ChuletaTftVista> {
      const idx = await indicesDe(version, locale);
      /** Objeto por su id; si Data Dragon no lo conoce por id, por su nombre en inglés. */
      const objeto = (id: string, en?: string): ElementoTftVista => {
        const n = idx.objeto(id);
        if (n.icono || !en) return elemento(version, id, n);
        const porNombre = idx.objeto(en);
        return elemento(version, id, porNombre.icono ? porNombre : { nombre: en });
      };
      const enIngles = new Map<string, string>([...COMPONENTES_TFT.map((c) => [c.id, c.en] as const), ...RECETAS_TFT.map((r) => [r[2], r[3]] as const)]);
      const obj = (id: string) => objeto(id, enIngles.get(id));
      const componentes = COMPONENTES_TFT.map((c) => obj(c.id));
      const tabla = COMPONENTES_TFT.map((a) =>
        COMPONENTES_TFT.map((b) => {
          const r = RECETAS_TFT.find((x) => (x[0] === a.id && x[1] === b.id) || (x[0] === b.id && x[1] === a.id));
          return r ? obj(r[2]) : null;
        }),
      );
      return {
        comps: guardadas.map((c) => ({
          id: c.id,
          rasgos: c.rasgos.map((x) => elemento(version, x, idx.rasgo(x))),
          portador: elemento(version, c.portador, idx.campeon(c.portador)),
          unidades: c.unidades.map((u) => elemento(version, u, idx.campeon(u))),
          objetos: c.objetosPortador.map((x) => {
            const receta = recetaDe(x);
            return { ...obj(x), ...(receta ? { receta: [obj(receta[0]), obj(receta[1])] as [ElementoTftVista, ElementoTftVista] } : {}) };
          }),
        })),
        componentes,
        tabla,
      };
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
