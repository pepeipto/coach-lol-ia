// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, EntradaCampeon } from '@coach/shared';
import { VistaCampeones } from '../src/renderer/principal/vistas/VistaCampeones';
import { t } from '../src/shared/i18n';
import type { ApiCoach, EstadoPrincipal, RespuestaBuildDe, RespuestaCampeones } from '../src/shared/tiposApp';

afterEach(cleanup);

const CAMPEONES = [
  { id: 'Ahri', nombre: 'Ahri', key: 103 },
  { id: 'Kaisa', nombre: "Kai'Sa", key: 145 },
  { id: 'MonkeyKing', nombre: 'Wukong', key: 62 },
  { id: 'Nunu', nombre: 'Nunu y Willump', key: 20 },
];

const entrada = (o: Partial<EntradaCampeon> & Pick<EntradaCampeon, 'campeon' | 'rol'>): EntradaCampeon => ({
  partidas: 500,
  tasaVictoria: 0.5,
  uso: 0.1,
  tier: 'B',
  datosLimitados: false,
  ...o,
});

const LISTA: RespuestaCampeones = {
  ok: true,
  modo: 'clasificatoria',
  version: '15.20.1',
  campeones: CAMPEONES,
  resultado: {
    estado: 'ok',
    lista: {
      parche: '15.20',
      campeones: [
        entrada({ campeon: 'Ahri', rol: 'MIDDLE', tier: 'S', tasaVictoria: 0.535, uso: 0.12, partidas: 1500 }),
        entrada({ campeon: 'Kaisa', rol: 'BOTTOM', tier: 'A', tasaVictoria: 0.51, uso: 0.3, partidas: 4000 }),
        entrada({ campeon: 'MonkeyKing', rol: 'TOP', tier: 'C', tasaVictoria: 0.47, uso: 0.02, partidas: 20, datosLimitados: true }),
      ],
    },
  },
};

const BUILD: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 1500,
  tasaVictoria: 0.535,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655, 3157],
  botas: 3020,
  situacionales: [3135],
  ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'],
  calculadoEn: '',
};

const DETALLE: RespuestaBuildDe = {
  ok: true,
  campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
  rol: 'MIDDLE',
  rolesDisponibles: ['MIDDLE'],
  resultado: { estado: 'ok', build: BUILD },
  version: '15.20.1',
  recursos: { objetos: { 1056: 'Anillo de Doran' }, runas: {}, hechizos: {} },
};

let campeones: ReturnType<typeof vi.fn>;
let buildDe: ReturnType<typeof vi.fn>;

beforeEach(() => {
  campeones = vi.fn().mockResolvedValue(LISTA);
  buildDe = vi.fn().mockResolvedValue(DETALLE);
  window.coach = { campeones, buildDe } as unknown as ApiCoach;
});

const props = {
  estado: null as EstadoPrincipal | null,
  importacion: null,
  onImportar: vi.fn(),
  onCambiarOpcion: vi.fn(),
};

async function montar(p: Partial<typeof props> = {}) {
  render(<VistaCampeones {...props} {...p} />);
  await screen.findByRole('table', { name: t('campeones.tabla') });
}

/** Nombres de campeón de las filas de la tabla, en orden. */
function filas(): string[] {
  const tabla = screen.getByRole('table', { name: t('campeones.tabla') });
  return within(tabla)
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.getAttribute('data-campeon') ?? '');
}

