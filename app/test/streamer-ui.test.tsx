// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { TarjetaJugador } from '../src/renderer/overlay/carga/TarjetaJugador';
import { VistaAjustes } from '../src/renderer/principal/vistas/VistaAjustes';
import { VistaAyuda } from '../src/renderer/principal/vistas/VistaAyuda';
import { comandoNightbot, comandoStreamElements, problemaTeclaStreamer, TarjetaStreamer } from '../src/renderer/streamer/TarjetaStreamer';
import { establecerIdioma } from '../src/shared/i18n';
import type { EstadoObs } from '../src/shared/streamer';
import type { Ajustes, ApiCoach, JugadorCarga } from '../src/shared/tiposApp';

const URL_OBS = `http://127.0.0.1:47615/${'a'.repeat(43)}/`;
const obsEscuchando: EstadoObs = { activa: true, escuchando: true, puerto: 47615, url: URL_OBS, error: null };

function api(o: Partial<ApiCoach> = {}): ApiCoach {
  return {
    alCambiarEstado: () => {},
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn(),
    cambiarRunas: vi.fn(),
    asistente: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(AJUSTES_POR_DEFECTO),
    guardarAjustes: vi.fn().mockResolvedValue(undefined),
    moverOverlay: vi.fn(),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    licencia: vi.fn(),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn(),
    alCambiarLicencia: () => () => {},
    campeones: vi.fn(),
    buildDe: vi.fn(),
    estadoObs: vi.fn().mockResolvedValue({ ...obsEscuchando, activa: false, escuchando: false, url: null }),
    alCambiarObs: () => () => {},
    copiarTexto: vi.fn().mockResolvedValue(true),
    regenerarTokenObs: vi.fn(),
    ...o,
  };
}

const conStreamer = (s: Partial<NonNullable<Ajustes['streamer']>>): Ajustes => ({ ...AJUSTES_POR_DEFECTO, streamer: { ...AJUSTES_POR_DEFECTO.streamer!, ...s } });

beforeEach(() => {
  establecerIdioma('es');
  window.coach = api();
});
afterEach(() => cleanup());

