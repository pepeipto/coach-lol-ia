import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../src/config';

describe('leerConfiguracion', () => {
  it('usa los valores por defecto', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' })).toEqual({ clave: 'k', puerto: 8080, rutaDb: './coach.db', maxPartidas: undefined });
  });

  it('lee PUERTO, RUTA_DB y MAX_PARTIDAS', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PUERTO: '3000', RUTA_DB: '/datos/c.db', MAX_PARTIDAS: '50' })).toEqual({
      clave: 'k', puerto: 3000, rutaDb: '/datos/c.db', maxPartidas: 50,
    });
  });

  it('una variable vacía (p. ej. «MAX_PARTIDAS=» en un .env) usa el valor por defecto', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PUERTO: '', MAX_PARTIDAS: ' ' })).toMatchObject({ puerto: 8080, maxPartidas: undefined });
  });

  it('quita espacios y comillas que se cuelan al copiar la clave', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: ' "RGAPI-x" \r' }).clave).toBe('RGAPI-x');
  });

  it('sin RIOT_API_KEY lanza un error en español', () => {
    expect(() => leerConfiguracion({})).toThrow('Falta la variable de entorno RIOT_API_KEY.');
  });

  it.each(['abc', '80.5', '0', '70000', '-1'])('un PUERTO no válido («%s») lanza un error claro', (valor) => {
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', PUERTO: valor })).toThrow(/PUERTO.*número entero/);
  });

  it.each(['diez', '0', '-5', '1.5'])('un MAX_PARTIDAS no válido («%s») lanza un error claro', (valor) => {
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', MAX_PARTIDAS: valor })).toThrow(/MAX_PARTIDAS.*número entero/);
  });
});
