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
}

/** Une la fase de juego, el conector de la partida, el motor de consejos, el antispam y el overlay. */
export function crearOrquestadorPartida(dep: Dependencias) {
  const filtro = dep.filtro ?? new FiltroAvisos();
  const ahora = dep.ahora ?? Date.now;
  const leerModo = dep.leerModo ?? leerModoVentana;
  let dirLol: string | null = null;
  let conector: ConectorMinimo | null = null;

  async function alEstado(estado: EstadoPartida, mio: ConectorMinimo): Promise<void> {
    try {
      const ctx = (await dep.contexto()) ?? { build: null, rol: 'MIDDLE' as Rol, objetos: {} };
      if (conector !== mio) return; // la partida terminó mientras se calculaba
      dep.overlay.enviarPanel(resumenPanel(estado, ctx.build, ctx.objetos));
      const ajustes = dep.obtenerAjustes();
      const aviso = filtro.procesar(generarIndicaciones(estado, ctx.build, ctx.rol, ctx.objetos), ahora(), ajustes.avisos);
      if (aviso) dep.overlay.enviarAviso({ texto: aviso.texto, voz: ajustes.voz });
    } catch (e) {
      registrar('error', `Error al generar los consejos: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function comprobarModo(mio: ConectorMinimo): Promise<void> {
    if (!dirLol) return;
    const modo = await leerModo(dirLol);
    if (conector === mio && modo === 'pantalla_completa') dep.avisar(t('aviso.pantallaCompleta'));
  }

  function iniciar(): void {
    const mio = dep.crearConector();
    conector = mio;
    mio.on('estado', (estado) => void alEstado(estado, mio));
    mio.iniciar();
    dep.overlay.mostrar();
    void comprobarModo(mio);
  }

  function detener(): void {
    if (conector) {
      conector.detener();
      conector.removeAllListeners();
      conector = null;
      dep.avisar(null);
    }
    dep.overlay.ocultar();
    filtro.reiniciar();
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
        if (!conector) iniciar();
      } else if (fase === 'EndOfGame' || fase === 'None' || fase === 'Lobby') {
        detener();
      }
    },
    /** Se llama una vez con todo montado: con COACH_FORZAR_PARTIDA=1 arranca la partida sin esperar a LoL. */
    arrancar(): void {
      if (!(dep.forzarPartida ?? process.env.COACH_FORZAR_PARTIDA === '1')) return;
      registrar('aviso', 'COACH_FORZAR_PARTIDA=1: se simula la fase InProgress');
      if (!conector) iniciar();
    },
    enPartida: (): boolean => conector !== null,
    /** Tecla rápida: solo tiene efecto durante una partida. */
    alternar(): void {
      if (conector) dep.overlay.alternar();
    },
  };
}
