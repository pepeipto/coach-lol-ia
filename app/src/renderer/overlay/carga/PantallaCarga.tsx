import { Swords } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoCarga, JugadorCarga } from '../../../shared/tiposApp';
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

/**
 * Pantalla de carga del overlay: dos filas de 5 tarjetas translúcidas, los enemigos arriba y tu
 * equipo abajo, como en la pantalla de carga del juego. No captura el ratón (la ventana deja pasar los clics).
 */
export function PantallaCarga({ estado }: { estado: EstadoCarga | null }) {
  if (!estado || estado.jugadores.length === 0) return null;
  const de = (equipo: JugadorCarga['equipo']) => estado.jugadores.filter((j) => j.equipo === equipo);
  return (
    <section className="cg-capa" aria-label={t('carga.titulo')}>
      <Fila equipo="enemigo" jugadores={de('enemigo')} version={estado.version} />
      <header className="cg-titulo">
        <span className="cg-titulo-linea" aria-hidden="true" />
        <span className="cg-titulo-sello">
          <Swords size={14} aria-hidden="true" />
          <span className="cg-titulo-texto">{t('carga.titulo')}</span>
          <span className="cg-titulo-sub">{t('carga.subtitulo')}</span>
        </span>
        <span className="cg-titulo-linea" aria-hidden="true" />
      </header>
      <Fila equipo="aliado" jugadores={de('aliado')} version={estado.version} />
    </section>
  );
}
