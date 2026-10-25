import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { crearModoStreamer } from '../src/main/streamer/modoStreamer';
import type { ControlOverlayCompleto } from '../src/main/ventanas/overlayControl';
import type { Perfil } from '../src/shared/perfil';
import type { EstadoObs } from '../src/shared/streamer';
import type { Ajustes, EstadoCarga, JugadorCarga } from '../src/shared/tiposApp';

type Manejador = (e: { sender: unknown }, ...args: unknown[]) => unknown;
const PRINCIPAL = { id: 'principal' };
const OVERLAY = { id: 'overlay' };
const OTRO = { id: 'otro' };

const jugador = (j: Partial<JugadorCarga>): JugadorCarga => ({
  equipo: 'enemigo', riotId: 'Rival#EUW', campeonId: 238, campeon: 'Zed', nombre: 'Zed', rol: null, rango: null, maestria: null, campeonWinrate: null, etiquetas: [], ...j,
});
const carga: EstadoCarga = { version: '1', jugadores: [jugador({ propio: true, riotId: 'Yo#EUW', campeon: 'Ahri', nombre: 'Ahri' }), jugador({})] };

let parar: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(parar.map((p) => p()));
  parar = [];
});

async function puertoLibre(): Promise<number> {
  const s = createServer();
  await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
  const p = (s.address() as { port: number }).port;
  await new Promise<void>((ok) => s.close(() => ok()));
  return p;
}

function montar(inicial: Partial<Ajustes> = {}) {
  let ajustes: Ajustes = { ...structuredClone(AJUSTES_POR_DEFECTO), ...inicial };
  const handle = new Map<string, Manejador>();
  const on = new Map<string, Manejador>();
  const teclas = new Map<string, () => void>();
  const enviados: { canal: string; dato: unknown }[] = [];
  const base = {
    enviarCarga: vi.fn(),
    enviarEstado: vi.fn(),
    enviarAumentos: vi.fn(),
    enviarModo: vi.fn(),
    enviarConfig: vi.fn(),
    enviarAviso: vi.fn(),
    mostrar: vi.fn(),
  } as unknown as ControlOverlayCompleto;
  const portapapeles = { writeText: vi.fn() };
  const st = crearModoStreamer({
    ipcMain: { handle: (c, fn) => void handle.set(c, fn), on: (c, fn) => void on.set(c, fn) },
    globalShortcut: { register: (t, cb) => (teclas.set(t, cb), true), unregister: (t) => void teclas.delete(t) },
    clipboard: portapapeles,
    leerAjustes: () => ajustes,
    guardarAjustes: (a) => void (ajustes = normalizarAjustes(a)),
    rutaToken: join(mkdtempSync(join(tmpdir(), 'coach-st-')), 'obs.json'),
    esPrincipal: (s) => s === PRINCIPAL,
    esOverlay: (s) => s === OVERLAY,
    enviarPrincipal: (canal, dato) => void enviados.push({ canal, dato }),
  });
  parar.push(() => st.detener());
  const overlay = st.envolverOverlay(base);
  const cambiar = (a: Partial<Ajustes['streamer']>) => {
    ajustes = { ...ajustes, streamer: { ...ajustes.streamer!, ...a } };
    st.ajustesCambiados();
  };
  return { st, overlay, base, handle, on, teclas, enviados, portapapeles, cambiar, ajustes: () => ajustes };
}

