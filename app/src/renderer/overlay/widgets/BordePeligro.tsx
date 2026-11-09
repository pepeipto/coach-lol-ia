import { TriangleAlert } from 'lucide-react';
import type { PeligroGank } from '../../../shared/tiposApp';

/**
 * 3.18: borde rojo de «posible gank» alrededor de toda la pantalla, con una etiqueta pequeña arriba. No recibe el ratón
 * (pointer-events: none) y se apaga solo con su animación CSS; Overlay lo retira al acabar `duracionMs`.
 */
export function BordePeligro({ peligro }: { peligro: PeligroGank }) {
  return (
    <div className="ov-peligro" data-motivo={peligro.motivo} role="alert" style={{ ['--peligro-ms' as string]: `${peligro.duracionMs}ms` }}>
      <div className="ov-peligro-etiqueta">
        <TriangleAlert size={16} strokeWidth={2.4} aria-hidden="true" />
        <b>{peligro.etiqueta}</b>
        <span>{peligro.texto}</span>
      </div>
    </div>
  );
}
