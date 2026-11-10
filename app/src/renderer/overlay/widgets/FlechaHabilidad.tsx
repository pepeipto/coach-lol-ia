import type { Habilidad } from '@coach/shared';
import { t } from '../../../shared/i18n';
import type { EscalaHud } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { altoFlecha, altoZonaFlecha, anchoFilaHabilidades, anchoFlecha, bajoFlecha, centroCasilla, HABILIDADES, ladoCasillaHud, type Tamano } from '../posiciones';
import { usePresencia } from './usePresencia';

/** Doble flecha hacia arriba (también en la muestra de la vista Overlay). */
export function ChevronFlecha() {
  return (
    <svg className="ov-flecha-chevron" viewBox="0 0 34 30" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="M4 14 L17 3 L30 14" />
      <path d="M4 26 L17 15 L30 26" />
    </svg>
  );
}

/**
 * Marca de la habilidad que toca subir. 3.20.1: una doble flecha dorada que rebota justo encima del botón de subir de
 * LoL de esa habilidad (sin taparlo). Solo sale con un punto por gastar (main decide cuál). El widget ocupa el ancho de
 * las cuatro casillas: arrastrarlo en el modo mover lo calibra con el HUD. La escala del widget no cambia el tamaño.
 */
export function FlechaHabilidad({
  habilidad,
  pantalla,
  calibrando,
  hud = null,
}: {
  habilidad: Habilidad | null;
  pantalla: Tamano;
  /** Escala elegida para el widget: no se usa, el marco mide lo mismo que el botón de LoL. */
  escala?: number;
  calibrando: boolean;
  hud?: EscalaHud | null;
}) {
  const { valor, saliendo } = usePresencia(habilidad ?? (calibrando ? 'Q' : null), 220);
  const casilla = ladoCasillaHud(pantalla, hud);
  const ancho = anchoFlecha(pantalla, hud);
  const alto = altoFlecha(pantalla, hud);
  return (
    <div className="ov-flecha-fila" style={{ width: anchoFilaHabilidades(pantalla, hud), height: altoZonaFlecha(pantalla, hud) }}>
      {calibrando &&
        HABILIDADES.map((h) => (
          <span
            key={h}
            className={clases('ov-casilla-guia', `hab-${h}`)}
            style={{ left: centroCasilla(h, pantalla, hud), width: casilla, height: casilla }}
            aria-hidden="true"
          >
            {h}
          </span>
        ))}
      {valor && (
        <div
          key={valor}
          className={clases('ov-flecha', `hab-${valor}`, saliendo && 'saliendo', calibrando && !habilidad && 'demo')}
          style={{
            left: centroCasilla(valor, pantalla, hud),
            bottom: bajoFlecha(pantalla, hud),
            width: ancho,
            height: alto,
          }}
          role="img"
          aria-label={t('overlay.habilidad', { habilidad: valor })}
        >
          <ChevronFlecha />
        </div>
      )}
    </div>
  );
}
