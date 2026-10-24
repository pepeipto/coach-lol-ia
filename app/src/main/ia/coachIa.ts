import type { Build, IdiomaIa, ModoJuego, Rol } from '@coach/shared';
import type { Ajustes, AvisoOverlay, EntradaAnalisis, EstadoAnalisis, EstadoOverlay, EstadoPartida, FraseVoz } from '../../shared/tiposApp';
import type { ClienteLcu } from '../lcu/cliente';
import { registrar } from '../log';
import { PRIORIDAD_VOZ } from '../consejos/voz';
import { pedirAnalisis, pedirConsejo } from './clienteIa';
import type { HistorialAnalisis } from './historial';
import { DetectorMomentos } from './momentos';
import { RegistroPartida } from './registro';
import { leerEog, peticionAnalisis, peticionConsejo, type EstadisticasEog } from './resumen';

/*
 * Coach con IA (3.2). Une el registro de la partida, los momentos muertos y el fin de la partida:
 * - con cada estado de la Live Client Data API apunta la línea de tiempo y, si toca un momento muerto, pide un
 *   consejo al servidor, que suena por la cola de voz (siempre con la voz natural) y, si el jugador encendió los
 *   avisos en pantalla, sale como una línea discreta en el overlay;
 * - al terminar (fase PreEndOfGame o EndOfGame de la LCU) lee las estadísticas de fin de partida, pide el análisis,
 *   lo guarda en el historial local y lo avisa (notificación, insignia y, si se quiere, voz).
 */

export const ENDPOINT_EOG = '/lol-end-of-game/v1/eog-stats-block';
/** Por debajo de esto (remake, abandono al principio) no hay análisis. */
export const DURACION_MINIMA_S = 300;
/** Lo que dura en la cola de voz un consejo que no pudo sonar a tiempo. */
const CADUCA_CONSEJO_MS = 20_000;

export interface ContextoIa {
  build: Build | null;
  rol: Rol | null;
  objetos: Record<number, { name?: string; gold?: { total: number } }>;
  version?: string;
  modo?: ModoJuego;
  /** 3.8: cola de una normal de la Grieta o de un modo rotativo (para nombrarla en el historial de análisis). */
  cola?: number;
}

export interface DependenciasCoachIa {
  ajustes: () => Ajustes;
  idioma: () => IdiomaIa;
  urlServidor: () => string;
  fetch?: typeof fetch;
  lcu: () => ClienteLcu | null;
  /** Contexto de la selección (build, rol y objetos de Data Dragon). */
  contexto: () => Promise<ContextoIa | null>;
  /** Nombre del campeón en el idioma de la app (Data Dragon), si se sabe. */
  nombreCampeon?: (id: string) => string | undefined;
  historial: HistorialAnalisis;
  enviarVoz: (f: FraseVoz) => void;
  enviarAviso: (a: AvisoOverlay) => void;
  /** Marca un texto dinámico para que la voz lo diga con la natural, nunca con la pregrabada. */
  marcarDinamica: (texto: string) => void;
  /** Avisa de un estado nuevo del análisis (vista «Análisis», notificación, insignia y voz). */
  alAnalisis: (e: { estado: EstadoAnalisis; entrada?: EntradaAnalisis }) => void;
  ahora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  /** Intentos para leer las estadísticas de fin de partida (pueden tardar unos segundos en estar). */
  intentosEog?: number;
}

const esperarReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function crearCoachIa(dep: DependenciasCoachIa) {
  const ahora = dep.ahora ?? Date.now;
  const esperar = dep.esperar ?? esperarReal;
  let registro: RegistroPartida | null = null;
  let ultimoContexto: ContextoIa | null = null;
  const detector = new DetectorMomentos();
  let consejoEnCurso = false;
  let analizada = false;
  let estadoAnalisis: EstadoAnalisis = { estado: 'inactivo' };
  let contador = 0;

  const precioDe = (id: number) => ultimoContexto?.objetos[id]?.gold?.total ?? 0;

  function avisar(estado: EstadoAnalisis, entrada?: EntradaAnalisis): void {
    estadoAnalisis = estado;
    dep.alAnalisis(entrada ? { estado, entrada } : { estado });
  }

  async function pedirConsejoAhora(estado: EstadoPartida, resumen: EstadoOverlay | null, momento: ReturnType<DetectorMomentos['procesar']> & string): Promise<void> {
    consejoEnCurso = true;
    try {
      const ctx = ultimoContexto;
      const p = peticionConsejo(estado, resumen, momento, {
        idioma: dep.idioma(),
        modo: estado.modo ?? 'clasificatoria',
        // El rol de la selección solo vale si hubo selección con build (si no, es un valor por defecto).
        rol: ctx?.build ? ctx.rol : null,
        objetos: ctx?.objetos ?? {},
      }, registro?.objetivos ?? []);
      const r = await pedirConsejo(p, { urlServidor: dep.urlServidor(), fetch: dep.fetch });
      if (!r.ok) {
        registrar('info', `Consejo con IA no disponible (${r.error})`);
        return;
      }
      const ajustes = dep.ajustes();
      registrar('info', `Consejo con IA (${momento})`);
      if (ajustes.overlay.voz.activa) {
        dep.marcarDinamica(r.datos);
        dep.enviarVoz({ tipo: momento === 'tienda' ? 'economia' : momento === 'objetivo' ? 'objetivo' : 'muerte', clave: `consejoIa:${++contador}`, texto: r.datos, prioridad: PRIORIDAD_VOZ.compra, caducaMs: CADUCA_CONSEJO_MS });
      }
      // Línea discreta en el overlay solo con los avisos en pantalla encendidos (vienen apagados por defecto).
      if (ajustes.overlay.widgets.avisos.activo) dep.enviarAviso({ texto: r.datos, voz: false });
    } finally {
      consejoEnCurso = false;
    }
  }

  async function leerEstadisticas(): Promise<EstadisticasEog | null> {
    const intentos = dep.intentosEog ?? 4;
    for (let i = 0; i < intentos; i++) {
      const lcu = dep.lcu();
      if (!lcu) return null;
      try {
        const eog = leerEog(await lcu.peticion('GET', ENDPOINT_EOG));
        if (eog) return eog;
      } catch {
        // aún no están (404) o el cliente se cerró: se reintenta
      }
      if (i < intentos - 1) await esperar(2500);
    }
    return null;
  }

  async function analizar(r: RegistroPartida): Promise<void> {
    const eog = await leerEstadisticas();
    const ctx = (await dep.contexto().catch(() => null)) ?? ultimoContexto;
    const u = r.ultimo!;
    const modo = u.modo ?? ctx?.modo ?? 'clasificatoria';
    const p = peticionAnalisis(r, eog, {
      idioma: dep.idioma(),
      modo,
      build: ctx?.build ?? null,
      rol: ctx?.build ? ctx.rol : null,
      objetos: ctx?.objetos ?? {},
      nombreCampeon: dep.nombreCampeon?.(u.campeon),
    });
    if (!p) return;
    if (p.duracion < DURACION_MINIMA_S) {
      registrar('info', `Partida de ${p.duracion} s: demasiado corta para analizarla`);
      return;
    }
    avisar({ estado: 'analizando' });
    registrar('info', `Pidiendo el análisis con IA (${modo}, ${p.campeon}, ${p.linea.length} min)`);
    const respuesta = await pedirAnalisis(p, { urlServidor: dep.urlServidor(), fetch: dep.fetch });
    if (!respuesta.ok) {
      registrar('aviso', `Análisis con IA no disponible (${respuesta.error})`);
      avisar({ estado: 'error', error: respuesta.error });
      return;
    }
    const entrada: EntradaAnalisis = {
      id: `${ahora()}-${p.campeon}`,
      fecha: new Date(ahora()).toISOString(),
      modo: p.modo,
      campeon: p.campeon,
      ...(p.nombreCampeon ? { nombreCampeon: p.nombreCampeon } : {}),
      rol: p.rol,
      resultado: p.resultado,
      duracion: p.duracion,
      final: p.final,
      linea: p.linea,
      muertes: p.muertes,
      objetivos: p.objetivos,
      csObjetivoMinuto: p.csObjetivoMinuto,
      analisis: respuesta.datos,
      ...(ctx?.version ? { version: ctx.version } : {}),
      ...(ctx?.cola ? { cola: ctx.cola } : {}),
    };
    try {
      dep.historial.agregar(entrada);
    } catch (e) {
      registrar('error', `No se pudo guardar el análisis: ${e instanceof Error ? e.message : String(e)}`);
    }
    avisar({ estado: 'listo', id: entrada.id }, entrada);
  }

  /** Fase de la LCU: al terminar la partida se analiza (una vez); al empezar otra, el registro se tira. */
  /** Fase de la LCU: al terminar la partida se analiza (una vez); al empezar otra, el registro se tira. */
  async function fase(f: string): Promise<void> {
    if (f === 'PreEndOfGame' || f === 'EndOfGame' || f === 'WaitingForStats') {
      const r = registro;
      if (f === 'WaitingForStats' || analizada || !r?.conDatos) return;
      analizada = true;
      if (!dep.ajustes().ia.analisis) return;
      try {
        await analizar(r);
      } catch (e) {
        registrar('error', `Error en el análisis con IA: ${e instanceof Error ? e.message : String(e)}`);
        avisar({ estado: 'error', error: 'no_disponible' });
      }
    } else if (f === 'ChampSelect' || f === 'GameStart' || f === 'Lobby' || f === 'Matchmaking') {
      // Lo de la partida anterior ya no hace falta (el análisis, si lo hubo, ya tiene su copia).
      registro = null;
      analizada = false;
      detector.reiniciar();
    }
  }

  return {
    /** Cada estado de la partida, con el resumen del overlay (objetivos) y el contexto de la selección. */
    alEstado(estado: EstadoPartida, resumen: EstadoOverlay | null, ctx: ContextoIa | null): void {
      if (ctx) ultimoContexto = ctx;
      // Una partida nueva (o la primera): registro nuevo.
      if (!registro || (registro.ultimo && estado.tiempo + 60 < registro.ultimo.tiempo)) {
        registro = new RegistroPartida(precioDe);
        analizada = false;
        detector.reiniciar();
      }
      registro.procesar(estado);
      const ajustes = dep.ajustes();
      // Sin cliente de LoL conectado (simulador o COACH_FORZAR_PARTIDA) no llegan las fases: el evento GameEnd de la
      // Live Client marca el final y se analiza sin las estadísticas de la LCU.
      if (registro.resultado && !dep.lcu()) void fase('EndOfGame');
      const momento = detector.procesar(estado, resumen, ajustes.ia.consejos ? ajustes.ia.maxConsejos : 0);
      // Sin voz ni avisos en pantalla, el consejo no se oiría ni se vería: no se pide.
      const seOiria = ajustes.overlay.voz.activa || ajustes.overlay.widgets.avisos.activo;
      if (momento && ajustes.ia.consejos && seOiria && !consejoEnCurso) void pedirConsejoAhora(estado, resumen, momento);
    },
    fase,
    estado: (): EstadoAnalisis => estadoAnalisis,
    historial: () => dep.historial.lista(),
    /** Pruebas: consejos dados en la partida. */
    get consejosDados() {
      return detector.dados;
    },
  };
}

export type CoachIa = ReturnType<typeof crearCoachIa>;
