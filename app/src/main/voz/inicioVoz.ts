import { join } from 'node:path';
import type { Idioma } from '../../shared/i18n';
import type { Ajustes, EstadoVozNatural } from '../../shared/tiposApp';
import { registrar } from '../log';
import { registrarIpcVoz } from './ipcVoz';
import { crearMotorVoz, type ProcesoVoz } from './motorVoz';
import type { MensajeAlProceso, MensajeDelProceso } from './protocolo';

interface ElectronParaVoz {
  app: { getPath(nombre: 'userData'): string; on(evento: 'will-quit', cb: () => void): void };
  ipcMain: Parameters<typeof registrarIpcVoz>[0];
  utilityProcess: {
    fork(
      ruta: string,
      args?: string[],
      opciones?: { serviceName?: string; stdio?: 'ignore' | 'inherit' | 'pipe' },
    ): {
      pid?: number;
      postMessage(m: MensajeAlProceso): void;
      on(evento: 'message', cb: (m: MensajeDelProceso) => void): void;
      on(evento: 'exit', cb: (codigo: number) => void): void;
      kill(): boolean;
    };
  };
}

/**
 * Pone en marcha la voz natural en main: el motor (con su proceso de síntesis aparte, que se abre al decir la
 * primera frase), el IPC y el aviso de su estado a la ventana principal. `procesoVoz.js` lo emite electron-vite
 * junto a index.js (entrada `procesoVoz` del build de main).
 */
export function iniciarVozNatural(
  e: ElectronParaVoz,
  o: {
    ajustes(): Ajustes;
    idioma(): Idioma;
    esPrincipal(sender: unknown): boolean;
    esOverlay(sender: unknown): boolean;
    alEstado(estado: EstadoVozNatural): void;
  },
) {
  const crearProceso = (): ProcesoVoz => {
    const hijo = e.utilityProcess.fork(join(__dirname, 'procesoVoz.js'), [], { serviceName: 'Coach LoL IA - Voz', stdio: 'ignore' });
    return {
      enviar: (m) => hijo.postMessage(m),
      alMensaje: (cb) => hijo.on('message', cb),
      alSalir: (cb) => hijo.on('exit', cb),
      matar: () => void hijo.kill(),
    };
  };
  const motor = crearMotorVoz({
    dir: join(e.app.getPath('userData'), 'voz-natural'),
    ajustes: o.ajustes,
    idioma: o.idioma,
    crearProceso,
    alEstado: o.alEstado,
    registrar,
  });
  registrarIpcVoz(e.ipcMain, { motor, esPrincipal: o.esPrincipal, esOverlay: o.esOverlay });
  e.app.on('will-quit', () => motor.detener());
  return motor;
}
