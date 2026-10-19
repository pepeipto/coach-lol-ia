// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { aceleradorDe } from '../src/shared/teclas';
import { VistaOverlay } from '../src/renderer/principal/vistas/VistaOverlay';
import { t } from '../src/shared/i18n';
import type { Ajustes, ApiCoach } from '../src/shared/tiposApp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function montar(ajustes: Ajustes = structuredClone(AJUSTES_POR_DEFECTO)) {
  const guardarAjustes = vi.fn(async (_a: Ajustes) => undefined);
  const moverOverlay = vi.fn(async (v: boolean) => v);
  (window as unknown as { coach: Partial<ApiCoach> }).coach = {
    obtenerAjustes: vi.fn(async () => ajustes),
    guardarAjustes,
    moverOverlay,
    overlayMoviendo: vi.fn(async () => false),
    alCambiarMover: () => () => {},
  };
  render(<VistaOverlay plan="premium" alVerPremium={() => {}} />);
  const ultimo = () => guardarAjustes.mock.calls.at(-1)![0];
  return { guardarAjustes, moverOverlay, ultimo };
}

describe('vista Overlay', () => {
  beforeEach(() => {
    vi.stubGlobal('speechSynthesis', undefined);
  });

  it('3.0.1: «Avisos emergentes en pantalla» tiene su tarjeta, viene apagado y se puede encender', async () => {
    const { ultimo } = montar();
    const titulo = await screen.findByText('Avisos emergentes en pantalla');
    const tarjeta = titulo.closest('.tarjeta-avisos') as HTMLElement;
    const texto = within(tarjeta).getByRole('switch', { name: new RegExp(t('overlay.widget.avisos')) });
    const compra = within(tarjeta).getByRole('switch', { name: new RegExp(t('overlay.widget.compra')) });
    expect(texto.getAttribute('aria-checked')).toBe('false');
    expect(compra.getAttribute('aria-checked')).toBe('false');
    // Sin avisos de texto, los tipos no se pueden tocar; y la habilidad ya no es un aviso (la marca la flecha).
    expect(within(tarjeta).getByRole('switch', { name: new RegExp(t('ajustes.aviso.vision')) }).hasAttribute('disabled')).toBe(true);
    expect(within(tarjeta).queryByRole('switch', { name: new RegExp(t('ajustes.aviso.habilidad')) })).toBeNull();
    await userEvent.click(texto);
    expect(ultimo().overlay.widgets.avisos.activo).toBe(true);
    await userEvent.click(within(tarjeta).getByRole('switch', { name: new RegExp(t('overlay.widget.compra')) }));
    expect(ultimo().overlay.widgets.compra.activo).toBe(true);
    // La flecha sigue entre los widgets, encendida.
    const flecha = document.querySelector('[data-widget-config="habilidad"]') as HTMLElement;
    expect(within(flecha).getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('3.1: pantalla de carga: «Pantalla completa» por defecto, «Solo tarjetas» o «Desactivada», y «Ocultar con Espacio»', async () => {
    const { ultimo } = montar();
    const titulo = await screen.findByText(t('overlay.config.carga'));
    const tarjeta = titulo.closest('.tarjeta-carga') as HTMLElement;
    const completa = within(tarjeta).getByRole('tab', { name: t('overlay.config.cargaCompleta') });
    expect(completa.getAttribute('aria-selected')).toBe('true');
    expect(within(tarjeta).getByText(t('overlay.config.cargaCompletaDesc'))).toBeTruthy();
    const espacio = within(tarjeta).getByRole('switch', { name: new RegExp(t('overlay.config.cargaEspacio')) });
    expect(espacio.getAttribute('aria-checked')).toBe('true');

    await userEvent.click(within(tarjeta).getByRole('tab', { name: t('overlay.config.cargaTarjetas') }));
    expect(ultimo().overlay.carga).toEqual({ modo: 'tarjetas', ocultarConEspacio: true });
    await userEvent.click(espacio);
    expect(ultimo().overlay.carga.ocultarConEspacio).toBe(false);
    await userEvent.click(within(tarjeta).getByRole('tab', { name: t('overlay.config.cargaDesactivada') }));
    expect(ultimo().overlay.carga.modo).toBe('desactivada');
  });

  it('3.1: con la pantalla de carga desactivada, «Ocultar con Espacio» no se puede tocar', async () => {
    const a = structuredClone(AJUSTES_POR_DEFECTO);
    a.overlay.carga = { modo: 'desactivada', ocultarConEspacio: true };
    montar(a);
    const titulo = await screen.findByText(t('overlay.config.carga'));
    const tarjeta = titulo.closest('.tarjeta-carga') as HTMLElement;
    expect(within(tarjeta).getByText(t('overlay.config.cargaDesactivadaDesc'))).toBeTruthy();
    expect(within(tarjeta).getByRole('switch', { name: new RegExp(t('overlay.config.cargaEspacio')) }).hasAttribute('disabled')).toBe(true);
  });

  it('enciende y apaga cada widget por separado', async () => {
    const { ultimo } = montar();
    await screen.findByText(t('overlay.config.widget.csDesc'));
    const fila = document.querySelector('[data-widget-config="cs"]') as HTMLElement;
    await userEvent.click(within(fila).getByRole('switch'));
    expect(ultimo().overlay.widgets.cs.activo).toBe(false);
    expect(ultimo().overlay.widgets.objetivos.activo).toBe(true);
  });

  it('jungla: presentación «Minimapa» por defecto, cambia a «Panel lateral», y la tecla para mostrar u ocultar es Alt+Mayús+L', async () => {
    const { ultimo } = montar();
    const minimapa = await screen.findByRole('tab', { name: t('overlay.config.junglaMinimapa') });
    expect(minimapa.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Alt+Mayús+L')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: t('overlay.config.junglaPanel') }));
    expect(ultimo().overlay.jungla.presentacion).toBe('panel');
    // Sin calibrar, «Restablecer el minimapa» no hace falta.
    await userEvent.click(screen.getByRole('tab', { name: t('overlay.config.junglaMinimapa') }));
    expect((screen.getByRole('button', { name: t('overlay.config.junglaRestablecer') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('la tecla para mostrar u ocultar no puede repetir la de un campamento', async () => {
    const a = structuredClone(AJUSTES_POR_DEFECTO);
    a.teclasJungla = { azul: 'F5' };
    const { guardarAjustes } = montar(a);
    const boton = (await screen.findByText('Alt+Mayús+L')).closest('button')!;
    await userEvent.click(boton);
    fireEvent.keyDown(boton, { key: 'F5', code: 'F5' });
    expect(await screen.findByText(t('overlay.config.teclaUsada', { tecla: 'F5' }))).toBeTruthy();
    expect(guardarAjustes).not.toHaveBeenCalled();
  });

  it('jungla enemigo: los avisos por el registro de muertes vienen encendidos y la ruta estimada apagada', async () => {
    const { ultimo } = montar();
    const avisos = await screen.findByRole('switch', { name: new RegExp(t('junglaEnemiga.avisos')) });
    const ruta = screen.getByRole('switch', { name: (n) => n.includes(t('junglaEnemiga.ruta')) });
    expect(avisos.getAttribute('aria-checked')).toBe('true');
    expect(ruta.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(ruta);
    expect(ultimo().junglaEnemiga).toEqual({ avisos: true, ruta: true });
    await userEvent.click(screen.getByRole('switch', { name: new RegExp(t('junglaEnemiga.avisos')) }));
    expect(ultimo().junglaEnemiga.avisos).toBe(false);
  });

  it('el tamaño de cada widget y la opacidad se guardan al soltar el deslizador', async () => {
    const { guardarAjustes, ultimo } = montar();
    const escala = await screen.findByRole('slider', { name: `${t('overlay.config.escala')} · ${t('overlay.widget.habilidad')}` });
    vi.useFakeTimers();
    fireEvent.change(escala, { target: { value: '1.3' } });
    fireEvent.change(escala, { target: { value: '1.25' } });
    expect(guardarAjustes).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(guardarAjustes).toHaveBeenCalledTimes(1);
    expect(ultimo().overlay.widgets.habilidad.escala).toBe(1.25);
    fireEvent.change(screen.getByRole('slider', { name: t('overlay.config.opacidad') }), { target: { value: '0.6' } });
    act(() => vi.advanceTimersByTime(300));
    expect(ultimo().overlay.opacidad).toBe(0.6);
  });

  it('«Mover y calibrar» activa el modo mover', async () => {
    const { moverOverlay } = montar();
    await userEvent.click(await screen.findByRole('button', { name: t('overlay.config.mover') }));
    expect(moverOverlay).toHaveBeenCalledWith(true);
  });

  it('voz: activar, tipos de frase y «Probar voz» con el volumen elegido', async () => {
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      voice: unknown;
      lang = '';
      volume = 1;
      constructor(public text: string) {}
    });
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'es-ES', name: 'Helena', voiceURI: 'Helena' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak,
    });
    const { ultimo } = montar({ ...structuredClone(AJUSTES_POR_DEFECTO), overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, volumen: 0.3 } } });
    const activar = (await screen.findByText(t('overlay.config.vozActiva'))).closest('.interruptor') as HTMLElement;
    await userEvent.click(within(activar).getByRole('switch'));
    expect(ultimo().overlay.voz.activa).toBe(true);
    expect(ultimo().voz).toBe(true);
    expect(screen.getByRole('option', { name: 'Helena (es-ES)' })).toBeTruthy();
    const tipoCs = screen.getByText(t('overlay.config.tipo.cs')).closest('.interruptor') as HTMLElement;
    await userEvent.click(within(tipoCs).getByRole('switch'));
    expect(ultimo().overlay.voz.tipos.cs).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: t('overlay.config.probar') }));
    await vi.waitFor(() => expect(speak).toHaveBeenCalled());
    expect(speak.mock.calls[0]![0]).toMatchObject({ text: t('overlay.config.vozPrueba'), volume: 0.3 });
  });

  it('jungla: apagada por defecto con su nota; al activarla se pueden asignar teclas', async () => {
    const { ultimo } = montar();
    expect(await screen.findByText(t('overlay.config.junglaNota'))).toBeTruthy();
    expect(t('overlay.config.junglaNota')).toContain('Desactivado por defecto; marca tú cuándo se limpia cada campamento');
    expect(screen.queryByText(t('overlay.config.teclas'))).toBeNull();
    const activar = screen.getByText(t('overlay.config.junglaActiva')).closest('.interruptor') as HTMLElement;
    await userEvent.click(within(activar).getByRole('switch'));
    expect(ultimo().overlay.widgets.jungla.activo).toBe(true);
    const boton = screen.getAllByRole('button', { name: t('overlay.config.asignar') })[0]!;
    await userEvent.click(boton);
    expect(boton.textContent).toBe(t('overlay.config.pulsaTecla'));
    fireEvent.keyDown(boton, { key: 'F5', code: 'F5' });
    expect(ultimo().teclasJungla).toEqual({ azul: 'F5' });
  });

  it('jungla: rechaza con un mensaje las combinaciones de LoL y la tecla del overlay', async () => {
    const base = structuredClone(AJUSTES_POR_DEFECTO);
    const { guardarAjustes } = montar({ ...base, overlay: { ...base.overlay, widgets: { ...base.overlay.widgets, jungla: { activo: true, x: null, y: null, escala: 1 } } } });
    const boton = (await screen.findAllByRole('button', { name: t('overlay.config.asignar') }))[0]!;
    await userEvent.click(boton);
    fireEvent.keyDown(boton, { key: 'q', code: 'KeyQ', ctrlKey: true });
    expect(screen.getByText(t('overlay.config.teclaChocaLol', { tecla: 'Ctrl+Q' }))).toBeTruthy();
    // La tecla del overlay (CommandOrControl+Shift+O) escrita como Ctrl+Shift+O también se rechaza.
    fireEvent.keyDown(boton, { key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true });
    expect(screen.getByText(t('overlay.config.teclaEsOverlay', { tecla: 'Ctrl+Mayús+O' }))).toBeTruthy();
    expect(guardarAjustes).not.toHaveBeenCalled();
    // Una válida se guarda y el mensaje desaparece.
    fireEvent.keyDown(boton, { key: 'F6', code: 'F6' });
    expect(guardarAjustes).toHaveBeenCalled();
    expect(screen.queryByText(t('overlay.config.teclaEsOverlay', { tecla: 'Ctrl+Mayús+O' }))).toBeNull();
  });
});

describe('aceleradorDe', () => {
  const tecla = (key: string, code: string, m: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
    aceleradorDe({ key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...m });
  it('F1–F24 y el teclado numérico valen solos; letras y números necesitan un modificador', () => {
    expect(tecla('F5', 'F5')).toBe('F5');
    expect(tecla('4', 'Numpad4')).toBe('num4');
    expect(tecla('a', 'KeyA')).toBeNull();
    expect(tecla('1', 'Digit1')).toBeNull();
    expect(tecla('a', 'KeyA', { ctrlKey: true, shiftKey: true })).toBe('Ctrl+Shift+A');
    expect(tecla('1', 'Digit1', { altKey: true })).toBe('Alt+1');
  });
  it('solo modificadores o teclas especiales no sirven', () => {
    expect(tecla('Control', 'ControlLeft', { ctrlKey: true })).toBeNull();
    expect(tecla('Escape', 'Escape')).toBeNull();
    expect(tecla(' ', 'Space')).toBeNull();
  });
});
