import type { Build, Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Ajustes, AvisoOverlay, EstadoPartida, Panel } from '../../shared/tiposApp';
import { FiltroAvisos } from '../consejos/antispam';
import { generarIndicaciones, resumenPanel } from '../consejos/motor';
import type { DatosEstaticos } from '../datos/estaticos';
import { registrar } from '../log';
import { leerModoVentana, type ModoVentana } from '../partida/modoVentana';

interface ConectorMinimo {
  on(evento: 'estado', cb: (estado: EstadoPartida) => void): unknown;
  removeAllListeners(): unknown;
  iniciar(): void;
  detener(): void;
}

export interface ControlOverlay {
  mostrar(): void;
  ocultar(): void;
  alternar(): void;
  enviarPanel(panel: Panel): void;
  enviarAviso(aviso: AvisoOverlay): void;
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
}

/** Fases en las que la partida sigue: cualquier otra la termina. */
const FASES_DE_PARTIDA = new Set(['InProgress', 'Reconnect']);

/** Une la fase de juego, el conector de la partida, el motor de consejos, el antispam y el overlay. */
export function crearOrquestadorPartida(dep: Dependencias) {
  const filtro = dep.filtro ?? new FiltroAvisos();
  const ahora = dep.ahora ?? Date.now;
  const leerModo = dep.leerModo ?? leerModoVentana;
  let dirLol: string | null = null;
  let conector: ConectorMinimo | null = null;
  /** El overlay solo sale con el primer estado válido: en TFT, ARAM, Arena o como espectador nunca llega. */
  let visible = false;
  /** Hay una partida en curso que no se sigue porque el plan es gratuito. */
  let bloqueada = false;

  function empezarAMostrar(mio: ConectorMinimo): void {
    if (visible) return;
    visible = true;
    dep.overlay.mostrar();
    dep.alCambiarPartida?.(true);
    void comprobarModo(mio);
  }

  async function alEstado(estado: EstadoPartida, mio: ConectorMinimo): Promise<void> {
    if (conector !== mio) return;
    empezarAMostrar(mio);
    try {
      const ctx = (await dep.contexto()) ?? { build: null, rol: 'MIDDLE' as Rol, objetos: {} };
      if (conector !== mio) return; // la partida terminó mientras se calculaba
      dep.overlay.enviarPanel(resumenPanel(estado, ctx.build, ctx.objetos, ctx.version ?? ''));
      const ajustes = dep.obtenerAjustes();
      const aviso = filtro.procesar(generarIndicaciones(estado, ctx.build, ctx.rol, ctx.objetos), ahora(), ajustes.avisos);
      if (aviso) dep.overlay.enviarAviso({ texto: aviso.texto, voz: ajustes.voz, tipo: aviso.tipo });
    } catch (e) {
      registrar('error', `Error al generar los consejos: ${e instanceof Error ? e.message : String(e)}`);
    }
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
    mio.iniciar();
  }

  function detener(): void {
    if (bloqueada) {
      bloqueada = false;
      dep.avisar(null);
    }
    if (!conector) return;
    conector.detener();
    conector.removeAllListeners();
    conector = null;
    dep.avisar(null);
    dep.overlay.ocultar();
    filtro.reiniciar();
    if (visible) {
      visible = false;
      dep.alCambiarPartida?.(false);
    }
  }

  return {
    conectado(dir: string): void {
      dirLol = dir;
    },
    desconectado(): void {
      dirLol = null;
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
    /** Tecla rápida: solo tiene efecto durante una partida. */
    alternar(): void {
      if (visible) dep.overlay.alternar();
    },
  };
}
