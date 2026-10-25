import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../src/config';

describe('leerConfiguracion', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['5', 5],
    ['true', 1],
    ['TRUE', 1],
    ['0', false],
    ['6', false],
    ['', false],
    ['no', false],
  ])('TRUST_PROXY=«%s» -> %s saltos (nunca true)', (v, esperado) => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', TRUST_PROXY: v }).trustProxy).toBe(esperado);
  });

  it('lee Stripe y URL_WEB; con alguna variable de Stripe ausente, stripe es null', () => {
    const env = { RIOT_API_KEY: 'k', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID: 'price_x', URL_WEB: 'https://w.test/app/' };
    expect(leerConfiguracion(env)).toMatchObject({ stripe: { clave: 'sk_test_x', webhook: 'whsec_x', precio: 'price_x' }, urlWeb: 'https://w.test/app' });
    expect(leerConfiguracion({ ...env, STRIPE_PRICE_ID: '' }).stripe).toBeNull();
  });

  it('usa los valores por defecto', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' })).toEqual({ clave: 'k', admin: null, puerto: 8080, rutaDb: './coach.db', maxPartidas: undefined, regionesRecolector: ['EUW', 'LAN', 'LAS'], stripe: null, urlWeb: 'https://www.coachlolia.com', trustProxy: false, cabeceraIpCliente: null, salPrueba: null, premiumHabilitado: false, asistente: null, coachIa: null, ficha: null, consejosCruce: null, parche: null, porcentajeInteractivo: 60 });
  });

  it('lee PUERTO, RUTA_DB y MAX_PARTIDAS', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PUERTO: '3000', RUTA_DB: '/datos/c.db', MAX_PARTIDAS: '50' })).toEqual({
      clave: 'k', admin: null, puerto: 3000, rutaDb: '/datos/c.db', maxPartidas: 50, regionesRecolector: ['EUW', 'LAN', 'LAS'], stripe: null, urlWeb: 'https://www.coachlolia.com', trustProxy: false, cabeceraIpCliente: null, salPrueba: null, premiumHabilitado: false, asistente: null, coachIa: null, ficha: null, consejosCruce: null, parche: null, porcentajeInteractivo: 60,
    });
  });

  it('una variable vacía (p. ej. «MAX_PARTIDAS=» en un .env) usa el valor por defecto', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PUERTO: '', MAX_PARTIDAS: ' ' })).toMatchObject({ puerto: 8080, maxPartidas: undefined });
  });

  it('RIOT_PORCENTAJE_INTERACTIVO: tope de la pantalla de carga en cada regla de Riot (5–70, por defecto 60)', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', RIOT_PORCENTAJE_INTERACTIVO: '40' }).porcentajeInteractivo).toBe(40);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', RIOT_PORCENTAJE_INTERACTIVO: '' }).porcentajeInteractivo).toBe(60);
    for (const malo of ['71', '100', '4', 'mucho']) {
      expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', RIOT_PORCENTAJE_INTERACTIVO: malo })).toThrow(/RIOT_PORCENTAJE_INTERACTIVO/);
    }
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

describe('REGIONES_RECOLECTOR', () => {
  it('por defecto, EUW, LAN y LAS (BR y NA solo para la pantalla de carga)', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' }).regionesRecolector).toEqual(['EUW', 'LAN', 'LAS']);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', REGIONES_RECOLECTOR: '' }).regionesRecolector).toEqual(['EUW', 'LAN', 'LAS']);
  });

  it('acepta una lista separada por comas, sin repetidas y sin distinguir mayúsculas', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', REGIONES_RECOLECTOR: 'euw, br,NA,EUW' }).regionesRecolector).toEqual(['EUW', 'BR', 'NA']);
  });

  it('una región desconocida es un error en español', () => {
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', REGIONES_RECOLECTOR: 'EUW,KR' })).toThrow(/REGIONES_RECOLECTOR.*«KR»/);
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', REGIONES_RECOLECTOR: ' , ' })).toThrow(/ninguna región/);
  });
});

describe('3.9.1: ADMIN_TOKEN', () => {
  it('es opcional y exige al menos 24 caracteres', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', ADMIN_TOKEN: 'x'.repeat(30) }).admin).toBe('x'.repeat(30));
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', ADMIN_TOKEN: 'corta' })).toThrow(/ADMIN_TOKEN/);
  });
});
