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

const MODIFICADORES: Record<string, string> = {
  commandorcontrol: 'ctrl',
  cmdorctrl: 'ctrl',
  control: 'ctrl',
  ctrl: 'ctrl',
  command: 'ctrl',
  cmd: 'ctrl',
  alt: 'alt',
  option: 'alt',
  altgr: 'alt',
  shift: 'shift',
};
const ORDEN_MODIFICADORES = ['ctrl', 'alt', 'shift'];

/**
 * Forma canónica de un acelerador de Electron para compararlo con otro: sin mayúsculas, con
 * CommandOrControl ≡ Ctrl y los modificadores en orden fijo («CommandOrControl+Shift+O» y
 * «Shift+Ctrl+o» dan lo mismo).
 */
export function normalizarAcelerador(acelerador: string): string {
  const partes = acelerador
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const modificadores = new Set<string>();
  const teclas: string[] = [];
  for (const p of partes) {
    const m = MODIFICADORES[p];
    if (m) modificadores.add(m);
    else teclas.push(p);
  }
  return [...ORDEN_MODIFICADORES.filter((m) => modificadores.has(m)), ...teclas].join('+');
}

export const mismoAcelerador = (a: string, b: string) => normalizarAcelerador(a) === normalizarAcelerador(b);

/** Teclas de LoL que, con Ctrl, Alt o Mayús, ya hacen algo en la partida (subir habilidades, emotes, objetos…). */
const TECLAS_DE_LOL = new Set(['q', 'w', 'e', 'r', 'd', 'f', 'b', '1', '2', '3', '4', '5', '6']);

/** La combinación choca con un atajo de LoL (p. ej. Ctrl+Q sube la Q): no se puede asignar. */
export function chocaConLol(acelerador: string): boolean {
  const partes = normalizarAcelerador(acelerador).split('+');
  const tecla = partes.at(-1) ?? '';
  const conModificador = partes.slice(0, -1).some((p) => ORDEN_MODIFICADORES.includes(p));
  return conModificador && TECLAS_DE_LOL.has(tecla);
}
