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

  useEffect(() => {
    const api = window.coachOverlay;
    api.alPanel(setPanel);
    api.alAviso((a) => {
      const id = siguiente.current++;
      setAvisos((v) => [...v, { id, texto: a.texto }]);
      setTimeout(() => setAvisos((v) => v.filter((x) => x.id !== id)), DURACION_AVISO_MS);
      if (a.voz) void hablar(a.texto);
    });
    api.alMover(setMoviendo);
    void api.obtenerPosicion().then((p) => {
      if (p) {
        posRef.current = p;
        setPos(p);
      }
    });
  }, []);

  const arrastrar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!moviendo) return;
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
        window.coachOverlay.guardarPosicion(posRef.current.x, posRef.current.y);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [moviendo],
  );

  return (
    <div
      className={moviendo ? 'panel moviendo' : 'panel'}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={arrastrar}
    >
      {moviendo && <p className="ayuda">{t('overlay.moviendo')}</p>}
      <Panel panel={panel} />
      <Avisos avisos={avisos} />
    </div>
  );
}
