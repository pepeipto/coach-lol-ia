import { Bell, ChevronsUp, Compass, Eye, ShoppingBag, Target } from 'lucide-react';
import { t } from '../../shared/i18n';
import type { TipoAviso } from '../../shared/tiposApp';
import { deducirTipo } from './textos';

export interface AvisoVisible {
  id: number;
  texto: string;
  tipo?: TipoAviso | null;
}

const ICONOS: Record<TipoAviso, typeof Bell> = {
  compra: ShoppingBag,
  habilidad: ChevronsUp,
  objetivo: Target,
  vision: Eye,
  fase: Compass,
};

/** Cada aviso entra deslizándose y se desvanece con una animación CSS de 5 s; Overlay lo retira al terminar. */
export function Avisos({ avisos, estaticos }: { avisos: AvisoVisible[]; estaticos?: boolean }) {
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => {
        const tipo = a.tipo ?? deducirTipo(a.texto);
        const Icono = tipo ? ICONOS[tipo] : Bell;
        return (
          <div key={a.id} className={estaticos ? 'aviso estatico' : 'aviso'} data-tipo={tipo ?? undefined}>
            <span className="aviso-icono" role={tipo ? 'img' : undefined} aria-label={tipo ? t('ajustes.aviso.' + tipo) : undefined} aria-hidden={tipo ? undefined : true}>
              <Icono size={16} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="aviso-texto">{a.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
