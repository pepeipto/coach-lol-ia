import { Hexagon, Keyboard, LoaderCircle, Package, Pin, PinOff, X } from 'lucide-react';
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
  /** 3.15: la composición va en la chuleta de la partida (undefined: sin ajustes, sin botón). */
  enChuleta?: boolean;
  alAlternarChuleta?: () => void;
}

function Comp({ c, alAbrir, enChuleta, alAlternarChuleta }: PropsComp) {
  const nombre = c.rasgos.map((r) => r.nombre).join(' + ');
  return (
    <li className={clases('tft-comp', enChuleta && 'en-chuleta')}>
      <div className="tft-comp-cabecera">
        <span className="tft-comp-nombre">{nombre}</span>
        {alAlternarChuleta && (
          <Boton variante={enChuleta ? 'primario' : 'fantasma'} className="tft-chuleta-boton" onClick={alAlternarChuleta} aria-pressed={enChuleta} title={t(enChuleta ? 'tft.chuleta.quitar' : 'tft.chuleta.llevar')}>
            {enChuleta ? <PinOff size={13} aria-hidden="true" /> : <Pin size={13} aria-hidden="true" />}
            {t(enChuleta ? 'tft.chuleta.enPartida' : 'tft.chuleta.llevarCorto')}
          </Boton>
        )}
        <span className="tft-comp-datos texto-secundario">
          {t('tft.puestoMedio', { n: puesto(c.puestoMedio) })} · {t('tft.top4', { n: pct(c.top4) })} · {t('tft.nivel', { n: Math.round(c.nivelMedio) })}
        </span>
      </div>
      <ul className="tft-unidades" aria-label={t('tft.unidades')}>
        {c.unidades.map((u) => (
          <li key={u.id}>
            <button type="button" className={clases('tft-unidad', u.id === c.portador.id && 'portador')} onClick={() => alAbrir(u)} title={t('tft.verObjetos', { nombre: u.nombre })}>
              <IconoTft e={u} tamano={40} />
              <span className="tft-unidad-nombre">{u.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
      {c.objetosPortador.length > 0 && (
        <p className="tft-portador">
          <span className="texto-secundario">{t('tft.portador', { nombre: c.portador.nombre })}</span>
          {c.objetosPortador.map((o) => (
            <IconoTft key={o.id} e={o} tamano={24} />
          ))}
          <span className="tft-objetos-nombres">{c.objetosPortador.map((o) => o.nombre).join(', ')}</span>
        </p>
      )}
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
  const { ajustes, cambiar } = useAjustes();
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
