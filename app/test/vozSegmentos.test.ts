import { describe, expect, it } from 'vitest';
import { crearPack, paquetePack } from '../src/main/voz/pack';
import { esManifest, normalizarSegmento, pausaTras, segmentar, type ManifestPack } from '../src/main/voz/segmentos';
import { pronunciar } from '../src/main/voz/pronunciacion';
import { frasesParaPrecalentar } from '../src/main/voz/precalentar';
import { aIndices, bloquesLatentes, leerEstilo, preprocesar, aPcm16 } from '../src/main/voz/supertonic';
import { elegirVozNatural, esIdVozNatural, catalogoCompleto, urlPaquete, PAQUETE_SUPERTONIC } from '../src/main/voz/catalogo';

const manifest = (claves: Record<string, string>): ManifestPack => ({
  version: 1,
  idioma: 'es',
  vozId: '9F4C8ztpNUmXkdDDbz3J',
  modelo: 'eleven_flash_v2_5',
  fecha: '2026-10-19',
  segmentos: Object.fromEntries(Object.entries(claves).map(([k, texto], i) => [k, { archivo: `clip${String(i).padStart(8, '0')}.mp3`, texto }])),
});

describe('segmentos de la voz pregrabada', () => {
  it('normaliza sin puntuación, en minúsculas y con tildes', () => {
    expect(normalizarSegmento('  ¡Barón disponible,  en UN minuto!  ')).toBe('barón disponible en un minuto');
    expect(normalizarSegmento('Nivel 6: sube la R.')).toBe('nivel 6 sube la r');
  });

  it('divide la frase con el menor número de segmentos', () => {
    const claves = new Set(['puedes comprar', 'filo infinito', 'puedes', 'comprar filo', 'infinito', 'puedes comprar filo infinito']);
    expect(segmentar('Puedes comprar Filo infinito', (k) => claves.has(k))).toEqual(['puedes comprar filo infinito']);
    claves.delete('puedes comprar filo infinito');
    expect(segmentar('Puedes comprar Filo infinito.', (k) => claves.has(k))).toEqual(['puedes comprar', 'filo infinito']);
  });

  it('si falta una parte, null (la frase entera irá con otra voz)', () => {
    const claves = new Set(['puedes comprar']);
    expect(segmentar('Puedes comprar Filo infinito', (k) => claves.has(k))).toBeNull();
    expect(segmentar('', () => true)).toBeNull();
  });

  it('pausas según la puntuación del clip', () => {
    expect(pausaTras('Estimación:')).toBe(160);
    expect(pausaTras('Buen trabajo.')).toBe(280);
    expect(pausaTras('Puedes comprar')).toBe(0);
  });

  it('valida el manifest', () => {
    expect(esManifest(manifest({ a: 'A' }))).toBe(true);
    expect(esManifest({ version: 2, segmentos: {} })).toBe(false);
    expect(esManifest({ ...manifest({}), segmentos: { a: { archivo: '../x.mp3', texto: 'a' } } })).toBe(false);
  });
});

