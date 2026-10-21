import { Move, Pin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { idiomaActual, t } from '../../shared/i18n';
import { estadoJungla } from '../../shared/jungla';
import type { AjustesOverlay, ConfigWidget, EscalaHud, EstadoJungla, EstadoOverlay, EstadoRendimiento, IdWidget, ModoOverlay, ObjetivoEstado, PanelAumentos as Panel } from '../../shared/tiposApp';
import { Avisos, type AvisoVisible } from './Avisos';
import { ModoCarga } from './carga/ModoCarga';
import { useIdioma } from '../comun/idioma';
import { ColaVoz } from './voz';
import { Widget } from './Widget';
import { escalaWidget } from './posiciones';
import { BarraObjetivos } from './widgets/BarraObjetivos';
import { FlechaHabilidad } from './widgets/FlechaHabilidad';
import { Jungla } from './widgets/Jungla';
import { MinimapaJungla } from './widgets/MinimapaJungla';
import { PanelAumentos } from './widgets/PanelAumentos';
import { ToastCompra } from './widgets/ToastCompra';
import { usePantalla } from './widgets/usePresencia';
import { WidgetRendimiento } from './widgets/WidgetCs';

export const DURACION_AVISO_MS = 5000;

/** Valor que se crea una vez por idioma (la misma referencia mientras no cambie: no provoca repintados de más). */
export function porIdioma<T>(crear: () => T): () => T {
  let idioma: string | null = null;
  let valor: T;
  return () => {
    if (idioma !== idiomaActual()) {
      idioma = idiomaActual();
      valor = crear();
    }
    return valor;
  };
}

const objetivosDemo = porIdioma(
  (): ObjetivoEstado[] => [
    { id: 'larvas', nombre: t('objetivoCorto.larvas'), subtipo: null, aparece: null, disponible: true },
    { id: 'dragon', nombre: t('objetivoCorto.dragon'), subtipo: t('overlay.dragon.infernal'), aparece: 42, disponible: false },
    { id: 'heraldo', nombre: t('objetivoCorto.heraldo'), subtipo: null, aparece: 402, disponible: false },
    { id: 'baron', nombre: t('objetivoCorto.baron'), subtipo: null, aparece: 702, disponible: false },
  ],
);
const compraDemo = porIdioma(() => ({ id: 3108, nombre: t('vistaOverlay.ejemploObjeto'), coste: 0, puedeComprar: true }));
/** Muestra del panel de aumentos (modo mover): nombres del idioma actual, sin iconos. */
const aumentosDemo = porIdioma((): Panel => {
  const a = (id: number, tier: 'S' | 'A' | 'B') => ({ id, nombre: t('vistaOverlay.ejemploAumento', { n: id }), icono: null, tier });
  return {
    campeon: 'Zed',
    columnas: [
      { rareza: 'prismatico', aumentos: [a(1, 'S'), a(2, 'A'), a(3, 'A')] },
      { rareza: 'oro', aumentos: [a(4, 'S'), a(5, 'A'), a(6, 'B')] },
      { rareza: 'plata', aumentos: [a(7, 'S'), a(8, 'A'), a(9, 'B')] },
    ],
    combos: [{ id: 'tema:ad', aumentos: [a(10, 'S'), a(11, 'A'), a(12, 'A')] }],
  };
});
const avisosDemo = porIdioma(() => [{ id: -1, texto: t('vistaOverlay.ejemploAviso'), tipo: 'habilidad' as const }]);

/** Datos de muestra para colocar los widgets en el modo mover aunque no haya partida (textos en el idioma actual). */
export const DEMO = {
  get objetivos() {
    return objetivosDemo();
  },
  rendimiento: {
    cs: { cs: 74, porMinuto: 7.4, objetivoPorMinuto: 7.5, cs10: 71 },
    kda: { k: 4, d: 2, a: 7, ratio: 5.5 },
    kdaMedio: { asesinatos: 5.1, muertes: 4.8, asistencias: 6.9, ratio: 2.5 },
  } satisfies EstadoRendimiento,
  get compra() {
    return compraDemo();
  },
  get avisos() {
    return avisosDemo();
  },
  get aumentos() {
    return aumentosDemo();
  },
  // Lado azul a 1:52 con el rojo y el Gromp marcados (mismo cálculo que en la partida).
  jungla: estadoJungla({ rojo: 0, gromp: 0 }, 112, 'ORDER'),
};

export function Overlay() {
  // Al cambiar el idioma (desde Ajustes) se repinta todo el overlay en el nuevo.
  useIdioma();
  const [estado, setEstado] = useState<EstadoOverlay | null>(null);
  const [config, setConfig] = useState<AjustesOverlay | null>(null);
  const [modo, setModo] = useState<ModoOverlay>('partida');
  const [avisos, setAvisos] = useState<AvisoVisible[]>([]);
  const [moviendo, setMoviendo] = useState(false);
  const [jungla, setJungla] = useState<EstadoJungla | null>(null);
  const [aumentos, setAumentos] = useState<Panel | null>(null);
  const [hud, setHud] = useState<EscalaHud | null>(null);
  const pantalla = usePantalla();
  const siguiente = useRef(0);
  // Cola central de la voz: una frase a la vez, la más urgente primero, sin frases caducadas.
  // 3.1: la voz pregrabada o la natural la da main; sin ella, la de Windows.
  const cola = useMemo(() => {
    const api = window.coachOverlay;
    const natural = api.sintetizarVoz ? { sintetizar: (t: string) => api.sintetizarVoz!(t), preparar: (t: string) => api.prepararVoz?.(t) } : undefined;
    return new ColaVoz(globalThis.speechSynthesis, Date.now, natural);
  }, []);
  const vozActiva = useRef(false);

  useEffect(() => {
    const api = window.coachOverlay;
    api.alEstado(setEstado);
    api.alConfig(setConfig);
    api.alModo((m) => {
      setModo(m);
      // Fuera de la partida no se guarda nada de la anterior (al volver no sale ni un segundo).
      if (m !== 'partida') {
        setEstado(null);
        setJungla(null);
        setAumentos(null);
      }
    });
    api.alMover(setMoviendo);
    api.alJungla(setJungla);
    api.alAumentos?.(setAumentos);
    api.alVoz((f) => vozActiva.current && cola.encolar(f));
    api.alAviso((a) => {
      const id = siguiente.current++;
      setAvisos((v) => [...v.slice(-2), { id, texto: a.texto, tipo: a.tipo ?? null }]);
      setTimeout(() => setAvisos((v) => v.filter((x) => x.id !== id)), DURACION_AVISO_MS);
    });
    void api.obtenerConfig().then((c) => c && setConfig((actual) => actual ?? c));
    // Escala del HUD de LoL (game.cfg): coloca la flecha y el minimapa sin calibrar.
    api.alHud?.(setHud);
    void api.obtenerHud?.().then((h) => h && setHud((actual) => actual ?? h));
    return () => cola.detener();
  }, [cola]);

  // Volumen y voz de los ajustes; con la voz apagada o fuera de la partida, la cola se calla.
  useEffect(() => {
    if (config) cola.configurar({ volumen: config.voz.volumen, vozId: config.voz.vozId, motor: config.voz.motor });
    vozActiva.current = !!config?.voz.activa && modo === 'partida';
    if (!vozActiva.current) cola.detener();
  }, [cola, config, modo]);

  // La pantalla de carga (modo 'carga') va siempre montada: escucha overlay:carga desde que carga la ventana.
  // En el modo mover se esconde para dejar ver la muestra de los widgets.
  const api = window.coachOverlay;
  return (
    <>
      <ModoCarga alModo={api.alModo} alCarga={api.alCarga} alOcultar={api.alOcultarCarga} config={config?.carga ?? null} visible={!moviendo} />
      {config && (modo === 'partida' || moviendo) && (
        <Widgets config={config} modo={modo} moviendo={moviendo} estado={estado} jungla={jungla} avisos={avisos} pantalla={pantalla} hud={hud} aumentos={aumentos} />
      )}
    </>
  );
}

interface PropsWidgets {
  config: AjustesOverlay;
  modo: ModoOverlay;
  moviendo: boolean;
  estado: EstadoOverlay | null;
  jungla: EstadoJungla | null;
  avisos: AvisoVisible[];
  pantalla: ReturnType<typeof usePantalla>;
  hud?: EscalaHud | null;
  aumentos?: Panel | null;
}

/** Clave de la calibración de la flecha por tamaño de pantalla («1920x1080»). */
export const clavePantalla = (p: { ancho: number; alto: number }) => `${Math.round(p.ancho)}x${Math.round(p.alto)}`;

/**
 * Posición de la flecha: la calibrada en el modo mover para este tamaño de pantalla manda; si no hay, la guardada por
 * la 3.0 (una sola para todas); si tampoco, la de la escala del HUD (posición por defecto).
 */
export function configFlecha(config: AjustesOverlay, pantalla: { ancho: number; alto: number }): ConfigWidget {
  const calibrada = config.calibracionHabilidad?.[clavePantalla(pantalla)];
  return calibrada ? { ...config.widgets.habilidad, x: calibrada.x, y: calibrada.y } : config.widgets.habilidad;
}

/** Los widgets de la partida (o su muestra en el modo mover). */
function Widgets({ config, modo, moviendo, estado, jungla, avisos, pantalla, hud = null, aumentos = null }: PropsWidgets) {
  const enPartida = modo === 'partida';

  const datos = enPartida ? estado : null;
  const comun = (id: IdWidget) => ({ id, config: config.widgets[id], opacidad: config.opacidad, moviendo, pantalla, etiqueta: t(`overlay.widget.${id}`) });
  // Fuera de la Grieta el estado dice qué widgets tienen sentido (widgetsDeModo); en el modo mover se ven todos.
  const activo = (id: IdWidget) => config.widgets[id].activo && (moviendo || !datos || datos.widgets?.[id] !== false);

  const objetivos = datos?.objetivos.length ? datos.objetivos : moviendo ? DEMO.objetivos : null;
  const rendimiento = datos?.rendimiento ?? (moviendo ? DEMO.rendimiento : null);
  const datosJungla = (enPartida ? jungla : null) ?? (moviendo ? DEMO.jungla : null);
  const listaAvisos = avisos.length || !moviendo ? avisos : DEMO.avisos;

  return (
    // --ov-zoom: los controles del modo mover (banner, etiquetas, marco del minimapa) crecen como los widgets (× 2 a 4K).
    <div className={moviendo ? 'ov-raiz moviendo' : 'ov-raiz'} style={{ ['--ov-zoom' as string]: String(Math.round(escalaWidget(pantalla, 1) * 1000) / 1000) }}>
      {moviendo && <BannerMover />}
      {activo('objetivos') && objetivos && (
        <Widget {...comun('objetivos')}>
          <BarraObjetivos objetivos={objetivos} />
        </Widget>
      )}
      {/* Siempre montada (vacía sin punto libre) para que la flecha pueda animar su salida. */}
      {activo('habilidad') && (
        <Widget {...comun('habilidad')} config={configFlecha(config, pantalla)} escalar={false} hud={hud}>
          <FlechaHabilidad habilidad={datos?.proximaHabilidad ?? null} pantalla={pantalla} escala={config.widgets.habilidad.escala} calibrando={moviendo} hud={hud} />
        </Widget>
      )}
      {activo('cs') && rendimiento && (
        <Widget {...comun('cs')}>
          <WidgetRendimiento rendimiento={rendimiento} />
        </Widget>
      )}
      {activo('compra') && (
        <Widget {...comun('compra')}>
          <ToastCompra compra={datos?.compra ?? null} version={datos?.version ?? estado?.version ?? ''} demo={moviendo ? DEMO.compra : null} />
        </Widget>
      )}
      {activo('jungla') &&
        datosJungla &&
        // Por defecto, temporizadores sobre los campamentos del minimapa; el panel lateral queda como opción.
        (config.jungla?.presentacion === 'panel' ? (
          <Widget {...comun('jungla')} interactivo>
            <Jungla estado={datosJungla} alMarcar={(id) => window.coachOverlay.marcarJungla(id)} bloqueado={moviendo} />
          </Widget>
        ) : (
          <MinimapaJungla
            estado={datosJungla}
            guardado={config.jungla?.minimapa ?? null}
            pantalla={pantalla}
            opacidad={config.opacidad}
            moviendo={moviendo}
            alMarcar={(id) => window.coachOverlay.marcarJungla(id)}
            hud={hud}
            escala={config.widgets.jungla.escala}
          />
        ))}
      {/* 3.4: solo en ARAM: Caos (el estado lo dice) y cuando main manda el panel; en el modo mover, la muestra. */}
      {activo('aumentos') && (moviendo || (datos?.widgets?.aumentos && aumentos)) && (
        <Widget {...comun('aumentos')}>
          <PanelAumentos panel={moviendo ? DEMO.aumentos : aumentos} />
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
