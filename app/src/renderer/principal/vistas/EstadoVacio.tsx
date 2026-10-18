import type { ReactNode } from 'react';
import { Esqueleto } from '../../comun/componentes';

interface Props {
  icono: ReactNode;
  titulo: string;
  descripcion?: string;
  tono?: 'neutro' | 'error' | 'espera';
  /** Muestra debajo la silueta de la vista (esqueletos) para anticipar lo que aparecerá. */
  silueta?: boolean;
  children?: ReactNode;
}

/** Estado vacío ilustrado: icono con halo, título, explicación y, opcionalmente, la silueta de la build. */
export function EstadoVacio({ icono, titulo, descripcion, tono = 'neutro', silueta, children }: Props) {
  return (
    <div className={`estado-vacio estado-vacio-${tono}`}>
      <div className="estado-vacio-ilustracion" aria-hidden="true">
        <span className="estado-vacio-anillo" />
        <span className="estado-vacio-anillo segundo" />
        <span className="estado-vacio-icono">{icono}</span>
      </div>
      <h2 className="estado-vacio-titulo">{titulo}</h2>
      {descripcion && <p className="estado-vacio-descripcion">{descripcion}</p>}
      {children}
      {silueta && <SiluetaBuild />}
    </div>
  );
}

/** Esqueletos con la forma de las tarjetas de la vista Campeón. */
export function SiluetaBuild() {
  return (
    <div className="silueta" aria-hidden="true">
      <div className="silueta-tarjeta ancha">
        <Esqueleto ancho="40%" alto={12} />
        <div className="silueta-fila">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} ancho={40} alto={40} redondo />
          ))}
        </div>
      </div>
      <div className="silueta-tarjeta">
        <Esqueleto ancho="50%" alto={12} />
        <div className="silueta-fila">
          <Esqueleto ancho={40} alto={40} />
          <Esqueleto ancho={40} alto={40} />
        </div>
      </div>
      <div className="silueta-tarjeta completa">
        <Esqueleto ancho="25%" alto={12} />
        <div className="silueta-fila">
          {Array.from({ length: 7 }, (_, i) => (
            <Esqueleto key={i} ancho={40} alto={40} />
          ))}
        </div>
      </div>
    </div>
  );
}
