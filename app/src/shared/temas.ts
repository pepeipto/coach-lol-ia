import type { Tema } from './tiposApp';

/**
 * Temas de la ventana principal, en el orden del selector de Ajustes. 3.17: a «clásico» y «sombra» se suman los
 * cuatro estilos del overlay (Filo, Hextech, Neón y Cristal), para que la app y el overlay puedan ir a juego.
 */
export const TEMAS: readonly Tema[] = ['clasico', 'sombra', 'filo', 'hextech', 'neon', 'cristal'];
export const TEMA_POR_DEFECTO: Tema = 'clasico';
export const esTema = (v: unknown): v is Tema => TEMAS.includes(v as Tema);
