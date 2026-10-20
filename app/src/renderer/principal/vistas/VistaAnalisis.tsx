import { BrainCircuit, CheckCircle2, Clock, Crosshair, Eye, Flag, Loader2, ShieldCheck, Swords, Target, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EntradaAnalisis, EstadoAnalisis } from '../../../shared/tiposApp';
import { Aviso, clases, Insignia, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { CabeceraVista } from './CabeceraVista';
import { EstadoVacio } from './EstadoVacio';

/** mm:ss de unos segundos de partida. */
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

const numero = (n: number, decimales = 0) => n.toLocaleString(localeActual(), { maximumFractionDigits: decimales, minimumFractionDigits: decimales });

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(localeActual(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Marca {
  t: number;
  tono: 'muerte' | 'aliado' | 'enemigo';
  etiqueta: string;
}

/**
 * Gráfico de línea en SVG (sin librerías): una serie por minuto, una referencia opcional (discontinua) y marcas en el
 * eje del tiempo (muertes y objetivos).
 */
export function GraficoLinea({
  titulo,
  serie,
  referencia,
  etiquetaReferencia,
  marcas,
  duracion,
}: {
  titulo: string;
  serie: { m: number; v: number }[];
  referencia?: { m: number; v: number }[];
  etiquetaReferencia?: string;
  marcas: Marca[];
  duracion: number;
}) {
  const ancho = 640;
  const alto = 190;
  const m = { izq: 44, der: 12, arr: 14, aba: 30 };
  const minutos = Math.max(1, duracion / 60, ...serie.map((p) => p.m));
  const maximo = Math.max(1, ...serie.map((p) => p.v), ...(referencia ?? []).map((p) => p.v));
  const x = (min: number) => m.izq + (min / minutos) * (ancho - m.izq - m.der);
  const y = (v: number) => alto - m.aba - (v / maximo) * (alto - m.arr - m.aba);
  const camino = (pts: { m: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = serie.length ? `${camino([{ m: 0, v: 0 }, ...serie])} L${x(serie.at(-1)!.m).toFixed(1)},${y(0)} Z` : '';
  const pasoMin = minutos > 30 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor(minutos / pasoMin) + 1 }, (_, i) => i * pasoMin);
  const lineasY = [0, 0.5, 1].map((f) => Math.round(maximo * f));
  return (
    <figure className="grafico-analisis">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={t('analisis.grafico.desc', { serie: titulo })}>
        {lineasY.map((v) => (
          <g key={v}>
            <line className="grafico-rejilla" x1={m.izq} x2={ancho - m.der} y1={y(v)} y2={y(v)} />
            <text className="grafico-eje" x={m.izq - 6} y={y(v) + 4} textAnchor="end">
              {numero(v)}
            </text>
          </g>
        ))}
        {ticks.map((min) => (
          <text key={min} className="grafico-eje" x={x(min)} y={alto - 10} textAnchor="middle">
            {min}′
          </text>
        ))}
        {area && <path className="grafico-area" d={area} />}
        {referencia && referencia.length > 1 && <path className="grafico-referencia" d={camino(referencia)} />}
        {serie.length > 1 && <path className="grafico-serie" d={camino(serie)} />}
        {marcas.map((mk, i) => (
          <g key={i} className={`grafico-marca marca-${mk.tono}`}>
            <title>{`${mmss(mk.t)} · ${mk.etiqueta}`}</title>
            <line x1={x(mk.t / 60)} x2={x(mk.t / 60)} y1={m.arr} y2={alto - m.aba} />
            <circle cx={x(mk.t / 60)} cy={alto - m.aba} r={mk.tono === 'muerte' ? 4.5 : 3.5} />
          </g>
        ))}
      </svg>
      <figcaption className="grafico-leyenda">
        <span className="leyenda-serie">{titulo}</span>
        {referencia && etiquetaReferencia && <span className="leyenda-referencia">{etiquetaReferencia}</span>}
        {marcas.some((x) => x.tono === 'muerte') && <span className="leyenda-muerte">{t('analisis.grafico.muerte')}</span>}
        {marcas.some((x) => x.tono === 'aliado') && <span className="leyenda-aliado">{t('analisis.grafico.objetivoAliado')}</span>}
        {marcas.some((x) => x.tono === 'enemigo') && <span className="leyenda-enemigo">{t('analisis.grafico.objetivoEnemigo')}</span>}
      </figcaption>
    </figure>
  );
}

function marcasDe(e: EntradaAnalisis): Marca[] {
  return [
    ...e.objetivos
      .filter((o) => o.tipo !== 'torre' && o.tipo !== 'inhibidor')
      .map((o): Marca => ({ t: o.t, tono: o.equipo, etiqueta: t(`analisis.objetivo.${o.tipo}`) })),
    ...e.muertes.map((s): Marca => ({ t: s, tono: 'muerte', etiqueta: t('analisis.grafico.muerte') })),
  ];
}

function Resultado({ resultado }: { resultado: EntradaAnalisis['resultado'] }) {
  if (resultado === 'victoria') return <Insignia tono="exito" icono={<Trophy size={12} />}>{t('analisis.victoria')}</Insignia>;
  if (resultado === 'derrota') return <Insignia tono="error">{t('analisis.derrota')}</Insignia>;
  return <Insignia tono="neutro">{t('analisis.sinResultado')}</Insignia>;
}

/** Detalle de un análisis: cabecera con los números, veredicto, puntos, gráficos, momentos y enfoque. */
function DetalleAnalisis({ e }: { e: EntradaAnalisis }) {
  const [grafico, setGrafico] = useState<'cs' | 'oro'>(e.modo === 'clasificatoria' ? 'cs' : 'oro');
  const minutos = Math.max(1, e.duracion / 60);
  const f = e.final;
  const kda = (f.k + f.a) / Math.max(1, f.d);
  const conCs = e.modo === 'clasificatoria' || e.modo === 'aram' || e.modo === 'caos';
  const marcas = useMemo(() => marcasDe(e), [e]);
  const serieCs = e.linea.map((x) => ({ m: x.m, v: x.cs }));
  const serieOro = e.linea.map((x) => ({ m: x.m, v: x.oro }));
  const referencia = e.csObjetivoMinuto ? e.linea.map((x) => ({ m: x.m, v: x.m * e.csObjetivoMinuto! })) : undefined;
  const subtitulo = [t(`modo.${e.modo}`), e.rol ? t(`rol.${e.rol}`) : null, mmss(e.duracion)].filter(Boolean).join(' · ');
  return (
    <div className="analisis-detalle">
      <section className="analisis-cabecera" aria-label={t('analisis.resumen')}>
        <div className="analisis-campeon">
          {e.version ? (
            <IconoDDragon tipo="campeon" id={e.campeon} version={e.version} nombre={e.nombreCampeon ?? e.campeon} tamano={56} />
          ) : (
            <span className="analisis-campeon-inicial" aria-hidden="true">{(e.nombreCampeon ?? e.campeon).slice(0, 1)}</span>
          )}
          <div>
            <h2 className="analisis-campeon-nombre">
              {e.nombreCampeon ?? e.campeon} <Resultado resultado={e.resultado} />
            </h2>
            <p className="texto-secundario">{subtitulo}</p>
          </div>
        </div>
        <dl className="analisis-cifras">
          <div>
            <dt><Swords size={13} aria-hidden="true" /> {t('analisis.stat.kda')}</dt>
            <dd>
              {f.k}/{f.d}/{f.a} <small>{numero(kda, 1)}</small>
            </dd>
          </div>
          {conCs && (
            <div>
              <dt><Crosshair size={13} aria-hidden="true" /> {t('analisis.stat.cs')}</dt>
              <dd>
                {f.cs} <small>{t('analisis.stat.porMinuto', { valor: numero(f.cs / minutos, 1) })}</small>
              </dd>
            </div>
          )}
          {f.vision !== undefined && e.modo === 'clasificatoria' && (
            <div>
              <dt><Eye size={13} aria-hidden="true" /> {t('analisis.stat.vision')}</dt>
              <dd>{f.vision}</dd>
            </div>
          )}
          {f.danoCampeones !== undefined && (
            <div>
              <dt><Target size={13} aria-hidden="true" /> {t('analisis.stat.dano')}</dt>
              <dd>{numero(f.danoCampeones)}</dd>
            </div>
          )}
        </dl>
      </section>

      <Tarjeta titulo={t('analisis.veredicto')} icono={<BrainCircuit size={15} />} className="analisis-veredicto">
        <p>{e.analisis.veredicto}</p>
      </Tarjeta>

      <div className="analisis-columnas">
        <Tarjeta titulo={t('analisis.bien')} icono={<CheckCircle2 size={15} />} className="analisis-bien">
          <ul className="analisis-puntos">
            {e.analisis.bien.map((p, i) => (
              <li key={i}>
                <strong>{p.titulo}</strong>
                <span>{p.porque}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo={t('analisis.mejorar')} icono={<TrendingUp size={15} />} className="analisis-mejorar">
          <ul className="analisis-puntos">
            {e.analisis.mejorar.map((p, i) => (
              <li key={i}>
                <strong>{p.titulo}</strong>
                <span>{p.porque}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      {e.linea.length > 1 && (
        <Tarjeta
          titulo={t('analisis.grafico.titulo')}
          icono={<TrendingUp size={15} />}
          extra={
            conCs ? (
              <div className="analisis-selector" role="group" aria-label={t('analisis.grafico.titulo')}>
                {(['cs', 'oro'] as const).map((g) => (
                  <button key={g} type="button" className={clases('chip', grafico === g && 'activo')} aria-pressed={grafico === g} onClick={() => setGrafico(g)}>
                    {t(`analisis.grafico.${g}`)}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {grafico === 'cs' && conCs ? (
            <GraficoLinea
              titulo={t('analisis.grafico.cs')}
              serie={serieCs}
              referencia={referencia}
              etiquetaReferencia={e.csObjetivoMinuto ? t('analisis.grafico.referencia', { valor: numero(e.csObjetivoMinuto, 1) }) : undefined}
              marcas={marcas}
              duracion={e.duracion}
            />
          ) : (
            <GraficoLinea titulo={t('analisis.grafico.oro')} serie={serieOro} marcas={marcas} duracion={e.duracion} />
          )}
        </Tarjeta>
      )}

      <div className="analisis-columnas">
        <Tarjeta titulo={t('analisis.momentos')} icono={<Clock size={15} />}>
          <ol className="analisis-momentos">
            {e.analisis.momentos.map((mo, i) => (
              <li key={i}>
                <span className="momento-tiempo">{mmss(mo.t)}</span>
                <span>{mo.texto}</span>
              </li>
            ))}
          </ol>
        </Tarjeta>
        <Tarjeta titulo={t('analisis.enfoque')} icono={<Flag size={15} />} className="analisis-enfoque">
          <p>{e.analisis.enfoque}</p>
        </Tarjeta>
      </div>
    </div>
  );
}

const ERRORES = ['no_configurado', 'limite', 'no_disponible', 'no_valido', 'sin_conexion'] as const;

/** Vista «Análisis» (3.2): el último análisis con IA y el historial de las partidas anteriores. */
export function VistaAnalisis({ activado = true }: { activado?: boolean }) {
  const [lista, setLista] = useState<EntradaAnalisis[] | null>(null);
  const [estado, setEstado] = useState<EstadoAnalisis>({ estado: 'inactivo' });
  const [elegido, setElegido] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void window.coach.historialAnalisis?.().then((l) => vivo && setLista(l), () => vivo && setLista([]));
    void window.coach.estadoAnalisis?.().then((e) => vivo && setEstado(e), () => undefined);
    if (!window.coach.historialAnalisis) setLista([]);
    const quitar = window.coach.alAnalisis?.(({ estado: nuevo, entrada }) => {
      setEstado(nuevo);
      if (entrada) {
        setLista((l) => [entrada, ...(l ?? []).filter((x) => x.id !== entrada.id)].slice(0, 50));
        setElegido(entrada.id);
      }
    });
    return () => {
      vivo = false;
      quitar?.();
    };
  }, []);

  const actual = lista?.find((x) => x.id === elegido) ?? lista?.[0] ?? null;
  const error = estado.estado === 'error' && ERRORES.includes(estado.error) ? estado.error : null;

  return (
    <div className="vista-ajustes vista-analisis">
      <CabeceraVista titulo={t('analisis.titulo')} descripcion={t('analisis.desc')} />
      {estado.estado === 'analizando' && (
        <Aviso tono="info">
          <Loader2 size={14} className="girando" aria-hidden="true" /> {t('analisis.analizando')}
        </Aviso>
      )}
      {error && <Aviso tono="aviso">{t(`analisis.error.${error}`)}</Aviso>}
      {!activado && <Aviso tono="info">{t('analisis.desactivado')}</Aviso>}
      {lista && lista.length === 0 && estado.estado !== 'analizando' && (
        <EstadoVacio icono={<BrainCircuit size={28} />} titulo={t('analisis.vacio.titulo')} descripcion={t('analisis.vacio.desc')} />
      )}
      {actual && <DetalleAnalisis key={actual.id} e={actual} />}
      {lista && lista.length > 1 && (
        <Tarjeta titulo={t('analisis.historial')} icono={<Clock size={15} />}>
          <ul className="analisis-historial">
            {lista.map((x) => {
              const ratio = (x.final.k + x.final.a) / Math.max(1, x.final.d);
              return (
                <li key={x.id}>
                  <button type="button" className={clases('analisis-historial-fila', x.id === actual?.id && 'activa')} aria-current={x.id === actual?.id ? 'true' : undefined} onClick={() => setElegido(x.id)}>
                    {x.version ? <IconoDDragon tipo="campeon" id={x.campeon} version={x.version} nombre={x.nombreCampeon ?? x.campeon} tamano={28} /> : null}
                    <span className="historial-campeon">{x.nombreCampeon ?? x.campeon}</span>
                    <span className={clases('historial-resultado', x.resultado === 'victoria' && 'victoria', x.resultado === 'derrota' && 'derrota')}>
                      {x.resultado ? t(`analisis.${x.resultado}`) : t('analisis.sinResultado')}
                    </span>
                    <span className="historial-kda">
                      {x.final.k}/{x.final.d}/{x.final.a} · {numero(ratio, 1)}
                    </span>
                    <span className="historial-modo">{t(`modo.${x.modo}`)}</span>
                    <span className="historial-fecha">{fecha(x.fecha)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}
      <p className="nota-privacidad-ia">
        <ShieldCheck size={14} aria-hidden="true" /> {t('analisis.privacidad')}
      </p>
    </div>
  );
}
