import type { ModoJuego } from '@coach/shared';
import { esGrieta } from './modosOverlay';
import type { AjustesVoz, TipoVoz } from './tiposApp';

/*
 * 3.18: «modo enfoque» de la voz (idea de un streamer que la probó: «que me diga solo una cosa para ir asimilando»).
 * Se elige un único aspecto que mejorar y, en la Grieta, la voz solo dice las frases de ese aspecto; todo lo demás
 * calla aunque su categoría esté encendida. Sin enfoque (por defecto), mandan los interruptores de categorías.
 * Los avisos siguen siendo informativos (qué pasa y cuándo), nunca órdenes que decidan por el jugador.
 */

export type EnfoqueVoz = 'objetivos' | 'vision' | 'farmeo' | 'linea' | 'supervivencia';

/** Enfoques en el orden de la vista Overlay. */
export const ENFOQUES_VOZ: readonly EnfoqueVoz[] = ['objetivos', 'vision', 'farmeo', 'linea', 'supervivencia'];

export const esEnfoqueVoz = (x: unknown): x is EnfoqueVoz => typeof x === 'string' && (ENFOQUES_VOZ as readonly string[]).includes(x);

interface DefinicionEnfoque {
  /** Bases de frase (clave de i18n sin el número de variante) que se dicen; acaban en «.» para todo un grupo. */
  bases: readonly string[];
  /** Categorías que se dicen enteras (las que no tienen base propia, como el jungla enemigo). */
  tipos?: readonly TipoVoz[];
  /** Aviso propio minuto y medio antes de cada objetivo épico (voz.enfoque.<enfoque>.preparar). */
  avisoPrevio?: boolean;
}

/** Siempre: la frase de inicio que confirma el enfoque elegido. */
const COMUNES = ['voz.enfoque.'];

/** Bases de las frases de la cuenta atrás de un objetivo, salvo la de un minuto (el aviso previo ya la cubre). */
const OBJETIVO_30_O_YA = /^voz\.obj\.\w+\.(30|ya)$/;

export const DEFINICION_ENFOQUES: Record<EnfoqueVoz, DefinicionEnfoque> = {
  // Disputa y visión antes de los objetivos: el aviso de minuto y medio, la cuenta atrás corta y quién se lo lleva.
  objetivos: {
    bases: ['voz.obj.', 'voz.tomado.', 'voz.robo.', 'voz.vision.control', 'voz.vision.trasCompra', 'voz.macro.lente'],
    avisoPrevio: true,
  },
  vision: {
    bases: ['voz.vision.', 'voz.macro.lente'],
    avisoPrevio: true,
  },
  farmeo: {
    bases: ['voz.cs.', 'voz.macro.cs.', 'voz.macro.canon.', 'voz.economia.', 'voz.ritmoObjetos.', 'voz.compra', 'voz.macro.placas', 'voz.jungla'],
  },
  linea: {
    bases: [
      'voz.habilidad',
      'voz.nivel.',
      'voz.macro.nivel2',
      'voz.macro.rival6',
      'voz.macro.hechizoRival.',
      'voz.macro.ventajaNivel',
      'voz.macro.cs.',
      'voz.macro.rivalMuerto.',
      'voz.macro.canon.',
      'voz.cs.',
    ],
  },
  // Morir menos: qué ha pasado al morir, cuándo conviene volver a base, el rival que se hace fuerte y el jungla enemigo.
  supervivencia: {
    bases: [
      'voz.muerte.',
      'voz.macro.repetido',
      'voz.macro.backVida',
      'voz.macro.backMana',
      'voz.macro.desventaja',
      'voz.macro.primerGank',
      'voz.macro.rival6',
      'voz.macro.hechizoRival.',
      'voz.spike.',
    ],
    tipos: ['junglaEnemiga'],
  },
};

const coincide = (base: string, patron: string) => (patron.endsWith('.') ? base.startsWith(patron) : base === patron);

/** Si una frase (por su categoría y su base) entra en un enfoque. */
export function fraseEnEnfoque(enfoque: EnfoqueVoz, tipo: TipoVoz, base?: string): boolean {
  const d = DEFINICION_ENFOQUES[enfoque];
  if (d.tipos?.includes(tipo)) return true;
  if (!base) return false;
  if (base.startsWith('voz.obj.')) return enfoque === 'objetivos' && OBJETIVO_30_O_YA.test(base);
  return [...COMUNES, ...d.bases].some((p) => coincide(base, p));
}

/** El enfoque que manda en esta partida: solo en la Grieta (en ARAM y Arena no hay líneas ni objetivos que preparar). */
export function enfoqueActivo(voz: Pick<AjustesVoz, 'enfoque'>, modo: ModoJuego | undefined): EnfoqueVoz | null {
  return voz.enfoque && esGrieta(modo) ? voz.enfoque : null;
}

/**
 * Si la voz dice una frase: con un enfoque activo, solo las del enfoque; sin él, la categoría encendida.
 * No mira si la voz está activa ni el modo de juego de cada categoría (eso lo sigue haciendo quien llama).
 */
export function vozDiceFrase(voz: Pick<AjustesVoz, 'tipos' | 'enfoque'>, tipo: TipoVoz, base: string | undefined, modo: ModoJuego | undefined): boolean {
  const enfoque = enfoqueActivo(voz, modo);
  return enfoque ? fraseEnEnfoque(enfoque, tipo, base) : !!voz.tipos[tipo];
}
