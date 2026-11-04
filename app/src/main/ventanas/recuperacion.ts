import type { BrowserWindow, Screen, WebContents } from 'electron';
import { registrar } from '../log';

/** Si el renderizador se cae en bucle, se deja de recargar: como mucho estas recargas por minuto. */
const MAX_RECARGAS = 3;
const VENTANA_RECARGAS_MS = 60_000;

/**
 * Si el proceso del renderizador se cae (no un cierre limpio), recarga la página: si no, la ventana se queda en
 * blanco (o el overlay deja de verse) hasta reiniciar la app.
 */
export function recargarAlCaer(
  wc: Pick<WebContents, 'on' | 'reload' | 'isDestroyed'>,
  nombre: string,
  ahora: () => number = Date.now,
): void {
  const recargas: number[] = [];
  wc.on('render-process-gone', (_e, detalles) => {
    if (detalles.reason === 'clean-exit') return;
    const t = ahora();
    while (recargas.length > 0 && t - recargas[0]! > VENTANA_RECARGAS_MS) recargas.shift();
    if (recargas.length >= MAX_RECARGAS) {
      registrar('error', `El renderizador de ${nombre} se cerró (${detalles.reason}) otra vez; no se vuelve a recargar`);
      return;
    }
    recargas.push(t);
    registrar('error', `El renderizador de ${nombre} se cerró (${detalles.reason}); se recarga`);
    if (!wc.isDestroyed()) wc.reload();
  });
}

/**
 * Mantiene la ventana (el overlay) sobre toda la pantalla principal aunque cambie la resolución, la escala o las
 * pantallas conectadas.
 */
export function seguirPantallaPrincipal(
  ventana: Pick<BrowserWindow, 'on' | 'setBounds' | 'isDestroyed'>,
  pantalla: Pick<Screen, 'on' | 'removeListener' | 'getPrimaryDisplay'>,
): void {
  const ajustar = () => {
    if (!ventana.isDestroyed()) ventana.setBounds(pantalla.getPrimaryDisplay().bounds);
  };
  const eventos = ['display-metrics-changed', 'display-added', 'display-removed'] as const;
  for (const evento of eventos) pantalla.on(evento as 'display-added', ajustar);
  ventana.on('closed', () => {
    for (const evento of eventos) pantalla.removeListener(evento as 'display-added', ajustar);
  });
}
