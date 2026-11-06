// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizarAjustes } from '../src/main/ajustes';
import { crearOrquestadorTft } from '../src/main/orquestador/tft';
import { crearClienteTft } from '../src/main/tft';
import { ChuletaTft } from '../src/renderer/overlay/widgets/ChuletaTft';
import { VistaTft } from '../src/renderer/principal/vistas/VistaTft';
import { establecerIdioma } from '../src/shared/i18n';
import type { Ajustes, RespuestaTft } from '../src/shared/tiposApp';
import {
  alternarEnChuleta,
  COMPONENTES_TFT,
  esColaTft,
  normalizarChuletaTft,
  RECETAS_TFT,
  recetaDe,
  type ChuletaTftVista,
  type CompChuletaTft,
  type PanelTft,
} from '../src/shared/tftChuleta';

const COMP: CompChuletaTft = {
  id: 'DA_18_Blossom+DA_18_Invoker|18_Ahri',
  rasgos: ['DA_18_Blossom', 'DA_18_Invoker'],
  portador: '18_Ahri',
  unidades: ['18_Ahri', 'Krug18'],
  objetosPortador: ['TFT_Item_JeweledGauntlet', 'TFT_Item_ArtifactX'],
  parche: '16.22',
};

describe('TFT chuleta: datos', () => {
  it('cada par de componentes tiene una sola receta', () => {
    const vistos = new Set<string>();
    for (const [a, b] of RECETAS_TFT) {
      expect(COMPONENTES_TFT.some((c) => c.id === a) && COMPONENTES_TFT.some((c) => c.id === b)).toBe(true);
      const clave = [a, b].sort().join('+');
      expect(vistos.has(clave)).toBe(false);
      vistos.add(clave);
    }
    // 8 componentes: 8 · 9 / 2 = 36 combinaciones.
    expect(vistos.size).toBe(36);
    expect(recetaDe('TFT_Item_InfinityEdge')).toEqual(['TFT_Item_BFSword', 'TFT_Item_SparringGloves']);
    expect(recetaDe('TFT_Item_ArtifactX')).toBeNull();
  });

  it('reconoce las colas de TFT por gameMode o por id', () => {
    expect(esColaTft(1100)).toBe(true);
    expect(esColaTft(1090, 'TFT')).toBe(true);
    expect(esColaTft(420, 'CLASSIC')).toBe(false);
    expect(esColaTft(9999, 'TFT')).toBe(true);
    expect(esColaTft(1100, 'CLASSIC')).toBe(false);
    expect(esColaTft(null)).toBe(false);
  });

  it('normaliza la chuleta de los ajustes: como mucho 2, sin repetir y con ids válidos', () => {
    const otra = { ...COMP, id: 'b|x' };
    const tercera = { ...COMP, id: 'c|x' };
    expect(normalizarChuletaTft([COMP, COMP, { id: '../mal', portador: 'x', unidades: ['a'] }, otra, tercera])).toEqual([COMP, otra]);
    expect(normalizarChuletaTft('nada')).toEqual([]);
    expect(normalizarChuletaTft([{ ...COMP, unidades: [] }])).toEqual([]);
    expect(normalizarAjustes({}).tftChuleta).toEqual([]);
    expect(normalizarAjustes({ tftChuleta: [COMP] }).tftChuleta).toEqual([COMP]);
  });

  it('elegir una tercera sustituye a la más antigua; elegir una que ya está la quita', () => {
    const a = { ...COMP, id: 'a|x' };
    const b = { ...COMP, id: 'b|x' };
    const c = { ...COMP, id: 'c|x' };
    expect(alternarEnChuleta([a, b], c).map((x) => x.id)).toEqual(['b|x', 'c|x']);
    expect(alternarEnChuleta([a, b], a).map((x) => x.id)).toEqual(['b|x']);
  });
});

