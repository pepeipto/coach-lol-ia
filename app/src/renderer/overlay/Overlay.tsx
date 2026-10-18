import { Move, Pin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import type { Panel as DatosPanel } from '../../shared/tiposApp';
import { Avisos, type AvisoVisible } from './Avisos';
import { Panel } from './Panel';
import { hablar } from './voz';

export const DURACION_AVISO_MS = 5000;
const POSICION_INICIAL = { x: 24, y: 120 };

export function Overlay() {
  const [panel, setPanel] = useState<DatosPanel | null>(null);
  const [avisos, setAvisos] = useState<AvisoVisible[]>([]);
  const [moviendo, setMoviendo] = useState(false);
  const [pos, setPos] = useState(POSICION_INICIAL);
  const posRef = useRef(pos);
  const siguiente = useRef(0);
  // La ventana deja pasar los clics; en modo mover se pide el ratón solo mientras el cursor está sobre el panel.
  const dentro = useRef(false);
  const arrastrando = useRef(false);

  useEffect(() => {
    const api = window.coachOverlay;
    api.alPanel(setPanel);
    api.alAviso((a) => {
      const id = siguiente.current++;
      setAvisos((v) => [...v, { id, texto: a.texto, tipo: a.tipo ?? null }]);
      setTimeout(() => setAvisos((v) => v.filter((x) => x.id !== id)), DURACION_AVISO_MS);
      if (a.voz) void hablar(a.texto);
    });
    api.alMover((activo) => {
      setMoviendo(activo);
      if (!activo) arrastrando.current = false;
    });
    void api.obtenerPosicion().then((p) => {
      if (p) {
        posRef.current = p;
        setPos(p);
      }
    });
  }, []);

  const arrastrar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!moviendo || e.button !== 0) return;
      arrastrando.current = true;
      const origen = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
      const mover = (ev: PointerEvent) => {
        const p = {
          x: Math.max(0, Math.min(window.innerWidth - 40, ev.clientX - origen.x)),
          y: Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - origen.y)),
        };
        posRef.current = p;
        setPos(p);
      };
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        arrastrando.current = false;
        window.coachOverlay.guardarPosicion(posRef.current.x, posRef.current.y);
        if (!dentro.current) window.coachOverlay.capturarRaton(false);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [moviendo],
  );

  const entrar = useCallback(() => {
    dentro.current = true;
    if (moviendo) window.coachOverlay.capturarRaton(true);
  }, [moviendo]);
  const salir = useCallback(() => {
    dentro.current = false;
    // Durante un arrastre rápido el cursor puede salirse del panel: se suelta al terminar.
    if (moviendo && !arrastrando.current) window.coachOverlay.capturarRaton(false);
  }, [moviendo]);

  return (
    <div
      className={moviendo ? 'ov-panel moviendo' : 'ov-panel'}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={arrastrar}
      onMouseEnter={entrar}
      onMouseLeave={salir}
    >
      {moviendo && (
        <div className="mover">
          <p className="ayuda">
            <Move size={14} aria-hidden="true" />
            <span>{t('overlay.moviendo')}</span>
          </p>
          <button
            type="button"
            className="fijar"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => window.coachOverlay.fijar()}
          >
            <Pin size={14} aria-hidden="true" />
            {t('overlay.fijarAqui')}
          </button>
        </div>
      )}
      <Panel panel={panel} />
      <Avisos avisos={avisos} />
    </div>
  );
}
