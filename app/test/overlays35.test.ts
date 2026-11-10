import { describe, expect, it } from 'vitest';
import { faltaBaratija, generarIndicaciones, inhibidoresCaidos, oroEnObjetos, parejasDeLinea, resumenOverlay, valorObjetos } from '../src/main/consejos/motor';
import { oroConSigno } from '../src/renderer/overlay/widgets/WidgetCs';
import type { EstadoPartida } from '../src/shared/tiposApp';

const estado = (o: Partial<EstadoPartida> = {}): EstadoPartida => ({
  tiempo: 600,
  oro: 0,
  nivel: 9,
  campeon: 'Zed',
  objetos: [3340],
  habilidades: { Q: 4, W: 2, E: 3, R: 1 },
  eventos: [],
  equipo: 'ORDER',
  modo: 'clasificatoria',
  ...o,
});

const objetos = { 3142: { gold: { total: 2800 } }, 1036: { gold: { total: 350 } }, 3340: { gold: { total: 0 } } } as never;

describe('3.5: inhibidores en la barra de objetivos', () => {
  it('un inhibidor caído reaparece a los 5 min; InhibRespawned lo quita', () => {
    const e = estado({
      tiempo: 1500,
      eventos: [
        { nombre: 'InhibKilled', tiempo: 1400, estructura: 'Barracks_T2_C1' },
        { nombre: 'InhibKilled', tiempo: 1300, estructura: 'Barracks_T1_L1' },
        { nombre: 'InhibKilled', tiempo: 1000, estructura: 'Barracks_T2_R1' },
      ],
    });
    expect(inhibidoresCaidos(e)).toEqual([
      { calle: 'top', aliado: true, restante: 100 },
      { calle: 'mid', aliado: false, restante: 200 },
    ]);
    const tras = estado({ ...e, eventos: [...e.eventos, { nombre: 'InhibRespawned', tiempo: 1450, estructura: 'Barracks_T1_L1' }] });
    expect(inhibidoresCaidos(tras).map((i) => i.calle)).toEqual(['mid']);
    // Desde el lado rojo se invierte de quién es.
    expect(inhibidoresCaidos(estado({ ...e, equipo: 'CHAOS' }))[0]!.aliado).toBe(false);
  });

  it('el resumen del overlay los añade a la barra con su cuenta atrás (solo en la Grieta)', () => {
    const e = estado({ tiempo: 1500, eventos: [{ nombre: 'InhibKilled', tiempo: 1400, estructura: 'Barracks_T2_C1' }] });
    const r = resumenOverlay(e, null, 'MIDDLE', objetos, '');
    expect(r.objetivos.find((o) => o.id === 'inhibidor')).toMatchObject({ aparece: 200, aliado: false, subtipo: 'mid' });
    expect(resumenOverlay({ ...e, modo: 'aram' }, null, 'MIDDLE', objetos, '').objetivos).toEqual([]);
  });
});

describe('3.5: oro en objetos (lo que enseña el Tab)', () => {
  const jugadores: EstadoPartida['jugadores'] = [
    { campeon: 'Zed', equipo: 'ORDER', posicion: 'MIDDLE', castigo: false, objetos: [3142, 1036] },
    { campeon: 'Ahri', equipo: 'CHAOS', posicion: 'MIDDLE', castigo: false, objetos: [3142] },
    { campeon: 'Garen', equipo: 'ORDER', posicion: 'TOP', castigo: false, objetos: [1036] },
    { campeon: 'Darius', equipo: 'CHAOS', posicion: 'TOP', castigo: false, objetos: [] },
  ];

  it('equipo y rival de línea', () => {
    expect(valorObjetos([3142, 1036, 9999], objetos)).toBe(3150);
    expect(oroEnObjetos(estado({ jugadores }), 'MIDDLE', objetos)).toEqual({ equipo: 700, rival: 350, aliados: 3500, enemigos: 2800, rivalNombre: 'Ahri', parejas: expect.any(Array) });
    // Sin rival con esa posición: solo el equipo.
    expect(oroEnObjetos(estado({ jugadores }), 'UTILITY', objetos)).toEqual({ equipo: 700, rival: null, aliados: 3500, enemigos: 2800, rivalNombre: null, parejas: expect.any(Array) });
    // 3.19: el nombre del rival es el del juego si la API lo da.
    const conNombre = jugadores.map((j) => (j.campeon === 'Ahri' ? { ...j, nombre: 'Ahri (juego)' } : j));
    expect(oroEnObjetos(estado({ jugadores: conNombre }), 'MIDDLE', objetos)?.rivalNombre).toBe('Ahri (juego)');
    // 3.19: con las posiciones de los cuatro (no son diez), por el orden del marcador: Zed–Ahri y Garen–Darius.
    expect(oroEnObjetos(estado({ jugadores }), 'MIDDLE', objetos)?.parejas).toEqual([
      { aliado: 'Zed', enemigo: 'Ahri', diferencia: 350, tuyo: true },
      { aliado: 'Garen', enemigo: 'Darius', diferencia: 350, tuyo: false },
    ]);
    // Fuera de la Grieta o sin objetos de los jugadores, nada.
    expect(oroEnObjetos(estado({ jugadores, modo: 'aram' }), 'MIDDLE', objetos)).toBeNull();
    expect(oroEnObjetos(estado({ jugadores: jugadores.map(({ objetos: _o, ...j }) => j) }), 'MIDDLE', objetos)).toBeNull();
  });

  it('formato con signo y en miles', () => {
    expect(oroConSigno(1250)).toMatch(/^\+1[,.]3k$/);
    expect(oroConSigno(-300)).toBe('−300');
    expect(oroConSigno(0)).toBe('0');
  });
});

