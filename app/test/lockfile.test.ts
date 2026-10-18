import { describe, expect, it } from 'vitest';
import { encontrarDirectorioLol, parsearLockfile } from '../src/main/lcu/lockfile';

describe('parsearLockfile', () => {
  it('extrae puerto, contraseña y protocolo', () => {
    expect(parsearLockfile('LeagueClient:1234:54321:abc:https')).toEqual({ puerto: 54321, password: 'abc', protocolo: 'https' });
  });
  it('rechaza contenido inválido', () => {
    expect(() => parsearLockfile('basura')).toThrow();
  });
});

describe('encontrarDirectorioLol', () => {
  it('extrae --install-directory con espacios (argumento completo entre comillas)', async () => {
    const linea = '"D:\\Juegos\\Riot Games\\League of Legends\\LeagueClientUx.exe" "--riotclient-auth-token=x" "--install-directory=D:\\Juegos\\Riot Games\\League of Legends" "--app-port=1"';
    expect(await encontrarDirectorioLol(async () => linea)).toBe('D:\\Juegos\\Riot Games\\League of Legends');
  });
  it('extrae el directorio entre comillas', async () => {
    const linea = '--foo --install-directory="D:\\Juegos\\Riot Games\\League of Legends" --bar';
    expect(await encontrarDirectorioLol(async () => linea)).toBe('D:\\Juegos\\Riot Games\\League of Legends');
  });
  it('usa el valor por defecto si falla', async () => {
    expect(await encontrarDirectorioLol(async () => { throw new Error('x'); })).toBe('C:\\Riot Games\\League of Legends');
    expect(await encontrarDirectorioLol(async () => '')).toBe('C:\\Riot Games\\League of Legends');
  });
});
