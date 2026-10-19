import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ConfigWidget, IdWidget } from '../../shared/tiposApp';
import { clases } from '../comun/componentes';
import { ajustarAPantalla, posicionPorDefecto, type Punto, type Tamano } from './posiciones';

interface Props {
  id: IdWidget;
  config: ConfigWidget;
  opacidad: number;
  moviendo: boolean;
  pantalla: Tamano;
  /** Nombre del widget, visible en el modo mover. */
  etiqueta: string;
  /** false: el widget aplica la escala por dentro (la flecha mantiene la separación del HUD). */
  escalar?: boolean;
  /** El widget tiene botones: pide el ratón al pasar por encima también fuera del modo mover. */
  interactivo?: boolean;
  children: ReactNode;
}

/**
 * Contenedor de cada widget: lo coloca (posición guardada o la de por defecto), aplica la escala y
 * la opacidad, y en el modo mover deja arrastrarlo. La ventana deja pasar los clics: solo pide el
 * ratón mientras el cursor está encima de un widget que lo necesita.
 */
export function Widget({ id, config, opacidad, moviendo, pantalla, etiqueta, escalar = true, interactivo, children }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [tamano, setTamano] = useState<Tamano>({ ancho: 0, alto: 0 });
  // Posición tras arrastrar en esta sesión (se guarda en main al salir del modo mover).
  const [arrastrada, setArrastrada] = useState<Punto | null>(null);
  const dentro = useRef(false);
  const arrastrando = useRef(false);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setTamano((t) => (t.ancho === el.offsetWidth && t.alto === el.offsetHeight ? t : { ancho: el.offsetWidth, alto: el.offsetHeight }));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Una posición nueva desde los ajustes (p. ej. restablecida) sustituye a la arrastrada.
  useEffect(() => setArrastrada(null), [config.x, config.y]);

  const factor = escalar ? config.escala : 1;
  const visible: Tamano = { ancho: tamano.ancho * factor, alto: tamano.alto * factor };
  const guardada = config.x !== null && config.y !== null ? { x: config.x, y: config.y } : null;
  const pos = ajustarAPantalla(arrastrada ?? guardada ?? posicionPorDefecto(id, pantalla, visible), pantalla, visible);
  const posRef = useRef(pos);
  posRef.current = pos;

  const capturar = useCallback(
    (si: boolean) => {
      if (moviendo) window.coachOverlay.capturarRaton(si);
      else if (interactivo) window.coachOverlay.capturarRatonJungla(si);
    },
    [moviendo, interactivo],
  );

  const alPulsar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!moviendo || e.button !== 0) return;
      e.preventDefault();
      arrastrando.current = true;
      const origen = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
      const mover = (ev: PointerEvent) =>
        setArrastrada(ajustarAPantalla({ x: ev.clientX - origen.x, y: ev.clientY - origen.y }, pantalla, visible));
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        arrastrando.current = false;
        window.coachOverlay.guardarWidget(id, posRef.current.x, posRef.current.y);
        if (!dentro.current) window.coachOverlay.capturarRaton(false);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [moviendo, id, pantalla, visible],
  );

  return (
    <div
      ref={caja}
      className={clases('widget', `widget-${id}`, moviendo && 'moviendo')}
      data-widget={id}
      style={{ left: pos.x, top: pos.y, opacity: opacidad }}
      onPointerDown={alPulsar}
      onMouseEnter={() => {
        dentro.current = true;
        capturar(true);
      }}
      onMouseLeave={() => {
        dentro.current = false;
        // Durante un arrastre rápido el cursor puede salirse: se suelta al terminar.
        if (!arrastrando.current) capturar(false);
      }}
    >
      <div className="widget-contenido" style={escalar && config.escala !== 1 ? { transform: `scale(${config.escala})` } : undefined}>
        {children}
      </div>
      {moviendo && <span className="widget-etiqueta">{etiqueta}</span>}
    </div>
  );
}
