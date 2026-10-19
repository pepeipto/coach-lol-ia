import { Check, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../../shared/i18n';
import { posicionMinimapa } from '../../../shared/jungla';
import type { CampamentoEstado, EscalaHud, EstadoJungla, IdCampamento, MarcoMinimapa } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { diametroTemporizador, fraccionesMarco, marcoMinimapa, redimensionarMarco, textoTemporizador, type EsquinaMarco, type MarcoPx, type Tamano } from '../posiciones';
import { JUNGLA_PRONTO_S } from './Jungla';

const ESQUINAS: EsquinaMarco[] = ['ni', 'nd', 'si', 'sd'];

interface Props {
  estado: EstadoJungla;
  /** Marco calibrado (fracciones de la pantalla) o null para el de por defecto. */
  guardado: MarcoMinimapa | null;
  pantalla: Tamano;
  opacidad: number;
  moviendo: boolean;
  alMarcar(id: IdCampamento): void;
  /** Escala del minimapa de LoL (game.cfg), para el marco sin calibrar. */
  hud?: EscalaHud | null;
  /** Escala elegida por el usuario para el widget de la jungla (los círculos; el marco es el del minimapa). */
  escala?: number;
}


function Temporizador({ c, x, y, d, bloqueado, alMarcar, alRaton }: {
  c: CampamentoEstado;
  x: number;
  y: number;
  d: number;
  bloqueado: boolean;
  alMarcar(id: IdCampamento): void;
  alRaton(dentro: boolean): void;
}) {
  const cuenta = c.disponible || c.aparece === null ? null : c.aparece;
  const pronto = cuenta !== null && cuenta <= JUNGLA_PRONTO_S;
  const tiempo = cuenta === null ? t('jungla.disponible') : textoTemporizador(cuenta);
  return (
    <button
      type="button"
      className={clases('ov-mm-camp', cuenta === null && 'disponible', c.marcado && 'marcado', pronto && 'pronto')}
      data-campamento={c.id}
      aria-label={`${t(c.marcado ? 'jungla.cancelar' : 'jungla.marcar', { campamento: c.nombre })} (${tiempo})`}
      style={{ left: x - d / 2, top: y - d / 2, width: d, height: d, fontSize: Math.round(d * 0.45) }}
      tabIndex={bloqueado ? -1 : undefined}
      onClick={() => !bloqueado && alMarcar(c.id)}
      onMouseEnter={() => alRaton(true)}
      onMouseLeave={() => alRaton(false)}
    >
      {cuenta === null ? <Check size={Math.round(d * 0.5)} strokeWidth={3} aria-hidden="true" /> : textoTemporizador(cuenta)}
    </button>
  );
}

/**
 * Temporizadores de la jungla sobre el minimapa, al estilo de los de Riot: un círculo pequeño encima de cada
 * campamento propio (y de los Escarabajos) con la cuenta atrás, dorado en los últimos 30 s y con un ✓ cuando ya
 * está. Los datos son los mismos del panel lateral (marcas manuales). La ventana deja pasar los clics: solo los
 * círculos piden el ratón (`capturarRatonJungla`), así el minimapa sigue funcionando debajo.
 * En el modo mover se ve el marco, que se arrastra y se redimensiona por las esquinas hasta encajar en el
 * minimapa real; «Restablecer» lo devuelve a su sitio por defecto.
 */
export function MinimapaJungla({ estado, guardado, pantalla, opacidad, moviendo, alMarcar, hud = null, escala = 1 }: Props) {
  const [editado, setEditado] = useState<MarcoPx | null>(null);
  const marco = editado ?? marcoMinimapa(pantalla, guardado, hud);
  const marcoRef = useRef(marco);
  marcoRef.current = marco;
  const ratonCirculo = useRef(false);
  const ratonMarco = useRef(false);
  const arrastrando = useRef(false);

  // Un marco nuevo desde los ajustes (calibrado o restablecido) sustituye al editado.
  useEffect(() => setEditado(null), [guardado?.x, guardado?.y, guardado?.lado]);

  const alRatonCirculo = useCallback(
    (dentro: boolean) => {
      ratonCirculo.current = dentro;
      if (!moviendo) window.coachOverlay.capturarRatonJungla(dentro);
    },
    [moviendo],
  );
  // Si desaparece con el cursor encima de un círculo, nunca se queda el ratón capturado.
  useEffect(
    () => () => {
      if (ratonCirculo.current) window.coachOverlay.capturarRatonJungla(false);
      if (ratonMarco.current) window.coachOverlay.capturarRaton(false);
    },
    [],
  );
  // Al salir del modo mover con el cursor sobre un círculo, se vuelve a pedir el ratón para él.
  useEffect(() => {
    if (!moviendo && ratonCirculo.current) window.coachOverlay.capturarRatonJungla(true);
  }, [moviendo]);

  const arrastrar = useCallback(
    (e: React.PointerEvent, calcular: (inicio: MarcoPx, dx: number, dy: number) => MarcoPx) => {
      if (!moviendo || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      arrastrando.current = true;
      const inicio = marcoRef.current;
      const origen = { x: e.clientX, y: e.clientY };
      const mover = (ev: PointerEvent) => setEditado(calcular(inicio, ev.clientX - origen.x, ev.clientY - origen.y));
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        arrastrando.current = false;
        window.coachOverlay.guardarMinimapa(fraccionesMarco(marcoRef.current, pantalla));
        if (!ratonMarco.current) window.coachOverlay.capturarRaton(false);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [moviendo, pantalla],
  );

  const d = diametroTemporizador(marco.lado, pantalla, escala);
  return (
    <div
      className={clases('ov-minimapa', moviendo && 'moviendo')}
      data-widget="jungla"
      data-presentacion="minimapa"
      role="group"
      aria-label={t('jungla.minimapa.titulo')}
      style={{ left: marco.x, top: marco.y, width: marco.lado, height: marco.lado, opacity: opacidad }}
      onPointerDown={(e) =>
        arrastrar(e, (inicio, dx, dy) =>
          marcoMinimapa(pantalla, fraccionesMarco({ ...inicio, x: inicio.x + dx, y: inicio.y + dy }, pantalla)),
        )
      }
      onMouseEnter={() => {
        ratonMarco.current = true;
        if (moviendo) window.coachOverlay.capturarRaton(true);
      }}
      onMouseLeave={() => {
        ratonMarco.current = false;
        if (moviendo && !arrastrando.current) window.coachOverlay.capturarRaton(false);
      }}
    >
      {moviendo && (
        <>
          <span className="ov-mm-etiqueta">{t('jungla.minimapa.calibrar')}</span>
          {ESQUINAS.map((esquina) => (
            <span
              key={esquina}
              className={`ov-mm-asa ${esquina}`}
              data-esquina={esquina}
              aria-hidden="true"
              onPointerDown={(e) => arrastrar(e, (inicio, dx, dy) => redimensionarMarco(inicio, esquina, dx, dy, pantalla))}
            />
          ))}
          <button
            type="button"
            className="ov-mm-restablecer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setEditado(null);
              window.coachOverlay.guardarMinimapa(null);
            }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            {t('jungla.minimapa.restablecer')}
          </button>
        </>
      )}
      {estado.campamentos.map((c) => {
        const p = posicionMinimapa(c.id, estado.lado);
        return (
          <Temporizador
            key={c.id}
            c={c}
            x={p.x * marco.lado}
            y={p.y * marco.lado}
            d={d}
            bloqueado={moviendo}
            alMarcar={alMarcar}
            alRaton={alRatonCirculo}
          />
        );
      })}
    </div>
  );
}
