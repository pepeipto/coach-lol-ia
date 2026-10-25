// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TarjetaEstadisticasPersonales } from '../src/renderer/principal/vistas/EstadisticasPersonales';
import type { Perfil } from '../src/shared/perfil';
import type { EstadisticasPersonales, RespuestaPersonal } from '../src/shared/personal';
import type { ApiCoach } from '../src/shared/tiposApp';

const perfil = {
  invocador: null,
  rangos: [],
  pl: [],
  partidas: [],
  campeones: [],
  tendencias: [],
  reto: null,
  retoSugerido: 'cs7',
  actualizado: null,
  conectado: false,
  version: '15.20.1',
  campeonesDD: { 103: { id: 'Ahri', nombre: 'Ahri' }, 238: { id: 'Zed', nombre: 'Zed' }, 157: { id: 'Yasuo', nombre: 'Yasuo' }, 222: { id: 'Jinx', nombre: 'Jinx' }, 51: { id: 'Caitlyn', nombre: 'Caitlyn' } },
} as Perfil;

const llenas: EstadisticasPersonales = {
  partidas: 20,
  partidasConRival: 20,
  counters: [
    { campeonId: 103, rivalId: 238, rol: 'MIDDLE', partidas: 4, victorias: 1, winrate: 0.25, nota: 55, kda: 2, pocas: true },
    { campeonId: 103, rivalId: 157, rol: 'MIDDLE', partidas: 5, victorias: 4, winrate: 0.8, nota: 66, kda: 4, pocas: true },
  ],
  tierList: [
    { campeonId: 222, rol: 'BOTTOM', partidas: 9, victorias: 6, winrate: 0.6667, winrateSuavizado: 0.5789, kda: 5, nota: 70, puntos: 62.7, tier: 'S', pocas: false },
    { campeonId: 103, rol: 'MIDDLE', partidas: 11, victorias: 5, winrate: 0.4545, winrateSuavizado: 0.4762, kda: 3, nota: 60, puntos: 52.6, tier: 'B', pocas: false },
  ],
  peoresRivales: [{ rivalId: 238, rol: 'MIDDLE', partidas: 7, victorias: 1, derrotas: 6, winrate: 0.1429, winrateSuavizado: 0.3529, nota: 50, pocas: true }],
  faltan: { tierList: 0, counters: 0, rivales: 0 },
};

function montar(e: EstadisticasPersonales) {
  const respuesta: RespuestaPersonal = { estadisticas: e, counters: null, enfrentamiento: null };
  window.coach = { estadisticasPersonales: vi.fn().mockResolvedValue(respuesta) } as unknown as ApiCoach;
  render(<TarjetaEstadisticasPersonales perfil={perfil} />);
}

afterEach(cleanup);

describe('Tus estadísticas (Perfil)', () => {
  it('pide los datos por la IPC y enseña la tier list con iconos y tier', async () => {
    montar(llenas);
    const tabla = await screen.findByRole('table', { name: 'Tu tier list' });
    expect(window.coach.estadisticasPersonales).toHaveBeenCalledWith();
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(3);
    expect(within(filas[1]!).getByText('S')).toBeTruthy();
    expect(within(filas[1]!).getByText('Jinx')).toBeTruthy();
    expect(within(filas[1]!).getByRole('img', { name: 'Jinx' })).toBeTruthy();
  });

  it('ordena por columna y filtra por rol', async () => {
    montar(llenas);
    const tabla = await screen.findByRole('table', { name: 'Tu tier list' });
    await userEvent.click(within(tabla).getByRole('button', { name: 'Partidas' }));
    expect(within(within(tabla).getAllByRole('row')[1]!).getByText('Ahri')).toBeTruthy();
    expect(within(tabla).getByRole('columnheader', { name: 'Partidas' }).getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(screen.getByRole('button', { name: 'Inferior' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Superior' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/En Superior todavía no hay nada con 3 partidas/)).toBeTruthy();
  });

  it('counters del peor al mejor con aviso de pocas partidas, y peores rivales', async () => {
    montar(llenas);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('tab', { name: 'Tus counters' }));
    const tabla = screen.getByRole('table', { name: 'Tus counters' });
    const filas = within(tabla).getAllByRole('row');
    expect(within(filas[1]!).getByText('Zed')).toBeTruthy();
    expect(within(filas[1]!).getByText('Pocas partidas')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: 'Tus peores rivales' }));
    const rivales = screen.getByRole('table', { name: 'Tus peores rivales' });
    expect(within(rivales).getByText('Zed')).toBeTruthy();
  });

  it('con pocos datos, un estado vacío que dice cuántas partidas faltan', async () => {
    montar({ partidas: 2, partidasConRival: 2, counters: [], tierList: [], peoresRivales: [], faltan: { tierList: 1, counters: 1, rivales: 1 } });
    expect(await screen.findByText('Aún no hay bastantes partidas')).toBeTruthy();
    expect(screen.getByText(/Llevas 2 partidas de la Grieta guardadas.*te faltan 1 con tu campeón más jugado/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