describe('VistaCampeones: lista', () => {
  it('muestra la carga mientras llega la lista', async () => {
    let resolver: (r: RespuestaCampeones) => void = () => {};
    campeones.mockReturnValueOnce(new Promise((r) => (resolver = r)));
    render(<VistaCampeones {...props} />);
    expect(screen.getByText(t('campeones.cargando'))).toBeTruthy();
    await act(async () => resolver(LISTA));
    expect(screen.getByRole('table', { name: t('campeones.tabla') })).toBeTruthy();
  });

  it('pide la lista de clasificatoria y muestra el parche', async () => {
    await montar();
    expect(campeones).toHaveBeenCalledWith({ modo: 'clasificatoria' });
    expect(screen.getByText(t('estado.parche', { parche: '15.20' }))).toBeTruthy();
  });

  it('todos los campeones aparecen; los que no tienen datos, en gris con «Sin datos todavía»', async () => {
    await montar();
    expect(filas()).toEqual(['Ahri', 'Kaisa', 'MonkeyKing', 'Nunu']);
    const nunu = screen.getAllByRole('row').find((r) => r.getAttribute('data-campeon') === 'Nunu')!;
    expect(nunu.className).toContain('sin-datos');
    expect(within(nunu).getByText(t('campeones.sinDatos'))).toBeTruthy();
    expect(within(nunu).getByText('Nunu y Willump')).toBeTruthy();
  });

  it('muestra icono, nombre en español, rol, tier, victorias, uso y partidas', async () => {
    await montar();
    const ahri = screen.getAllByRole('row').find((r) => r.getAttribute('data-campeon') === 'Ahri')!;
    expect(within(ahri).getByRole('img', { name: 'Ahri' }).getAttribute('src')).toContain('/15.20.1/img/champion/Ahri.png');
    expect(within(ahri).getByText(t('rol.MIDDLE'))).toBeTruthy();
    expect(within(ahri).getByLabelText(t('campeones.tier', { tier: 'S' })).className).toContain('tier-S');
    expect(within(ahri).getByText('53,5 %')).toBeTruthy();
    expect(within(ahri).getByText('12 %')).toBeTruthy();
    expect(within(ahri).getByText('1500')).toBeTruthy();
    const wukong = screen.getAllByRole('row').find((r) => r.getAttribute('data-campeon') === 'MonkeyKing')!;
    expect(within(wukong).getByText('Wukong')).toBeTruthy();
    expect(within(wukong).getByTitle(t('campeones.datosLimitados'))).toBeTruthy();
  });

  it('busca sin tildes ni signos', async () => {
    await montar();
    await userEvent.type(screen.getByRole('searchbox', { name: t('campeones.buscar') }), 'kaisa');
    expect(filas()).toEqual(['Kaisa']);
    await userEvent.clear(screen.getByRole('searchbox', { name: t('campeones.buscar') }));
    await userEvent.type(screen.getByRole('searchbox', { name: t('campeones.buscar') }), 'zzz');
    expect(screen.getByText(t('campeones.sinResultados', { busqueda: 'zzz' }))).toBeTruthy();
  });

  it('las pestañas de rol filtran (los campeones sin ningún dato siguen visibles)', async () => {
    await montar();
    await userEvent.click(screen.getByRole('tab', { name: t('rol.BOTTOM') }));
    expect(filas()).toEqual(['Kaisa', 'Nunu']);
    await userEvent.click(screen.getByRole('tab', { name: t('campeones.todos') }));
    expect(filas()).toHaveLength(4);
  });

  it('las columnas se ordenan al pulsarlas', async () => {
    await montar();
    const cabecera = screen.getByRole('columnheader', { name: new RegExp(t('campeones.col.uso')) });
    expect(screen.getByRole('columnheader', { name: new RegExp(t('campeones.col.tier')) }).getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(within(cabecera).getByRole('button'));
    expect(cabecera.getAttribute('aria-sort')).toBe('descending');
    expect(filas()).toEqual(['Kaisa', 'Ahri', 'MonkeyKing', 'Nunu']);
    await userEvent.click(within(cabecera).getByRole('button'));
    expect(cabecera.getAttribute('aria-sort')).toBe('ascending');
    expect(filas()).toEqual(['MonkeyKing', 'Ahri', 'Kaisa', 'Nunu']);
  });

  it('sin datos de Data Dragon muestra el error y permite reintentar', async () => {
    campeones.mockResolvedValueOnce({ ok: false, error: 'datos' });
    render(<VistaCampeones {...props} />);
    expect(await screen.findByText(t('campeones.errorTitulo'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('campeones.reintentar') }));
    expect(await screen.findByRole('table', { name: t('campeones.tabla') })).toBeTruthy();
    expect(campeones).toHaveBeenCalledTimes(2);
  });

  it('si main falla, también muestra el error', async () => {
    campeones.mockRejectedValueOnce(new Error('No handler registered'));
    render(<VistaCampeones {...props} />);
    expect(await screen.findByText(t('campeones.errorTitulo'))).toBeTruthy();
  });

  it('sin servidor ni caché avisa y muestra todos los campeones sin datos', async () => {
    campeones.mockResolvedValueOnce({ ...LISTA, resultado: { estado: 'no_disponible' } });
    await montar();
    expect(screen.getByText(t('campeones.sinServidor'))).toBeTruthy();
    expect(filas()).toHaveLength(4);
    expect(screen.getAllByText(t('campeones.sinDatos'))).toHaveLength(4);
  });

  it('con la lista guardada sin conexión lo indica', async () => {
    campeones.mockResolvedValueOnce({ ...LISTA, resultado: { ...LISTA.resultado, estado: 'sin_conexion' } });
    await montar();
    expect(screen.getByText(t('estado.sinConexion', { parche: '15.20' }))).toBeTruthy();
  });
});

describe('VistaCampeones: detalle', () => {
  async function abrirAhri(p: Partial<typeof props> = {}) {
    await montar(p);
    await userEvent.click(screen.getByRole('button', { name: t('campeones.verBuild', { campeon: 'Ahri', rol: t('rol.MIDDLE') }) }));
    await screen.findByRole('heading', { name: 'Ahri' });
  }

  it('al pulsar un campeón muestra su build con los componentes de Campeón, sin «Importar»', async () => {
    await abrirAhri();
    expect(buildDe).toHaveBeenCalledWith('Ahri', 'MIDDLE');
    expect(screen.getByText(t('ui.runas'))).toBeTruthy();
    expect(screen.getByRole('list', { name: t('ui.habilidades') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(t('ui.importar')) })).toBeNull();
  });

  it('los campeones sin datos no se pueden abrir', async () => {
    await montar();
    expect(screen.queryByRole('button', { name: t('campeones.verBuild', { campeon: 'Nunu y Willump', rol: t('rol.TOP') }) })).toBeNull();
  });

  it('«Volver» regresa a la lista conservando la búsqueda', async () => {
    await montar();
    await userEvent.type(screen.getByRole('searchbox', { name: t('campeones.buscar') }), 'ahr');
    await userEvent.click(screen.getByRole('button', { name: t('campeones.verBuild', { campeon: 'Ahri', rol: t('rol.MIDDLE') }) }));
    await screen.findByRole('heading', { name: 'Ahri' });
    await userEvent.click(screen.getByRole('button', { name: t('campeones.volver') }));
    expect((screen.getByRole('searchbox', { name: t('campeones.buscar') }) as HTMLInputElement).value).toBe('ahr');
    expect(filas()).toEqual(['Ahri']);
  });

  it('cambiar de rol pide la build de ese rol', async () => {
    await abrirAhri();
    buildDe.mockResolvedValueOnce({ ...DETALLE, rol: 'TOP', resultado: { estado: 'no_disponible' } });
    await userEvent.click(screen.getByRole('button', { name: t('rol.TOP') }));
    expect(buildDe).toHaveBeenLastCalledWith('Ahri', 'TOP');
    expect(await screen.findByText(t('estado.buildNoDisponible'))).toBeTruthy();
  });

  it('si la build no carga, muestra el error y permite reintentar', async () => {
    await montar();
    buildDe.mockResolvedValueOnce({ ok: false, error: 'datos' });
    await userEvent.click(screen.getByRole('button', { name: t('campeones.verBuild', { campeon: 'Ahri', rol: t('rol.MIDDLE') }) }));
    expect(await screen.findByText(t('campeones.errorBuild'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('campeones.reintentar') }));
    expect(await screen.findByRole('heading', { name: 'Ahri' })).toBeTruthy();
  });

  it('en la selección de campeones con el mismo campeón y rol, ofrece «Importar»', async () => {
    const onImportar = vi.fn();
    const estado: EstadoPrincipal = {
      cliente: 'conectado',
      version: '15.20.1',
      error: null,
      importacion: null,
      aviso: null,
      recursos: { objetos: {}, runas: {}, hechizos: {} },
      seleccion: {
        campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
        rol: 'MIDDLE',
        rolesDisponibles: ['MIDDLE'],
        resultado: { estado: 'ok', build: BUILD },
        opcion: 0,
      },
    };
    await abrirAhri({ estado, onImportar });
    await userEvent.click(screen.getByRole('button', { name: new RegExp(t('ui.importar')) }));
    expect(onImportar).toHaveBeenCalledTimes(1);
  });
});
