interface AppMinima {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(evento: 'second-instance', cb: () => void): unknown;
}

interface VentanaMinima {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/**
 * Solo puede haber una instancia (dos se pelearían por la tecla rápida, el overlay y el cliente de LoL).
 * Devuelve false si ya hay otra abierta: esta sale y la otra muestra su ventana.
 */
export function asegurarInstanciaUnica(app: AppMinima, ventana: () => VentanaMinima | null): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on('second-instance', () => {
    const v = ventana();
    if (!v || v.isDestroyed()) return;
    if (v.isMinimized()) v.restore();
    v.show();
    v.focus();
  });
  return true;
}
