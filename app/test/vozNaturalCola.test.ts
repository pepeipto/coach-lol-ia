import { afterEach, describe, expect, it, vi } from 'vitest';
import { aMuestras, ColaVoz, conEspera, hablar, recortarSilencio, unirClips, type FuenteNatural, type Reproductor } from '../src/renderer/overlay/voz';
import type { AudioVoz, FraseVoz } from '../src/shared/tiposApp';

const frase = (clave: string, prioridad = 5): FraseVoz => ({ tipo: 'objetivo', clave, texto: clave, prioridad, caducaMs: 10_000 });
const esperar = () => new Promise((r) => setTimeout(r, 0));
const PCM: AudioVoz = { sampleRate: 44100, pcm: new Uint8Array(4) };

class Frase {
  voice: unknown;
  lang = '';
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function montar(natural: FuenteNatural, ok = true) {
  vi.stubGlobal('SpeechSynthesisUtterance', Frase);
  const dichas: Frase[] = [];
  const sint = {
    getVoices: () => [{ lang: 'es-ES', name: 'Helena' }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    cancel: vi.fn(),
    speak: vi.fn((f: Frase) => void dichas.push(f)),
  } as unknown as SpeechSynthesis;
  const sonando: { audio: AudioVoz; volumen: number; fin: () => void }[] = [];
  const reproductor: Reproductor = {
    reproducir: vi.fn(async (audio, volumen, fin) => {
      if (!ok) return false;
      sonando.push({ audio, volumen, fin });
      return true;
    }),
    detener: vi.fn(),
  };
  const cola = new ColaVoz(sint, Date.now, natural, reproductor);
  cola.configurar({ volumen: 0.6, vozId: null, motor: 'pack' });
  return { cola, dichas, sonando, reproductor };
}

describe('cola de voz con la voz de main (3.1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa el audio de main con el volumen y prepara al encolar; una frase cada vez', async () => {
    const natural = { sintetizar: vi.fn(async () => PCM), preparar: vi.fn() };
    const { cola, sonando, dichas } = montar(natural);
    cola.encolar(frase('a'));
    cola.encolar(frase('b'));
    expect(natural.preparar).toHaveBeenCalledWith('a');
    expect(natural.preparar).toHaveBeenCalledWith('b');
    await esperar();
    expect(sonando).toHaveLength(1);
    expect(sonando[0]!.volumen).toBe(0.6);
    sonando[0]!.fin();
    await esperar();
    expect(sonando).toHaveLength(2);
    expect(dichas).toHaveLength(0);
  });

  it('sin audio de main (null o error) la frase sale con la voz de Windows', async () => {
    const { cola, dichas } = montar({ sintetizar: async () => null });
    cola.encolar(frase('x'));
    await esperar();
    await esperar();
    expect(dichas.map((d) => d.text)).toEqual(['x']);
    const rechazo = montar({ sintetizar: async () => Promise.reject(new Error('ipc')) });
    rechazo.cola.encolar(frase('y'));
    await esperar();
    await esperar();
    expect(rechazo.dichas.map((d) => d.text)).toEqual(['y']);
  });

  it('si el reproductor no puede (clip dañado), también Windows', async () => {
    const { cola, dichas } = montar({ sintetizar: async () => PCM }, false);
    cola.encolar(frase('z'));
    await esperar();
    await esperar();
    await esperar();
    expect(dichas.map((d) => d.text)).toEqual(['z']);
  });

  it('con el motor «Windows» ni se pide audio a main', async () => {
    const natural = { sintetizar: vi.fn(async () => PCM), preparar: vi.fn() };
    const { cola, dichas } = montar(natural);
    cola.configurar({ volumen: 1, vozId: null, motor: 'sistema' });
    cola.encolar(frase('w'));
    await esperar();
    await esperar();
    expect(natural.sintetizar).not.toHaveBeenCalled();
    expect(natural.preparar).not.toHaveBeenCalled();
    expect(dichas).toHaveLength(1);
  });

  it('detener corta el audio en curso', async () => {
    const { cola, reproductor } = montar({ sintetizar: async () => PCM });
    cola.encolar(frase('a'));
    await esperar();
    cola.detener();
    expect(reproductor.detener).toHaveBeenCalled();
  });

  it('«Probar voz» con la voz de main y, si no hay, Windows', async () => {
    const r: Reproductor = { reproducir: vi.fn(async () => true), detener: vi.fn() };
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', Frase);
    const sint = { getVoices: () => [{ lang: 'es-ES', name: 'H' }], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak } as unknown as SpeechSynthesis;
    await hablar('hola', sint, { volumen: 1, vozId: null }, { sintetizar: async () => PCM }, r);
    expect(r.reproducir).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    await hablar('hola', sint, { volumen: 1, vozId: null }, { sintetizar: async () => null }, r);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('conEspera: lo que tarda demasiado da null', async () => {
    vi.useFakeTimers();
    const lenta = conEspera(new Promise<number>(() => {}), 100);
    vi.advanceTimersByTime(150);
    expect(await lenta).toBeNull();
    vi.useRealTimers();
  });
});

describe('unión de clips pregrabados', () => {
  const sr = 1000;
  const tono = (n: number, v = 0.5) => Float32Array.from({ length: n }, () => v);
  const conSilencio = (n: number) => Float32Array.from([...new Float32Array(50), ...tono(n), ...new Float32Array(50)]);

  it('recorta el silencio de los extremos dejando un margen', () => {
    const r = recortarSilencio(conSilencio(100), sr, 0.004, 10);
    expect(r.length).toBe(120);
    expect(recortarSilencio(new Float32Array(30), sr).length).toBe(0);
  });

  it('funde los clips sin hueco (solape corto) y respeta las pausas de la puntuación', () => {
    const a = conSilencio(100);
    const b = conSilencio(100);
    const sinPausa = unirClips([a, b], sr, [0], 8);
    // 2 × (100 + 2 × 12 de margen) muestras, menos 8 de solape.
    expect(sinPausa.length).toBe(240);
    // Sin saltos bruscos dentro del fundido: nunca supera la suma de los dos clips.
    expect(Math.max(...sinPausa)).toBeLessThanOrEqual(0.5 + 1e-6);
    const conPausa = unirClips([a, b], sr, [200], 8);
    expect(conPausa.length).toBe(248 + 200);
    expect(conPausa.slice(124, 324).every((x) => x === 0)).toBe(true);
  });

  it('PCM de 16 bits a coma flotante', () => {
    expect([...aMuestras(Uint8Array.of(0, 0x40, 0, 0xc0))]).toEqual([0.5, -0.5]);
  });
});
