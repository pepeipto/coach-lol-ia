import { useCallback, useEffect, useState } from 'react';
import type { EstadoLicencia } from '../../shared/tiposApp';

/** Lo que se asume si el proceso principal aún no sabe nada de licencias (o falla la consulta). */
export const LICENCIA_GRATIS: EstadoLicencia = { plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null };

/** Pide la licencia al proceso principal; si no hay manejador o falla, se trata como plan gratuito. */
export async function consultarLicencia(): Promise<EstadoLicencia> {
  try {
    return (await window.coach.licencia()) ?? LICENCIA_GRATIS;
  } catch {
    return LICENCIA_GRATIS;
  }
}

/**
 * Estado de la licencia, al día con los cambios que avise el proceso principal.
 * Es null hasta la primera respuesta: así un usuario premium no ve de pasada lo del plan gratuito.
 */
export function useLicencia(): [EstadoLicencia | null, (e: EstadoLicencia) => void] {
  const [licencia, setLicencia] = useState<EstadoLicencia | null>(null);
  useEffect(() => {
    let vivo = true;
    void consultarLicencia().then((e) => vivo && setLicencia(e));
    let dejar: (() => void) | undefined;
    try {
      dejar = window.coach.alCambiarLicencia?.((e) => vivo && setLicencia(e));
    } catch {
      dejar = undefined;
    }
    return () => {
      vivo = false;
      dejar?.();
    };
  }, []);
  const actualizar = useCallback((e: EstadoLicencia) => setLicencia(e), []);
  return [licencia, actualizar];
}
