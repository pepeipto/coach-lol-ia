import { app, Menu, nativeImage, Tray } from 'electron';
import { join } from 'node:path';
import { t } from '../shared/i18n';
import { registrar } from './log';

/** Ruta de un recurso de app/resources (empaquetado: junto a la app, en resources/). */
export function rutaRecurso(nombre: string): string {
  return app.isPackaged ? join(process.resourcesPath, nombre) : join(__dirname, '../../resources', nombre);
}

/**
 * 3.6: icono en la bandeja del sistema. Con la ventana cerrada la app sigue funcionando (overlay, voz, análisis y
 * perfil); desde aquí se vuelve a abrir o se sale del todo.
 */
export function crearBandeja(o: { mostrar: () => void; salir: () => void }): { actualizarIdioma(): void; destruir(): void } | null {
  let bandeja: Tray;
  try {
    bandeja = new Tray(nativeImage.createFromPath(rutaRecurso('bandeja.png')));
  } catch (e) {
    registrar('aviso', `No se pudo crear el icono de la bandeja: ${String(e)}`);
    return null;
  }
  const menu = () =>
    Menu.buildFromTemplate([
      { label: t('bandeja.abrir'), click: o.mostrar },
      { type: 'separator' },
      { label: t('bandeja.salir'), click: o.salir },
    ]);
  bandeja.setToolTip(t('app.titulo'));
  bandeja.setContextMenu(menu());
  bandeja.on('click', o.mostrar);
  bandeja.on('double-click', o.mostrar);
  return {
    actualizarIdioma() {
      bandeja.setContextMenu(menu());
    },
    destruir() {
      bandeja.destroy();
    },
  };
}

/** Abrir con Windows (solo la app instalada): arranca oculta en la bandeja. */
export function aplicarArranqueWindows(activo: boolean): void {
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: activo, args: ['--oculta'] });
  } catch (e) {
    registrar('aviso', `No se pudo cambiar el arranque con Windows: ${String(e)}`);
  }
}

/** La app se abrió sola al iniciar Windows: no enseña la ventana. */
export const arrancoOculta = (argv: string[] = process.argv) => argv.includes('--oculta');
