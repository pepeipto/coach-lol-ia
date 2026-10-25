// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { textoTiempos } from '../src/renderer/principal/vistas/TarjetaBuild';
import { CuerpoBuild } from '../src/renderer/principal/vistas/VistaCampeon';
import { establecerIdioma, t } from '../src/shared/i18n';
import type { RecursosBuild } from '../src/shared/tiposApp';

/* 3.10 · Tiempos objetivo debajo del núcleo (mejora 11) y tarjeta «Rendimiento de objetos» (mejora 13). */

afterEach(() => {
  cleanup();
  establecerIdioma('es');
});

const recursos: RecursosBuild = {
  objetos: { 6655: 'Tormento de Luden', 3157: 'Reloj de arena de Zhonya', 3089: 'Sombrero mortal de Rabadon', 3020: 'Botas' },
  runas: {},
  hechizos: {},
};

const build: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 400,
  tasaVictoria: 0.51,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655, 3157, 3089],
  botas: 3020,
  situacionales: [],
  ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'],
  calculadoEn: '2026-10-25T00:00:00Z',
  tiempos: {
    ganadas: { objeto1: 10.6, objeto2: 18, objeto3: 25, botas: 13.8 },
    todas: { objeto1: 11.5, objeto2: 19, objeto3: 26, botas: 14.5 },
    partidas: 380,
  },
  rendimientoObjetos: [
    { id: 6655, partidas: 360, uso: 0.9, tasaVictoria: 0.51, diferencia: 0.4, datosLimitados: false },
    { id: 3157, partidas: 160, uso: 0.4, tasaVictoria: 0.55, diferencia: 6.2, datosLimitados: false },
    { id: 3089, partidas: 30, uso: 0.075, tasaVictoria: 0.47, diferencia: -4.1, datosLimitados: true },
  ],
};

function montar(b: Build, base?: Build) {
  render(<CuerpoBuild build={b} base={base} opciones={[b]} opcion={0} recursos={recursos} version="15.20.1" alCambiarOpcion={vi.fn()} />);
}

const filas = () =>
  within(screen.getByRole('table', { name: t('rendimiento.titulo') }))
    .getAllByRole('row')
    .slice(1)
    .map((f) => within(f).getByRole('rowheader').textContent);

describe('tiempos objetivo en la tarjeta de objetos', () => {
  it('«Objeto 1 hacia el minuto 11 · botas a los 14» (partidas ganadas, redondeado)', () => {
    expect(textoTiempos(build)).toBe('Objeto 1 hacia el minuto 11 · botas a los 14');
    montar(build);
    expect(screen.getByText('Objeto 1 hacia el minuto 11 · botas a los 14')).toBeTruthy();
  });

  it('sin el dato de las ganadas, el de todas; solo botas; sin tiempos, nada', () => {
    const sinGanadas = { ...build, tiempos: { ...build.tiempos!, ganadas: { objeto1: null, objeto2: null, objeto3: null, botas: null } } };
    expect(textoTiempos(sinGanadas)).toBe('Objeto 1 hacia el minuto 12 · botas a los 15');
    const soloBotas = { ...build, tiempos: { ganadas: { objeto1: null, objeto2: null, objeto3: null, botas: 14 }, todas: { objeto1: null, objeto2: null, objeto3: null, botas: 14 }, partidas: 40 } };
    expect(textoTiempos(soloBotas)).toBe('Botas hacia el minuto 14');
    expect(textoTiempos({ ...build, tiempos: undefined })).toBeNull();
  });

  it('en los cinco idiomas hay texto (no la clave)', () => {
    for (const idioma of ['en', 'pt-BR', 'fr', 'de'] as const) {
      establecerIdioma(idioma);
      expect(textoTiempos(build)).not.toMatch(/build\./);
    }
  });
});

describe('tarjeta «Rendimiento de objetos»', () => {
  it('uso, % de victorias y diferencia, de más a menos usado, con «datos limitados»', () => {
    montar(build);
    expect(screen.getByText(t('rendimiento.titulo'))).toBeTruthy();
    expect(filas()).toEqual(['Tormento de Luden', 'Reloj de arena de Zhonya', `Sombrero mortal de Rabadon${t('rendimiento.datosLimitados')}`]);
    const zhonya = screen.getByRole('rowheader', { name: /Zhonya/ }).closest('tr')!;
    expect(within(zhonya).getByText('40 %')).toBeTruthy();
    expect(within(zhonya).getByText('55 %')).toBeTruthy();
    expect(within(zhonya).getByText('+6,2 %')).toBeTruthy();
    expect(screen.getByText('−4,1 %').className).toContain('baja');
    expect(screen.getByText(t('rendimiento.pie'))).toBeTruthy();
  });

  it('ordenable por % de victorias y por diferencia (pulsar dos veces invierte)', async () => {
    montar(build);
    const boton = (clave: string) => screen.getByRole('button', { name: new RegExp(t(clave)) });
    await userEvent.click(boton('rendimiento.victorias'));
    expect(filas()[0]).toContain('Zhonya');
    expect(boton('rendimiento.victorias').closest('th')!.getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(boton('rendimiento.diferencia'));
    expect(filas()[2]).toContain('Rabadon');
    await userEvent.click(boton('rendimiento.diferencia'));
    expect(filas()[0]).toContain('Rabadon');
    expect(boton('rendimiento.diferencia').closest('th')!.getAttribute('aria-sort')).toBe('ascending');
  });

  it('la opción elegida sin datos usa los de la build de arriba', () => {
    const opcion = { ...build, tiempos: undefined, rendimientoObjetos: undefined };
    montar(opcion, build);
    expect(screen.getByText(t('rendimiento.titulo'))).toBeTruthy();
    expect(screen.getByText('Objeto 1 hacia el minuto 11 · botas a los 14')).toBeTruthy();
  });

  it('sin datos no hay tarjeta; en Arena nunca (norma de Riot), aunque llegaran', () => {
    montar({ ...build, rendimientoObjetos: undefined });
    expect(screen.queryByText(t('rendimiento.titulo'))).toBeNull();
    cleanup();
    montar({ ...build, rol: null, modo: 'arena', arena: { posicionMedia: 4, top4: 0.5, victorias: 0.15 } });
    expect(screen.queryByText(t('rendimiento.titulo'))).toBeNull();
    expect(screen.queryByText(/Objeto 1 hacia el minuto/)).toBeNull();
  });
});
