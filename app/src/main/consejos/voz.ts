import type { Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { AjustesVoz, EstadoOverlay, EstadoPartida, FraseVoz, ObjetivoEstado, TipoVoz } from '../../shared/tiposApp';
import { AVISO_JUNGLA_ANTES, CAMPAMENTOS_JUNGLA, restanteMarca, type MarcasJungla } from './jungla';
import { claveProximoDragon } from './motor';
import {
  BARON,
  DRAGON,
  FASE_MEDIA_DESDE,
  FASE_TARDIA_DESDE,
  HERALDO,
  ID_GUARDIAN_CONTROL,
  LARVAS,
  VISION_DESDE,
  VISION_ORO_MINIMO,
} from './objetivos';

/** Prioridad de cada frase (menor = más urgente): un objetivo que acaba de salir va antes que un consejo. */
export const PRIORIDAD_VOZ = {
  objetivoYa: 0,
  objetivo30: 1,
  jungla: 1,
  objetivo60: 2,
  habilidad: 3,
  compra: 4,
  cs: 5,
  vision: 6,
  fase: 7,
} as const;

/** Milisegundos tras los que una frase ya no tiene sentido (la cola la descarta sin decirla). */
export const CADUCIDAD_VOZ = {
  objetivoYa: 8_000,
  objetivo30: 8_000,
  jungla: 8_000,
  objetivo60: 15_000,
  habilidad: 10_000,
  compra: 15_000,
  cs: 20_000,
  vision: 20_000,
  fase: 30_000,
} as const;

/** Al entrar a una partida ya empezada (reconexión), lo que ya estaba pasando no se dice de golpe. */
export const ENTRADA_TARDIA_S = 90;
export const CS_POR_DEBAJO = 0.85;
export const VISION_CADA_S = 300;

const EVENTO_OBJETIVO: Record<ObjetivoEstado['id'], string | null> = {
  dragon: DRAGON.evento,
  anciano: DRAGON.evento,
  larvas: LARVAS.evento,
  heraldo: HERALDO.evento,
  baron: BARON.evento,
};
const PLURALES = new Set<ObjetivoEstado['id']>(['larvas']);

export interface EntradaVoz {
  estado: EstadoPartida;
  overlay: EstadoOverlay;
  rol: Rol;
  marcas: MarcasJungla;
  /** Widget de la jungla activo (sin él no se avisa de los campamentos). */
  jungla: boolean;
}

type Clave = keyof typeof PRIORIDAD_VOZ;
const frase = (tipo: TipoVoz, clave: string, texto: string, de: Clave): FraseVoz => ({
  tipo,
  clave,
  texto,
  prioridad: PRIORIDAD_VOZ[de],
  caducaMs: CADUCIDAD_VOZ[de],
});

function nombreObjetivo(o: ObjetivoEstado, estado: EstadoPartida): string {
  if (o.id === 'dragon') {
    const tipo = claveProximoDragon(estado);
    if (tipo) return t(`voz.dragon.${tipo}`);
  }
  return t(`objetivo.${o.id}`);
}

function frasesObjetivos(e: EntradaVoz): FraseVoz[] {
  const salida: FraseVoz[] = [];
  for (const o of e.overlay.objetivos) {
    // Cada muerte del objetivo abre una «generación» nueva: su reaparición se vuelve a anunciar.
    const evento = EVENTO_OBJETIVO[o.id];
    const generacion = evento ? e.estado.eventos.filter((x) => x.nombre === evento).length : 0;
    const base = `objetivo:${o.id}:${generacion}`;
    const plural = PLURALES.has(o.id) ? 'Plural' : '';
    const objetivo = nombreObjetivo(o, e.estado);
    if (o.disponible) salida.push(frase('objetivo', `${base}:ya`, t(`voz.objetivoYa${plural}`, { objetivo }), 'objetivoYa'));
    else if (o.aparece !== null && o.aparece <= 30) salida.push(frase('objetivo', `${base}:30`, t(`voz.objetivo30${plural}`, { objetivo }), 'objetivo30'));
    else if (o.aparece !== null && o.aparece <= 60) salida.push(frase('objetivo', `${base}:60`, t(`voz.objetivo60${plural}`, { objetivo }), 'objetivo60'));
  }
  return salida;
}

function fase(tiempo: number): 'temprana' | 'media' | 'tardia' {
  if (tiempo < FASE_MEDIA_DESDE) return 'temprana';
  if (tiempo < FASE_TARDIA_DESDE) return 'media';
  return 'tardia';
}

/** Todas las frases que tocarían ahora; el disparador decide cuáles son nuevas. */
function candidatas(e: EntradaVoz): FraseVoz[] {
  const { estado, overlay } = e;
  const salida = frasesObjetivos(e);

  if (e.jungla) {
    for (const c of CAMPAMENTOS_JUNGLA) {
      const restante = restanteMarca(e.marcas, c.id, estado.tiempo);
      if (restante !== null && restante > 0 && restante <= AVISO_JUNGLA_ANTES) {
        const campamento = t(`jungla.voz.${c.id}`);
        salida.push(frase('jungla', `jungla:${c.id}:${e.marcas[c.id]}`, t('voz.jungla', { campamento }), 'jungla'));
      }
    }
  }

  if (overlay.proximaHabilidad) {
    const puntos = Object.values(estado.habilidades).reduce((a, b) => a + b, 0);
    salida.push(frase('habilidad', `habilidad:${puntos + 1}`, t('voz.habilidad', { habilidad: overlay.proximaHabilidad }), 'habilidad'));
  }
  if (overlay.compra?.puedeComprar) {
    salida.push(frase('compra', `compra:${overlay.compra.id}`, t('voz.compra', { objeto: overlay.compra.nombre }), 'compra'));
  }
  const cs = overlay.cs;
  if (cs && cs.cs10 !== null && cs.cs10 < cs.objetivoPorMinuto * 10 * CS_POR_DEBAJO) {
    salida.push(frase('cs', 'cs10', t('voz.cs'), 'cs'));
  }
  if (estado.tiempo >= VISION_DESDE && !estado.objetos.includes(ID_GUARDIAN_CONTROL) && estado.oro >= VISION_ORO_MINIMO) {
    salida.push(frase('vision', `vision:${Math.floor(estado.tiempo / VISION_CADA_S)}`, t('voz.vision'), 'vision'));
  }
  const f = fase(estado.tiempo);
  salida.push(frase('fase', `fase:${f}`, t(`fase.${e.rol}.${f}`), 'fase'));
  return salida;
}

/**
 * Decide qué frases de voz son nuevas en cada estado. Cada frase (por su clave) se dice una sola
 * vez por partida. Con la voz o el tipo apagados la frase se da igualmente por dicha, para que al
 * encender la voz no salga de golpe lo que ya pasó.
 */
export class DisparadorVoz {
  private dichas = new Set<string>();
  private primero = true;

  procesar(entrada: EntradaVoz, voz: AjustesVoz): FraseVoz[] {
    const callar = this.primero && entrada.estado.tiempo > ENTRADA_TARDIA_S;
    this.primero = false;
    const nuevas: FraseVoz[] = [];
    for (const f of candidatas(entrada)) {
      if (this.dichas.has(f.clave)) continue;
      this.dichas.add(f.clave);
      if (!callar && voz.activa && voz.tipos[f.tipo]) nuevas.push(f);
    }
    return nuevas.sort((a, b) => a.prioridad - b.prioridad);
  }

  reiniciar(): void {
    this.dichas.clear();
    this.primero = true;
  }
}
