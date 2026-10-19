// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { VistaOverlay } from '../src/renderer/principal/vistas/VistaOverlay';
import { t } from '../src/shared/i18n';
import type { Ajustes, ApiCoach, EstadoVozNatural } from '../src/shared/tiposApp';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ESTADO: EstadoVozNatural = {
  estado: 'no_instalada',
  recibidos: 0,
  total: 0,
  error: null,
  voces: [
    { id: 'supertonic3:M1', genero: 'masculina', numero: 1 },
    { id: 'supertonic3:M2', genero: 'masculina', numero: 2 },
  ],
  porDefecto: 'supertonic3:M2',
  naturalInstalada: false,
  packDisponible: true,
  packInstalado: false,
  megasPendientes: 130,
};

function montar(estado: EstadoVozNatural, voz: Partial<Ajustes['overlay']['voz']> = {}) {
  const ajustes = structuredClone(AJUSTES_POR_DEFECTO);
  ajustes.overlay.voz = { ...ajustes.overlay.voz, ...voz };
  const guardarAjustes = vi.fn(async (_a: Ajustes) => undefined);
  let emitir: (e: EstadoVozNatural) => void = () => {};
  const api: Partial<ApiCoach> = {
    obtenerAjustes: vi.fn(async () => ajustes),
    guardarAjustes,
    moverOverlay: vi.fn(async (v: boolean) => v),
    overlayMoviendo: vi.fn(async () => false),
    alCambiarMover: () => () => {},
    estadoVozNatural: vi.fn(async () => estado),
    descargarVozNatural: vi.fn(async () => estado),
    cancelarDescargaVoz: vi.fn(async () => estado),
    alCambiarVozNatural: (cb) => {
      emitir = cb;
      return () => {};
    },
    sintetizarVoz: vi.fn(async () => null),
  };
  (window as unknown as { coach: Partial<ApiCoach> }).coach = api;
  vi.stubGlobal('speechSynthesis', undefined);
  render(<VistaOverlay plan="premium" alVerPremium={() => {}} />);
  return { api, guardarAjustes, emitir: (e: EstadoVozNatural) => act(() => emitir(e)), ultimo: () => guardarAjustes.mock.calls.at(-1)![0] };
}

describe('vista Overlay: tipo de voz (3.1)', () => {
  it('ofrece pregrabada, natural y Windows; la pregrabada por defecto, con la voz natural recomendada', async () => {
    const { ultimo } = montar(ESTADO, { activa: true });
    const motor = (await screen.findByLabelText(t('vozNatural.motor'))) as HTMLSelectElement;
    expect(motor.value).toBe('pack');
    expect(Array.from(motor.options, (o) => o.textContent)).toEqual([t('vozNatural.motor.pack'), t('vozNatural.motor.natural'), t('vozNatural.motor.sistema')]);
    const voz = (await screen.findByLabelText(t('vozNatural.voz'))) as HTMLSelectElement;
    expect(voz.value).toBe('supertonic3:M2');
    expect(screen.getByText(t('vozNatural.recomendada', { voz: t('vozNatural.masculina', { n: 2 }) }))).toBeTruthy();
    await userEvent.selectOptions(voz, 'supertonic3:M1');
    expect(ultimo().overlay.voz.vocesNaturales).toEqual({ es: 'supertonic3:M1' });
    await userEvent.selectOptions(motor, 'sistema');
    expect(ultimo().overlay.voz.motor).toBe('sistema');
  });

  it('sin descargar: tamaño y botón; al pulsar, descarga; el progreso se ve y se puede cancelar', async () => {
    const { api, emitir } = montar(ESTADO, { activa: true });
    expect(await screen.findByText(t('vozNatural.noInstalada', { tamano: '130 MB' }))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('vozNatural.descargar') }));
    expect(api.descargarVozNatural).toHaveBeenCalled();
    emitir({ ...ESTADO, estado: 'descargando', recibidos: 50, total: 100 });
    expect(screen.getByText(t('vozNatural.descargando', { porcentaje: 50 }))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('vozNatural.cancelar') }));
    expect(api.cancelarDescargaVoz).toHaveBeenCalled();
    emitir({ ...ESTADO, estado: 'error', error: 'checksum' });
    expect(screen.getByText(t('vozNatural.error.checksum'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('vozNatural.reintentar') })).toBeTruthy();
    emitir({ ...ESTADO, estado: 'instalada', naturalInstalada: true, packInstalado: true });
    expect(screen.getByText(t('vozNatural.instalada'))).toBeTruthy();
  });

  it('al encender la voz se descarga lo que falte sin pedir nada más', async () => {
    const { api } = montar(ESTADO);
    await screen.findByLabelText(t('vozNatural.motor'));
    await userEvent.click(screen.getByRole('switch', { name: new RegExp(t('overlay.config.vozActiva')) }));
    expect(api.descargarVozNatural).toHaveBeenCalled();
  });

  it('sin voz pregrabada en el idioma, lo explica', async () => {
    montar({ ...ESTADO, packDisponible: false }, { activa: true });
    expect(await screen.findByText(t('vozNatural.packNoDisponible'))).toBeTruthy();
  });

  it('«Probar voz» pide primero la voz de main', async () => {
    vi.stubGlobal('AudioContext', class {});
    const { api } = montar({ ...ESTADO, estado: 'instalada' }, { activa: true });
    await userEvent.click(await screen.findByRole('button', { name: t('overlay.config.probar') }));
    expect(api.sintetizarVoz).toHaveBeenCalledWith(t('overlay.config.vozPrueba'));
  });
});
