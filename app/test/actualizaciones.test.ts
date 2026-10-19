import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { crearActualizacionAutomatica, ESPERA_FIN_PARTIDA_MS, INTERVALO_BUSQUEDA_MS } from '../src/main/actualizaciones';
import { t } from '../src/shared/i18n';

function actualizadorFalso(o: { falla?: boolean; instalarFalla?: boolean } = {}) {
  return Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null as unknown,
    checkForUpdates: vi.fn(async () => {
      if (o.falla) throw new Error('sin red');
      return null;
    }),
    checkForUpdatesAndNotify: vi.fn(),
    quitAndInstall: vi.fn(() => {
      if (o.instalarFalla) throw new Error('bloqueado');
    }),
  });
}

function programadorFalso() {
  const tareas: { cb: () => void; ms: number; cancelada: boolean }[] = [];
  const programar = vi.fn((cb: () => void, ms: number) => {
    const tarea = { cb, ms, cancelada: false };
    tareas.push(tarea);
    return () => {
      tarea.cancelada = true;
    };
  });
  const pendientes = () => tareas.filter((x) => !x.cancelada);
  return { programar, tareas, pendientes };
}

function montar(o: { enPartida?: boolean; falla?: boolean; instalarFalla?: boolean } = {}) {
  const u = actualizadorFalso(o);
  const avisar = vi.fn();
  let partida = o.enPartida ?? false;
  const reloj = programadorFalso();
  const act = crearActualizacionAutomatica(u, { avisar, enPartida: () => partida, programar: reloj.programar });
  return { u, avisar, reloj, act, ponerPartida: (v: boolean) => (partida = v) };
}

describe('actualización automática al iniciar', () => {
  it('busca sin la notificación en inglés de electron-updater, descarga sola e instala al salir como respaldo', async () => {
    const { u, act } = montar();
    await act.iniciar();
    expect(u.checkForUpdates).toHaveBeenCalledOnce();
    expect(u.checkForUpdatesAndNotify).not.toHaveBeenCalled();
    expect(u.autoDownload).toBe(true);
    expect(u.autoInstallOnAppQuit).toBe(true);
  });

  it('al terminar la descarga instala en silencio y vuelve a abrir la app', async () => {
    const { u, avisar, act } = montar();
    await act.iniciar();
    u.emit('update-available', { version: '3.0.1' });
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(avisar).toHaveBeenLastCalledWith(t('actualizacion.instalando', { version: '3.0.1' }));
  });

  it('enseña el progreso de la descarga solo al cambiar de decena', async () => {
    const { u, avisar, act } = montar();
    await act.iniciar();
    u.emit('update-available', { version: '3.0.1' });
    for (const percent of [1, 4, 9, 12, 15, 37.8, 99.9]) u.emit('download-progress', { percent });
    const textos = avisar.mock.calls.map((c) => c[0]);
    expect(textos).toEqual([
      t('actualizacion.descargando', { version: '3.0.1', porcentaje: 0 }),
      t('actualizacion.descargando', { version: '3.0.1', porcentaje: 12 }),
      t('actualizacion.descargando', { version: '3.0.1', porcentaje: 37 }),
      t('actualizacion.descargando', { version: '3.0.1', porcentaje: 99 }),
    ]);
    expect(textos[1]).toContain('12');
    expect(textos[1]).toContain('3.0.1');
  });

  it('en partida no reinicia: espera a que termine y entonces instala', async () => {
    const { u, avisar, reloj, act, ponerPartida } = montar({ enPartida: true });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenLastCalledWith(t('actualizacion.trasPartida', { version: '3.0.1' }));
    const espera = reloj.pendientes().find((x) => x.ms === ESPERA_FIN_PARTIDA_MS)!;
    espera.cb(); // sigue en partida
    expect(u.quitAndInstall).not.toHaveBeenCalled();
    ponerPartida(false);
    reloj.pendientes().at(-1)!.cb();
    expect(u.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('sin versión nueva vuelve a buscar cada 4 h; con la descarga hecha deja de buscar', async () => {
    const { u, reloj, act } = montar();
    await act.iniciar();
    const siguiente = reloj.pendientes().find((x) => x.ms === INTERVALO_BUSQUEDA_MS)!;
    expect(siguiente).toBeTruthy();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(siguiente.cancelada).toBe(true);
  });

  it('un fallo al buscar no se propaga y se reintenta más tarde', async () => {
    const { act, reloj } = montar({ falla: true });
    await expect(act.iniciar()).resolves.toBeUndefined();
    expect(reloj.pendientes().some((x) => x.ms === INTERVALO_BUSQUEDA_MS)).toBe(true);
  });

  it('si la instalación falla, avisa de que se instalará al cerrar', async () => {
    const { u, avisar, act } = montar({ instalarFalla: true });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(avisar).toHaveBeenLastCalledWith(t('actualizacion.descargada', { version: '3.0.1' }));
  });

  it('un error de electron-updater antes de descargar quita el aviso de progreso', async () => {
    const { u, avisar, act } = montar();
    await act.iniciar();
    u.emit('update-available', { version: '3.0.1' });
    u.emit('error', new Error('404'));
    expect(avisar).toHaveBeenLastCalledWith(null);
  });

  it('los textos existen y llevan sus datos', () => {
    expect(t('actualizacion.descargando', { version: '9.9.9', porcentaje: 50 })).toMatch(/9\.9\.9.*50|50.*9\.9\.9/);
    expect(t('actualizacion.instalando', { version: '9.9.9' })).toContain('9.9.9');
    expect(t('actualizacion.trasPartida', { version: '9.9.9' })).toContain('9.9.9');
  });
});
