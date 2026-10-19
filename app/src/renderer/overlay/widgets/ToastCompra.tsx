import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import type { EstadoOverlay } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { usePresencia } from './usePresencia';

export const DURACION_COMPRA_MS = 6000;
type Compra = NonNullable<EstadoOverlay['compra']>;

/**
 * Compra que se debe anunciar: aparece cuando por primera vez llega el oro para un objeto, dura
 * 6 s y no vuelve para el mismo objeto (sí para uno nuevo). Si la próxima compra cambia, se retira.
 */
export function useCompraNueva(compra: Compra | null, duracionMs = DURACION_COMPRA_MS): Compra | null {
  const vistos = useRef(new Set<number>());
  const [actual, setActual] = useState<Compra | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = compra?.id ?? null;
  const puede = compra?.puedeComprar ?? false;

  useEffect(() => {
    if (actual && actual.id !== id) {
      if (temporizador.current) clearTimeout(temporizador.current);
      setActual(null);
    }
    if (compra && puede && !vistos.current.has(compra.id)) {
      vistos.current.add(compra.id);
      setActual(compra);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setActual(null), duracionMs);
    }
    // Solo importan el objeto y si llega el oro (el resto de la compra no cambia nada).
  }, [id, puede]);

  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), []);
  return actual;
}

export function ToastCompra({ compra, version, demo }: { compra: Compra | null; version: string; demo?: Compra | null }) {
  const nueva = useCompraNueva(compra);
  const { valor, saliendo } = usePresencia(demo ?? nueva, 260);
  return (
    <div className="ov-compra-hueco" role="status" aria-live="polite">
      {valor && (
        <div key={valor.id} className={clases('ov-compra', saliendo && 'saliendo')}>
          <span className="ov-compra-icono" aria-hidden="true">
            {version ? (
              <IconoDDragon tipo="objeto" id={valor.id} version={version} nombre={valor.nombre} tamano={40} />
            ) : (
              <ShoppingBag size={20} />
            )}
          </span>
          <span className="ov-compra-textos">
            <span className="ov-compra-etiqueta">{t('overlay.compra.etiqueta')}</span>
            <span className="ov-compra-nombre">{valor.nombre}</span>
          </span>
        </div>
      )}
    </div>
  );
}
