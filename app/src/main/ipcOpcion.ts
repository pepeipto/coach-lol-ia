/** IPC 'coach:cambiar-opcion': solo desde la ventana principal y con un índice entero no negativo. */
export function registrarIpcOpcion(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: { cambiar: (i: number) => Promise<void>; esPrincipal: (sender: unknown) => boolean },
): void {
  ipc.handle('coach:cambiar-opcion', (e, i) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0) throw new Error('Opción no válida');
    return o.cambiar(i);
  });
}

/** IPC 'coach:cambiar-runas' (3.0.1): elige la página de runas, con las mismas comprobaciones que la opción de build. */
export function registrarIpcRunas(
  ipc: { handle(canal: string, manejador: (e: { sender: unknown }, ...args: unknown[]) => unknown): void },
  o: { cambiar: (i: number) => Promise<void>; esPrincipal: (sender: unknown) => boolean },
): void {
  ipc.handle('coach:cambiar-runas', (e, i) => {
    if (!o.esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0) throw new Error('Página de runas no válida');
    return o.cambiar(i);
  });
}
