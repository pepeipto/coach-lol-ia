import type { Build, KdaMedio, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoOverlay, EstadoPartida, IdObjetivo, Indicacion, ObjetivoEstado } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import { habilidadQueSubir } from './habilidades';
import { avisoEnModo, avisoEnPartida, esGrieta, esModoRapido, widgetsDeModo } from '../../shared/modosOverlay';
import {
  ANCIANO_REAPARECE,
  ANCIANO_TRAS_ALMA,
  AVISO_OBJETIVO_ANTES,
  BARATIJA_CADA_S,
  BARATIJA_DESDE,
  BARATIJAS,
  BARON,
  CAMPAMENTOS,
  CS10_EN,
  CS10_HASTA,
  CS_OBJETIVO_POR_MINUTO,
  DRAGON,
  DRAGON_QUE_FIJA_ELEMENTO,
  DRAGONES_ALMA_SEGURA,
  DRAGONES_PARA_ALMA,
  ESCARABAJO,
  FASE_MEDIA_DESDE,
  FASE_TARDIA_DESDE,
  HERALDO,
  ID_GUARDIAN_CONTROL,
  INHIBIDOR_REAPARECE,
  LARVAS,
  OBJETIVOS_PLURALES,
  TIPO_ANCIANO,
  TIPOS_DRAGON,
  VISION_DESDE,
  VISION_ORO_MINIMO,
} from './objetivos';
import type { ObjetivoNeutral } from './objetivos';

type Objetos = DatosEstaticos['objetos'];

interface Compra {
  id: number;
  nombre: string;
  costeRestante: number;
}

function siguienteCompra(estado: EstadoPartida, build: Build, objetos: Objetos): Compra | null {
  const secuencia = [build.nucleo[0], build.botas, ...build.nucleo.slice(1), ...build.situacionales];
  for (const id of secuencia) {
    if (id === null || id === undefined || estado.objetos.includes(id)) continue;
    const objeto = objetos[id];
    if (!objeto) continue;
    const inventario = [...estado.objetos];
    let coste = objeto.gold.total;
    for (const componente of objeto.from ?? []) {
      const pos = inventario.indexOf(Number(componente));
      if (pos === -1) continue;
      inventario.splice(pos, 1);
      coste -= objetos[Number(componente)]?.gold.total ?? 0;
    }
    return { id, nombre: objeto.name, costeRestante: Math.max(0, coste) };
  }
  return null;
}

interface EstadoObjetivo {
  id: IdObjetivo;
  epico: boolean;
  aparicion: number;
  restante: number;
  /** Ya apareció y nadie lo ha matado desde entonces. */
  disponible: boolean;
}

function crear(id: IdObjetivo, epico: boolean, aparicion: number, tiempo: number): EstadoObjetivo {
  const restante = aparicion - tiempo;
  return { id, epico, aparicion, restante, disponible: restante <= 0 };
}

/** Objetivo con tiempos fijos; null si ya no está (muerto sin reaparición o desaparecido del mapa). */
function estadoObjetivo(o: ObjetivoNeutral, estado: EstadoPartida): EstadoObjetivo | null {
  const muertes = o.evento ? estado.eventos.filter((e) => e.nombre === o.evento) : [];
  // Sin evento (campamentos, Escarabajo): solo se muestra la primera aparición.
  if (!o.evento && estado.tiempo >= o.aparece) return null;
  if (o.desaparece !== null && estado.tiempo >= o.desaparece) return null;
  let aparicion = o.aparece;
  if (muertes.length >= (o.muertes ?? 1)) {
    if (o.reaparece === null) return null;
    const ultima = Math.max(...muertes.map((e) => e.tiempo));
    aparicion = ultima + o.reaparece;
  }
  return crear(o.id, o.epico, aparicion, estado.tiempo);
}

/**
 * Foso del dragón: elementales cada 5 min hasta que un equipo mata su cuarto dragón (alma);
 * desde entonces solo sale el Anciano, 6 min después del alma y 6 min después de cada Anciano.
 */
