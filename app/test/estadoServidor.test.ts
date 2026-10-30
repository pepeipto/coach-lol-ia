import { describe, expect, it, vi } from 'vitest';
import { consultarRiotServidor } from '../src/main/estadoServidor';

const fetchCon = (r: Response | Error) => vi.fn(async () => (r instanceof Error ? Promise.reject(r) : r)) as unknown as typeof fetch;

describe('consultarRiotServidor', () => {
  it('lee el estado de la clave de /salud', async () => {
    const f = fetchCon(Response.json({ ok: true, riot: 'caducada', riotDesde: 'x' }));
    expect(await consultarRiotServidor('https://api.test/', f)).toBe('caducada');
    expect(vi.mocked(f).mock.calls[0]![0]).toBe('https://api.test/salud');
    expect(await consultarRiotServidor('https://api.test', fetchCon(Response.json({ ok: true, riot: 'ok' })))).toBe('ok');
  });

  it('servidor caído, error HTTP o respuesta rara: desconocida (nunca se avisa sin saberlo)', async () => {
    expect(await consultarRiotServidor('https://api.test', fetchCon(new Error('ECONNREFUSED')))).toBe('desconocida');
    expect(await consultarRiotServidor('https://api.test', fetchCon(new Response('', { status: 503 })))).toBe('desconocida');
    expect(await consultarRiotServidor('https://api.test', fetchCon(Response.json({ ok: true, riot: 'rara' })))).toBe('desconocida');
    expect(await consultarRiotServidor('https://api.test', fetchCon(new Response('no json')))).toBe('desconocida');
  });
});