describe('TFT chuleta: cliente', () => {
  it('pone nombres e iconos y la receta de los objetos del portador', async () => {
    const fetch = (async (url: string) => {
      if (String(url).endsWith('es_ES/tft-item.json'))
        return new Response(
          JSON.stringify({
            data: {
              TFT_Item_JeweledGauntlet: { id: 'TFT_Item_JeweledGauntlet', name: 'Guantelete enjoyado', image: { full: 'g.png', group: 'tft-item' } },
              TFT_Item_NeedlesslyLargeRod: { id: 'TFT_Item_NeedlesslyLargeRod', name: 'Vara innecesariamente grande', image: { full: 'v.png', group: 'tft-item' } },
            },
          }),
        );
      return new Response('no', { status: 404 });
    }) as unknown as typeof globalThis.fetch;
    const ch = await crearClienteTft({ urlServidor: 'https://x', fetch }).chuleta('16.22.1', 'es_ES', [COMP]);
    const objetos = ch.comps[0].objetos;
    expect(objetos[0].nombre).toBe('Guantelete enjoyado');
    expect(objetos[0].receta?.[0].nombre).toBe('Vara innecesariamente grande');
    // Sin Data Dragon, el nombre en inglés.
    expect(objetos[0].receta?.[1].nombre).toBe('Sparring Gloves');
    expect(objetos[1].receta).toBeUndefined();
    expect(ch.componentes).toHaveLength(8);
    expect(ch.tabla[2][7]?.nombre).toBe('Guantelete enjoyado');
    expect(ch.tabla[7][2]?.nombre).toBe('Guantelete enjoyado');
  });
});

function falsoOverlay() {
  const llamadas: string[] = [];
  const paneles: PanelTft[] = [];
  return {
    llamadas,
    paneles,
    overlay: {
      mostrar: () => void llamadas.push('mostrar'),
      ocultar: () => void llamadas.push('ocultar'),
      enviarModo: (m: string) => void llamadas.push(`modo:${m}`),
      enviarTft: (p: PanelTft) => void paneles.push(p),
    },
  };
}

const VISTA: ChuletaTftVista = { comps: [], componentes: [], tabla: [] };

describe('TFT chuleta: orquestador', () => {
  it('en una partida de TFT con chuleta, la tecla abre y cierra el panel; al acabar se retira', async () => {
    const f = falsoOverlay();
    const activa = vi.fn();
    const tft = crearOrquestadorTft({ overlay: f.overlay, elegidas: () => [COMP], tecla: () => 'CommandOrControl+Shift+O', preparar: async () => VISTA, alCambiarActiva: activa });
    tft.cola(1100, { gameMode: 'TFT' });
    tft.fase('InProgress');
    await vi.waitFor(() => expect(f.llamadas).toContain('modo:tft'));
    expect(tft.esTft()).toBe(true);
    expect(tft.activa()).toBe(true);
    expect(activa).toHaveBeenCalledWith(true);
    // Empieza cerrado: el overlay no se muestra hasta pulsar la tecla.
    expect(f.llamadas).not.toContain('mostrar');
    expect(f.paneles.at(-1)).toEqual({ abierto: false, chuleta: VISTA, tecla: 'CommandOrControl+Shift+O' });
    tft.alternar();
    expect(f.llamadas.at(-1)).toBe('mostrar');
    expect(f.paneles.at(-1)?.abierto).toBe(true);
    tft.alternar();
    expect(f.llamadas.at(-1)).toBe('ocultar');
    tft.fase('Reconnect');
    expect(tft.activa()).toBe(true);
    tft.fase('EndOfGame');
    expect(tft.activa()).toBe(false);
    expect(f.paneles.at(-1)).toBeNull();
    expect(activa).toHaveBeenLastCalledWith(false);
  });

  it('sin chuleta elegida o en LoL no hace nada', () => {
    const f = falsoOverlay();
    const sinChuleta = crearOrquestadorTft({ overlay: f.overlay, elegidas: () => [], tecla: () => 'x', preparar: async () => VISTA });
    sinChuleta.cola(1100);
    sinChuleta.fase('InProgress');
    expect(sinChuleta.esTft()).toBe(true);
    expect(sinChuleta.activa()).toBe(false);
    const lol = crearOrquestadorTft({ overlay: f.overlay, elegidas: () => [COMP], tecla: () => 'x', preparar: async () => VISTA });
    lol.cola(420, { gameMode: 'CLASSIC' });
    lol.fase('InProgress');
    expect(lol.esTft()).toBe(false);
    expect(lol.activa()).toBe(false);
    expect(f.llamadas).toEqual([]);
  });

  it('una preparación que llega con la partida ya acabada no se envía', async () => {
    const f = falsoOverlay();
    let soltar: (v: ChuletaTftVista) => void = () => {};
    const tft = crearOrquestadorTft({ overlay: f.overlay, elegidas: () => [COMP], tecla: () => 'x', preparar: () => new Promise((r) => (soltar = r)) });
    tft.cola(1100);
    tft.fase('InProgress');
    tft.fase('EndOfGame');
    soltar(VISTA);
    await Promise.resolve();
    expect(f.llamadas).not.toContain('modo:tft');
  });
});

