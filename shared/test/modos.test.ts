import { describe, expect, it } from 'vitest';
import {
  COLAS_MODO,
  MODOS_JUEGO,
  modoDeCola,
  modoDeGameMode,
  modoDeMapa,
  MAPA_DE_MODO,
  repartirPresupuesto,
  tieneAumentos,
  tieneRoles,
  urlIconoAumento,
} from '../src';

describe('modos de juego', () => {
  it('incluye los cuatro modos, con clasificatoria primero', () => {
    expect(MODOS_JUEGO).toEqual(['clasificatoria', 'aram', 'caos', 'arena']);
  });

  it('traduce las colas confirmadas en queues.json de Riot', () => {
    expect(modoDeCola(420)).toBe('clasificatoria');
    expect(modoDeCola(450)).toBe('aram');
    expect(modoDeCola(2400)).toBe('caos');
    expect(modoDeCola(1700)).toBe('arena');
    expect(modoDeCola(1710)).toBe('arena');
    expect(modoDeCola(1090)).toBeNull();
    expect(modoDeCola('450')).toBeNull();
    expect(COLAS_MODO.arena[0]).toBe(1700);
  });

  it('traduce el gameMode de la Live Client Data API', () => {
    expect(modoDeGameMode('CLASSIC')).toBe('clasificatoria');
    expect(modoDeGameMode('ARAM')).toBe('aram');
    expect(modoDeGameMode('KIWI')).toBe('caos');
    expect(modoDeGameMode('CHERRY')).toBe('arena');
    expect(modoDeGameMode('TFT')).toBeNull();
    expect(modoDeGameMode(undefined)).toBeNull();
  });

  it('solo clasificatoria tiene roles; Caos y Arena tienen aumentos', () => {
    expect(MODOS_JUEGO.filter(tieneRoles)).toEqual(['clasificatoria']);
    expect(MODOS_JUEGO.filter(tieneAumentos)).toEqual(['caos', 'arena']);
  });

  it('reparte el presupuesto 60/15/10/15 y da el resto a clasificatoria', () => {
    expect(repartirPresupuesto(300)).toEqual({ clasificatoria: 180, aram: 45, caos: 30, arena: 45 });
    const r = repartirPresupuesto(7);
    expect(r.aram + r.caos + r.arena + r.clasificatoria).toBe(7);
    expect(repartirPresupuesto(3000)).toEqual({ clasificatoria: 1800, aram: 450, caos: 300, arena: 450 });
    expect(repartirPresupuesto(-3)).toEqual({ clasificatoria: 0, aram: 0, caos: 0, arena: 0 });
  });

  it('convierte la ruta del icono de un aumento en una URL de CommunityDragon en minúsculas', () => {
    expect(urlIconoAumento('/lol-game-data/assets/ASSETS/UX/Kiwi/Augments/Icons/Adamant_small.png')).toBe(
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/kiwi/augments/icons/adamant_small.png',
    );
    expect(urlIconoAumento('https://malo.example/x.png')).toBeNull();
    expect(urlIconoAumento('/lol-game-data/assets/../../x.png')).toBeNull();
    expect(urlIconoAumento(3)).toBeNull();
  });
});

describe('mapas', () => {
  it('modoDeMapa: Grieta, Abismo y Arena; otro mapa, null', () => {
    expect(modoDeMapa(11)).toBe('clasificatoria');
    expect(modoDeMapa(12)).toBe('aram');
    expect(modoDeMapa(30)).toBe('arena');
    expect(modoDeMapa(22)).toBeNull();
    expect(MAPA_DE_MODO.caos).toBe(12);
  });
});

