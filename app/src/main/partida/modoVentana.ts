import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ModoVentana = 'pantalla_completa' | 'ventana' | 'sin_bordes' | 'desconocido';

const MODOS: ModoVentana[] = ['pantalla_completa', 'ventana', 'sin_bordes'];

/** Lee Config/game.cfg de LoL (línea WindowMode=0|1|2). Cualquier fallo → 'desconocido'. */
export async function leerModoVentana(
  dirLol: string,
  leer: (ruta: string) => Promise<string> = (r) => readFile(r, 'utf8'),
): Promise<ModoVentana> {
  try {
    const texto = await leer(join(dirLol, 'Config', 'game.cfg'));
    const m = /^\s*WindowMode\s*=\s*(\d+)\s*$/im.exec(texto);
    return (m && MODOS[Number(m[1])]) || 'desconocido';
  } catch {
    return 'desconocido';
  }
}
