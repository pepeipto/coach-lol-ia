import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  crearActualizacionAutomatica,
  crearMarcaArchivo,
  ESPERA_FIN_PARTIDA_MS,
  INTERVALO_BUSQUEDA_MS,
  type MarcaInstalacion,
  VENTANA_REINTENTO_MS,
} from '../src/main/actualizaciones';
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
  const act = crearActualizacionAutomatica(u, { avisar, ocupado: () => partida, programar: reloj.programar });
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

  it('en la selección de campeón (fase de la LCU) tampoco reinicia: la guarda es ocupado(), no solo la partida', async () => {
    const u = actualizadorFalso();
    const avisar = vi.fn();
    const reloj = programadorFalso();
    const { crearEstadoOcupado } = await import('../src/main/ocupado');
    const estado = crearEstadoOcupado({ carga: { activa: () => false }, partida: { enPartida: () => false } });
    const act = crearActualizacionAutomatica(u, { avisar, ocupado: () => estado.ocupado(), programar: reloj.programar });
    await act.iniciar();
    estado.fase('ChampSelect');
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).not.toHaveBeenCalled();
    estado.fase('GameStart');
    reloj.pendientes().at(-1)!.cb();
    expect(u.quitAndInstall).not.toHaveBeenCalled();
    estado.fase('EndOfGame');
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

/** Almacén en memoria de la marca del último intento de instalación (como el archivo en userData). */
function marcaFalsa(inicial: MarcaInstalacion | null = null) {
  let guardada = inicial;
  return {
    leer: vi.fn(() => guardada),
    guardar: vi.fn((m: MarcaInstalacion) => {
      guardada = m;
    }),
    borrar: vi.fn(() => {
      guardada = null;
    }),
    actual: () => guardada,
  };
}

function montarConMarca(o: { version: string; marca?: MarcaInstalacion | null; ahora: number }) {
  const u = actualizadorFalso();
  const avisar = vi.fn();
  const reloj = programadorFalso();
  const marca = marcaFalsa(o.marca ?? null);
  const act = crearActualizacionAutomatica(u, {
    avisar,
    ocupado: () => false,
    programar: reloj.programar,
    versionActual: o.version,
    marca,
    ahora: () => o.ahora,
  });
  return { u, avisar, reloj, act, marca };
}

describe('actualización automática: sin bucle de reinicios si la instalación falla', () => {
  const HORA = 60 * 60_000;
  const T0 = 1_800_000_000_000;

  it('antes de reiniciar guarda la versión de destino y la hora del intento', async () => {
    const { u, act, marca } = montarConMarca({ version: '3.0.0', ahora: T0 });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(marca.guardar).toHaveBeenCalledWith({ version: '3.0.1', intento: T0 });
    expect(marca.guardar.mock.invocationCallOrder[0]).toBeLessThan(u.quitAndInstall.mock.invocationCallOrder[0]);
    expect(u.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('si al arrancar sigue en la versión vieja y hubo un intento hace menos de 24 h, no reinicia otra vez: se instalará al cerrar', async () => {
    const { u, avisar, act, marca } = montarConMarca({ version: '3.0.0', marca: { version: '3.0.1', intento: T0 - 2 * HORA }, ahora: T0 });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenLastCalledWith(t('actualizacion.descargada', { version: '3.0.1' }));
    expect(u.autoInstallOnAppQuit).toBe(true);
    expect(marca.actual()).toEqual({ version: '3.0.1', intento: T0 - 2 * HORA });
  });

  it('pasadas 24 h desde el intento fallido, vuelve a intentarlo (y renueva la marca)', async () => {
    const { u, act, marca } = montarConMarca({ version: '3.0.0', marca: { version: '3.0.1', intento: T0 - VENTANA_REINTENTO_MS - 1 }, ahora: T0 });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).toHaveBeenCalledOnce();
    expect(marca.actual()).toEqual({ version: '3.0.1', intento: T0 });
  });

  it('un intento previo con otro destino no bloquea una versión más nueva', async () => {
    const { u, act } = montarConMarca({ version: '3.0.0', marca: { version: '3.0.1', intento: T0 - HORA }, ahora: T0 });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.2' });
    expect(u.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('si la versión instalada ya es la de la marca (o posterior), la marca se borra al arrancar', async () => {
    const { act, marca } = montarConMarca({ version: '3.0.1', marca: { version: '3.0.1', intento: T0 - HORA }, ahora: T0 });
    await act.iniciar();
    expect(marca.borrar).toHaveBeenCalled();
    expect(marca.actual()).toBeNull();
    const otra = montarConMarca({ version: '3.1.0', marca: { version: '3.0.10', intento: T0 }, ahora: T0 });
    await otra.act.iniciar();
    expect(otra.marca.actual()).toBeNull();
  });

  it('si quitAndInstall falla sin reiniciar, se quita la marca (no hubo reinicio que pueda repetirse)', async () => {
    const u = actualizadorFalso({ instalarFalla: true });
    const marca = marcaFalsa();
    const act = crearActualizacionAutomatica(u, { avisar: vi.fn(), ocupado: () => false, versionActual: '3.0.0', marca, ahora: () => T0, programar: programadorFalso().programar });
    await act.iniciar();
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(marca.actual()).toBeNull();
  });
});

describe('marca del intento de instalación en userData (actualizacion.json)', () => {
  function fsFalso(inicial: Record<string, string> = {}) {
    const archivos = new Map(Object.entries(inicial));
    return {
      archivos,
      readFileSync: vi.fn((ruta: string) => {
        const c = archivos.get(ruta);
        if (c === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return c;
      }),
      writeFileSync: vi.fn((ruta: string, datos: string) => void archivos.set(ruta, datos)),
      rmSync: vi.fn((ruta: string) => void archivos.delete(ruta)),
    };
  }

  it('guarda, lee y borra el JSON', () => {
    const fs = fsFalso();
    const m = crearMarcaArchivo('/datos/actualizacion.json', fs);
    expect(m.leer()).toBeNull();
    m.guardar({ version: '3.0.1', intento: 123 });
    expect(JSON.parse(fs.archivos.get('/datos/actualizacion.json')!)).toEqual({ version: '3.0.1', intento: 123 });
    expect(m.leer()).toEqual({ version: '3.0.1', intento: 123 });
    m.borrar();
    expect(fs.archivos.has('/datos/actualizacion.json')).toBe(false);
  });

  it('un archivo dañado o con otra forma cuenta como sin marca; un fallo al escribir no se propaga', () => {
    for (const contenido of ['{no es json', '{"version":3,"intento":"x"}', 'null']) {
      expect(crearMarcaArchivo('/a.json', fsFalso({ '/a.json': contenido })).leer()).toBeNull();
    }
    const fs = fsFalso();
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('EPERM');
    });
    expect(() => crearMarcaArchivo('/a.json', fs).guardar({ version: '1.0.0', intento: 1 })).not.toThrow();
  });
});

describe('detener()', () => {
  it('una búsqueda en curso al detener no programa otra ni instala después', async () => {
    const u = actualizadorFalso();
    let terminar!: () => void;
    u.checkForUpdates.mockImplementation(() => new Promise((r) => (terminar = () => r(null))));
    const reloj = programadorFalso();
    const act = crearActualizacionAutomatica(u, { avisar: vi.fn(), ocupado: () => false, programar: reloj.programar });
    const iniciando = act.iniciar();
    act.detener();
    terminar();
    await iniciando;
    expect(reloj.pendientes()).toEqual([]);
    u.emit('update-downloaded', { version: '3.0.1' });
    expect(u.quitAndInstall).not.toHaveBeenCalled();
  });
});