describe('pestaña Streamer de Ajustes', () => {
  it('modo streamer apagado por defecto; encenderlo guarda los ajustes', async () => {
    const cambiar = vi.fn();
    render(<TarjetaStreamer ajustes={AJUSTES_POR_DEFECTO} cambiar={cambiar} />);
    const modo = screen.getByRole('switch', { name: 'Ocultar los nombres de los demás jugadores' });
    expect(modo.getAttribute('aria-checked')).toBe('false');
    // «Ocultar también el mío» solo tiene sentido con el modo encendido.
    expect((screen.getByRole('switch', { name: 'Ocultar también mi Riot ID' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(modo);
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ streamer: expect.objectContaining({ activo: true, ocultarPropio: false }) }));
  });

  it('el segundo interruptor oculta también tu Riot ID', async () => {
    const cambiar = vi.fn();
    render(<TarjetaStreamer ajustes={conStreamer({ activo: true })} cambiar={cambiar} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Ocultar también mi Riot ID' }));
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ streamer: expect.objectContaining({ activo: true, ocultarPropio: true }) }));
  });

  it('tecla opcional: se asigna pulsándola y se rechaza la que choca con LoL', async () => {
    const cambiar = vi.fn();
    render(<TarjetaStreamer ajustes={AJUSTES_POR_DEFECTO} cambiar={cambiar} />);
    const boton = screen.getByRole('button', { name: 'Asignar' });
    await userEvent.click(boton);
    fireEvent.keyDown(boton, { key: 'q', code: 'KeyQ', ctrlKey: true });
    expect(screen.getByRole('alert').textContent).toContain('ya la usa LoL');
    expect(cambiar).not.toHaveBeenCalled();
    fireEvent.keyDown(boton, { key: 'F9', code: 'F9' });
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ streamer: expect.objectContaining({ tecla: 'F9' }) }));
    expect(problemaTeclaStreamer('Alt+Shift+A', AJUSTES_POR_DEFECTO)).toMatch(/otra acción/);
    expect(problemaTeclaStreamer('F9', AJUSTES_POR_DEFECTO)).toBeNull();
  });

  it('fuente para OBS: interruptor, URL para copiar, «Copiar URL» y cómo añadirla (1920×1080)', async () => {
    window.coach = api({ estadoObs: vi.fn().mockResolvedValue(obsEscuchando) });
    const cambiar = vi.fn();
    const { rerender } = render(<TarjetaStreamer ajustes={AJUSTES_POR_DEFECTO} cambiar={cambiar} />);
    expect(screen.getByText(/Fuentes › \+ › Navegador/).textContent).toContain('1920');
    expect(screen.getByText(/Fuentes › \+ › Navegador/).textContent).toContain('1080');
    // Apagada: no hay URL.
    expect(screen.queryByLabelText('URL para OBS')).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Activar la fuente para OBS' }));
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ streamer: expect.objectContaining({ obs: expect.objectContaining({ activa: true }) }) }));

    rerender(<TarjetaStreamer ajustes={conStreamer({ obs: { activa: true, puerto: 47615 } })} cambiar={cambiar} />);
    const campo = await screen.findByLabelText('URL para OBS');
    expect((campo as HTMLInputElement).value).toBe(URL_OBS);
    await userEvent.click(screen.getByRole('button', { name: 'Copiar URL' }));
    expect(window.coach.copiarTexto).toHaveBeenCalledWith(URL_OBS);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeTruthy();
  });

  it('puerto: solo se guarda uno válido (nunca el 8080)', async () => {
    const cambiar = vi.fn();
    render(<TarjetaStreamer ajustes={AJUSTES_POR_DEFECTO} cambiar={cambiar} />);
    const puerto = screen.getByLabelText('Puerto');
    await userEvent.clear(puerto);
    await userEvent.type(puerto, '8080{Enter}');
    expect(cambiar).not.toHaveBeenCalled();
    await userEvent.clear(puerto);
    await userEvent.type(puerto, '50123{Enter}');
    expect(cambiar).toHaveBeenCalledWith(expect.objectContaining({ streamer: expect.objectContaining({ obs: { activa: false, puerto: 50123 } }) }));
  });

  it('con el puerto ocupado, el aviso lo dice', async () => {
    window.coach = api({ estadoObs: vi.fn().mockResolvedValue({ ...obsEscuchando, escuchando: false, url: null, error: 'puerto_ocupado' }) });
    render(<TarjetaStreamer ajustes={conStreamer({ obs: { activa: true, puerto: 47615 } })} cambiar={vi.fn()} />);
    expect(await screen.findByText(/El puerto 47615 ya lo usa otro programa/)).toBeTruthy();
  });

  it('comando !coach para Nightbot y StreamElements, con la web y en el idioma de la app', async () => {
    render(<TarjetaStreamer ajustes={AJUSTES_POR_DEFECTO} cambiar={vi.fn()} />);
    expect(comandoNightbot()).toBe('!addcom !coach Juego con Coach LoL IA, un coach gratis para League of Legends con voz y overlay: https://www.coachlolia.com');
    expect(comandoStreamElements()).toMatch(/^!command add !coach .*https:\/\/www\.coachlolia\.com$/);
    expect(screen.getByText(comandoNightbot())).toBeTruthy();
    const copiar = screen.getAllByRole('button', { name: 'Copiar' });
    await userEvent.click(copiar[0]!);
    expect(window.coach.copiarTexto).toHaveBeenCalledWith(comandoNightbot());
    act(() => establecerIdioma('en'));
    expect(comandoNightbot()).toBe('!addcom !coach I play with Coach LoL IA, a free League of Legends coach with voice and overlay: https://www.coachlolia.com');
  });

  it('Ajustes tiene la pestaña «Streamer»', async () => {
    render(<VistaAjustes licencia={null} alCambiarLicencia={vi.fn()} alVerPremium={vi.fn()} mostrarLicencia={false} />);
    await userEvent.click(screen.getByRole('tab', { name: /Streamer/ }));
    expect(await screen.findByRole('switch', { name: 'Ocultar los nombres de los demás jugadores' })).toBeTruthy();
  });

  it('la ayuda explica dónde está el modo streamer', () => {
    render(<VistaAyuda historial={[]} alCambiarHistorial={vi.fn()} />);
    expect(screen.getByText(/Ajustes › Streamer/)).toBeTruthy();
  });
});

describe('tarjeta de la pantalla de carga en el modo streamer', () => {
  const jugador = (j: Partial<JugadorCarga>): JugadorCarga => ({
    equipo: 'enemigo', riotId: 'Rival#EUW', campeonId: 238, campeon: 'Zed', nombre: 'Zed', rol: 'MIDDLE', rango: null, maestria: null, campeonWinrate: null, etiquetas: [], ...j,
  });
  it('sale el campeón una sola vez en lugar del Riot ID', () => {
    render(
      <ul>
        <TarjetaJugador jugador={jugador({ riotId: 'Zed', streamer: true })} version="1" />
      </ul>,
    );
    const tarjeta = screen.getByRole('listitem');
    expect(within(tarjeta).getAllByText('Zed')).toHaveLength(1);
    expect(tarjeta.textContent).not.toMatch(/Rival|#/);
  });
  it('sin el modo, nombre y campeón como siempre', () => {
    render(
      <ul>
        <TarjetaJugador jugador={jugador({})} version="1" />
      </ul>,
    );
    expect(screen.getByText('Rival')).toBeTruthy();
    expect(screen.getByText('Zed')).toBeTruthy();
  });
});
