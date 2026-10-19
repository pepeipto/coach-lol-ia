import type { Habilidad } from '@coach/shared';
import { t } from '../../../shared/i18n';
import { clases } from '../../comun/componentes';
import { anchoFilaHabilidades, centroCasilla, factorPantalla, HABILIDADES, HUD_HABILIDADES, type Tamano } from '../posiciones';
import { usePresencia } from './usePresencia';

/** Alto de la zona de la flecha (sin escalar), por encima de la fila de habilidades del HUD. */
export const ALTO_FLECHA = 104;

/**
 * Flecha grande sobre la casilla del HUD de la habilidad que toca subir. El widget ocupa justo
 * el ancho de las cuatro casillas: arrastrarlo en el modo mover lo calibra con el HUD.
 */
export function FlechaHabilidad({
  habilidad,
  pantalla,
  escala,
  calibrando,
}: {
  habilidad: Habilidad | null;
  pantalla: Tamano;
  escala: number;
  calibrando: boolean;
}) {
  const { valor, saliendo } = usePresencia(habilidad ?? (calibrando ? 'Q' : null), 220);
  const casilla = HUD_HABILIDADES.paso * factorPantalla(pantalla) * 0.86;
  return (
    <div className="ov-flecha-fila" style={{ width: anchoFilaHabilidades(pantalla), height: ALTO_FLECHA * escala }}>
      {calibrando &&
        HABILIDADES.map((h) => (
          <span
            key={h}
            className={clases('ov-casilla-guia', `hab-${h}`)}
            style={{ left: centroCasilla(h, pantalla), width: casilla, height: casilla }}
            aria-hidden="true"
          >
            {h}
          </span>
        ))}
      {valor && (
        <div
          key={valor}
          className={clases('ov-flecha', `hab-${valor}`, saliendo && 'saliendo', calibrando && !habilidad && 'demo')}
          style={{ left: centroCasilla(valor, pantalla), ['--escala' as string]: escala }}
          role="img"
          aria-label={t('overlay.habilidad', { habilidad: valor })}
        >
          <span className="ov-flecha-letra">{valor}</span>
          <svg className="ov-flecha-punta" viewBox="0 0 48 40" aria-hidden="true">
            <path d="M24 38 L4 14 H16 V2 H32 V14 H44 Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