function estadoFoso(estado: EstadoPartida): EstadoObjetivo {
  const muertes = estado.eventos.filter((e) => e.nombre === DRAGON.evento).sort((a, b) => a.tiempo - b.tiempo);
  const porEquipo = { ORDER: 0, CHAOS: 0 };
  let ultimoElemental: number | null = null;
  let alma: number | null = null;
  let ultimoAnciano: number | null = null;
  let elementales = 0;
  for (const e of muertes) {
    if (e.dragon === TIPO_ANCIANO) {
      ultimoAnciano = e.tiempo;
      continue;
    }
    ultimoElemental = e.tiempo;
    elementales++;
    if (e.equipo && ++porEquipo[e.equipo] === DRAGONES_PARA_ALMA && alma === null) alma = e.tiempo;
    // Sin equipos conocidos: el 7.º dragón asegura que alguien tiene el alma.
    if (elementales === DRAGONES_ALMA_SEGURA && alma === null) alma = e.tiempo;
  }
  // Un Anciano muerto también prueba que hubo alma, aunque no se supiera el equipo de los dragones.
  if (ultimoAnciano !== null) return crear('anciano', true, ultimoAnciano + ANCIANO_REAPARECE, estado.tiempo);
  if (alma !== null) return crear('anciano', true, alma + ANCIANO_TRAS_ALMA, estado.tiempo);
  const aparicion = ultimoElemental === null ? DRAGON.aparece : ultimoElemental + (DRAGON.reaparece ?? 0);
  return crear('dragon', true, aparicion, estado.tiempo);
}

/** Todos los objetivos vigentes, en el orden de la lista del panel. */
function estadosObjetivos(estado: EstadoPartida): EstadoObjetivo[] {
  const fijos = (o: ObjetivoNeutral) => estadoObjetivo(o, estado);
  return [fijos(CAMPAMENTOS), fijos(ESCARABAJO), fijos(LARVAS), estadoFoso(estado), fijos(HERALDO), fijos(BARON)].filter(
    (x): x is EstadoObjetivo => x !== null,
  );
}

function textoObjetivo(e: EstadoObjetivo): string {
  const objetivo = t(`objetivo.${e.id}`);
  const plural = OBJETIVOS_PLURALES.has(e.id) ? 'Plural' : '';
  return e.disponible
    ? t(`aviso.objetivoDisponible${plural}`, { objetivo })
    : t(`aviso.objetivoPronto${plural}`, { objetivo, segundos: Math.ceil(e.restante) });
}

function fase(tiempo: number): 'temprana' | 'media' | 'tardia' {
  if (tiempo < FASE_MEDIA_DESDE) return 'temprana';
  if (tiempo < FASE_TARDIA_DESDE) return 'media';
  return 'tardia';
}

export function generarIndicaciones(
  estado: EstadoPartida,
  build: Build | null,
  rol: Rol,
  objetos: Objetos,
): Indicacion[] {
  const salida: Indicacion[] = [];

  if (build) {
    const compra = siguienteCompra(estado, build, objetos);
    if (compra && estado.oro >= compra.costeRestante) {
      salida.push({
        tipo: 'compra',
        clave: `compra:${compra.id}`,
        texto: t('aviso.compra', { oro: estado.oro, objeto: compra.nombre }),
      });
    }
    // 3.0.1: la habilidad que toca subir ya no es un aviso de texto: la marca la flecha del HUD
    // (proximaHabilidad) y la dice la voz.
  }

  // Fuera de la Grieta (ARAM, ARAM: Caos y Arena) solo queda la compra.
  if (!esGrieta(estado.modo)) return salida.filter((i) => avisoEnModo(i.tipo, estado.modo));

  for (const e of estadosObjetivos(estado).filter((o) => o.epico)) {
    const pronto = e.restante > 0 && e.restante <= AVISO_OBJETIVO_ANTES;
    if (!pronto && !e.disponible) continue;
    salida.push({
      tipo: 'objetivo',
      clave: `objetivo:${e.id}:${e.disponible ? 'disp' : 'pronto'}:${e.aparicion}`,
      texto: textoObjetivo(e),
    });
  }

  if (estado.tiempo >= VISION_DESDE && !estado.objetos.includes(ID_GUARDIAN_CONTROL) && estado.oro >= VISION_ORO_MINIMO) {
    salida.push({ tipo: 'vision', clave: 'vision', texto: t('aviso.vision') });
  }
  if (faltaBaratija(estado)) {
    salida.push({ tipo: 'vision', clave: `baratija:${Math.floor(estado.tiempo / BARATIJA_CADA_S)}`, texto: t('aviso.baratija') });
  }

  const f = fase(estado.tiempo);
  salida.push({ tipo: 'fase', clave: `fase:${f}`, texto: t(`fase.${rol}.${f}`) });

  // 3.8: en un modo rotativo de la Grieta, lo que no aplica a ese modo (la fase de partida en URF) fuera.
  return estado.rotativo ? salida.filter((i) => avisoEnPartida(i.tipo, estado.modo, estado.rotativo)) : salida;
}

/** 3.5: en la Grieta, pasado el minuto y medio, sin ninguna baratija en el inventario. */
export function faltaBaratija(estado: EstadoPartida): boolean {
  return esGrieta(estado.modo) && estado.tiempo >= BARATIJA_DESDE && !estado.objetos.some((o) => BARATIJAS.includes(o));
}

