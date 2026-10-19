import { useEffect, useState } from 'react';
import type { EstadoCarga } from '../../../shared/tiposApp';
import { PantallaCarga } from './PantallaCarga';

export type ModoOverlay = 'carga' | 'partida' | 'oculto';

interface Props {
  /** Suscripción a `overlay:modo` (la expone el preload del overlay). */
  alModo: (cb: (modo: ModoOverlay) => void) => void;
  /** Suscripción a `overlay:carga`. */
  alCarga: (cb: (estado: EstadoCarga) => void) => void;
}

/** Escucha `overlay:modo` y `overlay:carga` y pinta la pantalla de carga solo en el modo 'carga'. */
export function ModoCarga({ alModo, alCarga }: Props) {
  const [modo, setModo] = useState<ModoOverlay>('oculto');
  const [estado, setEstado] = useState<EstadoCarga | null>(null);
  useEffect(() => {
    alModo((m) => {
      setModo(m);
      // Fuera del modo carga se olvidan las tarjetas: las de la partida anterior nunca vuelven a verse.
      if (m !== 'carga') setEstado(null);
    });
    alCarga(setEstado);
    // Las suscripciones del preload duran lo que la ventana: solo se registran una vez.
  }, []);
  return modo === 'carga' ? <PantallaCarga estado={estado} /> : null;
}
