import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { AjustesVoz, EstadoOverlay, EstadoPartida, JugadorCarga, ObjetivoEstado } from '../../shared/tiposApp';
import type { DatosEstaticos } from '../datos/estaticos';
import { AVISO_JUNGLA_ANTES, CAMPAMENTOS_JUNGLA, restanteMarca, type MarcasJungla } from './jungla';
import { claveProximoDragon } from './motor';
import { vozEnPartida } from '../../shared/modosOverlay';
import { BARON, DRAGON, FASE_MEDIA_DESDE, FASE_TARDIA_DESDE, HERALDO, ID_GUARDIAN_CONTROL, LARVAS, VISION_DESDE, VISION_ORO_MINIMO } from './objetivos';
import type { FraseRegulada } from './regulador';
import { DetectorSpikes, SPIKE_CADA_MS, type Spike } from './spikes';
import { DetectorSucesos, type Candidata, type MomentoVoz } from './sucesos';
import { DetectorRitmoObjetos, RITMO_CADA_MS } from './ritmoObjetos';
import { SelectorVariantes } from './variantes';

/** Prioridad de cada frase (menor = más urgente): un objetivo que acaba de salir va antes que un consejo. */
export const PRIORIDAD_VOZ: Record<MomentoVoz, number> = {
  objetivoYa: 0,
  objetivo30: 1,
  jungla: 1,
  junglaEnemiga: 1,
  combate: 1,
  objetivoTomado: 1,
  objetivo60: 2,
  estructura: 2,
  habilidad: 3,
  nivel: 3,
  reaparecer: 3,
  // 3.9: power spike del rival, prioridad media (como mucho uno cada SPIKE_CADA_MS).
  spike: 3,
  compra: 4,
  economia: 4,
  equipo: 4,
  animo: 4,
  cs: 5,
  muerte: 5,
  // 3.10: aviso suave de ritmo de objetos, prioridad baja (como mucho uno cada RITMO_CADA_MS).
  ritmoObjetos: 6,
  vision: 6,
  modo: 6,
  fase: 7,
};

/** Milisegundos tras los que una frase ya no tiene sentido (la cola la descarta sin decirla). */
export const CADUCIDAD_VOZ: Record<MomentoVoz, number> = {
  objetivoYa: 8_000,
  objetivo30: 8_000,
  jungla: 8_000,
  junglaEnemiga: 8_000,
  combate: 6_000,
  objetivoTomado: 8_000,
  objetivo60: 15_000,
  estructura: 12_000,
  habilidad: 10_000,
  nivel: 12_000,
  reaparecer: 8_000,
  spike: 15_000,
  ritmoObjetos: 30_000,
  compra: 15_000,
  economia: 25_000,
  equipo: 12_000,
  animo: 20_000,
  cs: 20_000,
  muerte: 20_000,
  vision: 20_000,
  modo: 30_000,
  fase: 30_000,
};

/** Al entrar a una partida ya empezada (reconexión), lo que ya estaba pasando no se dice de golpe. */
export const ENTRADA_TARDIA_S = 90;
export const VISION_CADA_S = 300;

const EVENTO_OBJETIVO: Record<ObjetivoEstado['id'], string | null> = {
  dragon: DRAGON.evento,
  anciano: DRAGON.evento,
  larvas: LARVAS.evento,
  heraldo: HERALDO.evento,
  baron: BARON.evento,
  inhibidor: null,
};

export interface EntradaVoz {
  estado: EstadoPartida;
  overlay: EstadoOverlay;
  rol: Rol;
  marcas: MarcasJungla;
  /** Widget de la jungla activo (sin él no se avisa de los campamentos). */
  jungla: boolean;
  /** 3.1: objetos de Data Dragon (objetos completados, botas, abalorio). */
  objetos?: DatosEstaticos['objetos'];
  /** 3.1: build de la selección (si lleva botas). */
  build?: Build | null;
  /** 3.1: jugadores de la pantalla de carga (roles, para el rival de línea). */
  carga?: JugadorCarga[] | null;
  /** 3.1: eventos que ya dijo el aviso del jungla enemigo (claveDe), para no repetirlos. */
  yaAvisados?: ReadonlySet<string>;
}

