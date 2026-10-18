import { t } from '../shared/i18n';
import { registrar } from './log';

/** Lo que se usa del autoUpdater de electron-updater (sustituible en las pruebas). */
export interface Actualizador {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  on(evento: 'update-downloaded', cb: (info: { version: string }) => void): unknown;
  checkForUpdates(): Promise<unknown>;
}

/**
 * Busca actualizaciones en GitHub Releases y las descarga; se instalan al cerrar la app.
 * No usa checkForUpdatesAndNotify, cuya notificación está en inglés: el aviso sale de es.json.
 * Un fallo nunca debe tumbar la app.
 */
export async function buscarActualizaciones(actualizador: Actualizador, avisar: (texto: string) => void): Promise<void> {
  try {
    actualizador.logger = {
      info: (m: unknown) => registrar('info', String(m)),
      warn: (m: unknown) => registrar('aviso', String(m)),
      error: (m: unknown) => registrar('error', String(m)),
      debug: () => {},
    };
    actualizador.autoDownload = true;
    actualizador.autoInstallOnAppQuit = true;
    actualizador.on('update-downloaded', (info) => avisar(t('actualizacion.descargada', { version: info.version })));
    await actualizador.checkForUpdates();
  } catch (e) {
    registrar('error', `No se pudo buscar actualizaciones: ${e instanceof Error ? e.message : String(e)}`);
  }
}
