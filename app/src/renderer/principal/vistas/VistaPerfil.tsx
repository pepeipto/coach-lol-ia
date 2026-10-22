import { Award, BarChart3, BrainCircuit, Camera, ChevronLeft, Flame, History, Loader2, RefreshCw, ShieldCheck, Swords, Target, TrendingDown, TrendingUp, Trophy, User } from 'lucide-react';
import type { MensajePersonal } from '@coach/shared';
import type { EntradaAnalisis } from '../../../shared/tiposApp';
import { useEffect, useMemo, useState } from 'react';
import { localeActual, t } from '../../../shared/i18n';
import type { EstadoReto, EventoLinea, IdReto, JugadorHistorial, LineaTiempo, PartidaHistorial, Perfil, PuntoPl, RangoCola, Tendencia } from '../../../shared/perfil';
import { Aviso, Boton, clases, Insignia, Tarjeta } from '../../comun/componentes';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { CabeceraVista } from './CabeceraVista';
import { EstadoVacio } from './EstadoVacio';
import { GraficoLinea, mmss } from './VistaAnalisis';
import { TarjetaCoach } from './TarjetaCoach';
import './perfil.css';

/*
 * 3.5: vista «Perfil» (como el perfil de Blitz y el dashboard de Game Coach): rango y gráfica de PL, reto de práctica,
 * tendencias, campeones e historial con el detalle de cada partida (10 jugadores, puntuaciones, etiquetas y gráficas).
 * Todo sale del cliente de LoL y se guarda solo en este PC.
 */

