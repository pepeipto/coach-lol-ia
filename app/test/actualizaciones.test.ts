import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { buscarActualizaciones } from '../src/main/actualizaciones';
import { t } from '../src/shared/i18n';

function actualizadorFalso(o: { falla?: boolean } = {}) {
  return Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null as unknown,
    checkForUpdates: vi.fn(async () => {
      if (o.falla) throw new Error('sin red');
      return null;
    }),
    checkForUpdatesAndNotify: vi.fn(),
  });
}

describe('buscarActualizaciones', () => {
  it('busca sin la notificación en inglés de electron-updater e instala al salir', async () => {
    const u = actualizadorFalso();
    await buscarActualizaciones(u, vi.fn());
    expect(u.checkForUpdates).toHaveBeenCalledOnce();
    expect(u.checkForUpdatesAndNotify).not.toHaveBeenCalled();
    expect(u.autoDownload).toBe(true);
    expect(u.autoInstallOnAppQuit).toBe(true);
  });

  it('al descargarse una versión avisa en español', async () => {
    const u = actualizadorFalso();
    const avisar = vi.fn();
    await buscarActualizaciones(u, avisar);
    u.emit('update-downloaded', { version: '1.2.3' });
    expect(avisar).toHaveBeenCalledWith(t('actualizacion.descargada', { version: '1.2.3' }));
    expect(t('actualizacion.descargada', { version: '1.2.3' })).toContain('1.2.3');
    expect(t('actualizacion.descargada', { version: '1.2.3' })).not.toBe('actualizacion.descargada');
  });

  it('un fallo al buscar no se propaga', async () => {
    const u = actualizadorFalso({ falla: true });
    await expect(buscarActualizaciones(u, vi.fn())).resolves.toBeUndefined();
  });
});
