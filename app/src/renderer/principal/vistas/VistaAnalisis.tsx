import { BrainCircuit, CheckCircle2, Clock, Crosshair, Eye, Flag, Loader2, ShieldCheck, Swords, Target, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EntradaAnalisis, EstadoAnalisis } from '../../../shared/tiposApp';
import { Aviso, Boton, clases, Insignia, Tarjeta } from '../../comun/componentes';
import { retoDeAnalisis } from '../../../shared/perfil';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { CabeceraVista } from './CabeceraVista';
import { EstadoVacio } from './EstadoVacio';
import { claveColaNormal, esColaRotativa } from '../../../shared/colas';
import { BotonMasCuota } from './BotonMasCuota';

/** 3.8: nombre del modo de un análisis: «Normal», «Flex»… en las normales; «Otro modo» en los rotativos. */
function nombreModoAnalisis(e: Pick<EntradaAnalisis, 'modo' | 'cola'>): string {
  const normal = claveColaNormal(e.cola);
  if (normal) return t(normal);
  return esColaRotativa(e.cola) ? t('perfil.modoOtro') : t(`modo.${e.modo}`);
}

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
  /** Letra corta para el carril de objetivos (D = dragón, B = barón…); las muertes llevan una ✕. */
  letra?: string;
}

/** Letra de cada objetivo en el carril de objetivos del gráfico. */
const LETRA_OBJETIVO: Record<string, string> = { dragon: 'D', anciano: 'DA', heraldo: 'H', baron: 'B', larvas: 'L', atakhan: 'AT' };

/** Máximo «redondo» del eje Y (100, 200, 250, 5000…) y su paso, para que las cifras se lean de un vistazo. */
function escalaY(maximo: number): { tope: number; paso: number } {
  const bruto = Math.max(1, maximo) / 3;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}

/** Cifra corta del eje: 12.000 → «12k». */
const cifraEje = (v: number, tope: number) => (tope >= 10000 && v > 0 ? `${numero(v / 1000, v % 1000 ? 1 : 0)}k` : numero(v));

/** Separa en el carril los círculos de objetivos que caen casi a la vez (p. ej. heraldo y dragón seguidos). */
function separar(xs: number[], minimo: number): number[] {
  const orden = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const salida = [...xs];
  let ultimo = -Infinity;
  for (const o of orden) {
    const v = Math.max(o.v, ultimo + minimo);
    salida[o.i] = v;
    ultimo = v;
  }
  return salida;
}

/** Valor de la serie en un instante (minutos), interpolando entre muestras. */
function valorEn(serie: { m: number; v: number }[], min: number): number {
  if (!serie.length) return 0;
  let previo = { m: 0, v: 0 };
  for (const p of serie) {
    if (p.m >= min) return previo.v + ((p.v - previo.v) * (min - previo.m)) / Math.max(1e-6, p.m - previo.m);
    previo = p;
  }
  return serie.at(-1)!.v;
}

/**
 * Gráfico de línea en SVG (sin librerías), pensado para entenderse de un vistazo (3.18):
 * - una frase arriba que dice qué se ve y cómo leerlo, y una fila de cifras clave;
 * - la serie del jugador y una referencia opcional (discontinua); el hueco entre las dos se pinta en verde si vas por
 *   encima y en rojo si vas por debajo;
 * - ejes con nombre («minuto» y la unidad) y cifras redondas;
 * - las muertes y los objetivos van en dos carriles bajo el eje del tiempo (✕ roja por muerte; círculo con letra por
 *   objetivo, verde si fue de tu equipo y naranja si fue del rival), y cada muerte se marca también sobre la línea.
 */
