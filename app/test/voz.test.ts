import { afterEach, describe, expect, it, vi } from 'vitest';
import { elegirVoz, hablar } from '../src/renderer/overlay/voz';

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
