import { TriangleAlert } from 'lucide-react';
import type { PeligroGank } from '../../../shared/tiposApp';

/** Una capa de humo: ruido fractal teñido de rojo sangre. Se dibuja una vez y luego solo se desplaza (transform). */
function CapaHumo({ id, frecuencia, semilla }: { id: string; frecuencia: string; semilla: number }) {
  return (
    <svg className="ov-peligro-humo-capa" preserveAspectRatio="none" aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={frecuencia} numOctaves={4} seed={semilla} />
        {/* Color fijo (rojo sangre) y transparencia según el ruido: quedan volutas sueltas, no una mancha uniforme. */}
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.01  0 0 0 0 0.03  3.4 0 0 0 -1.55" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/**
 * 3.18: borde de «posible gank» alrededor de toda la pantalla, con una etiqueta pequeña arriba. No recibe el ratón
 * (pointer-events: none) y se apaga solo con su animación CSS; Overlay lo retira al acabar `duracionMs`.
 * 3.20: el borde es un resplandor rojo sangre que respira, con humo que se mueve despacio pegado a los bordes.
 */
export function BordePeligro({ peligro }: { peligro: PeligroGank }) {
  return (
    <div className="ov-peligro" data-motivo={peligro.motivo} role="alert" style={{ ['--peligro-ms' as string]: `${peligro.duracionMs}ms` }}>
      <div className="ov-peligro-humo" aria-hidden="true">
        <CapaHumo id="ov-humo-a" frecuencia="0.005 0.009" semilla={7} />
        <CapaHumo id="ov-humo-b" frecuencia="0.011 0.006" semilla={23} />
      </div>
      <div className="ov-peligro-etiqueta">
        <TriangleAlert size={16} strokeWidth={2.4} aria-hidden="true" />
        <b>{peligro.etiqueta}</b>
        <span>{peligro.texto}</span>
      </div>
    </div>
  );
}
