import type { Ajustes, Tema } from '../../shared/tiposApp';

/** Lo que expone el preload de la ventana principal sobre el tema (opcional: las pruebas no lo dan). */
interface ApiTema {
  tema?: string;
  alCambiarAjustes?(cb: (a: Ajustes) => void): () => void;
}

const normalizar = (t: unknown): Tema => (t === 'sombra' ? 'sombra' : 'clasico');

/** Pone el tema en la raíz del documento (`data-tema`): los tokens de tokens.css cambian con él, sin recargar. */
export function aplicarTema(tema: unknown): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.tema = normalizar(tema);
}

/**
 * Tema con el que arrancó la ventana (leído de main por el preload, síncrono) y sus cambios hechos fuera de la
 * vista Ajustes. El overlay no lo llama: sin `data-tema` conserva su aspecto de siempre.
 */
export function iniciarTema(api: ApiTema | undefined): void {
  aplicarTema(api?.tema);
  api?.alCambiarAjustes?.((a) => aplicarTema(a.tema));
}
