import { useEffect, useState } from 'react';
import type { AjustesCarga, EstadoCarga, ModoOverlay } from '../../../shared/tiposApp';
import { PantallaCarga } from './PantallaCarga';

export type { ModoOverlay };

interface Props {
  /** Suscripción a `overlay:modo` (la expone el preload del overlay). */
  alModo: (cb: (modo: ModoOverlay) => void) => void;
  /** Suscripción a `overlay:carga`. */
  alCarga: (cb: (estado: EstadoCarga) => void) => void;
  /** false la esconde sin olvidar los datos (p. ej. mientras se colocan los widgets en el modo mover). */
  visible?: boolean;
  /** 3.1: ajustes de la pantalla de carga (`overlay.carga`); sin ellos, pantalla completa con la pista de Espacio. */
  config?: AjustesCarga | null;
  /** 3.1: suscripción a `overlay:carga-ocultar` (el jugador pulsó Espacio). */
  alOcultar?: (cb: () => void) => void;
}

/** Escucha `overlay:modo` y `overlay:carga` y pinta la pantalla de carga solo en el modo 'carga'. */
export function ModoCarga({ alModo, alCarga, visible = true, config = null, alOcultar }: Props) {
  const [modo, setModo] = useState<ModoOverlay>('oculto');
  const [estado, setEstado] = useState<EstadoCarga | null>(null);
  /** 3.1: se pulsó Espacio: se desvanece hasta que main oculta la ventana (y no vuelve en esta partida). */
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    alModo((m) => {
      setModo(m);
      setSaliendo(false);
      // Fuera del modo carga se olvidan las tarjetas: las de la partida anterior nunca vuelven a verse.
      if (m !== 'carga') setEstado(null);
    });
    alCarga(setEstado);
    alOcultar?.(() => setSaliendo(true));
    // Las suscripciones del preload duran lo que la ventana: solo se registran una vez.
  }, []);
  if (!visible || modo !== 'carga' || config?.modo === 'desactivada') return null;
  return (
    <PantallaCarga
      estado={estado}
      presentacion={config?.modo === 'tarjetas' ? 'tarjetas' : 'completa'}
      pistaEspacio={config?.ocultarConEspacio ?? true}
      saliendo={saliendo}
    />
  );
}
