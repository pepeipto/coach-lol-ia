import { describe, expect, it } from 'vitest';
// @ts-expect-error: módulo .mjs sin tipos (lo ejecuta GitHub Actions con node)
import { avisar, decidir, decidirPronto, ETIQUETA, ETIQUETA_PRONTO, TITULO, TITULO_PRONTO, VENTANA_PRONTO_MS } from '../clave-riot-aviso.mjs';

type Salud = { ok: boolean; riot?: string; riotDesde?: string; riotCaduca?: string } | null;

const AHORA = Date.parse('2026-10-29T12:00:00.000Z');

function montar(salud: Salud | Error, abiertas: { number: number }[] = [], estadoHttp = 200, abiertasPronto: { number: number }[] = []) {
  const llamadasGh: string[][] = [];
  const urls: string[] = [];
  const fetchFalso = async (url: string) => {
    urls.push(url);
    if (salud instanceof Error) throw salud;
    return new Response(JSON.stringify(salud), { status: estadoHttp });
  };
  const gh = async (args: string[]) => {
    llamadasGh.push(args);
    if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(args[args.indexOf('--label') + 1] === ETIQUETA_PRONTO ? abiertasPronto : abiertas);
    return '';
  };
  const registro: string[] = [];
  const correr = () =>
    avisar({ fetch: fetchFalso, gh, repo: 'pepeipto/coach-lol-ia', log: (m: string) => registro.push(m), ahora: AHORA });
  return { correr, llamadasGh, urls, registro };
}

const crear = (ll: string[][]) => ll.filter((a) => a[0] === 'issue' && a[1] === 'create');
const cerrar = (ll: string[][]) => ll.filter((a) => a[0] === 'issue' && a[1] === 'close');

describe('decidir', () => {
  it('caducada sin issue abierta → abrir; con una abierta → nada', () => {
    expect(decidir('caducada', [])).toEqual({ accion: 'abrir' });
    expect(decidir('caducada', [{ number: 7 }])).toEqual({ accion: 'nada' });
  });
  it('ok con issues abiertas → cerrarlas todas; sin issues → nada', () => {
    expect(decidir('ok', [{ number: 7 }, { number: 9 }])).toEqual({ accion: 'cerrar', numeros: [7, 9] });
    expect(decidir('ok', [])).toEqual({ accion: 'nada' });
  });
  it('desconocida o sin respuesta → nada', () => {
    expect(decidir('desconocida', [{ number: 7 }])).toEqual({ accion: 'nada' });
    expect(decidir(undefined, [])).toEqual({ accion: 'nada' });
  });
});

describe('avisar', () => {
  it('pide https://api.coachlolia.com/salud', async () => {
    const { correr, urls } = montar({ ok: true, riot: 'ok' });
    await correr();
    expect(urls).toEqual(['https://api.coachlolia.com/salud']);
  });

  it('caducada y sin issue: crea la etiqueta y una issue asignada a pepeipto con los pasos', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'caducada', riotDesde: '2026-10-20T08:00:00.000Z' });
    expect(await correr()).toBe('abierta');
    const [c] = crear(llamadasGh);
    expect(c).toBeDefined();
    const arg = (n: string) => c[c.indexOf(n) + 1];
    expect(arg('--title')).toBe(TITULO);
    expect(TITULO).toBe('🔑 Renueva la clave de Riot (caducada)');
    expect(arg('--label')).toBe(ETIQUETA);
    expect(arg('--assignee')).toBe('pepeipto');
    expect(arg('--repo')).toBe('pepeipto/coach-lol-ia');
    const cuerpo = arg('--body');
    expect(cuerpo).toContain('https://developer.riotgames.com');
    expect(cuerpo).toContain('Regenerate API Key');
    expect(cuerpo).toContain('Renovar clave Riot');
    expect(cuerpo).not.toMatch(/RGAPI-[0-9a-f]/i);
    // La etiqueta existe antes de crear la issue.
    const iEtiqueta = llamadasGh.findIndex((a) => a[0] === 'label' && a[1] === 'create');
    expect(iEtiqueta).toBeGreaterThanOrEqual(0);
    expect(iEtiqueta).toBeLessThan(llamadasGh.indexOf(c));
  });

  it('caducada con una issue ya abierta: no hace nada (sin spam)', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'caducada' }, [{ number: 12 }]);
    expect(await correr()).toBe('nada');
    expect(crear(llamadasGh)).toHaveLength(0);
    expect(llamadasGh.filter((a) => a[1] === 'comment' || a[1] === 'close')).toHaveLength(0);
  });

  it('busca solo issues abiertas con la etiqueta clave-riot', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'caducada' }, [{ number: 12 }]);
    await correr();
    const l = llamadasGh.find((a) => a[1] === 'list' && a.includes(ETIQUETA))!;
    expect(l[l.indexOf('--label') + 1]).toBe('clave-riot');
    expect(l[l.indexOf('--state') + 1]).toBe('open');
  });

  it('ok otra vez: comenta y cierra la issue abierta', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'ok' }, [{ number: 12 }]);
    expect(await correr()).toBe('cerrada');
    const [c] = cerrar(llamadasGh);
    expect(c[2]).toBe('12');
    expect(c[c.indexOf('--comment') + 1]).toMatch(/funciona/);
    expect(c[c.indexOf('--reason') + 1]).toBe('completed');
    expect(crear(llamadasGh)).toHaveLength(0);
  });

  it('ok sin issue: no toca nada', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'ok' });
    expect(await correr()).toBe('nada');
    expect(llamadasGh.filter((a) => a[1] !== 'list')).toHaveLength(0);
  });

  it('servidor caído o respuesta rara: no abre ni cierra nada', async () => {
    for (const m of [montar(new Error('ECONNREFUSED')), montar({ ok: true }, [{ number: 3 }], 503), montar(null)]) {
      expect(await m.correr()).toBe('nada');
      expect(crear(m.llamadasGh)).toHaveLength(0);
      expect(cerrar(m.llamadasGh)).toHaveLength(0);
    }
  });
});

