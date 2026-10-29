import { ChevronDown, ChevronUp, Swords } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../shared/i18n';
import type { EstadoCarga, JugadorCarga } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { Logo } from '../../comun/Logo';
import { escalaWidget } from '../posiciones';
import { usePantalla } from '../widgets/usePresencia';
import { textoCola, urlsArteCampeon } from './formato';
import { TarjetaJugador } from './TarjetaJugador';
import './carga.css';

/**
 * 3.1: 'completa' tapa toda la pantalla (fondo opaco, tarjetas grandes con el arte del campeón); 'tarjetas', las 10
 * tarjetas translúcidas sobre la pantalla de carga del juego (como en la 3.0.2).
 */
export type PresentacionCarga = 'completa' | 'tarjetas';

function Fila({ equipo, jugadores, version, grande }: { equipo: JugadorCarga['equipo']; jugadores: JugadorCarga[]; version: string; grande: boolean }) {
  if (jugadores.length === 0) return null;
  return (
    <ul className={`cg-fila ${equipo}`} aria-label={t(equipo === 'aliado' ? 'carga.aliados' : 'carga.enemigos')}>
      {jugadores.slice(0, 5).map((j, i) => (
        <TarjetaJugador key={`${j.equipo}-${j.campeonId}-${i}`} jugador={j} version={version} indice={i} grande={grande} />
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

/** «Espacio para ocultar», con la tecla dibujada. */
function PistaEspacio() {
  return (
    <p className="cg-pista">
      <kbd className="cg-tecla" aria-hidden="true">
        <span className="cg-tecla-barra" />
      </kbd>
      <span>{t('carga.ocultarEspacio')}</span>
    </p>
  );
}

/** Fondo de la pantalla completa: el splash del campeón del jugador, desenfocado y oscurecido, con los colores de los equipos. */
function Fondo({ campeon, skin }: { campeon: string; skin?: number }) {
  const [fallos, setFallos] = useState<string[]>([]);
  // La skin del jugador y, si no tiene splash (chroma), la clásica.
  const url = urlsArteCampeon('splash', campeon, skin).find((u) => !fallos.includes(u));
  return (
    <div className="cg-fondo" aria-hidden="true">
      {url && (
        <img
          key={url}
          className="cg-fondo-splash"
          src={url}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFallos((f) => [...f, url])}
        />
      )}
      <div className="cg-fondo-tinte" />
    </div>
  );
}

/** Cabecera de la pantalla completa: la marca, la cola y el mapa, y la pista de Espacio. */
function Cabecera({ estado, pistaEspacio }: { estado: EstadoCarga; pistaEspacio: boolean }) {
  const cola = textoCola(estado.cola);
  return (
    <header className="cg-cabecera-pantalla">
      <div className="cg-marca">
        <Logo tamano={34} />
        <span className="cg-marca-textos">
          <span className="cg-marca-nombre">Coach LoL IA</span>
          <span className="cg-marca-sub">{t('carga.titulo')}</span>
        </span>
      </div>
      <div className="cg-partida">
        {cola && <span className="cg-partida-cola">{cola}</span>}
        <span className="cg-partida-mapa">{t('carga.mapa.grieta')}</span>
      </div>
      <div className="cg-cabecera-derecha">{pistaEspacio && <PistaEspacio />}</div>
    </header>
  );
}

/**
 * Pantalla de carga del overlay: los enemigos arriba y tu equipo abajo, como en la pantalla de carga del juego. En
 * pantalla completa la sustituye a la vista (fondo opaco); con «solo tarjetas», las tarjetas translúcidas van encima.
 * No captura el ratón (la ventana deja pasar los clics) ni el foco del juego.
 */
export function PantallaCarga({
  estado,
  presentacion = 'completa',
  pistaEspacio = false,
  saliendo = false,
}: {
  estado: EstadoCarga | null;
  presentacion?: PresentacionCarga;
  /** Enseña «Espacio para ocultar» (ajuste «Ocultar con Espacio»). */
  pistaEspacio?: boolean;
  /** El jugador pulsó Espacio: se desvanece. */
  saliendo?: boolean;
}) {
  // 3.0.2: como los widgets, crece con el alto de la pantalla (× 2 a 4K); el diseño es a 1080p.
  const zoom = Math.round(escalaWidget(usePantalla(), 1) * 1000) / 1000;
  if (!estado || estado.jugadores.length === 0) return null;
  const de = (equipo: JugadorCarga['equipo']) => estado.jugadores.filter((j) => j.equipo === equipo);
  const completa = presentacion === 'completa';
  const aliados = de('aliado');
  // El fondo es el splash del campeón del jugador (o, si no se sabe quién es, el del primer aliado con campeón).
  const fondo = aliados.find((j) => j.propio && j.campeon) ?? aliados.find((j) => j.campeon);
  return (
    <section
      className={clases('cg-capa', completa ? 'completa' : 'tarjetas', saliendo && 'saliendo')}
      aria-label={t('carga.titulo')}
      style={zoom !== 1 ? { zoom } : undefined}
    >
      {completa && <Fondo campeon={fondo?.campeon ?? ''} skin={fondo?.skin} />}
      {completa && <Cabecera estado={estado} pistaEspacio={pistaEspacio} />}
      <Fila equipo="enemigo" jugadores={de('enemigo')} version={estado.version} grande={completa} />
      <div className="cg-centro">
        {completa ? (
          <div className="cg-versus">
            <span className="cg-versus-linea" aria-hidden="true" />
            <span className="cg-versus-equipo enemigo">
              <ChevronUp size={14} aria-hidden="true" />
              {t('carga.enemigos')}
            </span>
            <span className="cg-versus-sello"><span>{t('carga.vs')}</span></span>
            <span className="cg-versus-equipo aliado">
              {t('carga.aliados')}
              <ChevronDown size={14} aria-hidden="true" />
            </span>
            <span className="cg-versus-linea" aria-hidden="true" />
          </div>
        ) : (
          <header className="cg-titulo">
            <span className="cg-titulo-linea" aria-hidden="true" />
            <span className="cg-titulo-sello">
              <Swords size={14} aria-hidden="true" />
              <span className="cg-titulo-texto">{t('carga.titulo')}</span>
              <span className="cg-titulo-sub">{t('carga.subtitulo')}</span>
            </span>
            <span className="cg-titulo-linea" aria-hidden="true" />
          </header>
        )}
        {estado.rutaJungla && <NotaRuta texto={estado.rutaJungla.texto} />}
        {!completa && pistaEspacio && <PistaEspacio />}
      </div>
      <Fila equipo="aliado" jugadores={aliados} version={estado.version} grande={completa} />
      {completa && <p className="cg-pie">{t('carga.subtitulo')}</p>}
    </section>
  );
}
