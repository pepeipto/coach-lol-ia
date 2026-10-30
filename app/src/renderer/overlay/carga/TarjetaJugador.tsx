import { Info, Sparkles, Star } from 'lucide-react';
import { useId, useState } from 'react';
import { t } from '../../../shared/i18n';
import type { JugadorCarga } from '../../../shared/tiposApp';
import { IconoDDragon } from '../../comun/IconoDDragon';
import {
  partesRiotId,
  textoEtiqueta,
  textoMaestria,
  textoRango,
  textoRegistro,
  textoWinrate,
  urlEmblemaRango,
  urlsArteCampeon,
} from './formato';

const ICONO_ETIQUETA = { positivo: Sparkles, neutro: Star, info: Info } as const;

/**
 * Arte vertical del campeón con la skin elegida (el de la pantalla de carga de LoL); si la skin no tiene arte, el de
 * la clásica, y si tampoco carga, queda el degradado de la tarjeta.
 */
function ArteCampeon({ campeon, skin }: { campeon: string; skin?: number }) {
  const [fallos, setFallos] = useState<string[]>([]);
  const url = urlsArteCampeon('loading', campeon, skin).find((u) => !fallos.includes(u));
  if (!url) return null;
  return (
    <img
      key={url}
      className="cg-arte"
      src={url}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      onError={() => setFallos((f) => [...f, url])}
    />
  );
}

/** Emblema del tier; sin tier, o si no carga, la gema de color de siempre. */
function EmblemaRango({ tier }: { tier: string | null }) {
  const [fallo, setFallo] = useState(false);
  const url = tier ? urlEmblemaRango(tier) : null;
  if (!url || fallo) return <span className="cg-rango-gema" aria-hidden="true" />;
  return <img className="cg-rango-emblema" src={url} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFallo(true)} />;
}

