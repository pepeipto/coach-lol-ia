import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Ajustes, AvisoOverlay, EstadoCarga, EstadoJungla, EstadoOverlay, EstadoPartida, FraseVoz, IdCampamento, ModoOverlay, PanelAumentos } from '../../shared/tiposApp';
import { VisibilidadAumentos } from '../consejos/visibilidadAumentos';
import { CAMPAMENTOS_JUNGLA, estadoJungla, marcarCampamento, type MarcasJungla } from '../consejos/jungla';
import { FiltroAvisos } from '../consejos/antispam';
import { cs10Tras, generarIndicaciones, resumenOverlay } from '../consejos/motor';
import { AvisadorJunglaEnemiga } from '../consejos/junglaEnemiga';
import { CADUCIDAD_VOZ, DisparadorVoz, ENTRADA_TARDIA_S, PRIORIDAD_VOZ } from '../consejos/voz';
import { enPelea, ReguladorVoz, type FraseRegulada } from '../consejos/regulador';
import type { SelectorVariantes } from '../consejos/variantes';
import type { DatosEstaticos } from '../datos/estaticos';
import { registrar } from '../log';
import { esGrieta, vozEnModo } from '../../shared/modosOverlay';
import { leerModoVentana, type ModoVentana } from '../partida/modoVentana';
import { SEGUNDOS_PARTIDA_EMPEZADA } from '../partida/conector';

interface ConectorMinimo {
  on(evento: 'estado', cb: (estado: EstadoPartida) => void): unknown;
  /** Una consulta a la Live Client Data API falló (sin respuesta o sin datos válidos). */
  on(evento: 'fallo', cb: () => void): unknown;
  removeAllListeners(): unknown;
  iniciar(): void;
  detener(): void;
}

export interface ControlOverlay {
  mostrar(): void;
  ocultar(): void;
  alternar(): void;
  enviarEstado(estado: EstadoOverlay): void;
  enviarAviso(aviso: AvisoOverlay): void;
  enviarModo?(modo: ModoOverlay): void;
  enviarJungla?(jungla: EstadoJungla): void;
  enviarVoz?(frase: FraseVoz): void;
  /** 3.4: panel de aumentos de ARAM: Caos (null lo oculta). */
  enviarAumentos?(panel: PanelAumentos | null): void;
}

interface ContextoPartida {
  build: Build | null;
  rol: Rol;
  objetos: DatosEstaticos['objetos'];
  /** Versión de Data Dragon, para el icono de la próxima compra ('' si no se sabe). */
  version?: string;
}

interface Dependencias {
  crearConector: () => ConectorMinimo;
  overlay: ControlOverlay;
  obtenerAjustes: () => Ajustes;
  /** Build, rol y objetos de la selección actual; null si no hay datos de Data Dragon. */
  contexto: () => Promise<ContextoPartida | null>;
  /** Mensaje para la ventana principal (null lo borra). */
  avisar: (aviso: string | null) => void;
  /** Sustituibles en las pruebas. */
  leerModo?: (dirLol: string) => Promise<ModoVentana>;
  ahora?: () => number;
  filtro?: FiltroAvisos;
  /** Depuración: actúa como si hubiera llegado la fase InProgress sin cliente de LoL. Por defecto, COACH_FORZAR_PARTIDA=1. */
  forzarPartida?: boolean;
  /** true con el primer estado válido de la partida (el overlay ya se ve), false al terminar. */
  alCambiarPartida?: (activa: boolean) => void;
  /** Plan actual: el coach en partida (conector, overlay y voz) solo funciona con Premium. */
  esPremium: () => boolean;
  /** La pantalla de carga de esta partida (roles y, si se pidió, la ruta estimada del jungla enemigo); null si no hubo. */
  cargaActual?: () => EstadoCarga | null;
  /** La pantalla de carga se está enseñando: mientras el reloj no corra, el overlay de la partida no la sustituye. */
  cargaActiva?: () => boolean;
  /** 3.1: selector de variantes de las frases (al azar sin repetir la anterior); sustituible en las pruebas. */
  variantes?: () => SelectorVariantes;
  /**
   * 3.2: coach con IA. Recibe cada estado con el resumen del overlay (los objetivos y sus apariciones) y el contexto
   * de la selección: apunta la línea de tiempo para el análisis y decide los consejos de momentos muertos.
   */
  alEstadoIa?: (estado: EstadoPartida, resumen: EstadoOverlay, ctx: ContextoPartida & { tieneSeleccion: boolean }) => void;
  /** 3.4: tier list de aumentos de ARAM: Caos para un campeón (id de Data Dragon); null si no hay datos. */
  panelAumentos?: (campeon: string) => Promise<PanelAumentos | null>;
}

/** La ruta estimada del jungla enemigo (Track F2) se dice a los 0:30. */
export const RUTA_JUNGLA_EN_S = 30;

