import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { crearGestorLicencia, forzarPremiumDe, ocultarClave, registrarIpcLicencia } from '../src/main/licencia';
import { abrirWeb, RUTAS_WEB, URL_WEB, urlWeb } from '../src/main/web';

const CLAVE = 'CLIA-ABCD-EFGH-JKLM-WXYZ';
const DIA = 24 * 3600 * 1000;
const AHORA = Date.UTC(2026, 9, 19, 12);
const SERVIDOR = 'http://servidor.test';

const ruta = () => join(mkdtempSync(join(tmpdir(), 'coach-licencia-')), 'licencia.json');

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
}

/** fetch falso que responde según la clave consultada. */
function fetchFalso(porClave: Record<string, { status: number; cuerpo: unknown }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const clave = decodeURIComponent((u.split('/api/premium/estado/')[1] ?? '').split('?')[0]!);
    const r = porClave[clave];
    return r ? respuesta(r.status, r.cuerpo) : respuesta(404, { error: 'licencia_desconocida' });
  });
}

const caido = vi.fn(async () => {
  throw new TypeError('fetch failed');
});

const activa = { status: 200, cuerpo: { premium: true, estado: 'activa', renuevaEn: '2026-11-18T00:00:00.000Z' } };
const cancelada = { status: 200, cuerpo: { premium: false, estado: 'cancelada', renuevaEn: null } };

function cacheDe(r: string, ultimoEstado: unknown, comprobadaEn: number) {
  writeFileSync(r, JSON.stringify({ clave: CLAVE, ultimoEstado, comprobadaEn: new Date(comprobadaEn).toISOString() }), 'utf8');
}

