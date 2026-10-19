import { Move, Pin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import { estadoJungla } from '../../main/consejos/jungla';
import type { AjustesOverlay, EstadoCs, EstadoJungla, EstadoOverlay, IdWidget, ModoOverlay, ObjetivoEstado } from '../../shared/tiposApp';
import { Avisos, type AvisoVisible } from './Avisos';
import { ColaVoz } from './voz';
import { Widget } from './Widget';
import { BarraObjetivos } from './widgets/BarraObjetivos';
import { FlechaHabilidad } from './widgets/FlechaHabilidad';
import { Jungla } from './widgets/Jungla';
import { ToastCompra } from './widgets/ToastCompra';
import { usePantalla } from './widgets/usePresencia';
import { WidgetCs } from './widgets/WidgetCs';

export const DURACION_AVISO_MS = 5000;

/** Datos de muestra para colocar los widgets en el modo mover aunque no haya partida. */
export const DEMO = {
  objetivos: [
    { id: 'larvas', nombre: t('objetivoCorto.larvas'), subtipo: null, aparece: null, disponible: true },
    { id: 'dragon', nombre: t('objetivoCorto.dragon'), subtipo: t('overlay.dragon.infernal'), aparece: 42, disponible: false },
    { id: 'heraldo', nombre: t('objetivoCorto.heraldo'), subtipo: null, aparece: 402, disponible: false },
    { id: 'baron', nombre: t('objetivoCorto.baron'), subtipo: null, aparece: 702, disponible: false },
  ] satisfies ObjetivoEstado[],
  cs: { cs: 74, porMinuto: 7.4, objetivoPorMinuto: 7.5, cs10: 71 } satisfies EstadoCs,
  compra: { id: 3108, nombre: t('vistaOverlay.ejemploObjeto'), coste: 0, puedeComprar: true },
  avisos: [{ id: -1, texto: t('vistaOverlay.ejemploAviso'), tipo: 'habilidad' as const }],
  // Lado azul a 1:52 con el rojo y el Gromp marcados (mismo cálculo que en la partida).
  jungla: estadoJungla({ rojo: 0, gromp: 0 }, 112, 'ORDER'),
};

export function Overlay() {
  const [estado, setEstado] = useState<EstadoOverlay | null>(null);
  const [config, setConfig] = useState<AjustesOverlay | null>(null);
  const [modo, setModo] = useState<ModoOverlay>('partida');
  const [avisos, setAvisos] = useState<AvisoVisible[]>([]);
  const [moviendo, setMoviendo] = useState(false);
  const [jungla, setJungla] = useState<EstadoJungla | null>(null);
  const pantalla = usePantalla();
  const siguiente = useRef(0);
  // Cola central de la voz: una frase a la vez, la más urgente primero, sin frases caducadas.
  const cola = useMemo(() => new ColaVoz(), []);
  const vozActiva = useRef(false);

  useEffect(() => {
    const api = window.coachOverlay;
    api.alEstado(setEstado);
    api.alConfig(setConfig);
    api.alModo(setModo);
    api.alMover(setMoviendo);
    api.alJungla(setJungla);
    api.alVoz((f) => vozActiva.current && cola.encolar(f));
    api.alAviso((a) => {
      const id = siguiente.current++;
      setAvisos((v) => [...v.slice(-2), { id, texto: a.texto, tipo: a.tipo ?? null }]);
      setTimeout(() => setAvisos((v) => v.filter((x) => x.id !== id)), DURACION_AVISO_MS);
    });
    void api.obtenerConfig().then((c) => c && setConfig((actual) => actual ?? c));
    return () => cola.detener();
  }, [cola]);

  // Volumen y voz de los ajustes; con la voz apagada o fuera de la partida, la cola se calla.
  useEffect(() => {
    if (config) cola.configurar({ volumen: config.voz.volumen, vozId: config.voz.vozId });
    vozActiva.current = !!config?.voz.activa && modo === 'partida';
    if (!vozActiva.current) cola.detener();
  }, [cola, config, modo]);

  if (!config) return null;
  const enPartida = modo === 'partida';
  if (!enPartida && !moviendo) return null;

  const datos = enPartida ? estado : null;
  const comun = (id: IdWidget) => ({ id, config: config.widgets[id], opacidad: config.opacidad, moviendo, pantalla, etiqueta: t(`overlay.widget.${id}`) });
  const activo = (id: IdWidget) => config.widgets[id].activo;

  const objetivos = datos?.objetivos.length ? datos.objetivos : moviendo ? DEMO.objetivos : null;
  const cs = datos?.cs ?? (moviendo ? DEMO.cs : null);
  const datosJungla = (enPartida ? jungla : null) ?? (moviendo ? DEMO.jungla : null);
  const listaAvisos = avisos.length || !moviendo ? avisos : DEMO.avisos;

  return (
    <div className={moviendo ? 'ov-raiz moviendo' : 'ov-raiz'}>
      {moviendo && <BannerMover />}
      {activo('objetivos') && objetivos && (
        <Widget {...comun('objetivos')}>
          <BarraObjetivos objetivos={objetivos} />
        </Widget>
      )}
      {activo('habilidad') && (datos?.proximaHabilidad || moviendo) && (
        <Widget {...comun('habilidad')} escalar={false}>
          <FlechaHabilidad habilidad={datos?.proximaHabilidad ?? null} pantalla={pantalla} escala={config.widgets.habilidad.escala} calibrando={moviendo} />
        </Widget>
      )}
      {activo('cs') && cs && (
        <Widget {...comun('cs')}>
          <WidgetCs cs={cs} />
        </Widget>
      )}
      {activo('compra') && (
        <Widget {...comun('compra')}>
          <ToastCompra compra={datos?.compra ?? null} version={datos?.version ?? estado?.version ?? ''} demo={moviendo ? DEMO.compra : null} />
        </Widget>
      )}
      {activo('jungla') && datosJungla && (
        <Widget {...comun('jungla')} interactivo>
          <Jungla estado={datosJungla} alMarcar={(id) => window.coachOverlay.marcarJungla(id)} bloqueado={moviendo} />
        </Widget>
      )}
      {activo('avisos') && (
        <Widget {...comun('avisos')}>
          <Avisos avisos={listaAvisos} estaticos={moviendo && avisos.length === 0} />
        </Widget>
      )}
    </div>
  );
}

/** Instrucciones del modo mover con el botón «Fijar aquí»; recibe el ratón mientras el cursor está encima. */
function BannerMover() {
  return (
    <div
      className="ov-banner-mover"
      onMouseEnter={() => window.coachOverlay.capturarRaton(true)}
      onMouseLeave={() => window.coachOverlay.capturarRaton(false)}
    >
      <Move size={16} aria-hidden="true" />
      <p>
        <b>{t('overlay.moverTitulo')}</b>
        <span>{t('overlay.moverAyuda')}</span>
      </p>
      <button type="button" className="fijar" onClick={() => window.coachOverlay.fijar()}>
        <Pin size={14} aria-hidden="true" />
        {t('overlay.fijarAqui')}
      </button>
    </div>
  );
}
