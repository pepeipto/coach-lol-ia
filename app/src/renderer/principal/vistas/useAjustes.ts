import { useCallback, useEffect, useState } from 'react';
import type { Ajustes } from '../../../shared/tiposApp';

/** Ajustes del proceso principal: se cargan al montar y cada cambio se guarda al momento. */
export function useAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void window.coach.obtenerAjustes().then((a) => vivo && setAjustes(a));
    return () => {
      vivo = false;
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
    setGuardado(false);
    void window.coach.guardarAjustes(nuevo).then(() => setGuardado(true));
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