const cand = (tipo: Candidata['tipo'], clave: string, base: string, momento: MomentoVoz, o: Partial<Candidata> = {}): Candidata => ({
  tipo,
  clave,
  base,
  momento,
  ...o,
});

function frasesObjetivos(e: EntradaVoz): Candidata[] {
  const salida: Candidata[] = [];
  const tipoDragon = claveProximoDragon(e.estado);
  const dragon = t(`voz.dragonNombre.${tipoDragon ?? 'generico'}`);
  for (const o of e.overlay.objetivos) {
    // 3.5: los inhibidores solo se enseñan en la barra (no tienen frases de cuenta atrás).
    if (o.id === 'inhibidor') continue;
    // Cada muerte del objetivo abre una «generación» nueva: su reaparición se vuelve a anunciar. Las larvas son tres
    // (tres HordeKill): solo cuenta el campamento entero, para no volver a decir «han aparecido» tras cada larva.
    const evento = EVENTO_OBJETIVO[o.id];
    const muertes = evento ? e.estado.eventos.filter((x) => x.nombre === evento).length : 0;
    const generacion = Math.floor(muertes / (o.id === 'larvas' ? (LARVAS.muertes ?? 1) : 1));
    const base = `objetivo:${o.id}:${generacion}`;
    const params = o.id === 'dragon' ? { dragon } : undefined;
    // Las frases de un mismo objetivo se sustituyen mientras esperan (la cuenta atrás más reciente gana).
    const grupo = `objetivo:${o.id}`;
    if (o.disponible) salida.push(cand('objetivo', `${base}:ya`, `voz.obj.${o.id}.ya`, 'objetivoYa', { params, grupo }));
    else if (o.aparece !== null && o.aparece <= 30) salida.push(cand('objetivo', `${base}:30`, `voz.obj.${o.id}.30`, 'objetivo30', { params, grupo }));
    else if (o.aparece !== null && o.aparece <= 60) salida.push(cand('objetivo', `${base}:60`, `voz.obj.${o.id}.60`, 'objetivo60', { params, grupo }));
  }
  return salida;
}

function fase(tiempo: number): 'temprana' | 'media' | 'tardia' {
  if (tiempo < FASE_MEDIA_DESDE) return 'temprana';
  if (tiempo < FASE_TARDIA_DESDE) return 'media';
  return 'tardia';
}

/** Cuentas atrás y consejos que dependen solo del estado actual; el disparador decide cuáles son nuevas. */
function candidatas(e: EntradaVoz): Candidata[] {
  const { estado, overlay } = e;
  const salida = frasesObjetivos(e);

  if (e.jungla) {
    for (const c of CAMPAMENTOS_JUNGLA) {
      const restante = restanteMarca(e.marcas, c.id, estado.tiempo);
      if (restante !== null && restante > 0 && restante <= AVISO_JUNGLA_ANTES) {
        const campamento = t(`jungla.voz.${c.id}`);
        salida.push(cand('jungla', `jungla:${c.id}:${e.marcas[c.id]}`, 'voz.jungla', 'jungla', { params: { campamento } }));
      }
    }
  }

  if (overlay.proximaHabilidad) {
    const puntos = Object.values(estado.habilidades).reduce((a, b) => a + b, 0);
    salida.push(cand('habilidad', `habilidad:${puntos + 1}`, 'voz.habilidad', 'habilidad', { params: { habilidad: overlay.proximaHabilidad }, grupo: 'habilidad' }));
  }
  if (overlay.compra?.puedeComprar) {
    salida.push(cand('compra', `compra:${overlay.compra.id}`, 'voz.compra', 'compra', { params: { objeto: overlay.compra.nombre }, grupo: 'compra' }));
  }
  if (estado.tiempo >= VISION_DESDE && !estado.objetos.includes(ID_GUARDIAN_CONTROL) && estado.oro >= VISION_ORO_MINIMO) {
    salida.push(
      cand('vision', `vision:${Math.floor(estado.tiempo / VISION_CADA_S)}`, 'voz.vision.control', 'vision', { grupo: 'vision.control', enfriamientoMs: 240_000 }),
    );
  }
  const f = fase(estado.tiempo);
  salida.push(cand('fase', `fase:${f}`, `voz.fase.${e.rol}.${f}`, 'fase'));
  return salida;
}

