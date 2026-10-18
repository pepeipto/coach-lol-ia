// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { BannerPremium } from '../src/renderer/principal/vistas/BannerPremium';
import { RejillaHabilidades } from '../src/renderer/principal/vistas/RejillaHabilidades';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { t } from '../src/shared/i18n';
import type { EstadoPrincipal } from '../src/shared/tiposApp';

afterEach(cleanup);

const orden: Build['ordenHabilidades'] = ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'];

const build: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 1234,
  tasaVictoria: 0.5234,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655, 3157],
  botas: 3020,
  situacionales: [3135],
  ordenHabilidades: orden,
  calculadoEn: '2026-10-18T00:00:00Z',
};

function estado(over: Partial<EstadoPrincipal> = {}): EstadoPrincipal {
  return {
    cliente: 'conectado',
    version: '15.20.1',
    error: null,
    importacion: null,
    aviso: null,
    recursos: {
      objetos: { 1056: 'Anillo de Doran', 6655: 'Tormento de Luden', 3157: 'Reloj de arena', 3020: 'Botas', 3135: 'Bastón' },
      runas: { 8100: { nombre: 'Dominación', icono: 'perk-images/Styles/7200_Domination.png' } },
      hechizos: { 4: { nombre: 'Destello', imagen: 'SummonerFlash.png' } },
    },
    seleccion: {
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE', 'BOTTOM'],
      resultado: { estado: 'ok', build },
    },
    ...over,
  };
}

const base = {
  importacion: null,
  onImportar: vi.fn(),
  onCambiarRol: vi.fn(),
  plan: 'premium' as const,
  bannerCerrado: false,
  alCerrarBanner: vi.fn(),
  alVerPremium: vi.fn(),
};

describe('RejillaHabilidades', () => {
  it('tiene 18 celdas y la del nivel 6 está marcada como R', () => {
    render(<RejillaHabilidades orden={orden} />);
    const lista = screen.getByRole('list', { name: t('ui.habilidades') });
    const celdas = within(lista).getAllByRole('listitem');
    expect(celdas).toHaveLength(18);
    expect(celdas[5].getAttribute('data-habilidad')).toBe('R');
    expect(celdas[5].getAttribute('aria-label')).toBe('Nivel 6: R');
    expect(celdas[0].getAttribute('data-habilidad')).toBe('Q');
  });
});

describe('BannerPremium', () => {
  it('aparece con plan gratis, no con premium, y se cierra con su botón', async () => {
    const alCerrar = vi.fn();
    const { rerender } = render(<BannerPremium plan="gratis" cerrado={false} alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.getByText(t('banner.texto'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('banner.cerrar') }));
    expect(alCerrar).toHaveBeenCalledOnce();
    rerender(<BannerPremium plan="gratis" cerrado alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
    rerender(<BannerPremium plan="premium" cerrado={false} alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
  });

  it('en la vista Campeón aparece con gratis y se puede cerrar', async () => {
    const alCerrarBanner = vi.fn();
    const { rerender } = render(<VistaCampeon estado={estado()} {...base} plan="gratis" alCerrarBanner={alCerrarBanner} />);
    expect(screen.getByText(t('banner.texto'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('banner.cerrar') }));
    expect(alCerrarBanner).toHaveBeenCalledOnce();
    rerender(<VistaCampeon estado={estado()} {...base} plan="premium" />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
  });
});

describe('VistaCampeon', () => {
  it('con cliente esperando muestra el estado vacío', () => {
    render(<VistaCampeon estado={estado({ cliente: 'esperando', seleccion: null })} {...base} />);
    expect(screen.getByText('Esperando al cliente de League of Legends…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
  });

  it('sin selección pide elegir un campeón', () => {
    render(<VistaCampeon estado={estado({ seleccion: null })} {...base} />);
    expect(screen.getByText(t('vacio.eligeTitulo'))).toBeTruthy();
  });

  it('con importación completa el botón Importar muestra el estado de éxito', () => {
    const importacion = { runas: { ok: true as const }, hechizos: { ok: true as const }, objetos: { ok: true as const } };
    render(<VistaCampeon estado={estado()} {...base} importacion={importacion} />);
    const boton = screen.getByRole('button', { name: t('ui.importadoBoton') });
    expect(boton.className).toContain('exito');
    expect(screen.getByText(t('ui.importado'))).toBeTruthy();
  });

  it('muestra el splash del campeón, las insignias y las piezas de la build', () => {
    const { container } = render(<VistaCampeon estado={estado()} {...base} />);
    const splash = container.querySelector('.cabecera-splash') as HTMLImageElement;
    expect(splash.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg');
    expect(screen.getByText(/52,3 % de victorias/).closest('.insignia')?.className).toContain('insignia-exito');
    expect(screen.getByRole('img', { name: 'Tormento de Luden' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Destello' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Dominación' })).toBeTruthy();
  });

  it('con menos del 50 % la insignia de victorias es ámbar', () => {
    const e = estado();
    e.seleccion!.resultado = { estado: 'ok', build: { ...build, tasaVictoria: 0.481 } };
    render(<VistaCampeon estado={e} {...base} />);
    expect(screen.getByText(/48,1 % de victorias/).closest('.insignia')?.className).toContain('insignia-aviso');
  });
});
