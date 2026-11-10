import type { Habilidad } from '@coach/shared';
import { t } from '../../../shared/i18n';
import type { EscalaHud } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { altoZonaFlecha, anchoFilaHabilidades, bajoFlecha, centroCasilla, factorHud, FLECHA, HABILIDADES, ladoCasillaHud, ladoFlecha, type Tamano } from '../posiciones';
import { usePresencia } from './usePresencia';

/** Chevrón de la flecha (también en la muestra de la vista Overlay). */
export function ChevronFlecha() {
  return (
    <svg className="ov-flecha-chevron" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 24 L16 9 L29 24" />
    </svg>
  );
}

/**
 * Marca de la habilidad que toca subir. 3.18.1: un marco dorado que late alrededor del botón de subir de LoL de esa
 * habilidad (antes era un chevrón que caía encima del chevrón del propio juego). Solo sale con un punto por gastar
 * (main decide cuál). El widget ocupa el ancho de las cuatro casillas: arrastrarlo en el modo mover lo calibra con el
 * HUD. La escala del widget no cambia el tamaño: el marco tiene que coincidir con el botón del juego.
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
  const f = factorHud(pantalla, hud);
  const casilla = ladoCasillaHud(pantalla, hud);
  const lado = ladoFlecha(pantalla, hud);
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
            width: lado,
            height: lado,
            ['--latido' as string]: String(Math.round((1 + (2 * FLECHA.latido * f) / Math.max(1, lado)) * 1000) / 1000),
          }}
          role="img"
          aria-label={t('overlay.habilidad', { habilidad: valor })}
        >
          <span className="ov-flecha-marco" />
        </div>
      )}
    </div>
  );
}