/** 3.5: calle de un inhibidor y si es de tu equipo, a partir de «Barracks_T1_L1» (T1 = equipo azul, ORDER). */
function inhibidor(nombre: string | undefined, equipo: EstadoPartida['equipo']): { calle: 'top' | 'mid' | 'bot'; aliado: boolean | null } | null {
  const m = nombre ? /^Barracks_T([12])_([LCR])\d/.exec(nombre) : null;
  if (!m) return null;
  const calle = ({ L: 'top', C: 'mid', R: 'bot' } as const)[m[2] as 'L' | 'C' | 'R'];
  return { calle, aliado: equipo ? (m[1] === '1') === (equipo === 'ORDER') : null };
}

/**
 * 3.5: inhibidores caídos que aún no han reaparecido (evento oficial InhibKilled y 5 min; InhibRespawned lo quita),
 * con los segundos que faltan. Es lo que cualquiera ve en el mapa.
 */
export function inhibidoresCaidos(estado: EstadoPartida): { calle: 'top' | 'mid' | 'bot'; aliado: boolean | null; restante: number }[] {
  const caidos = new Map<string, { calle: 'top' | 'mid' | 'bot'; aliado: boolean | null; tiempo: number }>();
  for (const e of estado.eventos) {
    if (!e.estructura) continue;
    if (e.nombre === 'InhibKilled') {
      const i = inhibidor(e.estructura, estado.equipo);
      if (i) caidos.set(e.estructura, { ...i, tiempo: e.tiempo });
    } else if (e.nombre === 'InhibRespawned') caidos.delete(e.estructura);
  }
  return [...caidos.values()]
    .map((c) => ({ calle: c.calle, aliado: c.aliado, restante: Math.ceil(c.tiempo + INHIBIDOR_REAPARECE - estado.tiempo) }))
    .filter((c) => c.restante > 0)
    .sort((a, b) => a.restante - b.restante);
}

/** 3.5: valor en oro de unos objetos (precio total de Data Dragon). */
export function valorObjetos(ids: number[] | undefined, objetos: Objetos): number {
  return (ids ?? []).reduce((s, id) => s + (objetos[id]?.gold?.total ?? 0), 0);
}

/**
 * 3.5: diferencia de oro en objetos (lo que enseña el Tab a todos): tu equipo frente al rival y tú frente a tu rival
 * de línea (el del otro equipo con tu misma posición). Null fuera de la Grieta o sin los objetos de los jugadores.
 */
export function oroEnObjetos(estado: EstadoPartida, rol: Rol, objetos: Objetos): { equipo: number; rival: number | null } | null {
  const js = estado.jugadores;
  if (!esGrieta(estado.modo) || !estado.equipo || !js?.length || !js.some((j) => j.objetos)) return null;
  const mio = estado.equipo;
  const suma = (aliado: boolean) => js.filter((j) => (j.equipo === mio) === aliado).reduce((s, j) => s + valorObjetos(j.objetos, objetos), 0);
  const yo = js.find((j) => j.equipo === mio && j.campeon === estado.campeon);
  const rival = js.find((j) => j.equipo !== mio && j.posicion === rol);
  return {
    equipo: suma(true) - suma(false),
    rival: yo && rival ? valorObjetos(yo.objetos, objetos) - valorObjetos(rival.objetos, objetos) : null,
  };
}

/** Habilidad que toca subir, solo con un punto libre y si se puede subir ahora (ver habilidades.ts). */
function proximaHabilidad(estado: EstadoPartida, build: Build | null): EstadoOverlay['proximaHabilidad'] {
  return build ? habilidadQueSubir(estado, build.ordenHabilidades) : null;
}

/**
 * Clave (overlay.dragon.<clave>) del tipo del próximo dragón elemental, si ya se sabe: el terreno
 * de la Grieta (cambia tras el segundo dragón) o, si la API no lo da, el DragonType del tercer
 * dragón, que fija el resto. Null si no se sabe.
 */
export function claveProximoDragon(estado: EstadoPartida): string | null {
  const clave = (tipo: string | undefined) => (tipo ? TIPOS_DRAGON[tipo] ?? null : null);
  const terreno = clave(estado.terreno);
  if (terreno) return terreno;
  const elementales = estado.eventos
    .filter((e) => e.nombre === DRAGON.evento && e.dragon !== TIPO_ANCIANO)
    .sort((a, b) => a.tiempo - b.tiempo);
  return clave(elementales[DRAGON_QUE_FIJA_ELEMENTO - 1]?.dragon);
}

