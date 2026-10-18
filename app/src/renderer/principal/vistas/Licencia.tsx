import { KeyRound, LoaderCircle } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { t } from '../../../shared/i18n';
import type { EstadoLicencia } from '../../../shared/tiposApp';
import { Aviso, Boton } from '../../comun/componentes';

/** Fecha de renovación en español («18 de noviembre de 2026»); vacía si no se puede leer. */
export function fechaRenovacion(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Avisos del estado de la licencia que el usuario debe conocer (sin conexión, cancelada, impagada). */
export function AvisoEstadoLicencia({ licencia }: { licencia: EstadoLicencia }) {
  if (licencia.estado === 'sin_conexion') return <Aviso tono="info">{t('premium.estado.sin_conexion')}</Aviso>;
  if (licencia.estado === 'cancelada') return <Aviso tono="aviso">{t('premium.estado.cancelada')}</Aviso>;
  if (licencia.estado === 'impagada') return <Aviso tono="error">{t('premium.estado.impagada')}</Aviso>;
  return null;
}

type Resultado = { tono: 'exito' | 'error'; texto: string } | null;

/** Campo para pegar la clave de licencia y activarla. */
export function FormularioLicencia({ alCambiarLicencia }: { alCambiarLicencia: (e: EstadoLicencia) => void }) {
  const id = useId();
  const [clave, setClave] = useState('');
  const [activando, setActivando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const limpia = clave.trim();

  const activar = async (e: FormEvent) => {
    e.preventDefault();
    if (!limpia || activando) return;
    setActivando(true);
    setResultado(null);
    try {
      const nuevo = await window.coach.activarLicencia(limpia);
      alCambiarLicencia(nuevo);
      setResultado(
        nuevo.plan === 'premium' ? { tono: 'exito', texto: t('premium.activada') } : { tono: 'error', texto: t('premium.claveNoValida') },
      );
    } catch {
      setResultado({ tono: 'error', texto: t('premium.errorActivar') });
    } finally {
      setActivando(false);
    }
  };

  return (
    <form className="formulario-licencia" onSubmit={(e) => void activar(e)}>
      <label htmlFor={id} className="campo-etiqueta">
        {t('premium.clave')}
      </label>
      <div className="campo-fila">
        <div className="campo">
          <KeyRound size={16} className="campo-icono" aria-hidden="true" />
          <input
            id={id}
            className="campo-entrada"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder={t('premium.clavePlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <Boton type="submit" variante="primario" disabled={!limpia || activando}>
          {activando && <LoaderCircle size={16} className="girando" aria-hidden="true" />}
          {activando ? t('premium.activando') : t('premium.activar')}
        </Boton>
      </div>
      <p className="campo-ayuda">{t('premium.ayudaClave')}</p>
      {resultado && <Aviso tono={resultado.tono}>{resultado.texto}</Aviso>}
    </form>
  );
}

/** Botón para quitar la licencia de este equipo. */
export function BotonQuitarLicencia({ alCambiarLicencia }: { alCambiarLicencia: (e: EstadoLicencia) => void }) {
  const [quitando, setQuitando] = useState(false);
  const quitar = () => {
    setQuitando(true);
    window.coach
      .quitarLicencia()
      .then(alCambiarLicencia, () => undefined)
      .finally(() => setQuitando(false));
  };
  return (
    <Boton variante="fantasma" disabled={quitando} onClick={quitar}>
      {quitando ? t('premium.quitando') : t('premium.quitar')}
    </Boton>
  );
}
