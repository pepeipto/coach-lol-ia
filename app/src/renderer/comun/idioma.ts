import { useSyncExternalStore } from 'react';
import { alCambiarIdioma, establecerIdioma, idiomaActual, LOCALE_INTL, type Idioma } from '../../shared/i18n';

/** Lo que exponen los dos preload sobre el idioma (opcional: las pruebas no lo dan). */
interface ApiIdioma {
  idioma?: string;
  alCambiarIdioma?(cb: (idioma: string) => void): () => void;
}

/**
 * Pone el idioma con el que arrancó la ventana (leído de main por el preload) y sigue sus cambios:
 * al guardarse otro idioma en Ajustes, main avisa a la ventana principal y al overlay a la vez.
 */
export function iniciarIdioma(api: ApiIdioma | undefined): void {
  const marcarDocumento = (i: Idioma) => {
    if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_INTL[i];
  };
  establecerIdioma(api?.idioma);
  marcarDocumento(idiomaActual());
  alCambiarIdioma(marcarDocumento);
  api?.alCambiarIdioma?.((i) => establecerIdioma(i));
}

/** Idioma actual; el componente se vuelve a pintar cuando cambia. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(alCambiarIdioma, idiomaActual);
}