const numero = (n: number, decimales = 0) => n.toLocaleString(localeActual(), { maximumFractionDigits: decimales, minimumFractionDigits: decimales });
const porcentaje = (n: number) => t('formato.porcentaje', { n: Math.round(n * 100) });
const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(localeActual(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const EMBLEMA = (tier: string) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
const ICONO_PERFIL = (version: string, id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`;
const RETOS: IdReto[] = ['muertes4', 'kp50', 'cs7', 'cs8', 'vision1', 'dano25', 'puntuacion60', 'victorias3'];

/** Nota de 0 a 100 con su color (verde ≥ 70, dorado ≥ 50, neutro por debajo: nunca rojo). */
export function Nota({ valor, grande = false }: { valor: number; grande?: boolean }) {
  const tono = valor >= 70 ? 'alta' : valor >= 50 ? 'media' : 'baja';
  return (
    <span className={clases('nota-perfil', `nota-${tono}`, grande && 'grande')} title={t('perfil.nota.titulo')}>
      {Math.round(valor)}
    </span>
  );
}

function nombreCampeon(p: Perfil, id: number) {
  return p.campeonesDD[id]?.nombre ?? String(id);
}

function IconoCampeon({ p, id, tamano = 32 }: { p: Perfil; id: number; tamano?: number }) {
  const dd = p.campeonesDD[id];
  return <IconoDDragon tipo="campeon" id={dd?.id ?? ''} version={p.version} nombre={dd?.nombre ?? String(id)} tamano={tamano} />;
}

function TarjetaRango({ r }: { r: RangoCola }) {
  const partidas = r.victorias + r.derrotas;
  return (
    <div className="perfil-rango">
      {r.tier ? <span className="perfil-emblema" style={{ backgroundImage: `url(${EMBLEMA(r.tier)})` }} aria-hidden="true" /> : <span className="perfil-rango-vacio" aria-hidden="true" />}
      <div>
        <span className="perfil-rango-cola">{t(`perfil.cola.${r.cola}`)}</span>
        <strong>{r.tier ? `${t(`carga.tier.${r.tier}`)} ${r.division}`.trim() : t('perfil.sinClasificar')}</strong>
        {r.tier && <span className="perfil-rango-lp">{t('perfil.lp', { n: r.lp })}</span>}
        {partidas > 0 && (
          <span className="texto-secundario">
            {t('perfil.victoriasDerrotas', { v: r.victorias, d: r.derrotas })} · {porcentaje(r.victorias / partidas)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Gráfica de PL de Solo/Dúo (cada punto es el rango tras una partida). */
function GraficoPl({ puntos }: { puntos: PuntoPl[] }) {
  const ancho = 1000;
  const alto = 150;
  const m = { izq: 10, der: 10, arr: 14, aba: 14 };
  const min = Math.min(...puntos.map((p) => p.valor));
  const max = Math.max(...puntos.map((p) => p.valor));
  const rango = Math.max(40, max - min);
  const x = (i: number) => m.izq + (i / Math.max(1, puntos.length - 1)) * (ancho - m.izq - m.der);
  const y = (v: number) => alto - m.aba - ((v - min) / rango) * (alto - m.arr - m.aba);
  const camino = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  return (
    <figure className="grafico-analisis grafico-pl">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={t('perfil.pl.desc')}>
        <path className="grafico-serie" d={camino} />
        {puntos.map((p, i) => (
          <circle key={i} className="grafico-punto" cx={x(i)} cy={y(p.valor)} r={3.5}>
            <title>{`${fechaCorta(p.fecha)} · ${t(`carga.tier.${p.tier}`)} ${p.division} · ${t('perfil.lp', { n: p.lp })}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

function TarjetaReto({ reto, sugerido, alElegir }: { reto: EstadoReto | null; sugerido: IdReto; alElegir: (id: IdReto | null) => void }) {
  const [eligiendo, setEligiendo] = useState(false);
  if (reto && !eligiendo) {
    return (
      <Tarjeta
        titulo={t('perfil.reto.titulo')}
        icono={<Target size={15} />}
        className={clases('perfil-reto', reto.completado && 'completado')}
        extra={
          <Boton variante="fantasma" onClick={() => setEligiendo(true)}>
            {t('perfil.reto.cambiar')}
          </Boton>
        }
      >
        <p className="perfil-reto-nombre">
          {reto.completado && <Trophy size={16} aria-hidden="true" />} {t(`perfil.reto.${reto.id}.nombre`)}
        </p>
        <p className="texto-secundario">{t(`perfil.reto.${reto.id}.desc`)}</p>
        <div className="perfil-reto-barra" role="progressbar" aria-label={t('perfil.reto.titulo')} aria-valuemin={0} aria-valuemax={reto.objetivo} aria-valuenow={reto.hechas}>
          <span style={{ width: `${(reto.hechas / reto.objetivo) * 100}%` }} />
        </div>
        <div className="perfil-reto-pie">
          <span>{t('perfil.reto.progreso', { hechas: reto.hechas, objetivo: reto.objetivo })}</span>
          {reto.racha > 0 && (
            <span className="perfil-reto-racha">
              <Flame size={14} aria-hidden="true" /> {t('perfil.reto.racha', { n: reto.racha })}
            </span>
          )}
          <span className="perfil-reto-puntos" aria-label={t('perfil.reto.ultimas')}>
            {reto.ultimas.map((ok, i) => (
              <i key={i} className={ok ? 'ok' : 'no'} />
            ))}
          </span>
        </div>
        {reto.completado && <Aviso tono="exito">{t('perfil.reto.completado')}</Aviso>}
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo={t('perfil.reto.elegir')} icono={<Target size={15} />} className="perfil-reto">
      <p className="texto-secundario">{t('perfil.reto.explicacion')}</p>
      <ul className="perfil-retos">
        {RETOS.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={clases('perfil-reto-opcion', id === sugerido && 'sugerido', reto?.id === id && 'activo')}
              onClick={() => {
                setEligiendo(false);
                alElegir(id);
              }}
            >
              <strong>{t(`perfil.reto.${id}.nombre`)}</strong>
              <span>{t(`perfil.reto.${id}.desc`)}</span>
              {id === sugerido && <Insignia tono="oro">{t('perfil.reto.sugerido')}</Insignia>}
            </button>
          </li>
        ))}
      </ul>
      {reto && (
        <Boton variante="fantasma" onClick={() => setEligiendo(false)}>
          {t('perfil.reto.volver')}
        </Boton>
      )}
    </Tarjeta>
  );
}

function valorTendencia(td: Tendencia): string {
  switch (td.id) {
    case 'kp':
    case 'dano':
      return porcentaje(td.valor);
    case 'csMin':
    case 'vision':
      return numero(td.valor, 1);
    default:
      return numero(td.valor, td.id === 'muertes' ? 1 : 0);
  }
}

function TarjetaTendencias({ tendencias }: { tendencias: Tendencia[] }) {
  if (!tendencias.length) return null;
  return (
    <Tarjeta titulo={t('perfil.tendencias.titulo')} icono={<TrendingUp size={15} />} extra={<span className="texto-secundario">{t('perfil.tendencias.ultimas')}</span>}>
      <ul className="perfil-tendencias">
        {tendencias.map((td) => {
          const mejora = td.cambio !== null && td.cambio !== 0 ? td.cambio > 0 === td.mejorSiSube : null;
          const cambio = td.cambio === null ? null : td.id === 'kp' || td.id === 'dano' ? porcentaje(Math.abs(td.cambio)) : numero(Math.abs(td.cambio), 1);
          return (
            <li key={td.id}>
              <span className="perfil-tendencia-nombre">{t(`perfil.tendencia.${td.id}`)}</span>
              <strong>{valorTendencia(td)}</strong>
              {cambio !== null && mejora !== null && (
                <span className={clases('perfil-tendencia-cambio', mejora ? 'mejora' : 'empeora')}>
                  {td.cambio! > 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
                  {td.cambio! > 0 ? '+' : '−'}
                  {cambio}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

function FilaPartida({ p, perfil, alAbrir }: { p: PartidaHistorial; perfil: Perfil; alAbrir: () => void }) {
  const yo = p.jugadores.find((j) => j.participante === p.yo)!;
  const min = Math.max(1, p.duracion / 60);
  return (
    <li>
      <button type="button" className={clases('perfil-partida', p.rehecha ? 'rehecha' : p.victoria ? 'victoria' : 'derrota')} onClick={alAbrir}>
        <IconoCampeon p={perfil} id={yo.campeonId} tamano={40} />
        <span className="perfil-partida-resultado">
          <strong>{p.rehecha ? t('perfil.rehecha') : p.victoria ? t('analisis.victoria') : t('analisis.derrota')}</strong>
          <span>{p.modo === 'otro' ? t('perfil.modoOtro') : t(`modo.${p.modo}`)}</span>
        </span>
        <span className="perfil-partida-kda">
          <strong>
            {yo.asesinatos}/{yo.muertes}/{yo.asistencias}
          </strong>
          <span>{t('perfil.csMin', { n: numero(yo.cs / min, 1) })}</span>
        </span>
        <span className="perfil-partida-objetos" aria-hidden="true">
          {yo.objetos.slice(0, 7).map((o, i) => (
            <IconoDDragon key={i} tipo="objeto" id={o} version={perfil.version} nombre="" tamano={22} />
          ))}
        </span>
        <span className="perfil-partida-etiquetas">
          {yo.etiquetas.slice(0, 2).map((e) => (
            <span key={e} className={clases('etiqueta-perfil', e === 'mvp' && 'mvp')}>
              {t(`perfil.etiqueta.${e}`)}
            </span>
          ))}
        </span>
        <Nota valor={yo.puntuaciones.total} />
        <span className="perfil-partida-fecha">
          {fechaCorta(p.fecha)}
          <span>{mmss(p.duracion)}</span>
        </span>
      </button>
    </li>
  );
}

function TablaEquipo({ p, perfil, equipo }: { p: PartidaHistorial; perfil: Perfil; equipo: 100 | 200 }) {
  const jugadores = p.jugadores.filter((j) => j.equipo === equipo);
  const gano = jugadores[0]?.victoria ?? false;
  const maxDano = Math.max(1, ...p.jugadores.map((j) => j.dano));
  const min = Math.max(1, p.duracion / 60);
  return (
    <div className={clases('perfil-equipo', gano ? 'victoria' : 'derrota')}>
      <h4>
        {t(equipo === 100 ? 'perfil.equipoAzul' : 'perfil.equipoRojo')} · {gano ? t('analisis.victoria') : t('analisis.derrota')}
      </h4>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('perfil.col.jugador')}</th>
            <th scope="col">{t('analisis.stat.kda')}</th>
            <th scope="col">{t('analisis.stat.cs')}</th>
            <th scope="col">{t('perfil.col.oro')}</th>
            <th scope="col">{t('analisis.stat.dano')}</th>
            {p.modo === 'clasificatoria' && <th scope="col">{t('analisis.stat.vision')}</th>}
            <th scope="col">{t('perfil.col.nota')}</th>
          </tr>
        </thead>
        <tbody>
          {jugadores.map((j) => (
            <tr key={j.participante} className={j.participante === p.yo ? 'yo' : undefined}>
              <td className="perfil-jugador">
                <IconoCampeon p={perfil} id={j.campeonId} tamano={28} />
                <span>
                  <strong>{j.nombre || nombreCampeon(perfil, j.campeonId)}</strong>
                  <span className="perfil-jugador-etiquetas">
                    {j.etiquetas.map((e) => (
                      <span key={e} className={clases('etiqueta-perfil', e === 'mvp' && 'mvp')}>
                        {t(`perfil.etiqueta.${e}`)}
                      </span>
                    ))}
                  </span>
                </span>
              </td>
              <td>
                {j.asesinatos}/{j.muertes}/{j.asistencias}
              </td>
              <td>
                {j.cs} <small>{numero(j.cs / min, 1)}</small>
              </td>
              <td>{numero(j.oro / 1000, 1)}k</td>
              <td className="perfil-dano">
                <span>{numero(j.dano)}</span>
                <i style={{ width: `${(j.dano / maxDano) * 100}%` }} />
              </td>
              {p.modo === 'clasificatoria' && <td>{j.vision}</td>}
              <td>
                <Nota valor={j.puntuaciones.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Gráfica de la ventaja de oro del equipo (positiva arriba, negativa abajo) con los objetivos. */
function GraficoVentaja({ serie, eventos, equipo, duracion }: { serie: { m: number; v: number }[]; eventos: EventoLinea[]; equipo: 100 | 200; duracion: number }) {
  const ancho = 640;
  const alto = 190;
  const m = { izq: 48, der: 12, arr: 12, aba: 26 };
  const minutos = Math.max(1, duracion / 60, ...serie.map((p) => p.m));
  const maxAbs = Math.max(1000, ...serie.map((p) => Math.abs(p.v)));
  const x = (min: number) => m.izq + (min / minutos) * (ancho - m.izq - m.der);
  const y = (v: number) => m.arr + ((maxAbs - v) / (2 * maxAbs)) * (alto - m.arr - m.aba);
  const camino = serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const objetivos = eventos.filter((e) => e.tipo !== 'asesinato' && e.tipo !== 'torre');
  return (
    <figure className="grafico-analisis">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={t('perfil.grafico.ventajaDesc')}>
        <defs>
          <clipPath id="ventaja-arriba">
            <rect x={0} y={0} width={ancho} height={y(0)} />
          </clipPath>
          <clipPath id="ventaja-abajo">
            <rect x={0} y={y(0)} width={ancho} height={alto} />
          </clipPath>
        </defs>
        {[maxAbs, 0, -maxAbs].map((v) => (
          <g key={v}>
            <line className="grafico-rejilla" x1={m.izq} x2={ancho - m.der} y1={y(v)} y2={y(v)} />
            <text className="grafico-eje" x={m.izq - 6} y={y(v) + 4} textAnchor="end">
              {v > 0 ? '+' : ''}
              {numero(v / 1000, 1)}k
            </text>
          </g>
        ))}
        {serie.length > 1 && (
          <>
            <path className="ventaja-area positiva" clipPath="url(#ventaja-arriba)" d={`${camino} L${x(serie.at(-1)!.m)},${y(0)} L${x(serie[0]!.m)},${y(0)} Z`} />
            <path className="ventaja-area negativa" clipPath="url(#ventaja-abajo)" d={`${camino} L${x(serie.at(-1)!.m)},${y(0)} L${x(serie[0]!.m)},${y(0)} Z`} />
            <path className="grafico-serie" d={camino} />
          </>
        )}
        {objetivos.map((e, i) => (
          <g key={i} className={`grafico-marca marca-${e.equipo === equipo ? 'aliado' : 'enemigo'}`}>
            <title>{`${mmss(e.t)} · ${t(`perfil.evento.${e.tipo}`)}`}</title>
            <line x1={x(e.t / 60)} x2={x(e.t / 60)} y1={m.arr} y2={alto - m.aba} />
            <circle cx={x(e.t / 60)} cy={alto - m.aba} r={3.5} />
          </g>
        ))}
      </svg>
      <figcaption className="grafico-leyenda">
        <span className="leyenda-serie">{t('perfil.grafico.ventaja')}</span>
        <span className="leyenda-aliado">{t('analisis.grafico.objetivoAliado')}</span>
        <span className="leyenda-enemigo">{t('analisis.grafico.objetivoEnemigo')}</span>
      </figcaption>
    </figure>
  );
}

/** Rival de línea: el del otro equipo con el mismo rol. */
function rivalDe(p: PartidaHistorial, yo: JugadorHistorial): JugadorHistorial | null {
  if (!yo.rol) return null;
  return p.jugadores.find((j) => j.equipo !== yo.equipo && j.rol === yo.rol) ?? null;
}

function Graficas({ p, perfil }: { p: PartidaHistorial; perfil: Perfil }) {
  const [linea, setLinea] = useState<LineaTiempo | null | 'cargando'>('cargando');
  const [serie, setSerie] = useState<'oro' | 'cs' | 'xp'>('oro');
  useEffect(() => {
    let vivo = true;
    setLinea('cargando');
    void window.coach.lineaTiempo?.(p.id).then(
      (l) => vivo && setLinea(l),
      () => vivo && setLinea(null),
    );
    return () => {
      vivo = false;
    };
  }, [p.id]);
  const yo = p.jugadores.find((j) => j.participante === p.yo)!;
  const rival = rivalDe(p, yo);
  if (linea === 'cargando')
    return (
      <p className="texto-secundario">
        <Loader2 size={14} className="girando" aria-hidden="true" /> {t('perfil.grafico.cargando')}
      </p>
    );
  if (!linea) return <Aviso tono="info">{t('perfil.grafico.sinDatos')}</Aviso>;
  const de = (eq: 100 | 200, m: LineaTiempo['minutos'][number]) =>
    p.jugadores.filter((j) => j.equipo === eq).reduce((s, j) => s + (m.oro[j.participante] ?? 0), 0);
  const ventaja = linea.minutos.map((m) => ({ m: m.m, v: de(yo.equipo, m) - de(yo.equipo === 100 ? 200 : 100, m) }));
  const mia = linea.minutos.map((m) => ({ m: m.m, v: m[serie][p.yo] ?? 0 }));
  const suya = rival ? linea.minutos.map((m) => ({ m: m.m, v: m[serie][rival.participante] ?? 0 })) : undefined;
  const a14 = linea.minutos.find((m) => m.m === 14);
  const muertes = linea.eventos.filter((e) => e.tipo === 'asesinato' && e.victima === p.yo);
  return (
    <div className="perfil-graficas">
      {rival && a14 && (
        <div className="perfil-foto14" aria-label={t('perfil.foto14.aria')}>
          <h4>
            <Camera size={14} aria-hidden="true" /> {t('perfil.foto14.titulo', { rival: nombreCampeon(perfil, rival.campeonId) })}
          </h4>
          <ul>
            {(['oro', 'cs', 'xp'] as const).map((k) => {
              const d = (a14[k][p.yo] ?? 0) - (a14[k][rival.participante] ?? 0);
              return (
                <li key={k} className={d > 0 ? 'ventaja' : d < 0 ? 'desventaja' : undefined}>
                  <span>{t(`perfil.foto14.${k}`)}</span>
                  <strong>
                    {d > 0 ? '+' : d < 0 ? '−' : ''}
                    {numero(Math.abs(d))}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <GraficoVentaja serie={ventaja} eventos={linea.eventos} equipo={yo.equipo} duracion={p.duracion} />
      <div className="analisis-selector" role="group" aria-label={t('perfil.grafico.serie')}>
        {(['oro', 'cs', 'xp'] as const).map((s) => (
          <button key={s} type="button" className={clases('chip', serie === s && 'activo')} aria-pressed={serie === s} onClick={() => setSerie(s)}>
            {t(`perfil.foto14.${s}`)}
          </button>
        ))}
      </div>
      <GraficoLinea
        titulo={t('perfil.grafico.tuyo', { serie: t(`perfil.foto14.${serie}`) })}
        serie={mia}
        referencia={suya}
        etiquetaReferencia={rival ? t('perfil.grafico.rival', { campeon: nombreCampeon(perfil, rival.campeonId) }) : undefined}
        marcas={muertes.map((e) => ({ t: e.t, tono: 'muerte' as const, etiqueta: t('analisis.grafico.muerte') }))}
        duracion={p.duracion}
      />
    </div>
  );
}

/**
 * 3.6: el análisis con IA de esta partida, si lo hay. Los dos historiales se emparejan por campeón y hora: el análisis
 * se hace al terminar la partida (inicio + duración), así que debe caer como mucho 20 min después.
 */
export function analisisDePartida(p: PartidaHistorial, perfil: Perfil, analisis: EntradaAnalisis[]): EntradaAnalisis | null {
  const yo = p.jugadores.find((j) => j.participante === p.yo);
  const id = yo ? perfil.campeonesDD[yo.campeonId]?.id : undefined;
  if (!id) return null;
  const fin = new Date(p.fecha).getTime() + p.duracion * 1000;
  return analisis.find((a) => a.campeon.toLowerCase() === id.toLowerCase() && Math.abs(new Date(a.fecha).getTime() - fin) <= 20 * 60_000) ?? null;
}

function AnalisisDePartida({ e }: { e: EntradaAnalisis }) {
  return (
    <div className="perfil-analisis">
      <Tarjeta titulo={t('analisis.veredicto')} icono={<BrainCircuit size={15} />} className="analisis-veredicto">
        <p>{e.analisis.veredicto}</p>
      </Tarjeta>
      <div className="analisis-columnas">
        <Tarjeta titulo={t('analisis.bien')} className="analisis-bien">
          <ul className="analisis-puntos">
            {e.analisis.bien.map((x, i) => (
              <li key={i}>
                <strong>{x.titulo}</strong>
                <span>{x.porque}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo={t('analisis.mejorar')} className="analisis-mejorar">
          <ul className="analisis-puntos">
            {e.analisis.mejorar.map((x, i) => (
              <li key={i}>
                <strong>{x.titulo}</strong>
                <span>{x.porque}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <Tarjeta titulo={t('analisis.enfoque')} className="analisis-enfoque">
        <p>{e.analisis.enfoque}</p>
      </Tarjeta>
    </div>
  );
}

type Pestana = 'resumen' | 'graficas' | 'analisis';

function DetallePartida({ p, perfil, analisis, alVolver }: { p: PartidaHistorial; perfil: Perfil; analisis: EntradaAnalisis | null; alVolver: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const pestanas: Pestana[] = analisis ? ['resumen', 'graficas', 'analisis'] : ['resumen', 'graficas'];
  // Pestañas accesibles: flechas izquierda/derecha para cambiar (patrón ARIA de pestañas).
  const conTeclado = (ev: React.KeyboardEvent) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const i = pestanas.indexOf(pestana);
    const siguiente = pestanas[(i + (ev.key === 'ArrowRight' ? 1 : pestanas.length - 1)) % pestanas.length]!;
    setPestana(siguiente);
    document.getElementById(`perfil-pestana-${siguiente}`)?.focus();
  };
  const yo = p.jugadores.find((j) => j.participante === p.yo)!;
  const notas = yo.puntuaciones;
  return (
    <div className="perfil-detalle">
      <Boton variante="fantasma" onClick={alVolver}>
        <ChevronLeft size={15} aria-hidden="true" /> {t('perfil.volver')}
      </Boton>
      <section className={clases('analisis-cabecera', 'perfil-detalle-cabecera', p.victoria ? 'victoria' : 'derrota')}>
        <div className="analisis-campeon">
          <IconoCampeon p={perfil} id={yo.campeonId} tamano={56} />
          <div>
            <h2 className="analisis-campeon-nombre">
              {nombreCampeon(perfil, yo.campeonId)}{' '}
              {p.victoria ? <Insignia tono="exito" icono={<Trophy size={12} />}>{t('analisis.victoria')}</Insignia> : <Insignia tono="error">{t('analisis.derrota')}</Insignia>}
            </h2>
            <p className="texto-secundario">
              {[p.modo === 'otro' ? t('perfil.modoOtro') : t(`modo.${p.modo}`), yo.rol ? t(`rol.${yo.rol}`) : null, mmss(p.duracion), fechaCorta(p.fecha)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <dl className="perfil-notas">
          <div>
            <dt>{t('perfil.nota.total')}</dt>
            <dd>
              <Nota valor={notas.total} grande />
            </dd>
          </div>
          <div>
            <dt>{t('perfil.nota.combate')}</dt>
            <dd>
              <Nota valor={notas.combate} />
            </dd>
          </div>
          <div>
            <dt>{t('perfil.nota.farmeo')}</dt>
            <dd>
              <Nota valor={notas.farmeo} />
            </dd>
          </div>
          {p.modo === 'clasificatoria' && (
            <div>
              <dt>{t('perfil.nota.vision')}</dt>
              <dd>
                <Nota valor={notas.vision} />
              </dd>
            </div>
          )}
        </dl>
      </section>
      <div className="analisis-selector" role="tablist" aria-label={t('perfil.partida')} onKeyDown={conTeclado}>
        {pestanas.map((id) => (
          <button
            key={id}
            id={`perfil-pestana-${id}`}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            aria-controls="perfil-panel"
            tabIndex={pestana === id ? 0 : -1}
            className={clases('chip', pestana === id && 'activo')}
            onClick={() => setPestana(id)}
          >
            {t(`perfil.pestana.${id}`)}
          </button>
        ))}
      </div>
      <div id="perfil-panel" role="tabpanel" aria-labelledby={`perfil-pestana-${pestana}`}>
        {pestana === 'resumen' ? (
          <div className="perfil-equipos">
            <TablaEquipo p={p} perfil={perfil} equipo={yo.equipo} />
            <TablaEquipo p={p} perfil={perfil} equipo={yo.equipo === 100 ? 200 : 100} />
          </div>
        ) : pestana === 'analisis' && analisis ? (
          <AnalisisDePartida e={analisis} />
        ) : (
          <Tarjeta titulo={t('perfil.pestana.graficas')} icono={<BarChart3 size={15} />}>
            <Graficas p={p} perfil={perfil} />
          </Tarjeta>
        )}
      </div>
      <p className="texto-secundario perfil-nota-explicacion">{t('perfil.nota.explicacion')}</p>
    </div>
  );
}

export function VistaPerfil({ coach }: { coach?: { mensajes: MensajePersonal[]; alCambiarMensajes: (m: MensajePersonal[]) => void } } = {}) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [fallo, setFallo] = useState(false);
  const [analisis, setAnalisis] = useState<EntradaAnalisis[]>([]);
  const [actualizando, setActualizando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    void window.coach.perfil?.(false).then(
      (p) => vivo && setPerfil(p),
      () => vivo && setFallo(true),
    );
    void window.coach.historialAnalisis?.().then((l) => vivo && setAnalisis(l), () => undefined);
    const quitar = window.coach.alPerfil?.((p) => setPerfil(p));
    return () => {
      vivo = false;
      quitar?.();
    };
  }, []);

  const actualizar = () => {
    setActualizando(true);
    void window.coach
      .perfil?.(true)
      .then(setPerfil, () => undefined)
      .finally(() => setActualizando(false));
  };
  const elegirReto = (id: IdReto | null) => void window.coach.elegirReto?.(id).then(setPerfil, () => undefined);
  const plSolo = useMemo(() => perfil?.pl.filter((x) => x.cola === 'solo') ?? [], [perfil]);
  const partida = perfil?.partidas.find((x) => x.id === abierta) ?? null;

  if (!perfil)
    return (
      <div className="vista-ajustes vista-perfil" aria-busy={!fallo}>
        {fallo ? (
          <EstadoVacio icono={<User size={28} />} titulo={t('perfil.error.titulo')} descripcion={t('perfil.error.desc')} tono="error" />
        ) : (
          <p className="texto-secundario">
            <Loader2 size={14} className="girando" aria-hidden="true" /> {t('perfil.cargando')}
          </p>
        )}
      </div>
    );
  const vacio = !perfil.invocador && !perfil.partidas.length;

  return (
    <div className="vista-ajustes vista-perfil">
      <CabeceraVista
        titulo={t('perfil.titulo')}
        descripcion={t('perfil.desc')}
        extra={
          <Boton variante="secundario" onClick={actualizar} disabled={actualizando || !perfil.conectado}>
            <RefreshCw size={14} className={actualizando ? 'girando' : undefined} aria-hidden="true" /> {t('perfil.actualizar')}
          </Boton>
        }
      />
      {!perfil.conectado && !vacio && (
        <Aviso tono="info">{perfil.actualizado ? t('perfil.guardado', { fecha: fechaCorta(perfil.actualizado) }) : t('perfil.abreCliente')}</Aviso>
      )}
      {vacio && <EstadoVacio icono={<User size={28} />} titulo={t('perfil.vacio.titulo')} descripcion={t(perfil.conectado ? 'perfil.vacio.cargando' : 'perfil.vacio.desc')} />}
      {partida ? (
        <DetallePartida p={partida} perfil={perfil} analisis={analisisDePartida(partida, perfil, analisis)} alVolver={() => setAbierta(null)} />
      ) : (
        !vacio && (
          <>
            <section className="perfil-cabecera">
              {perfil.invocador && (
                <div className="perfil-invocador">
                  {perfil.version ? <img src={ICONO_PERFIL(perfil.version, perfil.invocador.icono)} alt="" width={72} height={72} /> : null}
                  <div>
                    <h2>
                      {perfil.invocador.nombre}
                      {perfil.invocador.tag && <span className="perfil-tag">#{perfil.invocador.tag}</span>}
                    </h2>
                    <span className="texto-secundario">{t('perfil.nivel', { n: perfil.invocador.nivel })}</span>
                  </div>
                </div>
              )}
              <div className="perfil-rangos">
                {perfil.rangos.map((r) => (
                  <TarjetaRango key={r.cola} r={r} />
                ))}
              </div>
            </section>
            {plSolo.length >= 2 && (
              <Tarjeta titulo={t('perfil.pl.titulo')} icono={<Award size={15} />}>
                <GraficoPl puntos={plSolo} />
              </Tarjeta>
            )}
            <TarjetaCoach hayPartidas={perfil.partidas.length > 0} mensajes={coach?.mensajes} alCambiarMensajes={coach?.alCambiarMensajes} />
            <div className="analisis-columnas">
              <TarjetaReto reto={perfil.reto} sugerido={perfil.retoSugerido} alElegir={elegirReto} />
              <TarjetaTendencias tendencias={perfil.tendencias} />
            </div>
            {perfil.campeones.length > 0 && (
              <Tarjeta titulo={t('perfil.campeones.titulo')} icono={<Swords size={15} />}>
                <ul className="perfil-campeones">
                  {perfil.campeones.slice(0, 8).map((c) => (
                    <li key={c.campeonId}>
                      <IconoCampeon p={perfil} id={c.campeonId} tamano={36} />
                      <span className="perfil-campeon-nombre">
                        <strong>{nombreCampeon(perfil, c.campeonId)}</strong>
                        <span>{t('perfil.campeones.partidas', { n: c.partidas })}</span>
                      </span>
                      <span>{porcentaje(c.victorias / c.partidas)}</span>
                      <span>{t('perfil.campeones.kda', { n: numero(c.kda, 1) })}</span>
                      <span>{t('perfil.csMin', { n: numero(c.csMin, 1) })}</span>
                      <Nota valor={c.puntuacion} />
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            )}
            <Tarjeta titulo={t('perfil.historial.titulo')} icono={<History size={15} />}>
              {perfil.partidas.length ? (
                <ul className="perfil-partidas">
                  {perfil.partidas.map((p) => (
                    <FilaPartida key={p.id} p={p} perfil={perfil} alAbrir={() => setAbierta(p.id)} />
                  ))}
                </ul>
              ) : (
                <p className="texto-secundario">{t('perfil.historial.vacio')}</p>
              )}
            </Tarjeta>
          </>
        )
      )}
      <p className="nota-privacidad-ia">
        <ShieldCheck size={14} aria-hidden="true" /> {t('perfil.privacidad')}
      </p>
    </div>
  );
}
