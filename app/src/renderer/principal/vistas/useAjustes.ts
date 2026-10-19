import { useCallback, useEffect, useState } from 'react';
import { establecerIdioma } from '../../../shared/i18n';
import type { Ajustes } from '../../../shared/tiposApp';
import { aplicarTema } from '../../comun/tema';

/** Ajustes del proceso principal: se cargan al montar y cada cambio se guarda al momento. */
export function useAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void window.coach.obtenerAjustes().then((a) => vivo && setAjustes(a));
    // Cambios hechos fuera de esta ventana (Alt+Shift+L, marco del minimapa): sin ellos, el siguiente guardado los pisaría.
    const dejar = window.coach.alCambiarAjustes?.((a) => vivo && setAjustes(a));
    return () => {
      vivo = false;
      dejar?.();
    };
  }, []);

  // El aviso de «guardado» se retira solo a los pocos segundos.
  useEffect(() => {
    if (!guardado) return;
    const temporizador = setTimeout(() => setGuardado(false), 2500);
    return () => clearTimeout(temporizador);
  }, [guardado]);

  const cambiar = useCallback((nuevo: Ajustes) => {
    setAjustes(nuevo);
    // El tema se ve al momento, sin esperar a que main lo guarde.
    aplicarTema(nuevo.tema);
    setGuardado(false);
    void window.coach.guardarAjustes(nuevo).then(() => {
      setGuardado(true);
      // Main avisa a las dos ventanas ('coach:idioma'); aquí se pone ya, por si el aviso llega después.
      if (nuevo.idioma) establecerIdioma(nuevo.idioma);
    });
  }, []);

  return { ajustes, cambiar, guardado };
}

/** Estado del modo mover del overlay, al día con los cambios (Esc, tecla rápida o «Fijar aquí»). */
export function useMoverOverlay(): [boolean, () => void] {
  const [moviendo, setMoviendo] = useState(false);
  useEffect(() => {
    void window.coach.overlayMoviendo().then(setMoviendo);
    return window.coach.alCambiarMover(setMoviendo);
  }, []);
  const alternar = useCallback(() => {
    void window.coach.moverOverlay(!moviendo).then(setMoviendo);
  }, [moviendo]);
  return [moviendo, alternar];
}
