import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { AUMENTOS_CAOS, combos, panelAumentos, pesosCampeon, puntuarAumento, tierList, usaMana } from '../src/main/consejos/aumentosCaos';
import { INICIO_S, TRAS_NIVEL_S, VisibilidadAumentos } from '../src/main/consejos/visibilidadAumentos';
import { SelectorFijo } from '../src/main/consejos/variantes';
import { etiquetarAumento, familiaDe, rarezaDe, type AumentoCaos } from '../src/main/datos/etiquetasAumentos';
import { perfilDe } from '../src/main/datos/estaticos';
import { crearOrquestadorPartida } from '../src/main/orquestador/partida';
import type { EstadoPartida, PanelAumentos, PerfilCampeon } from '../src/shared/tiposApp';

// Perfiles de Data Dragon (champion.json, es_MX) de cuatro campeones muy distintos.
const ZED: PerfilCampeon = { clases: ['Assassin'], ataque: 9, magia: 1, alcance: 125, recurso: 'Energía' };
const JINX: PerfilCampeon = { clases: ['Marksman'], ataque: 9, magia: 4, alcance: 525, recurso: 'Maná' };
const LUX: PerfilCampeon = { clases: ['Mage', 'Support'], ataque: 2, magia: 9, alcance: 550, recurso: 'Maná' };
const LEONA: PerfilCampeon = { clases: ['Tank', 'Support'], ataque: 4, magia: 3, alcance: 125, recurso: 'Maná' };

const porClave = (clave: string) => AUMENTOS_CAOS.find((a) => a.clave === clave)!;
const tierDe = (perfil: PerfilCampeon, clave: string) => tierList(perfil).get(porClave(clave).id)!.tier;

describe('clasificación de los aumentos de ARAM: Caos', () => {
  it('etiqueta por la descripción del juego', () => {
    expect(etiquetarAumento('ARAM_ItsCritical', 'Obtienes un 25% de Probabilidad de Golpe Crítico.')).toEqual(['critico']);
    expect(etiquetarAumento('ARAM_WitchfulThinking', 'Obtienes 40 de Poder de Habilidad.')).toEqual(['ap']);
    expect(etiquetarAumento('ARAM_Goredrink', 'Obtienes un 10% de Omnivampirismo.')).toEqual(['curacion']);
    expect(etiquetarAumento('X', 'Al curar o escudar a tus aliados, los ralentizas.')).toEqual(expect.arrayContaining(['curacion', 'aliados', 'control']));
  });

  it('no confunde «oscura» con curar ni reducir la armadura del enemigo con aguantar', () => {
    expect(etiquetarAumento('X', 'Obtienes las runas clave Primer Golpe y Cosecha Oscura.')).not.toContain('curacion');
    expect(etiquetarAumento('X', 'Infligir daño aplica reducción de Armadura y Resistencia Mágica.')).not.toContain('tanque');
  });

  it('las claves fijan los casos dudosos y sin descripción es general', () => {
    expect(etiquetarAumento('ARAM_ADAPt', 'Convierte el daño de ataque adicional en poder de habilidad.')).toEqual(['ap']);
    expect(etiquetarAumento('ARAM_ScopedWeapons', 'Obtiene alcance de ataque.')).toEqual(['alcance', 'ataque']);
    expect(etiquetarAumento('Totentanz', '')).toEqual(['general']);
  });

  it('familias y rarezas', () => {
    expect(familiaDe('ARAM_BreadAndJam')).toBe('pan');
    expect(familiaDe('ARAM_InfernalSoul')).toBe('almas');
    expect(familiaDe('ARAM_SoulSiphon')).toBeNull();
    expect(familiaDe('PinballSnowball')).toBe('bolaNieve');
    expect(rarezaDe('kPrismatic')).toBe('prismatico');
    expect(rarezaDe('kEventChoice')).toBeNull();
  });

  it('los datos generados traen los 249 aumentos del modo, con rareza y etiquetas', () => {
    expect(AUMENTOS_CAOS.length).toBeGreaterThan(200);
    for (const a of AUMENTOS_CAOS) {
      expect(['plata', 'oro', 'prismatico']).toContain(a.rareza);
      expect(a.etiquetas.length).toBeGreaterThan(0);
    }
  });
});

