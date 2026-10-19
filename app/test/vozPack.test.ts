import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ejecutar, leerOpciones, VOZ_POR_DEFECTO, type Dependencias, type FetchGenerador } from '../tools/generar-voz-pack';
import {
  creditosRestantes,
  explicarError,
  leerEnv,
  multiplicadorDeModelos,
  nombresDdragon,
  planificar,
  recogerSegmentos,
  revisarVoz,
  valoresDeHuecos,
  plantillasDeVoz,
  huecosDe,
} from '../tools/vozPack';
import { crearPack } from '../src/main/voz/pack';

const CLAVE = 'sk_clave_de_prueba_que_no_debe_salir_1234567890';
const TEXTOS: Record<string, string> = {
  'voz.compra.1': 'Puedes comprar {objeto}',
  'voz.nivel.1': 'Nivel {nivel}: sube la R',
  'voz.obj.dragon.60.1': 'El {dragon} aparece en un minuto',
  'voz.dragon.infernal': 'dragón infernal',
  'voz.dragon.oceano': 'dragón del océano',
  'voz.animo.1': 'Buen trabajo.',
  'voz.equipo.racha': 'Racha de {campeon}',
  'menu.titulo': 'No es de voz',
};

describe('segmentos del paquete pregrabado', () => {
  const valores = valoresDeHuecos(TEXTOS, { campeones: ['Ahri', 'Lee Sin', ...Array.from({ length: 12 }, (_, i) => `Campeón ${i}`)], objetos: ['Filo infinito', 'Huracán de Runaan', ...Array.from({ length: 12 }, (_, i) => `Objeto ${i}`)] }, huecosDe(plantillasDeVoz(TEXTOS)));

  it('de las plantillas: frases enteras, plantillas de pocos valores expandidas y nombres aparte', () => {
    const { segmentos, sinValores } = recogerSegmentos(plantillasDeVoz(TEXTOS), valores);
    const claves = segmentos.map((s) => s.clave);
    expect(claves).toContain('el dragón infernal aparece en un minuto');
    expect(claves).toContain('buen trabajo');
    expect(claves).toContain('puedes comprar');
    expect(claves).toContain('huracán de runaan');
    expect(claves).toContain('nivel');
    expect(claves).toContain('60');
    expect(claves).not.toContain('no es de voz');
    expect(sinValores).toEqual([]);
    // Orden por prioridad: fijas frecuentes, resto, números, campeones, objetos.
    const prio = (c: string) => segmentos.find((s) => s.clave === c)!.prioridad;
    expect(prio('puedes comprar')).toBe(1);
    expect(claves).not.toContain('puedes comprar filo infinito');
    expect(prio('buen trabajo')).toBe(2);
    expect(prio('7')).toBe(3);
    expect(prio('ahri')).toBe(4);
    expect(prio('filo infinito')).toBe(5);
    expect(segmentos.map((s) => s.prioridad)).toEqual([...segmentos.map((s) => s.prioridad)].sort());
  });

  it('un hueco sin valores se avisa y su plantilla no se graba', () => {
    const { sinValores, segmentos } = recogerSegmentos([['voz.x', 'Hola {raro}']], {});
    expect(sinValores).toEqual(['raro']);
    expect(segmentos).toEqual([]);
  });

  it('presupuesto: por prioridad y sin saltársela; lo hecho no se repite', () => {
    const s = [
      { clave: 'a', texto: 'aaaa', prioridad: 1 as const },
      { clave: 'b', texto: 'bbbbbbbbbb', prioridad: 2 as const },
      { clave: 'c', texto: 'c', prioridad: 3 as const },
    ];
    const p = planificar(s, new Set(['x']), 0.5, 4);
    expect(p.generar.map((x) => x.clave)).toEqual(['a']);
    expect(p.pendientes.map((x) => x.clave)).toEqual(['b', 'c']);
    expect(p.creditos).toBe(2);
    expect(planificar(s, new Set(['a']), 1, 100).generar.map((x) => x.clave)).toEqual(['b', 'c']);
  });

  it('la voz: categoría y bloqueo de voces de biblioteca sin uso comercial', () => {
    expect(revisarVoz({ name: 'Dan Dan', category: 'professional', is_owner: true }).bloqueo).toBeNull();
    const lib = revisarVoz({ name: 'X', category: 'professional', is_owner: false, sharing: { public_owner_id: 'p', commercial_use_allowed: false } });
    expect(lib.biblioteca).toBe(true);
    expect(lib.bloqueo).toMatch(/commercial_use_allowed/);
    expect(revisarVoz({ category: 'library', sharing: { notice_period: 30 } }).avisos.length).toBe(2);
  });

  it('créditos, coste por modelo, errores y .env', () => {
    expect(creditosRestantes({ character_count: 9187, character_limit: 131000 })).toEqual({ usados: 9187, limite: 131000, restantes: 121813 });
    expect(creditosRestantes({})).toBeNull();
    expect(multiplicadorDeModelos([{ model_id: 'eleven_flash_v2_5', model_rates: { character_cost_multiplier: 0.5 } }], 'eleven_flash_v2_5')).toBe(0.5);
    expect(multiplicadorDeModelos([], 'eleven_flash_v2_5')).toBeNull();
    expect(explicarError(401, '')).toMatch(/clave/);
    expect(explicarError(401, '{"detail":{"status":"quota_exceeded"}}')).toMatch(/créditos/);
    expect(explicarError(429, '')).toMatch(/reintenta/);
    expect(leerEnv('# x\nOTRA=1\nexport ELEVENLABS_API_KEY="abc"\nELEVENLABS_VOICE_ID=v1\n')).toEqual({ clave: 'abc' });
  });

  it('nombres de Data Dragon: solo objetos comprables en la Grieta', () => {
    const n = nombresDdragon(
      { data: { Ahri: { name: 'Ahri' } } },
      {
        data: {
          1: { name: 'Filo infinito', gold: { purchasable: true, total: 3400 }, maps: { 11: true } },
          2: { name: 'Poción', gold: { purchasable: false, total: 50 }, maps: { 11: true } },
          3: { name: 'De Kalista', gold: { purchasable: true, total: 1 }, maps: { 11: true }, requiredChampion: 'Kalista' },
        },
      },
    );
    expect(n).toEqual({ campeones: ['Ahri'], objetos: ['Filo infinito'] });
  });

  it('opciones: los cinco idiomas, el modelo y la voz de Dan Dan por defecto', () => {
    expect(leerOpciones(['--idiomas', 'es,en,pt-BR,fr,de']).idiomas).toEqual(['es', 'en', 'pt-BR', 'fr', 'de']);
    expect(leerOpciones([]).idiomas).toEqual(['es']);
    expect(leerOpciones([]).modelo).toBe('eleven_flash_v2_5');
    expect(() => leerOpciones(['--idiomas', 'es,it'])).toThrow(/it/);
    expect(() => leerOpciones(['--modelo', 'otro'])).toThrow();
    expect(VOZ_POR_DEFECTO).toBe('9F4C8ztpNUmXkdDDbz3J');
  });
});