describe('modo streamer en main', () => {
  it('apagado: la pantalla de carga llega al overlay tal cual', () => {
    const { overlay, base } = montar();
    overlay.enviarCarga(carga);
    expect(base.enviarCarga).toHaveBeenCalledWith(carga);
  });

  it('encendido: el overlay nunca recibe el Riot ID de los demás', () => {
    const { overlay, base, cambiar } = montar();
    cambiar({ activo: true });
    overlay.enviarCarga(carga);
    const enviado = vi.mocked(base.enviarCarga).mock.calls.at(-1)![0] as EstadoCarga;
    expect(enviado.jugadores.map((j) => j.riotId)).toEqual(['Yo#EUW', 'Zed']);
  });

  it('al encender el modo con la pantalla de carga abierta, se vuelve a mandar ya sustituida; y el perfil también', () => {
    const { st, overlay, base, cambiar } = montar();
    const reenviar = vi.fn();
    st.alReaplicarPerfil(reenviar);
    overlay.enviarModo('carga');
    overlay.enviarCarga(carga);
    cambiar({ activo: true, ocultarPropio: true });
    const enviado = vi.mocked(base.enviarCarga).mock.calls.at(-1)![0] as EstadoCarga;
    expect(JSON.stringify(enviado)).not.toMatch(/#EUW/);
    expect(reenviar).toHaveBeenCalledTimes(1);
    // Fuera de la carga no se reenvía nada.
    overlay.enviarModo('partida');
    cambiar({ activo: false });
    expect(base.enviarCarga).toHaveBeenCalledTimes(2);
  });

  it('el perfil sale sustituido según el modo', () => {
    const { st, cambiar } = montar();
    const perfil = { invocador: { nombre: 'Carlos', tag: 'EUW', nivel: 1, icono: 1 }, partidas: [], campeonesDD: {} } as unknown as Perfil;
    expect(st.perfil(perfil).invocador?.nombre).toBe('Carlos');
    cambiar({ activo: true, ocultarPropio: true });
    expect(st.perfil(perfil).invocador).toMatchObject({ nombre: 'Invocador', tag: '' });
  });

  it('lo que va al overlay sigue llegando igual (estado, aumentos, modo, configuración)', () => {
    const { overlay, base } = montar();
    overlay.enviarModo('partida');
    overlay.enviarAumentos?.(null);
    overlay.enviarConfig(AJUSTES_POR_DEFECTO.overlay);
    expect(base.enviarModo).toHaveBeenCalledWith('partida');
    expect(base.enviarAumentos).toHaveBeenCalledWith(null);
    expect(base.enviarConfig).toHaveBeenCalledWith(AJUSTES_POR_DEFECTO.overlay);
  });

  it('tecla opcional: se registra al definirla, alterna el modo, lo guarda y avisa en el overlay', () => {
    const { st, teclas, cambiar, ajustes, base } = montar();
    st.iniciar();
    expect(teclas.size).toBe(0);
    cambiar({ tecla: 'Ctrl+Alt+S' });
    expect([...teclas.keys()]).toEqual(['Ctrl+Alt+S']);
    teclas.get('Ctrl+Alt+S')!();
    expect(ajustes().streamer!.activo).toBe(true);
    expect(base.enviarAviso).toHaveBeenCalledWith(expect.objectContaining({ voz: false }));
    teclas.get('Ctrl+Alt+S')!();
    expect(ajustes().streamer!.activo).toBe(false);
    cambiar({ tecla: '' });
    expect(teclas.size).toBe(0);
  });

  it('no registra una tecla que choca con LoL o con otra de la app', () => {
    const { st, teclas, cambiar } = montar();
    st.iniciar();
    cambiar({ tecla: 'Ctrl+Q' });
    expect(teclas.size).toBe(0);
    cambiar({ tecla: 'Alt+Shift+L' });
    expect(teclas.size).toBe(0);
  });

  it('IPC solo desde la ventana principal; el portapapeles solo acepta textos razonables', async () => {
    const { handle, portapapeles } = montar();
    expect(() => handle.get('streamer:obs-estado')!({ sender: OTRO })).toThrow();
    expect(() => handle.get('streamer:copiar')!({ sender: OVERLAY }, 'x')).toThrow();
    expect(handle.get('streamer:copiar')!({ sender: PRINCIPAL }, 'hola')).toBe(true);
    expect(handle.get('streamer:copiar')!({ sender: PRINCIPAL }, 'x'.repeat(5000))).toBe(false);
    expect(handle.get('streamer:copiar')!({ sender: PRINCIPAL }, 42)).toBe(false);
    expect(portapapeles.writeText).toHaveBeenCalledTimes(1);
  });

  it('subtítulos: solo los acepta de la ventana del overlay', () => {
    const { st, on, overlay, cambiar } = montar();
    st.iniciar();
    cambiar({});
    overlay.enviarConfig({ ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true } });
    overlay.enviarModo('partida');
    on.get('overlay:voz-dicha')!({ sender: OTRO }, 'inyectado');
    expect(st.fuente.vista().subtitulo).toBeNull();
    on.get('overlay:voz-dicha')!({ sender: OVERLAY }, 'Dragón en 30');
    expect(st.fuente.vista().subtitulo?.texto).toBe('Dragón en 30');
  });

  it('fuente para OBS: se abre al activarla, da la URL con token en 127.0.0.1 y se cierra al apagarla', async () => {
    const { handle, cambiar, enviados } = montar();
    const puerto = await puertoLibre();
    cambiar({ obs: { activa: true, puerto } });
    await vi.waitFor(() => expect(enviados.at(-1)?.canal).toBe('streamer:obs'));
    const estado = handle.get('streamer:obs-estado')!({ sender: PRINCIPAL }) as EstadoObs;
    expect(estado).toMatchObject({ activa: true, escuchando: true, puerto, error: null });
    expect(estado.url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${puerto}/[A-Za-z0-9_-]{43}/$`));
    expect((await fetch(estado.url!)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${puerto}/`)).status).toBe(404);

    // «Cambiar enlace»: la URL anterior deja de valer.
    const nuevo = (await handle.get('streamer:obs-regenerar')!({ sender: PRINCIPAL })) as EstadoObs;
    expect(nuevo.url).not.toBe(estado.url);
    expect((await fetch(estado.url!)).status).toBe(404);
    expect((await fetch(nuevo.url!)).status).toBe(200);

    enviados.length = 0;
    cambiar({ obs: { activa: false, puerto } });
    await vi.waitFor(() => expect(enviados.at(-1)?.canal).toBe('streamer:obs'));
    expect(handle.get('streamer:obs-estado')!({ sender: PRINCIPAL })).toMatchObject({ escuchando: false, url: null });
  });

  it('fuente para OBS con el puerto ocupado: avisa del error', async () => {
    const ocupado = createServer();
    await new Promise<void>((ok) => ocupado.listen(0, '127.0.0.1', ok));
    const puerto = (ocupado.address() as { port: number }).port;
    const { handle, cambiar, enviados } = montar();
    cambiar({ obs: { activa: true, puerto } });
    await vi.waitFor(() => expect(enviados.at(-1)?.canal).toBe('streamer:obs'));
    expect(handle.get('streamer:obs-estado')!({ sender: PRINCIPAL })).toMatchObject({ escuchando: false, url: null, error: 'puerto_ocupado' });
    await new Promise<void>((ok) => ocupado.close(() => ok()));
  });
});
