import { ArrowDown, ArrowLeftRight, ArrowUp, ExternalLink, LoaderCircle, Package, ScrollText, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TipoCambioParche } from '@coach/shared';
import { t } from '../../../shared/i18n';
import type { CambioCampeonVista, CambioObjetoVista, NotasParcheVista } from '../../../shared/tiposApp';
import { Aviso, Boton, Pestanas, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { CabeceraVista } from './CabeceraVista';
import { EstadoVacio } from './EstadoVacio';

/*
 * Novedades del parche: «Lo que cambia para tus campeones». Primero tus campeones más jugados (del Perfil local) con
 * su flecha y una frase, luego el resto (filtrable) y los objetos. Las frases las escribe la IA del servidor a partir
 * de las notas oficiales de Riot, que se enlazan siempre: es un resumen, no las notas completas.
 */

const ICONO_TIPO: Record<TipoCambioParche, typeof ArrowUp> = { mejora: ArrowUp, empeora: ArrowDown, ajuste: ArrowLeftRight };

/** Flecha del tipo de cambio, con su texto para lectores de pantalla y como tooltip. */
export function FlechaCambio({ tipo }: { tipo: TipoCambioParche }) {
  const Icono = ICONO_TIPO[tipo];
  const texto = t(`notasParche.tipo.${tipo}`);
  return (
    <span className={`parche-flecha parche-${tipo}`} title={texto} role="img" aria-label={texto}>
      <Icono size={15} strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}

function FilaCampeon({ c, version }: { c: CambioCampeonVista; version: string }) {
  return (
    <li className="parche-fila">
      <IconoDDragon tipo="campeon" id={c.campeon.id} version={version} nombre={c.campeon.nombre} tamano={36} />
      <div className="parche-fila-textos">
        <span className="parche-fila-nombre">
          {c.campeon.nombre}
          {c.partidas !== undefined && <span className="texto-secundario"> · {t('notasParche.partidas', { n: c.partidas })}</span>}
        </span>
        <span className="parche-fila-resumen">{c.resumen}</span>
      </div>
      <FlechaCambio tipo={c.tipo} />
    </li>
  );
}

function FilaObjeto({ o, version }: { o: CambioObjetoVista; version: string }) {
  return (
    <li className="parche-fila">
      {o.id ? (
        <IconoDDragon tipo="objeto" id={o.id} version={version} nombre={o.nombre} tamano={36} />
      ) : (
        <span className="icono-dd hueco" style={{ width: 36, height: 36 }} title={o.nombre} />
      )}
      <div className="parche-fila-textos">
        <span className="parche-fila-nombre">{o.nombre}</span>
        <span className="parche-fila-resumen">{o.resumen}</span>
      </div>
      <FlechaCambio tipo={o.tipo} />
    </li>
  );
}

type Filtro = 'todos' | TipoCambioParche;

/** Normaliza para buscar sin tildes ni mayúsculas. */
const plano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export function NotasParche({ notas, version }: { notas: NotasParcheVista; version: string }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const resto = useMemo(() => {
    const q = plano(busqueda.trim());
    return notas.resto.filter((c) => (filtro === 'todos' || c.tipo === filtro) && (!q || plano(c.campeon.nombre).includes(q)));
  }, [notas.resto, busqueda, filtro]);
  const abrir = window.coach?.abrirNotasParche;

  return (
    <div className="vista-parche">
      <Tarjeta
        titulo={t('notasParche.parche', { parche: notas.parcheJuego })}
        icono={<ScrollText size={15} />}
        className="parche-resumen"
        extra={notas.sinConexion ? <span className="texto-secundario">{t('notasParche.sinConexion')}</span> : undefined}
      >
        {notas.general && <p className="parche-general">{notas.general}</p>}
        <p className="parche-fuente texto-secundario">{t('notasParche.pie')}</p>
        {abrir && (
          <Boton variante="secundario" onClick={() => void abrir(notas.url)}>
            <ExternalLink size={14} aria-hidden="true" /> {t('notasParche.verNotas')}
          </Boton>
        )}
      </Tarjeta>

      <Tarjeta titulo={t('notasParche.tuyos')} icono={<UserRound size={15} />} className="parche-tuyos">
        {notas.tuyos.length > 0 ? (
          <ul className="parche-lista">
            {notas.tuyos.map((c) => (
              <FilaCampeon key={c.campeon.id} c={c} version={version} />
            ))}
          </ul>
        ) : (
          <p className="texto-secundario">{t(notas.hayPerfil ? 'notasParche.tuyosVacio' : 'notasParche.sinPerfil')}</p>
        )}
      </Tarjeta>

      {notas.resto.length > 0 && (
        <Tarjeta titulo={t('notasParche.resto')} icono={<ScrollText size={15} />} className="parche-resto">
          <div className="parche-controles">
            <label className="campo-busqueda">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label={t('notasParche.buscar')}
                placeholder={t('notasParche.buscar')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <Pestanas
              etiqueta={t('notasParche.filtro')}
              activa={filtro}
              alCambiar={(id) => setFiltro(id as Filtro)}
              opciones={(['todos', 'mejora', 'empeora', 'ajuste'] as const).map((id) => ({
                id,
                texto: id === 'todos' ? t('notasParche.todos') : t(`notasParche.tipo.${id}`),
              }))}
            />
          </div>
          {resto.length > 0 ? (
            <ul className="parche-lista">
              {resto.map((c) => (
                <FilaCampeon key={c.campeon.id} c={c} version={version} />
              ))}
            </ul>
          ) : (
            <p className="texto-secundario">{t('notasParche.ninguno')}</p>
          )}
        </Tarjeta>
      )}

      {notas.objetos.length > 0 && (
        <Tarjeta titulo={t('notasParche.objetos')} icono={<Package size={15} />} className="parche-objetos">
          <ul className="parche-lista">
            {notas.objetos.map((o) => (
              <FilaObjeto key={o.nombre} o={o} version={version} />
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

/** Vista «Parche»: pide las notas ('coach:notas-parche') y las pinta; mientras llegan, un aviso de carga. */
export function VistaNotasParche() {
  const [estado, setEstado] = useState<{ notas: NotasParcheVista; version: string } | 'cargando' | 'sin_notas'>('cargando');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    const pedir = window.coach?.notasParche;
    if (!pedir) {
      setEstado('sin_notas');
      return;
    }
    setEstado('cargando');
    pedir().then(
      (r) => vigente && setEstado(r.ok ? { notas: r.notas, version: r.version } : 'sin_notas'),
      () => vigente && setEstado('sin_notas'),
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('notasParche.titulo')} descripcion={t('notasParche.desc')} />
      {estado === 'cargando' && (
        <p className="texto-secundario" aria-busy="true">
          <LoaderCircle size={14} className="girando" aria-hidden="true" /> {t('notasParche.cargando')}
        </p>
      )}
      {estado === 'sin_notas' && (
        <EstadoVacio icono={<ScrollText size={28} />} titulo={t('notasParche.sinNotas')} descripcion={t('notasParche.sinNotasDesc')}>
          <Aviso tono="info" accion={<Boton onClick={() => setIntento((n) => n + 1)}>{t('notasParche.reintentar')}</Boton>}>
            {t('notasParche.pie')}
          </Aviso>
        </EstadoVacio>
      )}
      {typeof estado === 'object' && <NotasParche notas={estado.notas} version={estado.version} />}
    </div>
  );
}
