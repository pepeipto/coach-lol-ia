import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPartida, Indicacion, Panel } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import {
  AVISO_OBJETIVO_ANTES,
  FASE_MEDIA_DESDE,
  FASE_TARDIA_DESDE,
  ID_GUARDIAN_CONTROL,
  OBJETIVOS,
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
  objetivo: ObjetivoNeutral;
  aparicion: number;
  restante: number;
  /** Ya apareció y nadie lo ha matado desde entonces. */
  disponible: boolean;
}

function estadoObjetivo(o: ObjetivoNeutral, estado: EstadoPartida): EstadoObjetivo | null {
  const muertes = estado.eventos.filter((e) => e.nombre === o.evento);
  const ultima = muertes.reduce<number | null>((m, e) => (m === null || e.tiempo > m ? e.tiempo : m), null);
  let aparicion = o.aparece;
  if (ultima !== null) {
    if (o.reaparece === null) return null;
    aparicion = ultima + o.reaparece;
  }
  const restante = aparicion - estado.tiempo;
  return { objetivo: o, aparicion, restante, disponible: restante <= 0 };
}

function estadosObjetivos(estado: EstadoPartida): EstadoObjetivo[] {
  return OBJETIVOS.map((o) => estadoObjetivo(o, estado)).filter((x): x is EstadoObjetivo => x !== null);
}

function textoObjetivo(e: EstadoObjetivo): string {
  const objetivo = t(`objetivo.${e.objetivo.nombre}`);
  return e.disponible
    ? t('aviso.objetivoDisponible', { objetivo })
    : t('aviso.objetivoPronto', { objetivo, segundos: Math.ceil(e.restante) });
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

  for (const e of estadosObjetivos(estado)) {
    const pronto = e.restante > 0 && e.restante <= AVISO_OBJETIVO_ANTES;
    if (!pronto && !e.disponible) continue;
    salida.push({
      tipo: 'objetivo',
      clave: `objetivo:${e.objetivo.nombre}:${e.disponible ? 'disp' : 'pronto'}:${e.aparicion}`,
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

export function resumenPanel(estado: EstadoPartida, build: Build | null, objetos: Objetos): Panel {
  let proximaCompra: string | null = null;
  if (build) {
    const compra = siguienteCompra(estado, build, objetos);
    if (compra) proximaCompra = t('panel.compra', { objeto: compra.nombre, oro: compra.costeRestante });
  }

  // El más cercano: los ya disponibles cuentan como distancia 0 (empate: orden de OBJETIVOS).
  let cercano: EstadoObjetivo | null = null;
  for (const e of estadosObjetivos(estado)) {
    if (!cercano || Math.max(0, e.restante) < Math.max(0, cercano.restante)) cercano = e;
  }

  return { proximaCompra, proximoObjetivo: cercano ? textoObjetivo(cercano) : null };
}