function tipoProximoDragon(estado: EstadoPartida): string | null {
  const clave = claveProximoDragon(estado);
  return clave ? t(`overlay.dragon.${clave}`) : null;
}

const IDS_BARRA = new Set<IdObjetivo>(['larvas', 'dragon', 'anciano', 'heraldo', 'baron']);

/**
 * CS@10: el CS del primer estado entre 10:00 y 10:30; una vez tomado no cambia. Si el primer estado
 * llega más tarde (reconexión), ya no sería el CS a los 10 minutos: se queda en null.
 */
export function cs10Tras(previo: number | null, estado: EstadoPartida): number | null {
  if (previo !== null) return previo;
  const enVentana = estado.tiempo >= CS10_EN && estado.tiempo < CS10_HASTA;
  return enVentana && estado.cs !== undefined ? estado.cs : null;
}

/** (asesinatos + asistencias) / máx(1, muertes), con dos decimales. */
export function ratioKda({ k, d, a }: { k: number; d: number; a: number }): number {
  return Math.round(((k + a) / Math.max(1, d)) * 100) / 100;
}

/** El KDA medio de la build solo si tiene la forma esperada (viene del servidor o de la caché). */
function kdaMedioValido(kda: unknown): KdaMedio | null {
  if (typeof kda !== 'object' || kda === null) return null;
  const k = kda as Record<string, unknown>;
  const ok = [k.asesinatos, k.muertes, k.asistencias, k.ratio].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
  return ok ? { asesinatos: k.asesinatos as number, muertes: k.muertes as number, asistencias: k.asistencias as number, ratio: k.ratio as number } : null;
}

/** Todo lo que pintan los widgets del overlay, calculado a partir del estado de la partida. */
export function resumenOverlay(
  estado: EstadoPartida,
  build: Build | null,
  rol: Rol,
  objetos: Objetos,
  version: string,
  /** CS@10 recordado por el orquestador (ver cs10Tras). */
  cs10: number | null = null,
): EstadoOverlay {
  const compra = build ? siguienteCompra(estado, build, objetos) : null;
  const subtipoDragon = tipoProximoDragon(estado);
  const grieta = esGrieta(estado.modo);
  const widgets = widgetsDeModo(estado.modo);
  // Fuera de la Grieta no hay objetivos que mostrar.
  const objetivosBarra: ObjetivoEstado[] = (grieta ? estadosObjetivos(estado) : [])
    .filter((e) => IDS_BARRA.has(e.id))
    .map((e) => ({
      id: e.id as ObjetivoEstado['id'],
      nombre: t(`objetivoCorto.${e.id}`),
      subtipo: e.id === 'dragon' ? subtipoDragon : null,
      aparece: e.disponible ? null : Math.ceil(e.restante),
      disponible: e.disponible,
    }));
  // 3.5: inhibidores caídos con su cuenta atrás hasta reaparecer (de los dos equipos).
  if (grieta) {
    for (const i of inhibidoresCaidos(estado)) {
      objetivosBarra.push({
        id: 'inhibidor',
        nombre: t('objetivoCorto.inhibidor', { calle: t(`overlay.calle.${i.calle}`) }),
        subtipo: i.calle,
        aparece: i.restante,
        disponible: false,
        ...(i.aliado !== null ? { aliado: i.aliado } : {}),
      });
    }
  }
  const minutos = estado.tiempo / 60;
  // El CS (y su objetivo por rol) solo tiene sentido en la Grieta (y no en URF); el KDA, en todos los modos.
  const cs =
    grieta && !esModoRapido(estado.rotativo) && estado.cs !== undefined
      ? {
          cs: estado.cs,
          porMinuto: minutos > 0 ? Math.round((estado.cs / minutos) * 10) / 10 : 0,
          objetivoPorMinuto: CS_OBJETIVO_POR_MINUTO[rol],
          cs10,
        }
      : null;
  const kda = estado.kda ? { ...estado.kda, ratio: ratioKda(estado.kda) } : null;
  return {
    tiempo: estado.tiempo,
    objetivos: objetivosBarra,
    proximaHabilidad: widgets.habilidad ? proximaHabilidad(estado, build) : null,
    rendimiento: cs || kda ? { cs, kda, kdaMedio: kdaMedioValido(build?.kda), oro: oroEnObjetos(estado, rol, objetos) } : null,
    compra: compra
      ? { id: compra.id, nombre: compra.nombre, coste: compra.costeRestante, puedeComprar: estado.oro >= compra.costeRestante }
      : null,
    version,
    modo: estado.modo ?? 'clasificatoria',
    widgets,
  };
}