describe('gestor de licencia', () => {
  it('sin licencia guardada → gratis, sin_licencia', () => {
    const g = crearGestorLicencia({ ruta: ruta(), urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    expect(g.estado()).toEqual({ plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null });
  });

  it('activar una clave activa → premium, guarda {clave, ultimoEstado, comprobadaEn} y consulta /api/premium/estado/:clave', async () => {
    const r = ruta();
    const f = fetchFalso({ [CLAVE]: activa });
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR + '/', fetch: f, ahora: () => AHORA });
    const e = await g.activar(`  ${CLAVE.toLowerCase()}  `);
    expect(e).toEqual({ plan: 'premium', estado: 'activa', renuevaEn: '2026-11-18T00:00:00.000Z', claveVisible: 'CLIA-••••-••••-••••-WXYZ' });
    expect(String(f.mock.calls[0][0])).toBe(`${SERVIDOR}/api/premium/estado/${CLAVE}`);
    const guardado = JSON.parse(readFileSync(r, 'utf8'));
    expect(guardado.clave).toBe(CLAVE);
    expect(guardado.ultimoEstado).toMatchObject({ estado: 'activa' });
    expect(guardado.comprobadaEn).toBe(new Date(AHORA).toISOString());
    // Un gestor nuevo (otro arranque) lee la caché.
    const otro = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA + DIA });
    expect(otro.estado().plan).toBe('premium');
  });

  it('una licencia vitalicia (vitalicia: true del servidor) → premium con la marca vitalicia, también desde la caché', async () => {
    const r = ruta();
    const vitalicia = { status: 200, cuerpo: { premium: true, estado: 'activa', renuevaEn: null, vitalicia: true } };
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: vitalicia }), ahora: () => AHORA });
    expect(await g.activar(CLAVE)).toEqual({
      plan: 'premium',
      estado: 'activa',
      renuevaEn: null,
      claveVisible: 'CLIA-••••-••••-••••-WXYZ',
      vitalicia: true,
    });
    const otro = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA + DIA });
    expect(otro.estado()).toMatchObject({ plan: 'premium', vitalicia: true });
  });

  it('comprobar una licencia cancelada → gratis (cancelada)', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA - DIA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: cancelada }), ahora: () => AHORA });
    const e = await g.comprobar();
    expect(e.plan).toBe('gratis');
    expect(e.estado).toBe('cancelada');
    expect(e.claveVisible).toBe('CLIA-••••-••••-••••-WXYZ');
  });

  it('impagada → gratis (impagada)', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA);
    const impagada = { status: 200, cuerpo: { premium: false, estado: 'impagada', renuevaEn: null } };
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: impagada }), ahora: () => AHORA });
    expect(await g.comprobar()).toMatchObject({ plan: 'gratis', estado: 'impagada' });
  });

  it('servidor caído con la caché activa de hace 3 días → premium (sin_conexion)', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: '2026-11-01T00:00:00.000Z' }, AHORA - 3 * DIA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    expect(await g.comprobar()).toEqual({
      plan: 'premium',
      estado: 'sin_conexion',
      renuevaEn: '2026-11-01T00:00:00.000Z',
      claveVisible: 'CLIA-••••-••••-••••-WXYZ',
    });
    // La caché no se toca: comprobadaEn sigue siendo la de la última respuesta del servidor.
    expect(JSON.parse(readFileSync(r, 'utf8')).comprobadaEn).toBe(new Date(AHORA - 3 * DIA).toISOString());
  });

  it('servidor con error (503, 500) cuenta como sin conexión', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA - DIA);
    const f = vi.fn(async () => respuesta(503, { error: 'premium_no_configurado' }));
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: f, ahora: () => AHORA });
    expect(await g.comprobar()).toMatchObject({ plan: 'premium', estado: 'sin_conexion' });
  });

  it('servidor caído con la caché de hace 8 días → gratis, sin cerrar nada', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA - 8 * DIA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    expect(await g.comprobar()).toMatchObject({ plan: 'gratis', estado: 'sin_conexion' });
    // Antes de comprobar, una caché caducada tampoco da premium.
    const otro = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    expect(otro.estado()).toMatchObject({ plan: 'gratis', estado: 'sin_conexion' });
  });

  it('el servidor ya no conoce la clave (404) → se olvida y queda gratis', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({}), ahora: () => AHORA });
    expect(await g.comprobar()).toEqual({ plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null });
    expect(existsSync(r)).toBe(false);
  });

  it('activar con un formato inválido lanza error y no guarda ni consulta', async () => {
    const r = ruta();
    const f = fetchFalso({});
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: f, ahora: () => AHORA });
    for (const mala of ['', 'CLIA-1234', 'CLIA-ABCD-EFGH-JKLM-WXY0', 'CLIA-ABCD-EFGH-JKLM-WXYI', 'XXXX-ABCD-EFGH-JKLM-WXYZ']) {
      await expect(g.activar(mala)).rejects.toThrow('clave_no_valida');
    }
    expect(f).not.toHaveBeenCalled();
    expect(existsSync(r)).toBe(false);
  });

  it('activar una clave que el servidor no reconoce no la guarda y conserva la anterior', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: activa }), ahora: () => AHORA });
    const e = await g.activar('CLIA-ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    expect(e.plan).toBe('premium');
    expect(JSON.parse(readFileSync(r, 'utf8')).clave).toBe(CLAVE);
  });

  it('activar sin conexión lanza error y no guarda', async () => {
    const r = ruta();
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    await expect(g.activar(CLAVE)).rejects.toThrow();
    expect(existsSync(r)).toBe(false);
  });

  it('quitar borra la licencia y avisa del cambio', async () => {
    const r = ruta();
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: activa }), ahora: () => AHORA });
    const cambios: string[] = [];
    const dejar = g.alCambiar((e) => cambios.push(`${e.plan}:${e.estado}`));
    await g.activar(CLAVE);
    expect(g.quitar()).toEqual({ plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null });
    expect(existsSync(r)).toBe(false);
    expect(cambios).toEqual(['premium:activa', 'gratis:sin_licencia']);
    dejar();
    await g.activar(CLAVE);
    expect(cambios).toHaveLength(2);
  });

  it('comprobar sin cambios no vuelve a avisar', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: '2026-11-18T00:00:00.000Z' }, AHORA);
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: activa }), ahora: () => AHORA });
    const cb = vi.fn();
    g.alCambiar(cb);
    await g.comprobar();
    expect(cb).not.toHaveBeenCalled();
  });

  it('una respuesta del servidor con forma inesperada cuenta como sin conexión', async () => {
    const r = ruta();
    cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null }, AHORA);
    const f = vi.fn(async () => respuesta(200, { premium: 'si' }));
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: f, ahora: () => AHORA });
    expect(await g.comprobar()).toMatchObject({ plan: 'premium', estado: 'sin_conexion' });
  });

  it('un licencia.json roto cuenta como sin licencia', () => {
    const r = ruta();
    writeFileSync(r, '{roto', 'utf8');
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => AHORA });
    expect(g.estado()).toMatchObject({ plan: 'gratis', estado: 'sin_licencia' });
  });

  it('con forzarPremium (COACH_PREMIUM=1) → premium sin consultar al servidor', async () => {
    const f = fetchFalso({});
    const g = crearGestorLicencia({ ruta: ruta(), urlServidor: SERVIDOR, fetch: f, ahora: () => AHORA, forzarPremium: true });
    expect(g.estado()).toMatchObject({ plan: 'premium', estado: 'activa' });
    expect(await g.comprobar()).toMatchObject({ plan: 'premium', estado: 'activa' });
    expect(f).not.toHaveBeenCalled();
  });

  it('ocultarClave deja solo el último grupo', () => {
    expect(ocultarClave(CLAVE)).toBe('CLIA-••••-••••-••••-WXYZ');
  });
});

