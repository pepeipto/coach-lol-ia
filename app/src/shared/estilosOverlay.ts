import type { EstiloOverlay } from './tiposApp';

/** 3.12: estilos del overlay, en el orden del selector de la vista Overlay. */
export const ESTILOS_OVERLAY: readonly EstiloOverlay[] = ['filo', 'hextech', 'neon', 'cristal'];
export const ESTILO_POR_DEFECTO: EstiloOverlay = 'filo';
export const esEstiloOverlay = (v: unknown): v is EstiloOverlay => ESTILOS_OVERLAY.includes(v as EstiloOverlay);