describe('tier list por campeón (encaje, nunca % de victorias)', () => {
  it('el perfil sale de champion.json y el maná se reconoce en cualquier idioma', () => {
    expect(perfilDe({ key: '238', id: 'Zed', name: 'Zed', tags: ['Assassin'], partype: 'Energía', info: { attack: 9, magic: 1 }, stats: { attackrange: 125 } })).toEqual(ZED);
    expect(perfilDe({ key: '1', id: 'X', name: 'X' })).toBeNull();
    expect(usaMana(JINX)).toBe(true);
    expect(usaMana({ ...JINX, recurso: 'Mana' })).toBe(true);
    expect(usaMana(ZED)).toBe(false);
  });

  it('lo que no sirve al campeón resta: PH a Zed, crítico a Lux, alcance a Leona', () => {
    expect(pesosCampeon(ZED).ap).toBeLessThan(0);
    expect(pesosCampeon(LUX).critico).toBeLessThan(0);
    expect(pesosCampeon(LEONA).alcance).toBeLessThan(0);
    expect(tierDe(ZED, 'ARAM_WitchfulThinking')).toBe('C');
    expect(tierDe(LUX, 'ARAM_ItsCritical')).toBe('C');
    expect(tierDe(LEONA, 'ARAM_ScopiestWeapons')).toBe('C');
  });

  it('lo que encaja sube: crítico a Jinx, PH a Lux, aguante a Leona', () => {
    expect(['S', 'A']).toContain(tierDe(JINX, 'ARAM_ItsCritical'));
    expect(['S', 'A']).toContain(tierDe(LUX, 'ARAM_WitchfulThinking'));
    expect(['S', 'A']).toContain(tierDe(LEONA, 'ARAM_Goliath'));
  });

  it('un aumento sin descripción nunca pasa de B; sin perfil todo es neutro', () => {
    const lista = tierList(JINX);
    for (const a of AUMENTOS_CAOS.filter((x) => x.sinDescripcion)) expect(['B', 'C']).toContain(lista.get(a.id)!.tier);
    const pesos = pesosCampeon(null);
    expect(puntuarAumento(porClave('ARAM_ItsCritical'), pesos)).toBe(puntuarAumento(porClave('ARAM_WitchfulThinking'), pesos));
  });

  it('cada rareza se valora aparte y en el mismo orden siempre', () => {
    const a = tierList(ZED);
    const b = tierList(ZED);
    expect([...a.entries()].map(([id, v]) => [id, v.tier])).toEqual([...b.entries()].map(([id, v]) => [id, v.tier]));
    for (const rareza of ['plata', 'oro', 'prismatico'] as const) {
      expect([...a.values()].some((v) => v.aumento.rareza === rareza && v.tier === 'S')).toBe(true);
    }
  });

  it('combos: temas y familias que encajan, sin aumentos C', () => {
    const lista = combos(JINX, tierList(JINX));
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.length).toBeLessThanOrEqual(3);
    expect(lista.map((c) => c.id)).toEqual(expect.arrayContaining(['tema:critico']));
    for (const c of lista) for (const v of c.aumentos) expect(v.tier).not.toBe('C');
    const familias: AumentoCaos[] = [
      { id: 1, clave: 'ARAM_BreadAndButter', rareza: 'oro', etiquetas: ['habilidades'], familia: 'pan' },
      { id: 2, clave: 'ARAM_BreadAndJam', rareza: 'oro', etiquetas: ['habilidades'], familia: 'pan' },
      { id: 3, clave: 'ARAM_Deft', rareza: 'oro', etiquetas: ['ataque'], familia: null },
    ];
    expect(combos(LUX, tierList(LUX, familias)).map((c) => c.id)).toContain('familia:pan');
  });

  it('el panel trae nombre e icono del idioma y solo aumentos con nombre', () => {
    const nombres = new Map(AUMENTOS_CAOS.map((a) => [a.id, { nombre: `n${a.id}`, icono: null }]));
    nombres.delete(porClave('ARAM_ItsCritical').id);
    const panel = panelAumentos({ nombre: 'Jinx', perfil: JINX }, nombres);
    expect(panel.campeon).toBe('Jinx');
    expect(panel.columnas.map((c) => c.rareza)).toEqual(['prismatico', 'oro', 'plata']);
    const ids = panel.columnas.flatMap((c) => c.aumentos.map((a) => a.id));
    expect(ids).not.toContain(porClave('ARAM_ItsCritical').id);
    for (const c of panel.columnas) {
      expect(c.aumentos.length).toBeLessThanOrEqual(6);
      for (const a of c.aumentos) expect(a.nombre).toBe(`n${a.id}`);
    }
    // Ninguna cifra de partidas ni de victorias en lo que llega al overlay.
    expect(JSON.stringify(panel)).not.toMatch(/victoria|win|partidas|tasa/i);
  });
});

