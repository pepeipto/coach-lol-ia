/** Lo que se usa de BrowserWindow para la barra de título propia (sustituible en las pruebas). */
export interface VentanaControlable {
  isDestroyed(): boolean;
  webContents: unknown;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  isMaximized(): boolean;
  close(): void;
}

/** Lo que se usa de ipcMain. */
export interface IpcVentana {
  on(canal: string, oyente: (e: { sender: unknown }) => void): void;
}

/**
 * Registra los botones de la barra de título (la ventana principal no tiene marco nativo).
 * Solo se atienden las órdenes que vienen de la propia ventana principal: el overlay u otra
 * página no pueden minimizarla, maximizarla ni cerrarla.
 */
export function registrarControlVentana(ipc: IpcVentana, ventana: () => VentanaControlable | null): void {
  const propia = (e: { sender: unknown }): VentanaControlable | null => {
    const v = ventana();
    return v && !v.isDestroyed() && e.sender === v.webContents ? v : null;
  };
  ipc.on('ventana:minimizar', (e) => propia(e)?.minimize());
  ipc.on('ventana:maximizar', (e) => {
    const v = propia(e);
    if (!v) return;
    if (v.isMaximized()) v.unmaximize();
    else v.maximize();
  });
  ipc.on('ventana:cerrar', (e) => propia(e)?.close());
}
