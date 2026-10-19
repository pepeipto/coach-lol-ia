import { useCallback, useEffect, useState } from 'react';
import { queMostrar, VERSION_ACTUAL, type Arranque as TipoArranque } from '../../shared/novedades';
import { Bienvenida } from './vistas/Bienvenida';
import { ModalNovedades } from './vistas/ModalNovedades';

/**
 * Qué se enseña al abrir la app: la bienvenida la primera vez y, tras actualizar, las novedades de
 * la versión nueva (una sola vez). Lo que ya se vio se guarda en los ajustes.
 */
export function Arranque({ alVerTodas }: { alVerTodas: () => void }) {
  const [que, setQue] = useState<TipoArranque>('nada');

  useEffect(() => {
    let vivo = true;
    window.coach
      .obtenerAjustes()
      .then((a) => vivo && setQue(queMostrar(a)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // Se relee antes de guardar para no pisar un cambio de ajustes hecho mientras tanto.
  const marcarVisto = useCallback(() => {
    setQue('nada');
    void window.coach
      .obtenerAjustes()
      .then((a) => window.coach.guardarAjustes({ ...a, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL }))
      .catch(() => undefined);
  }, []);

  if (que === 'bienvenida') return <Bienvenida alTerminar={marcarVisto} />;
  if (que === 'novedades')
    return (
      <ModalNovedades
        alCerrar={marcarVisto}
        alVerTodas={() => {
          marcarVisto();
          alVerTodas();
        }}
      />
    );
  return null;
}
