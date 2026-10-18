import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

/** Une clases ignorando las vacías. */
export function clases(...lista: (string | false | null | undefined)[]): string {
  return lista.filter(Boolean).join(' ');
}

type PropsBoton = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'fantasma';
};

export function Boton({ variante = 'secundario', className, type = 'button', ...props }: PropsBoton) {
  return <button type={type} className={clases('boton', `boton-${variante}`, className)} {...props} />;
}

interface PropsTarjeta {
  titulo?: string;
  icono?: ReactNode;
  /** Contenido a la derecha del título (p. ej. una insignia). */
  extra?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Tarjeta({ titulo, icono, extra, className, children }: PropsTarjeta) {
  return (
    <section className={clases('tarjeta', className)}>
      {(titulo || icono || extra) && (
        <header className="tarjeta-cabecera">
          {icono && <span className="tarjeta-icono" aria-hidden="true">{icono}</span>}
          {titulo && <h3 className="tarjeta-titulo">{titulo}</h3>}
          {extra && <div className="tarjeta-extra">{extra}</div>}
        </header>
      )}
      <div className="tarjeta-cuerpo">{children}</div>
    </section>
  );
}

export type TonoInsignia = 'exito' | 'aviso' | 'error' | 'neutro' | 'oro';

export function Insignia({ tono, icono, children }: { tono: TonoInsignia; icono?: ReactNode; children: ReactNode }) {
  return (
    <span className={clases('insignia', `insignia-${tono}`)}>
      {icono && <span className="insignia-icono" aria-hidden="true">{icono}</span>}
      {children}
    </span>
  );
}

export interface OpcionPestana {
  id: string;
  texto: string;
  icono?: ReactNode;
}

export function Pestanas({
  opciones,
  activa,
  alCambiar,
  etiqueta,
}: {
  opciones: OpcionPestana[];
  activa: string;
  alCambiar(id: string): void;
  etiqueta?: string;
}) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === activa}
          className={clases('pestana', o.id === activa && 'activa')}
          onClick={() => alCambiar(o.id)}
        >
          {o.icono && <span className="pestana-icono" aria-hidden="true">{o.icono}</span>}
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({
  marcado,
  alCambiar,
  etiqueta,
  descripcion,
  deshabilitado,
}: {
  marcado: boolean;
  alCambiar(v: boolean): void;
  etiqueta: string;
  descripcion?: string;
  deshabilitado?: boolean;
}) {
  return (
    <label className={clases('interruptor', deshabilitado && 'deshabilitado')}>
      <span className="interruptor-textos">
        <span className="interruptor-etiqueta">{etiqueta}</span>
        {descripcion && <span className="interruptor-descripcion">{descripcion}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={marcado}
        aria-label={etiqueta}
        disabled={deshabilitado}
        className={clases('interruptor-pista', marcado && 'marcado')}
        onClick={() => alCambiar(!marcado)}
      >
        <span className="interruptor-bola" />
      </button>
    </label>
  );
}

export function Esqueleto({ ancho = '100%', alto = 16, redondo }: { ancho?: number | string; alto?: number | string; redondo?: boolean }) {
  return <span className={clases('esqueleto', redondo && 'redondo')} style={{ width: ancho, height: alto }} aria-hidden="true" />;
}

export type TonoAviso = 'info' | 'exito' | 'aviso' | 'error';

const ICONOS_AVISO = { info: Info, exito: CircleCheck, aviso: TriangleAlert, error: CircleAlert };

export function Aviso({ tono = 'info', children, accion }: { tono?: TonoAviso; children: ReactNode; accion?: ReactNode }) {
  const Icono = ICONOS_AVISO[tono];
  return (
    <div className={clases('aviso-caja', `aviso-${tono}`)} role={tono === 'aviso' || tono === 'error' ? 'alert' : 'status'}>
      <Icono className="aviso-icono" size={18} aria-hidden="true" />
      <div className="aviso-texto">{children}</div>
      {accion}
    </div>
  );
}