describe('aviso previo (antes de que caduque)', () => {
  const en = (horas: number) => new Date(AHORA + horas * 3600_000).toISOString();

  it('decidirPronto: abre dentro de la ventana, cierra al renovar o al caducar, y sin riotCaduca no hace nada', () => {
    expect(VENTANA_PRONTO_MS).toBe(8 * 3600_000);
    expect(decidirPronto({ riot: 'ok', riotCaduca: en(3) }, [], AHORA)).toEqual({ accion: 'abrir' });
    expect(decidirPronto({ riot: 'ok', riotCaduca: en(3) }, [{ number: 4 }], AHORA)).toEqual({ accion: 'nada' });
    expect(decidirPronto({ riot: 'ok', riotCaduca: en(20) }, [], AHORA)).toEqual({ accion: 'nada' });
    expect(decidirPronto({ riot: 'ok', riotCaduca: en(20) }, [{ number: 4 }], AHORA)).toEqual({ accion: 'cerrar', numeros: [4] });
    expect(decidirPronto({ riot: 'caducada', riotCaduca: en(-1) }, [{ number: 4 }], AHORA)).toEqual({ accion: 'cerrar', numeros: [4] });
    expect(decidirPronto({ riot: 'ok' }, [{ number: 4 }], AHORA)).toEqual({ accion: 'nada' });
    expect(decidirPronto({ riot: 'desconocida', riotCaduca: en(1) }, [], AHORA)).toEqual({ accion: 'nada' });
  });

  it('ok y caduca en 3 h: abre una issue con la hora, asignada a pepeipto y con su etiqueta', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'ok', riotCaduca: '2026-10-29T15:00:00.000Z' });
    expect(await correr()).toBe('pronto-abierta');
    const [c] = crear(llamadasGh);
    const arg = (n: string) => c![c!.indexOf(n) + 1];
    expect(arg('--title')).toBe(TITULO_PRONTO);
    expect(arg('--label')).toBe(ETIQUETA_PRONTO);
    expect(arg('--assignee')).toBe('pepeipto');
    expect(arg('--body')).toContain('29/10 a las 16:00 (hora de Madrid)');
    expect(arg('--body')).not.toMatch(/RGAPI-[0-9a-f]/i);
  });

  it('al caducar se cierra el aviso previo y se abre el de caducada', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'caducada', riotCaduca: en(-1) }, [], 200, [{ number: 30 }]);
    expect(await correr()).toBe('abierta');
    expect(crear(llamadasGh).map((c) => c[c.indexOf('--title') + 1])).toEqual([TITULO]);
    expect(cerrar(llamadasGh).map((c) => c[2])).toEqual(['30']);
  });

  it('renovada (caduca dentro de 23 h): cierra el aviso previo', async () => {
    const { correr, llamadasGh } = montar({ ok: true, riot: 'ok', riotCaduca: en(23) }, [], 200, [{ number: 30 }]);
    expect(await correr()).toBe('pronto-cerrada');
    expect(cerrar(llamadasGh)[0]![cerrar(llamadasGh)[0]!.indexOf('--comment') + 1]).toMatch(/renovada/);
  });
});
