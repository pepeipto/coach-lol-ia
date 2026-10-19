// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { iniciarIdioma } from '../src/renderer/comun/idioma';
import { textoEtiqueta } from '../src/renderer/overlay/carga/formato';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { establecerIdioma, idiomaActual, textosDe } from '../src/shared/i18n';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach } from '../src/shared/tiposApp';

const ajustes: Ajustes = { ...AJUSTES_POR_DEFECTO, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL };

function api(guardar = vi.fn().mockResolvedValue(undefined)): ApiCoach {
  return {
    alCambiarEstado: () => {},
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(ajustes),
    guardarAjustes: guardar,
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    licencia: vi.fn().mockRejectedValue(new Error('sin licencia')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
    campeones: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    buildDe: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
  };
}

const voces = (langs: string[]) =>
  ({
    getVoices: () => langs.map((lang) => ({ lang, name: lang, voiceURI: lang })),
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as SpeechSynthesis;

beforeEach(() => {
  window.coach = api();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  establecerIdioma('es');
});

describe('idioma de la app (Fase 3)', () => {
  it('Ajustes tiene el selector; al elegir inglés se guarda y la ventana pasa a inglés en vivo', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    window.coach = api(guardar);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const selector = await screen.findByRole('combobox', { name: 'Idioma' });
    await userEvent.selectOptions(selector, 'en');
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ idioma: 'en' }));
    await waitFor(() => expect(idiomaActual()).toBe('en'));
    // La barra lateral ya está en inglés.
    expect(await screen.findByRole('button', { name: textosDe('en')['nav.ajustes'] })).toBeTruthy();
  });

  it('sin voz de Windows para el idioma elegido, Ajustes lo avisa', async () => {
    vi.stubGlobal('speechSynthesis', voces(['es-MX', 'en-US']));
    window.coach = api();
    window.coach.obtenerAjustes = vi.fn().mockResolvedValue({ ...ajustes, idioma: 'de' });
    establecerIdioma('de');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: textosDe('de')['nav.ajustes'] }));
    expect(await screen.findByText(/Deutsch/, { selector: '.aviso-texto' })).toBeTruthy();
  });

  it('con voz del idioma, no hay aviso', async () => {
    vi.stubGlobal('speechSynthesis', voces(['es-MX', 'en-US']));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    await screen.findByRole('combobox', { name: 'Idioma' });
    expect(document.querySelector('.aviso-texto')).toBeNull();
  });

  it('iniciarIdioma toma el idioma del preload, marca <html lang> y sigue los cambios de main', () => {
    let avisar: (i: string) => void = () => {};
    iniciarIdioma({ idioma: 'fr', alCambiarIdioma: (cb) => ((avisar = cb), () => {}) });
    expect(idiomaActual()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    act(() => avisar('pt-BR'));
    expect(idiomaActual()).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('las etiquetas de la pantalla de carga se traducen con la clave y el nombre local del campeón', () => {
    const e = { tipo: 'positivo' as const, texto: 'Especialista en Wukong', clave: 'carga.etiqueta.especialista', params: { campeon: 'Wukong' } };
    establecerIdioma('en');
    expect(textoEtiqueta(e, 'Wukong')).toBe(textosDe('en')['carga.etiqueta.especialista']!.replace('{campeon}', 'Wukong'));
    // Servidor anterior (sin clave): el texto tal cual.
    expect(textoEtiqueta({ tipo: 'neutro', texto: 'Inicia las peleas' }, 'Malphite')).toBe('Inicia las peleas');
  });
});