describe('paquete pregrabado en la app', () => {
  const m = manifest({ 'puedes comprar': 'Puedes comprar', 'filo infinito': 'Filo infinito', 'estimación': 'Estimación:', 'el dragón infernal aparece en un minuto': 'El dragón infernal aparece en un minuto' });
  const archivos: Record<string, Buffer> = { 'manifest.json': Buffer.from(JSON.stringify(m)) };
  for (const s of Object.values(m.segmentos)) archivos[s.archivo] = Buffer.from(s.texto);
  const leer = (ruta: string) => {
    const nombre = ruta.split(/[\\/]/).pop()!;
    if (!archivos[nombre]) throw new Error('no existe');
    return archivos[nombre]!;
  };

  it('frase entera en el paquete: sus clips en orden, con pausas', () => {
    const pack = crearPack('/pack', leer);
    const a = pack.buscar('Puedes comprar Filo infinito');
    expect(a && 'clips' in a).toBe(true);
    if (!a || !('clips' in a)) return;
    expect(a.clips.map((c) => Buffer.from(c).toString())).toEqual(['Puedes comprar', 'Filo infinito']);
    expect(a.pausasMs).toEqual([0, 0]);
    expect((pack.buscar('Estimación: Filo infinito') as { pausasMs: number[] } | null)?.pausasMs).toEqual([160, 0]);
    expect(pack.cubre('El dragón infernal aparece en un minuto')).toBe(true);
  });

  it('paquete parcial: lo que no está entero da null (sin mezclar voces)', () => {
    const pack = crearPack('/pack', leer);
    expect(pack.buscar('Puedes comprar Filo de la noche')).toBeNull();
    expect(pack.cubre('El dragón del océano aparece en un minuto')).toBe(false);
  });

  it('sin manifest o con un clip perdido, null', () => {
    expect(crearPack('/nada', () => Buffer.from('{')).buscar('Puedes comprar')).toBeNull();
    const roto = crearPack('/pack', (r) => (r.endsWith('manifest.json') ? archivos['manifest.json']! : (() => { throw new Error('x'); })()));
    expect(roto.buscar('Puedes comprar')).toBeNull();
  });

  it('packs.json: un idioma sin entrada no tiene paquete; con entrada, id con la suma', () => {
    expect(paquetePack('de', {})).toBeNull();
    const p = paquetePack('es', { es: { archivo: 'voz-pack-es-abc.tar.gz', bytes: 10, sha256: 'a'.repeat(64), modelo: 'm', fecha: 'f', segmentos: 1 } });
    expect(p?.id).toBe(`pack-es-${'a'.repeat(12)}`);
    expect(p?.url).toMatch(/voces-v1\/voz-pack-es-abc\.tar\.gz$/);
    expect(paquetePack('es', { es: { archivo: '../x', bytes: 10, sha256: 'a', modelo: 'm', fecha: 'f', segmentos: 1 } })).toBeNull();
  });
});

describe('voz natural: texto, catálogo y modelo', () => {
  it('pronuncia letras de habilidad y siglas en cada idioma', () => {
    expect(pronunciar('Nivel seis: sube la R.', 'es')).toBe('Nivel seis: sube la erre.');
    expect(pronunciar('Tu CS por minuto ha bajado', 'es')).toBe('Tu ce ese por minuto ha bajado');
    expect(pronunciar('E es la primera', 'es')).toBe('E es la primera');
    expect(pronunciar('Skille R.', 'de')).toBe('Skille Er.');
    expect(pronunciar('Level six: R.', 'en')).toBe('Level six: R.');
  });

  it('frases para preparar: fijas y plantillas de pocos valores, sin plurales mezclados', () => {
    const f = frasesParaPrecalentar('es');
    expect(f.length).toBeGreaterThan(10);
    expect(f.every((x) => !x.includes('{'))).toBe(true);
    expect(f.some((x) => /aparecen/.test(x) && /dragón/i.test(x))).toBe(false);
  });

  it('catálogo: voz por defecto en los cinco idiomas, elegida o recomendada', () => {
    expect(catalogoCompleto()).toBe(true);
    expect(elegirVozNatural('es').id).toBe('supertonic3:M2');
    expect(elegirVozNatural('es', { es: 'supertonic3:F1' }).id).toBe('supertonic3:F1');
    expect(elegirVozNatural('es', { es: 'otra' }).id).toBe('supertonic3:M2');
    expect(esIdVozNatural('supertonic3:F5')).toBe(true);
    expect(urlPaquete(PAQUETE_SUPERTONIC, 'http://127.0.0.1:8099/')).toBe('http://127.0.0.1:8099/voz-supertonic3-int8-v1.tar.gz');
  });

  it('preprocesado del modelo como el oficial', () => {
    expect(preprocesar('Hola — mundo', 'es')).toBe('<es>Hola - mundo.</es>');
    expect(preprocesar('¿Ya? ', 'fr')).toBe('<fr>¿Ya?</fr>');
    const idx = aIndices('ab', Object.assign(new Array(200).fill(0), { 97: 5, 98: 7 }));
    expect([...idx]).toEqual([5n, 7n]);
    expect(bloquesLatentes(1, { ae: { sample_rate: 44100, base_chunk_size: 512 }, ttl: { chunk_compress_factor: 6, latent_dim: 24 } })).toBe(15);
    expect(() => leerEstilo({ style_ttl: { dims: [1, 2, 2], data: [[1, 2]] }, style_dp: { dims: [1, 1, 1], data: [1] } })).toThrow();
    expect([...aPcm16(Float32Array.of(1, -1, 0))]).toEqual([255, 127, 1, 128, 0, 0]);
  });
});
