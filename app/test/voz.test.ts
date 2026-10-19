import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColaVoz, elegirVoz, hablar, VIGILANTE_VOZ_MS } from '../src/renderer/overlay/voz';
import type { FraseVoz } from '../src/shared/tiposApp';

const voz = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;

describe('elegirVoz', () => {
  it('prefiere es-MX, luego es-ES, luego cualquier es-*', () => {
    expect(elegirVoz([voz('en-US'), voz('es-ES'), voz('es-MX')])?.lang).toBe('es-MX');
    expect(elegirVoz([voz('en-US'), voz('es-AR'), voz('es-ES')])?.lang).toBe('es-ES');
    expect(elegirVoz([voz('en-US'), voz('es-AR')])?.lang).toBe('es-AR');
  });
  it('acepta voces con guion bajo (es_MX)', () => {
    expect(elegirVoz([voz('en_US'), voz('es_ES'), voz('es_MX')])?.lang).toBe('es_MX');
  });
  it('sin voces en español devuelve null', () => {
    expect(elegirVoz([voz('en-US'), voz('fr-FR')])).toBeNull();
    expect(elegirVoz([])).toBeNull();
  });
});

describe('hablar', () => {
  afterEach(() => vi.unstubAllGlobals());

  class Frase {
    voice: unknown;
    lang = '';
    constructor(public text: string) {}
  }
  const montar = (primera: SpeechSynthesisVoice[], despues: SpeechSynthesisVoice[]) => {
    const oyentes: (() => void)[] = [];
    let llamadas = 0;
    const speak = vi.fn();
    const sint = {
      getVoices: () => (llamadas++ === 0 ? primera : despues),
      addEventListener: (_n: string, f: () => void) => oyentes.push(f),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak,
    } as unknown as SpeechSynthesis;
    vi.stubGlobal('SpeechSynthesisUtterance', Frase);
    return { sint, oyentes, speak };
  };

  it('espera a voiceschanged si al principio no hay voces', async () => {
    const { sint, oyentes, speak } = montar([], [voz('es-MX')]);
    const p = hablar('hola', sint);
    oyentes.forEach((f) => f());
    await p;
    expect(speak).toHaveBeenCalledTimes(1);
  });
  it('sin voz en español se queda en silencio', async () => {
    const { sint, speak } = montar([voz('en-US')], [voz('en-US')]);
    await hablar('hola', sint);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('elegirVoz con la voz de los ajustes', () => {
  const v = (lang: string, name: string) => ({ lang, name, voiceURI: `uri-${name}` }) as SpeechSynthesisVoice;
  it('usa la voz elegida si sigue instalada y es española; si no, la de siempre', () => {
    const voces = [v('es-ES', 'Helena'), v('es-MX', 'Sabina'), v('en-US', 'Zira')];
    expect(elegirVoz(voces, 'uri-Helena')?.name).toBe('Helena');
    expect(elegirVoz(voces, 'Helena')?.name).toBe('Helena');
    expect(elegirVoz(voces, 'uri-Zira')?.name).toBe('Sabina');
    expect(elegirVoz(voces, 'uri-Borrada')?.name).toBe('Sabina');
  });
});

describe('cola de voz', () => {
  afterEach(() => vi.unstubAllGlobals());

  class Frase {
    voice: unknown;
    lang = '';
    volume = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const frase = (clave: string, prioridad: number, caducaMs = 10_000): FraseVoz => ({ tipo: 'objetivo', clave, texto: clave, prioridad, caducaMs });

  function montar() {
    vi.stubGlobal('SpeechSynthesisUtterance', Frase);
    const dichas: Frase[] = [];
    const sint = {
      getVoices: () => [voz('es-MX')],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn((f: Frase) => void dichas.push(f)),
    } as unknown as SpeechSynthesis;
    let ahora = 0;
    const cola = new ColaVoz(sint, () => ahora);
    const terminar = async () => {
      dichas.at(-1)!.onend!();
      await Promise.resolve();
      await Promise.resolve();
    };
    return { cola, dichas, sint, terminar, avanzar: (ms: number) => (ahora += ms) };
  }
  const esperar = () => new Promise((r) => setTimeout(r, 0));

  it('nunca solapa: la segunda frase espera a que acabe la primera', async () => {
    const { cola, dichas, terminar } = montar();
    cola.encolar(frase('a', 5));
    cola.encolar(frase('b', 5));
    await esperar();
    expect(dichas.map((f) => f.text)).toEqual(['a']);
    await terminar();
    await esperar();
    expect(dichas.map((f) => f.text)).toEqual(['a', 'b']);
  });

  it('elige la más urgente de las que esperan', async () => {
    const { cola, dichas, terminar } = montar();
    cola.encolar(frase('fase', 7));
    cola.encolar(frase('compra', 4));
    cola.encolar(frase('objetivo', 0));
    await esperar();
    await terminar();
    await esperar();
    await terminar();
    await esperar();
    expect(dichas.map((f) => f.text)).toEqual(['fase', 'objetivo', 'compra']);
  });

  it('descarta las frases que caducan mientras esperan', async () => {
    const { cola, dichas, terminar, avanzar } = montar();
    cola.encolar(frase('larga', 5));
    cola.encolar(frase('vieja', 1, 8000));
    cola.encolar(frase('aguanta', 6, 60_000));
    await esperar();
    avanzar(9000);
    await terminar();
    await esperar();
    expect(dichas.map((f) => f.text)).toEqual(['larga', 'aguanta']);
  });

  it('aplica el volumen y la voz de los ajustes; detener() vacía la cola y corta', async () => {
    const { cola, dichas, sint } = montar();
    cola.configurar({ volumen: 0.4, vozId: null });
    cola.encolar(frase('a', 1));
    cola.encolar(frase('b', 1));
    await esperar();
    expect(dichas[0]!.volume).toBe(0.4);
    cola.detener();
    expect(sint.cancel).toHaveBeenCalled();
    expect(cola.enEspera).toEqual([]);
    expect(cola.ocupada).toBe(false);
  });

  it('si el motor no avisa del final, el vigilante libera la cola', async () => {
    vi.useFakeTimers();
    try {
      const { cola, dichas } = montar();
      cola.encolar(frase('a', 1));
      cola.encolar(frase('b', 1));
      await vi.advanceTimersByTimeAsync(0);
      expect(dichas).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(VIGILANTE_VOZ_MS);
      expect(dichas.map((f) => f.text)).toEqual(['a', 'b']);
    } finally {
      vi.useRealTimers();
    }
  });
});
