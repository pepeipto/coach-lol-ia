import {
  IDIOMAS_IA,
  LIMITES_IA,
  MODOS_JUEGO,
  ROLES,
  type EstadisticasFinales,
  type IdiomaIa,
  type JugadorConsejo,
  type ModoJuego,
  type MomentoConsejo,
  type MuestraMinuto,
  type ObjetivoTomadoIa,
  type PeticionAnalisis,
  type PeticionConsejo,
  type Rol,
  type TipoObjetivoIa,
} from '@coach/shared';

/*
 * Validación estricta de los cuerpos de /api/coach/*. Todo lo que no encaja se rechaza (400) y lo que pasa se copia
 * campo a campo: al modelo solo llega lo que esperamos, con los tamaños acotados. Nada de esto se guarda.
 */

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Señal interna: un campo no es válido. */
class Invalido extends Error {}
const fallo = (campo: string): never => {
  throw new Invalido(campo);
};

function entero(v: unknown, min: number, max: number, campo: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fallo(campo);
  return Math.round(v as number);
}
function decimal(v: unknown, min: number, max: number, campo: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fallo(campo);
  return Math.round((v as number) * 10) / 10;
}
function enteroOpcional(v: unknown, min: number, max: number, campo: string): number | undefined {
  return v === undefined || v === null ? undefined : entero(v, min, max, campo);
}

/** Id de Data Dragon de un campeón («Ahri», «MonkeyKing», «KSante»). */
const ID_CAMPEON = /^[A-Za-z][A-Za-z0-9]{0,29}$/;
function campeon(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !ID_CAMPEON.test(v)) fallo(campo);
  return v as string;
}

/** Texto corto legible: sin caracteres de control ni signos que no hacen falta en un nombre o un suceso. */
const TEXTO_PERMITIDO = /^[\p{L}\p{N}\p{M} .,:;'’()\-+/!?«»"&%·]*$/u;
function texto(v: unknown, max: number, campo: string): string {
  if (typeof v !== 'string') fallo(campo);
  const t = (v as string).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!t || t.length > max || !TEXTO_PERMITIDO.test(t)) fallo(campo);
  return t;
}

function lista<T>(v: unknown, max: number, campo: string, cada: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(v) || v.length > max) fallo(campo);
  return (v as unknown[]).map(cada);
}

const idObjeto = (v: unknown, campo: string) => entero(v, 1, 999_999, campo);
const objetos = (v: unknown, campo: string) => lista(v, LIMITES_IA.objetos, campo, (x) => idObjeto(x, campo));

export function leerIdiomaIa(v: unknown): IdiomaIa {
  return (IDIOMAS_IA as readonly unknown[]).includes(v) ? (v as IdiomaIa) : fallo('idioma');
}
function modo(v: unknown): ModoJuego {
  return MODOS_JUEGO.includes(v as ModoJuego) ? (v as ModoJuego) : fallo('modo');
}
function rol(v: unknown): Rol | null {
  if (v === null || v === undefined) return null;
  return ROLES.includes(v as Rol) ? (v as Rol) : fallo('rol');
}

const TIPOS_OBJETIVO: readonly TipoObjetivoIa[] = ['dragon', 'anciano', 'heraldo', 'baron', 'larvas', 'atakhan', 'torre', 'inhibidor'];
const SUBTIPO = /^[A-Za-z]{1,20}$/;
function objetivo(x: unknown): ObjetivoTomadoIa {
  if (!esObj(x)) fallo('objetivos');
  const o = x as Obj;
  const tipo = TIPOS_OBJETIVO.includes(o.tipo as TipoObjetivoIa) ? (o.tipo as TipoObjetivoIa) : fallo('objetivos.tipo');
  const equipo = o.equipo === 'aliado' || o.equipo === 'enemigo' ? o.equipo : fallo('objetivos.equipo');
  const r: ObjetivoTomadoIa = { t: entero(o.t, 0, 14_400, 'objetivos.t'), tipo, equipo };
  if (o.subtipo !== undefined) {
    if (typeof o.subtipo !== 'string' || !SUBTIPO.test(o.subtipo)) fallo('objetivos.subtipo');
    r.subtipo = o.subtipo as string;
  }
  return r;
}