/** ElevenLabs y Data Dragon falsos. */
function apiFalsa(o: { voz?: unknown; fallos429?: number } = {}) {
  const llamadas: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[] = [];
  let fallos = o.fallos429 ?? 0;
  const resp = (status: number, cuerpo: unknown) => ({
    status,
    json: async () => cuerpo,
    text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
    arrayBuffer: async () => new TextEncoder().encode(String(cuerpo)).buffer as ArrayBuffer,
  });
  const f: FetchGenerador = async (url, init) => {
    llamadas.push({ url, init });
    if (url.includes('/v1/voices/')) return resp(200, o.voz ?? { name: 'Dan Dan', category: 'professional', is_owner: false, sharing: null });
    if (url.endsWith('/v1/user/subscription')) return resp(200, { character_count: 9187, character_limit: 131000 });
    if (url.endsWith('/v1/models')) return resp(200, [{ model_id: 'eleven_flash_v2_5', model_rates: { character_cost_multiplier: 0.5 } }]);
    if (url.endsWith('versions.json')) return resp(200, ['15.20.1']);
    if (url.includes('champion.json')) return resp(200, { data: { Ahri: { name: 'Ahri' } } });
    if (url.includes('item.json')) return resp(200, { data: { 1: { name: 'Filo infinito', gold: { purchasable: true, total: 3400 }, maps: { 11: true } } } });
    if (url.includes('/v1/text-to-speech/')) {
      if (fallos-- > 0) return resp(429, 'too_many_concurrent_requests');
      return resp(200, `mp3:${JSON.parse(init!.body!).text}`);
    }
    return resp(404, 'no');
  };
  return { f, llamadas, tts: () => llamadas.filter((l) => l.init?.method === 'POST') };
}