describe('TFT chuleta: pantallas', () => {
  afterEach(() => {
    cleanup();
    delete (window as { coach?: unknown }).coach;
  });

  it('el panel del overlay enseña campeones, receta y la mención de IA', () => {
    establecerIdioma('es');
    const e = (id: string, nombre: string) => ({ id, nombre });
    render(
      <ChuletaTft
        tecla="CommandOrControl+Shift+O"
        chuleta={{
          comps: [{ id: 'c', rasgos: [e('r', 'Florecer')], portador: e('a', 'Ahri'), unidades: [e('a', 'Ahri'), e('k', 'Krug')], objetos: [{ ...e('o', 'Guantelete'), receta: [e('v', 'Vara'), e('g', 'Guantes')] }] }],
          componentes: [e('v', 'Vara')],
          tabla: [[e('r2', 'Rabadon')]],
        }}
      />,
    );
    expect(screen.getByText('Florecer')).toBeTruthy();
    expect(screen.getByText('Krug')).toBeTruthy();
    expect(screen.getByLabelText('Se hace con Vara y Guantes')).toBeTruthy();
    expect(screen.getByText(/Hecho con ayuda de IA/)).toBeTruthy();
  });

  it('en la pestaña TFT se lleva una composición a la chuleta', async () => {
    establecerIdioma('es');
    const tft: RespuestaTft = {
      ok: true,
      locale: 'es_ES',
      parche: '16.22',
      partidas: 10,
      comps: [
        {
          id: COMP.id,
          tier: 'S',
          rasgos: [{ id: 'DA_18_Blossom', nombre: 'Florecer' }],
          portador: { id: '18_Ahri', nombre: 'Ahri' },
          unidades: [{ id: '18_Ahri', nombre: 'Ahri', frecuencia: 1 }],
          objetosPortador: [{ id: 'TFT_Item_JeweledGauntlet', nombre: 'Guantelete' }],
          nivelMedio: 8,
          tableros: 10,
          frecuencia: 0.1,
          puestoMedio: 4,
          top4: 0.5,
          victorias: 0.1,
        },
      ],
    };
    const guardar = vi.fn(async (_a: Ajustes) => undefined);
    (window as unknown as { coach: unknown }).coach = { tft: async () => tft, obtenerAjustes: async () => normalizarAjustes({}), guardarAjustes: guardar };
    render(<VistaTft />);
    expect(await screen.findByText('Aún no has elegido ninguna composición.')).toBeTruthy();
    await userEvent.click(screen.getByTitle('Llevar esta composición en la chuleta de la partida'));
    expect(guardar).toHaveBeenCalled();
    const guardada = guardar.mock.calls[0][0].tftChuleta;
    expect(guardada).toEqual([{ id: COMP.id, rasgos: ['DA_18_Blossom'], portador: '18_Ahri', unidades: ['18_Ahri'], objetosPortador: ['TFT_Item_JeweledGauntlet'], parche: '16.22' }]);
    expect(screen.getByText('En la chuleta')).toBeTruthy();
  });
});
