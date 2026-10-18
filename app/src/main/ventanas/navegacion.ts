interface ContenidoWeb {
  getURL(): string;
  setWindowOpenHandler(manejador: (detalles: { url: string }) => { action: 'deny' }): void;
  on(evento: 'will-navigate', cb: (e: { preventDefault(): void }, url: string) => void): unknown;
}

/** Las ventanas de la app solo muestran su propia página: ni ventanas nuevas ni navegación a otras URL. */
export function protegerNavegacion(wc: ContenidoWeb): void {
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => {
    if (url !== wc.getURL()) e.preventDefault();
  });
}
