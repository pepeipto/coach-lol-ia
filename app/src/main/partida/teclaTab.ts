import { registrar } from '../log';

/**
 * 3.19: saber si el jugador mantiene pulsado Tab (el marcador de LoL) para enseñar a la vez la diferencia de oro.
 *
 * Tab NO se puede registrar como atajo global: Electron (RegisterHotKey) se quedaría la tecla y el marcador del juego
 * dejaría de abrirse. Por eso solo se LEE su estado con GetAsyncKeyState de Windows, unas 16 veces por segundo y solo
 * durante la partida: no se intercepta, no se bloquea ni se simula ninguna tecla (el juego recibe Tab igual que siempre),
 * y solo cuenta si la ventana de delante es la del juego (con el chat de Discord delante no sale nada).
 */

/** Lo que se lee de Windows (sustituible en las pruebas). */
export interface LectorTeclado {
  /** Tab está pulsada ahora mismo. */
  tabPulsada(): boolean;
  /** La ventana de delante es la de la partida de LoL. */
  juegoDelante(): boolean;
}

/** Título de la ventana de la partida de LoL (el cliente/lanzador tiene otro). */
export const TITULO_VENTANA_JUEGO = 'League of Legends (TM) Client';
/** Cada cuánto se mira la tecla: 60 ms es imperceptible y apenas gasta (dos llamadas a user32 por vuelta). */
export const INTERVALO_TAB_MS = 60;
const VK_TAB = 0x09;

/** Lector real (solo Windows). Null fuera de Windows o si no se puede cargar user32 (la función queda apagada). */
export async function crearLectorWindows(plataforma: string = process.platform): Promise<LectorTeclado | null> {
  if (plataforma !== 'win32') return null;
  try {
    const mod = (await import('koffi')) as unknown as { default?: Koffi } & Koffi;
    const koffi = mod.default ?? mod;
    const user32 = koffi.load('user32.dll');
    const getAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)') as (vk: number) => number;
    const getForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()') as () => unknown;
    const getWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hWnd, _Out_ uint16_t *lpString, int nMaxCount)') as (
      h: unknown,
      buf: Uint16Array,
      max: number,
    ) => number;
    const buf = new Uint16Array(64);
    return {
      // Bit alto: la tecla está abajo en este momento (el bit bajo, «pulsada desde la última vez», no se usa).
      tabPulsada: () => (getAsyncKeyState(VK_TAB) & 0x8000) !== 0,
      juegoDelante: () => {
        const h = getForegroundWindow();
        if (!h) return false;
        const n = getWindowTextW(h, buf, buf.length);
        return n > 0 && String.fromCharCode(...buf.subarray(0, n)).startsWith(TITULO_VENTANA_JUEGO);
      },
    };
  } catch (e) {
    registrar('aviso', `No se pudo preparar la lectura de Tab (diferencia de oro): ${String(e)}`);
    return null;
  }
}

interface Koffi {
  load(ruta: string): { func(firma: string): unknown };
}

interface Reloj {
  setInterval(cb: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

/**
 * Vigila Tab mientras está activo y avisa solo cuando cambia (pulsada ↔ suelta). Al desactivarse, si estaba pulsada,
 * avisa de que se soltó (el panel nunca se queda colgado).
 */
export function crearVigiaTab(
  obtenerLector: () => Promise<LectorTeclado | null>,
  alCambiar: (pulsada: boolean) => void,
  reloj: Reloj = { setInterval: (cb, ms) => setInterval(cb, ms), clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>) },
) {
  let lector: Promise<LectorTeclado | null> | null = null;
  let temporizador: unknown = null;
  let pulsada = false;
  let activo = false;

  const poner = (valor: boolean) => {
    if (valor === pulsada) return;
    pulsada = valor;
    alCambiar(valor);
  };

  function parar(): void {
    if (temporizador !== null) reloj.clearInterval(temporizador);
    temporizador = null;
    poner(false);
  }

  return {
    async activar(si: boolean): Promise<void> {
      activo = si;
      if (!si) return parar();
      if (temporizador !== null) return;
      lector ??= obtenerLector();
      const l = await lector;
      // Mientras se cargaba user32 pudo acabar la partida (o ya había un temporizador).
      if (!l || !activo || temporizador !== null) return;
      temporizador = reloj.setInterval(() => {
        try {
          poner(l.tabPulsada() && l.juegoDelante());
        } catch {
          parar();
        }
      }, INTERVALO_TAB_MS);
    },
    pulsada: () => pulsada,
  };
}
