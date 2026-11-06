import { Crown, Hexagon, Keyboard, LoaderCircle, Package, Pin, PinOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../../shared/i18n';
import type { CompTftVista, ElementoTftVista, ObjetosCampeonTftVista, RespuestaTft } from '../../../shared/tiposApp';
import { alternarEnChuleta, MAX_CHULETA_TFT, type CompChuletaTft } from '../../../shared/tftChuleta';
import { textoAcelerador } from '../../../shared/teclas';
import { Aviso, Boton, clases, Tarjeta } from '../../comun/componentes';
import { useAjustes } from './useAjustes';
import { CabeceraVista } from './CabeceraVista';
import { EstadoVacio } from './EstadoVacio';

/*
 * TFT: tier list de composiciones del parche y los mejores objetos de cada unidad, calculados por el servidor con
 * partidas clasificatorias de Maestro en adelante. Es para consultar fuera de la partida (política de Riot): ni
 * aumentos ni nada que cambie con lo que pasa en tu partida.
 */

const pct = (x: number) => `${Math.round(x * 100)} %`;
const puesto = (x: number) => x.toFixed(2).replace('.', t('tft.decimal'));

/** Icono de una unidad, rasgo u objeto; sin icono de Data Dragon, sus iniciales. */
export function IconoTft({ e, tamano = 36, clase }: { e: ElementoTftVista; tamano?: number; clase?: string }) {
  const [roto, setRoto] = useState(false);
  const estilo = { width: tamano, height: tamano };
  if (e.icono && !roto)
    return <img className={clases('tft-icono', clase)} src={e.icono} alt={e.nombre} title={e.nombre} style={estilo} loading="lazy" onError={() => setRoto(true)} />;
  const iniciales = e.nombre
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={clases('tft-icono tft-icono-texto', clase)} title={e.nombre} role="img" aria-label={e.nombre} style={estilo}>
      {iniciales}
    </span>
  );
}

/** Lo que se guarda en los ajustes al llevar una composición a la chuleta (solo ids). */
export const compParaChuleta = (c: CompTftVista, parche: string): CompChuletaTft => ({
  id: c.id,
  rasgos: c.rasgos.map((r) => r.id),
  portador: c.portador.id,
  unidades: c.unidades.map((u) => u.id),
  objetosPortador: c.objetosPortador.map((o) => o.id),
  parche,
});

interface PropsComp {
  c: CompTftVista;
  alAbrir: (u: ElementoTftVista) => void;
  /** Objetos recomendados de cada unidad (id → hasta 3), para pintarlos bajo su retrato. */
  objetos: Record<string, ElementoTftVista[]>;
  /** 3.15: la composición va en la chuleta de la partida (undefined: sin ajustes, sin botón). */
  enChuleta?: boolean;
  alAlternarChuleta?: () => void;
}