/** Los dos hechizos de invocador, como en la pantalla de carga del juego. */
function Hechizos({ hechizos, version }: { hechizos: NonNullable<JugadorCarga['hechizos']>; version: string }) {
  return (
    <ul className="cg-hechizos" aria-label={t('carga.hechizos')}>
      {hechizos.map((h, i) => (
        <li key={`${h.id}-${i}`}>
          <IconoDDragon tipo="hechizo" id={h.id} version={version} nombre={h.nombre} imagen={h.imagen} tamano={20} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Tarjeta de un jugador en la pantalla de carga: campeón, Riot ID, rango oficial, maestría y etiquetas.
 * `grande` (3.1, pantalla completa): con el arte del campeón de fondo, como las de la pantalla de carga del juego.
 */
export function TarjetaJugador({
  jugador,
  version,
  indice = 0,
  grande = false,
}: {
  jugador: JugadorCarga;
  version: string;
  indice?: number;
  grande?: boolean;
}) {
  // Nombre visible de Data Dragon; si falta, el id (nunca un texto inventado).
  const campeon = jugador.nombre || jugador.campeon;
  const idNombre = useId();
  const [nombre, tag] = partesRiotId(jugador.riotId);
  const registro = textoRegistro(jugador.rango);
  const maestria = textoMaestria(jugador.maestria);
  const winrate = textoWinrate(jugador.campeonWinrate);
  const tier = jugador.rango?.tier.toLowerCase() ?? 'sin-rango';

  // Aún faltan datos del servidor o de Data Dragon: un estado discreto, nunca «Sin clasificar» antes de saberlo.
  const cargando = !!jugador.cargando && !jugador.rango;
  // Riot o el servidor no respondieron: no se sabe el rango (no es «Sin clasificar»).
  const sinDatosRango = !jugador.rango && !!jugador.rangoNoDisponible;
  // 3.2: un jugador oculto no tiene rango, maestría ni winrate (ni «Sin clasificar», que sería afirmar algo).
  const oculto = !!jugador.anonimo;
  return (
    <li
      className={`cg-tarjeta ${jugador.equipo}${grande ? ' grande' : ''}${jugador.propio ? ' propia' : ''}${jugador.cargando ? ' cargando' : ''}`}
      aria-busy={jugador.cargando || undefined}
      aria-labelledby={idNombre}
      style={{ animationDelay: `${indice * 45}ms` }}
    >
      {grande && <ArteCampeon campeon={jugador.campeon} skin={jugador.skin} />}
      {jugador.propio && <span className="cg-brillo" aria-hidden="true" />}
      {jugador.propio && <span className="cg-tu">{t('carga.tu')}</span>}
      <div className="cg-cabecera">
        {grande ? (
          jugador.rol && <span className="cg-rol">{t(`rol.${jugador.rol}`)}</span>
        ) : (
          <div className="cg-retrato">
            <IconoDDragon tipo="campeon" id={jugador.campeon} version={version} nombre={campeon} tamano={56} />
            {jugador.rol && <span className="cg-rol">{t(`rol.${jugador.rol}`)}</span>}
          </div>
        )}
        <div className="cg-identidad">
          {/* 3.8: en el modo streamer el nombre ya es el del campeón: no se repite. */}
          {grande && !jugador.streamer && <p className="cg-campeon-grande">{campeon}</p>}
          <p className="cg-nombre" id={idNombre} title={jugador.riotId || undefined}>
            {nombre ? (
              <>
                <span className="cg-nombre-texto">{nombre}</span>
                {tag && <span className="cg-tag">{tag}</span>}
              </>
            ) : (
              <span className="cg-nombre-texto anonimo">{t('carga.sinNombre')}</span>
            )}
          </p>
          {!grande && !jugador.streamer && <p className="cg-campeon">{campeon}</p>}
        </div>
        {jugador.hechizos && jugador.hechizos.length > 0 && version && <Hechizos hechizos={jugador.hechizos} version={version} />}
      </div>

      {oculto ? null : cargando ? (
        <div className="cg-rango cg-pendiente" role="status">
          <span className="cg-pendiente-punto" aria-hidden="true" />
          <span className="cg-rango-texto">{t('carga.cargandoDatos')}</span>
        </div>
      ) : sinDatosRango ? (
        <div className="cg-rango tier-sin-rango cg-no-disponible" title={t('carga.rango')}>
          <span className="cg-rango-gema" aria-hidden="true" />
          <span className="cg-rango-texto">{t('carga.rangoNoDisponible')}</span>
        </div>
      ) : (
        <div className={`cg-rango tier-${tier}`} title={t('carga.rango')}>
          <EmblemaRango tier={jugador.rango?.tier ?? null} />
          <span className="cg-rango-texto">{textoRango(jugador.rango)}</span>
          {registro && <span className="cg-registro">{registro}</span>}
        </div>
      )}

      {!oculto && (maestria || winrate || grande) && (
        <dl className="cg-datos">
          {maestria && (
            <div className="cg-dato">
              <dt className="cg-oculto">{t('carga.maestriaTitulo')}</dt>
              <dd>{maestria}</dd>
            </div>
          )}
          {winrate && (
            <div className="cg-dato winrate" title={t('carga.winrateCampeon')}>
              <dt className="cg-oculto">{t('carga.winrateCampeon')}</dt>
              <dd>{winrate}</dd>
            </div>
          )}
        </dl>
      )}

      {!oculto && (jugador.etiquetas.length > 0 || grande) && (
        <ul className="cg-etiquetas" aria-label={t('carga.etiquetas')} aria-hidden={jugador.etiquetas.length === 0 || undefined}>
          {jugador.etiquetas.slice(0, grande ? 2 : 3).map((e) => {
            const Icono = ICONO_ETIQUETA[e.tipo] ?? Info;
            return (
              <li key={e.texto} className={`cg-etiqueta ${e.tipo}`}>
                <Icono size={12} aria-hidden="true" />
                <span>{textoEtiqueta(e, jugador.nombre)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
