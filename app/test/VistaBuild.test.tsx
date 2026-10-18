// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { PieLegal } from '../src/renderer/principal/PieLegal';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { t } from '../src/shared/i18n';
import type { EstadoPrincipal } from '../src/shared/tiposApp';

afterEach(cleanup);

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
  ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'],
  calculadoEn: '2026-10-18T00:00:00Z',
};

function estado(resultado: NonNullable<EstadoPrincipal['seleccion']>['resultado']): EstadoPrincipal {
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
      resultado,
    },
  };
}

const props = {
  importacion: null,
  onImportar: vi.fn(),
  onCambiarRol: vi.fn(),
  plan: 'premium' as const,
  bannerCerrado: false,
  alCerrarBanner: vi.fn(),
  alVerPremium: vi.fn(),
};

describe('VistaCampeon (build)', () => {
  it('con una build muestra Importar, el parche y el porcentaje', () => {
    render(<VistaCampeon estado={estado({ estado: 'ok', build })} {...props} />);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeTruthy();
    expect(screen.getByText('Datos del parche 15.20')).toBeTruthy();
    expect(screen.getByText(/52,3 % de victorias/)).toBeTruthy();
    expect(screen.getByText(/1234 partidas/)).toBeTruthy();
    expect(screen.queryByText(t('ui.mezclaParches'))).toBeNull();
  });

  it('avisa de la mezcla de parches', () => {
    render(<VistaCampeon estado={estado({ estado: 'ok', build: { ...build, mezclaParches: true } })} {...props} />);
    expect(screen.getByText(t('ui.mezclaParches'))).toBeTruthy();
  });

  it('sin conexión muestra el texto de datos sin conexión', () => {
    render(<VistaCampeon estado={estado({ estado: 'sin_conexion', build })} {...props} />);
    expect(screen.getByText('Datos sin conexión (parche 15.20)')).toBeTruthy();
  });

  it('con no_disponible muestra el mensaje y no hay botón', () => {
    render(<VistaCampeon estado={estado({ estado: 'no_disponible' })} {...props} />);
    expect(screen.getByText('Build no disponible')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
  });

  it('muestra el mensaje de sin_paginas en español', () => {
    const importacion = {
      runas: { ok: false as const, motivo: 'sin_paginas' as const },
      hechizos: { ok: true as const },
      objetos: { ok: true as const },
    };
    render(<VistaCampeon estado={estado({ estado: 'ok', build })} {...props} importacion={importacion} />);
    expect(
      screen.getByText('No quedan páginas de runas libres. Borra una página y vuelve a intentarlo.'),
    ).toBeTruthy();
  });

  it('el botón Importar y el selector de rol llaman a sus acciones', async () => {
    const onImportar = vi.fn();
    const onCambiarRol = vi.fn();
    render(<VistaCampeon estado={estado({ estado: 'ok', build })} {...props} onImportar={onImportar} onCambiarRol={onCambiarRol} />);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onImportar).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Inferior' }));
    expect(onCambiarRol).toHaveBeenCalledWith('BOTTOM');
  });
});

describe('PieLegal', () => {
  it('contiene el aviso legal', () => {
    render(<PieLegal />);
    expect(
      screen.getByText(
        'Coach LoL IA no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.',
      ),
    ).toBeTruthy();
  });
});
