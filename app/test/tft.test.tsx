// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearClienteTft, registrarIpcTft } from '../src/main/tft';
import { VistaTft } from '../src/renderer/principal/vistas/VistaTft';
import { establecerIdioma } from '../src/shared/i18n';
import type { RespuestaTft } from '../src/shared/tiposApp';

const COMPS = {
  parche: '16.22',
  partidas: 209,
  comps: [
    {
      id: 'DA_18_Blossom+DA_18_Invoker|18_Ahri',
      rasgos: ['DA_18_Blossom', 'DA_18_Invoker'],
      portador: '18_Ahri',
      unidades: [
        { id: '18_Ahri', frecuencia: 1 },
        { id: 'Krug18', frecuencia: 0.6 },
      ],
      objetosPortador: ['TFT_Item_JeweledGauntlet'],
      nivelMedio: 8.2,
      tier: 'S',
      tableros: 45,
      frecuencia: 0.03,
      puestoMedio: 3.84,
      top4: 0.644,
      victorias: 0.2,
    },
  ],
};

function fetchFalso(rutas: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const clave = Object.keys(rutas).find((k) => String(url).endsWith(k));
    if (!clave) return new Response('no', { status: 404 });
    return new Response(JSON.stringify(rutas[clave]), { status: 200 });
  }) as unknown as typeof fetch;
}

const DD_CAMPEONES = { data: { TFT18_Ahri: { id: 'TFT18_Ahri', name: 'Ahri', image: { full: 'TFT18_Ahri.png', group: 'tft-champion' } } } };
const DD_RASGOS_ES = { data: { TFT18_Blossom: { id: 'TFT18_Blossom', name: 'Florecer' }, TFT18_Invoker: { id: 'TFT18_Invoker', name: 'Invocador' } } };
const DD_OBJETOS_ES = { data: { TFT_Item_JeweledGauntlet: { id: 'TFT_Item_JeweledGauntlet', name: 'Guantelete enjoyado', image: { full: 'g.png', group: 'tft-item' } } } };

describe('TFT: cliente', () => {
  it('pone nombres de Data Dragon y nombres legibles cuando no los hay', async () => {
    const cliente = crearClienteTft({
      urlServidor: 'https://api.ejemplo',
      fetch: fetchFalso({
        '/tft/comps': COMPS,
        'es_MX/tft-champion.json': DD_CAMPEONES,
        'es_MX/tft-trait.json': DD_RASGOS_ES,
        'es_MX/tft-item.json': DD_OBJETOS_ES,
      }),
    });
    const r = await cliente.comps('16.22.1', 'es_MX');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.comps[0];
    expect(c.rasgos.map((x) => x.nombre)).toEqual(['Florecer', 'Invocador']);
    expect(c.portador).toEqual({ id: '18_Ahri', nombre: 'Ahri', icono: 'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/tft-champion/TFT18_Ahri.png' });
    expect(c.unidades[1].nombre).toBe('Krug');
    expect(c.objetosPortador[0].nombre).toBe('Guantelete enjoyado');
  });

  it('sin datos o sin conexión', async () => {
    expect(await crearClienteTft({ urlServidor: 'https://x', fetch: fetchFalso({}) }).comps('1', 'es_MX')).toEqual({ ok: false, motivo: 'sin_datos' });
    const caido = (async () => {
      throw new Error('red');
    }) as unknown as typeof fetch;
    expect(await crearClienteTft({ urlServidor: 'https://x', fetch: caido }).comps('1', 'es_MX')).toEqual({ ok: false, motivo: 'sin_conexion' });
  });

  it('el IPC solo responde a la ventana principal y valida el id', async () => {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const cliente = { comps: vi.fn(async () => ({ ok: false, motivo: 'sin_datos' }) as RespuestaTft), objetos: vi.fn() };
    registrarIpcTft({ handle: (c, m) => void manejadores.set(c, m) }, { esPrincipal: (s) => s === 'ok', version: async () => '1', locale: () => 'es_MX', cliente: () => cliente });
    await expect(manejadores.get('coach:tft')!({ sender: 'otro' })).rejects.toThrow();
    expect(await manejadores.get('coach:tft')!({ sender: 'ok' })).toEqual({ ok: false, motivo: 'sin_datos' });
    await expect(manejadores.get('coach:tft-objetos')!({ sender: 'ok' }, '../x')).rejects.toThrow();
  });
});

describe('TFT: vista', () => {
  afterEach(() => {
    cleanup();
    delete (window as { coach?: unknown }).coach;
  });

  it('pinta la tier list y abre los objetos de un campeón', async () => {
    establecerIdioma('es');
    const cliente = crearClienteTft({
      urlServidor: 'https://api.ejemplo',
      fetch: fetchFalso({ '/tft/comps': COMPS, 'es_MX/tft-champion.json': DD_CAMPEONES, 'es_MX/tft-trait.json': DD_RASGOS_ES }),
    });
    const tft = await cliente.comps('16.22.1', 'es_MX');
    const tftObjetos = vi.fn(async () => ({
      ok: true as const,
      objetos: { campeon: { id: '18_Ahri', nombre: 'Ahri' }, tableros: 50, juegos: [], populares: [{ id: 'x', nombre: 'Vara', frecuencia: 0.5 }] },
    }));
    (window as unknown as { coach: unknown }).coach = { tft: async () => tft, tftObjetos };
    render(<VistaTft />);
    expect(await screen.findByText('Florecer + Invocador')).toBeTruthy();
    expect(screen.getByText(/209 partidas/)).toBeTruthy();
    expect(screen.getByText(/Hecho con ayuda de IA/)).toBeTruthy();
    await userEvent.click(screen.getByTitle('Ver los mejores objetos de Ahri'));
    expect(await screen.findByText('Mejores objetos de Ahri')).toBeTruthy();
    expect(tftObjetos).toHaveBeenCalledWith('18_Ahri');
  });

  it('sin datos, un estado vacío con reintentar', async () => {
    establecerIdioma('es');
    (window as unknown as { coach: unknown }).coach = { tft: async () => ({ ok: false, motivo: 'sin_datos' }) };
    render(<VistaTft />);
    expect(await screen.findByText('Aún no hay datos de TFT')).toBeTruthy();
  });
});
