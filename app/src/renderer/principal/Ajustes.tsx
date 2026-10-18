import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n';
import type { Ajustes as TipoAjustes, TipoAviso } from '../../shared/tiposApp';

const AVISOS: TipoAviso[] = ['compra', 'habilidad', 'objetivo', 'vision', 'fase'];

export function Ajustes() {
  const [ajustes, setAjustes] = useState<TipoAjustes | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [moviendo, setMoviendo] = useState(false);

  useEffect(() => {
    void window.coach.obtenerAjustes().then(setAjustes);
    void window.coach.overlayMoviendo().then(setMoviendo);
    return window.coach.alCambiarMover(setMoviendo);
  }, []);

  if (!ajustes) return null;

  const cambiar = (nuevo: TipoAjustes) => {
    setAjustes(nuevo);
    setGuardado(false);
    void window.coach.guardarAjustes(nuevo).then(() => setGuardado(true));
  };

  return (
    <section className="ajustes">
      <h3>{t('ajustes.avisos')}</h3>
      {AVISOS.map((a) => (
        <label key={a}>
          <input
            type="checkbox"
            checked={ajustes.avisos[a]}
            onChange={(e) => cambiar({ ...ajustes, avisos: { ...ajustes.avisos, [a]: e.target.checked } })}
          />
          {t('ajustes.aviso.' + a)}
        </label>
      ))}
      <label>
        <input type="checkbox" checked={ajustes.voz} onChange={(e) => cambiar({ ...ajustes, voz: e.target.checked })} />
        {t('ajustes.voz')}
      </label>
      <label>
        <input
          type="checkbox"
          checked={ajustes.importacionAutomatica}
          onChange={(e) => cambiar({ ...ajustes, importacionAutomatica: e.target.checked })}
        />
        {t('ajustes.importacionAutomatica')}
      </label>
      <button
        type="button"
        onClick={() => {
          void window.coach.moverOverlay(!moviendo).then(setMoviendo);
        }}
      >
        {moviendo ? t('ajustes.fijarOverlay') : t('ajustes.moverOverlay')}
      </button>
      {guardado && <p className="nota">{t('ajustes.guardado')}</p>}
    </section>
  );
}
