import { describe, expect, it, vi } from 'vitest';
import { preguntarAsistente, registrarIpcAsistente, validarMensajes } from '../src/main/asistente';
import { establecerIdioma } from '../src/shared/i18n';

const SERVIDOR = 'http://servidor.test';
const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const u = (texto: string) => ({ rol: 'usuario' as const, texto });
const a = (texto: string) => ({ rol: 'asistente' as const, texto });

describe('asistente en main', () => {
  it('envía el historial a POST <servidor>/api/asistente y devuelve la respuesta', async () => {
    const f = vi.fn(async () => respuesta(200, { respuesta: 'Pulsa «Importar».' }));
    const r = await preguntarAsistente([u('Hola'), a('¡Hola!'), u('¿Cómo importo?')], { urlServidor: SERVIDOR + '/', fetch: f });
    expect(r).toEqual({ ok: true, respuesta: 'Pulsa «Importar».' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${SERVIDOR}/api/asistente`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ mensajes: [u('Hola'), a('¡Hola!'), u('¿Cómo importo?')], idioma: 'es' });
  });

  it('manda el idioma de la app para que el asistente responda en él', async () => {
    const f = vi.fn(async () => respuesta(200, { respuesta: 'Click «Import».' }));
    establecerIdioma('en');
    try {
      await preguntarAsistente([u('How do I import?')], { urlServidor: SERVIDOR, fetch: f });
    } finally {
      establecerIdioma('es');
    }
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).idioma).toBe('en');
  });

  it.each([
    [503, 'no_configurado'],
    [429, 'limite'],
    [502, 'no_disponible'],
    [500, 'no_disponible'],
    [400, 'no_valido'],
  ])('HTTP %i → error %s', async (status, error) => {
    const r = await preguntarAsistente([u('Hola')], { urlServidor: SERVIDOR, fetch: async () => respuesta(status, {}) });
    expect(r).toEqual({ ok: false, error });
  });

  it('sin red → sin_conexion', async () => {
    const r = await preguntarAsistente([u('Hola')], {
      urlServidor: SERVIDOR,
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(r).toEqual({ ok: false, error: 'sin_conexion' });
  });

  it('valida la entrada antes de enviarla (mismos límites que el servidor)', async () => {
    const f = vi.fn();
    for (const malo of [
      null,
      [],
      'hola',
      [u('')],
      [u('x'.repeat(1001))],
      [u('a'), a('b')],
      [u('a'), u('b')],
      [a('a'), u('b')],
      [{ rol: 'otro', texto: 'a' }],
      Array.from({ length: 13 }, (_, i) => (i % 2 === 0 ? u('a') : a('b'))),
    ]) {
      expect(validarMensajes(malo)).toBeNull();
      expect(await preguntarAsistente(malo, { urlServidor: SERVIDOR, fetch: f })).toEqual({ ok: false, error: 'no_valido' });
    }
    expect(f).not.toHaveBeenCalled();
    expect(validarMensajes([u('a'), a('b'), u('c')])).toHaveLength(3);
  });

  it('una respuesta larga del asistente (hasta 8000) seguida de otra pregunta pasa la validación', async () => {
    expect(validarMensajes([u('a'), a('y'.repeat(8000)), u('b')])).toHaveLength(3);
    expect(validarMensajes([u('a'), a('y'.repeat(8001)), u('b')])).toBeNull();
    const f = vi.fn(async () => respuesta(200, { respuesta: 'ok' }));
    expect(await preguntarAsistente([u('a'), a('y'.repeat(5000)), u('b')], { urlServidor: SERVIDOR, fetch: f })).toEqual({ ok: true, respuesta: 'ok' });
  });

  it('IPC coach:asistente: solo para la ventana principal y con la URL del servidor', async () => {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: (c: string, h: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, h) };
    const f = vi.fn(async () => respuesta(200, { respuesta: 'Hola' }));
    const principal = {};
    registrarIpcAsistente(ipc, { urlServidor: () => SERVIDOR, fetch: f, esPrincipal: (s) => s === principal });
    const h = manejadores.get('coach:asistente')!;
    expect(await h({ sender: principal }, [u('Hola')])).toEqual({ ok: true, respuesta: 'Hola' });
    await expect(Promise.resolve().then(() => h({ sender: {} }, [u('Hola')]))).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