function entorno(maxCreditos?: number, api = apiFalsa()) {
  const dir = mkdtempSync(join(tmpdir(), 'coach-pack-'));
  const env = join(dir, 'ajustes.env');
  writeFileSync(env, `ELEVENLABS_API_KEY=${CLAVE}\n`);
  const log: string[] = [];
  const dep: Dependencias = {
    fetch: api.f,
    preguntar: vi.fn(async () => 's'),
    normalizar: vi.fn(async () => false),
    log: (t) => log.push(t),
    esperar: vi.fn(async () => {}),
    textos: () => TEXTOS,
  };
  const o = { env, idiomas: ['es' as const], modelo: 'eleven_flash_v2_5' as const, salida: join(dir, 'voz-pack'), packs: join(dir, 'packs.json'), seco: false, si: true, maxCreditos };
  return { dir, dep, o, log, api };
}

describe('generador de la voz pregrabada (ElevenLabs simulado)', () => {
  it('--seco: revisa la voz, lee créditos y coste, y no genera nada ni muestra la clave', async () => {
    const e = entorno();
    expect(await ejecutar({ ...e.o, seco: true }, e.dep)).toBe(0);
    const texto = e.log.join('\n');
    expect(texto).toMatch(/Dan Dan/);
    expect(texto).toMatch(/121\.813/);
    expect(texto).toMatch(/0\.5 créditos por carácter/);
    expect(texto).toMatch(/no se ha generado nada/);
    expect(texto).not.toContain(CLAVE);
    expect(e.api.tts()).toHaveLength(0);
    expect(e.api.llamadas.find((l) => l.url.includes('/v1/voices/'))?.url).toContain('9F4C8ztpNUmXkdDDbz3J');
  });

  it('una voz de biblioteca sin uso comercial para antes de gastar', async () => {
    const api = apiFalsa({ voz: { name: 'X', category: 'professional', is_owner: false, sharing: { public_owner_id: 'p', commercial_use_allowed: false } } });
    const e = entorno(undefined, api);
    expect(await ejecutar(e.o, e.dep)).toBe(2);
    expect(api.tts()).toHaveLength(0);
    expect(e.log.join('\n')).toMatch(/no permite uso comercial/);
  });

  it('presupuesto corto: genera por prioridad, deja el resto pendiente y el paquete parcial es seguro', async () => {
    const e = entorno(20);
    expect(await ejecutar(e.o, e.dep)).toBe(0);
    const generados = e.api.tts().map((l) => JSON.parse(l.init!.body!).text as string);
    expect(generados.length).toBeGreaterThan(0);
    expect(e.api.tts().every((l) => l.init!.headers!['xi-api-key'] === CLAVE && JSON.parse(l.init!.body!).language_code === 'es')).toBe(true);
    const texto = e.log.join('\n');
    expect(texto).toMatch(/pendientes [1-9]/);
    expect(texto).not.toContain(CLAVE);
    // Paquete y packs.json escritos.
    const packs = JSON.parse(readFileSync(e.o.packs, 'utf8')) as Record<string, { archivo: string; sha256: string }>;
    expect(packs.es!.archivo).toMatch(/^voz-pack-es-[0-9a-f]{12}\.tar\.gz$/);
    expect(existsSync(join(e.o.salida, packs.es!.archivo))).toBe(true);
    // La app con este paquete parcial: lo que no está entero da null (sale con la voz natural).
    const pack = crearPack(join(e.o.salida, 'es'));
    expect(pack.buscar('Puedes comprar Filo infinito')).toBeNull();

    // Segunda ejecución con más presupuesto: completa sin repetir.
    const antes = e.api.tts().length;
    expect(await ejecutar({ ...e.o, maxCreditos: 100_000 }, e.dep)).toBe(0);
    const nuevos = e.api.tts().slice(antes).map((l) => JSON.parse(l.init!.body!).text as string);
    expect(nuevos.some((t) => generados.includes(t))).toBe(false);
    const completo = crearPack(join(e.o.salida, 'es'));
    expect(completo.buscar('Puedes comprar Filo infinito')).not.toBeNull();
    expect(completo.buscar('El dragón infernal aparece en un minuto')).not.toBeNull();
  });

  it('reintenta los 429 y sigue', async () => {
    const e = entorno(100_000, apiFalsa({ fallos429: 2 }));
    expect(await ejecutar(e.o, e.dep)).toBe(0);
    expect(e.dep.esperar).toHaveBeenCalledTimes(2);
  });

  it('pide confirmación antes de gastar (y «no» cancela)', async () => {
    const e = entorno(100_000);
    e.dep.preguntar = vi.fn(async () => 'n');
    expect(await ejecutar({ ...e.o, si: false }, e.dep)).toBe(0);
    expect(e.api.tts()).toHaveLength(0);
    expect(e.log.join('\n')).toMatch(/Cancelado/);
  });
});
