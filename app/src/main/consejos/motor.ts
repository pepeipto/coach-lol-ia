import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPartida, IdObjetivo, Indicacion, Panel } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import {
  ANCIANO_REAPARECE,
  ANCIANO_TRAS_ALMA,
  AVISO_OBJETIVO_ANTES,
  BARON,
  CAMPAMENTOS,
  DRAGON,
  DRAGONES_PARA_ALMA,
  ESCARABAJO,
  FASE_MEDIA_DESDE,
  FASE_TARDIA_DESDE,
  HERALDO,
  ID_GUARDIAN_CONTROL,
  LARVAS,
  OBJETIVOS_PLURALES,
  TIPO_ANCIANO,
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
  for (const e of muertes) {
    if (e.dragon === TIPO_ANCIANO) {
      ultimoAnciano = e.tiempo;
      continue;
    }
    ultimoElemental = e.tiempo;
    if (e.equipo && ++porEquipo[e.equipo] === DRAGONES_PARA_ALMA && alma === null) alma = e.tiempo;
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

    const puntos = Object.values(estado.habilidades).reduce((a, b) => a + b, 0);
    if (estado.nivel > puntos && puntos < build.ordenHabilidades.length) {
      salida.push({
        tipo: 'habilidad',
        clave: `habilidad:${puntos + 1}`,
        texto: t('aviso.habilidad', { nivel: puntos + 1, habilidad: build.ordenHabilidades[puntos] }),
      });
    }
  }

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

/** Habilidad del siguiente punto según el orden de la build (mismo criterio que el aviso de habilidad). */
function proximaHabilidad(estado: EstadoPartida, build: Build | null): Panel['proximaHabilidad'] {
  if (!build) return null;
  const puntos = Object.values(estado.habilidades).reduce((a, b) => a + b, 0);
  return build.ordenHabilidades[puntos] ?? null;
}

export function resumenPanel(estado: EstadoPartida, build: Build | null, objetos: Objetos, version = ''): Panel {
  let proximaCompra: string | null = null;
  let compraId: number | null = null;
  if (build) {
    const compra = siguienteCompra(estado, build, objetos);
    if (compra) {
      proximaCompra = t('panel.compra', { objeto: compra.nombre, oro: compra.costeRestante });
      compraId = compra.id;
    }
  }

  const todos = estadosObjetivos(estado);
  // El épico más cercano: los ya disponibles cuentan como distancia 0 (empate: orden de la lista).
  let cercano: EstadoObjetivo | null = null;
  for (const e of todos) {
    if (!e.epico) continue;
    if (!cercano || Math.max(0, e.restante) < Math.max(0, cercano.restante)) cercano = e;
  }

  return {
    proximaCompra,
    proximoObjetivo: cercano ? textoObjetivo(cercano) : null,
    proximaHabilidad: proximaHabilidad(estado, build),
    objetivos: todos.map((e) => ({
      id: e.id,
      nombre: t(`objetivoCorto.${e.id}`),
      aparece: e.disponible ? null : Math.ceil(e.restante),
      disponible: e.disponible,
    })),
    compraId,
    version,
  };
}
