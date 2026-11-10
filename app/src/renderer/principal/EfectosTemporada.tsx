import { useEffect, useMemo, useState } from 'react';
import { temporadaDe, type Temporada } from '../../shared/temporada';

const CLAVE = 'coach.efectosTemporada';
const EVENTO = 'coach:efectos-temporada';

/** Preferencia por equipo (comodidad visual): encendida salvo que el jugador la apague. */
export function leerEfectosTemporada(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) !== '0';
  } catch {
    return true;
  }
}

export function guardarEfectosTemporada(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE, activo ? '1' : '0');
  } catch {
    /* sin almacenamiento: el cambio vale solo para esta sesión */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: activo }));
}

export function useEfectosTemporada(): [boolean, (v: boolean) => void] {
  const [activo, setActivo] = useState(leerEfectosTemporada);
  useEffect(() => {
    const alCambiar = (e: Event) => setActivo(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  return [activo, guardarEfectosTemporada];
}

const PARTICULAS = 10;

/** Capa decorativa en las dos esquinas de la ventana. Sin interacción, sin datos del juego y con CSS puro. */
export function EfectosTemporada({ fecha }: { fecha?: Date } = {}) {
  const [activo] = useEfectosTemporada();
  const temporada: Temporada | null = useMemo(() => temporadaDe(fecha ?? new Date()), [fecha]);
  if (!activo || !temporada) return null;
  return (
    <div className={`efectos-temporada efectos-${temporada}`} aria-hidden="true" data-testid="efectos-temporada">
      {['sup', 'inf'].map((esquina) => (
        <div key={esquina} className={`efectos-esquina efectos-${esquina}`}>
          {Array.from({ length: PARTICULAS }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </div>
      ))}
    </div>
  );
}
