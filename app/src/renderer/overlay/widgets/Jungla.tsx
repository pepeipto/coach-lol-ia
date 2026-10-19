import { Trees } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { CampamentoEstado, EstadoJungla, IdCampamento } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { formatoCuenta } from '../posiciones';

/** Últimos segundos de una reaparición marcada en que el botón se resalta. */
export const JUNGLA_PRONTO_S = 30;

function Boton({ c, alMarcar, bloqueado }: { c: CampamentoEstado; alMarcar(id: IdCampamento): void; bloqueado: boolean }) {
  const pronto = c.marcado && c.aparece !== null && c.aparece <= JUNGLA_PRONTO_S;
  const tiempo = c.disponible || c.aparece === null ? t('jungla.disponible') : formatoCuenta(c.aparece);
  return (
    <button
      type="button"
      className={clases('ov-camp', c.disponible && 'disponible', c.marcado && 'marcado', pronto && 'pronto', c.id.startsWith('escarabajo') && 'rio')}
      data-campamento={c.id}
      aria-label={`${t(c.marcado ? 'jungla.cancelar' : 'jungla.marcar', { campamento: c.nombre })} (${tiempo})`}
      tabIndex={bloqueado ? -1 : undefined}
      onClick={() => !bloqueado && alMarcar(c.id)}
    >
      <span className="ov-camp-nombre">{c.id.startsWith('escarabajo') ? t('jungla.escarabajo') : c.nombre}</span>
      <span className="ov-camp-tiempo">{tiempo}</span>
    </button>
  );
}

/**
 * Temporizadores manuales: un botón por campamento propio (y los Escarabajos), agrupados por mitad
 * del mapa según tu lado. Al pulsar uno empieza su reaparición; pulsarlo otra vez la cancela.
 */
export function Jungla({ estado, alMarcar, bloqueado = false }: { estado: EstadoJungla; alMarcar(id: IdCampamento): void; bloqueado?: boolean }) {
  const grupo = (zona: 'arriba' | 'abajo') => estado.campamentos.filter((c) => c.zona === zona);
  return (
    <section className={clases('ov-jungla', `lado-${estado.lado}`)} aria-label={t('jungla.titulo')}>
      <header className="ov-jungla-cabecera">
        <Trees size={13} aria-hidden="true" />
        <span>{t('jungla.titulo')}</span>
        <span className="ov-jungla-lado">{t(estado.lado === 'azul' ? 'jungla.ladoAzul' : 'jungla.ladoRojo')}</span>
      </header>
      {(['arriba', 'abajo'] as const).map((zona) => (
        <div key={zona} className="ov-jungla-grupo" role="group" aria-label={t(`jungla.${zona}`)}>
          <span className="ov-jungla-zona">{t(`jungla.${zona}`)}</span>
          <div className="ov-jungla-botones">
            {grupo(zona).map((c) => (
              <Boton key={c.id} c={c} alMarcar={alMarcar} bloqueado={bloqueado} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
