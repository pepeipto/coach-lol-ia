import type { Build, KdaMedio, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoOverlay, EstadoPartida, IdObjetivo, Indicacion, ObjetivoEstado } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import { habilidadQueSubir } from './habilidades';
import { avisoEnModo, esGrieta, widgetsDeModo } from '../../shared/modosOverlay';
import {
  ANCIANO_REAPARECE,
  ANCIANO_TRAS_ALMA,
  AVISO_OBJETIVO_ANTES,
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

  const f = fase(estado.tiempo);
  salida.push({ tipo: 'fase', clave: `fase:${f}`, texto: t(`fase.${rol}.${f}`) });

  return salida;
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
  const minutos = estado.tiempo / 60;
  // El CS (y su objetivo por rol) solo tiene sentido en la Grieta; el KDA, en todos los modos.
  const cs =
    grieta && estado.cs !== undefined
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
    rendimiento: cs || kda ? { cs, kda, kdaMedio: kdaMedioValido(build?.kda) } : null,
    compra: compra
      ? { id: compra.id, nombre: compra.nombre, coste: compra.costeRestante, puedeComprar: estado.oro >= compra.costeRestante }
      : null,
    version,
    modo: estado.modo ?? 'clasificatoria',
    widgets,
  };
}
