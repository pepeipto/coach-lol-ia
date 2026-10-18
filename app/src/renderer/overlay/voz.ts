/** Elige la voz en español: es-MX primero, luego es-ES, luego cualquier es-*. Null si no hay ninguna. */
export function elegirVoz(voces: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voces.filter((v) => v.lang.toLowerCase().startsWith('es-'));
  const por = (lang: string) => es.find((v) => v.lang.toLowerCase().replace('_', '-') === lang);
  return por('es-mx') ?? por('es-es') ?? es[0] ?? null;
}

/** Las voces pueden estar vacías hasta el evento 'voiceschanged'. */
function vocesDisponibles(sintesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const ahora = sintesis.getVoices();
  if (ahora.length > 0) return Promise.resolve(ahora);
  return new Promise((resolver) => {
    const alCambiar = () => {
      sintesis.removeEventListener('voiceschanged', alCambiar);
      resolver(sintesis.getVoices());
    };
    sintesis.addEventListener('voiceschanged', alCambiar);
    setTimeout(alCambiar, 2000); // por si el evento nunca llega
  });
}

/** Lee el texto en voz alta con una voz en español; sin voz en español, se queda en silencio. */
export async function hablar(texto: string, sintesis: SpeechSynthesis | undefined = globalThis.speechSynthesis): Promise<void> {
  if (!sintesis) return;
  const voz = elegirVoz(await vocesDisponibles(sintesis));
  if (!voz) return;
  const frase = new SpeechSynthesisUtterance(texto);
  frase.voice = voz;
  frase.lang = voz.lang;
  sintesis.cancel();
  sintesis.speak(frase);
}
