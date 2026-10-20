import { describe, expect, it, vi } from 'vitest';
import { crearEstadoClaveRiot, INTERVALO_COMPROBACION_MS } from '../src/riot/estadoClave';

function montar(respuestas: (number | null | Error)[] = [200]) {
  let t = Date.UTC(2026, 9, 20, 10, 0, 0);
  const llamadas: number[] = [];
  const logs: string[] = [];
  let i = 0;
  const estado = crearEstadoClaveRiot({
    ahora: () => t,
    comprobar: async () => {
      llamadas.push(t);
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
    log: (m) => logs.push(m),
  });
  return {
    estado,
    llamadas,
    logs,
    avanzar: (ms: number) => {
      t += ms;
    },
    ahora: () => t,
  };
}

describe('estado de la clave de Riot', () => {
  it('empieza desconocida, con riotDesde = arranque', () => {
    const { estado, ahora } = montar();
    expect(estado.estado()).toEqual({ riot: 'desconocida', riotDesde: new Date(ahora()).toISOString() });
  });

  it('401 o 403 de cualquier llamada → caducada; un éxito la devuelve a ok', () => {
    const { estado, avanzar, ahora } = montar();
    estado.observar(200);
    expect(estado.estado().riot).toBe('ok');
    avanzar(1000);
    estado.observar(401);
    expect(estado.estado()).toEqual({ riot: 'caducada', riotDesde: new Date(ahora()).toISOString() });
    avanzar(1000);
    estado.observar(403);
    // riotDesde no se mueve mientras siga caducada.
    expect(estado.estado().riotDesde).toBe(new Date(ahora() - 1000).toISOString());
    avanzar(1000);
    estado.observar(200);
    expect(estado.estado()).toEqual({ riot: 'ok', riotDesde: new Date(ahora()).toISOString() });
  });

  it('404 y 429 también prueban que la clave vale; 5xx no cambia nada', () => {
    const { estado } = montar();
    estado.observar(401);
    estado.observar(500);
    estado.observar(503);
    expect(estado.estado().riot).toBe('caducada');
    estado.observar(404);
    expect(estado.estado().riot).toBe('ok');
    estado.observar(401);
    estado.observar(429);
    expect(estado.estado().riot).toBe('ok');
  });

  it('sin llamadas recientes, consultar lanza una comprobación barata y la aplica', async () => {
    const { estado, llamadas } = montar([401]);
    estado.consultar();
    expect(llamadas).toHaveLength(1);
    await estado.enCurso();
    expect(estado.estado().riot).toBe('caducada');
  });

  it('comprobaciones como mucho cada 10 minutos, aunque /salud se pida cada 30 s', async () => {
    const { estado, llamadas, avanzar } = montar([200]);
    estado.consultar();
    await estado.enCurso();
    for (let s = 0; s < 19; s++) {
      avanzar(30_000);
      estado.consultar();
      await estado.enCurso();
    }
    expect(llamadas).toHaveLength(1);
    avanzar(INTERVALO_COMPROBACION_MS - 19 * 30_000);
    estado.consultar();
    await estado.enCurso();
    expect(llamadas).toHaveLength(2);
    expect(INTERVALO_COMPROBACION_MS).toBe(10 * 60_000);
  });

  it('no comprueba si el propio servidor habló con Riot hace poco', async () => {
    const { estado, llamadas, avanzar } = montar([200]);
    avanzar(INTERVALO_COMPROBACION_MS * 3);
    estado.observar(200);
    avanzar(INTERVALO_COMPROBACION_MS - 1);
    estado.consultar();
    expect(llamadas).toHaveLength(0);
    avanzar(1);
    estado.consultar();
    expect(llamadas).toHaveLength(1);
  });

  it('no lanza dos comprobaciones a la vez', async () => {
    const { estado, llamadas } = montar([200]);
    estado.consultar();
    estado.consultar();
    expect(llamadas).toHaveLength(1);
    await estado.enCurso();
  });

  it('un fallo de red en la comprobación no cambia el estado ni rompe consultar', async () => {
    const { estado, llamadas, avanzar } = montar([new Error('fetch failed'), null]);
    expect(() => estado.consultar()).not.toThrow();
    await estado.enCurso();
    expect(estado.estado().riot).toBe('desconocida');
    avanzar(INTERVALO_COMPROBACION_MS);
    estado.consultar();
    await estado.enCurso();
    expect(llamadas).toHaveLength(2);
    expect(estado.estado().riot).toBe('desconocida');
  });

  it('avisa en el registro solo al cambiar de estado, sin la clave', () => {
    const { estado, logs } = montar();
    estado.observar(200);
    estado.observar(200);
    estado.observar(401);
    estado.observar(401);
    estado.observar(200);
    expect(logs).toHaveLength(3);
    expect(logs[1]).toMatch(/caducad/i);
    for (const l of logs) expect(l).not.toMatch(/RGAPI/);
  });
});
