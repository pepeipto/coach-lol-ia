import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearOrquestadorCarga, DURACION_MAXIMA_CARGA_MS } from '../src/main/orquestador/carga';
import { arrancarForzado, cargaDeMuestra, DURACION_CARGA_SIMULADA_MS, JUGADORES_DE_MUESTRA } from '../src/main/orquestador/cargaSimulada';
import type { EstadoCarga } from '../src/shared/tiposApp';

vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));

const PROHIBIDAS = /\b(malo|mala|troll|inting|int|noob|manco|feeder|feed|peor|tóxico|mmr|elo)\b/i;

const DATOS = {
  version: '16.20.1',
  campeones: new Map([
    [103, { id: 'Ahri', nombre: 'Ahri' }],
    [64, { id: 'LeeSin', nombre: 'Lee Sin (Data Dragon)' }],
  ]),
};

describe('pantalla de carga de muestra (COACH_FORZAR_PARTIDA)', () => {
  it('diez jugadores, cinco por equipo y uno por rol, con textos neutros o positivos', () => {
    expect(JUGADORES_DE_MUESTRA).toHaveLength(10);
    for (const equipo of ['aliado', 'enemigo'] as const) {
      const de = JUGADORES_DE_MUESTRA.filter((j) => j.equipo === equipo);
      expect(de.map((j) => j.rol)).toEqual(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
    }
    for (const j of JUGADORES_DE_MUESTRA) {
      for (const e of j.etiquetas) expect(e.texto).not.toMatch(PROHIBIDAS);
      expect(j.riotId).toMatch(/^.+#.+$/);
    }
  });

  it('el jugador de la grabación de ejemplo (Ahri en el centro) va en tu equipo', () => {
    expect(JUGADORES_DE_MUESTRA.find((j) => j.equipo === 'aliado' && j.rol === 'MIDDLE')).toMatchObject({ campeonId: 103, campeon: 'Ahri' });
  });

  it('usa la versión y los nombres de Data Dragon si los hay', () => {
    const c = cargaDeMuestra(DATOS);
    expect(c.version).toBe('16.20.1');
    expect(c.jugadores.find((j) => j.campeonId === 64)).toMatchObject({ campeon: 'LeeSin', nombre: 'Lee Sin (Data Dragon)' });
    // Los que no están en los datos se quedan con su propio nombre.
    expect(c.jugadores.find((j) => j.campeonId === 145)).toMatchObject({ campeon: 'Kaisa', nombre: "Kai'Sa" });
  });

  it('sin Data Dragon sigue funcionando con sus propios nombres', () => {
    const c = cargaDeMuestra(null);
    expect(c.version).toBe('');
    expect(c.jugadores.every((j) => j.campeon && j.nombre)).toBe(true);
  });
});

describe('arrancarForzado', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function montar() {
    const eventos: string[] = [];
    const cargas: EstadoCarga[] = [];
    const carga = crearOrquestadorCarga({
      urlServidor: () => 'https://servidor.test',
      datos: async () => DATOS,
      enviarModo: (m) => eventos.push(`modo:${m}`),
      enviarCarga: (c) => {
        cargas.push(c);
        eventos.push('carga');
      },
      mostrar: () => eventos.push('mostrar'),
      ocultar: () => eventos.push('ocultar'),
      enPartida: () => false,
    });
    const arrancar = vi.fn(() => eventos.push('arrancar'));
    return { carga, eventos, cargas, arrancar };
  }

  it('muestra la pantalla de carga de muestra unos segundos y luego arranca la partida', async () => {
    const { carga, eventos, cargas, arrancar } = montar();
    await arrancarForzado({ carga, datos: async () => DATOS, arrancar });
    // overlay:carga antes que overlay:modo 'carga', como en una partida real.
    expect(eventos).toEqual(['carga', 'modo:carga', 'mostrar']);
    expect(cargas[0]!.jugadores).toHaveLength(10);
    expect(carga.activa()).toBe(true);
    vi.advanceTimersByTime(DURACION_CARGA_SIMULADA_MS - 1);
    expect(arrancar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(arrancar).toHaveBeenCalledOnce();
    // Con el primer estado de la partida, el orquestador de partida avisa y la carga termina.
    carga.partidaIniciada();
    expect(eventos.at(-1)).toBe('modo:partida');
    expect(carga.activa()).toBe(false);
  });

  it('si Data Dragon falla, la muestra sale igual y la partida arranca', async () => {
    const { carga, cargas, arrancar } = montar();
    await arrancarForzado({ carga, datos: async () => Promise.reject(new Error('sin red')), arrancar });
    expect(cargas[0]!.version).toBe('');
    vi.advanceTimersByTime(DURACION_CARGA_SIMULADA_MS);
    expect(arrancar).toHaveBeenCalledOnce();
  });

  it('la carga de muestra también se retira con la primera respuesta de la Live Client (el simulador)', async () => {
    let vivo = false;
    const eventos: string[] = [];
    const carga = crearOrquestadorCarga({
      urlServidor: () => 'http://servidor.test',
      datos: async () => DATOS,
      enviarModo: (m) => eventos.push(`modo:${m}`),
      enviarCarga: () => eventos.push('carga'),
      mostrar: () => eventos.push('mostrar'),
      ocultar: () => eventos.push('ocultar'),
      enPartida: () => false,
      partidaEnVivo: async () => vivo,
    });
    carga.simular(cargaDeMuestra(DATOS));
    await vi.advanceTimersByTimeAsync(2000);
    expect(carga.activa()).toBe(true);
    vivo = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(carga.activa()).toBe(false);
    expect(eventos.slice(-2)).toEqual(['modo:partida', 'ocultar']);
  });

  it('la carga de muestra también se retira sola a los 2 minutos', async () => {
    const { carga, eventos } = montar();
    carga.simular(cargaDeMuestra(DATOS));
    vi.advanceTimersByTime(DURACION_MAXIMA_CARGA_MS);
    expect(eventos.slice(-2)).toEqual(['modo:partida', 'ocultar']);
  });
});
