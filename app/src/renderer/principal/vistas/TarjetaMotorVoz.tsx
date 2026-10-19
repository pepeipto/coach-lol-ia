import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { idiomaActual, t } from '../../../shared/i18n';
import type { AjustesVoz, EstadoVozNatural, MotorVoz } from '../../../shared/tiposApp';
import { Aviso, Boton } from '../../comun/componentes';

const MOTORES: MotorVoz[] = ['pack', 'natural', 'sistema'];

/**
 * Motores que se ofrecen: la voz pregrabada solo si hay paquete publicado para el idioma (en la 3.1 aún no hay
 * ninguno). Sin él, 'pack' suena igual que la natural, así que se enseña como «Natural».
 */
export function motoresVisibles(estado: Pick<EstadoVozNatural, 'packDisponible'> | null): MotorVoz[] {
  return estado?.packDisponible ? MOTORES : MOTORES.filter((m) => m !== 'pack');
}

/** Estado de la voz natural y del paquete pregrabado, al día con el progreso de la descarga ('voz:estado'). */
export function useVozNatural(): EstadoVozNatural | null {
  const [estado, setEstado] = useState<EstadoVozNatural | null>(null);
  useEffect(() => {
    const api = window.coach;
    if (!api.estadoVozNatural) return;
    let vivo = true;
    void api
      .estadoVozNatural()
      .then((e) => vivo && setEstado(e))
      .catch(() => {});
    const quitar = api.alCambiarVozNatural?.((e) => setEstado(e));
    return () => {
      vivo = false;
      quitar?.();
    };
  }, []);
  return estado;
}

const nombreVoz = (v: EstadoVozNatural['voces'][number]) =>
  t(v.genero === 'masculina' ? 'vozNatural.masculina' : 'vozNatural.femenina', { n: v.numero });

/**
 * Motor de la voz (3.1): pregrabada de Coach LoL IA, natural (neuronal, sin conexión) o Windows; la voz natural
 * del idioma y la descarga, con su progreso. Lo que no esté descargado suena con la voz de Windows.
 */
export function TarjetaMotorVoz({
  voz,
  estado,
  alCambiar,
}: {
  voz: AjustesVoz;
  estado: EstadoVozNatural | null;
  alCambiar(v: Partial<AjustesVoz>): void;
}) {
  const api = window.coach;
  const idioma = idiomaActual();
  const deshabilitado = !voz.activa;
  const vozElegida = voz.vocesNaturales[idioma] ?? estado?.porDefecto ?? '';
  const porcentaje = estado && estado.total > 0 ? Math.min(100, Math.floor((estado.recibidos / estado.total) * 100)) : 0;
  const [pidiendo, setPidiendo] = useState(false);
  const motores = motoresVisibles(estado);
  const motorVisible: MotorVoz = motores.includes(voz.motor) ? voz.motor : 'natural';
  const descargar = () => {
    setPidiendo(true);
    void api.descargarVozNatural?.().finally(() => setPidiendo(false));
  };

  return (
    <div className="vo-motor-voz" data-motor-voz>
      <div className="vo-fila-voz">
        <label className="vo-select">
          <span>{t('vozNatural.motor')}</span>
          <select value={motorVisible} disabled={deshabilitado} onChange={(e) => alCambiar({ motor: e.target.value as MotorVoz })}>
            {motores.map((m) => (
              <option key={m} value={m}>
                {t(`vozNatural.motor.${m}`)}
              </option>
            ))}
          </select>
        </label>
        {voz.motor !== 'sistema' && estado && (
          <label className="vo-select">
            <span>{t('vozNatural.voz')}</span>
            <select
              value={vozElegida}
              disabled={deshabilitado}
              onChange={(e) => alCambiar({ vocesNaturales: { ...voz.vocesNaturales, [idioma]: e.target.value } })}
            >
              {estado.voces.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id === estado.porDefecto ? t('vozNatural.recomendada', { voz: nombreVoz(v) }) : nombreVoz(v)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {voz.motor !== 'sistema' && <p className="texto-secundario">{t('vozNatural.motorDesc')}</p>}
      {motorVisible === 'pack' && <p className="texto-secundario">{t('vozNatural.motorDescPack')}</p>}
      {voz.motor !== 'sistema' && estado && <EstadoDescarga estado={estado} porcentaje={porcentaje} pidiendo={pidiendo} alDescargar={descargar} />}
    </div>
  );
}

function EstadoDescarga({
  estado,
  porcentaje,
  pidiendo,
  alDescargar,
}: {
  estado: EstadoVozNatural;
  porcentaje: number;
  pidiendo: boolean;
  alDescargar(): void;
}) {
  const api = window.coach;
  if (estado.estado === 'descargando' || estado.estado === 'instalando') {
    return (
      <div className="vo-descarga-voz" aria-live="polite">
        <span>{estado.estado === 'instalando' ? t('vozNatural.instalando') : t('vozNatural.descargando', { porcentaje })}</span>
        <progress max={100} value={estado.estado === 'instalando' ? 100 : porcentaje} aria-label={t('vozNatural.descargar')} />
        {estado.estado === 'descargando' && (
          <Boton variante="secundario" className="boton-pequeno" onClick={() => void api.cancelarDescargaVoz?.()}>
            <X size={14} aria-hidden="true" />
            {t('vozNatural.cancelar')}
          </Boton>
        )}
      </div>
    );
  }
  if (estado.error === 'motor') return <Aviso tono="aviso">{t('vozNatural.error.motor')}</Aviso>;
  if (estado.estado === 'instalada') return <Aviso tono="exito">{t('vozNatural.instalada')}</Aviso>;
  const boton = (
    <Boton variante="secundario" className="boton-pequeno" disabled={pidiendo} onClick={alDescargar}>
      <Download size={14} aria-hidden="true" />
      {estado.error ? t('vozNatural.reintentar') : t('vozNatural.descargar')}
    </Boton>
  );
  if (estado.error) return <Aviso tono="aviso" accion={boton}>{t(`vozNatural.error.${estado.error}`)}</Aviso>;
  return (
    <Aviso tono="info" accion={boton}>
      {t('vozNatural.noInstalada', { tamano: `${estado.megasPendientes} MB` })}
    </Aviso>
  );
}
