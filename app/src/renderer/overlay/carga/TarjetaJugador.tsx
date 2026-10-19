import { Info, Sparkles, Star } from 'lucide-react';
import { useId } from 'react';
import { t } from '../../../shared/i18n';
import type { JugadorCarga } from '../../../shared/tiposApp';
import { IconoDDragon } from '../../comun/IconoDDragon';
import { partesRiotId, textoMaestria, textoRango, textoRegistro, textoWinrate } from './formato';

const ICONO_ETIQUETA = { positivo: Sparkles, neutro: Star, info: Info } as const;

/** Tarjeta de un jugador en la pantalla de carga: campeón, Riot ID, rango oficial, maestría y etiquetas. */
export function TarjetaJugador({ jugador, version, indice = 0 }: { jugador: JugadorCarga; version: string; indice?: number }) {
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
  return (
    <li
      className={`cg-tarjeta ${jugador.equipo}${jugador.cargando ? ' cargando' : ''}`}
      aria-busy={jugador.cargando || undefined}
      aria-labelledby={idNombre}
      style={{ animationDelay: `${indice * 45}ms` }}
    >
      <div className="cg-cabecera">
        <div className="cg-retrato">
          <IconoDDragon tipo="campeon" id={jugador.campeon} version={version} nombre={campeon} tamano={56} />
          {jugador.rol && <span className="cg-rol">{t(`rol.${jugador.rol}`)}</span>}
        </div>
        <div className="cg-identidad">
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
          <p className="cg-campeon">{campeon}</p>
        </div>
      </div>

      {cargando ? (
        <div className="cg-rango cg-pendiente" role="status">
          <span className="cg-pendiente-punto" aria-hidden="true" />
          <span className="cg-rango-texto">{t('carga.cargandoDatos')}</span>
        </div>
      ) : (
        <div className={`cg-rango tier-${tier}`} title={t('carga.rango')}>
          <span className="cg-rango-gema" aria-hidden="true" />
          <span className="cg-rango-texto">{textoRango(jugador.rango)}</span>
          {registro && <span className="cg-registro">{registro}</span>}
        </div>
      )}

      {(maestria || winrate) && (
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

      {jugador.etiquetas.length > 0 && (
        <ul className="cg-etiquetas" aria-label={t('carga.etiquetas')}>
          {jugador.etiquetas.slice(0, 3).map((e) => {
            const Icono = ICONO_ETIQUETA[e.tipo] ?? Info;
            return (
              <li key={e.texto} className={`cg-etiqueta ${e.tipo}`}>
                <Icono size={12} aria-hidden="true" />
                <span>{e.texto}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
