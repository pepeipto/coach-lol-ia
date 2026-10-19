import type { AudioVoz, EstadoVozNatural } from '../../shared/tiposApp';
import { MAX_TEXTO } from './motorVoz';

interface IpcMinimo {
  handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void;
  on(canal: string, oyente: (e: { sender: unknown }, ...args: unknown[]) => void): void;
}

export interface MotorParaIpc {
  sintetizar(texto: string): Promise<AudioVoz | null>;
  estado(): EstadoVozNatural;
  descargar(): Promise<void>;
  cancelarDescarga(): void;
}

/** Texto válido para la voz: una cadena con algo legible y no más larga que MAX_TEXTO; si no, null. */
export function textoValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return t.length > 0 && t.length <= MAX_TEXTO ? t : null;
}

/**
 * IPC de la voz natural (3.1):
 * - 'voz:sintetizar' (overlay y ventana principal, para «Probar voz»): texto → audio o null;
 * - 'voz:preparar' (overlay): empieza a sintetizar una frase recién encolada, sin respuesta;
 * - 'voz:estado', 'voz:descargar', 'voz:cancelar' (solo la ventana principal).
 * Cualquier otro remitente o un texto no válido se rechaza sin tocar el motor.
 */
export function registrarIpcVoz(
  ipc: IpcMinimo,
  o: { motor: MotorParaIpc; esPrincipal: (sender: unknown) => boolean; esOverlay: (sender: unknown) => boolean },
): void {
  const permitido = (sender: unknown) => o.esPrincipal(sender) || o.esOverlay(sender);
  ipc.handle('voz:sintetizar', async (e, texto) => {
    if (!permitido(e.sender)) throw new Error('Remitente no permitido');
    const t = textoValido(texto);
    if (!t) return null;
    return o.motor.sintetizar(t);
  });
  ipc.on('voz:preparar', (e, texto) => {
    if (!o.esOverlay(e.sender)) return;
    const t = textoValido(texto);
    if (t) void o.motor.sintetizar(t);
  });
  ipc.handle('voz:estado', (e) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return o.motor.estado();
  });
  ipc.handle('voz:descargar', (e) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    void o.motor.descargar();
    return o.motor.estado();
  });
  ipc.handle('voz:cancelar', (e) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    o.motor.cancelarDescarga();
    return o.motor.estado();
  });
}