function nombresObjetos(v: unknown): Record<string, string> {
  if (v === undefined) return {};
  if (!esObj(v)) fallo('nombresObjetos');
  const entradas = Object.entries(v as Obj);
  if (entradas.length > LIMITES_IA.nombresObjetos) fallo('nombresObjetos');
  const r: Record<string, string> = {};
  for (const [id, nombre] of entradas) {
    if (!/^\d{1,6}$/.test(id)) fallo('nombresObjetos');
    r[id] = texto(nombre, LIMITES_IA.textoNombre, 'nombresObjetos');
  }
  return r;
}

function finales(v: unknown): EstadisticasFinales {
  if (!esObj(v)) fallo('final');
  const f = v as Obj;
  const r: EstadisticasFinales = {
    k: entero(f.k, 0, 300, 'final.k'),
    d: entero(f.d, 0, 300, 'final.d'),
    a: entero(f.a, 0, 300, 'final.a'),
    cs: entero(f.cs, 0, 5000, 'final.cs'),
    nivel: entero(f.nivel, 1, 30, 'final.nivel'),
    objetos: objetos(f.objetos, 'final.objetos'),
  };
  const opcionales: [keyof EstadisticasFinales, number][] = [
    ['oro', 500_000],
    ['danoCampeones', 2_000_000],
    ['danoRecibido', 2_000_000],
    ['vision', 1000],
    ['guardianes', 1000],
    ['guardianesDestruidos', 1000],
    ['guardianesControl', 1000],
  ];
  for (const [campo, max] of opcionales) {
    const n = enteroOpcional(f[campo], 0, max, `final.${campo}`);
    if (n !== undefined) (r as unknown as Record<string, number>)[campo] = n;
  }
  return r;
}

function muestra(x: unknown): MuestraMinuto {
  if (!esObj(x)) fallo('linea');
  const m = x as Obj;
  return {
    m: entero(m.m, 0, 240, 'linea.m'),
    cs: entero(m.cs, 0, 5000, 'linea.cs'),
    nivel: entero(m.nivel, 1, 30, 'linea.nivel'),
    k: entero(m.k, 0, 300, 'linea.k'),
    d: entero(m.d, 0, 300, 'linea.d'),
    a: entero(m.a, 0, 300, 'linea.a'),
    oro: entero(m.oro, 0, 500_000, 'linea.oro'),
  };
}

function marcador(v: unknown, campo: string): { aliados: number; enemigos: number } {
  if (!esObj(v)) fallo(campo);
  const m = v as Obj;
  return { aliados: entero(m.aliados, 0, 500, campo), enemigos: entero(m.enemigos, 0, 500, campo) };
}

function build(v: unknown): PeticionAnalisis['build'] {
  if (v === null || v === undefined) return null;
  if (!esObj(v)) fallo('build');
  const b = v as Obj;
  return {
    nucleo: lista(b.nucleo, 8, 'build.nucleo', (x) => idObjeto(x, 'build.nucleo')),
    botas: b.botas === null || b.botas === undefined ? null : idObjeto(b.botas, 'build.botas'),
    situacionales: lista(b.situacionales, 12, 'build.situacionales', (x) => idObjeto(x, 'build.situacionales')),
  };
}

/** Valida el cuerpo de POST /api/coach/analisis; null si no es válido. */
export function validarAnalisis(cuerpo: unknown): PeticionAnalisis | null {
  try {
    if (!esObj(cuerpo)) return fallo('cuerpo');
    const c = cuerpo;
    const m = modo(c.modo);
    const r: PeticionAnalisis = {
      idioma: leerIdiomaIa(c.idioma),
      modo: m,
      campeon: campeon(c.campeon, 'campeon'),
      // Fuera de la Grieta no hay calles: el rol se ignora.
      rol: m === 'clasificatoria' ? rol(c.rol) : null,
      resultado: c.resultado === 'victoria' || c.resultado === 'derrota' ? c.resultado : c.resultado == null ? null : fallo('resultado'),
      duracion: entero(c.duracion, 60, 14_400, 'duracion'),
      final: finales(c.final),
      linea: lista(c.linea, LIMITES_IA.minutos, 'linea', muestra),
      muertes: lista(c.muertes, LIMITES_IA.muertes, 'muertes', (x) => entero(x, 0, 14_400, 'muertes')),
      compras: lista(c.compras, LIMITES_IA.compras, 'compras', (x) => {
        if (!esObj(x)) fallo('compras');
        const o = x as Obj;
        return { t: entero(o.t, 0, 14_400, 'compras.t'), id: idObjeto(o.id, 'compras.id') };
      }),
      objetivos: lista(c.objetivos, LIMITES_IA.objetivos, 'objetivos', objetivo),
      build: build(c.build),
      csObjetivoMinuto: c.csObjetivoMinuto == null ? null : decimal(c.csObjetivoMinuto, 0, 15, 'csObjetivoMinuto'),
      nombresObjetos: nombresObjetos(c.nombresObjetos),
    };
    if (c.equipos !== undefined) r.equipos = marcador(c.equipos, 'equipos');
    if (c.nombreCampeon !== undefined) r.nombreCampeon = texto(c.nombreCampeon, LIMITES_IA.textoNombre, 'nombreCampeon');
    return r;
  } catch (e) {
    if (e instanceof Invalido) return null;
    throw e;
  }
}