describe('cuándo se ve el panel de aumentos', () => {
  const caos = (tiempo: number, nivel: number, muerto = false): Pick<EstadoPartida, 'tiempo' | 'nivel' | 'muerto' | 'modo'> => ({ tiempo, nivel, muerto, modo: 'caos' });

  it('solo en ARAM: Caos', () => {
    const v = new VisibilidadAumentos();
    expect(v.procesar({ tiempo: 10, nivel: 3, modo: 'aram' })).toBe(false);
    expect(v.procesar({ tiempo: 10, nivel: 3, modo: 'clasificatoria' })).toBe(false);
    expect(v.procesar(caos(10, 3))).toBe(true);
  });

  it('al empezar, al llegar a los niveles 7, 11 y 15 y mientras estás muerto', () => {
    const v = new VisibilidadAumentos();
    expect(v.procesar(caos(30, 3))).toBe(true);
    expect(v.procesar(caos(INICIO_S + 5, 5))).toBe(false);
    expect(v.procesar(caos(300, 6))).toBe(false);
    expect(v.procesar(caos(310, 7))).toBe(true);
    expect(v.procesar(caos(310 + TRAS_NIVEL_S - 1, 7))).toBe(true);
    expect(v.procesar(caos(310 + TRAS_NIVEL_S + 1, 7))).toBe(false);
    expect(v.procesar(caos(600, 9, true))).toBe(true);
    expect(v.procesar(caos(620, 9))).toBe(false);
  });

  it('al entrar tarde (reconexión) el primer nivel no cuenta como subida', () => {
    const v = new VisibilidadAumentos();
    expect(v.procesar(caos(700, 12))).toBe(false);
  });

  it('la tecla lo enseña u oculta hasta el siguiente cambio automático', () => {
    const v = new VisibilidadAumentos();
    expect(v.procesar(caos(200, 5))).toBe(false);
    expect(v.alternar()).toBe(true);
    expect(v.procesar(caos(201, 5))).toBe(true);
    expect(v.alternar()).toBe(false);
    expect(v.procesar(caos(202, 5))).toBe(false);
    // Llega el nivel 7: vuelve a mandar lo automático.
    expect(v.procesar(caos(250, 7))).toBe(true);
  });
});

describe('orquestador: panel de aumentos', () => {
  const PANEL: PanelAumentos = { campeon: 'Zed', columnas: [], combos: [] };
  const estado = (tiempo: number, nivel: number, modo: EstadoPartida['modo'] = 'caos'): EstadoPartida => ({
    tiempo, oro: 500, nivel, campeon: 'Zed', objetos: [], habilidades: { Q: 0, W: 0, E: 0, R: 0 }, eventos: [], modo,
  });

  function montar(modo: EstadoPartida['modo'] = 'caos') {
    const conector = Object.assign(new EventEmitter(), { iniciar: vi.fn(), detener: vi.fn() });
    const overlay = { mostrar: vi.fn(), ocultar: vi.fn(), alternar: vi.fn(), enviarEstado: vi.fn(), enviarAviso: vi.fn(), enviarModo: vi.fn(), enviarVoz: vi.fn(), enviarAumentos: vi.fn() };
    const panelAumentos = vi.fn(async () => PANEL);
    const p = crearOrquestadorPartida({
      crearConector: () => conector,
      overlay,
      obtenerAjustes: () => AJUSTES_POR_DEFECTO,
      contexto: async () => ({ build: null, rol: 'MIDDLE', objetos: {} }),
      avisar: vi.fn(),
      leerModo: async () => 'sin_bordes',
      esPremium: () => true,
      variantes: () => new SelectorFijo(),
      panelAumentos,
    });
    void p.fase('InProgress');
    const emitir = async (e: EstadoPartida) => {
      const antes = overlay.enviarEstado.mock.calls.length;
      conector.emit('estado', e);
      await vi.waitFor(() => expect(overlay.enviarEstado.mock.calls.length).toBeGreaterThan(antes));
      await new Promise((r) => setTimeout(r, 0));
    };
    return { p, overlay, panelAumentos, emitir, modo };
  }

  it('lo envía al empezar una partida de Caos y lo retira cuando ya no toca', async () => {
    const { overlay, panelAumentos, emitir } = montar();
    await emitir(estado(10, 3));
    expect(overlay.enviarAumentos).toHaveBeenLastCalledWith(PANEL);
    expect(panelAumentos).toHaveBeenCalledWith('Zed');
    await emitir(estado(INICIO_S + 10, 4));
    expect(overlay.enviarAumentos).toHaveBeenLastCalledWith(null);
  });

  it('la tecla lo saca a mano, solo en Caos', async () => {
    const { p, overlay, emitir } = montar();
    await emitir(estado(INICIO_S + 10, 4));
    p.alternarAumentos();
    await vi.waitFor(() => expect(overlay.enviarAumentos).toHaveBeenLastCalledWith(PANEL));
    expect(p.enCaos()).toBe(true);
  });

  it('fuera de Caos no se envía nunca', async () => {
    const { p, overlay, emitir } = montar();
    await emitir(estado(10, 3, 'aram'));
    p.alternarAumentos();
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay.enviarAumentos).not.toHaveBeenCalled();
    expect(p.enCaos()).toBe(false);
  });
});
