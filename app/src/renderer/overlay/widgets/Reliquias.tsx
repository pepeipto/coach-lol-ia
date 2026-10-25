import { HeartPulse } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { EstadoReliquias, IdReliquia, ReliquiaEstado } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { textoTemporizador } from '../posiciones';

/** Últimos segundos de una reaparición marcada en que el círculo se resalta. */
export const RELIQUIA_PRONTO_S = 15;

function Circulo({ r, alMarcar, bloqueado }: { r: ReliquiaEstado; alMarcar(id: IdReliquia): void; bloqueado: boolean }) {
  const pronto = r.marcado && r.aparece !== null && r.aparece <= RELIQUIA_PRONTO_S;
  const tiempo = r.disponible || r.aparece === null ? t('reliquias.disponible') : textoTemporizador(r.aparece);
  return (
    <button
      type="button"
      className={clases('ov-reliquia', r.disponible && 'disponible', r.marcado && 'marcado', pronto && 'pronto')}
      data-reliquia={r.id}
      aria-label={`${t(r.marcado ? 'reliquias.cancelar' : 'reliquias.marcar', { reliquia: r.nombre })} (${tiempo})`}
      title={r.nombre}
      tabIndex={bloqueado ? -1 : undefined}
      onClick={() => !bloqueado && alMarcar(r.id)}
    >
      <span className="ov-reliquia-circulo">{r.disponible ? <HeartPulse size={14} aria-hidden="true" /> : tiempo}</span>
      <span className="ov-reliquia-nombre">{t(`reliquias.corto.${r.id}`)}</span>
    </button>
  );
}

/**
 * 3.9: reliquias de vida del Abismo (ARAM y ARAM: Caos): cuatro círculos con su cuenta atrás. Al pulsar uno (o su
 * tecla) empieza la reaparición; pulsarlo otra vez la cancela. Arriba las de tu mitad, abajo las del rival.
 */
export function Reliquias({ estado, alMarcar, bloqueado = false }: { estado: EstadoReliquias; alMarcar(id: IdReliquia): void; bloqueado?: boolean }) {
  const grupo = (lado: 'propia' | 'rival') => estado.reliquias.filter((r) => r.id.startsWith(lado));
  return (
    <section className="ov-reliquias" aria-label={t('reliquias.titulo')}>
      <header className="ov-jungla-cabecera">
        <HeartPulse size={13} aria-hidden="true" />
        <span>{t('reliquias.titulo')}</span>
      </header>
      {(['propia', 'rival'] as const).map((lado) => (
        <div key={lado} className="ov-reliquias-grupo" role="group" aria-label={t(`reliquias.lado.${lado}`)}>
          <span className="ov-jungla-zona">{t(`reliquias.lado.${lado}`)}</span>
          <div className="ov-reliquias-botones">
            {grupo(lado).map((r) => (
              <Circulo key={r.id} r={r} alMarcar={alMarcar} bloqueado={bloqueado} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
