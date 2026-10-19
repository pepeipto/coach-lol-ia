import { useEffect, type RefObject } from 'react';

const ENFOCABLES = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Mantiene Tab y Mayús+Tab dentro del diálogo mientras está abierto. */
export function useTrampaFoco(dialogo: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogo.current) return;
      const lista = Array.from(dialogo.current.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement;
      if (!dialogo.current.contains(activo)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [dialogo]);
}
