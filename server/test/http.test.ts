import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Build, Rol } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import { crearServidor } from '../src/http';

function build(campeon: string, rol: Rol, parche: string): Build {
  return {
    campeon,
    rol,
    parche,
    partidas: 250,
    tasaVictoria: 0.52,
    mezclaParches: false,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [3020],
    habilidades: ['Q', 'W', 'E'],
  } as unknown as Build;
}

function part(matchId: string, campeon: string, rol: Rol, parche: string): Participacion {
  return {
    matchId,
    campeon,
    rol,
    victoria: true,
    parche,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [3020],
    habilidades: ['Q', 'W', 'E'],
  };
}

describe('API HTTP', () => {
  let db: Db;
  let app: FastifyInstance;

  beforeEach(() => {
    db = abrirDb(':memory:');
    app = crearServidor(db);
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('GET /salud responde ok', async () => {
    const r = await app.inject({ method: 'GET', url: '/salud' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
  });

  it('devuelve la build existente', async () => {
    const b = build('Ahri', 'MIDDLE', '14.1');
    db.guardarBuild(b);
    const r = await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(JSON.parse(JSON.stringify(b)));
  });

  it('devuelve la opción más jugada arriba y las opciones de build (compatible con clientes de v1)', async () => {
    const a = { ...build('Ahri', 'MIDDLE', '14.1'), popularidad: 0.6 };
    const b = { ...build('Ahri', 'MIDDLE', '14.1'), nucleo: [3135, 3165, 3102], partidas: 40, popularidad: 0.4 };
    db.guardarBuild({ ...a, opciones: [a, b] });
    const r = await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE' });
    const cuerpo = r.json();
    expect(cuerpo.nucleo).toEqual(a.nucleo);
    expect(cuerpo.opciones).toHaveLength(2);
    expect(cuerpo.opciones[1].nucleo).toEqual([3135, 3165, 3102]);
  });

  it('rechaza un rol inválido con 400', async () => {
    const r = await app.inject({ method: 'GET', url: '/builds/Ahri/SUPPORT' });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: 'rol_invalido' });
  });

  it('devuelve 404 si no hay datos', async () => {
    const r = await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: 'sin_datos' });
  });

  it('lista los roles de mayor a menor', async () => {
    db.guardarBuild(build('Ahri', 'MIDDLE', '14.1'));
    db.guardarParticipaciones('EUW', [
      part('m1', 'Ahri', 'MIDDLE', '14.1'),
      part('m2', 'Ahri', 'MIDDLE', '14.1'),
      part('m3', 'Ahri', 'UTILITY', '14.1'),
    ]);
    const r = await app.inject({ method: 'GET', url: '/roles/Ahri' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      campeon: 'Ahri',
      roles: [
        { rol: 'MIDDLE', partidas: 2 },
        { rol: 'UTILITY', partidas: 1 },
      ],
    });
  });

  it('/roles sin datos devuelve lista vacía', async () => {
    const r = await app.inject({ method: 'GET', url: '/roles/Ahri' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ campeon: 'Ahri', roles: [] });
  });

  it('ignora mayúsculas en el campeón: «FiddleSticks» (Match-v5) se sirve como «Fiddlesticks» (Data Dragon)', async () => {
    db.guardarParticipaciones('EUW', [part('m1', 'FiddleSticks', 'JUNGLE', '14.1'), part('m2', 'FiddleSticks', 'JUNGLE', '14.1')]);
    db.guardarBuild(build('FiddleSticks', 'JUNGLE', '14.1'));
    const r = await app.inject({ method: 'GET', url: '/builds/Fiddlesticks/JUNGLE' });
    expect(r.statusCode).toBe(200);
    expect(r.json().rol).toBe('JUNGLE');
    const roles = await app.inject({ method: 'GET', url: '/roles/Fiddlesticks' });
    expect(roles.json().roles).toEqual([{ rol: 'JUNGLE', partidas: 2 }]);
  });
  describe('GET /campeones', () => {
    const conCifras = (campeon: string, rol: Rol, partidas: number, tasaVictoria: number) =>
      ({ ...build(campeon, rol, '14.1'), partidas, tasaVictoria }) as Build;

    it('sin builds devuelve la lista vacía', async () => {
      const r = await app.inject({ method: 'GET', url: '/campeones' });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ parche: '', campeones: [] });
    });

    it('devuelve campeón, rol, partidas, victorias, uso, tier y datos limitados', async () => {
      db.guardarBuild(conCifras('Ahri', 'MIDDLE', 300, 0.52));
      db.guardarBuild(conCifras('Zed', 'MIDDLE', 100, 0.48));
      const r = await app.inject({ method: 'GET', url: '/campeones' });
      expect(r.statusCode).toBe(200);
      const cuerpo = r.json();
      expect(cuerpo.parche).toBe('14.1');
      expect(cuerpo.campeones).toHaveLength(2);
      expect(cuerpo.campeones[0]).toEqual({
        campeon: 'Ahri',
        rol: 'MIDDLE',
        partidas: 300,
        tasaVictoria: 0.52,
        uso: 0.75,
        tier: 'S',
        datosLimitados: false,
      });
    });

    it('acepta ?modo=clasificatoria y rechaza un modo desconocido', async () => {
      db.guardarBuild(conCifras('Ahri', 'MIDDLE', 300, 0.52));
      const ok = await app.inject({ method: 'GET', url: '/campeones?modo=clasificatoria' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().campeones).toHaveLength(1);
      const malo = await app.inject({ method: 'GET', url: '/campeones?modo=urf' });
      expect(malo.statusCode).toBe(400);
      expect(malo.json()).toEqual({ error: 'modo_invalido' });
    });

    it('se guarda en memoria hasta que se recalculan las builds', async () => {
      db.guardarBuild(conCifras('Ahri', 'MIDDLE', 300, 0.52));
      const leer = vi.spyOn(db, 'builds');
      await app.inject({ method: 'GET', url: '/campeones' });
      await app.inject({ method: 'GET', url: '/campeones' });
      expect(leer).toHaveBeenCalledTimes(1);
      db.guardarBuild(conCifras('Zed', 'MIDDLE', 100, 0.48));
      const r = await app.inject({ method: 'GET', url: '/campeones' });
      expect(leer).toHaveBeenCalledTimes(2);
      expect(r.json().campeones).toHaveLength(2);
    });
  });

  describe('modos de juego', () => {
    const deModo = (campeon: string, modo: 'aram' | 'caos' | 'arena', partidas = 250) =>
      ({ ...build(campeon, 'MIDDLE', '14.1'), rol: null, modo, partidas }) as Build;

    it('GET /builds/:campeon/:rol?modo=aram ignora el rol', async () => {
      db.guardarBuild(build('Ahri', 'MIDDLE', '14.1'));
      db.guardarBuild(deModo('Ahri', 'aram', 40));
      const r = await app.inject({ method: 'GET', url: '/builds/ahri/TOP?modo=aram' });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ modo: 'aram', partidas: 40, rol: null });
      const sinRol = await app.inject({ method: 'GET', url: '/builds/Ahri/ninguno?modo=aram' });
      expect(sinRol.statusCode).toBe(200);
      const clasif = await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE' });
      expect(clasif.json().partidas).toBe(250);
    });

    it('GET /builds con un modo desconocido o sin datos', async () => {
      expect((await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE?modo=urf' })).json()).toEqual({ error: 'modo_invalido' });
      const r = await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE?modo=arena' });
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: 'sin_datos' });
    });

    it('GET /campeones?modo= lista cada modo por separado, con su propia caché', async () => {
      db.guardarBuild(build('Ahri', 'MIDDLE', '14.1'));
      db.guardarBuild(deModo('Zed', 'caos'));
      db.guardarBuild(deModo('Lux', 'arena'));
      const caos = await app.inject({ method: 'GET', url: '/campeones?modo=caos' });
      expect(caos.json().campeones.map((e: { campeon: string; rol: null }) => [e.campeon, e.rol])).toEqual([['Zed', null]]);
      const arena = await app.inject({ method: 'GET', url: '/campeones?modo=arena' });
      expect(arena.json().campeones.map((e: { campeon: string }) => e.campeon)).toEqual(['Lux']);
      const clasif = await app.inject({ method: 'GET', url: '/campeones' });
      expect(clasif.json().campeones.map((e: { campeon: string }) => e.campeon)).toEqual(['Ahri']);
    });
  });
});

