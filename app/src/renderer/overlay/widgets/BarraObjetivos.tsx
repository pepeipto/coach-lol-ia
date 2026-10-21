import { Bug, Castle, Crown, Eye, Flame, Skull } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { ObjetivoEstado } from '../../../shared/tiposApp';
import { clases } from '../../comun/componentes';
import { formatoCuenta } from '../posiciones';

/** Desde cuántos segundos antes de aparecer se resalta (y late) un objetivo. */
export const PRONTO_S = 60;

const ICONOS: Record<ObjetivoEstado['id'], typeof Flame> = {
  larvas: Bug,
  dragon: Flame,
  anciano: Crown,
  heraldo: Eye,
  baron: Skull,
  inhibidor: Castle,
};

const TIPOS_DRAGON = ['infernal', 'montana', 'oceano', 'nube', 'hextech', 'quimtech'];

/** Clase CSS del tipo de dragón a partir de su nombre en español (el que llega en `subtipo`). */
export function claseTipoDragon(subtipo: string | null): string | null {
  if (!subtipo) return null;
  const clave = TIPOS_DRAGON.find((k) => t(`overlay.dragon.${k}`) === subtipo);
  return clave ? `tipo-${clave}` : null;
}

/** Barra superior: un icono por objetivo con su cuenta atrás; late en el último minuto y se ilumina al aparecer. */
export function BarraObjetivos({ objetivos }: { objetivos: ObjetivoEstado[] }) {
  return (
    <ul className="ov-objetivos" aria-label={t('overlay.objetivos')}>
      {objetivos.map((o) => {
        const Icono = ICONOS[o.id];
        const pronto = !o.disponible && o.aparece !== null && o.aparece <= PRONTO_S;
        const nombre =
          o.id === 'inhibidor'
            ? t(o.aliado ? 'overlay.inhibidorAliado' : 'overlay.inhibidorEnemigo', { inhibidor: o.nombre })
            : o.subtipo
              ? t('overlay.objetivoConTipo', { objetivo: o.nombre, tipo: o.subtipo })
              : o.nombre;
        const tiempo = o.disponible || o.aparece === null ? t('overlay.objetivoYa') : formatoCuenta(o.aparece);
        return (
          <li
            key={o.id === 'inhibidor' ? `inhibidor-${o.aliado ? 'a' : 'e'}-${o.subtipo}` : o.id}
            className={clases(
              'ov-obj',
              `obj-${o.id}`,
              o.id === 'inhibidor' ? (o.aliado ? 'aliado' : 'enemigo') : claseTipoDragon(o.subtipo),
              pronto && 'pronto',
              o.disponible && 'disponible',
            )}
            data-objetivo={o.id}
            aria-label={`${nombre}: ${tiempo}`}
            title={nombre}
          >
            <span className="ov-obj-icono" aria-hidden="true">
              <Icono size={15} strokeWidth={2.2} />
            </span>
            <span className="ov-obj-tiempo" aria-hidden="true">
              {tiempo}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