/**
 * Decide qué frases de voz son nuevas en cada estado. Cada frase (por su clave) se dice una sola vez por partida; la
 * fase, solo cuando cambia. Cada situación tiene de 3 a 6 variantes y se elige una al azar sin repetir la anterior
 * (variantes.ts). Con la voz o la categoría apagadas la frase se da igualmente por dicha, para que al encender la voz
 * no salga de golpe lo que ya pasó. Cuándo suena cada frase lo decide después ReguladorVoz (regulador.ts).
 */
export class DisparadorVoz {
  private dichas = new Set<string>();
  private primero = true;
  private readonly selector: SelectorVariantes;
  private readonly sucesos = new DetectorSucesos();
  private readonly spikes = new DetectorSpikes();
  private readonly ritmo = new DetectorRitmoObjetos();
  /** 3.9: objetos clave que los enemigos vigilados acaban de completar en el último estado (para el aviso del overlay). */
  ultimosSpikes: Spike[] = [];

  /** El selector de variantes (al azar sin repetir la anterior) se puede sustituir en las pruebas. */
  constructor(o: { selector?: SelectorVariantes } = {}) {
    this.selector = o.selector ?? new SelectorVariantes();
  }

  procesar(entrada: EntradaVoz, voz: AjustesVoz): FraseRegulada[] {
    const primero = this.primero;
    const callar = primero && entrada.estado.tiempo > ENTRADA_TARDIA_S;
    this.primero = false;
    const nuevas: FraseRegulada[] = [];
    this.ultimosSpikes = this.spikes.procesar(entrada, primero);
    const spikes = this.ultimosSpikes.map((s) =>
      cand('spike', `spike:${s.campeon}:${s.objeto}`, `voz.spike.${s.efecto}`, 'spike', {
        params: { campeon: s.nombreCampeon, objeto: s.nombreObjeto },
        grupo: 'spike',
        enfriamientoMs: SPIKE_CADA_MS,
      }),
    );
    // 3.10: tu 1.er o 2.º objeto, 3 minutos o más tarde que en las partidas ganadas (ritmoObjetos.ts).
    const ritmo = this.ritmo.procesar(entrada, primero).map((r) =>
      cand('ritmoObjetos', `ritmoObjetos:${r.objeto}`, `voz.ritmoObjetos.objeto${r.objeto}`, 'ritmoObjetos', {
        grupo: 'ritmoObjetos',
        enfriamientoMs: RITMO_CADA_MS,
      }),
    );
    for (const c of [...candidatas(entrada), ...this.sucesos.procesar(entrada, primero), ...spikes, ...ritmo]) {
      if (this.dichas.has(c.clave)) continue;
      this.dichas.add(c.clave);
      // La fase solo se dice al cambiar, no la de partida al empezar (o al reconectar).
      if (primero && c.tipo === 'fase') continue;
      // Fuera de la Grieta solo se dicen las categorías del modo (ver vozEnModo); en un rotativo, sin lo que no aplica.
      if (callar || !voz.activa || !voz.tipos[c.tipo] || !vozEnPartida(c.tipo, entrada.estado.modo, entrada.estado.rotativo)) continue;
      nuevas.push({
        tipo: c.tipo,
        clave: c.clave,
        texto: this.selector.texto(c.base, c.params),
        prioridad: PRIORIDAD_VOZ[c.momento],
        caducaMs: CADUCIDAD_VOZ[c.momento],
        ...(c.grupo ? { grupo: c.grupo } : {}),
        ...(c.enfriamientoMs ? { enfriamientoMs: c.enfriamientoMs } : {}),
      });
    }
    return nuevas.sort((a, b) => a.prioridad - b.prioridad);
  }

  /** Texto de una variante de `base` (para otras frases que comparten el selector, como las del jungla enemigo). */
  variante(base: string, params?: Record<string, string | number>): string {
    return this.selector.texto(base, params);
  }

  reiniciar(): void {
    this.dichas.clear();
    this.primero = true;
    this.selector.reiniciar();
    this.sucesos.reiniciar();
    this.spikes.reiniciar();
    this.ritmo.reiniciar();
    this.ultimosSpikes = [];
  }
}
