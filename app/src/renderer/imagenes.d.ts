/** Imágenes importadas desde el código del renderer: Vite las copia al paquete y devuelve su URL. */
declare module '*.png' {
  const url: string;
  export default url;
}
