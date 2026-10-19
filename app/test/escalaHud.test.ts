import { describe, expect, it } from 'vitest';
import { leerEscalaHud, DIR_LOL_POR_DEFECTO } from '../src/main/partida/escalaHud';

const barra = (r: string) => r.split(String.fromCharCode(92)).join('/');

/** Lector falso: devuelve el texto de cada archivo (por el final de la ruta) o falla como si no existiera. */
function archivos(mapa: Record<string, string>) {
  const leidas: string[] = [];
  const leer = async (ruta: string) => {
    leidas.push(barra(ruta));
    const k = Object.keys(mapa).find((n) => barra(ruta).endsWith(n));
    if (k === undefined) throw new Error('ENOENT');
    return mapa[k]!;
  };
  return { leer, leidas };
}

// Fragmento real del game.cfg de una instalación de LoL (sección [HUD], 2026).
const GAME_CFG = `[General]
WindowMode=2
Height=2160
Width=3840
[HUD]
ShopScale=0.4194
MinimapScale=0.3500
MinimapMoveSelf=1
GlobalScale=0.2500
FlipMiniMap=0
ChatScale=64
[Volume]
MasterVolume=0.5
`;

const PERSISTED = JSON.stringify({
  description: '',
  files: [
    {
      name: 'Game.cfg',
      sections: [
        { name: 'General', settings: [{ name: 'WindowMode', value: '2' }] },
        {
          name: 'HUD',
          settings: [
            { name: 'FlipMiniMap', value: '1' },
            { name: 'GlobalScale', value: '0.7000' },
            { name: 'MinimapScale', value: '0.1000' },
          ],
        },
      ],
    },
  ],
});

describe('leerEscalaHud (Config/game.cfg de LoL, solo lectura)', () => {
  it('lee GlobalScale, MinimapScale y FlipMiniMap de la sección [HUD] de game.cfg', async () => {
    const { leer, leidas } = archivos({ 'Config/game.cfg': GAME_CFG });
    expect(await leerEscalaHud('C:/LoL', leer)).toEqual({ global: 0.25, minimapa: 0.35, minimapaIzquierda: false });
    expect(leidas).toEqual(['C:/LoL/Config/game.cfg']);
  });

  it('FlipMiniMap=1 pone el minimapa a la izquierda; acepta CRLF y espacios', async () => {
    const { leer } = archivos({ 'Config/game.cfg': '[HUD]\r\nGlobalScale = 1.0000\r\nFlipMiniMap=1\r\n' });
    expect(await leerEscalaHud('C:/LoL', leer)).toEqual({ global: 1, minimapa: null, minimapaIzquierda: true });
  });

  it('solo cuenta la sección [HUD] (una clave igual en otra sección no vale)', async () => {
    const { leer } = archivos({ 'Config/game.cfg': '[Mobile]\nGlobalScale=0.9\n[HUD]\nMinimapScale=0.5\n' });
    expect(await leerEscalaHud('C:/LoL', leer)).toEqual({ global: null, minimapa: 0.5, minimapaIzquierda: false });
  });

  it('sin game.cfg (o sin las claves) usa Config/PersistedSettings.json', async () => {
    const { leer, leidas } = archivos({ 'Config/PersistedSettings.json': PERSISTED });
    expect(await leerEscalaHud('C:/LoL', leer)).toEqual({ global: 0.7, minimapa: 0.1, minimapaIzquierda: true });
    expect(leidas).toEqual(['C:/LoL/Config/game.cfg', 'C:/LoL/Config/PersistedSettings.json']);
  });

  it('valores raros (fuera de 0–1, texto) se ignoran; sin nada legible devuelve null', async () => {
    const { leer } = archivos({ 'Config/game.cfg': '[HUD]\nGlobalScale=abc\nMinimapScale=7\n' });
    expect(await leerEscalaHud('C:/LoL', leer)).toBeNull();
    expect(await leerEscalaHud('C:/LoL', archivos({}).leer)).toBeNull();
    expect(await leerEscalaHud('C:/LoL', archivos({ 'Config/PersistedSettings.json': '{ roto' }).leer)).toBeNull();
  });

  it('la carpeta por defecto de LoL es la de Riot Games', () => {
    expect(barra(DIR_LOL_POR_DEFECTO)).toBe('C:/Riot Games/League of Legends');
  });
});