describe('abrirWeb', () => {
  it('la web vive en https://www.coachlolia.com, sin ruta base', () => {
    expect(URL_WEB).toBe('https://www.coachlolia.com');
    expect(RUTAS_WEB).toEqual(['/', '/premium', '/premium/gestionar', '/descargar']);
    expect(urlWeb('/')).toBe('https://www.coachlolia.com/');
    expect(urlWeb('/premium')).toBe('https://www.coachlolia.com/premium');
    expect(urlWeb('/premium/gestionar')).toBe('https://www.coachlolia.com/premium/gestionar');
    expect(urlWeb('/descargar')).toBe('https://www.coachlolia.com/descargar');
  });

  it('abre las 4 rutas de la lista blanca con el navegador del sistema', async () => {
    const abrir = vi.fn(async () => undefined);
    await abrirWeb('/premium', abrir);
    expect(abrir).toHaveBeenCalledWith('https://www.coachlolia.com/premium');
  });

  it('rechaza cualquier otra ruta sin abrir nada', async () => {
    const abrir = vi.fn(async () => undefined);
    for (const mala of ['/privacidad', 'https://malo.test', '//malo.test', '/premium/../x', '', null, 42, { ruta: '/' }]) {
      await expect(abrirWeb(mala, abrir)).rejects.toThrow('Ruta web no permitida');
    }
    expect(abrir).not.toHaveBeenCalled();
  });
});