const MOMENTOS: readonly MomentoConsejo[] = ['muerte', 'tienda', 'objetivo'];
const PROXIMOS = ['dragon', 'heraldo', 'baron', 'anciano', 'larvas', 'atakhan'] as const;

function jugador(x: unknown): JugadorConsejo {
  if (!esObj(x)) fallo('jugador');
  const j = x as Obj;
  const r: JugadorConsejo = {
    campeon: campeon(j.campeon, 'jugador.campeon'),
    nivel: entero(j.nivel, 1, 30, 'jugador.nivel'),
    objetos: objetos(j.objetos, 'jugador.objetos'),
  };
  for (const k of ['k', 'd', 'a'] as const) {
    const n = enteroOpcional(j[k], 0, 300, `jugador.${k}`);
    if (n !== undefined) r[k] = n;
  }
  return r;
}

/** Valida el cuerpo de POST /api/coach/consejo; null si no es válido. */
export function validarConsejo(cuerpo: unknown): PeticionConsejo | null {
  try {
    if (!esObj(cuerpo)) return fallo('cuerpo');
    const c = cuerpo;
    const m = modo(c.modo);
    if (!esObj(c.yo)) fallo('yo');
    const y = c.yo as Obj;
    const r: PeticionConsejo = {
      idioma: leerIdiomaIa(c.idioma),
      modo: m,
      momento: MOMENTOS.includes(c.momento as MomentoConsejo) ? (c.momento as MomentoConsejo) : fallo('momento'),
      tiempo: entero(c.tiempo, 0, 14_400, 'tiempo'),
      yo: {
        campeon: campeon(y.campeon, 'yo.campeon'),
        rol: m === 'clasificatoria' ? rol(y.rol) : null,
        nivel: entero(y.nivel, 1, 30, 'yo.nivel'),
        oro: entero(y.oro, 0, 100_000, 'yo.oro'),
        objetos: objetos(y.objetos, 'yo.objetos'),
        k: entero(y.k, 0, 300, 'yo.k'),
        d: entero(y.d, 0, 300, 'yo.d'),
        a: entero(y.a, 0, 300, 'yo.a'),
        cs: entero(y.cs, 0, 5000, 'yo.cs'),
      },
      aliados: lista(c.aliados, LIMITES_IA.jugadoresEquipo - 1, 'aliados', jugador),
      enemigos: lista(c.enemigos, LIMITES_IA.jugadoresEquipo, 'enemigos', jugador),
      marcador: marcador(c.marcador, 'marcador'),
      objetivos: lista(c.objetivos, LIMITES_IA.objetivos, 'objetivos', objetivo),
      recientes: lista(c.recientes ?? [], LIMITES_IA.recientes, 'recientes', (x) => texto(x, LIMITES_IA.textoReciente, 'recientes')),
      nombresObjetos: nombresObjetos(c.nombresObjetos),
    };
    if (c.proximoObjetivo !== undefined && c.proximoObjetivo !== null) {
      if (!esObj(c.proximoObjetivo)) fallo('proximoObjetivo');
      const p = c.proximoObjetivo as Obj;
      const tipo = PROXIMOS.includes(p.tipo as (typeof PROXIMOS)[number]) ? (p.tipo as (typeof PROXIMOS)[number]) : fallo('proximoObjetivo.tipo');
      r.proximoObjetivo = { tipo, enSegundos: entero(p.enSegundos, 0, 600, 'proximoObjetivo.enSegundos') };
      if (p.subtipo !== undefined) {
        if (typeof p.subtipo !== 'string' || !SUBTIPO.test(p.subtipo)) fallo('proximoObjetivo.subtipo');
        r.proximoObjetivo.subtipo = p.subtipo as string;
      }
    }
    return r;
  } catch (e) {
    if (e instanceof Invalido) return null;
    throw e;
  }
}
