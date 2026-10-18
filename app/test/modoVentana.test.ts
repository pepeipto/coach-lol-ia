import { describe, expect, it } from 'vitest';
import { leerModoVentana } from '../src/main/partida/modoVentana';

const con = (txt: string) => async () => txt;

describe('leerModoVentana', () => {
  it('WindowMode=0 → pantalla_completa; WindowMode=2 → sin_bordes; 1 → ventana', async () => {
    expect(await leerModoVentana('C:/LoL', con('[General]\nWindowMode=0\n'))).toBe('pantalla_completa');
    expect(await leerModoVentana('C:/LoL', con('[General]\r\nWindowMode = 2 \r\nX=1\r\n'))).toBe('sin_bordes');
    expect(await leerModoVentana('C:/LoL', con('[General]\nWindowMode=1'))).toBe('ventana');
  });

  it('archivo ausente, línea ausente o valor raro → desconocido', async () => {
    const falla = async () => {
      throw new Error('ENOENT');
    };
    expect(await leerModoVentana('C:/LoL', falla)).toBe('desconocido');
    expect(await leerModoVentana('C:/LoL', con('[General]\nOtro=1\n'))).toBe('desconocido');
    expect(await leerModoVentana('C:/LoL', con('[General]\nWindowMode=7\n'))).toBe('desconocido');
  });

  it('lee Config/game.cfg bajo el directorio de LoL', async () => {
    let ruta = '';
    await leerModoVentana('C:/LoL', async (r) => {
      ruta = r;
      return '';
    });
    expect(ruta.split(String.fromCharCode(92)).join('/')).toBe('C:/LoL/Config/game.cfg');
  });
});