/** Retrato de una unidad con el marco del color de su coste y sus objetos debajo. */
function Unidad({ u, portador, objetos, alAbrir }: { u: ElementoTftVista; portador: boolean; objetos: ElementoTftVista[]; alAbrir: () => void }) {
  return (
    <li className="tft-unidad-celda">
      <button
        type="button"
        className={clases('tft-unidad', u.coste ? `coste-${Math.min(u.coste, 5)}` : undefined, portador && 'portador')}
        onClick={alAbrir}
        title={t('tft.verObjetos', { nombre: u.nombre })}
      >
        <span className="tft-retrato">
          <IconoTft e={u} tamano={56} />
          {portador && (
            <span className="tft-marca-portador" aria-label={t('tft.portadorCorto')}>
              <Crown size={11} aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="tft-unidad-nombre">{u.nombre}</span>
      </button>
      <span className="tft-unidad-objetos" aria-label={objetos.length > 0 ? t('tft.objetosDe', { nombre: u.nombre }) : undefined}>
        {objetos.map((o) => (
          <IconoTft key={o.id} e={o} tamano={18} />
        ))}
      </span>
    </li>
  );
}

function Comp({ c, alAbrir, objetos, enChuleta, alAlternarChuleta }: PropsComp) {
  const nombre = c.rasgos.map((r) => r.nombre).join(' + ');
  // El portador siempre con los objetos de esta composición; el resto, con sus objetos recomendados.
  const objetosDe = (u: ElementoTftVista) => (u.id === c.portador.id && c.objetosPortador.length > 0 ? c.objetosPortador : (objetos[u.id] ?? []));
  return (
    <li className={clases('tft-comp', enChuleta && 'en-chuleta')}>
      <div className="tft-comp-cabecera">
        <span className="tft-comp-nombre" aria-label={nombre}>
          {c.rasgos.map((r) => (
            <span key={r.id} className="tft-rasgo">
              {r.icono && <img className="tft-rasgo-icono" src={r.icono} alt="" width={18} height={18} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              {r.nombre}
            </span>
          ))}
        </span>
        <span className="tft-comp-datos">
          <span className="tft-dato">
            <small>{t('tft.etiquetaPuesto')}</small>
            <b>{puesto(c.puestoMedio)}</b>
          </span>
          <span className="tft-dato">
            <small>{t('tft.etiquetaTop4')}</small>
            <b>{pct(c.top4)}</b>
          </span>
          <span className="tft-dato">
            <small>{t('tft.etiquetaNivel')}</small>
            <b>{Math.round(c.nivelMedio)}</b>
          </span>
          {alAlternarChuleta && (
            <Boton variante={enChuleta ? 'primario' : 'fantasma'} className="tft-chuleta-boton" onClick={alAlternarChuleta} aria-pressed={enChuleta} title={t(enChuleta ? 'tft.chuleta.quitar' : 'tft.chuleta.llevar')}>
              {enChuleta ? <PinOff size={13} aria-hidden="true" /> : <Pin size={13} aria-hidden="true" />}
              {t(enChuleta ? 'tft.chuleta.enPartida' : 'tft.chuleta.llevarCorto')}
            </Boton>
          )}
        </span>
      </div>
      <ul className="tft-unidades" aria-label={t('tft.unidades')}>
        {c.unidades.map((u) => (
          <Unidad key={u.id} u={u} portador={u.id === c.portador.id} objetos={objetosDe(u)} alAbrir={() => alAbrir(u)} />
        ))}
      </ul>
    </li>
  );
}

/** Mejores objetos de una unidad (al pulsarla en una composición). */
function PanelObjetos({ unidad, alCerrar }: { unidad: ElementoTftVista; alCerrar: () => void }) {
  const [estado, setEstado] = useState<ObjetosCampeonTftVista | 'cargando' | 'sin_datos'>('cargando');
  useEffect(() => {
    let vigente = true;
    setEstado('cargando');
    const pedir = window.coach?.tftObjetos;
    if (!pedir) return setEstado('sin_datos');
    pedir(unidad.id).then(
      (r) => vigente && setEstado(r.ok ? r.objetos : 'sin_datos'),
      () => vigente && setEstado('sin_datos'),
    );
    return () => {
      vigente = false;
    };
  }, [unidad.id]);

  return (
    <Tarjeta
      titulo={t('tft.objetosDe', { nombre: unidad.nombre })}
      icono={<Package size={15} />}
      className="tft-panel-objetos"
      extra={
        <Boton variante="fantasma" onClick={alCerrar} aria-label={t('tft.cerrar')}>
          <X size={14} aria-hidden="true" />
        </Boton>
      }
    >
      {estado === 'cargando' && <p className="texto-secundario">{t('tft.cargando')}</p>}
      {estado === 'sin_datos' && <p className="texto-secundario">{t('tft.objetosSinDatos')}</p>}
      {typeof estado === 'object' && (
        <>
          {estado.juegos.length > 0 ? (
            <ul className="tft-juegos">
              {estado.juegos.map((j) => (
                <li key={j.objetos.map((o) => o.id).join(',')} className="tft-juego">
                  <span className="tft-juego-iconos">
                    {j.objetos.map((o) => (
                      <IconoTft key={o.id} e={o} tamano={30} />
                    ))}
                  </span>
                  <span className="tft-juego-nombres">{j.objetos.map((o) => o.nombre).join(', ')}</span>
                  <span className="texto-secundario">
                    {t('tft.top4', { n: pct(j.top4) })} · {t('tft.puestoMedio', { n: puesto(j.puestoMedio) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="texto-secundario">{t('tft.sinJuegos')}</p>
          )}
          {estado.populares.length > 0 && (
            <p className="tft-populares">
              <span className="texto-secundario">{t('tft.populares')}</span>{' '}
              {estado.populares.map((p) => `${p.nombre} (${pct(p.frecuencia)})`).join(' · ')}
            </p>
          )}
        </>
      )}
    </Tarjeta>
  );
}

/**
 * 3.15: la chuleta para la partida: qué composiciones van (como mucho dos) y con qué tecla se abre. En la partida es
 * un panel fijo: no cambia con tu tablero, tu tienda ni tus aumentos.
 */
function TarjetaChuleta({ elegidas, nombres, tecla, alQuitar }: { elegidas: readonly CompChuletaTft[]; nombres: readonly CompTftVista[]; tecla: string; alQuitar: (id: string) => void }) {
  const nombreDe = (c: CompChuletaTft) => {
    const vista = nombres.find((x) => x.id === c.id);
    return vista ? vista.rasgos.map((r) => r.nombre).join(' + ') : t('tft.chuleta.anterior', { parche: c.parche ?? '?' });
  };
  return (
    <Tarjeta titulo={t('tft.chuleta.titulo')} icono={<Keyboard size={15} />} className="tft-chuleta">
      <p className="texto-secundario">{t('tft.chuleta.desc', { tecla: textoAcelerador(tecla), n: MAX_CHULETA_TFT })}</p>
      {elegidas.length === 0 ? (
        <p className="texto-secundario">{t('tft.chuleta.vacia')}</p>
      ) : (
        <ul className="tft-chuleta-lista">
          {elegidas.map((c) => (
            <li key={c.id}>
              <span>{nombreDe(c)}</span>
              <Boton variante="fantasma" onClick={() => alQuitar(c.id)} aria-label={t('tft.chuleta.quitar')}>
                <X size={13} aria-hidden="true" />
              </Boton>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export function VistaTft() {
  const [estado, setEstado] = useState<RespuestaTft | 'cargando'>('cargando');
  const [intento, setIntento] = useState(0);
  const [abierta, setAbierta] = useState<ElementoTftVista | null>(null);
  const [objetos, setObjetos] = useState<Record<string, ElementoTftVista[]>>({});
  const { ajustes, cambiar } = useAjustes();
  // Con la tier list ya pintada, los objetos recomendados de cada unidad (llegan después, sin bloquear la vista).
  useEffect(() => {
    if (typeof estado !== 'object' || !estado.ok) return;
    const pedir = window.coach?.tftObjetosUnidades;
    if (!pedir) return;
    let vigente = true;
    const ids = [...new Set(estado.comps.flatMap((c) => c.unidades.filter((u) => u.id !== c.portador.id).map((u) => u.id)))].slice(0, 120);
    pedir(ids).then(
      (r) => vigente && setObjetos(r ?? {}),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [estado]);
  const chuleta = ajustes?.tftChuleta ?? [];
  useEffect(() => {
    let vigente = true;
    const pedir = window.coach?.tft;
    if (!pedir) return setEstado({ ok: false, motivo: 'sin_conexion' });
    setEstado('cargando');
    pedir().then(
      (r) => vigente && setEstado(r),
      () => vigente && setEstado({ ok: false, motivo: 'sin_conexion' }),
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    <div className="vista-ajustes vista-tft">
      <CabeceraVista titulo={t('tft.titulo')} descripcion={t('tft.desc')} />
      {estado === 'cargando' && (
        <p className="texto-secundario" aria-busy="true">
          <LoaderCircle size={14} className="girando" aria-hidden="true" /> {t('tft.cargando')}
        </p>
      )}
      {typeof estado === 'object' && !estado.ok && (
        <EstadoVacio
          icono={<Hexagon size={28} />}
          titulo={t(estado.motivo === 'sin_datos' ? 'tft.sinDatos' : 'tft.sinConexion')}
          descripcion={t(estado.motivo === 'sin_datos' ? 'tft.sinDatosDesc' : 'tft.sinConexionDesc')}
        >
          <Aviso tono="info" accion={<Boton onClick={() => setIntento((n) => n + 1)}>{t('tft.reintentar')}</Boton>}>
            {t('tft.pie')}
          </Aviso>
        </EstadoVacio>
      )}
      {typeof estado === 'object' && estado.ok && (
        <>
          <p className="tft-resumen texto-secundario">{t('tft.resumen', { parche: estado.parche, n: estado.partidas })}</p>
          {ajustes && <TarjetaChuleta elegidas={chuleta} nombres={estado.comps} tecla={ajustes.teclaOverlay} alQuitar={(id) => cambiar({ ...ajustes, tftChuleta: chuleta.filter((c) => c.id !== id) })} />}
          {abierta && <PanelObjetos unidad={abierta} alCerrar={() => setAbierta(null)} />}
          {(['S', 'A', 'B', 'C'] as const).map((tier) => {
            const lista = estado.comps.filter((c) => c.tier === tier);
            if (lista.length === 0) return null;
            return (
              <Tarjeta key={tier} titulo={t('tft.tier', { tier })} icono={<span className={`tft-tier tft-tier-${tier}`}>{tier}</span>} className="tft-grupo">
                <ul className="tft-comps">
                  {lista.map((c) => (
                    <Comp
                      key={c.id}
                      c={c}
                      alAbrir={setAbierta}
                      objetos={objetos}
                      {...(ajustes
                        ? {
                            enChuleta: chuleta.some((x) => x.id === c.id),
                            alAlternarChuleta: () => cambiar({ ...ajustes, tftChuleta: alternarEnChuleta(chuleta, compParaChuleta(c, estado.parche)) }),
                          }
                        : {})}
                    />
                  ))}
                </ul>
              </Tarjeta>
            );
          })}
          <p className="tft-pie texto-secundario">
            {t('tft.pie')} {t('tft.ia')}
          </p>
        </>
      )}
    </div>
  );
}
