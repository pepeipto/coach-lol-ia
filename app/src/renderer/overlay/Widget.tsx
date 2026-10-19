import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ConfigWidget, EscalaHud, IdWidget } from '../../shared/tiposApp';
import { clases } from '../comun/componentes';
import { ajustarAPantalla, escalaWidget, posicionPorDefecto, type Punto, type Tamano } from './posiciones';

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
  /** Escala del HUD de LoL, para la posición por defecto (la flecha de habilidad). */
  hud?: EscalaHud | null;
  children: ReactNode;
}

/**
 * Contenedor de cada widget: lo coloca (posición guardada o la de por defecto), aplica la escala y
 * la opacidad, y en el modo mover deja arrastrarlo. La ventana deja pasar los clics: solo pide el
 * ratón mientras el cursor está encima de un widget que lo necesita.
 */
export function Widget({ id, config, opacidad, moviendo, pantalla, etiqueta, escalar = true, interactivo, hud = null, children }: Props) {
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

  // 3.0.2: la escala sigue el alto de la pantalla (× 2 a 4K) por la escala elegida por el usuario.
  const factor = escalar ? escalaWidget(pantalla, config.escala) : 1;
  const visible: Tamano = { ancho: tamano.ancho * factor, alto: tamano.alto * factor };
  const guardada = config.x !== null && config.y !== null ? { x: config.x, y: config.y } : null;
  const pos = ajustarAPantalla(arrastrada ?? guardada ?? posicionPorDefecto(id, pantalla, visible, hud), pantalla, visible);
  const posRef = useRef(pos);
  posRef.current = pos;

  const capturar = useCallback(
    (si: boolean) => {
      if (moviendo) window.coachOverlay.capturarRaton(si);
      else if (interactivo) window.coachOverlay.capturarRatonJungla(si);
    },
    [moviendo, interactivo],
  );
  const capturarRef = useRef(capturar);
  capturarRef.current = capturar;

  // Al entrar o salir del modo mover con el cursor encima (p. ej. sobre la jungla), se vuelve a
  // pedir el ratón con las reglas nuevas: main lo soltó al cambiar de modo.
  useEffect(() => {
    if (dentro.current) capturar(true);
  }, [capturar]);

  // Si el widget desaparece con el cursor encima, nunca se queda el ratón capturado.
  useEffect(
    () => () => {
      if (dentro.current) capturarRef.current(false);
    },
    [],
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
        // Con el tamaño de la pantalla: la flecha se calibra por tamaño de pantalla.
        window.coachOverlay.guardarWidget(id, posRef.current.x, posRef.current.y, { ancho: pantalla.ancho, alto: pantalla.alto });
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
      <div className="widget-contenido" style={factor !== 1 ? { transform: `scale(${Math.round(factor * 1000) / 1000})` } : undefined}>
        {children}
      </div>
      {/* Arriba del todo no cabe encima: la etiqueta pasa debajo. */}
      {moviendo && <span className={clases('widget-etiqueta', pos.y < 34 && 'abajo')}>{etiqueta}</span>}
    </div>
  );
}