export function GraficoLinea({
  titulo,
  serie,
  referencia,
  etiquetaReferencia,
  marcas,
  duracion,
  explicacion,
  resumen,
}: {
  titulo: string;
  serie: { m: number; v: number }[];
  referencia?: { m: number; v: number }[];
  etiquetaReferencia?: string;
  marcas: Marca[];
  duracion: number;
  /** Frase que explica qué enseña el gráfico y cómo leerlo. */
  explicacion?: string;
  /** Cifras clave sobre el gráfico (p. ej. «A los 10 min: 68 de 75 CS»). */
  resumen?: { texto: string; tono?: 'exito' | 'error' | 'neutro' }[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const muertes = marcas.filter((mk) => mk.tono === 'muerte');
  const objetivos = marcas.filter((mk) => mk.tono !== 'muerte');
  const carriles = [muertes.length ? 'muertes' : null, objetivos.length ? 'objetivos' : null].filter(Boolean) as ('muertes' | 'objetivos')[];
  const ancho = 680;
  const altoGrafico = 200;
  const altoCarril = 26;
  const m = { izq: 80, der: 24, arr: 22, aba: 26 };
  const alto = altoGrafico + carriles.length * altoCarril + (carriles.length ? 4 : 0);
  const minutos = Math.max(1, duracion / 60, ...serie.map((p) => p.m));
  const { tope, paso } = escalaY(Math.max(1, ...serie.map((p) => p.v), ...(referencia ?? []).map((p) => p.v)));
  const x = (min: number) => m.izq + (Math.min(min, minutos) / minutos) * (ancho - m.izq - m.der);
  const y = (v: number) => altoGrafico - m.aba - (v / tope) * (altoGrafico - m.arr - m.aba);
  const pts = (lista: { m: number; v: number }[]) => lista.map((p) => `${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`);
  const camino = (lista: { m: number; v: number }[]) => (lista.length ? `M${pts(lista).join(' L')}` : '');
  const serieDesde0 = serie.length && serie[0].m > 0 ? [{ m: 0, v: 0 }, ...serie] : serie;
  const refDesde0 = referencia && referencia.length && referencia[0].m > 0 ? [{ m: 0, v: 0 }, ...referencia] : referencia;
  const area = serie.length > 1 ? `${camino(serieDesde0)} L${x(serie.at(-1)!.m).toFixed(1)},${y(0)} L${x(serieDesde0[0].m).toFixed(1)},${y(0)} Z` : '';
  // Hueco entre tu línea y la referencia: un polígono recortado por encima (verde) y por debajo (rojo) de la referencia.
  const conRef = !!refDesde0 && refDesde0.length > 1 && serie.length > 1;
  const hueco = conRef ? `M${[...pts(serieDesde0), ...pts(refDesde0!).reverse()].join(' L')} Z` : '';
  const zonaRef = (yBorde: number) =>
    conRef ? `M${pts(refDesde0!).join(' L')} L${x(refDesde0!.at(-1)!.m)},${yBorde} L${x(refDesde0![0].m)},${yBorde} Z` : '';
  const pasoMin = minutos > 30 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor(minutos / pasoMin) + 1 }, (_, i) => i * pasoMin);
  const lineasY = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const yCarril = (c: 'muertes' | 'objetivos') => altoGrafico + 4 + carriles.indexOf(c) * altoCarril + altoCarril / 2;
  const xObjetivos = separar(objetivos.map((o) => x(o.t / 60)), 19);
  const letrasPresentes = [...new Set(objetivos.map((o) => o.letra).filter(Boolean))];
  return (
    <figure className="grafico-analisis">
      {explicacion && <p className="grafico-explicacion">{explicacion}</p>}
      {resumen && resumen.length > 0 && (
        <ul className="grafico-resumen">
          {resumen.map((r, i) => (
            <li key={i} className={`resumen-${r.tono ?? 'neutro'}`}>{r.texto}</li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={t('analisis.grafico.desc', { serie: titulo })}>
        <defs>
          {conRef && (
            <>
              <clipPath id={`${id}-sobre`}><path d={zonaRef(0)} /></clipPath>
              <clipPath id={`${id}-bajo`}><path d={zonaRef(altoGrafico)} /></clipPath>
            </>
          )}
        </defs>
        <text className="grafico-eje grafico-eje-titulo" x={m.izq - 8} y={m.arr - 10} textAnchor="end">{titulo}</text>
        {lineasY.map((v) => (
          <g key={v}>
            <line className="grafico-rejilla" x1={m.izq} x2={ancho - m.der} y1={y(v)} y2={y(v)} />
            <text className="grafico-eje" x={m.izq - 8} y={y(v) + 4} textAnchor="end">{cifraEje(v, tope)}</text>
          </g>
        ))}
        {ticks.map((min) => (
          <text key={min} className="grafico-eje" x={x(min)} y={altoGrafico - 8} textAnchor="middle">
            {min ? `${min} min` : '0'}
          </text>
        ))}
        {conRef ? (
          <>
            <path className="grafico-hueco-mal" d={hueco} clipPath={`url(#${id}-bajo)`} />
            <path className="grafico-hueco-bien" d={hueco} clipPath={`url(#${id}-sobre)`} />
          </>
        ) : (
          area && <path className="grafico-area" d={area} />
        )}
        {conRef && <path className="grafico-referencia" d={camino(refDesde0!)} />}
        {serie.length > 1 && <path className="grafico-serie" d={camino(serieDesde0)} />}
        {muertes.map((mk, i) => (
          <circle key={`p${i}`} className="grafico-muerte-punto" cx={x(mk.t / 60)} cy={y(valorEn(serieDesde0, mk.t / 60))} r={4.5} />
        ))}
        {/* Zonas invisibles por minuto: al pasar el ratón dicen el valor exacto. */}
        {serie.map((p) => (
          <rect key={`h${p.m}`} className="grafico-zona" x={x(p.m - 0.5)} y={m.arr} width={x(1) - x(0)} height={altoGrafico - m.arr - m.aba}>
            <title>
              {referencia
                ? t('analisis.grafico.puntoRef', { minuto: p.m, valor: numero(p.v), serie: titulo, ref: numero(valorEn(referencia, p.m)) })
                : t('analisis.grafico.punto', { minuto: p.m, valor: numero(p.v), serie: titulo })}
            </title>
          </rect>
        ))}
        {carriles.map((c) => (
          <g key={c}>
            <line className="grafico-carril" x1={m.izq} x2={ancho - m.der} y1={yCarril(c)} y2={yCarril(c)} />
            <text className="grafico-eje grafico-carril-nombre" x={m.izq - 8} y={yCarril(c) + 4} textAnchor="end">
              {t(c === 'muertes' ? 'analisis.grafico.carrilMuertes' : 'analisis.grafico.carrilObjetivos')}
            </text>
          </g>
        ))}
        {[...muertes, ...objetivos].map((mk, i) => {
          const cx = mk.tono === 'muerte' ? x(mk.t / 60) : xObjetivos[i - muertes.length];
          const cy = yCarril(mk.tono === 'muerte' ? 'muertes' : 'objetivos');
          return (
            <g key={i} className={`grafico-marca marca-${mk.tono}`}>
              <title>{`${mmss(mk.t)} · ${mk.etiqueta}`}</title>
              {mk.tono === 'muerte' ? (
                <path d={`M${cx - 5},${cy - 5} L${cx + 5},${cy + 5} M${cx + 5},${cy - 5} L${cx - 5},${cy + 5}`} />
              ) : (
                <>
                  <circle cx={cx} cy={cy} r={9} />
                  <text x={cx} y={cy + 3.5} textAnchor="middle">{mk.letra ?? '•'}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="grafico-leyenda">
        <span className="leyenda-serie">{titulo}</span>
        {conRef && etiquetaReferencia && <span className="leyenda-referencia">{etiquetaReferencia}</span>}
        {conRef && <span className="leyenda-bien">{t('analisis.grafico.porEncima')}</span>}
        {conRef && <span className="leyenda-mal">{t('analisis.grafico.porDebajo')}</span>}
        {muertes.length > 0 && <span className="leyenda-muerte">{t('analisis.grafico.muerte')}</span>}
        {objetivos.some((o) => o.tono === 'aliado') && <span className="leyenda-aliado">{t('analisis.grafico.objetivoAliado')}</span>}
        {objetivos.some((o) => o.tono === 'enemigo') && <span className="leyenda-enemigo">{t('analisis.grafico.objetivoEnemigo')}</span>}
        {letrasPresentes.length > 0 && (
          <span className="leyenda-letras">
            {Object.entries(LETRA_OBJETIVO)
              .filter(([, l]) => letrasPresentes.includes(l))
              .map(([tipo, l]) => `${l} = ${t(`analisis.objetivo.${tipo}`)}`)
              .join(' · ')}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function marcasDe(e: EntradaAnalisis): Marca[] {
  return [
    ...e.objetivos
      .filter((o) => o.tipo !== 'torre' && o.tipo !== 'inhibidor')
      .map((o): Marca => ({ t: o.t, tono: o.equipo, etiqueta: t(`analisis.objetivo.${o.tipo}`), letra: LETRA_OBJETIVO[o.tipo] })),
    ...e.muertes.map((s): Marca => ({ t: s, tono: 'muerte', etiqueta: t('analisis.grafico.muerte') })),
  ];
}

/** Cifras clave del gráfico de CS: a los 10 minutos y al final, frente a la referencia de tu rol. */
function resumenCs(e: EntradaAnalisis): { texto: string; tono: 'exito' | 'error' | 'neutro' }[] {
  const ref = e.csObjetivoMinuto;
  const ultimo = e.linea.at(-1);
  if (!ultimo) return [];
  const fila: { texto: string; tono: 'exito' | 'error' | 'neutro' }[] = [];
  const en10 = e.linea.find((x) => x.m === 10);
  if (en10) {
    fila.push(
      ref
        ? { texto: t('analisis.grafico.resumen10Ref', { cs: en10.cs, ref: Math.round(10 * ref) }), tono: en10.cs >= 10 * ref * 0.95 ? 'exito' : 'error' }
        : { texto: t('analisis.grafico.resumen10', { cs: en10.cs }), tono: 'neutro' },
    );
  }
  if (ref) {
    const dif = Math.round(ultimo.cs - ultimo.m * ref);
    fila.push({
      texto: dif >= 0 ? t('analisis.grafico.resumenEncima', { n: dif }) : t('analisis.grafico.resumenDebajo', { n: -dif }),
      tono: dif >= 0 ? 'exito' : 'error',
    });
  }
  if (e.muertes.length) fila.push({ texto: t('analisis.grafico.resumenMuertes', { n: e.muertes.length }), tono: 'neutro' });
  return fila;
}

/**
 * Tarjeta «Tu partida minuto a minuto» del análisis: farmeo (CS) u oro, con su explicación, sus cifras clave y las
 * muertes y objetivos en el eje del tiempo.
 */
export function TarjetaGraficoPartida({ e, inicial }: { e: EntradaAnalisis; inicial?: 'cs' | 'oro' }) {
  const conCs = e.modo === 'clasificatoria' || e.modo === 'aram' || e.modo === 'caos';
  const [grafico, setGrafico] = useState<'cs' | 'oro'>(inicial ?? (e.modo === 'clasificatoria' ? 'cs' : 'oro'));
  const marcas = useMemo(() => marcasDe(e), [e]);
  if (e.linea.length < 2) return null;
  const serieCs = e.linea.map((x) => ({ m: x.m, v: x.cs }));
  const serieOro = e.linea.map((x) => ({ m: x.m, v: x.oro }));
  const referencia = e.csObjetivoMinuto ? e.linea.map((x) => ({ m: x.m, v: x.m * e.csObjetivoMinuto! })) : undefined;
  const oroFinal = e.linea.at(-1)!.oro;
  return (
    <Tarjeta
      titulo={t('analisis.grafico.titulo')}
      icono={<TrendingUp size={15} />}
      className="analisis-grafico"
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
          explicacion={t(referencia ? 'analisis.grafico.explicaCsRef' : 'analisis.grafico.explicaCs')}
          resumen={resumenCs(e)}
        />
      ) : (
        <GraficoLinea
          titulo={t('analisis.grafico.oro')}
          serie={serieOro}
          marcas={marcas}
          duracion={e.duracion}
          explicacion={t('analisis.grafico.explicaOro')}
          resumen={[
            { texto: t('analisis.grafico.resumenOro', { oro: numero(oroFinal) }) },
            ...(e.muertes.length ? [{ texto: t('analisis.grafico.resumenMuertes', { n: e.muertes.length }) }] : []),
          ]}
        />
      )}
    </Tarjeta>
  );
}

function Resultado({ resultado }: { resultado: EntradaAnalisis['resultado'] }) {
  if (resultado === 'victoria') return <Insignia tono="exito" icono={<Trophy size={12} />}>{t('analisis.victoria')}</Insignia>;
  if (resultado === 'derrota') return <Insignia tono="error">{t('analisis.derrota')}</Insignia>;
  return <Insignia tono="neutro">{t('analisis.sinResultado')}</Insignia>;
}

/**
 * 3.7: una sola mejora tras cada partida, convertida en reto: el reto que encaja con lo que el análisis pide mejorar
 * (muertes, CS, visión, peleas o daño) se elige con un clic y se mide partida a partida en el Perfil.
 */
function BotonRetoDelAnalisis({ e }: { e: EntradaAnalisis }) {
  const [hecho, setHecho] = useState(false);
  const reto = retoDeAnalisis([...e.analisis.mejorar.map((m) => m.titulo), e.analisis.enfoque]);
  if (!reto || !window.coach.elegirReto) return null;
  if (hecho) return <p className="analisis-reto-hecho">{t('analisis.retoElegido', { reto: t(`perfil.reto.${reto}.nombre`) })}</p>;
  return (
    <Boton variante="primario" onClick={() => void window.coach.elegirReto?.(reto).then(() => setHecho(true), () => undefined)}>
      <Target size={14} aria-hidden="true" /> {t('analisis.hacerReto', { reto: t(`perfil.reto.${reto}.nombre`) })}
    </Boton>
  );
}

/** Detalle de un análisis: cabecera con los números, veredicto, puntos, gráficos, momentos y enfoque. */
function DetalleAnalisis({ e }: { e: EntradaAnalisis }) {
  const minutos = Math.max(1, e.duracion / 60);
  const f = e.final;
  const kda = (f.k + f.a) / Math.max(1, f.d);
  const conCs = e.modo === 'clasificatoria' || e.modo === 'aram' || e.modo === 'caos';
  const subtitulo = [nombreModoAnalisis(e), e.rol ? t(`rol.${e.rol}`) : null, mmss(e.duracion)].filter(Boolean).join(' · ');
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

      <TarjetaGraficoPartida e={e} />

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
          <BotonRetoDelAnalisis e={e} />
        </Tarjeta>
      </div>
    </div>
  );
}

const ERRORES = ['no_configurado', 'limite', 'no_disponible', 'no_valido', 'sin_conexion', 'cuota'] as const;

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
      {error && (
        <Aviso tono="aviso" accion={error === 'cuota' ? <BotonMasCuota /> : undefined}>
          {t(`analisis.error.${error}`)}
        </Aviso>
      )}
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
                    <span className="historial-modo">{nombreModoAnalisis(x)}</span>
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
