import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { FiltroAvisos } from '../src/main/consejos/antispam';
import { generarIndicaciones } from '../src/main/consejos/motor';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { crearConectorPartida } from '../src/main/partida/conector';
import type { EstadoPartida } from '../src/shared/tiposApp';
import { iniciarSimulador } from '../tools/simulador-partida';

const build: Build = {
  campeon: 'Ahri', rol: 'MIDDLE', parche: '15.20', partidas: 500, tasaVictoria: 0.5, mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  hechizos: [4, 14], objetosIniciales: [1056], nucleo: [6655], botas: null, situacionales: [],
  ordenHabilidades: ['Q', 'W', 'E'], calculadoEn: '2026-10-18T00:00:00Z',
};
const objetos = { 6655: { name: 'Tormenta de Luden', gold: { total: 3000 }, from: [] } } as unknown as DatosEstaticos['objetos'];
const frames = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'grabacion-ejemplo.json'), 'utf8')) as unknown[];

const limpiezas: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const l of limpiezas.splice(0)) await l();
});

describe('prueba de punta a punta (sin Electron)', () => {
  it('el simulador alimenta al conector, al motor y al filtro con los avisos esperados', async () => {
    const sim = await iniciarSimulador(frames, { puerto: 0, intervaloMs: 300 });
    limpiezas.push(() => sim.cerrar());
    const filtro = new FiltroAvisos(0);
    const textos: string[] = [];
    const conector = crearConectorPartida({ url: `http://127.0.0.1:${sim.puerto}`, intervaloMs: 20 });
    limpiezas.push(() => conector.detener());
    conector.on('estado', (estado: EstadoPartida) => {
      const aviso = filtro.procesar(generarIndicaciones(estado, build, 'MIDDLE', objetos), Date.now(), AJUSTES_POR_DEFECTO.avisos);
      if (aviso) textos.push(aviso.texto);
    });
    conector.iniciar();

    await expect.poll(() => textos.some((x) => x.startsWith('Fase media: ')), { timeout: 8000, interval: 50 }).toBe(true);

    expect(textos.every((x) => x.trim().length > 0)).toBe(true);
    const pos = (f: (x: string) => boolean) => textos.findIndex(f);
    const dragon = pos((x) => x === 'El dragón aparece en 60 s');
    const compra = pos((x) => x.includes('ya puedes comprar'));
    const media = pos((x) => x.startsWith('Fase media: '));
    expect(dragon).toBeGreaterThanOrEqual(0);
    expect(compra).toBeGreaterThan(dragon);
    expect(media).toBeGreaterThan(compra);
  });
});
