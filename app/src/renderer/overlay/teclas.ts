/** Teclas que se pueden asignar a la jungla, en formato de acelerador de Electron. */
const TECLAS_SUELTAS = /^F([1-9]|1[0-9]|2[0-4])$/;

/**
 * Convierte una pulsación en un acelerador de Electron («F5», «Ctrl+Shift+1», «Alt+num4»).
 * Sin modificadores solo valen F1–F24 y el teclado numérico (una letra sola se usaría al jugar).
 * Devuelve null si la pulsación no sirve (solo modificadores, Esc, etc.).
 */
export function aceleradorDe(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
  let tecla: string | null = null;
  if (TECLAS_SUELTAS.test(e.key)) tecla = e.key;
  else if (/^Numpad[0-9]$/.test(e.code)) tecla = `num${e.code.slice(6)}`;
  else if (/^Key[A-Z]$/.test(e.code)) tecla = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) tecla = e.code.slice(5);
  if (!tecla) return null;
  const modificadores = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean) as string[];
  const suelta = TECLAS_SUELTAS.test(tecla) || tecla.startsWith('num');
  if (modificadores.length === 0 && !suelta) return null;
  return [...modificadores, tecla].join('+');
}
