import { describe, expect, it } from 'vitest';
import { BETA_TOKEN, conBetas, credencialIa, hayClaveIa } from '../src/claveIa';

describe('credencial de Anthropic del servidor', () => {
  it('una clave clásica la lee el SDK como x-api-key (sin betas extra)', () => {
    const c = credencialIa({ ANTHROPIC_API_KEY: 'sk-ant-api03-abc' });
    expect(c).toEqual({ opciones: {}, betasExtra: [] });
  });

  it('una clave de usuario de la consola nueva va como Bearer con la beta de tokens', () => {
    const c = credencialIa({ ANTHROPIC_API_KEY: 'sk-ant-usr-abc' });
    expect(c.opciones).toEqual({ apiKey: null, authToken: 'sk-ant-usr-abc' });
    expect(c.betasExtra).toEqual([BETA_TOKEN]);
  });

  it('ANTHROPIC_AUTH_TOKEN tiene prioridad y también usa Bearer', () => {
    const c = credencialIa({ ANTHROPIC_AUTH_TOKEN: ' tok ', ANTHROPIC_API_KEY: 'sk-ant-api03-x' });
    expect(c.opciones).toEqual({ apiKey: null, authToken: 'tok' });
    expect(c.betasExtra).toEqual([BETA_TOKEN]);
  });

  it('hayClaveIa vale con cualquiera de las dos variables', () => {
    expect(hayClaveIa({})).toBe(false);
    expect(hayClaveIa({ ANTHROPIC_API_KEY: ' ' })).toBe(false);
    expect(hayClaveIa({ ANTHROPIC_API_KEY: 'sk-ant-api03-x' })).toBe(true);
    expect(hayClaveIa({ ANTHROPIC_AUTH_TOKEN: 'tok' })).toBe(true);
  });

  it('conBetas suma la beta de tokens a las de la petición sin repetirlas', () => {
    expect(conBetas({ model: 'm', betas: ['server-side-fallback-2026-07-01'] }, [BETA_TOKEN]).betas).toEqual([
      'server-side-fallback-2026-07-01',
      BETA_TOKEN,
    ]);
    expect(conBetas({ model: 'm' }, [BETA_TOKEN]).betas).toEqual([BETA_TOKEN]);
    const p = { model: 'm', betas: ['a'] };
    expect(conBetas(p, [])).toBe(p);
  });
});
