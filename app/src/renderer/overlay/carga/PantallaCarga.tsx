import { Swords } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoCarga, JugadorCarga } from '../../../shared/tiposApp';
import { escalaWidget } from '../posiciones';
import { usePantalla } from '../widgets/usePresencia';
import { TarjetaJugador } from './TarjetaJugador';
import './carga.css';

function Fila({ equipo, jugadores, version }: { equipo: JugadorCarga['equipo']; jugadores: JugadorCarga[]; version: string }) {
  if (jugadores.length === 0) return null;
  return (
    <ul className={`cg-fila ${equipo}`} aria-label={t(equipo === 'aliado' ? 'carga.aliados' : 'carga.enemigos')}>
      {jugadores.slice(0, 5).map((j, i) => (
        <TarjetaJugador key={`${j.equipo}-${j.campeonId}-${i}`} jugador={j} version={version} indice={i} />
      ))}
    </ul>
  );
}

/** Track F2: la ruta habitual del jungla enemigo, siempre marcada como «Estimación» (dato agregado, no de esta partida). */
function NotaRuta({ texto }: { texto: string }) {
  const etiqueta = t('junglaEnemiga.estimacion');
  const prefijo = `${etiqueta}: `;
  return (
    <p className="cg-ruta" role="note">
      <span className="cg-ruta-etiqueta">{etiqueta}</span>
      <span>{texto.startsWith(prefijo) ? texto.slice(prefijo.length) : texto}</span>
    </p>
  );
}

/**
 * Pantalla de carga del overlay: dos filas de 5 tarjetas translúcidas, los enemigos arriba y tu
 * equipo abajo, como en la pantalla de carga del juego. No captura el ratón (la ventana deja pasar los clics).
 */
export function PantallaCarga({ estado }: { estado: EstadoCarga | null }) {
  // 3.0.2: como los widgets, crece con el alto de la pantalla (× 2 a 4K); las tarjetas se diseñaron a 1080p.
  const zoom = Math.round(escalaWidget(usePantalla(), 1) * 1000) / 1000;
  if (!estado || estado.jugadores.length === 0) return null;
  const de = (equipo: JugadorCarga['equipo']) => estado.jugadores.filter((j) => j.equipo === equipo);
  return (
    <section className="cg-capa" aria-label={t('carga.titulo')} style={zoom !== 1 ? { zoom } : undefined}>
      <Fila equipo="enemigo" jugadores={de('enemigo')} version={estado.version} />
      <div className="cg-centro">
        <header className="cg-titulo">
          <span className="cg-titulo-linea" aria-hidden="true" />
          <span className="cg-titulo-sello">
            <Swords size={14} aria-hidden="true" />
            <span className="cg-titulo-texto">{t('carga.titulo')}</span>
            <span className="cg-titulo-sub">{t('carga.subtitulo')}</span>
          </span>
          <span className="cg-titulo-linea" aria-hidden="true" />
        </header>
        {estado.rutaJungla && <NotaRuta texto={estado.rutaJungla.texto} />}
      </div>
      <Fila equipo="aliado" jugadores={de('aliado')} version={estado.version} />
    </section>
  );
}
