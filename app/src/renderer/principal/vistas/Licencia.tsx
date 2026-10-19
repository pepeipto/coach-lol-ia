import { KeyRound, LoaderCircle } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { t } from '../../../shared/i18n';
import type { EstadoLicencia } from '../../../shared/tiposApp';
import { Aviso, Boton } from '../../comun/componentes';

/** Fecha de renovación en español («18 de noviembre de 2026»); vacía si no se puede leer. */
export function fechaRenovacion(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «Prueba gratuita: quedan 5 h» (o «42 min» con menos de una hora); vacío si no es una prueba vigente. */
export function textoPrueba(licencia: EstadoLicencia, ahora: number = Date.now()): string {
  if (licencia.tipo !== 'prueba' || !licencia.caducaEn) return '';
  const falta = Date.parse(licencia.caducaEn) - ahora;
  if (!(falta > 0)) return '';
  const horas = Math.floor(falta / 3_600_000);
  return horas >= 1
    ? t('premium.pruebaQuedanHoras', { horas })
    : t('premium.pruebaQuedanMinutos', { minutos: Math.max(1, Math.floor(falta / 60_000)) });
}

/** La hora actual, refrescada cada minuto (para la cuenta atrás de la prueba). */
export function useAhora(cadaMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

/** Motivos con los que main rechaza una clave, con su texto. */
const MOTIVOS: Record<string, string> = {
  clave_no_valida: 'premium.claveNoValida',
  caducada: 'premium.estado.caducada',
  otro_dispositivo: 'premium.estado.otro_dispositivo',
  prueba_ya_usada: 'premium.estado.prueba_ya_usada',
};

/** Avisos del estado de la licencia que el usuario debe conocer (sin conexión, cancelada, impagada, pruebas). */
export function AvisoEstadoLicencia({ licencia }: { licencia: EstadoLicencia }) {
  if (licencia.estado === 'sin_conexion') return <Aviso tono="info">{t('premium.estado.sin_conexion')}</Aviso>;
  if (licencia.estado === 'caducada') return <Aviso tono="aviso">{t('premium.estado.caducada')}</Aviso>;
  if (licencia.estado === 'otro_dispositivo') return <Aviso tono="error">{t('premium.estado.otro_dispositivo')}</Aviso>;
  if (licencia.estado === 'prueba_ya_usada') return <Aviso tono="aviso">{t('premium.estado.prueba_ya_usada')}</Aviso>;
  if (licencia.estado === 'cancelada') return <Aviso tono="aviso">{t('premium.estado.cancelada')}</Aviso>;
  if (licencia.estado === 'impagada') return <Aviso tono="error">{t('premium.estado.impagada')}</Aviso>;
  return null;
}

/**
 * Campo para pegar la clave de licencia y activarla. Si activa Premium, la vista cambia (y este
 * formulario desaparece): la confirmación la muestra quien lo contiene, avisado con `alActivar`.
 */
export function FormularioLicencia({
  alCambiarLicencia,
  alActivar,
}: {
  alCambiarLicencia: (e: EstadoLicencia) => void;
  alActivar?: () => void;
}) {
  const id = useId();
  const [clave, setClave] = useState('');
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limpia = clave.trim();

  const activar = async (e: FormEvent) => {
    e.preventDefault();
    if (!limpia || activando) return;
    setActivando(true);
    setError(null);
    try {
      const nuevo = await window.coach.activarLicencia(limpia);
      if (nuevo.plan === 'premium') alActivar?.();
      // La clave existe pero su suscripción no está activa: se explica el motivo real.
      else if (nuevo.estado === 'cancelada' || nuevo.estado === 'impagada') setError(t(`premium.activar.${nuevo.estado}`));
      else setError(t('premium.claveNoValida'));
      alCambiarLicencia(nuevo);
    } catch (err) {
      // main rechaza con un motivo («clave_no_valida», «prueba_ya_usada»…); cualquier otro fallo es de conexión.
      const mensaje = err instanceof Error ? err.message : '';
      const motivo = Object.keys(MOTIVOS).find((m) => mensaje.includes(m));
      setError(t(motivo ? MOTIVOS[motivo]! : 'premium.errorActivar'));
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
      {error && <Aviso tono="error">{error}</Aviso>}
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