describe('3.5: recordatorio de baratija', () => {
  it('en la Grieta, pasado el minuto y medio y sin ninguna baratija', () => {
    expect(faltaBaratija(estado({ objetos: [] }))).toBe(true);
    expect(faltaBaratija(estado({ objetos: [3364] }))).toBe(false);
    expect(faltaBaratija(estado({ objetos: [], tiempo: 60 }))).toBe(false);
    expect(faltaBaratija(estado({ objetos: [], modo: 'aram' }))).toBe(false);
    const avisos = generarIndicaciones(estado({ objetos: [], tiempo: 700 }), null, 'MIDDLE', objetos);
    expect(avisos.find((a) => a.clave.startsWith('baratija'))).toMatchObject({ tipo: 'vision', clave: 'baratija:2' });
  });
});

describe('3.19 · parejas de línea para el Tab', () => {
  const objetos = { 1036: { gold: { total: 350 } }, 3142: { gold: { total: 2800 } } } as never;
  const j = (campeon: string, equipo: 'ORDER' | 'CHAOS', posicion: import('@coach/shared').Rol | null, o: number[] = []) => ({ campeon, equipo, posicion, castigo: false, objetos: o });
  it('con las diez posiciones, empareja por posición aunque el orden no coincida', () => {
    const js = [
      j('Garen', 'ORDER', 'TOP', [3142]), j('Lee', 'ORDER', 'JUNGLE'), j('Zed', 'ORDER', 'MIDDLE', [1036]), j('Jinx', 'ORDER', 'BOTTOM'), j('Thresh', 'ORDER', 'UTILITY'),
      j('Vi', 'CHAOS', 'JUNGLE'), j('Darius', 'CHAOS', 'TOP', [1036]), j('Ahri', 'CHAOS', 'MIDDLE'), j('Lulu', 'CHAOS', 'UTILITY'), j('Cait', 'CHAOS', 'BOTTOM'),
    ];
    const p = parejasDeLinea(js, 'ORDER', 'Zed', objetos);
    expect(p.map((x) => `${x.aliado}-${x.enemigo}:${x.diferencia}`)).toEqual(['Garen-Darius:2450', 'Lee-Vi:0', 'Zed-Ahri:350', 'Jinx-Cait:0', 'Thresh-Lulu:0']);
    expect(p.filter((x) => x.tuyo).map((x) => x.aliado)).toEqual(['Zed']);
  });
  it('sin posiciones, por el orden del marcador; desde el lado rojo también', () => {
    const js = [j('A', 'ORDER', null, [3142]), j('B', 'ORDER', null), j('X', 'CHAOS', null), j('Y', 'CHAOS', null, [1036])];
    expect(parejasDeLinea(js, 'CHAOS', 'Y', objetos)).toEqual([
      { aliado: 'X', enemigo: 'A', diferencia: -2800, tuyo: false },
      { aliado: 'Y', enemigo: 'B', diferencia: 350, tuyo: true },
    ]);
  });
});