describe('IPC de la licencia', () => {
  function montar() {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: vi.fn((canal: string, f: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(canal, f)) };
    const gestor = crearGestorLicencia({ ruta: ruta(), urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: activa }), ahora: () => AHORA });
    const abrir = vi.fn(async () => undefined);
    const principal = {};
    registrarIpcLicencia(ipc, gestor, { abrir, esPrincipal: (s) => s === principal });
    const invocar = (canal: string, sender: unknown, ...a: unknown[]) => manejadores.get(canal)!({ sender }, ...a);
    return { ipc, abrir, principal, invocar };
  }

  it('registra estado, activar, quitar y abrir-web', () => {
    const { ipc } = montar();
    expect(ipc.handle.mock.calls.map((c) => c[0]).sort()).toEqual([
      'coach:abrir-web',
      'coach:licencia-activar',
      'coach:licencia-estado',
      'coach:licencia-quitar',
    ]);
  });

  it('estado, activar y quitar desde la ventana principal', async () => {
    const { invocar, principal } = montar();
    expect(await invocar('coach:licencia-estado', principal)).toMatchObject({ plan: 'gratis' });
    expect(await invocar('coach:licencia-activar', principal, CLAVE)).toMatchObject({ plan: 'premium' });
    expect(await invocar('coach:licencia-quitar', principal)).toMatchObject({ plan: 'gratis' });
  });

  it('activar con algo que no es texto lanza clave_no_valida', async () => {
    const { invocar, principal } = montar();
    await expect(Promise.resolve().then(() => invocar('coach:licencia-activar', principal, 42))).rejects.toThrow('clave_no_valida');
  });

  it('abrir-web valida la ruta en main y solo atiende a la ventana principal', async () => {
    const { invocar, principal, abrir } = montar();
    await invocar('coach:abrir-web', principal, '/premium/gestionar');
    expect(abrir).toHaveBeenCalledWith('https://www.coachlolia.com/premium/gestionar');
    await expect(Promise.resolve().then(() => invocar('coach:abrir-web', principal, 'https://malo.test'))).rejects.toThrow();
    await expect(Promise.resolve().then(() => invocar('coach:abrir-web', {}, '/premium'))).rejects.toThrow();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe('licencias de prueba en la app', () => {
  const HORA = 3600 * 1000;
  const DISP = 'd'.repeat(64);
  const prueba = (caducaEn: string, estado = 'activa', premium = true) => ({
    status: 200,
    cuerpo: { premium, estado, renuevaEn: null, caducaEn, tipo: 'prueba' },
  });

  it('envía ?dispositivo=<id> en cada consulta de estado', async () => {
    const f = fetchFalso({ [CLAVE]: prueba(new Date(AHORA + 24 * HORA).toISOString()) });
    const g = crearGestorLicencia({ ruta: ruta(), urlServidor: SERVIDOR, fetch: f, ahora: () => AHORA, dispositivo: async () => DISP, programar: () => () => undefined });
    await g.activar(CLAVE);
    expect(String(f.mock.calls[0][0])).toBe(`${SERVIDOR}/api/premium/estado/${CLAVE}?dispositivo=${DISP}`);
  });

  it('una prueba activa → premium con tipo y caducaEn; al llegar la fecha pasa a gratis (caducada) aunque no haya conexión', async () => {
    let ahora = AHORA;
    const caducaEn = new Date(AHORA + 2 * HORA).toISOString();
    const r = ruta();
    const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: prueba(caducaEn) }), ahora: () => ahora, programar: () => () => undefined });
    expect(await g.activar(CLAVE)).toEqual({
      plan: 'premium',
      estado: 'activa',
      renuevaEn: null,
      claveVisible: 'CLIA-••••-••••-••••-WXYZ',
      tipo: 'prueba',
      caducaEn,
    });
    ahora = AHORA + 2 * HORA;
    expect(g.estado()).toMatchObject({ plan: 'gratis', estado: 'caducada', tipo: 'prueba' });
    const sinRed = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: caido, ahora: () => ahora, programar: () => () => undefined });
    expect(await sinRed.comprobar()).toMatchObject({ plan: 'gratis', estado: 'caducada' });
  });

  it('con una prueba activa vuelve a comprobar justo al caducar (no solo cada 6 h) y avisa del cambio', async () => {
    let ahora = AHORA;
    const caducaEn = new Date(AHORA + 3 * HORA).toISOString();
    const respuestas = { [CLAVE]: prueba(caducaEn) };
    const programados: { ms: number; cb: () => void }[] = [];
    const g = crearGestorLicencia({
      ruta: ruta(),
      urlServidor: SERVIDOR,
      fetch: fetchFalso(respuestas),
      ahora: () => ahora,
      programar: (ms, cb) => {
        programados.push({ ms, cb });
        return () => undefined;
      },
    });
    const cambios: string[] = [];
    g.alCambiar((e) => cambios.push(`${e.plan}:${e.estado}`));
    await g.activar(CLAVE);
    const ultimo = programados.at(-1)!;
    expect(ultimo.ms).toBeGreaterThanOrEqual(3 * HORA);
    expect(ultimo.ms).toBeLessThanOrEqual(3 * HORA + 5000);
    ahora = AHORA + 3 * HORA + 1000;
    respuestas[CLAVE] = prueba(caducaEn, 'caducada', false);
    ultimo.cb();
    await vi.waitFor(() => expect(cambios.at(-1)).toBe('gratis:caducada'));
  });

  it('otro_dispositivo y prueba_ya_usada → gratis; al activar, no se guarda y se lanza el motivo', async () => {
    for (const estado of ['otro_dispositivo', 'prueba_ya_usada', 'caducada']) {
      const r = ruta();
      const resp = { status: 200, cuerpo: { premium: false, estado, renuevaEn: null, caducaEn: new Date(AHORA + HORA).toISOString(), tipo: 'prueba' } };
      const g = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: resp }), ahora: () => AHORA, programar: () => () => undefined });
      await expect(g.activar(CLAVE)).rejects.toThrow(estado);
      expect(existsSync(r)).toBe(false);
      // Una prueba ya guardada que el servidor marca así pasa a gratis con ese estado.
      cacheDe(r, { premium: true, estado: 'activa', renuevaEn: null, caducaEn: new Date(AHORA + HORA).toISOString(), tipo: 'prueba' }, AHORA);
      const g2 = crearGestorLicencia({ ruta: r, urlServidor: SERVIDOR, fetch: fetchFalso({ [CLAVE]: resp }), ahora: () => AHORA, programar: () => () => undefined });
      expect(await g2.comprobar()).toMatchObject({ plan: 'gratis', estado });
    }
  });
});

describe('COACH_PREMIUM', () => {
  it('solo fuerza Premium en desarrollo, nunca en la app empaquetada', () => {
    expect(forzarPremiumDe({ COACH_PREMIUM: '1' }, false)).toBe(true);
    expect(forzarPremiumDe({ COACH_PREMIUM: '1' }, true)).toBe(false);
    expect(forzarPremiumDe({ COACH_PREMIUM: 'true' }, false)).toBe(false);
    expect(forzarPremiumDe({}, false)).toBe(false);
  });
});