/** Fases en las que la partida sigue: cualquier otra la termina. */
const FASES_DE_PARTIDA = new Set(['InProgress', 'Reconnect']);

/**
 * Sin cliente de LoL (se cerró o se cayó en plena partida) no llega la fase que termina la partida: se da por
 * terminada tras estos fallos seguidos de la Live Client Data API (uno por segundo como mínimo).
 */
export const FALLOS_PARA_TERMINAR_SIN_LCU = 10;

/** Une la fase de juego, el conector de la partida, el motor de consejos, el antispam y el overlay. */
export function crearOrquestadorPartida(dep: Dependencias) {
  const filtro = dep.filtro ?? new FiltroAvisos();
  const disparador = new DisparadorVoz({ selector: dep.variantes?.() });
  /** 3.1: decide cuándo suena cada frase (urgentes ya; las demás, una cada pocos segundos y nunca en plena pelea). */
  const regulador = new ReguladorVoz();
  const avisadorJungla = new AvisadorJunglaEnemiga({ selector: dep.variantes?.() });
  /** La ruta estimada ya se dijo (o ya no toca) en esta partida. */
  let rutaHecha = false;
  const ahora = dep.ahora ?? Date.now;
  const leerModo = dep.leerModo ?? leerModoVentana;
  let dirLol: string | null = null;
  let conector: ConectorMinimo | null = null;
  /** El overlay solo sale con el primer estado válido: en TFT, en modos sin datos o como espectador nunca llega (ARAM, ARAM: Caos y Arena sí, con su propio panel). */
  let visible = false;
  /** Hay una partida en curso que no se sigue porque el plan es gratuito. */
  let bloqueada = false;
  /** CS en el primer estado a partir de las 10:00 (null hasta entonces). */
  let cs10: number | null = null;
  /** Campamentos marcados a mano y último estado (para saber el tiempo de partida al marcar). */
  let marcas: MarcasJungla = {};
  let ultimo: EstadoPartida | null = null;
  let recibidoEn = 0;
  /** El cliente de LoL se desconectó con la partida en curso: la partida sigue con la Live Client Data API. */
  let sinLcu = false;
  let fallosSeguidos = 0;
  /** 3.4: cuándo se ve el panel de aumentos (ARAM: Caos) y lo último que se envió. */
  const visibilidadAumentos = new VisibilidadAumentos();
  let aumentosEnviados = false;
  let panelCampeon: { campeon: string; panel: Promise<PanelAumentos | null> } | null = null;

  /** Envía (o retira) el panel de aumentos si cambió lo que debe verse. */
  async function enviarAumentos(visible: boolean, mio: ConectorMinimo | null): Promise<void> {
    const activo = dep.obtenerAjustes().overlay.widgets.aumentos?.activo !== false;
    const ver = visible && activo && !!ultimo && !!dep.panelAumentos;
    if (ver === aumentosEnviados) return;
    aumentosEnviados = ver;
    if (!ver) return dep.overlay.enviarAumentos?.(null);
    const campeon = ultimo!.campeon;
    if (panelCampeon?.campeon !== campeon) panelCampeon = { campeon, panel: dep.panelAumentos!(campeon).catch(() => null) };
    const panel = await panelCampeon.panel;
    if (conector !== mio || !aumentosEnviados) return;
    dep.overlay.enviarAumentos?.(panel);
  }

  /** La jungla solo existe en la Grieta: fuera (ARAM, ARAM: Caos y Arena) ni se envía ni se marca. */
  const junglaActiva = () => dep.obtenerAjustes().overlay.widgets.jungla.activo && esGrieta(ultimo?.modo);
  function enviarJungla(): void {
    if (ultimo && junglaActiva()) dep.overlay.enviarJungla?.(estadoJungla(marcas, ultimo.tiempo, ultimo.equipo));
  }

  function empezarAMostrar(mio: ConectorMinimo): void {
    if (visible) return;
    visible = true;
    dep.overlay.mostrar();
    dep.overlay.enviarModo?.('partida');
    dep.alCambiarPartida?.(true);
    void comprobarModo(mio);
  }

  async function alEstado(estado: EstadoPartida, mio: ConectorMinimo): Promise<void> {
    if (conector !== mio) return;
    fallosSeguidos = 0;
    // Con la pantalla de carga a la vista, la Live Client ya puede responder con el reloj parado (≈ 0 s): el
    // overlay de la partida (que además retira la carga) solo la sustituye cuando el reloj corre de verdad.
    if (!visible && dep.cargaActiva?.() && !(estado.tiempo > SEGUNDOS_PARTIDA_EMPEZADA)) return;
    empezarAMostrar(mio);
    try {
      const real = await dep.contexto();
      const ctx = real ?? { build: null, rol: 'MIDDLE' as Rol, objetos: {} };
      if (conector !== mio) return; // la partida terminó mientras se calculaba
      ultimo = estado;
      recibidoEn = ahora();
      cs10 = cs10Tras(cs10, estado);
      const resumen = resumenOverlay(estado, ctx.build, ctx.rol, ctx.objetos, ctx.version ?? '', cs10);
      dep.overlay.enviarEstado(resumen);
      const ajustes = dep.obtenerAjustes();
      // Jungla enemigo primero: lo que ya dice su aviso no se repite en las frases de objetivos y estructuras.
      const enemigo = junglaEnemiga(estado, ajustes);
      // Voz: frases nuevas de este estado; el regulador decide cuándo suenan y la cola del overlay las dice de una en una.
      const jungla = junglaActiva();
      const carga = dep.cargaActual?.()?.jugadores ?? null;
      const nuevas = disparador.procesar(
        { estado, overlay: resumen, rol: ctx.rol, marcas, jungla, objetos: ctx.objetos, build: ctx.build, carga, yaAvisados: enemigo.avisados },
        ajustes.overlay.voz,
      );
      for (const f of regulador.procesar([...enemigo.frases, ...nuevas], ahora(), enPelea(estado))) dep.overlay.enviarVoz?.(f);
      const aviso = filtro.procesar(generarIndicaciones(estado, ctx.build, ctx.rol, ctx.objetos), ahora(), ajustes.avisos);
      // Los avisos son solo visuales: la voz va por su propia cola de frases (overlay:voz).
      if (aviso && ajustes.overlay.widgets.avisos.activo) dep.overlay.enviarAviso({ texto: aviso.texto, voz: false, tipo: aviso.tipo });
      enviarJungla();
      void enviarAumentos(visibilidadAumentos.procesar(estado), mio);
      try {
        dep.alEstadoIa?.(estado, resumen, { ...ctx, tieneSeleccion: !!real?.build });
      } catch (e) {
        registrar('error', `Error en el coach con IA: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      registrar('error', `Error al generar los consejos: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Track F: avisos del jungla enemigo por los eventos oficiales de la partida (F1) y su ruta estimada a los 0:30 (F2).
   * Devuelve sus frases de voz (pasan por el regulador como las demás) y los eventos que dicen en voz alta.
   */
  function junglaEnemiga(estado: EstadoPartida, ajustes: Ajustes): { frases: FraseRegulada[]; avisados: Set<string> } {
    const frases: FraseRegulada[] = [];
    const avisados = new Set<string>();
    const carga = dep.cargaActual?.() ?? null;
    const voz = ajustes.overlay.voz;
    const decir = voz.activa && voz.tipos.junglaEnemiga;
    // Kills, objetivos y estructuras (eventos oficiales); el avisador ya se limita a la Grieta.
    for (const aviso of avisadorJungla.procesarTodos(estado, carga?.jugadores ?? null)) {
      if (!ajustes.junglaEnemiga.avisos) break;
      registrar('info', `Jungla enemigo: ${aviso.texto}`);
      if (ajustes.overlay.widgets.avisos.activo) dep.overlay.enviarAviso({ texto: aviso.texto, voz: false });
      if (decir) {
        frases.push(fraseJungla(aviso.clave, aviso.texto));
        avisados.add(aviso.clave.replace(/^junglaEnemiga:/, ''));
      }
    }
    if (!rutaHecha && estado.tiempo >= RUTA_JUNGLA_EN_S) {
      rutaHecha = true;
      const ruta = carga?.rutaJungla;
      // Al entrar tarde (reconexión) ya no se dice.
      // Solo en la Grieta (vozEnModo): en ARAM, ARAM: Caos y Arena no hay jungla.
      if (ruta && ajustes.junglaEnemiga.ruta && decir && vozEnModo('junglaEnemiga', estado.modo) && estado.tiempo < ENTRADA_TARDIA_S) {
        frases.push(fraseJungla(`rutaJungla:${ruta.campeon}`, ruta.texto));
      }
    }
    return { frases, avisados };
  }

  async function comprobarModo(mio: ConectorMinimo): Promise<void> {
    if (!dirLol) return;
    const modo = await leerModo(dirLol);
    if (conector === mio && modo === 'pantalla_completa') dep.avisar(t('aviso.pantallaCompleta'));
  }

  /** Empieza a seguir la partida si el plan lo permite; si no, lo avisa en la ventana principal. */
  function intentarIniciar(): void {
    if (conector) return;
    if (!dep.esPremium()) {
      if (!bloqueada) {
        bloqueada = true;
        dep.avisar(t('premium.coachBloqueado'));
      }
      return;
    }
    if (bloqueada) {
      bloqueada = false;
      dep.avisar(null);
    }
    iniciar();
  }

  function iniciar(): void {
    const mio = dep.crearConector();
    conector = mio;
    mio.on('estado', (estado) => void alEstado(estado, mio));
    mio.on('fallo', () => alFallo(mio));
    mio.iniciar();
  }

  /** Sin cliente de LoL, varios fallos seguidos de la Live Client Data API terminan la partida. */
  function alFallo(mio: ConectorMinimo): void {
    if (conector !== mio || !sinLcu) return;
    if (++fallosSeguidos < FALLOS_PARA_TERMINAR_SIN_LCU) return;
    registrar('info', 'Sin cliente de LoL y sin respuesta de la partida: se da por terminada');
    detener();
  }

  function detener(): void {
    if (bloqueada) {
      bloqueada = false;
      dep.avisar(null);
    }
    sinLcu = false;
    fallosSeguidos = 0;
    if (!conector) return;
    conector.detener();
    conector.removeAllListeners();
    conector = null;
    dep.avisar(null);
    dep.overlay.enviarModo?.('oculto');
    dep.overlay.ocultar();
    filtro.reiniciar();
    disparador.reiniciar();
    regulador.reiniciar();
    avisadorJungla.reiniciar();
    rutaHecha = false;
    cs10 = null;
    marcas = {};
    ultimo = null;
    visibilidadAumentos.reiniciar();
    aumentosEnviados = false;
    panelCampeon = null;
    if (visible) {
      visible = false;
      dep.alCambiarPartida?.(false);
    }
  }

  return {
    conectado(dir: string): void {
      dirLol = dir;
      sinLcu = false;
      fallosSeguidos = 0;
    },
    /**
     * El cliente de LoL se cerró. Con una partida a la vista, el coach sigue (el juego no depende del cliente): termina
     * con la siguiente fase si el cliente vuelve, o tras varios fallos seguidos de la Live Client Data API.
     */
    desconectado(): void {
      dirLol = null;
      if (conector && visible) {
        if (!sinLcu) registrar('aviso', 'Cliente de LoL desconectado en plena partida: el coach sigue con la Live Client Data API');
        sinLcu = true;
        fallosSeguidos = 0;
        return;
      }
      detener();
    },
    async fase(fase: string): Promise<void> {
      if (fase === 'InProgress') {
        intentarIniciar();
      } else if (!FASES_DE_PARTIDA.has(fase)) {
        detener();
      }
    },
    /** Se llama una vez con todo montado: con COACH_FORZAR_PARTIDA=1 arranca la partida sin esperar a LoL. */
    arrancar(): void {
      if (!(dep.forzarPartida ?? process.env.COACH_FORZAR_PARTIDA === '1')) return;
      registrar('aviso', 'COACH_FORZAR_PARTIDA=1: se simula la fase InProgress');
      intentarIniciar();
    },
    /**
     * La licencia cambió. Si hay una partida bloqueada y ahora es Premium, el coach empieza ya
     * (el overlay sale con el siguiente estado). Perder Premium no corta la partida en curso.
     */
    planCambiado(): void {
      if (bloqueada) intentarIniciar();
    },
    /** Hay una partida con datos válidos y su overlay. */
    enPartida: (): boolean => visible,
    /**
     * El jugador marca que acaba de limpiar un campamento (clic en el widget o tecla opcional).
     * Solo en partida, con el widget de la jungla activo y para los campamentos de la lista.
     */
    marcarJungla(id: IdCampamento): void {
      if (!conector || !ultimo || !junglaActiva() || !CAMPAMENTOS_JUNGLA.some((c) => c.id === id)) return;
      // El último estado puede tener hasta un segundo: se suma lo que ha pasado desde entonces.
      const tiempo = ultimo.tiempo + Math.max(0, ahora() - recibidoEn) / 1000;
      marcas = marcarCampamento(marcas, id, tiempo);
      enviarJungla();
    },
    /** 3.4: tecla de los aumentos (Alt+Shift+A): enseña u oculta el panel; solo en una partida de ARAM: Caos. */
    alternarAumentos(): void {
      if (!visible || ultimo?.modo !== 'caos') return;
      void enviarAumentos(visibilidadAumentos.alternar(), conector);
    },
    /** Hay una partida de ARAM: Caos en curso (la tecla de los aumentos solo se registra entonces). */
    enCaos: (): boolean => visible && ultimo?.modo === 'caos',
    /** Tecla rápida: solo tiene efecto durante una partida. */
    alternar(): void {
      if (visible) dep.overlay.alternar();
    },
  };
}

const fraseJungla = (clave: string, texto: string): FraseVoz => ({
  tipo: 'junglaEnemiga',
  clave,
  texto,
  prioridad: PRIORIDAD_VOZ.junglaEnemiga,
  caducaMs: CADUCIDAD_VOZ.junglaEnemiga,
});
