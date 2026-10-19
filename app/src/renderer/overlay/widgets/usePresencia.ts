import { useEffect, useRef, useState } from 'react';

/**
 * Mantiene el último valor no nulo durante `ms` tras pasar a null, para que el widget pueda
 * animar su salida (`saliendo`) en vez de desaparecer de golpe.
 */
export function usePresencia<T>(valor: T | null, ms = 200): { valor: T | null; saliendo: boolean } {
  const [mostrado, setMostrado] = useState<T | null>(valor);
  const [saliendo, setSaliendo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    if (valor !== null) {
      setMostrado(valor);
      setSaliendo(false);
      return;
    }
    setSaliendo(true);
    temporizador.current = setTimeout(() => {
      setMostrado(null);
      setSaliendo(false);
    }, ms);
  }, [valor, ms]);

  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);

  return { valor: valor ?? mostrado, saliendo: valor === null && mostrado !== null && saliendo };
}

/** Tamaño de la ventana, al día con los cambios de resolución. */
export function usePantalla(): { ancho: number; alto: number } {
  const leer = () => ({ ancho: window.innerWidth, alto: window.innerHeight });
  const [pantalla, setPantalla] = useState(leer);
  useEffect(() => {
    const alCambiar = () => setPantalla(leer());
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return pantalla;
}
