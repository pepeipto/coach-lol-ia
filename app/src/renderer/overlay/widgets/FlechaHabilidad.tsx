import type { Habilidad } from '@coach/shared';
import { t } from '../../../shared/i18n';
import type { EscalaHud } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { altoZonaFlecha, anchoFilaHabilidades, centroCasilla, factorHud, FLECHA, HABILIDADES, HUD_HABILIDADES, ladoFlecha, type Tamano } from '../posiciones';
import { usePresencia } from './usePresencia';

/** Chevrón de la flecha (también en la muestra de la vista Overlay). */
export function ChevronFlecha() {
  return (
    <svg className="ov-flecha-chevron" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 21 L16 9 L27 21" />
    </svg>
  );
}

/**
 * Flecha pequeña (estilo Blitz) justo encima de la casilla del HUD de la habilidad que toca subir: un chevrón dorado
 * con brillo suave y un vaivén lento, sin letra ni caja. Solo sale con un punto por gastar (main decide cuál).
 * El widget ocupa el ancho de las cuatro casillas: arrastrarlo en el modo mover lo calibra con el HUD.
 */
export function FlechaHabilidad({
  habilidad,
  pantalla,
  escala,
  calibrando,
  hud = null,
}: {
  habilidad: Habilidad | null;
  pantalla: Tamano;
  escala: number;
  calibrando: boolean;
  hud?: EscalaHud | null;
}) {
  const { valor, saliendo } = usePresencia(habilidad ?? (calibrando ? 'Q' : null), 220);
  const f = factorHud(pantalla, hud);
  const casilla = HUD_HABILIDADES.paso * f * 0.86;
  const lado = ladoFlecha(pantalla, hud, escala);
  return (
    <div className="ov-flecha-fila" style={{ width: anchoFilaHabilidades(pantalla, hud), height: altoZonaFlecha(pantalla, hud, escala) }}>
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
            bottom: Math.round(FLECHA.hueco * f),
            width: lado,
            height: lado,
            ['--vaiven' as string]: `${Math.max(2, Math.round(FLECHA.vaiven * f))}px`,
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
