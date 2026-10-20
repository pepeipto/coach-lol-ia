// @vitest-environment jsdom
// 3.1: «Importar» sin páginas de runas libres: confirmación antes de sustituir una página del jugador.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { t } from '../src/shared/i18n';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach, EstadoLicencia, EstadoPrincipal } from '../src/shared/tiposApp';

const ajustes: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: true,
  teclaOverlay: 'Alt+C',
  posicionOverlay: null,
  bienvenidaVista: true,
  ultimaVersionVista: VERSION_ACTUAL,
  overlay: AJUSTES_POR_DEFECTO.overlay,
  teclasJungla: {},
  teclaJungla: 'Alt+Shift+L',
  junglaEnemiga: { avisos: true, ruta: false },
  idioma: 'es',
  tema: 'clasico',
  ia: { analisis: true, consejos: true, maxConsejos: 6, vozAnalisis: true },
};

function estadoBase(cliente: EstadoPrincipal['cliente']): EstadoPrincipal {
  return {
    cliente,
    seleccion: null,
    version: '16.20.1',
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    error: null,
    importacion: null,
    aviso: null,
  };
}

let emitir: (e: EstadoPrincipal) => void = () => {};

function api(): ApiCoach {
  return {
    alCambiarEstado: (cb) => {
      emitir = cb;
    },
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    cambiarRunas: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn().mockResolvedValue({ ok: true, respuesta: 'Hola' }),
    obtenerAjustes: vi.fn().mockResolvedValue(ajustes),
    guardarAjustes: vi.fn().mockResolvedValue(undefined),
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    // Aún no hay manejador en el proceso principal: la app debe tratarlo como plan gratuito.
    licencia: vi.fn().mockRejectedValue(new Error('No handler registered')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
    campeones: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    buildDe: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
  };
}

function estadoConSeleccion(): EstadoPrincipal {
  return {
    ...estadoBase('conectado'),
    recursos: { objetos: { 3157: 'Reloj de arena' }, runas: {}, hechizos: {} },
    seleccion: {
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE'],
      opcion: 0,
      resultado: {
        estado: 'ok',
        build: {
          campeon: 'Ahri', rol: 'MIDDLE', parche: '16.20', partidas: 100, tasaVictoria: 0.51, mezclaParches: false,
          runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
          hechizos: [4, 14], objetosIniciales: [1056], nucleo: [3157], botas: 3020, situacionales: [],
          ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'],
          calculadoEn: '',
        },
      },
    },
  };
}


const OK = { ok: true } as const;
const SIN_PAGINAS = {
  runas: { ok: false, motivo: 'sin_paginas', sustituible: { id: 7, nombre: 'Mi página' } },
  hechizos: OK,
  objetos: OK,
} as const;

beforeEach(() => {
  window.coach = api();
});
afterEach(cleanup);

async function pulsarImportar() {
  render(<App />);
  act(() => emitir(estadoConSeleccion()));
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(t('ui.importar')) }));
}

describe('3.1: sustituir una página de runas al importar', () => {
  it('sin páginas libres pregunta con el nombre de la página; «Sustituir» importa con su id', async () => {
    const importar = vi.mocked(window.coach.importar);
    importar.mockResolvedValueOnce(SIN_PAGINAS as never).mockResolvedValueOnce({ runas: OK, hechizos: OK, objetos: OK });
    await pulsarImportar();
    expect(importar).toHaveBeenNthCalledWith(1, undefined);
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo.textContent).toContain(t('runas.sustituir.texto', { nombre: 'Mi página' }));
    await userEvent.click(screen.getByRole('button', { name: t('runas.sustituir.confirmar') }));
    expect(importar).toHaveBeenNthCalledWith(2, { sustituirPagina: 7 });
    expect(window.coach.guardarAjustes).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('«Cancelar» no borra nada: no hay segunda importación y queda el aviso', async () => {
    const importar = vi.mocked(window.coach.importar);
    importar.mockResolvedValueOnce(SIN_PAGINAS as never);
    await pulsarImportar();
    await userEvent.click(await screen.findByRole('button', { name: t('runas.sustituir.cancelar') }));
    expect(importar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText(t('ui.sinPaginas'))).toBeTruthy();
  });

  it('«No volver a preguntar» se guarda en los ajustes antes de sustituir', async () => {
    const importar = vi.mocked(window.coach.importar);
    importar.mockResolvedValueOnce(SIN_PAGINAS as never).mockResolvedValueOnce({ runas: OK, hechizos: OK, objetos: OK });
    await pulsarImportar();
    await userEvent.click(await screen.findByLabelText(t('runas.sustituir.noPreguntar')));
    await userEvent.click(screen.getByRole('button', { name: t('runas.sustituir.confirmar') }));
    expect(window.coach.guardarAjustes).toHaveBeenCalledWith(expect.objectContaining({ sustituirPaginaSinPreguntar: true }));
    expect(importar).toHaveBeenNthCalledWith(2, { sustituirPagina: 7 });
  });

  it('sin ninguna página que se pueda sustituir no pregunta y lo explica', async () => {
    vi.mocked(window.coach.importar).mockResolvedValueOnce({ runas: { ok: false, motivo: 'sin_paginas' }, hechizos: OK, objetos: OK });
    await pulsarImportar();
    expect(await screen.findByText(t('ui.sinPaginasNinguna'))).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
